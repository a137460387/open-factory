import type {ExportCostHistorySample} from '@open-factory/editor-core';
import {logger} from '@open-factory/editor-core/utils';
import {type ComplianceCheckResult} from '@open-factory/editor-core';
import {expandSequenceBatchOutputPath, getSyncedProjectSequences, getTimelinePlaybackDuration, isProgressiveExportSupported, analyzeExportOptimizationSuggestions, DEFAULT_EXPORT_OPTIMIZATION_SETTINGS, buildVersionedExportReportRows, calculateHistoricalEstimateErrorPercent, estimateExportCost, suggestRenderFarmInstances, type ExportTaskPriority, type ExportPipeline, type ExportPipelineNodeStatus, type ExportPublishNodeLog, type ExportTaskHistoryEntry, type ExportOptimizationSettings, type ExportPreviewSampleKind, type FfmpegCapabilities, type PreflightResult, type Project, buildExportPresetRecommendations, buildExportRecommendationContext, type ExportStemFormat, type ExportStemMode} from '@open-factory/editor-core';
import {useEffect, useMemo, useRef, useState} from 'react';
import {zhCN} from '../../i18n/strings';
import {evaluateExportQuality, getFileStat, getFfmpegCapabilities, listHardwareEncoders, listenBridge, readExportPresetSyncWebdavPassword, readExportUploadWebdavPassword, runExportPowerAction, type QualityEvaluationProgressEvent, type QualityEvaluationResult} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {DEFAULT_EXPORT_UPLOAD_SETTINGS, DEFAULT_EXPORT_PRESET_SYNC_SETTINGS, readExportBackgroundSettings, readDisableExportRecommendations, readExportOptimizationSettings, readExportPresetSyncSettings, readExportUploadSettings, type ExportBackgroundSettings, type ExportPresetSyncSettings, type ExportUploadSettings} from '../../settings/appSettings';
import {useWhisperSettingsStore} from '../../store/whisperSettingsStore';
import {localDatetimeInputValue, type ExportCompletionAction} from '../export-background';
import {loadExportHistoryIntoStore} from '../export-history';
import {estimateExportFileSizeBytes, formatEstimatedFileSize} from '../export-size-estimate';
import {useExportQueueStore} from '../export-queue-store';
import {getLastExportDurationSeconds, estimateDimensions} from '../export-utils';
import {BUILTIN_EXPORT_PRESETS, getExportPreset, loadExportPresets, type ExportPreset, type ExportPresetSettings} from '../export-presets';
import {applyCodecCompareQualityError, applyCodecCompareQualityResult, areCodecCompareResultsEqual, collectPendingCodecCompareEvaluations, markCodecCompareQualityRunning, recommendCodecCompareResult, sortCodecCompareResults, syncCodecCompareResultsWithTasks, type CodecCompareRecommendationMode, type CodecCompareJob, type CodecCompareResult, type CodecCompareSortDirection, type CodecCompareSortKey} from '../codec-compare';

import {AUDIO_VISUALIZATION_FORMATS, VIDEO_EXPORT_FORMATS, normalizeDraftSettings, supportsLoudnessNormalization, countSpatialDenoiseClips, collectSubtitleLanguageOptions} from '../lib/exportSettingsHelpers';

import {resolveActiveExportRanges, resolveInOutExportRanges, resolveSelectedClipExportRange, type ExportJob, type ExportRangeMode} from '../lib/pipelineHelpers';

import {type ExportWarmupUiStatus} from '../components/ExportOptimizationPanel';
import type {SequenceBatchPresetMode} from '../components/SequenceBatchSection';
import type {VersionedExportRowState} from '../components/ExportVersionBatchSection';

// Re-export types for sub-components
export type { ExportJob, ExportRangeMode } from '../lib/pipelineHelpers';
export type { ExportPreset, ExportPresetSettings } from '../export-presets';
export type { ExportWarmupUiStatus } from '../components/ExportOptimizationPanel';
export type { SequenceBatchPresetMode } from '../components/SequenceBatchSection';
export type { VersionedExportRowState } from '../components/ExportVersionBatchSection';

export type ExportMode = 'single' | 'version-batch' | 'sequence-batch' | 'codec-compare' | 'pipeline' | 'stem';

export type ExportStep = 'preview' | 'config' | 'export' | 'complete';

export interface ExportPreviewThumbnail {
  id: string;
  kind: ExportPreviewSampleKind;
  label: string;
  time: number;
  path: string;
  src: string;
  durationMs: number;
}

export interface ExportDialogProps {
  project: Project;
  initialPreset?: ExportPreset;
  selectedClipIds?: string[];
  inPoint?: number;
  outPoint?: number;
  onClose(): void;
  onCompleted(path: string): void;
  onRelinkMissing?(): void;
}

const VERSIONED_BATCH_TEMPLATE_EXTENSION = 'ofbatch.json';
const DEFAULT_VERSIONED_BATCH_ROWS: VersionedExportRowState[] = [
  {
    id: 'version-landscape',
    enabled: true,
    name: '横版 1080p',
    presetId: 'web-1080p',
    platform: 'YouTube',
    language: 'zh',
    rangeMode: 'default',
    rangeStart: 0,
    rangeDuration: 5,
    width: 1920,
    height: 1080,
    watermarkMode: 'inherit',
  },
  {
    id: 'version-vertical',
    enabled: true,
    name: '竖版 1080x1920',
    presetId: 'tiktok',
    platform: 'TikTok',
    language: 'zh',
    rangeMode: 'default',
    rangeStart: 0,
    rangeDuration: 5,
    width: 1080,
    height: 1920,
    watermarkMode: 'inherit',
  },
];
const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

export function useExportState(props: ExportDialogProps) {
  const { project, initialPreset, selectedClipIds = [], inPoint, outPoint, onClose, onCompleted, onRelinkMissing } = props;
  const t = zhCN.exportDialog;

  // Step state machine
  const [currentStep, setCurrentStep] = useState<ExportStep>('config');

  // Compliance state
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<string>('youtube-1080p');
  const [complianceResults, setComplianceResults] = useState<ComplianceCheckResult[]>([]);

  // Core export state
  const [outputPath, setOutputPath] = useState('');
  const [capabilities, setCapabilities] = useState<FfmpegCapabilities | undefined>();
  const [availableHwEncoders, setAvailableHwEncoders] = useState<
    import('@open-factory/editor-core').HardwareEncoderInfo[]
  >([]);
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<{
    issues: PreflightResult[];
    selectedJobs: ExportJob[];
    codecCompareJobs?: CodecCompareJob[];
  }>();
  const [presets, setPresets] = useState<ExportPreset[]>(
    initialPreset ? [initialPreset, ...BUILTIN_EXPORT_PRESETS] : BUILTIN_EXPORT_PRESETS,
  );
  const [presetId, setPresetId] = useState(initialPreset?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
  const [platformFitTarget, setPlatformFitTarget] = useState('');
  const [platformFitCustomSeconds, setPlatformFitCustomSeconds] = useState(60);
  const [draftSettings, setDraftSettings] = useState<ExportPresetSettings>({
    ...(initialPreset?.settings ?? BUILTIN_EXPORT_PRESETS[0].settings),
  });
  const [exportRangeMode, setExportRangeMode] = useState<ExportRangeMode>('all');
  const [exportMode, setExportMode] = useState<ExportMode>('single');
  const [pipelineConfig, setPipelineConfig] = useState<ExportPipeline>(() => ({
    id: 'pipeline-custom',
    name: zhCN.exportDialog.pipeline.defaultName,
    nodes: [],
    edges: [],
  }));
  const [pipelineStatuses, setPipelineStatuses] = useState<Record<string, ExportPipelineNodeStatus>>({});
  const [publishPipelineLogs, setPublishPipelineLogs] = useState<ExportPublishNodeLog[]>([]);
  const [customPresetName, setCustomPresetName] = useState('');
  const [batchOutputPaths, setBatchOutputPaths] = useState('');
  const [versionedBatchTemplate, setVersionedBatchTemplate] = useState(
    'C:/Exports/{version_name}-{platform}-{language}.mp4',
  );
  const [versionedBatchRows, setVersionedBatchRows] = useState<VersionedExportRowState[]>(() =>
    DEFAULT_VERSIONED_BATCH_ROWS.map((row) => ({ ...row })),
  );
  const [latestVersionedBatchId, setLatestVersionedBatchId] = useState<string>();
  const [versionedBatchFileSizes, setVersionedBatchFileSizes] = useState<Record<string, number>>({});
  const [sequenceBatchTemplate, setSequenceBatchTemplate] = useState('C:/Exports/{sequence}-{index}.mp4');
  const [selectedSequenceIds, setSelectedSequenceIds] = useState<string[]>([]);
  const [sequenceBatchOutputOverrides, setSequenceBatchOutputOverrides] = useState<Record<string, string>>({});
  const [sequenceBatchPresetMode, setSequenceBatchPresetMode] = useState<SequenceBatchPresetMode>('shared');
  const [sequenceBatchPresetIds, setSequenceBatchPresetIds] = useState<Record<string, string>>({});
  const [codecComparePresetIds, setCodecComparePresetIds] = useState<string[]>(() =>
    BUILTIN_EXPORT_PRESETS.slice(0, 2).map((preset) => preset.id),
  );
  const [codecCompareResults, setCodecCompareResults] = useState<CodecCompareResult[]>([]);
  const [codecCompareSort, setCodecCompareSort] = useState<{
    key: CodecCompareSortKey;
    direction: CodecCompareSortDirection;
  }>({ key: 'presetName', direction: 'asc' });
  const [codecCompareRecommendationMode, setCodecCompareRecommendationMode] =
    useState<CodecCompareRecommendationMode>('quality');
  const [codecCompareEvaluatingTaskId, setCodecCompareEvaluatingTaskId] = useState<string>();
  const [stemTracks, setStemTracks] = useState<
    Array<{ trackIndex: number; trackName: string; selected: boolean; format: ExportStemFormat }>
  >([]);
  const [stemMode, setStemMode] = useState<ExportStemMode>('independent');
  const [stemOutputDir, setStemOutputDir] = useState('');
  const [priority, setPriority] = useState<ExportTaskPriority>('normal');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledStartInput, setScheduledStartInput] = useState(() =>
    localDatetimeInputValue(new Date(Date.now() + 60_000)),
  );
  const [completionAction, setCompletionAction] = useState<ExportCompletionAction>('none');
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({
    allowPowerActions: false,
    postExportScriptAcknowledged: false,
    lowPowerMode: false,
  }));
  const [postExportScriptPendingConfirm, setPostExportScriptPendingConfirm] = useState(false);
  const pendingConfirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  const [exportOptimizationSettings, setExportOptimizationSettings] = useState<ExportOptimizationSettings>(() => ({
    ...DEFAULT_EXPORT_OPTIMIZATION_SETTINGS,
  }));
  const [exportUploadSettings, setExportUploadSettings] = useState<ExportUploadSettings>(() => ({
    ...DEFAULT_EXPORT_UPLOAD_SETTINGS,
    webdav: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.webdav },
    local: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.local },
  }));
  const [exportUploadPassword, setExportUploadPassword] = useState('');
  const [exportPresetSyncSettings, setExportPresetSyncSettings] = useState<ExportPresetSyncSettings>(() => ({
    ...DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  }));
  const [exportPresetSyncPassword, setExportPresetSyncPassword] = useState('');
  const [presetSyncState, setPresetSyncState] = useState<{
    status: 'idle' | 'running' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });
  const [warmupStatus, setWarmupStatus] = useState<ExportWarmupUiStatus>();
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [previewSamples, setPreviewSamples] = useState<ExportPreviewThumbnail[]>([]);
  const [qualityTaskId, setQualityTaskId] = useState<string>();
  const [qualityProgress, setQualityProgress] = useState(0);
  const [qualityResult, setQualityResult] = useState<{
    entry: ExportTaskHistoryEntry;
    result: QualityEvaluationResult;
  }>();
  const [qualityError, setQualityError] = useState<string>();
  const suggestedRenderFarmInstances = useMemo(
    () => suggestRenderFarmInstances(typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency),
    [],
  );
  const [renderFarmEnabled, setRenderFarmEnabled] = useState(false);
  const [renderFarmInstances, setRenderFarmInstances] = useState(suggestedRenderFarmInstances);
  const [progressiveExportEnabled, setProgressiveExportEnabled] = useState(false);
  const [disableRecommendations, setDisableRecommendations] = useState(false);
  const recommendationContext = useMemo(() => buildExportRecommendationContext(project), [project]);
  const recommendations = useMemo(() => {
    if (disableRecommendations) return [];
    return buildExportPresetRecommendations(recommendationContext, (code, ctx) => {
      const tRec = zhCN.exportRecommendations;
      if (code === 'resolution')
        return ctx.height > ctx.width ? tRec.reasonResolution('竖屏') : tRec.reasonResolution('横屏');
      if (code === 'duration') return tRec.reasonDuration(60);
      if (code === 'subtitles') return tRec.reasonSubtitles;
      if (code === 'hdr') return tRec.reasonHdr;
      return code;
    });
  }, [recommendationContext, disableRecommendations]);

  // Store selectors
  const tasks = useExportQueueStore((state) => state.tasks);
  const history = useExportQueueStore((state) => state.history);
  const runnerActive = useExportQueueStore((state) => state.runnerActive);
  const resourcePaused = useExportQueueStore((state) => state.resourcePaused);
  const queuePaused = useExportQueueStore((state) => state.queuePaused);
  const maxConcurrent = useExportQueueStore((state) => state.maxConcurrent);
  const clearFinishedTasks = useExportQueueStore((state) => state.clearFinishedTasks);
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);

  // Refs
  const notifiedSuccess = useRef(new Set<string>());
  const pendingCompletionAction = useRef<ExportCompletionAction>('none');
  const completionActionHandled = useRef(false);
  const enqueueInFlight = useRef(false);

  // Computed values
  const selectedPreset = useMemo(() => getExportPreset(presetId, presets), [presetId, presets]);
  const exportSettings = useMemo(() => normalizeDraftSettings(draftSettings), [draftSettings]);
  const batchSequences = useMemo(() => getSyncedProjectSequences(project), [project]);
  const sequenceBatchRows = useMemo(
    () =>
      batchSequences.map((sequence, index) => ({
        sequence,
        selected: selectedSequenceIds.includes(sequence.id),
        outputPath:
          sequenceBatchOutputOverrides[sequence.id] ??
          expandSequenceBatchOutputPath(sequenceBatchTemplate, sequence, index + 1),
        presetId: sequenceBatchPresetIds[sequence.id] ?? presetId,
      })),
    [
      batchSequences,
      presetId,
      selectedSequenceIds,
      sequenceBatchOutputOverrides,
      sequenceBatchPresetIds,
      sequenceBatchTemplate,
    ],
  );
  const isAudioVisualization = exportSettings.outputMode === 'audio-visualization';
  const isAudioOnly =
    !isAudioVisualization && (exportSettings.outputMode === 'audio' || exportSettings.format === 'm4a');
  const timelineVisualControlsDisabled = isAudioOnly || isAudioVisualization;
  const subtitleLanguageOptions = useMemo(() => collectSubtitleLanguageOptions(project), [project]);
  const loudnessNormalizationEligible = supportsLoudnessNormalization(
    exportSettings.format ?? 'mp4',
    exportSettings.outputMode,
  );
  const estimatedSize = useMemo(() => {
    const dimensions = estimateDimensions(
      exportSettings.width ?? project.settings.width,
      exportSettings.height ?? project.settings.height,
      exportSettings.format ?? 'mp4',
    );
    return formatEstimatedFileSize(
      estimateExportFileSizeBytes({
        width: dimensions.width,
        height: dimensions.height,
        fps: exportSettings.fps ?? project.settings.fps,
        duration: getTimelinePlaybackDuration(project.timeline),
        format: exportSettings.format ?? 'mp4',
        outputMode: exportSettings.outputMode,
        videoBitrate: exportSettings.videoBitrate,
        audioBitrate: exportSettings.audioBitrate,
      }),
    );
  }, [exportSettings, project.settings.fps, project.settings.height, project.settings.width, project.timeline]);

  const exportCostEstimate = useMemo(
    () => estimateExportCost({ project, settings: exportSettings }),
    [exportSettings, project],
  );
  const exportOptimizationSuggestions = useMemo(
    () =>
      analyzeExportOptimizationSuggestions(project, exportSettings, exportOptimizationSettings, {
        renderFarmEnabled,
        suggestedRenderFarmInstances,
      }),
    [exportOptimizationSettings, exportSettings, project, renderFarmEnabled, suggestedRenderFarmInstances],
  );
  const lastExportDurationSeconds = useMemo(() => getLastExportDurationSeconds(history), [history]);
  const exportCostHistoryError = useMemo(
    () =>
      calculateHistoricalEstimateErrorPercent(exportCostEstimate.estimatedDurationSeconds, lastExportDurationSeconds),
    [exportCostEstimate.estimatedDurationSeconds, lastExportDurationSeconds],
  );
  const historyCostSamples = useMemo<ExportCostHistorySample[]>(
    () =>
      history
        .filter((entry) => entry.status === 'success' && entry.startedAt)
        .slice(0, 10)
        .map((entry) => ({
          exportDurationSeconds: (Date.parse(entry.finishedAt) - Date.parse(entry.startedAt!)) / 1000,
          timelineDurationSeconds: getTimelinePlaybackDuration(project.timeline),
        })),
    [history, project.timeline],
  );
  const hardwareEncodingEligible = !isAudioOnly && (exportSettings.format === 'mp4' || exportSettings.format === 'mov');
  const hardwareEncodingRequested = hardwareEncodingEligible && exportSettings.hardwareEncoding === true;
  const progressiveExportSupported = useMemo(() => isProgressiveExportSupported(exportSettings), [exportSettings]);
  const formatOptions = isAudioVisualization ? AUDIO_VISUALIZATION_FORMATS : VIDEO_EXPORT_FORMATS;
  const spatialDenoiseClipCount = useMemo(() => countSpatialDenoiseClips(project), [project]);
  const inOutExportRanges = useMemo(
    () => resolveInOutExportRanges(project, inPoint, outPoint),
    [inPoint, outPoint, project],
  );
  const selectedClipExportRange = useMemo(
    () => resolveSelectedClipExportRange(project, selectedClipIds),
    [project, selectedClipIds],
  );
  const activeExportRanges = useMemo(
    () => resolveActiveExportRanges(exportRangeMode, inOutExportRanges, selectedClipExportRange),
    [exportRangeMode, inOutExportRanges, selectedClipExportRange],
  );
  const rangeModeAvailable = {
    all: true,
    'in-out': inOutExportRanges.length > 0,
    'selected-clips': Boolean(selectedClipExportRange),
  } satisfies Record<ExportRangeMode, boolean>;
  const sortedCodecCompareResults = useMemo(
    () => sortCodecCompareResults(codecCompareResults, codecCompareSort.key, codecCompareSort.direction),
    [codecCompareResults, codecCompareSort],
  );
  const codecCompareRecommendation = useMemo(
    () => recommendCodecCompareResult(codecCompareResults, codecCompareRecommendationMode),
    [codecCompareRecommendationMode, codecCompareResults],
  );
  const versionedBatchReportRows = useMemo(
    () =>
      buildVersionedExportReportRows(tasks, { batchId: latestVersionedBatchId, fileSizes: versionedBatchFileSizes }),
    [latestVersionedBatchId, tasks, versionedBatchFileSizes],
  );

  // Effects
  useEffect(() => {
    let canceled = false;
    void getFfmpegCapabilities()
      .then((result) => {
        if (!canceled) {
          setCapabilities(result);
          if (result.hardwareEncoders?.length) setAvailableHwEncoders(result.hardwareEncoders);
        }
      })
      .catch((reason) => {
        if (!canceled) {
          setError(reason instanceof Error ? reason.message : t.detectFfmpegFailed);
        }
      });
    void listHardwareEncoders()
      .then((encoders) => {
        if (!canceled && encoders.length > 0) setAvailableHwEncoders(encoders);
      })
      .catch(logError('ExportDialogx'));
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!rangeModeAvailable[exportRangeMode]) {
      setExportRangeMode('all');
    }
  }, [exportRangeMode, rangeModeAvailable]);

  useEffect(() => {
    setSelectedSequenceIds((current) => {
      const available = new Set(batchSequences.map((sequence) => sequence.id));
      const retained = current.filter((id) => available.has(id));
      if (retained.length > 0) {
        return retained;
      }
      return batchSequences[0] ? [batchSequences[0].id] : [];
    });
  }, [batchSequences]);

  useEffect(() => {
    void loadExportHistoryIntoStore();
    void readExportBackgroundSettings()
      .then(setExportBackgroundSettings)
      .catch((reason) => {
        logger.warn('Unable to load export background settings', reason);
      });
    void readExportOptimizationSettings()
      .then(setExportOptimizationSettings)
      .catch((reason) => {
        logger.warn('Unable to load export optimization settings', reason);
      });
    void readExportUploadSettings()
      .then(setExportUploadSettings)
      .catch((reason) => {
        logger.warn('Unable to load export upload settings', reason);
      });
    void readExportUploadWebdavPassword()
      .then((password) => setExportUploadPassword(password ?? ''))
      .catch((reason) => {
        logger.warn('Unable to load export upload password', reason);
      });
    void Promise.all([readExportPresetSyncSettings(), readExportPresetSyncWebdavPassword()])
      .then(([settings, password]) => {
        setExportPresetSyncSettings(settings);
        setExportPresetSyncPassword(password ?? '');
      })
      .catch((reason) => {
        logger.warn('Unable to load export preset sync settings', reason);
      });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenBridge<QualityEvaluationProgressEvent>('quality-evaluation-progress', (payload) => {
      setQualityProgress((current) => (payload.taskId === qualityTaskId ? payload.progressPct : current));
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [qualityTaskId]);

  useEffect(() => {
    let canceled = false;
    void readDisableExportRecommendations()
      .then(setDisableRecommendations)
      .catch((error) => logger.warn('Unable to load export recommendation settings', error));
    void loadExportPresets()
      .then((nextPresets) => {
        if (canceled) {
          return;
        }
        const nextWithInitial = initialPreset ? [initialPreset, ...nextPresets] : nextPresets;
        setPresets(nextWithInitial);
        setPresetId((current) =>
          nextWithInitial.some((preset) => preset.id === current)
            ? current
            : (nextWithInitial[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id),
        );
      })
      .catch((reason) => {
        if (!canceled) {
          setError(reason instanceof Error ? reason.message : t.loadPresetsFailed);
        }
      });
    return () => {
      canceled = true;
    };
  }, [initialPreset]);

  useEffect(() => {
    setDraftSettings({ ...selectedPreset.settings });
    setCustomPresetName('');
  }, [selectedPreset]);

  useEffect(() => {
    let sawNewSuccess = false;
    for (const task of tasks) {
      if (task.status === 'success' && !notifiedSuccess.current.has(task.id)) {
        notifiedSuccess.current.add(task.id);
        sawNewSuccess = true;
        onCompleted(task.outputPath);
        showToast({ kind: 'success', title: t.completeTitle, message: task.outputPath });
      }
    }
    const hasActiveTasks = tasks.some(
      (task) => task.status === 'scheduled' || task.status === 'pending' || task.status === 'running',
    );
    if (
      sawNewSuccess &&
      !hasActiveTasks &&
      pendingCompletionAction.current !== 'none' &&
      !completionActionHandled.current
    ) {
      completionActionHandled.current = true;
      void runCompletionAction(pendingCompletionAction.current, exportBackgroundSettings);
    }
  }, [exportBackgroundSettings, onCompleted, tasks]);

  useEffect(() => {
    setCodecCompareResults((current) => {
      if (current.length === 0) {
        return current;
      }
      const next = syncCodecCompareResultsWithTasks(current, tasks);
      return areCodecCompareResultsEqual(current, next) ? current : next;
    });
  }, [tasks]);

  useEffect(() => {
    if (codecCompareEvaluatingTaskId) {
      return;
    }
    const [request] = collectPendingCodecCompareEvaluations(codecCompareResults);
    if (!request) {
      return;
    }
    setCodecCompareEvaluatingTaskId(request.taskId);
    setCodecCompareResults((current) => markCodecCompareQualityRunning(current, request.taskId));
    void Promise.all([
      evaluateExportQuality({
        taskId: `codec-compare-quality-${request.taskId}`,
        sourcePath: request.sourcePath,
        outputPath: request.outputPath,
        duration: getTimelinePlaybackDuration(project.timeline),
      }),
      getFileStat(request.outputPath).catch(logError('ExportDialogx')),
    ])
      .then(([quality, stat]) => {
        setCodecCompareResults((current) =>
          applyCodecCompareQualityResult(current, request.taskId, quality, stat?.size),
        );
      })
      .catch((reason) => {
        setCodecCompareResults((current) =>
          applyCodecCompareQualityError(
            current,
            request.taskId,
            reason instanceof Error ? reason.message : t.quality.failedMessage,
          ),
        );
      })
      .finally(() => {
        setCodecCompareEvaluatingTaskId(undefined);
      });
  }, [codecCompareEvaluatingTaskId, project.timeline, t.quality.failedMessage, tasks]);

  useEffect(() => {
    if (!latestVersionedBatchId) {
      return;
    }
    const pendingStats = tasks.filter(
      (task) =>
        task.versionedBatch?.batchId === latestVersionedBatchId &&
        task.status === 'success' &&
        versionedBatchFileSizes[task.outputPath] === undefined,
    );
    if (pendingStats.length === 0) {
      return;
    }
    let canceled = false;
    void Promise.all(
      pendingStats.map(async (task) => ({
        outputPath: task.outputPath,
        size: (await getFileStat(task.outputPath).catch(logError('ExportDialogx')))?.size,
      })),
    ).then((stats) => {
      if (canceled) {
        return;
      }
      setVersionedBatchFileSizes((current) => {
        const next = { ...current };
        for (const stat of stats) {
          if (typeof stat.size === 'number' && Number.isFinite(stat.size)) {
            next[stat.outputPath] = stat.size;
          }
        }
        return next;
      });
    });
    return () => {
      canceled = true;
    };
  }, [latestVersionedBatchId, tasks, versionedBatchFileSizes]);

  useEffect(() => {
    const allTracks = project.timeline.tracks;
    const audioTrackEntries = allTracks
      .map((track, idx) => ({ track, idx }))
      .filter(({ track }) => track.type === 'audio' || track.clips.some((clip) => 'volume' in clip));
    setStemTracks((prev) => {
      const byIndex = new Map(prev.map((item) => [item.trackIndex, item]));
      return audioTrackEntries.map(({ track, idx }) => {
        const existing = byIndex.get(idx);
        return {
          trackIndex: idx,
          trackName: existing?.trackName ?? (track.name || `Track ${idx}`),
          selected: existing?.selected ?? true,
          format: existing?.format ?? 'default',
        };
      });
    });
  }, [project.timeline]);

  return {
    // Step state
    currentStep,
    setCurrentStep,

    // Compliance
    complianceOpen,
    setComplianceOpen,
    selectedSpecId,
    setSelectedSpecId,
    complianceResults,
    setComplianceResults,

    // Core export state
    outputPath,
    setOutputPath,
    capabilities,
    setCapabilities,
    availableHwEncoders,
    setAvailableHwEncoders,
    error,
    setError,
    preflight,
    setPreflight,
    presets,
    setPresets,
    presetId,
    setPresetId,
    platformFitTarget,
    setPlatformFitTarget,
    platformFitCustomSeconds,
    setPlatformFitCustomSeconds,
    draftSettings,
    setDraftSettings,
    exportRangeMode,
    setExportRangeMode,
    exportMode,
    setExportMode,
    pipelineConfig,
    setPipelineConfig,
    pipelineStatuses,
    setPipelineStatuses,
    publishPipelineLogs,
    setPublishPipelineLogs,
    customPresetName,
    setCustomPresetName,
    batchOutputPaths,
    setBatchOutputPaths,
    versionedBatchTemplate,
    setVersionedBatchTemplate,
    versionedBatchRows,
    setVersionedBatchRows,
    latestVersionedBatchId,
    setLatestVersionedBatchId,
    versionedBatchFileSizes,
    setVersionedBatchFileSizes,
    sequenceBatchTemplate,
    setSequenceBatchTemplate,
    selectedSequenceIds,
    setSelectedSequenceIds,
    sequenceBatchOutputOverrides,
    setSequenceBatchOutputOverrides,
    sequenceBatchPresetMode,
    setSequenceBatchPresetMode,
    sequenceBatchPresetIds,
    setSequenceBatchPresetIds,
    codecComparePresetIds,
    setCodecComparePresetIds,
    codecCompareResults,
    setCodecCompareResults,
    codecCompareSort,
    setCodecCompareSort,
    codecCompareRecommendationMode,
    setCodecCompareRecommendationMode,
    codecCompareEvaluatingTaskId,
    setCodecCompareEvaluatingTaskId,
    stemTracks,
    setStemTracks,
    stemMode,
    setStemMode,
    stemOutputDir,
    setStemOutputDir,
    priority,
    setPriority,
    scheduleEnabled,
    setScheduleEnabled,
    scheduledStartInput,
    setScheduledStartInput,
    completionAction,
    setCompletionAction,
    exportBackgroundSettings,
    setExportBackgroundSettings,
    postExportScriptPendingConfirm,
    setPostExportScriptPendingConfirm,
    pendingConfirmResolveRef,
    exportOptimizationSettings,
    setExportOptimizationSettings,
    exportUploadSettings,
    setExportUploadSettings,
    exportUploadPassword,
    setExportUploadPassword,
    exportPresetSyncSettings,
    setExportPresetSyncSettings,
    exportPresetSyncPassword,
    setExportPresetSyncPassword,
    presetSyncState,
    setPresetSyncState,
    warmupStatus,
    setWarmupStatus,
    previewRunning,
    setPreviewRunning,
    previewError,
    setPreviewError,
    previewSamples,
    setPreviewSamples,
    qualityTaskId,
    setQualityTaskId,
    qualityProgress,
    setQualityProgress,
    qualityResult,
    setQualityResult,
    qualityError,
    setQualityError,
    suggestedRenderFarmInstances,
    renderFarmEnabled,
    setRenderFarmEnabled,
    renderFarmInstances,
    setRenderFarmInstances,
    progressiveExportEnabled,
    setProgressiveExportEnabled,
    disableRecommendations,
    setDisableRecommendations,
    recommendationContext,
    recommendations,

    // Store selectors
    tasks,
    history,
    runnerActive,
    resourcePaused,
    queuePaused,
    maxConcurrent,
    clearFinishedTasks,
    whisperExecutablePath,
    whisperModelPath,

    // Refs
    notifiedSuccess,
    pendingCompletionAction,
    completionActionHandled,
    enqueueInFlight,

    // Computed values
    selectedPreset,
    exportSettings,
    batchSequences,
    sequenceBatchRows,
    isAudioVisualization,
    isAudioOnly,
    timelineVisualControlsDisabled,
    subtitleLanguageOptions,
    loudnessNormalizationEligible,
    estimatedSize,
    exportCostEstimate,
    exportOptimizationSuggestions,
    lastExportDurationSeconds,
    exportCostHistoryError,
    historyCostSamples,
    hardwareEncodingEligible,
    hardwareEncodingRequested,
    progressiveExportSupported,
    formatOptions,
    spatialDenoiseClipCount,
    inOutExportRanges,
    selectedClipExportRange,
    activeExportRanges,
    rangeModeAvailable,
    sortedCodecCompareResults,
    codecCompareRecommendation,
    versionedBatchReportRows,

    // Props
    project,
    initialPreset,
    selectedClipIds,
    inPoint,
    outPoint,
    onClose,
    onCompleted,
    onRelinkMissing,

    // i18n
    t,
  };
}

export type ExportState = ReturnType<typeof useExportState>;

// Helper functions
function logError(context: string) {
  return (error: unknown) => {
    logger.error(`[${context}]`, error);
  };
}

async function runCompletionAction(action: ExportCompletionAction, settings: ExportBackgroundSettings): Promise<void> {
  if (action === 'none') {
    return;
  }
  if (action === 'notification') {
    showToast({
      kind: 'success',
      title: zhCN.exportDialog.completionAction.notificationTitle,
      message: zhCN.exportDialog.completionAction.notificationMessage,
    });
    if (typeof Notification !== 'undefined') {
      const permission =
        Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        new Notification(zhCN.exportDialog.completionAction.notificationTitle, {
          body: zhCN.exportDialog.completionAction.notificationMessage,
        });
      }
    }
    return;
  }
  if (!settings.allowPowerActions) {
    showToast({
      kind: 'warning',
      title: zhCN.exportDialog.completionAction.powerDisabledTitle,
      message: zhCN.exportDialog.completionAction.powerDisabled,
    });
    return;
  }
  try {
    await runExportPowerAction(action, true);
  } catch (error) {
    showToast({
      kind: 'error',
      title: zhCN.exportDialog.completionAction.powerFailedTitle,
      message: error instanceof Error ? error.message : zhCN.exportDialog.completionAction.powerFailedMessage,
    });
  }
}
