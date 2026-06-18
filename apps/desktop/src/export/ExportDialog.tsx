import {
  TARGET_ASPECT_RATIOS,
  SUPPORTED_PROJECT_FPS,
  appendExportRangeSequence,
  BUILTIN_AUDIO_VISUALIZATION_THEMES,
  buildExportProjectFromProject,
  buildFfmpegPreviewSamplePlans,
  buildProjectForSequenceExport,
  clampReframeOffset,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  EXPORT_COLOR_SPACES,
  exportRenderRangeFromPoints,
  expandSequenceBatchOutputPath,
  getSyncedProjectSequences,
  hasExportMasterProcessing,
  expandAudioVisualizationTheme,
  getTimelinePlaybackDuration,
  isProgressiveExportSupported,
  normalizeExportMasterProcessing,
  normalizeAudioVisualizationTheme,
  analyzeExportOptimizationSuggestions,
  applyExportOptimizationSuggestion,
  DEFAULT_EXPORT_OPTIMIZATION_SETTINGS,
  normalizeExportColorManagement,
  normalizeExportPostScript,
  normalizeExportRenderRange,
  normalizeExportRanges,
  normalizeProjectFps,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
  normalizeVideoRestoration,
  buildVersionedExportReportRows,
  createVersionedExportJobs,
  parseVersionedBatchTemplate,
  serializeVersionedBatchTemplate,
  runExportPreflight,
  assessQualityMetric,
  calculateHistoricalEstimateErrorPercent,
  estimateExportCost,
  normalizeTargetAspectRatio,
  resolveReframeDimensions,
  SequenceDependencyCycleError,
  ExportPipelineCycleError,
  createTwoStepExportPipeline,
  getPipelineUpstreamNodeIds,
  shouldRunExportPipelineNode,
  sortBatchSequenceIds,
  suggestRenderFarmInstances,
  topologicallySortExportPipeline,
  upsertCustomAudioVisualizationTheme,
  removeCustomAudioVisualizationTheme,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  type AudioVisualizationThemeDefinition,
  type CustomAudioVisualizationTheme,
  type ExportAudioVisualizationBackground,
  type ExportAudioVisualizationStyle,
  type ExportColorSpace,
  type ExportRenderRange,
  type NormalizedExportRenderRange,
  type ExportSubtitleFormat,
  type ExportTaskStatus,
  type ExportTaskPriority,
  type ExportTask,
  type ExportCostCpuLoad,
  type ExportLoudnessNormalization,
  type ExportPostExportScriptResult,
  type ExportRecoveryReport,
  type ExportPipeline,
  type ExportPipelineNode,
  type ExportPipelineNodeStatus,
  type ExportTaskHistoryEntry,
  type ExportUploadState,
  type ExportUploadTargetType,
  type ExportOptimizationSettings,
  type ExportOptimizationSuggestion,
  type ExportPreviewSampleKind,
  type ExportProject,
  type ExportMasterProcessingSettings,
  type PostExportQualityAssuranceResult,
  type PostExportQualityCheckResult,
  type ExportWatermarkPosition,
  type FfmpegCapabilities,
  type QualityLevel,
  type PreflightResult,
  type Project,
  type Sequence,
  type TargetAspectRatio,
  type VersionedExportDefinition,
  type VersionedExportReportRow,
  type VersionedExportTaskMetadata
} from '@open-factory/editor-core';
import { AlertTriangle, Cloud, CloudDownload, Clock3, Download, FileText, FolderOpen, Image as ImageIcon, ListPlus, Loader2, Minimize2, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { zhCN } from '../i18n/strings';
import { chooseExportPath, revealExport } from '../lib/exportVideo';
import { isFontFamilyAvailable } from '../lib/fonts';
import {
  cancelQualityEvaluation,
  convertLocalFileSrc,
  evaluateExportQuality,
  getAppDataDir,
  getFileStat,
  getFfmpegCapabilities,
  getWebdavText,
  getTempSegmentsDir,
  listenBridge,
  minimizeToTray,
  openFileDialog,
  openDirectoryDialog,
  openPath,
  readFile,
  readExportPresetSyncWebdavPassword,
  readExportUploadWebdavPassword,
  runExportPowerAction,
  runExportPreviewSamples,
  saveFileDialog,
  putWebdavText,
  writeFile,
  writeExportUploadWebdavPassword,
  type QualityEvaluationProgressEvent,
  type QualityEvaluationResult
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  DEFAULT_EXPORT_UPLOAD_SETTINGS,
  DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  readAudioVisualizationThemeSettings,
  readExportBackgroundSettings,
  readExportOptimizationSettings,
  readExportPresetSyncSettings,
  readExportUploadSettings,
  saveExportBackgroundSettings,
  saveExportOptimizationSettings,
  saveAudioVisualizationThemeSettings,
  saveExportPresetSyncSettings,
  saveExportUploadSettings,
  type ExportBackgroundSettings,
  type ExportPresetSyncSettings,
  type ExportUploadSettings
} from '../settings/appSettings';
import { drawAudioVisualizationThemePreviewFrame } from '../media/audioVisualizationThemePreview';
import { getWhisperAvailability } from '../lib/whisper';
import { useWhisperSettingsStore } from '../store/whisperSettingsStore';
import { cancelQueuedExportTask, enqueueExport, pauseQueuedExportTask, retryQueuedExportTask, setExportQueueMaxConcurrent, setExportQueuePaused } from './export-queue-runner';
import { EXPORT_COMPLETION_ACTIONS, localDatetimeInputValue, normalizeExportCompletionAction, normalizeScheduledExportStart, type ExportCompletionAction } from './export-background';
import { loadExportHistoryIntoStore } from './export-history';
import { estimateExportFileSizeBytes, formatEstimatedFileSize } from './export-size-estimate';
import { useExportQueueStore } from './export-queue-store';
import { retryExportUploadFromHistory } from './export-upload';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { useMediaJobStore } from '../media/media-job-store';
import { runExportWarmup, type ExportWarmupStepId } from './export-warmup';
import {
  BUILTIN_EXPORT_PRESETS,
  deleteCustomExportPreset,
  EXPORT_PRESET_PACKAGE_EXTENSION,
  fetchOfficialExportPresetPackage,
  getExportPreset,
  importExportPresetPackage,
  loadExportPresets,
  parseExportPresetPackage,
  saveCustomExportPreset,
  serializeExportPresetPackage,
  syncExportPresetsWithWebdav,
  type ExportPreset,
  type ExportPresetImportConflictMode,
  type ExportPresetSettings
} from './export-presets';
import {
  MAX_CODEC_COMPARE_PRESETS,
  applyCodecCompareQualityError,
  applyCodecCompareQualityResult,
  areCodecCompareResultsEqual,
  buildCodecCompareJobs,
  collectPendingCodecCompareEvaluations,
  createInitialCodecCompareResults,
  markCodecCompareQualityRunning,
  recommendCodecCompareResult,
  sortCodecCompareResults,
  syncCodecCompareResultsWithTasks,
  type CodecCompareRecommendationMode,
  type CodecCompareJob,
  type CodecCompareResult,
  type CodecCompareSortDirection,
  type CodecCompareSortKey
} from './codec-compare';

interface ExportDialogProps {
  project: Project;
  initialPreset?: ExportPreset;
  selectedClipIds?: string[];
  inPoint?: number;
  outPoint?: number;
  onClose(): void;
  onCompleted(path: string): void;
  onRelinkMissing?(): void;
}

type ExportRangeMode = 'all' | 'in-out' | 'selected-clips';
type ExportMode = 'single' | 'version-batch' | 'sequence-batch' | 'codec-compare' | 'pipeline';
type SequenceBatchPresetMode = 'shared' | 'individual';
type VersionWatermarkMode = 'inherit' | 'none' | 'text';
type VersionRangeMode = 'default' | 'custom';

interface VersionedExportRowState {
  id: string;
  enabled: boolean;
  name: string;
  presetId: string;
  platform: string;
  language: string;
  rangeMode: VersionRangeMode;
  rangeStart: number;
  rangeDuration: number;
  width: number;
  height: number;
  watermarkMode: VersionWatermarkMode;
}

interface ExportJob {
  outputPath: string;
  range?: ExportRenderRange | null;
  project?: Project;
  settings?: ExportPresetSettings;
  metadata?: ExportProject['metadata'];
  versionedBatch?: VersionedExportTaskMetadata;
  presetName?: string;
  sequenceName?: string;
}

type ExportWarmupUiStatus = { status: 'running' | 'complete' | 'cached'; step?: ExportWarmupStepId };

const WATERMARK_POSITIONS: ExportWatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
];
const AUDIO_VISUALIZATION_FORMATS = ['mp4', 'mov', 'webm'];
const VIDEO_EXPORT_FORMATS = ['mp4', 'mov', 'mkv', 'webm', 'm4a', 'gif', 'webp', 'apng', 'png-sequence'];
const AUDIO_VISUALIZATION_STYLES: ExportAudioVisualizationStyle[] = ['waveform-line', 'spectrum-bars', 'circular-spectrum'];
const AUDIO_VISUALIZATION_BACKGROUND_TYPES: ExportAudioVisualizationBackground['type'][] = ['solid', 'gradient', 'image'];
const SUBTITLE_FORMATS: ExportSubtitleFormat[] = ['srt', 'vtt', 'ass', 'ssa'];
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
    watermarkMode: 'inherit'
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
    watermarkMode: 'inherit'
  }
];
const DEFAULT_AUDIO_VISUALIZATION: NonNullable<ExportPresetSettings['audioVisualization']> = {
  style: 'waveform-line',
  color: '#22d3ee',
  background: { type: 'solid', color: '#050816' }
};
const DEFAULT_TIMECODE_BURN_IN: NonNullable<ExportPresetSettings['timecodeBurnIn']> = {
  enabled: true,
  position: 'bottom-left',
  fontSize: 28,
  color: '#ffffff',
  backgroundColor: '#000000',
  includeFrameNumber: false
};
const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

interface ExportPreviewThumbnail {
  id: string;
  kind: ExportPreviewSampleKind;
  label: string;
  time: number;
  path: string;
  src: string;
  durationMs: number;
}

interface SubtitleLanguageOption {
  language: string;
  label: string;
  trackCount: number;
}

function PipelineSection({
  pipeline,
  statuses,
  onCreateTemplate
}: {
  pipeline: ExportPipeline;
  statuses: Record<string, ExportPipelineNodeStatus>;
  onCreateTemplate(): void;
}) {
  const t = zhCN.exportDialog.pipeline;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-pipeline-tab">
      <label className="pt-1 text-xs font-medium text-slate-600">{t.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            data-testid="export-pipeline-create-two-node"
            onClick={onCreateTemplate}
          >
            {t.createTwoNode}
          </button>
          <span className="text-xs text-slate-500" data-testid="export-pipeline-summary">
            {t.summary(pipeline.nodes.length, pipeline.edges.length)}
          </span>
        </div>
        {pipeline.nodes.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-panel px-3 py-6 text-center text-xs text-slate-500" data-testid="export-pipeline-empty">
            {t.empty}
          </div>
        ) : (
          <div className="grid gap-2" data-testid="export-pipeline-node-list">
            {pipeline.nodes.map((node) => {
              const status = statuses[node.id] ?? 'waiting';
              const downstream = pipeline.edges.filter((edge) => edge.from === node.id).map((edge) => pipeline.nodes.find((item) => item.id === edge.to)?.name ?? edge.to);
              return (
                <div key={node.id} className="rounded-md border border-line bg-white p-3 text-xs" data-testid="export-pipeline-node" data-node-id={node.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{node.name}</div>
                      <div className="mt-1 text-slate-500">{t.nodeTypes[node.type]}</div>
                      {downstream.length > 0 ? <div className="mt-1 text-slate-500">{t.downstream(downstream.join(' / '))}</div> : null}
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pipelineStatusClass(status)}`} data-testid="export-pipeline-node-status" data-status={status}>
                      {t.status[status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VersionedBatchReportTable({ rows }: { rows: VersionedExportReportRow[] }) {
  const t = zhCN.exportDialog.versionBatch.report;
  return (
    <div className="overflow-hidden rounded-md border border-line" data-testid="export-version-report">
      <div className="border-b border-line bg-panel px-3 py-2 text-xs font-semibold text-slate-700">{t.title}</div>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-panel/60 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.version}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.platform}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.resolution}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.fileSize}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.duration}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.elapsed}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.batchId}-${row.versionId}`} className="border-t border-line" data-testid="export-version-report-row" data-version-id={row.versionId}>
              <td className="px-2 py-2 font-medium text-slate-800">{row.versionName}</td>
              <td className="px-2 py-2 text-slate-600">{[row.platform, row.language].filter(Boolean).join(' / ') || zhCN.common.auto}</td>
              <td className="px-2 py-2 tabular-nums text-slate-600">{row.width && row.height ? `${row.width} x ${row.height}` : zhCN.common.auto}</td>
              <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-version-report-size">{formatBytes(row.fileSizeBytes ?? undefined)}</td>
              <td className="px-2 py-2 tabular-nums text-slate-600">{row.durationSeconds === null ? zhCN.common.auto : formatDuration(row.durationSeconds)}</td>
              <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-version-report-elapsed">{formatMilliseconds(row.elapsedMs ?? undefined)}</td>
              <td className="px-2 py-2 text-slate-600">{zhCN.exportDialog.status[row.status] ?? row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExportDialog({ project, initialPreset, selectedClipIds = [], inPoint, outPoint, onClose, onCompleted, onRelinkMissing }: ExportDialogProps) {
  const t = zhCN.exportDialog;
  const [outputPath, setOutputPath] = useState('');
  const [capabilities, setCapabilities] = useState<FfmpegCapabilities | undefined>();
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<{ issues: PreflightResult[]; selectedJobs: ExportJob[]; codecCompareJobs?: CodecCompareJob[] }>();
  const [presets, setPresets] = useState<ExportPreset[]>(initialPreset ? [initialPreset, ...BUILTIN_EXPORT_PRESETS] : BUILTIN_EXPORT_PRESETS);
  const [presetId, setPresetId] = useState(initialPreset?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
  const [draftSettings, setDraftSettings] = useState<ExportPresetSettings>({ ...(initialPreset?.settings ?? BUILTIN_EXPORT_PRESETS[0].settings) });
  const [exportRangeMode, setExportRangeMode] = useState<ExportRangeMode>('all');
  const [exportMode, setExportMode] = useState<ExportMode>('single');
  const [pipelineConfig, setPipelineConfig] = useState<ExportPipeline>(() => ({ id: 'pipeline-custom', name: zhCN.exportDialog.pipeline.defaultName, nodes: [], edges: [] }));
  const [pipelineStatuses, setPipelineStatuses] = useState<Record<string, ExportPipelineNodeStatus>>({});
  const [customPresetName, setCustomPresetName] = useState('');
  const [batchOutputPaths, setBatchOutputPaths] = useState('');
  const [versionedBatchTemplate, setVersionedBatchTemplate] = useState('C:/Exports/{version_name}-{platform}-{language}.mp4');
  const [versionedBatchRows, setVersionedBatchRows] = useState<VersionedExportRowState[]>(() => DEFAULT_VERSIONED_BATCH_ROWS.map((row) => ({ ...row })));
  const [latestVersionedBatchId, setLatestVersionedBatchId] = useState<string>();
  const [versionedBatchFileSizes, setVersionedBatchFileSizes] = useState<Record<string, number>>({});
  const [sequenceBatchTemplate, setSequenceBatchTemplate] = useState('C:/Exports/{sequence}-{index}.mp4');
  const [selectedSequenceIds, setSelectedSequenceIds] = useState<string[]>([]);
  const [sequenceBatchOutputOverrides, setSequenceBatchOutputOverrides] = useState<Record<string, string>>({});
  const [sequenceBatchPresetMode, setSequenceBatchPresetMode] = useState<SequenceBatchPresetMode>('shared');
  const [sequenceBatchPresetIds, setSequenceBatchPresetIds] = useState<Record<string, string>>({});
  const [codecComparePresetIds, setCodecComparePresetIds] = useState<string[]>(() => BUILTIN_EXPORT_PRESETS.slice(0, 2).map((preset) => preset.id));
  const [codecCompareResults, setCodecCompareResults] = useState<CodecCompareResult[]>([]);
  const [codecCompareSort, setCodecCompareSort] = useState<{ key: CodecCompareSortKey; direction: CodecCompareSortDirection }>({ key: 'presetName', direction: 'asc' });
  const [codecCompareRecommendationMode, setCodecCompareRecommendationMode] = useState<CodecCompareRecommendationMode>('quality');
  const [codecCompareEvaluatingTaskId, setCodecCompareEvaluatingTaskId] = useState<string>();
  const [priority, setPriority] = useState<ExportTaskPriority>('normal');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledStartInput, setScheduledStartInput] = useState(() => localDatetimeInputValue(new Date(Date.now() + 60_000)));
  const [completionAction, setCompletionAction] = useState<ExportCompletionAction>('none');
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({ allowPowerActions: false, postExportScriptAcknowledged: false, lowPowerMode: false }));
  const [exportOptimizationSettings, setExportOptimizationSettings] = useState<ExportOptimizationSettings>(() => ({ ...DEFAULT_EXPORT_OPTIMIZATION_SETTINGS }));
  const [exportUploadSettings, setExportUploadSettings] = useState<ExportUploadSettings>(() => ({
    ...DEFAULT_EXPORT_UPLOAD_SETTINGS,
    webdav: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.webdav },
    local: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.local }
  }));
  const [exportUploadPassword, setExportUploadPassword] = useState('');
  const [exportPresetSyncSettings, setExportPresetSyncSettings] = useState<ExportPresetSyncSettings>(() => ({ ...DEFAULT_EXPORT_PRESET_SYNC_SETTINGS }));
  const [exportPresetSyncPassword, setExportPresetSyncPassword] = useState('');
  const [presetSyncState, setPresetSyncState] = useState<{ status: 'idle' | 'running' | 'success' | 'error'; message?: string }>({ status: 'idle' });
  const [warmupStatus, setWarmupStatus] = useState<ExportWarmupUiStatus>();
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [previewSamples, setPreviewSamples] = useState<ExportPreviewThumbnail[]>([]);
  const [qualityTaskId, setQualityTaskId] = useState<string>();
  const [qualityProgress, setQualityProgress] = useState(0);
  const [qualityResult, setQualityResult] = useState<{ entry: ExportTaskHistoryEntry; result: QualityEvaluationResult }>();
  const [qualityError, setQualityError] = useState<string>();
  const suggestedRenderFarmInstances = useMemo(() => suggestRenderFarmInstances(typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency), []);
  const [renderFarmEnabled, setRenderFarmEnabled] = useState(false);
  const [renderFarmInstances, setRenderFarmInstances] = useState(suggestedRenderFarmInstances);
  const [progressiveExportEnabled, setProgressiveExportEnabled] = useState(false);
  const tasks = useExportQueueStore((state) => state.tasks);
  const history = useExportQueueStore((state) => state.history);
  const runnerActive = useExportQueueStore((state) => state.runnerActive);
  const resourcePaused = useExportQueueStore((state) => state.resourcePaused);
  const queuePaused = useExportQueueStore((state) => state.queuePaused);
  const maxConcurrent = useExportQueueStore((state) => state.maxConcurrent);
  const clearFinishedTasks = useExportQueueStore((state) => state.clearFinishedTasks);
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const notifiedSuccess = useRef(new Set<string>());
  const pendingCompletionAction = useRef<ExportCompletionAction>('none');
  const completionActionHandled = useRef(false);
  const enqueueInFlight = useRef(false);
  const selectedPreset = useMemo(() => getExportPreset(presetId, presets), [presetId, presets]);
  const exportSettings = useMemo(() => normalizeDraftSettings(draftSettings), [draftSettings]);
  const batchSequences = useMemo(() => getSyncedProjectSequences(project), [project]);
  const sequenceBatchRows = useMemo(
    () =>
      batchSequences.map((sequence, index) => ({
        sequence,
        selected: selectedSequenceIds.includes(sequence.id),
        outputPath: sequenceBatchOutputOverrides[sequence.id] ?? expandSequenceBatchOutputPath(sequenceBatchTemplate, sequence, index + 1),
        presetId: sequenceBatchPresetIds[sequence.id] ?? presetId
      })),
    [batchSequences, presetId, selectedSequenceIds, sequenceBatchOutputOverrides, sequenceBatchPresetIds, sequenceBatchTemplate]
  );
  const isAudioVisualization = exportSettings.outputMode === 'audio-visualization';
  const isAudioOnly = !isAudioVisualization && (exportSettings.outputMode === 'audio' || exportSettings.format === 'm4a');
  const timelineVisualControlsDisabled = isAudioOnly || isAudioVisualization;
  const subtitleLanguageOptions = useMemo(() => collectSubtitleLanguageOptions(project), [project]);
  const loudnessNormalizationEligible = supportsLoudnessNormalization(exportSettings.format ?? 'mp4', exportSettings.outputMode);
  const estimatedSize = useMemo(() => {
    const dimensions = estimateDimensions(exportSettings.width ?? project.settings.width, exportSettings.height ?? project.settings.height, exportSettings.format ?? 'mp4');
    return formatEstimatedFileSize(
      estimateExportFileSizeBytes({
        width: dimensions.width,
        height: dimensions.height,
        fps: exportSettings.fps ?? project.settings.fps,
        duration: getTimelinePlaybackDuration(project.timeline),
        format: exportSettings.format ?? 'mp4',
        outputMode: exportSettings.outputMode,
        videoBitrate: exportSettings.videoBitrate,
        audioBitrate: exportSettings.audioBitrate
      })
    );
  }, [exportSettings, project.settings.fps, project.settings.height, project.settings.width, project.timeline]);
  const exportCostEstimate = useMemo(() => estimateExportCost({ project, settings: exportSettings }), [exportSettings, project]);
  const exportOptimizationSuggestions = useMemo(
    () =>
      analyzeExportOptimizationSuggestions(project, exportSettings, exportOptimizationSettings, {
        renderFarmEnabled,
        suggestedRenderFarmInstances
      }),
    [exportOptimizationSettings, exportSettings, project, renderFarmEnabled, suggestedRenderFarmInstances]
  );
  const lastExportDurationSeconds = useMemo(() => getLastExportDurationSeconds(history), [history]);
  const exportCostHistoryError = useMemo(
    () => calculateHistoricalEstimateErrorPercent(exportCostEstimate.estimatedDurationSeconds, lastExportDurationSeconds),
    [exportCostEstimate.estimatedDurationSeconds, lastExportDurationSeconds]
  );
  const hardwareEncodingEligible = !isAudioOnly && (exportSettings.format === 'mp4' || exportSettings.format === 'mov');
  const hardwareEncodingRequested = hardwareEncodingEligible && exportSettings.hardwareEncoding === true;
  const progressiveExportSupported = useMemo(() => isProgressiveExportSupported(exportSettings), [exportSettings]);
  const formatOptions = isAudioVisualization ? AUDIO_VISUALIZATION_FORMATS : VIDEO_EXPORT_FORMATS;
  const spatialDenoiseClipCount = useMemo(() => countSpatialDenoiseClips(project), [project]);
  const inOutExportRanges = useMemo(() => resolveInOutExportRanges(project, inPoint, outPoint), [inPoint, outPoint, project]);
  const selectedClipExportRange = useMemo(() => resolveSelectedClipExportRange(project, selectedClipIds), [project, selectedClipIds]);
  const activeExportRanges = useMemo(
    () => resolveActiveExportRanges(exportRangeMode, inOutExportRanges, selectedClipExportRange),
    [exportRangeMode, inOutExportRanges, selectedClipExportRange]
  );
  const rangeModeAvailable = {
    all: true,
    'in-out': inOutExportRanges.length > 0,
    'selected-clips': Boolean(selectedClipExportRange)
  } satisfies Record<ExportRangeMode, boolean>;
  const sortedCodecCompareResults = useMemo(() => sortCodecCompareResults(codecCompareResults, codecCompareSort.key, codecCompareSort.direction), [codecCompareResults, codecCompareSort]);
  const codecCompareRecommendation = useMemo(() => recommendCodecCompareResult(codecCompareResults, codecCompareRecommendationMode), [codecCompareRecommendationMode, codecCompareResults]);
  const versionedBatchReportRows = useMemo(
    () => buildVersionedExportReportRows(tasks, { batchId: latestVersionedBatchId, fileSizes: versionedBatchFileSizes }),
    [latestVersionedBatchId, tasks, versionedBatchFileSizes]
  );

  useEffect(() => {
    let canceled = false;
    void getFfmpegCapabilities()
      .then((result) => {
        if (!canceled) {
          setCapabilities(result);
        }
      })
      .catch((reason) => {
        if (!canceled) {
          setError(reason instanceof Error ? reason.message : t.detectFfmpegFailed);
        }
      });
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
        console.warn('Unable to load export background settings', reason);
      });
    void readExportOptimizationSettings()
      .then(setExportOptimizationSettings)
      .catch((reason) => {
        console.warn('Unable to load export optimization settings', reason);
      });
    void readExportUploadSettings()
      .then(setExportUploadSettings)
      .catch((reason) => {
        console.warn('Unable to load export upload settings', reason);
      });
    void readExportUploadWebdavPassword()
      .then((password) => setExportUploadPassword(password ?? ''))
      .catch((reason) => {
        console.warn('Unable to load export upload password', reason);
      });
    void Promise.all([readExportPresetSyncSettings(), readExportPresetSyncWebdavPassword()])
      .then(([settings, password]) => {
        setExportPresetSyncSettings(settings);
        setExportPresetSyncPassword(password ?? '');
      })
      .catch((reason) => {
        console.warn('Unable to load export preset sync settings', reason);
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
    void loadExportPresets()
      .then((nextPresets) => {
        if (canceled) {
          return;
        }
        const nextWithInitial = initialPreset ? [initialPreset, ...nextPresets] : nextPresets;
        setPresets(nextWithInitial);
        setPresetId((current) => (nextWithInitial.some((preset) => preset.id === current) ? current : nextWithInitial[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id));
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
    const hasActiveTasks = tasks.some((task) => task.status === 'scheduled' || task.status === 'pending' || task.status === 'running');
    if (sawNewSuccess && !hasActiveTasks && pendingCompletionAction.current !== 'none' && !completionActionHandled.current) {
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
        duration: getTimelinePlaybackDuration(project.timeline)
      }),
      getFileStat(request.outputPath).catch(() => undefined)
    ])
      .then(([quality, stat]) => {
        setCodecCompareResults((current) => applyCodecCompareQualityResult(current, request.taskId, quality, stat?.size));
      })
      .catch((reason) => {
        setCodecCompareResults((current) => applyCodecCompareQualityError(current, request.taskId, reason instanceof Error ? reason.message : t.quality.failedMessage));
      })
      .finally(() => {
        setCodecCompareEvaluatingTaskId(undefined);
      });
  }, [codecCompareEvaluatingTaskId, project.timeline, t.quality.failedMessage, tasks]);

  useEffect(() => {
    if (!latestVersionedBatchId) {
      return;
    }
    const pendingStats = tasks.filter((task) => task.versionedBatch?.batchId === latestVersionedBatchId && task.status === 'success' && versionedBatchFileSizes[task.outputPath] === undefined);
    if (pendingStats.length === 0) {
      return;
    }
    let canceled = false;
    void Promise.all(
      pendingStats.map(async (task) => ({
        outputPath: task.outputPath,
        size: (await getFileStat(task.outputPath).catch(() => undefined))?.size
      }))
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

  async function choosePath(): Promise<void> {
    const path = await chooseExportPath(project, exportSettings.format);
    if (path) {
      setOutputPath(path);
    }
  }

  async function chooseWatermarkImage(): Promise<void> {
    try {
      const [path] = await openFileDialog(false, [{ name: t.watermark.imageFilter, extensions: ['png'] }]);
      if (path) {
        updateImageWatermarkPath(setDraftSettings, path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.watermark.chooseImageFailed);
    }
  }

  async function chooseAudioVisualizationBackgroundImage(): Promise<void> {
    try {
      const [path] = await openFileDialog(false, [{ name: t.audioVisualization.backgroundImageFilter, extensions: ['png', 'jpg', 'jpeg', 'webp'] }]);
      if (path) {
        updateAudioVisualizationBackgroundImagePath(setDraftSettings, path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.audioVisualization.chooseImageFailed);
    }
  }

  async function savePreset(): Promise<void> {
    try {
      setError(undefined);
      if (!(await ensurePostExportScriptAcknowledged())) {
        return;
      }
      const nextPresets = await saveCustomExportPreset(customPresetName || `${selectedPreset.name} ${t.presetCopySuffix}`, exportSettings);
      const createdPreset = nextPresets.filter((preset) => !preset.builtin).at(-1);
      setPresets(nextPresets);
      setPresetId(createdPreset?.id ?? nextPresets[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
      showToast({ kind: 'success', title: t.presetSavedTitle, message: createdPreset?.name ?? customPresetName });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function deletePreset(): Promise<void> {
    if (selectedPreset.builtin) {
      return;
    }
    try {
      setError(undefined);
      const nextPresets = await deleteCustomExportPreset(selectedPreset.id);
      setPresets(nextPresets);
      setPresetId(nextPresets[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
      showToast({ kind: 'info', title: t.presetDeletedTitle, message: selectedPreset.name });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.deletePresetFailed);
    }
  }

  function applyOptimizationSuggestion(suggestion: ExportOptimizationSuggestion): void {
    const result = applyExportOptimizationSuggestion(suggestion, exportSettings, { suggestedRenderFarmInstances });
    setDraftSettings(result.settings);
    if (result.renderFarm) {
      setProgressiveExportEnabled(false);
      setRenderFarmEnabled(result.renderFarm.enabled);
      setRenderFarmInstances(result.renderFarm.instances);
    }
    showToast({ kind: 'info', title: t.optimization.appliedTitle, message: formatOptimizationSuggestionTitle(suggestion) });
  }

  async function dismissOptimizationSuggestion(suggestion: ExportOptimizationSuggestion): Promise<void> {
    const dismissedSuggestionIds = Array.from(new Set([...exportOptimizationSettings.dismissedSuggestionIds, suggestion.id]));
    const saved = await saveExportOptimizationSettings({ dismissedSuggestionIds });
    setExportOptimizationSettings(saved);
    showToast({ kind: 'info', title: t.optimization.dismissedTitle, message: formatOptimizationSuggestionTitle(suggestion) });
  }

  async function exportSelectedPresetPackage(): Promise<void> {
    try {
      setError(undefined);
      const path = await saveFileDialog(`${safePresetPackageFileName(selectedPreset.name)}.${EXPORT_PRESET_PACKAGE_EXTENSION}`, [
        { name: t.exportPresetPackage, extensions: [EXPORT_PRESET_PACKAGE_EXTENSION, 'json'] }
      ]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeExportPresetPackage([selectedPreset]));
      showToast({ kind: 'success', title: t.presetPackageExportedTitle, message: path });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function importPresetPackageFromFile(): Promise<void> {
    try {
      setError(undefined);
      const [path] = await openFileDialog(false, [{ name: t.importPresetPackage, extensions: [EXPORT_PRESET_PACKAGE_EXTENSION, 'json'] }]);
      if (!path) {
        return;
      }
      await importPresetPackageContents(await readFile(path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function importOfficialPresetPackage(): Promise<void> {
    try {
      setError(undefined);
      const packageFile = await fetchOfficialExportPresetPackage();
      if (!packageFile) {
        showToast({ kind: 'warning', title: t.officialPresetPackage, message: t.presetPackageNoOfficial });
        return;
      }
      await importPresetPackageContents(JSON.stringify(packageFile));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function syncPresetPackageFromCloud(settings = exportPresetSyncSettings, password = exportPresetSyncPassword, silent = false): Promise<void> {
    if (!settings.url?.trim()) {
      const message = t.presetCloudSyncUrlMissing;
      setPresetSyncState({ status: 'error', message });
      if (!silent) {
        showToast({ kind: 'warning', title: t.presetCloudSyncFailedTitle, message });
      }
      return;
    }
    try {
      setError(undefined);
      setPresetSyncState({ status: 'running' });
      const result = await syncExportPresetsWithWebdav(
        {
          url: settings.url,
          username: settings.username,
          password: password || undefined,
          conflictResolution: settings.conflictMode
        },
        {
          client: {
            getText: getWebdavText,
            putText: putWebdavText
          }
        }
      );
      setPresets(result.presets);
      const latestCustomPreset = result.presets.filter((preset) => !preset.builtin).at(-1);
      if (latestCustomPreset) {
        setPresetId(latestCustomPreset.id);
      }
      const savedSettings = await saveExportPresetSyncSettings({ ...settings, lastSyncedAt: result.syncedAt, lastSyncWarning: undefined });
      setExportPresetSyncSettings(savedSettings);
      const message = t.presetCloudSyncCompleteMessage(result.uploadedCount, result.conflicts.length);
      setPresetSyncState({ status: 'success', message });
      if (!silent) {
        showToast({ kind: 'success', title: t.presetCloudSyncCompleteTitle, message });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.presetPackageFailed;
      setPresetSyncState({ status: 'error', message });
      setExportPresetSyncSettings(await saveExportPresetSyncSettings({ ...settings, lastSyncWarning: message }).catch(() => settings));
      if (!silent) {
        showToast({ kind: 'warning', title: t.presetCloudSyncFailedTitle, message });
      }
    }
  }

  async function importPresetPackageContents(contents: string): Promise<void> {
    const packageFile = parseExportPresetPackage(contents);
    const conflictMode = choosePresetPackageConflictMode(packageFile.presets.map((preset) => preset.name), presets);
    if (!conflictMode) {
      return;
    }
    const result = await importExportPresetPackage(contents, conflictMode);
    setPresets(result.presets);
    const importedPreset = result.presets.filter((preset) => !preset.builtin).at(-1);
    if (importedPreset) {
      setPresetId(importedPreset.id);
    }
    showToast({ kind: 'success', title: t.presetPackageImportedTitle, message: t.presetPackageImportMessage(result.imported, result.skipped) });
  }

  async function exportVersionedBatchTemplate(): Promise<void> {
    try {
      setError(undefined);
      const path = await saveFileDialog(`${safePresetPackageFileName(project.name || 'versioned-batch')}.${VERSIONED_BATCH_TEMPLATE_EXTENSION}`, [
        { name: t.versionBatch.templateFilter, extensions: [VERSIONED_BATCH_TEMPLATE_EXTENSION, 'json'] }
      ]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeVersionedBatchTemplate(project.name || t.versionBatch.title, versionedBatchTemplate, buildVersionDefinitions()));
      showToast({ kind: 'success', title: t.versionBatch.templateSavedTitle, message: path });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.versionBatch.templateFailed);
    }
  }

  async function importVersionedBatchTemplate(): Promise<void> {
    try {
      setError(undefined);
      const [path] = await openFileDialog(false, [{ name: t.versionBatch.templateFilter, extensions: [VERSIONED_BATCH_TEMPLATE_EXTENSION, 'json'] }]);
      if (!path) {
        return;
      }
      const template = parseVersionedBatchTemplate(await readFile(path));
      setVersionedBatchTemplate(template.outputPathTemplate);
      setVersionedBatchRows(template.versions.map(versionDefinitionToRow));
      showToast({ kind: 'success', title: t.versionBatch.templateLoadedTitle, message: template.name });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.versionBatch.templateFailed);
    }
  }

  function buildVersionDefinitions(): VersionedExportDefinition[] {
    return versionedBatchRows.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      presetId: row.presetId,
      platform: row.platform,
      language: row.language,
      range: row.rangeMode === 'custom' ? { start: Math.max(0, row.rangeStart || 0), duration: Math.max(0.001, row.rangeDuration || 0.001) } : undefined,
      settings: buildVersionSettings(row),
      metadata: {
        title: '{version_name}',
        description: '{platform} / {language}'
      }
    }));
  }

  function buildVersionedBatchJobs(): ExportJob[] {
    const enabledRows = versionedBatchRows.filter((row) => row.enabled);
    if (enabledRows.length === 0) {
      throw new Error(t.versionBatch.noneSelected);
    }
    const batchId = `version-batch-${Date.now().toString(36)}`;
    const presetSettingsById = new Map(presets.map((preset) => [preset.id, normalizeDraftSettings(preset.settings)]));
    const versionJobs = createVersionedExportJobs({
      batchId,
      outputPathTemplate: versionedBatchTemplate,
      defaultSettings: exportSettings,
      defaultRange: activeExportRanges[0] ?? null,
      presetSettingsById,
      metadata: {
        title: '{version_name}',
        description: '{platform} / {language}'
      },
      versions: buildVersionDefinitions().filter((version) => version.enabled !== false)
    });
    setLatestVersionedBatchId(batchId);
    setVersionedBatchFileSizes({});
    return versionJobs.map((job) => ({
      outputPath: job.outputPath,
      range: job.range,
      settings: job.settings,
      metadata: job.metadata,
      versionedBatch: job.batch,
      presetName: job.batch.versionName
    }));
  }

  function updateVersionedBatchRow(rowId: string, patch: Partial<VersionedExportRowState>): void {
    setVersionedBatchRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addVersionedBatchRow(): void {
    const index = versionedBatchRows.length + 1;
    setVersionedBatchRows((current) => [
      ...current,
      {
        id: `version-${Date.now().toString(36)}`,
        enabled: true,
        name: t.versionBatch.defaultVersionName(index),
        presetId,
        platform: 'Custom',
        language: 'zh',
        rangeMode: 'default',
        rangeStart: 0,
        rangeDuration: Math.max(1, Math.round(getTimelinePlaybackDuration(project.timeline) || 1)),
        width: exportSettings.width ?? project.settings.width,
        height: exportSettings.height ?? project.settings.height,
        watermarkMode: 'inherit'
      }
    ]);
  }

  function removeVersionedBatchRow(rowId: string): void {
    setVersionedBatchRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== rowId)));
  }

  function buildVersionSettings(row: VersionedExportRowState): ExportPresetSettings {
    const settings: ExportPresetSettings = {
      width: Math.max(1, Math.round(row.width || project.settings.width)),
      height: Math.max(1, Math.round(row.height || project.settings.height))
    };
    const language = row.language.trim();
    if (language) {
      settings.subtitleLanguages = [language];
      settings.subtitleBurnInLanguage = language;
    }
    if (row.watermarkMode === 'none') {
      settings.watermark = null;
    } else if (row.watermarkMode === 'text') {
      settings.watermark = {
        enabled: true,
        type: 'text',
        text: `${row.platform || row.name}`,
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: 36,
        position: 'bottom-right'
      };
    }
    return settings;
  }

  function versionDefinitionToRow(version: VersionedExportDefinition): VersionedExportRowState {
    return {
      id: version.id,
      enabled: version.enabled !== false,
      name: version.name,
      presetId: version.presetId && presets.some((preset) => preset.id === version.presetId) ? version.presetId : presetId,
      platform: version.platform ?? 'Custom',
      language: version.language ?? 'zh',
      rangeMode: version.range ? 'custom' : 'default',
      rangeStart: Math.max(0, version.range?.start ?? 0),
      rangeDuration: Math.max(0.001, version.range?.duration ?? Math.max(1, Math.round(getTimelinePlaybackDuration(project.timeline) || 1))),
      width: Math.max(1, Math.round(version.settings?.width ?? exportSettings.width ?? project.settings.width)),
      height: Math.max(1, Math.round(version.settings?.height ?? exportSettings.height ?? project.settings.height)),
      watermarkMode: version.settings?.watermark === null ? 'none' : version.settings?.watermark?.type === 'text' ? 'text' : 'inherit'
    };
  }

  function toggleSequenceBatchSelection(sequenceId: string, checked: boolean): void {
    setSelectedSequenceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(sequenceId);
      } else {
        next.delete(sequenceId);
      }
      return Array.from(next);
    });
  }

  function updateSequenceBatchOutput(sequenceId: string, outputPath: string): void {
    setSequenceBatchOutputOverrides((current) => ({ ...current, [sequenceId]: outputPath }));
  }

  function updateSequenceBatchPreset(sequenceId: string, nextPresetId: string): void {
    setSequenceBatchPresetIds((current) => ({ ...current, [sequenceId]: nextPresetId }));
  }

  function toggleCodecComparePreset(presetId: string, checked: boolean): void {
    setCodecComparePresetIds((current) => {
      if (!checked) {
        return current.filter((id) => id !== presetId);
      }
      if (current.includes(presetId) || current.length >= MAX_CODEC_COMPARE_PRESETS) {
        return current;
      }
      return [...current, presetId];
    });
  }

  function toggleCodecCompareSort(key: CodecCompareSortKey): void {
    setCodecCompareSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  function buildSequenceBatchJobs(): ExportJob[] {
    const selectedIds = selectedSequenceIds.filter((id) => batchSequences.some((sequence) => sequence.id === id));
    if (selectedIds.length === 0) {
      throw new Error(t.sequenceBatch.noneSelected);
    }
    const sequenceById = new Map(batchSequences.map((sequence) => [sequence.id, sequence]));
    return sortBatchSequenceIds(project, selectedIds).map((sequenceId, index) => {
      const sequence = sequenceById.get(sequenceId);
      if (!sequence) {
        throw new Error(t.sequenceBatch.missingSequence(sequenceId));
      }
      const rowPreset = getExportPreset(sequenceBatchPresetIds[sequenceId] ?? presetId, presets);
      const settings = sequenceBatchPresetMode === 'individual' ? normalizeDraftSettings(rowPreset.settings) : exportSettings;
      const outputPath = (sequenceBatchOutputOverrides[sequenceId] ?? expandSequenceBatchOutputPath(sequenceBatchTemplate, sequence, index + 1)).trim();
      if (!outputPath) {
        throw new Error(t.sequenceBatch.outputRequired(sequence.name));
      }
      return {
        outputPath,
        range: null,
        project: buildProjectForSequenceExport(project, sequenceId),
        settings,
        presetName: sequenceBatchPresetMode === 'individual' ? rowPreset.name : selectedPreset.name,
        sequenceName: sequence.name
      };
    });
  }

  async function addToQueue(): Promise<void> {
    if (enqueueInFlight.current) {
      return;
    }
    enqueueInFlight.current = true;
    try {
      if (exportMode === 'pipeline') {
        await runPipeline();
        return;
      }
      if (exportMode === 'version-batch') {
        const selectedJobs = buildVersionedBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        await enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'sequence-batch') {
        const selectedJobs = buildSequenceBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        await enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'codec-compare') {
        const baseOutputPath = outputPath || (await chooseExportPath(project, exportSettings.format));
        if (!baseOutputPath) {
          return;
        }
        if (codecComparePresetIds.length < 2) {
          throw new Error(t.codecCompare.selectAtLeastTwo);
        }
        setOutputPath(baseOutputPath);
        const compareJobs = buildCodecCompareJobs({ baseOutputPath, presets, selectedPresetIds: codecComparePresetIds });
        const selectedJobs = compareJobs.map((job) => ({
          outputPath: job.outputPath,
          range: activeExportRanges[0] ?? null,
          settings: job.settings,
          presetName: job.presetName
        }));
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs, codecCompareJobs: compareJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        const queuedTasks = await enqueueSelectedJobs(selectedJobs);
        setCodecCompareResults(createInitialCodecCompareResults(compareJobs, queuedTasks));
        return;
      }
      const paths = batchOutputPaths
        .split(/\r?\n/)
        .map((path) => path.trim())
        .filter(Boolean);
      const selectedPaths = paths.length > 0 ? paths : [outputPath || (await chooseExportPath(project, exportSettings.format))].filter((path): path is string => Boolean(path));
      if (selectedPaths.length === 0) {
        return;
      }
      setOutputPath(selectedPaths[0]);
      const selectedJobs = buildExportJobs(selectedPaths, activeExportRanges);
      setError(undefined);
      const issues = await collectPreflightIssues(project, exportSettings);
      if (issues.length > 0) {
        setPreflight({ issues, selectedJobs });
        return;
      }
      await warmupSelectedJobs(selectedJobs);
      await enqueueSelectedJobs(selectedJobs);
    } catch (reason) {
      setError(
        reason instanceof SequenceDependencyCycleError
          ? t.sequenceBatch.cycleDetected(reason.cycleIds.join(' -> '))
          : reason instanceof ExportPipelineCycleError
            ? t.pipeline.cycleDetected(reason.cycleIds.join(' -> '))
            : reason instanceof Error
              ? reason.message
              : t.exportFailed
      );
    } finally {
      enqueueInFlight.current = false;
    }
  }

  async function runPipeline(): Promise<void> {
    if (pipelineConfig.nodes.length === 0) {
      throw new Error(t.pipeline.empty);
    }
    const sorted = topologicallySortExportPipeline(pipelineConfig);
    let snapshot = Object.fromEntries(pipelineConfig.nodes.map((node) => [node.id, 'waiting' as ExportPipelineNodeStatus]));
    setPipelineStatuses(snapshot);
    let pipelineOutputPath = outputPath;
    for (const node of sorted) {
      const upstreamStatuses = getPipelineUpstreamNodeIds(pipelineConfig, node.id).map((id) => snapshot[id] ?? 'waiting');
      if (!shouldRunExportPipelineNode(node, upstreamStatuses)) {
        snapshot = updatePipelineStatus(snapshot, node.id, 'skipped');
        setPipelineStatuses(snapshot);
        continue;
      }
      snapshot = updatePipelineStatus(snapshot, node.id, 'running');
      setPipelineStatuses(snapshot);
      try {
        if (node.type === 'export-mp4') {
          pipelineOutputPath = await runPipelineExportNode(pipelineOutputPath);
        } else {
          await runPipelineUtilityNode(node);
        }
        snapshot = updatePipelineStatus(snapshot, node.id, 'complete');
        setPipelineStatuses(snapshot);
      } catch {
        snapshot = updatePipelineStatus(snapshot, node.id, 'failed');
        setPipelineStatuses(snapshot);
      }
    }
    showToast({ kind: 'info', title: t.pipeline.completedTitle, message: pipelineConfig.name });
  }

  async function runPipelineExportNode(currentOutputPath: string): Promise<string> {
    const selectedPath = currentOutputPath || (await chooseExportPath(project, 'mp4'));
    if (!selectedPath) {
      throw new Error(t.pipeline.outputRequired);
    }
    setOutputPath(selectedPath);
    const jobs: ExportJob[] = [
      {
        outputPath: selectedPath,
        range: activeExportRanges[0] ?? null,
        settings: normalizeDraftSettings({ ...exportSettings, format: 'mp4' }),
        presetName: selectedPreset.name
      }
    ];
    const issues = await collectPreflightIssuesForJobs(jobs);
    const blocking = issues.find((issue) => issue.severity === 'blocking');
    if (blocking) {
      throw new Error(blocking.message);
    }
    await warmupSelectedJobs(jobs);
    const tasks = await enqueueSelectedJobs(jobs);
    await waitForExportTasks(tasks.map((task) => task.id));
    const latestTasks = useExportQueueStore.getState().tasks.filter((task) => tasks.some((queued) => queued.id === task.id));
    const failed = latestTasks.find((task) => task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted');
    if (failed) {
      throw new Error(failed.error ?? t.exportFailed);
    }
    return selectedPath;
  }

  async function runPipelineUtilityNode(_node: ExportPipelineNode): Promise<void> {
    await delay(40);
  }

  function createPipelineTemplate(): void {
    const next = createTwoStepExportPipeline(t.pipeline.defaultName);
    setPipelineConfig(next);
    setPipelineStatuses(Object.fromEntries(next.nodes.map((node) => [node.id, 'waiting' as ExportPipelineNodeStatus])));
  }

  async function previewExport(): Promise<void> {
    if (isAudioOnly) {
      return;
    }
    setError(undefined);
    setPreviewError(undefined);
    setPreviewRunning(true);
    try {
      const nextCapabilities = capabilities ?? (await getFfmpegCapabilities());
      if (!nextCapabilities.available) {
        throw new Error(t.preview.ffmpegMissing);
      }
      if (!capabilities) {
        setCapabilities(nextCapabilities);
      }
      const appDataDir = await getAppDataDir();
      const outputPaths = buildExportPreviewOutputPaths(appDataDir);
      const exportProject = buildExportProjectFromProject(project, {
        outputPath: outputPath || outputPaths[0].replace(/\.png$/i, '.mp4'),
        settings: exportSettings
      });
      const samples = buildFfmpegPreviewSamplePlans(exportProject, outputPaths, nextCapabilities).map((sample) => ({
        ...sample,
        label: t.preview.sampleLabels[sample.kind]
      }));
      const result = await runExportPreviewSamples({ samples, timeoutMs: EXPORT_PREVIEW_TIMEOUT_MS });
      setPreviewSamples(
        result.samples.map((sample) => ({
          id: sample.id,
          kind: sample.kind,
          label: t.preview.sampleLabels[sample.kind],
          time: sample.time,
          path: sample.path,
          src: convertLocalFileSrc(sample.path),
          durationMs: sample.durationMs
        }))
      );
      showToast({ kind: 'success', title: t.preview.readyTitle, message: t.preview.readyMessage });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.preview.failed;
      setPreviewError(message);
      showToast({ kind: 'error', title: t.preview.failedTitle, message });
    } finally {
      setPreviewRunning(false);
    }
  }

  async function evaluateHistoryQuality(entry: ExportTaskHistoryEntry): Promise<void> {
    if (!entry.sourcePath) {
      setQualityError(t.quality.sourceMissing);
      showToast({ kind: 'warning', title: t.quality.title, message: t.quality.sourceMissing });
      return;
    }
    const taskId = `quality-${entry.id}`;
    setQualityTaskId(taskId);
    setQualityProgress(0);
    setQualityError(undefined);
    try {
      const result = await evaluateExportQuality({
        taskId,
        sourcePath: entry.sourcePath,
        outputPath: entry.outputPath,
        duration: getTimelinePlaybackDuration(project.timeline)
      });
      setQualityResult({ entry, result });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.quality.failedMessage;
      setQualityError(message);
      showToast({ kind: 'error', title: t.quality.failedTitle, message });
    } finally {
      setQualityTaskId(undefined);
    }
  }

  async function cancelRunningQualityEvaluation(): Promise<void> {
    if (!qualityTaskId) {
      return;
    }
    const taskId = qualityTaskId;
    setQualityTaskId(undefined);
    setQualityProgress(0);
    await cancelQualityEvaluation(taskId);
  }

  async function warmupSelectedJobs(selectedJobs: ExportJob[]): Promise<void> {
    let sawColdWarmup = false;
    for (const job of selectedJobs) {
      const warmupProject = job.project ?? project;
      const result = await runExportWarmup(
        warmupProject,
        {
          checkProxyGeneration: runProxyGenerationWarmup,
          createTempDirectory: getTempSegmentsDir,
          getFfmpegCapabilities,
          checkFonts: (targetProject) => {
            const blockingFontIssue = runExportPreflight(targetProject, {
              ffmpegAvailable: true,
              isFontFamilyAvailable
            }).find((issue) => issue.type === 'missing-font' && issue.severity === 'blocking');
            if (blockingFontIssue) {
              throw new Error(blockingFontIssue.message);
            }
          }
        },
        {
          ffmpegUnavailableMessage: t.warmup.ffmpegMissing,
          onStep: (step) => setWarmupStatus({ status: 'running', step })
        }
      );
      sawColdWarmup ||= !result.cached;
    }
    setWarmupStatus({ status: sawColdWarmup ? 'complete' : 'cached' });
  }

  async function enqueueSelectedJobs(selectedJobs: ExportJob[]): Promise<ExportTask[]> {
    const scheduledStartAt = scheduleEnabled ? normalizeScheduledExportStart(scheduledStartInput) : undefined;
    if (scheduleEnabled && !scheduledStartAt) {
      setError(t.scheduleInvalid);
      return [];
    }
    if (!(await ensurePostExportScriptAcknowledged())) {
      return [];
    }
    const queuedTasks: ExportTask[] = [];
    pendingCompletionAction.current = completionAction;
    completionActionHandled.current = false;
    if (progressiveExportEnabled && !progressiveExportSupported) {
      showToast({ kind: 'warning', title: t.progressive.title, message: t.progressive.unsupportedWarning });
    }
    for (const job of selectedJobs) {
      const task = await enqueueExport(
        job.project ?? project,
        job.outputPath,
        job.settings ?? exportSettings,
        priority,
        renderFarmEnabled ? { enabled: true, maxInstances: renderFarmInstances } : undefined,
        scheduledStartAt,
        job.range,
        progressiveExportEnabled,
        {
          metadata: job.metadata,
          versionedBatch: job.versionedBatch
        }
      );
      queuedTasks.push(task);
      for (const warning of task.plan.warnings) {
        showToast({ kind: 'warning', title: t.exportWarningTitle, message: formatExportWarning(warning) });
      }
    }
    const sequenceJobCount = selectedJobs.filter((job) => job.sequenceName).length;
    const versionJobCount = selectedJobs.filter((job) => job.versionedBatch).length;
    showToast({
      kind: 'info',
      title: scheduleEnabled ? t.scheduledTitle : t.queuedTitle,
      message:
        exportMode === 'codec-compare'
          ? t.codecCompare.queuedMessage(selectedJobs.length)
          : versionJobCount > 0
            ? t.versionBatch.queuedMessage(versionJobCount)
            : sequenceJobCount > 0
              ? t.sequenceBatch.queuedMessage(sequenceJobCount)
              : t.queuedMessage(selectedJobs.length, selectedPreset.name)
    });
    return queuedTasks;
  }

  async function ensurePostExportScriptAcknowledged(): Promise<boolean> {
    if (!exportSettings.postExportScript?.command || exportBackgroundSettings.postExportScriptAcknowledged) {
      return true;
    }
    setError(t.postExportScript.ackRequired);
    return false;
  }

  async function setPostExportScriptAcknowledged(checked: boolean): Promise<void> {
    const next = { ...exportBackgroundSettings, postExportScriptAcknowledged: checked };
    setExportBackgroundSettings(next);
    try {
      setExportBackgroundSettings(await saveExportBackgroundSettings(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function updateExportUploadSettings(next: ExportUploadSettings): Promise<void> {
    setExportUploadSettings(next);
    try {
      setExportUploadSettings(await saveExportUploadSettings(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function updateExportUploadPassword(password: string): Promise<void> {
    setExportUploadPassword(password);
    try {
      await writeExportUploadWebdavPassword(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function chooseExportUploadDirectory(): Promise<void> {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        await updateExportUploadSettings({ ...exportUploadSettings, local: { ...exportUploadSettings.local, directory } });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function retryHistoryUpload(entry: ExportTaskHistoryEntry): Promise<void> {
    try {
      await retryExportUploadFromHistory(entry.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.upload.failedMessage);
    }
  }

  async function collectPreflightIssues(targetProject: Project, settings: ExportPresetSettings): Promise<PreflightResult[]> {
    const nextCapabilities = capabilities ?? (await getFfmpegCapabilities().catch(() => undefined));
    if (nextCapabilities && !capabilities) {
      setCapabilities(nextCapabilities);
    }
    const whisperAvailability = await getWhisperAvailability({
      executablePath: whisperExecutablePath,
      modelPath: whisperModelPath
    });
    return runExportPreflight(targetProject, {
      ffmpegAvailable: nextCapabilities?.available === true,
      whisperReady: whisperAvailability.ready,
      whisperMessage: whisperAvailability.error,
      isFontFamilyAvailable,
      platformPreset: settings.platformPreset
    });
  }

  async function collectPreflightIssuesForJobs(jobs: ExportJob[]): Promise<PreflightResult[]> {
    const seen = new Set<string>();
    const issues: PreflightResult[] = [];
    for (const job of jobs) {
      for (const issue of await collectPreflightIssues(job.project ?? project, job.settings ?? exportSettings)) {
        const key = `${issue.id}:${issue.severity}:${issue.items.join('|')}`;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push(issue);
        }
      }
    }
    return issues;
  }

  async function continueAfterWarnings(): Promise<void> {
    if (!preflight || preflight.issues.some((issue) => issue.severity === 'blocking')) {
      return;
    }
    if (enqueueInFlight.current) {
      return;
    }
    enqueueInFlight.current = true;
    const jobs = preflight.selectedJobs;
    const compareJobs = preflight.codecCompareJobs;
    setPreflight(undefined);
    try {
      await warmupSelectedJobs(jobs);
      const queuedTasks = await enqueueSelectedJobs(jobs);
      if (compareJobs) {
        setCodecCompareResults(createInitialCodecCompareResults(compareJobs, queuedTasks));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.exportFailed);
    } finally {
      enqueueInFlight.current = false;
    }
  }

function relinkFromPreflight(): void {
    setPreflight(undefined);
    onClose();
    onRelinkMissing?.();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4" data-testid="export-dialog">
      <section className="w-full max-w-3xl rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-panel" aria-label={t.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[78vh] space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t.output}</label>
            <input className="min-w-0 rounded-md border border-line px-2 py-1.5" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} data-testid="export-output-path" />
            <button className="rounded-md border border-line p-2 hover:bg-panel" title={t.chooseOutputPath} onClick={() => void choosePath()}>
              <FolderOpen size={16} />
            </button>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t.mode.title}</label>
            <div className="inline-flex w-fit rounded-md border border-line bg-panel p-1" data-testid="export-mode-tabs">
              {(['single', 'version-batch', 'sequence-batch', 'codec-compare', 'pipeline'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${exportMode === mode ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                  data-testid={`export-mode-${mode}-tab`}
                  onClick={() => setExportMode(mode)}
                >
                  {t.mode.options[mode]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t.range.title}</label>
            <div className="space-y-1">
              <select
                className="w-full rounded-md border border-line px-2 py-1.5"
                value={exportRangeMode}
                onChange={(event) => setExportRangeMode(event.target.value as ExportRangeMode)}
                data-testid="export-range-select"
              >
                {(['all', 'in-out', 'selected-clips'] as const).map((mode) => (
                  <option key={mode} value={mode} disabled={!rangeModeAvailable[mode]}>
                    {t.range.options[mode]}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500" data-testid="export-range-summary">
                {formatExportRangeSummary(exportRangeMode, activeExportRanges, selectedClipExportRange)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr_auto] gap-2">
            <label className="pt-1.5 text-xs font-medium text-slate-600">{t.preset}</label>
            <div>
              <select className="w-full rounded-md border border-line px-2 py-1.5" value={presetId} onChange={(event) => setPresetId(event.target.value)} data-testid="export-preset-select">
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500">{selectedPreset.description}</div>
              {exportPresetSyncSettings.lastSyncedAt ? (
                <div className="mt-1 text-[11px] text-slate-500" data-testid="export-preset-cloud-sync-last-time">
                  {t.cloudSyncStatus(exportPresetSyncSettings.lastSyncedAt)}
                </div>
              ) : null}
              {presetSyncState.message ? (
                <div className={`mt-1 text-[11px] ${presetSyncState.status === 'error' ? 'text-amber-700' : 'text-emerald-700'}`} data-testid="export-preset-cloud-sync-status">
                  {presetSyncState.message}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                data-testid="export-preset-package-export-button"
                type="button"
                onClick={() => void exportSelectedPresetPackage()}
              >
                <Download size={13} />
                {t.exportPresetPackage}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                data-testid="export-preset-package-import-button"
                type="button"
                onClick={() => void importPresetPackageFromFile()}
              >
                <Upload size={13} />
                {t.importPresetPackage}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                data-testid="export-preset-package-official-button"
                type="button"
                onClick={() => void importOfficialPresetPackage()}
              >
                <CloudDownload size={13} />
                {t.officialPresetPackage}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="export-preset-cloud-sync-button"
                type="button"
                disabled={presetSyncState.status === 'running' || !exportPresetSyncSettings.url}
                onClick={() => void syncPresetPackageFromCloud()}
              >
                {presetSyncState.status === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                {presetSyncState.status === 'running' ? t.cloudSyncRunning : t.cloudSyncPresetPackage}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                disabled={selectedPreset.builtin}
                data-testid="export-delete-preset-button"
                type="button"
                onClick={() => void deletePreset()}
              >
                <Trash2 size={13} />
                {t.delete}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t.saveAs}</label>
            <input
              className="min-w-0 rounded-md border border-line px-2 py-1.5"
              placeholder={t.customPresetName}
              value={customPresetName}
              onChange={(event) => setCustomPresetName(event.target.value)}
              data-testid="export-preset-name-input"
            />
            <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" data-testid="export-save-preset-button" onClick={() => void savePreset()}>
              <Save size={13} />
              {t.save}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 md:grid-cols-4">
            <PresetSelectField
              label={t.fields.outputMode}
              value={exportSettings.outputMode ?? 'video'}
              onChange={(value) => updateOutputMode(setDraftSettings, value)}
              testId="export-output-mode-select"
              options={['video', 'audio', 'audio-visualization']}
            />
            <PresetNumberField label={t.fields.width} value={draftSettings.width} disabled={isAudioOnly} onChange={(value) => updateNumberSetting(setDraftSettings, 'width', value)} testId="export-width-input" />
            <PresetNumberField label={t.fields.height} value={draftSettings.height} disabled={isAudioOnly} onChange={(value) => updateNumberSetting(setDraftSettings, 'height', value)} testId="export-height-input" />
            <PresetFpsField label={t.fields.fps} value={draftSettings.fps ?? project.settings.fps} disabled={isAudioOnly} onChange={(value) => updateNumberSetting(setDraftSettings, 'fps', value)} testId="export-fps-select" />
            <PresetSelectField label={t.fields.format} value={exportSettings.format ?? 'mp4'} onChange={(value) => updateFormat(setDraftSettings, value)} testId="export-format-select" options={formatOptions} />
            <PresetTextField label={t.fields.videoBitrate} value={draftSettings.videoBitrate ?? ''} disabled={isAudioOnly} onChange={(value) => updateStringSetting(setDraftSettings, 'videoBitrate', value)} testId="export-video-bitrate-input" />
            <PresetTextField label={t.fields.audioBitrate} value={draftSettings.audioBitrate ?? ''} onChange={(value) => updateStringSetting(setDraftSettings, 'audioBitrate', value)} testId="export-audio-bitrate-input" />
            <PresetSelectField label={t.fields.subtitles} value={draftSettings.subtitleMode ?? 'default'} disabled={timelineVisualControlsDisabled} onChange={(value) => updateSubtitleMode(setDraftSettings, value)} testId="export-subtitle-mode-select" options={['default', 'burn-in', 'soft-sub']} />
            <PresetSelectField label={t.fields.subtitleFormat} value={exportSettings.subtitleFormat ?? 'srt'} disabled={timelineVisualControlsDisabled} onChange={(value) => updateSubtitleFormat(setDraftSettings, value)} testId="export-subtitle-format-select" options={SUBTITLE_FORMATS} />
            <PresetCheckboxField
              label={t.fields.exportSidecarSubtitle}
              checked={exportSettings.exportSidecarSubtitle === true}
              disabled={timelineVisualControlsDisabled}
              onChange={(checked) => updateExportSidecarSubtitle(setDraftSettings, checked)}
              testId="export-subtitle-sidecar-toggle"
            />
            <PresetSelectField label={t.fields.scale} value={draftSettings.scaleMode ?? 'none'} disabled={timelineVisualControlsDisabled} onChange={(value) => updateScaleMode(setDraftSettings, value)} testId="export-scale-mode-select" options={['none', 'fit']} />
            <PresetSelectField
              label={t.fields.targetAspectRatio}
              value={exportSettings.targetAspectRatio ?? 'source'}
              disabled={timelineVisualControlsDisabled}
              onChange={(value) => updateTargetAspectRatio(setDraftSettings, value)}
              testId="export-target-aspect-select"
              options={[...TARGET_ASPECT_RATIOS]}
            />
            <PresetCheckboxField
              label={t.fields.hardwareEncoding}
              checked={hardwareEncodingRequested}
              disabled={!hardwareEncodingEligible}
              onChange={(checked) => updateHardwareEncoding(setDraftSettings, checked)}
              testId="export-hardware-encoding-toggle"
            />
          </div>
          <MasterProcessingSection
            masterProcessing={exportSettings.masterProcessing}
            loudnessNormalization={exportSettings.loudnessNormalization ?? 'off'}
            loudnessNormalizationEligible={loudnessNormalizationEligible}
            setDraftSettings={setDraftSettings}
          />
          {!timelineVisualControlsDisabled && subtitleLanguageOptions.length > 0 ? (
            <SubtitleLanguageSection
              options={subtitleLanguageOptions}
              selectedLanguages={draftSettings.subtitleLanguages}
              burnInLanguage={draftSettings.subtitleBurnInLanguage}
              setDraftSettings={setDraftSettings}
            />
          ) : null}
          {!timelineVisualControlsDisabled ? <ColorManagementSection colorManagement={exportSettings.colorManagement} setDraftSettings={setDraftSettings} /> : null}
          {isAudioVisualization ? (
            <AudioVisualizationSection
              visualization={exportSettings.audioVisualization ?? DEFAULT_AUDIO_VISUALIZATION}
              setDraftSettings={setDraftSettings}
              onChooseImage={() => void chooseAudioVisualizationBackgroundImage()}
            />
          ) : null}
          {!timelineVisualControlsDisabled && exportSettings.targetAspectRatio && exportSettings.targetAspectRatio !== 'source' ? (
            <div className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[1fr_1fr_160px]">
              <ReframeOffsetField label={t.fields.reframeOffsetX} value={exportSettings.reframeOffsetX ?? 0} axis="x" setDraftSettings={setDraftSettings} />
              <ReframeOffsetField label={t.fields.reframeOffsetY} value={exportSettings.reframeOffsetY ?? 0} axis="y" setDraftSettings={setDraftSettings} />
              <ReframePreviewBox aspect={exportSettings.targetAspectRatio} offsetX={exportSettings.reframeOffsetX ?? 0} offsetY={exportSettings.reframeOffsetY ?? 0} />
            </div>
          ) : null}
          {!timelineVisualControlsDisabled ? <WatermarkSection watermark={draftSettings.watermark} setDraftSettings={setDraftSettings} onChooseImage={() => void chooseWatermarkImage()} /> : null}
          {!timelineVisualControlsDisabled ? <MonitoringSection timecodeBurnIn={draftSettings.timecodeBurnIn} slate={draftSettings.slate} setDraftSettings={setDraftSettings} /> : null}
          <PostExportScriptSection
            script={draftSettings.postExportScript}
            acknowledged={exportBackgroundSettings.postExportScriptAcknowledged}
            setDraftSettings={setDraftSettings}
            onAcknowledgedChange={(checked) => void setPostExportScriptAcknowledged(checked)}
          />
          <ExportUploadSection
            settings={exportUploadSettings}
            password={exportUploadPassword}
            onSettingsChange={(nextSettings) => void updateExportUploadSettings(nextSettings)}
            onPasswordChange={(password) => void updateExportUploadPassword(password)}
            onChooseDirectory={() => void chooseExportUploadDirectory()}
          />
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-5">
            <Info label={t.info.resolution} value={isAudioOnly ? zhCN.common.audioOnly : `${exportSettings.width ?? project.settings.width} x ${exportSettings.height ?? project.settings.height}`} />
            <Info label={t.info.fps} value={isAudioOnly ? zhCN.common.audioOnly : String(exportSettings.fps ?? project.settings.fps)} />
            <Info label={t.info.format} value={exportSettings.format ?? 'mp4'} />
            <Info label={t.info.bitrate} value={`${isAudioOnly ? zhCN.common.noVideo : exportSettings.videoBitrate || zhCN.common.auto} / ${exportSettings.audioBitrate || zhCN.common.auto}`} />
            <Info label={t.info.videoCodec} value={isAudioOnly ? zhCN.common.none : exportSettings.videoCodec ?? 'libx264'} />
            <Info label={t.info.audioCodec} value={exportSettings.audioCodec ?? 'aac'} />
            <Info label={t.info.estimatedSize} value={estimatedSize} />
            <Info label={t.info.ffmpeg} value={capabilities?.available ? capabilities.version ?? zhCN.common.available : zhCN.common.missing} tone={capabilities?.available ? 'ok' : 'bad'} />
            <Info label={t.info.drawtext} value={capabilities?.hasDrawtext && capabilities.hasLibfreetype ? zhCN.common.available : zhCN.common.unavailable} tone={capabilities?.hasDrawtext && capabilities.hasLibfreetype ? 'ok' : 'warn'} />
            <Info
              label={t.info.hardwareEncoder}
              value={capabilities?.hardwareEncoderAvailable && capabilities.hardwareEncoder ? capabilities.hardwareEncoder : zhCN.common.unavailable}
              tone={capabilities?.hardwareEncoderAvailable ? 'ok' : 'warn'}
            />
          </div>
          <ExportCostEstimatePanel estimate={exportCostEstimate} historyErrorPercent={exportCostHistoryError} />
          <ExportOptimizationPanel suggestions={exportOptimizationSuggestions} onApply={applyOptimizationSuggestion} onDismiss={(suggestion) => void dismissOptimizationSuggestion(suggestion)} />
          {!isAudioOnly ? (
            <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-preview-panel">
              <label className="pt-1.5 text-xs font-medium text-slate-600">{t.preview.title}</label>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={previewRunning || capabilities?.available === false}
                    data-testid="export-preview-button"
                    onClick={() => void previewExport()}
                  >
                    <ImageIcon size={13} />
                    {previewRunning ? t.preview.running : t.preview.button}
                  </button>
                  <span className="text-xs text-slate-500" data-testid="export-preview-status">
                    {previewRunning ? t.preview.runningDescription : previewSamples.length === 3 ? t.preview.readyMessage : t.preview.description}
                  </span>
                </div>
                {previewError ? <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-800">{previewError}</div> : null}
                {previewSamples.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-3" data-testid="export-preview-thumbnails">
                    {previewSamples.map((sample) => (
                      <figure key={sample.id} className="overflow-hidden rounded-md border border-line bg-panel" data-testid="export-preview-thumbnail" data-path={sample.path}>
                        <div className="aspect-video bg-black">
                          <img className="h-full w-full object-cover" src={sample.src} alt={sample.label} data-testid="export-preview-image" />
                        </div>
                        <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-slate-600">
                          <span className="font-medium text-slate-700">{sample.label}</span>
                          <span className="tabular-nums">{formatDuration(sample.time)}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {exportMode === 'pipeline' ? (
            <PipelineSection pipeline={pipelineConfig} statuses={pipelineStatuses} onCreateTemplate={createPipelineTemplate} />
          ) : exportMode === 'codec-compare' ? (
            <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-codec-compare-tab">
              <label className="pt-1 text-xs font-medium text-slate-600">{t.codecCompare.title}</label>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{t.codecCompare.description(MAX_CODEC_COMPARE_PRESETS)}</p>
                <div className="grid gap-2 md:grid-cols-2" data-testid="export-codec-compare-preset-list">
                  {presets.map((preset) => {
                    const checked = codecComparePresetIds.includes(preset.id);
                    const disabled = !checked && codecComparePresetIds.length >= MAX_CODEC_COMPARE_PRESETS;
                    return (
                      <label key={preset.id} className={`flex items-start gap-2 rounded-md border border-line p-2 text-xs ${disabled ? 'opacity-50' : ''}`} data-testid="export-codec-compare-preset-row">
                        <input
                          className="mt-0.5 h-4 w-4 accent-brand"
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => toggleCodecComparePreset(preset.id, event.target.checked)}
                          data-testid={`export-codec-compare-preset-${preset.id}`}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-700">{preset.name}</span>
                          <span className="block text-[11px] text-slate-500">{preset.settings.videoCodec ?? zhCN.common.auto} · {preset.settings.videoBitrate ?? zhCN.common.auto} · {preset.settings.format ?? 'mp4'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {codecComparePresetIds.length < 2 ? <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{t.codecCompare.selectAtLeastTwo}</div> : null}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-2 font-medium text-slate-600">
                    <span>{t.codecCompare.recommendationMode}</span>
                    <select
                      className="rounded-md border border-line px-2 py-1.5"
                      value={codecCompareRecommendationMode}
                      onChange={(event) => setCodecCompareRecommendationMode(event.target.value as CodecCompareRecommendationMode)}
                      data-testid="export-codec-compare-recommendation-mode"
                    >
                      <option value="quality">{t.codecCompare.recommendationModes.quality}</option>
                      <option value="size">{t.codecCompare.recommendationModes.size}</option>
                    </select>
                  </label>
                  <button
                    className="rounded-md border border-line px-2 py-1.5 font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={!codecCompareRecommendation}
                    data-testid="export-codec-compare-recommend-button"
                    onClick={() => {
                      if (codecCompareRecommendation) {
                        setPresetId(codecCompareRecommendation.presetId);
                        showToast({ kind: 'info', title: t.codecCompare.recommendedTitle, message: codecCompareRecommendation.presetName });
                      }
                    }}
                  >
                    {codecCompareRecommendation ? t.codecCompare.chooseRecommended(codecCompareRecommendation.presetName) : t.codecCompare.chooseBest}
                  </button>
                  {codecCompareEvaluatingTaskId ? <span className="text-slate-500" data-testid="export-codec-compare-quality-running">{t.codecCompare.evaluating}</span> : null}
                </div>
                {codecCompareResults.length > 0 ? (
                  <div className="overflow-hidden rounded-md border border-line" data-testid="export-codec-compare-results">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-panel text-slate-600">
                        <tr>
                          {(['presetName', 'fileSizeBytes', 'durationMs', 'ssim', 'psnr'] as CodecCompareSortKey[]).map((key) => (
                            <th key={key} className="px-2 py-2 text-left font-semibold">
                              <button className="inline-flex items-center gap-1 hover:text-ink" type="button" data-testid={`export-codec-compare-sort-${key}`} onClick={() => toggleCodecCompareSort(key)}>
                                {t.codecCompare.columns[key]}
                                {codecCompareSort.key === key ? <span>{codecCompareSort.direction === 'asc' ? '↑' : '↓'}</span> : null}
                              </button>
                            </th>
                          ))}
                          <th className="px-2 py-2 text-left font-semibold">{t.codecCompare.columns.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCodecCompareResults.map((result) => (
                          <tr key={`${result.presetId}-${result.outputPath}`} className={codecCompareRecommendation?.taskId === result.taskId ? 'bg-emerald-50' : undefined} data-testid="export-codec-compare-result-row" data-preset-id={result.presetId}>
                            <td className="px-2 py-2 font-medium text-slate-800">{result.presetName}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600">{formatBytes(result.fileSizeBytes)}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600">{formatMilliseconds(result.durationMs)}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-codec-compare-ssim">{formatOptionalNumber(result.ssim, 3)}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-codec-compare-psnr">{formatOptionalNumber(result.psnr, 1)}</td>
                            <td className="px-2 py-2 text-slate-600">
                              {result.qualityStatus === 'running' ? t.codecCompare.evaluating : result.qualityStatus === 'error' ? result.qualityError ?? t.quality.failedMessage : t.status[result.status as ExportTaskStatus] ?? result.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          ) : exportMode === 'version-batch' ? (
            <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-version-batch-tab">
              <label className="pt-1 text-xs font-medium text-slate-600">{t.versionBatch.title}</label>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{t.versionBatch.description}</p>
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <label className="block text-xs font-medium text-slate-600">
                    {t.versionBatch.outputTemplate}
                    <input
                      className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-xs"
                      value={versionedBatchTemplate}
                      placeholder={t.versionBatch.outputTemplatePlaceholder}
                      onChange={(event) => setVersionedBatchTemplate(event.target.value)}
                      data-testid="export-version-output-template"
                    />
                  </label>
                  <button
                    className="mt-5 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid="export-version-template-export"
                    onClick={() => void exportVersionedBatchTemplate()}
                  >
                    <Download size={13} />
                    {t.versionBatch.exportTemplate}
                  </button>
                  <button
                    className="mt-5 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid="export-version-template-import"
                    onClick={() => void importVersionedBatchTemplate()}
                  >
                    <Upload size={13} />
                    {t.versionBatch.importTemplate}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-md border border-line" data-testid="export-version-list">
                  <div className="grid min-w-[1180px] gap-2 bg-panel px-3 py-2 text-[11px] font-semibold uppercase text-slate-500 md:grid-cols-[minmax(120px,1fr)_96px_90px_190px_132px_80px_80px_110px_120px_42px]">
                    <span>{t.versionBatch.columns.version}</span>
                    <span>{t.versionBatch.columns.platform}</span>
                    <span>{t.versionBatch.columns.language}</span>
                    <span>{t.versionBatch.columns.range}</span>
                    <span>{t.versionBatch.columns.preset}</span>
                    <span>{t.versionBatch.columns.width}</span>
                    <span>{t.versionBatch.columns.height}</span>
                    <span>{t.versionBatch.columns.watermark}</span>
                    <span>{t.versionBatch.columns.output}</span>
                    <span />
                  </div>
                  {versionedBatchRows.map((row) => {
                    const previewJob = createVersionedExportJobs({
                      batchId: 'preview',
                      outputPathTemplate: versionedBatchTemplate,
                      defaultSettings: exportSettings,
                      versions: [
                        {
                          id: row.id,
                          name: row.name,
                          presetId: row.presetId,
                          platform: row.platform,
                          language: row.language,
                          settings: buildVersionSettings(row)
                        }
                      ]
                    })[0];
                    return (
                      <div key={row.id} className="grid min-w-[1180px] gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0 md:grid-cols-[minmax(120px,1fr)_96px_90px_190px_132px_80px_80px_110px_120px_42px]" data-testid="export-version-row">
                        <label className="flex min-w-0 items-center gap-2">
                          <input
                            className="h-4 w-4 accent-brand"
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(event) => updateVersionedBatchRow(row.id, { enabled: event.target.checked })}
                            data-testid="export-version-enabled"
                          />
                          <input
                            className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5"
                            value={row.name}
                            onChange={(event) => updateVersionedBatchRow(row.id, { name: event.target.value })}
                            data-testid="export-version-name-input"
                          />
                        </label>
                        <input
                          className="rounded-md border border-line px-2 py-1.5"
                          value={row.platform}
                          onChange={(event) => updateVersionedBatchRow(row.id, { platform: event.target.value })}
                          data-testid="export-version-platform-input"
                        />
                        <input
                          className="rounded-md border border-line px-2 py-1.5"
                          value={row.language}
                          onChange={(event) => updateVersionedBatchRow(row.id, { language: event.target.value })}
                          data-testid="export-version-language-input"
                        />
                        <div className="grid grid-cols-[74px_1fr_1fr] gap-1">
                          <select
                            className="rounded-md border border-line px-1 py-1.5"
                            value={row.rangeMode}
                            onChange={(event) => updateVersionedBatchRow(row.id, { rangeMode: event.target.value as VersionRangeMode })}
                            data-testid="export-version-range-mode"
                          >
                            <option value="default">{t.versionBatch.rangeModes.default}</option>
                            <option value="custom">{t.versionBatch.rangeModes.custom}</option>
                          </select>
                          <input
                            className="rounded-md border border-line px-1 py-1.5 disabled:bg-slate-100"
                            type="number"
                            min={0}
                            step={0.1}
                            disabled={row.rangeMode !== 'custom'}
                            value={row.rangeStart}
                            onChange={(event) => updateVersionedBatchRow(row.id, { rangeStart: Math.max(0, Number(event.target.value) || 0) })}
                            data-testid="export-version-range-start"
                            title={t.versionBatch.rangeStart}
                          />
                          <input
                            className="rounded-md border border-line px-1 py-1.5 disabled:bg-slate-100"
                            type="number"
                            min={0.001}
                            step={0.1}
                            disabled={row.rangeMode !== 'custom'}
                            value={row.rangeDuration}
                            onChange={(event) => updateVersionedBatchRow(row.id, { rangeDuration: Math.max(0.001, Number(event.target.value) || 0.001) })}
                            data-testid="export-version-range-duration"
                            title={t.versionBatch.rangeDuration}
                          />
                        </div>
                        <select className="rounded-md border border-line px-2 py-1.5" value={row.presetId} onChange={(event) => updateVersionedBatchRow(row.id, { presetId: event.target.value })} data-testid="export-version-preset-select">
                          {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded-md border border-line px-2 py-1.5"
                          type="number"
                          min={1}
                          value={row.width}
                          onChange={(event) => updateVersionedBatchRow(row.id, { width: Math.max(1, Math.round(Number(event.target.value) || 1)) })}
                          data-testid="export-version-width-input"
                        />
                        <input
                          className="rounded-md border border-line px-2 py-1.5"
                          type="number"
                          min={1}
                          value={row.height}
                          onChange={(event) => updateVersionedBatchRow(row.id, { height: Math.max(1, Math.round(Number(event.target.value) || 1)) })}
                          data-testid="export-version-height-input"
                        />
                        <select className="rounded-md border border-line px-2 py-1.5" value={row.watermarkMode} onChange={(event) => updateVersionedBatchRow(row.id, { watermarkMode: event.target.value as VersionWatermarkMode })} data-testid="export-version-watermark-select">
                          <option value="inherit">{t.versionBatch.watermarkModes.inherit}</option>
                          <option value="none">{t.versionBatch.watermarkModes.none}</option>
                          <option value="text">{t.versionBatch.watermarkModes.text}</option>
                        </select>
                        <div className="truncate rounded-md bg-panel px-2 py-1.5 font-mono text-[11px] text-slate-500" title={previewJob?.outputPath} data-testid="export-version-output-preview">
                          {previewJob?.outputPath}
                        </div>
                        <button
                          className="rounded-md border border-line p-1.5 text-slate-500 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                          type="button"
                          disabled={versionedBatchRows.length <= 1}
                          data-testid="export-version-remove"
                          onClick={() => removeVersionedBatchRow(row.id)}
                          title={t.versionBatch.remove}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="export-version-add" onClick={addVersionedBatchRow}>
                  <ListPlus size={13} />
                  {t.versionBatch.add}
                </button>
                {versionedBatchReportRows.length > 0 ? <VersionedBatchReportTable rows={versionedBatchReportRows} /> : null}
              </div>
            </div>
          ) : exportMode === 'sequence-batch' ? (
            <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-sequence-batch-tab">
              <label className="pt-1 text-xs font-medium text-slate-600">{t.sequenceBatch.title}</label>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{t.sequenceBatch.description}</p>
                <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                  <label className="block text-xs font-medium text-slate-600">
                    {t.sequenceBatch.outputTemplate}
                    <input
                      className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                      value={sequenceBatchTemplate}
                      placeholder={t.sequenceBatch.outputTemplatePlaceholder}
                      onChange={(event) => setSequenceBatchTemplate(event.target.value)}
                      data-testid="export-sequence-output-template"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.sequenceBatch.presetMode}
                    <select
                      className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                      value={sequenceBatchPresetMode}
                      onChange={(event) => setSequenceBatchPresetMode(event.target.value as SequenceBatchPresetMode)}
                      data-testid="export-sequence-preset-mode"
                    >
                      <option value="shared">{t.sequenceBatch.presetModes.shared}</option>
                      <option value="individual">{t.sequenceBatch.presetModes.individual}</option>
                    </select>
                  </label>
                </div>
                <div className="overflow-hidden rounded-md border border-line" data-testid="export-sequence-list">
                  {sequenceBatchRows.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">{t.sequenceBatch.noSequences}</div>
                  ) : (
                    sequenceBatchRows.map(({ sequence, selected, outputPath: rowOutputPath, presetId: rowPresetId }) => (
                      <div key={sequence.id} className="grid gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(220px,1.4fr)_180px]" data-testid="export-sequence-batch-row" data-sequence-id={sequence.id}>
                        <label className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                          <input
                            className="h-4 w-4 accent-brand"
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => toggleSequenceBatchSelection(sequence.id, event.target.checked)}
                            data-testid="export-sequence-checkbox"
                          />
                          <span className="truncate">{sequence.name}</span>
                        </label>
                        <input
                          className="min-w-0 rounded-md border border-line px-2 py-1.5 font-mono text-[11px]"
                          value={rowOutputPath}
                          onChange={(event) => updateSequenceBatchOutput(sequence.id, event.target.value)}
                          data-testid="export-sequence-output-path"
                        />
                        {sequenceBatchPresetMode === 'individual' ? (
                          <select className="rounded-md border border-line px-2 py-1.5 text-xs" value={rowPresetId} onChange={(event) => updateSequenceBatchPreset(sequence.id, event.target.value)} data-testid="export-sequence-preset-select">
                            {presets.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-md bg-panel px-2 py-1.5 text-[11px] text-slate-500">{selectedPreset.name}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <label className="pt-1.5 text-xs font-medium text-slate-600">{t.batchPaths}</label>
              <textarea
                className="min-h-16 resize-y rounded-md border border-line px-2 py-1.5 text-xs"
                placeholder={t.batchPlaceholder}
                value={batchOutputPaths}
                onChange={(event) => setBatchOutputPaths(event.target.value)}
                data-testid="export-batch-paths"
              />
            </div>
          )}
          <div className="grid grid-cols-[110px_220px] gap-2">
            <label className="pt-1.5 text-xs font-medium text-slate-600">{t.priority}</label>
            <select className="rounded-md border border-line px-2 py-1.5 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as ExportTaskPriority)} data-testid="export-priority-select">
              {(['high', 'normal', 'low'] as const).map((value) => (
                <option key={value} value={value}>
                  {t.priorityOptions[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.schedule.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input className="h-4 w-4 accent-brand" type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} data-testid="export-schedule-toggle" />
                <span>{t.schedule.enabled}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="h-9 min-w-56 rounded-md border border-line px-2 text-sm disabled:bg-slate-100"
                  type="datetime-local"
                  step={1}
                  value={scheduledStartInput}
                  disabled={!scheduleEnabled}
                  onChange={(event) => setScheduledStartInput(event.target.value)}
                  data-testid="export-schedule-start-input"
                />
                <span className="text-xs text-slate-500">{t.schedule.description}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1.5 text-xs font-medium text-slate-600">{t.completionAction.title}</label>
            <div className="space-y-2">
              <select
                className="w-full max-w-xs rounded-md border border-line px-2 py-1.5 text-sm"
                value={completionAction}
                onChange={(event) => setCompletionAction(normalizeExportCompletionAction(event.target.value))}
                data-testid="export-completion-action-select"
              >
                {EXPORT_COMPLETION_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t.completionAction.options[action]}
                  </option>
                ))}
              </select>
              {(completionAction === 'shutdown' || completionAction === 'hibernate') && !exportBackgroundSettings.allowPowerActions ? (
                <div className="text-xs text-amber-700" data-testid="export-power-action-disabled-warning">{t.completionAction.powerDisabled}</div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.progressive.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={progressiveExportEnabled}
                  data-testid="export-progressive-toggle"
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setProgressiveExportEnabled(checked);
                    if (checked) {
                      setRenderFarmEnabled(false);
                    }
                  }}
                />
                <span>{t.progressive.enabled}</span>
              </label>
              <div className="text-xs text-slate-500">{t.progressive.description}</div>
              {progressiveExportEnabled && !progressiveExportSupported ? (
                <div className="text-xs text-amber-700" data-testid="export-progressive-unsupported">
                  {t.progressive.unsupportedWarning}
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.renderFarm.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={renderFarmEnabled}
                  disabled={progressiveExportEnabled}
                  onChange={(event) => setRenderFarmEnabled(event.target.checked)}
                  data-testid="export-render-farm-toggle"
                />
                <span>{t.renderFarm.enabled}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{t.renderFarm.instances}</span>
                <input
                  className="h-8 w-16 rounded-md border border-line px-2 text-right disabled:bg-slate-100"
                  type="number"
                  min={1}
                  max={4}
                  value={renderFarmInstances}
                  disabled={!renderFarmEnabled || progressiveExportEnabled}
                  onChange={(event) => setRenderFarmInstances(Math.min(4, Math.max(1, Math.round(Number(event.target.value) || 1))))}
                  data-testid="export-render-farm-instances"
                />
                <span>{t.renderFarm.suggested(suggestedRenderFarmInstances)}</span>
              </div>
              {progressiveExportEnabled ? <div className="text-xs text-slate-500">{t.progressive.renderFarmDisabled}</div> : null}
            </div>
          </div>
          {capabilities?.drawtextWarning ? <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">{formatExportWarning(capabilities.drawtextWarning)}</div> : null}
          {spatialDenoiseClipCount > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" data-testid="export-spatial-denoise-warning">
              {t.spatialDenoiseWarning(spatialDenoiseClipCount)}
            </div>
          ) : null}
          {preflight ? <PreflightPanel issues={preflight.issues} onDismiss={() => setPreflight(undefined)} onContinue={() => void continueAfterWarnings()} onRelink={onRelinkMissing ? relinkFromPreflight : undefined} /> : null}
          {hardwareEncodingRequested && capabilities && !capabilities.hardwareEncoderAvailable ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" data-testid="export-hardware-fallback-warning">
              {t.hardwareEncodingFallback}
            </div>
          ) : null}
          {warmupStatus ? <ExportWarmupStatusPanel status={warmupStatus} /> : null}
          {error ? <pre className="max-h-32 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-800 whitespace-pre-wrap">{error}</pre> : null}
          <div className="rounded-md border border-line" data-testid="export-queue-list">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div>
                <div className="text-xs font-semibold text-slate-700">{t.queueTitle}</div>
                <div className="text-[11px] text-slate-500">{queuePaused ? t.queuePausedByUser : resourcePaused ? t.queuePausedForMemory : runnerActive ? t.queueRunning(maxConcurrent) : zhCN.common.idle}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <span>{t.maxConcurrent}</span>
                  <select
                    className="rounded-md border border-line px-2 py-1"
                    value={maxConcurrent}
                    onChange={(event) => setExportQueueMaxConcurrent(Number(event.target.value))}
                    data-testid="export-max-concurrent-select"
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" onClick={clearFinishedTasks}>
                  <Trash2 size={13} />
                  {t.clearFinished}
                </button>
                <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" type="button" data-testid="export-queue-pause-button" onClick={() => setExportQueuePaused(!queuePaused)}>
                  <Clock3 size={13} />
                  {queuePaused ? t.resumeQueue : t.pauseQueue}
                </button>
                <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" type="button" data-testid="export-minimize-to-tray-button" onClick={() => void minimizeToTray()}>
                  <Minimize2 size={13} />
                  {t.minimizeToTray}
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-slate-500">{t.noTasks}</div>
              ) : (
                tasks.map((task) => <ExportTaskRow key={task.id} taskId={task.id} />)
              )}
            </div>
          </div>
          <div className="rounded-md border border-line" data-testid="export-history-list">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-slate-700">{t.historyTitle}</div>
            <div className="max-h-32 overflow-y-auto">
              {history.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-500">{t.noHistory}</div>
              ) : (
                history.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="border-b border-line px-3 py-2 text-xs last:border-b-0" data-testid="export-history-entry" data-status={entry.status}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-800">{entry.name}</div>
                        <div className="truncate text-[11px] text-slate-500">{entry.outputPath}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{priorityLabel(entry.priority)}</span>
                      <StatusPill status={entry.status} />
                      {entry.logPath ? (
                        <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" data-testid="export-history-log-button" onClick={() => void openPath(entry.logPath!)}>
                          {t.viewLog}
                        </button>
                      ) : null}
                      <button
                        className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        data-testid="export-quality-button"
                        disabled={entry.status !== 'success' || !entry.sourcePath || Boolean(qualityTaskId)}
                        title={!entry.sourcePath ? t.quality.sourceMissing : undefined}
                        onClick={() => void evaluateHistoryQuality(entry)}
                      >
                        {t.quality.button}
                      </button>
                    </div>
                    {entry.report?.recovery ? <ExportRecoveryPanel report={entry.report.recovery} /> : null}
                    {entry.report?.qualityAssurance ? <PostExportQualityAssurancePanel result={entry.report.qualityAssurance} /> : null}
                    {entry.report?.postExportScript ? <PostExportScriptResultPanel result={entry.report.postExportScript} /> : null}
                    {entry.upload ? <ExportUploadStatusPanel upload={entry.upload} onRetry={entry.upload.status === 'error' ? () => void retryHistoryUpload(entry) : undefined} /> : null}
                  </div>
                ))
              )}
            </div>
            {qualityTaskId || qualityResult || qualityError ? (
              <QualityResultPanel
                result={qualityResult?.result}
                running={Boolean(qualityTaskId)}
                progress={qualityProgress}
                error={qualityError}
                onCancel={() => void cancelRunningQualityEvaluation()}
              />
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:cursor-wait disabled:opacity-60"
            type="button"
            disabled={warmupStatus?.status === 'running'}
            onClick={() => void addToQueue()}
            data-testid="export-enqueue-button"
          >
            <ListPlus size={15} />
            {t.addToQueue}
          </button>
        </div>
      </section>
    </div>
  );
}

async function runProxyGenerationWarmup(project: Project): Promise<void> {
  const mediaIds = new Set(project.media.map((asset) => asset.id));
  const hasActiveProxyJobs = useMediaJobStore
    .getState()
    .jobs.some((job) => job.type === 'proxy' && mediaIds.has(job.assetId) && (job.status === 'pending' || job.status === 'running'));
  if (hasActiveProxyJobs) {
    await ensureMediaJobRunner();
  }
}

function resolveInOutExportRanges(project: Project, inPoint: number | undefined, outPoint: number | undefined): NormalizedExportRenderRange[] {
  const timelineDuration = getTimelinePlaybackDuration(project.timeline);
  const fps = project.settings.fps || 30;
  const stored = normalizeExportRanges(project.exportRanges, timelineDuration).flatMap((range) => {
    const normalized = normalizeExportRenderRange(
      {
        id: range.id,
        label: range.label,
        start: range.start,
        duration: range.end - range.start
      },
      timelineDuration,
      fps
    );
    return normalized ? [normalized] : [];
  });
  if (stored.length > 0) {
    return stored;
  }
  const current = exportRenderRangeFromPoints(inPoint, outPoint, timelineDuration, fps, { id: 'current-in-out', label: zhCN.timeline.exportRangeLabel(1) });
  return current ? [current] : [];
}

function resolveSelectedClipExportRange(project: Project, selectedClipIds: string[]): NormalizedExportRenderRange | null {
  const selected = new Set(selectedClipIds);
  if (selected.size === 0) {
    return null;
  }
  const clips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => selected.has(clip.id));
  if (clips.length === 0) {
    return null;
  }
  const start = Math.min(...clips.map((clip) => clip.start));
  const end = Math.max(...clips.map((clip) => clip.start + clip.duration));
  return exportRenderRangeFromPoints(start, end, getTimelinePlaybackDuration(project.timeline), project.settings.fps || 30, {
    id: 'selected-clips',
    label: zhCN.exportDialog.range.options['selected-clips']
  });
}

function resolveActiveExportRanges(
  mode: ExportRangeMode,
  inOutRanges: NormalizedExportRenderRange[],
  selectedClipRange: NormalizedExportRenderRange | null
): NormalizedExportRenderRange[] {
  if (mode === 'in-out') {
    return inOutRanges;
  }
  if (mode === 'selected-clips') {
    return selectedClipRange ? [selectedClipRange] : [];
  }
  return [];
}

function buildExportJobs(paths: string[], ranges: NormalizedExportRenderRange[]): ExportJob[] {
  if (ranges.length === 0) {
    return paths.map((path) => ({ outputPath: path, range: null }));
  }
  if (ranges.length === 1) {
    return paths.map((path) => ({ outputPath: path, range: ranges[0] }));
  }
  if (paths.length >= ranges.length) {
    return ranges.map((range, index) => ({ outputPath: paths[index], range }));
  }
  const basePath = paths[0];
  return ranges.map((range, index) => ({
    outputPath: appendExportRangeSequence(basePath, index + 1, ranges.length),
    range
  }));
}

function updatePipelineStatus(
  statuses: Record<string, ExportPipelineNodeStatus>,
  nodeId: string,
  status: ExportPipelineNodeStatus
): Record<string, ExportPipelineNodeStatus> {
  return { ...statuses, [nodeId]: status };
}

async function waitForExportTasks(taskIds: string[]): Promise<void> {
  const ids = new Set(taskIds);
  if (ids.size === 0) {
    return;
  }
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const tasks = useExportQueueStore.getState().tasks.filter((task) => ids.has(task.id));
    if (tasks.length === ids.size && tasks.every((task) => task.status === 'success' || task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted')) {
      return;
    }
    await delay(100);
  }
  throw new Error(zhCN.exportDialog.pipeline.timeout);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pipelineStatusClass(status: ExportPipelineNodeStatus): string {
  if (status === 'complete') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (status === 'running') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  if (status === 'skipped') {
    return 'border-slate-200 bg-slate-50 text-slate-500';
  }
  return 'border-slate-200 bg-white text-slate-600';
}

function formatExportRangeSummary(
  mode: ExportRangeMode,
  ranges: NormalizedExportRenderRange[],
  selectedClipRange: NormalizedExportRenderRange | null
): string {
  if (mode === 'all') {
    return zhCN.exportDialog.range.allSummary;
  }
  if (mode === 'selected-clips' && !selectedClipRange) {
    return zhCN.exportDialog.range.unavailable;
  }
  if (ranges.length === 0) {
    return zhCN.exportDialog.range.unavailable;
  }
  if (ranges.length === 1) {
    return zhCN.exportDialog.range.singleSummary(formatDuration(ranges[0].start), formatDuration(ranges[0].duration));
  }
  return zhCN.exportDialog.range.multiSummary(ranges.length);
}

async function runCompletionAction(action: ExportCompletionAction, settings: ExportBackgroundSettings): Promise<void> {
  if (action === 'none') {
    return;
  }
  if (action === 'notification') {
    showToast({ kind: 'success', title: zhCN.exportDialog.completionAction.notificationTitle, message: zhCN.exportDialog.completionAction.notificationMessage });
    if (typeof Notification !== 'undefined') {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        new Notification(zhCN.exportDialog.completionAction.notificationTitle, { body: zhCN.exportDialog.completionAction.notificationMessage });
      }
    }
    return;
  }
  if (!settings.allowPowerActions) {
    showToast({ kind: 'warning', title: zhCN.exportDialog.completionAction.powerDisabledTitle, message: zhCN.exportDialog.completionAction.powerDisabled });
    return;
  }
  try {
    await runExportPowerAction(action, true);
  } catch (error) {
    showToast({
      kind: 'error',
      title: zhCN.exportDialog.completionAction.powerFailedTitle,
      message: error instanceof Error ? error.message : zhCN.exportDialog.completionAction.powerFailedMessage
    });
  }
}

function buildExportPreviewOutputPaths(appDataDir: string): string[] {
  const root = `${appDataDir.replace(/[\\/]+$/, '')}/export-previews/${Date.now()}`;
  return (['start', 'middle', 'end'] satisfies ExportPreviewSampleKind[]).map((kind) => `${root}/${kind}.png`);
}

function normalizeDraftSettings(settings: ExportPresetSettings): ExportPresetSettings {
  let format = settings.format ?? 'mp4';
  const animatedImage = format === 'gif' || format === 'webp' || format === 'apng';
  let outputMode = settings.outputMode ?? (format === 'm4a' ? 'audio' : 'video');
  if (outputMode !== 'audio' && outputMode !== 'audio-visualization') {
    outputMode = 'video';
  }
  if (outputMode === 'audio') {
    format = 'm4a';
  } else if (outputMode === 'audio-visualization') {
    format = isAudioVisualizationFormat(format) ? format : 'mp4';
  } else if (format === 'm4a') {
    outputMode = 'audio';
  } else if (animatedImage) {
    outputMode = 'video';
  }
  const normalizedAnimatedImage = format === 'gif' || format === 'webp' || format === 'apng';
  const hardwareEncoding = outputMode !== 'audio' && (format === 'mp4' || format === 'mov') && settings.hardwareEncoding === true;
  const targetAspectRatio = outputMode === 'video' ? normalizeTargetAspectRatio(settings.targetAspectRatio) : 'source';
  const dimensions = resolveReframeDimensions(settings.width ?? 1280, settings.height ?? 720, targetAspectRatio);
  const loudnessNormalization = supportsLoudnessNormalization(format, outputMode) ? normalizeLoudnessNormalization(settings.loudnessNormalization) : 'off';
  const visualExportSettingsEnabled = outputMode === 'video' && !normalizedAnimatedImage;
  const watermark = visualExportSettingsEnabled ? (settings.watermark ?? null) : null;
  const timecodeBurnIn = visualExportSettingsEnabled ? normalizeTimecodeBurnInDraft(settings.timecodeBurnIn) : null;
  const slate = visualExportSettingsEnabled && settings.slate?.enabled === true ? { enabled: true } : null;
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const postExportScript = normalizeExportPostScript(settings.postExportScript);
  const masterProcessing = normalizeExportMasterProcessing(settings.masterProcessing);
  return {
    ...settings,
    width: targetAspectRatio === 'source' ? settings.width : dimensions.width,
    height: targetAspectRatio === 'source' ? settings.height : dimensions.height,
    format,
    outputMode,
    videoCodec: outputMode !== 'audio' ? normalizeVideoCodecForFormat(format, settings.videoCodec) : settings.videoCodec,
    audioCodec: normalizeAudioCodecForFormat(format, settings.audioCodec),
    hardwareEncoding,
    loudnessNormalization,
    subtitleFormat: normalizeSubtitleFormat(settings.subtitleFormat),
    exportSidecarSubtitle: settings.exportSidecarSubtitle === true,
    subtitleLanguages: normalizeSubtitleLanguageList(settings.subtitleLanguages),
    subtitleBurnInLanguage: settings.subtitleBurnInLanguage ? normalizeSubtitleLanguage(settings.subtitleBurnInLanguage) : undefined,
    targetAspectRatio,
    reframeOffsetX: clampReframeOffset(settings.reframeOffsetX),
    reframeOffsetY: clampReframeOffset(settings.reframeOffsetY),
    watermark,
    timecodeBurnIn,
    slate,
    colorManagement,
    postExportScript,
    masterProcessing: hasExportMasterProcessing(masterProcessing) ? masterProcessing : null,
    audioVisualization: normalizeAudioVisualizationDraft(settings.audioVisualization)
  };
}

function updateNumberSetting(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'width' | 'height' | 'fps',
  value: string
): void {
  setDraftSettings((current) => {
    const next = { ...current };
    const parsed = Number(value);
    if (value.trim() && Number.isFinite(parsed) && parsed > 0) {
      next[key] = parsed;
    } else {
      delete next[key];
    }
    return next;
  });
}

function updateStringSetting(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'videoBitrate' | 'audioBitrate',
  value: string
): void {
  setDraftSettings((current) => ({ ...current, [key]: value.trim() || null }));
}

function updateOutputMode(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    if (value === 'audio') {
      return {
        ...current,
        outputMode: 'audio',
        format: 'm4a',
        audioCodec: 'aac',
        videoBitrate: null,
        watermark: null,
        timecodeBurnIn: null,
        slate: null,
        targetAspectRatio: 'source',
        hardwareEncoding: false
      };
    }
    if (value === 'audio-visualization') {
      const format = isAudioVisualizationFormat(current.format) ? current.format : 'mp4';
      return {
        ...current,
        outputMode: 'audio-visualization',
        format,
        videoCodec: normalizeVideoCodecForFormat(format, current.videoCodec),
        audioCodec: normalizeAudioCodecForFormat(format, current.audioCodec),
        audioVisualization: normalizeAudioVisualizationDraft(current.audioVisualization),
        scaleMode: 'none',
        targetAspectRatio: 'source',
        watermark: null,
        timecodeBurnIn: null,
        slate: null
      };
    }
    const format = current.format === 'm4a' ? 'mp4' : (current.format ?? 'mp4');
    return {
      ...current,
      outputMode: 'video',
      format,
      videoCodec: normalizeVideoCodecForFormat(format, current.videoCodec),
      audioCodec: normalizeAudioCodecForFormat(format, current.audioCodec),
      hardwareEncoding: format === 'mp4' || format === 'mov' ? current.hardwareEncoding : false
    };
  });
}

function updateFormat(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const next: ExportPresetSettings = { ...current, format: value };
    if (value === 'm4a') {
      next.outputMode = 'audio';
      next.audioCodec = 'aac';
      delete next.videoCodec;
      delete next.videoBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'png-sequence') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'png';
      next.audioCodec = 'aac';
      delete next.videoBitrate;
      delete next.audioBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'gif') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'gif';
      next.audioCodec = 'aac';
      next.fps = Math.min(30, next.fps ?? 30);
      delete next.audioBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'webp') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'libwebp_anim';
      next.audioCodec = 'aac';
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'apng') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'apng';
      next.audioCodec = 'aac';
      delete next.hardwareEncoding;
      return next;
    }
    next.outputMode = current.outputMode === 'audio-visualization' && isAudioVisualizationFormat(value) ? 'audio-visualization' : 'video';
    if (value === 'webm') {
      next.videoCodec = 'libvpx-vp9';
      next.audioCodec = 'libopus';
      delete next.hardwareEncoding;
    } else {
      next.videoCodec = 'libx264';
      next.audioCodec = 'aac';
      if (value !== 'mp4' && value !== 'mov') {
        delete next.hardwareEncoding;
      }
    }
    if (next.outputMode === 'audio-visualization') {
      next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
      next.scaleMode = 'none';
      next.targetAspectRatio = 'source';
      next.watermark = null;
    }
    return next;
  });
}

function normalizeVideoCodecForFormat(format: string, current?: string): string {
  if (format === 'webm') {
    return 'libvpx-vp9';
  }
  if (format === 'gif') {
    return 'gif';
  }
  if (format === 'webp') {
    return 'libwebp_anim';
  }
  if (format === 'apng') {
    return 'apng';
  }
  if (format === 'png-sequence') {
    return 'png';
  }
  return current && current !== 'gif' && current !== 'libwebp_anim' && current !== 'apng' && current !== 'png' && current !== 'libvpx-vp9'
    ? current
    : 'libx264';
}

function normalizeAudioCodecForFormat(format: string, current?: string): string {
  if (format === 'webm') {
    return 'libopus';
  }
  return current && current !== 'libopus' ? current : 'aac';
}

function isAudioVisualizationFormat(format: string | undefined): format is string {
  return typeof format === 'string' && AUDIO_VISUALIZATION_FORMATS.includes(format);
}

function normalizeAudioVisualizationDraft(value: ExportPresetSettings['audioVisualization']): NonNullable<ExportPresetSettings['audioVisualization']> {
  const style = value?.style === 'spectrum-bars' || value?.style === 'circular-spectrum' || value?.style === 'waveform-line' ? value.style : DEFAULT_AUDIO_VISUALIZATION.style;
  const normalized: NonNullable<ExportPresetSettings['audioVisualization']> = {
    style,
    color: normalizeHexColor(value?.color, DEFAULT_AUDIO_VISUALIZATION.color),
    background: normalizeAudioVisualizationBackgroundDraft(value?.background)
  };
  if (typeof value?.themeId === 'string' && value.themeId.trim()) {
    normalized.themeId = value.themeId.trim();
  }
  if (value?.theme && typeof value.theme === 'object') {
    normalized.theme = normalizeAudioVisualizationTheme(value.theme);
  }
  return normalized;
}

function normalizeAudioVisualizationBackgroundDraft(
  value: NonNullable<ExportPresetSettings['audioVisualization']>['background'] | undefined
): ExportAudioVisualizationBackground {
  if (value?.type === 'image' && value.path.trim()) {
    return { type: 'image', path: value.path.trim() };
  }
  if (value?.type === 'gradient') {
    return {
      type: 'gradient',
      color: normalizeHexColor(value.color, '#050816'),
      color2: normalizeHexColor(value.color2, '#1d4ed8')
    };
  }
  if (value?.type === 'solid') {
    return { type: 'solid', color: normalizeHexColor(value.color, '#050816') };
  }
  return DEFAULT_AUDIO_VISUALIZATION.background;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }
  return fallback;
}

function normalizeTimecodeBurnInDraft(value: ExportPresetSettings['timecodeBurnIn']): ExportPresetSettings['timecodeBurnIn'] {
  if (!value?.enabled) {
    return null;
  }
  return {
    enabled: true,
    position: normalizeWatermarkPosition(value.position),
    fontSize: Math.round(clampUiNumber(String(value.fontSize ?? DEFAULT_TIMECODE_BURN_IN.fontSize), 8, 96, DEFAULT_TIMECODE_BURN_IN.fontSize)),
    color: normalizeHexColor(value.color, DEFAULT_TIMECODE_BURN_IN.color),
    backgroundColor: normalizeHexColor(value.backgroundColor, DEFAULT_TIMECODE_BURN_IN.backgroundColor),
    includeFrameNumber: value.includeFrameNumber === true
  };
}

function updateAudioVisualizationStyle(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    audioVisualization: {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      style: AUDIO_VISUALIZATION_STYLES.includes(value as ExportAudioVisualizationStyle) ? (value as ExportAudioVisualizationStyle) : 'waveform-line'
    }
  }));
}

function updateAudioVisualizationTheme(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  theme: AudioVisualizationThemeDefinition | undefined,
  customThemes: readonly CustomAudioVisualizationTheme[]
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    if (!theme) {
      const nextVisualization = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID
      };
      delete nextVisualization.theme;
      return { ...current, audioVisualization: nextVisualization };
    }
    const isCustom = customThemes.some((item) => item.id === theme.id);
    const expanded = expandAudioVisualizationTheme({ themeId: theme.id, theme: isCustom ? theme : undefined });
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: theme.id,
      color: expanded.colorStart,
      background: audioVisualizationBackgroundFromTheme(expanded.background)
    };
    if (isCustom) {
      nextVisualization.theme = theme;
    } else {
      delete nextVisualization.theme;
    }
    return {
      ...current,
      audioVisualization: nextVisualization
    };
  });
}

function updateAudioVisualizationColor(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const nextVisualization = {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      color: normalizeHexColor(value, DEFAULT_AUDIO_VISUALIZATION.color),
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID
    };
    delete nextVisualization.theme;
    return { ...current, audioVisualization: nextVisualization };
  });
}

function updateAudioVisualizationBackgroundType(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const type = AUDIO_VISUALIZATION_BACKGROUND_TYPES.includes(value as ExportAudioVisualizationBackground['type'])
      ? (value as ExportAudioVisualizationBackground['type'])
      : 'solid';
    const nextVisualization = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background:
        type === 'image'
          ? { type: 'image' as const, path: visualization.background.type === 'image' ? visualization.background.path : '' }
          : type === 'gradient'
            ? { type: 'gradient' as const, color: backgroundPrimaryColor(visualization.background), color2: '#1d4ed8' }
            : { type: 'solid' as const, color: backgroundPrimaryColor(visualization.background) }
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization
    };
  });
}

function updateAudioVisualizationBackgroundColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'color' | 'color2',
  value: string
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const background = visualization.background;
    if (background.type === 'gradient') {
      const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
        background: { ...background, [key]: normalizeHexColor(value, key === 'color' ? '#050816' : '#1d4ed8') }
      };
      delete nextVisualization.theme;
      return {
        ...current,
        audioVisualization: nextVisualization
      };
    }
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background: { type: 'solid' as const, color: normalizeHexColor(value, '#050816') }
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization
    };
  });
}

function updateAudioVisualizationBackgroundImagePath(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, path: string): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const nextVisualization = { ...visualization, themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID, background: { type: 'image' as const, path } };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization
    };
  });
}

function audioVisualizationBackgroundFromTheme(background: ReturnType<typeof expandAudioVisualizationTheme>['background']): ExportAudioVisualizationBackground {
  return background.type === 'gradient'
    ? { type: 'gradient', color: background.color, color2: background.color2 }
    : { type: 'solid', color: background.color };
}

function backgroundPrimaryColor(background: ExportAudioVisualizationBackground): string {
  return background.type === 'image' ? '#050816' : background.color;
}

function updateSubtitleMode(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const next = { ...current };
    if (value === 'burn-in' || value === 'soft-sub') {
      next.subtitleMode = value;
    } else {
      delete next.subtitleMode;
    }
    return next;
  });
}

function updateSubtitleFormat(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, subtitleFormat: normalizeSubtitleFormat(value) }));
}

function updateExportSidecarSubtitle(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, exportSidecarSubtitle: checked }));
}

function updateSubtitleLanguageSelection(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  language: string,
  checked: boolean,
  options: SubtitleLanguageOption[]
): void {
  const normalized = normalizeSubtitleLanguage(language);
  setDraftSettings((current) => {
    const selected = normalizeSubtitleLanguageList(current.subtitleLanguages) ?? options.map((option) => option.language);
    const next = checked ? Array.from(new Set([...selected, normalized])) : selected.filter((item) => item !== normalized);
    const available = new Set(options.map((option) => option.language));
    return {
      ...current,
      subtitleLanguages: next.filter((item) => available.has(item))
    };
  });
}

function updateSubtitleBurnInLanguage(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, language: string): void {
  setDraftSettings((current) => ({ ...current, subtitleBurnInLanguage: normalizeSubtitleLanguage(language) }));
}

function updateScaleMode(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, scaleMode: value === 'fit' ? 'fit' : 'none' }));
}

function updateTargetAspectRatio(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const targetAspectRatio = normalizeTargetAspectRatio(value);
    if (targetAspectRatio === 'source') {
      return { ...current, targetAspectRatio };
    }
    const dimensions = resolveReframeDimensions(current.width ?? 1280, current.height ?? 720, targetAspectRatio);
    return {
      ...current,
      ...dimensions,
      targetAspectRatio,
      scaleMode: 'none',
      reframeOffsetX: clampReframeOffset(current.reframeOffsetX),
      reframeOffsetY: clampReframeOffset(current.reframeOffsetY)
    };
  });
}

function updateReframeOffset(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, axis: 'x' | 'y', value: string): void {
  const key = axis === 'x' ? 'reframeOffsetX' : 'reframeOffsetY';
  setDraftSettings((current) => ({ ...current, [key]: clampReframeOffset(Number(value)) }));
}

function updateHardwareEncoding(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, hardwareEncoding: checked }));
}

function updateLoudnessNormalization(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, loudnessNormalization: normalizeLoudnessNormalization(value) }));
}

function updateMasterProcessing(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, updater: (current: ExportMasterProcessingSettings) => ExportMasterProcessingSettings): void {
  setDraftSettings((current) => ({ ...current, masterProcessing: updater(normalizeExportMasterProcessing(current.masterProcessing)) }));
}

function updateMasterEqEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, enabled: boolean): void {
  updateMasterProcessing(setDraftSettings, (current) => ({ ...current, eq: { ...current.eq, enabled } }));
}

function updateMasterEqBand(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, index: number, patch: Partial<ExportMasterProcessingSettings['eq']['bands'][number]>): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    eq: {
      ...current.eq,
      bands: current.eq.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band))
    }
  }));
}

function updateMasterStereoEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, enabled: boolean): void {
  updateMasterProcessing(setDraftSettings, (current) => ({ ...current, stereoEnhancer: { ...current.stereoEnhancer, enabled } }));
}

function updateMasterStereoAmount(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    stereoEnhancer: { ...current.stereoEnhancer, amount: clampUiNumber(value, 0, 2, DEFAULT_EXPORT_MASTER_PROCESSING.stereoEnhancer.amount) }
  }));
}

function updateMasterLimiterEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, enabled: boolean): void {
  updateMasterProcessing(setDraftSettings, (current) => ({ ...current, limiter: { ...current.limiter, enabled } }));
}

function updateMasterLimiterLevel(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    limiter: { ...current.limiter, levelOutDb: clampUiNumber(value, -24, 0, DEFAULT_EXPORT_MASTER_PROCESSING.limiter.levelOutDb) }
  }));
}

function updateColorManagement(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, patch: Partial<NonNullable<ExportPresetSettings['colorManagement']>>): void {
  setDraftSettings((current) => ({ ...current, colorManagement: { ...normalizeExportColorManagement(current.colorManagement), ...patch } }));
}

function updatePostExportScriptCommand(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, command: string): void {
  setDraftSettings((current) => ({ ...current, postExportScript: normalizeExportPostScript({ command }) }));
}

function updateTimecodeBurnInEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, timecodeBurnIn: checked ? timecodeBurnInFrom(current.timecodeBurnIn) : null }));
}

function updateTimecodeBurnInPosition(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  const position = isWatermarkPosition(value) ? value : DEFAULT_TIMECODE_BURN_IN.position;
  setDraftSettings((current) => ({ ...current, timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), position } }));
}

function updateTimecodeBurnInFontSize(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), fontSize: Math.round(clampUiNumber(value, 8, 96, DEFAULT_TIMECODE_BURN_IN.fontSize)) }
  }));
}

function updateTimecodeBurnInColor(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, key: 'color' | 'backgroundColor', value: string): void {
  const fallback = key === 'color' ? DEFAULT_TIMECODE_BURN_IN.color : DEFAULT_TIMECODE_BURN_IN.backgroundColor;
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), [key]: normalizeHexColor(value, fallback) }
  }));
}

function updateTimecodeBurnInFrameNumber(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), includeFrameNumber: checked } }));
}

function updateSlateEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, slate: checked ? { enabled: true } : null }));
}

function updateWatermarkEnabled(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, checked: boolean): void {
  setDraftSettings((current) => ({ ...current, watermark: checked ? enableWatermark(current.watermark) : null }));
}

function updateWatermarkType(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: value === 'image' ? imageWatermarkFrom(current.watermark) : textWatermarkFrom(current.watermark)
  }));
}

function updateWatermarkPosition(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  const position = isWatermarkPosition(value) ? value : 'bottom-right';
  setDraftSettings((current) => {
    const watermark = enableWatermark(current.watermark);
    return { ...current, watermark: { ...watermark, position } };
  });
}

function updateImageWatermarkPath(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, path: string): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...imageWatermarkFrom(current.watermark), path } }));
}

function updateImageWatermarkScale(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...imageWatermarkFrom(current.watermark), scalePercent: clampUiNumber(value, 1, 50, 12) }
  }));
}

function updateImageWatermarkOpacity(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...imageWatermarkFrom(current.watermark), opacity: clampUiNumber(value, 0, 1, 0.75) }
  }));
}

function updateTextWatermarkText(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...textWatermarkFrom(current.watermark), text: value } }));
}

function updateTextWatermarkFont(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...textWatermarkFrom(current.watermark), fontFamily: value } }));
}

function updateTextWatermarkColor(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...textWatermarkFrom(current.watermark), color: value } }));
}

function updateTextWatermarkSize(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...textWatermarkFrom(current.watermark), fontSize: Math.round(clampUiNumber(value, 8, 240, 36)) }
  }));
}

function enableWatermark(watermark: ExportPresetSettings['watermark']): NonNullable<ExportPresetSettings['watermark']> {
  if (watermark?.type === 'image') {
    return imageWatermarkFrom(watermark);
  }
  return textWatermarkFrom(watermark);
}

function imageWatermarkFrom(watermark: ExportPresetSettings['watermark']): NonNullable<ExportPresetSettings['watermark']> & { type: 'image' } {
  if (watermark?.type === 'image') {
    return { ...watermark, enabled: true, position: normalizeWatermarkPosition(watermark.position) };
  }
  return {
    enabled: true,
    type: 'image',
    path: '',
    position: normalizeWatermarkPosition(watermark?.position),
    scalePercent: 12,
    opacity: 0.75
  };
}

function textWatermarkFrom(watermark: ExportPresetSettings['watermark']): NonNullable<ExportPresetSettings['watermark']> & { type: 'text' } {
  if (watermark?.type === 'text') {
    return { ...watermark, enabled: true, position: normalizeWatermarkPosition(watermark.position) };
  }
  return {
    enabled: true,
    type: 'text',
    text: zhCN.exportDialog.watermark.defaultText,
    fontFamily: 'Arial',
    color: '#ffffff',
    fontSize: 36,
    position: normalizeWatermarkPosition(watermark?.position)
  };
}

function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition {
  return typeof position === 'string' && isWatermarkPosition(position) ? position : 'bottom-right';
}

function isWatermarkPosition(value: string): value is ExportWatermarkPosition {
  return WATERMARK_POSITIONS.includes(value as ExportWatermarkPosition);
}

function clampUiNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeLoudnessNormalization(value: unknown): ExportLoudnessNormalization {
  return value === 'youtube' || value === 'ebu-r128' ? value : 'off';
}

function timecodeBurnInFrom(value: ExportPresetSettings['timecodeBurnIn']): NonNullable<ExportPresetSettings['timecodeBurnIn']> {
  if (value?.enabled) {
    const normalized = normalizeTimecodeBurnInDraft(value) ?? DEFAULT_TIMECODE_BURN_IN;
    return {
      ...DEFAULT_TIMECODE_BURN_IN,
      ...normalized,
      enabled: true
    };
  }
  return { ...DEFAULT_TIMECODE_BURN_IN };
}

function normalizeSubtitleFormat(value: unknown): ExportSubtitleFormat {
  return value === 'vtt' || value === 'ass' || value === 'ssa' ? value : 'srt';
}

function supportsLoudnessNormalization(format: string, outputMode: ExportPresetSettings['outputMode']): boolean {
  if (outputMode === 'audio' || format === 'm4a') {
    return true;
  }
  return format !== 'gif' && format !== 'webp' && format !== 'apng' && format !== 'png-sequence';
}

function countSpatialDenoiseClips(project: Project): number {
  return project.timeline.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => (clip.type === 'video' || clip.type === 'nested-sequence') && normalizeVideoRestoration(clip.videoRestoration).spatialDenoise.enabled).length;
}

function safePresetPackageFileName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'open-factory-presets';
}

function choosePresetPackageConflictMode(packageNames: string[], existingPresets: ExportPreset[]): ExportPresetImportConflictMode | undefined {
  const existing = new Set(existingPresets.map((preset) => preset.name.toLowerCase()));
  const conflictName = packageNames.find((name) => existing.has(name.toLowerCase()));
  if (!conflictName) {
    return 'rename';
  }
  const response = window.prompt(zhCN.exportDialog.presetPackageConflictPrompt(conflictName), 'rename')?.trim().toLowerCase();
  if (!response) {
    return undefined;
  }
  return response === 'overwrite' || response === 'skip' || response === 'rename' ? response : 'rename';
}

function collectSubtitleLanguageOptions(project: Project): SubtitleLanguageOption[] {
  const counts = new Map<string, number>();
  for (const track of project.timeline.tracks) {
    if (track.type !== 'subtitle' || track.clips.length === 0) {
      continue;
    }
    const language = normalizeSubtitleLanguage(track.language);
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([language, trackCount]) => ({
      language,
      label: formatSubtitleLanguageLabel(language),
      trackCount
    }));
}

function MasterProcessingSection({
  masterProcessing,
  loudnessNormalization,
  loudnessNormalizationEligible,
  setDraftSettings
}: {
  masterProcessing: ExportPresetSettings['masterProcessing'];
  loudnessNormalization: ExportLoudnessNormalization;
  loudnessNormalizationEligible: boolean;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.masterProcessing;
  const master = normalizeExportMasterProcessing(masterProcessing);
  const active = hasExportMasterProcessing(master) || loudnessNormalization !== 'off';
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-master-processing-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-master-processing-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{active ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <div className="grid gap-3 md:grid-cols-3">
          <PresetCheckboxField label={t.eqEnabled} checked={master.eq.enabled} onChange={(checked) => updateMasterEqEnabled(setDraftSettings, checked)} testId="export-master-eq-toggle" />
          <PresetCheckboxField label={t.stereoEnabled} checked={master.stereoEnhancer.enabled} onChange={(checked) => updateMasterStereoEnabled(setDraftSettings, checked)} testId="export-master-stereo-toggle" />
          <PresetCheckboxField label={t.limiterEnabled} checked={master.limiter.enabled} onChange={(checked) => updateMasterLimiterEnabled(setDraftSettings, checked)} testId="export-master-limiter-toggle" />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <PresetSelectField
            label={t.loudnessNormalization}
            value={loudnessNormalization}
            disabled={!loudnessNormalizationEligible}
            onChange={(value) => updateLoudnessNormalization(setDraftSettings, value)}
            testId="export-loudness-normalization-select"
            options={['off', 'youtube', 'ebu-r128']}
          />
          <WatermarkNumberField
            label={t.stereoAmount}
            value={master.stereoEnhancer.amount}
            min={0}
            max={2}
            step={0.05}
            disabled={!master.stereoEnhancer.enabled}
            testId="export-master-stereo-amount"
            onChange={(value) => updateMasterStereoAmount(setDraftSettings, value)}
          />
          <WatermarkNumberField
            label={t.limiterLevel}
            value={master.limiter.levelOutDb}
            min={-24}
            max={0}
            step={0.1}
            disabled={!master.limiter.enabled}
            testId="export-master-limiter-level"
            onChange={(value) => updateMasterLimiterLevel(setDraftSettings, value)}
          />
        </div>
        <div className="overflow-hidden rounded-md border border-line" data-testid="export-master-eq-bands">
          <div className="grid grid-cols-[86px_1fr_72px_64px] gap-2 border-b border-line bg-panel px-2 py-1 text-[11px] font-semibold text-slate-500">
            <span>{t.band}</span>
            <span>{t.gain}</span>
            <span>{t.frequency}</span>
            <span>{t.q}</span>
          </div>
          {master.eq.bands.map((band, index) => (
            <div key={band.id} className="grid grid-cols-[86px_1fr_72px_64px] items-center gap-2 border-b border-line px-2 py-1 last:border-b-0" data-testid="export-master-eq-band">
              <div className="truncate font-medium text-slate-600" title={t.bandName(index, band.frequency)}>
                {t.bandName(index, band.frequency)}
              </div>
              <input
                className="min-w-0 accent-brand"
                type="range"
                min={-24}
                max={24}
                step={0.5}
                value={band.gain}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-gain-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { gain: Number(event.target.value) })}
              />
              <input
                className="h-7 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums disabled:bg-slate-100"
                type="number"
                min={20}
                max={20000}
                step={1}
                value={band.frequency}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-frequency-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { frequency: Number(event.target.value) })}
              />
              <input
                className="h-7 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums disabled:bg-slate-100"
                type="number"
                min={0.1}
                max={4}
                step={0.1}
                value={band.q}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-q-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { q: Number(event.target.value) })}
              />
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function SubtitleLanguageSection({
  options,
  selectedLanguages,
  burnInLanguage,
  setDraftSettings
}: {
  options: SubtitleLanguageOption[];
  selectedLanguages?: string[];
  burnInLanguage?: string | null;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const selected = normalizeSubtitleLanguageList(selectedLanguages);
  const enabledLanguages = selected ? new Set(selected) : new Set(options.map((option) => option.language));
  const activeBurnInLanguage = burnInLanguage ? normalizeSubtitleLanguage(burnInLanguage) : options[0]?.language ?? 'zh';
  const t = zhCN.exportDialog.subtitleLanguages;
  return (
    <section className="rounded-md border border-line p-3 text-xs" data-testid="export-subtitle-language-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-700">{t.title}</div>
          <div className="mt-0.5 text-slate-500">{t.description}</div>
        </div>
        <label className="flex items-center gap-2 text-slate-600">
          <span>{t.burnInLanguage}</span>
          <select
            className="rounded-md border border-line px-2 py-1"
            value={activeBurnInLanguage}
            data-testid="export-subtitle-burn-language-select"
            onChange={(event) => updateSubtitleBurnInLanguage(setDraftSettings, event.target.value)}
          >
            {options.map((option) => (
              <option key={option.language} value={option.language}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.language} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-slate-700">
            <input
              type="checkbox"
              checked={enabledLanguages.has(option.language)}
              onChange={(event) => updateSubtitleLanguageSelection(setDraftSettings, option.language, event.currentTarget.checked, options)}
              data-testid={`export-subtitle-language-${option.language}`}
            />
            <span>{option.label}</span>
            <span className="text-slate-500">{t.trackCount(option.trackCount)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function formatSubtitleLanguageLabel(language: string): string {
  const normalized = normalizeSubtitleLanguage(language);
  const labels = zhCN.exportDialog.subtitleLanguages.labels as Record<string, string>;
  return labels[normalized] ?? normalized.toUpperCase();
}

function ColorManagementSection({
  colorManagement,
  setDraftSettings
}: {
  colorManagement: ExportPresetSettings['colorManagement'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.colorManagement;
  const normalized = normalizeExportColorManagement(colorManagement);
  const active = normalized.inputColorSpace !== 'srgb' || normalized.outputColorSpace !== 'srgb' || normalized.embedIccProfile === false;
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-color-management-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-color-management-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{active ? t.custom : t.default}</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PresetSelectField
          label={t.inputColorSpace}
          value={normalized.inputColorSpace}
          onChange={(value) => updateColorManagement(setDraftSettings, { inputColorSpace: value as ExportColorSpace })}
          options={[...EXPORT_COLOR_SPACES]}
          testId="export-input-color-space-select"
        />
        <PresetSelectField
          label={t.outputColorSpace}
          value={normalized.outputColorSpace}
          onChange={(value) => updateColorManagement(setDraftSettings, { outputColorSpace: value as ExportColorSpace })}
          options={[...EXPORT_COLOR_SPACES]}
          testId="export-output-color-space-select"
        />
        <PresetCheckboxField
          label={t.embedIccProfile}
          checked={normalized.embedIccProfile}
          onChange={(checked) => updateColorManagement(setDraftSettings, { embedIccProfile: checked })}
          testId="export-embed-icc-toggle"
        />
      </div>
    </details>
  );
}

function AudioVisualizationSection({
  visualization,
  setDraftSettings,
  onChooseImage
}: {
  visualization: NonNullable<ExportPresetSettings['audioVisualization']>;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onChooseImage(): void;
}) {
  const t = zhCN.exportDialog.audioVisualization;
  const [customThemes, setCustomThemes] = useState<CustomAudioVisualizationTheme[]>([]);
  const [customThemeName, setCustomThemeName] = useState('');
  const background = visualization.background;
  const backgroundType = background.type;
  const backgroundColor = background.type === 'image' ? '#050816' : background.color;
  const backgroundColor2 = background.type === 'gradient' ? background.color2 : '#1d4ed8';
  const backgroundPath = background.type === 'image' ? background.path : '';
  const selectedThemeId = visualization.themeId ?? MANUAL_AUDIO_VISUALIZATION_THEME_ID;
  const themeOptions = useMemo(() => [...BUILTIN_AUDIO_VISUALIZATION_THEMES, ...customThemes], [customThemes]);

  useEffect(() => {
    let canceled = false;
    void readAudioVisualizationThemeSettings()
      .then((settings) => {
        if (!canceled) {
          setCustomThemes(settings.customThemes);
        }
      })
      .catch(() => {
        if (!canceled) {
          setCustomThemes([]);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const saveCurrentTheme = async () => {
    try {
      const name = customThemeName.trim() || `${t.customThemes} ${customThemes.length + 1}`;
      const expanded = expandAudioVisualizationTheme({
        themeId: visualization.themeId,
        theme: visualization.theme,
        color: visualization.color,
        background: visualization.background.type === 'image' ? undefined : visualization.background
      });
      const nextThemes = upsertCustomAudioVisualizationTheme(customThemes, {
        id: name,
        name,
        colorStart: expanded.colorStart,
        colorEnd: expanded.colorEnd,
        background: expanded.background,
        glow: expanded.glow,
        glowColor: expanded.glowColor,
        glowStrength: expanded.glowStrength,
        particles: expanded.particles,
        particleColor: expanded.particleColor,
        border: expanded.border,
        borderColor: expanded.borderColor,
        borderWidth: expanded.borderWidth
      });
      const saved = await saveAudioVisualizationThemeSettings({ customThemes: nextThemes });
      setCustomThemes(saved.customThemes);
      const savedTheme = saved.customThemes.find((theme) => theme.id === nextThemes.at(-1)?.id);
      if (savedTheme) {
        updateAudioVisualizationTheme(setDraftSettings, savedTheme, saved.customThemes);
      }
      setCustomThemeName('');
    } catch (error) {
      showToast({ kind: 'warning', title: t.saveThemeFailed, message: error instanceof Error ? error.message : t.saveThemeFailed });
    }
  };

  const deleteCustomTheme = async (themeId: string) => {
    const nextThemes = removeCustomAudioVisualizationTheme(customThemes, themeId);
    const saved = await saveAudioVisualizationThemeSettings({ customThemes: nextThemes });
    setCustomThemes(saved.customThemes);
    if (selectedThemeId === themeId) {
      updateAudioVisualizationTheme(setDraftSettings, undefined, saved.customThemes);
    }
  };

  return (
    <section className="rounded-md border border-line p-3" data-testid="export-audio-viz-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-700">{t.title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="text-xs font-semibold text-slate-700">{t.theme}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="export-audio-viz-theme-grid">
          <ThemePreviewButton
            label={t.manualTheme}
            selected={selectedThemeId === MANUAL_AUDIO_VISUALIZATION_THEME_ID}
            source={{ color: visualization.color, background: backgroundType === 'image' ? undefined : background }}
            style={visualization.style}
            testId="export-audio-viz-theme-manual"
            onSelect={() => updateAudioVisualizationTheme(setDraftSettings, undefined, customThemes)}
          />
          {themeOptions.map((theme) => (
            <ThemePreviewButton
              key={theme.id}
              label={theme.name}
              selected={selectedThemeId === theme.id}
              source={{ themeId: theme.id, theme: customThemes.some((item) => item.id === theme.id) ? theme : undefined }}
              style={visualization.style}
              testId={`export-audio-viz-theme-${theme.id}`}
              onSelect={() => updateAudioVisualizationTheme(setDraftSettings, theme, customThemes)}
              action={
                customThemes.some((item) => item.id === theme.id) ? (
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    type="button"
                    title={t.deleteTheme}
                    aria-label={t.deleteTheme}
                    data-testid={`export-audio-viz-theme-delete-${theme.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteCustomTheme(theme.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-48 flex-1 rounded-md border border-line px-2 py-1.5 text-xs"
            value={customThemeName}
            placeholder={t.customThemeName}
            data-testid="export-audio-viz-custom-theme-name"
            onChange={(event) => setCustomThemeName(event.target.value)}
          />
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-panel"
            type="button"
            data-testid="export-audio-viz-save-theme"
            onClick={() => void saveCurrentTheme()}
          >
            <Save size={13} />
            {t.saveCustomTheme}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <PresetSelectField
          label={t.style}
          value={visualization.style}
          onChange={(value) => updateAudioVisualizationStyle(setDraftSettings, value)}
          options={[...AUDIO_VISUALIZATION_STYLES]}
          testId="export-audio-viz-style-select"
        />
        <PresetColorField
          label={t.color}
          value={visualization.color}
          onChange={(value) => updateAudioVisualizationColor(setDraftSettings, value)}
          testId="export-audio-viz-color-input"
        />
        <PresetSelectField
          label={t.backgroundType}
          value={backgroundType}
          onChange={(value) => updateAudioVisualizationBackgroundType(setDraftSettings, value)}
          options={[...AUDIO_VISUALIZATION_BACKGROUND_TYPES]}
          testId="export-audio-viz-background-select"
        />
        {backgroundType === 'image' ? (
          <div className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2">
            <span>{t.backgroundImage}</span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5"
                value={backgroundPath}
                onChange={(event) => updateAudioVisualizationBackgroundImagePath(setDraftSettings, event.target.value)}
                data-testid="export-audio-viz-background-image-input"
              />
              <button className="rounded-md border border-line px-2 py-1.5 text-xs font-medium hover:bg-panel" type="button" data-testid="export-audio-viz-background-image-button" onClick={onChooseImage}>
                {t.chooseImage}
              </button>
            </div>
          </div>
        ) : (
          <>
            <PresetColorField
              label={t.backgroundColor}
              value={backgroundColor}
              onChange={(value) => updateAudioVisualizationBackgroundColor(setDraftSettings, 'color', value)}
              testId="export-audio-viz-background-color-input"
            />
            {backgroundType === 'gradient' ? (
              <PresetColorField
                label={t.backgroundColor2}
                value={backgroundColor2}
                onChange={(value) => updateAudioVisualizationBackgroundColor(setDraftSettings, 'color2', value)}
                testId="export-audio-viz-background-color2-input"
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ThemePreviewButton({
  label,
  selected,
  source,
  style,
  testId,
  action,
  onSelect
}: {
  label: string;
  selected: boolean;
  source: Parameters<typeof drawAudioVisualizationThemePreviewFrame>[1];
  style: ExportAudioVisualizationStyle;
  testId: string;
  action?: ReactNode;
  onSelect(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    drawAudioVisualizationThemePreviewFrame(context, source, style, canvas.width, canvas.height);
  }, [source, style]);

  return (
    <div className="relative">
      <button
        className={`w-full overflow-hidden rounded-md border text-left transition ${selected ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-slate-400'}`}
        type="button"
        data-testid={testId}
        onClick={onSelect}
      >
        <canvas ref={canvasRef} className="block aspect-[16/9] w-full bg-slate-950" width={192} height={108} aria-hidden="true" />
        <span className="block truncate bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">{label}</span>
      </button>
      {action ? <div className="absolute right-1 top-1">{action}</div> : null}
    </div>
  );
}

function MonitoringSection({
  timecodeBurnIn,
  slate,
  setDraftSettings
}: {
  timecodeBurnIn: ExportPresetSettings['timecodeBurnIn'];
  slate: ExportPresetSettings['slate'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.monitoring;
  const positionLabels = zhCN.exportDialog.watermark.positions;
  const enabled = timecodeBurnIn?.enabled === true;
  const timecode = enabled ? timecodeBurnInFrom(timecodeBurnIn) : { ...DEFAULT_TIMECODE_BURN_IN };
  const slateEnabled = slate?.enabled === true;

  return (
    <details className="rounded-md border border-line p-3" data-testid="export-monitoring-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-monitoring-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled || slateEnabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PresetCheckboxField label={t.timecodeEnabled} checked={enabled} onChange={(checked) => updateTimecodeBurnInEnabled(setDraftSettings, checked)} testId="export-timecode-toggle" />
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>{t.timecodePosition}</span>
          <select
            className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
            value={timecode.position}
            disabled={!enabled}
            onChange={(event) => updateTimecodeBurnInPosition(setDraftSettings, event.target.value)}
            data-testid="export-timecode-position-select"
          >
            {WATERMARK_POSITIONS.map((option) => (
              <option key={option} value={option}>
                {positionLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <WatermarkNumberField
          label={t.timecodeFontSize}
          value={timecode.fontSize}
          min={8}
          max={96}
          step={1}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInFontSize(setDraftSettings, value)}
          testId="export-timecode-font-size"
        />
        <PresetColorField
          label={t.timecodeColor}
          value={timecode.color}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInColor(setDraftSettings, 'color', value)}
          testId="export-timecode-color"
        />
        <PresetColorField
          label={t.timecodeBackgroundColor}
          value={timecode.backgroundColor}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInColor(setDraftSettings, 'backgroundColor', value)}
          testId="export-timecode-background-color"
        />
        <PresetCheckboxField
          label={t.includeFrameNumber}
          checked={timecode.includeFrameNumber}
          disabled={!enabled}
          onChange={(checked) => updateTimecodeBurnInFrameNumber(setDraftSettings, checked)}
          testId="export-timecode-frame-number-toggle"
        />
        <PresetCheckboxField label={t.slateEnabled} checked={slateEnabled} onChange={(checked) => updateSlateEnabled(setDraftSettings, checked)} testId="export-slate-toggle" />
      </div>
    </details>
  );
}

function PostExportScriptSection({
  script,
  acknowledged,
  setDraftSettings,
  onAcknowledgedChange
}: {
  script: ExportPresetSettings['postExportScript'];
  acknowledged: boolean;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onAcknowledgedChange(checked: boolean): void;
}) {
  const t = zhCN.exportDialog.postExportScript;
  const command = script?.command ?? '';
  const enabled = command.trim().length > 0;
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-post-script-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-post-script-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled ? t.enabled : t.disabled}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          <span>{t.command}</span>
          <input
            className="w-full rounded-md border border-line px-2 py-1.5 font-mono text-xs"
            placeholder={t.placeholder}
            value={command}
            onChange={(event) => updatePostExportScriptCommand(setDraftSettings, event.target.value)}
            data-testid="export-post-script-command-input"
          />
        </label>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" data-testid="export-post-script-warning">
          <label className="flex items-start gap-2">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange(event.target.checked)}
              data-testid="export-post-script-ack-toggle"
            />
            <span>
              <span className="block font-semibold">{t.securityTitle}</span>
              <span className="mt-1 block">{t.securityMessage}</span>
            </span>
          </label>
        </div>
        <div className="text-[11px] leading-4 text-slate-500" data-testid="export-post-script-variables">
          {t.variables}
        </div>
      </div>
    </details>
  );
}

function WatermarkSection({
  watermark,
  setDraftSettings,
  onChooseImage
}: {
  watermark: ExportPresetSettings['watermark'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onChooseImage(): void;
}) {
  const t = zhCN.exportDialog.watermark;
  const enabled = watermark?.enabled === true;
  const type = watermark?.type ?? 'text';
  const position = normalizeWatermarkPosition(watermark?.position);
  const imageWatermark = watermark?.type === 'image' ? watermark : imageWatermarkFrom(watermark);
  const textWatermark = watermark?.type === 'text' ? watermark : textWatermarkFrom(watermark);

  return (
    <details className="rounded-md border border-line p-3" data-testid="export-watermark-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-watermark-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
          <PresetCheckboxField label={t.enabled} checked={enabled} onChange={(checked) => updateWatermarkEnabled(setDraftSettings, checked)} testId="export-watermark-enabled-toggle" />
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>{t.type}</span>
            <select
              className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
              value={type}
              disabled={!enabled}
              onChange={(event) => updateWatermarkType(setDraftSettings, event.target.value)}
              data-testid="export-watermark-type-select"
            >
              <option value="text">{t.types.text}</option>
              <option value="image">{t.types.image}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>{t.position}</span>
            <select
              className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
              value={position}
              disabled={!enabled}
              onChange={(event) => updateWatermarkPosition(setDraftSettings, event.target.value)}
              data-testid="export-watermark-position-select"
            >
              {WATERMARK_POSITIONS.map((option) => (
                <option key={option} value={option}>
                  {t.positions[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {type === 'image' ? (
          <div className="grid gap-3 md:grid-cols-[1fr_120px_120px]">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>{t.imagePath}</span>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
                  value={imageWatermark.path}
                  disabled={!enabled}
                  onChange={(event) => updateImageWatermarkPath(setDraftSettings, event.target.value)}
                  data-testid="export-image-watermark-path-input"
                />
                <button
                  className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                  title={t.chooseImage}
                  type="button"
                  disabled={!enabled}
                  onClick={onChooseImage}
                  data-testid="export-image-watermark-choose-button"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </label>
            <WatermarkNumberField label={t.scalePercent} value={imageWatermark.scalePercent} min={1} max={50} step={1} disabled={!enabled} testId="export-image-watermark-scale-input" onChange={(value) => updateImageWatermarkScale(setDraftSettings, value)} />
            <WatermarkNumberField label={t.opacity} value={imageWatermark.opacity} min={0} max={1} step={0.05} disabled={!enabled} testId="export-image-watermark-opacity-input" onChange={(value) => updateImageWatermarkOpacity(setDraftSettings, value)} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_150px_110px_110px]">
            <PresetTextField label={t.text} value={textWatermark.text} disabled={!enabled} onChange={(value) => updateTextWatermarkText(setDraftSettings, value)} testId="export-text-watermark-input" />
            <PresetTextField label={t.fontFamily} value={textWatermark.fontFamily} disabled={!enabled} onChange={(value) => updateTextWatermarkFont(setDraftSettings, value)} testId="export-text-watermark-font-input" />
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>{t.color}</span>
              <input
                className="h-[34px] w-full rounded-md border border-line px-1 py-1 disabled:bg-slate-100"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(textWatermark.color) ? textWatermark.color : '#ffffff'}
                disabled={!enabled}
                onChange={(event) => updateTextWatermarkColor(setDraftSettings, event.target.value)}
                data-testid="export-text-watermark-color-input"
              />
            </label>
            <WatermarkNumberField label={t.fontSize} value={textWatermark.fontSize} min={8} max={240} step={1} disabled={!enabled} testId="export-text-watermark-size-input" onChange={(value) => updateTextWatermarkSize(setDraftSettings, value)} />
          </div>
        )}
      </div>
    </details>
  );
}

function WatermarkNumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input
        className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

function PresetNumberField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value?: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="number" min={1} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

function PresetFpsField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value?: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <select
        className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
        value={String(normalizeProjectFps(value))}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      >
        {SUPPORTED_PROJECT_FPS.map((fps) => (
          <option key={fps} value={fps}>
            {formatFpsOption(fps)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PresetTextField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

function formatFpsOption(fps: number): string {
  return `${Number.isInteger(fps) ? fps.toFixed(0) : fps.toFixed(3)} fps`;
}

function PresetColorField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="h-[34px] w-full rounded-md border border-line px-1 py-1 disabled:bg-slate-100" type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

function PresetSelectField({
  label,
  value,
  disabled,
  onChange,
  options,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  options: string[];
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <select className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PresetCheckboxField({
  label,
  checked,
  disabled,
  onChange,
  testId
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
  testId: string;
}) {
  return (
    <label className={`flex min-h-[58px] items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-600 ${disabled ? 'bg-slate-100 opacity-70' : ''}`}>
      <input className="h-4 w-4 accent-brand" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} data-testid={testId} />
      <span>{label}</span>
    </label>
  );
}

function ReframeOffsetField({
  label,
  value,
  axis,
  setDraftSettings
}: {
  label: string;
  value: number;
  axis: 'x' | 'y';
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-full accent-brand"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={value}
          onChange={(event) => updateReframeOffset(setDraftSettings, axis, event.target.value)}
          data-testid={`export-reframe-offset-${axis}`}
        />
        <span className="w-10 text-right tabular-nums">{value.toFixed(2)}</span>
      </div>
    </label>
  );
}

function ReframePreviewBox({ aspect, offsetX, offsetY }: { aspect: TargetAspectRatio; offsetX: number; offsetY: number }) {
  const normalized = normalizeTargetAspectRatio(aspect);
  const ratioClass = normalized === '9:16' ? 'aspect-[9/16]' : normalized === '1:1' ? 'aspect-square' : normalized === '4:5' ? 'aspect-[4/5]' : normalized === '21:9' ? 'aspect-[21/9]' : 'aspect-video';
  const translateX = `${clampReframeOffset(offsetX) * 18}%`;
  const translateY = `${clampReframeOffset(offsetY) * 18}%`;
  return (
    <div className="flex items-center justify-center rounded-md bg-panel p-2" data-testid="export-reframe-preview">
      <div className="relative h-24 w-full max-w-32 overflow-hidden rounded border border-line bg-slate-200">
        <div className="absolute inset-2 rounded bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600" />
        <div
          className={`absolute left-1/2 top-1/2 max-h-[88%] w-[58%] -translate-x-1/2 -translate-y-1/2 border-2 border-brand bg-brand/10 ${ratioClass}`}
          style={{ transform: `translate(calc(-50% + ${translateX}), calc(-50% + ${translateY}))` }}
        />
      </div>
    </div>
  );
}

function ExportCostEstimatePanel({ estimate, historyErrorPercent }: { estimate: ReturnType<typeof estimateExportCost>; historyErrorPercent?: number }) {
  const t = zhCN.exportDialog.costEstimate;
  return (
    <section className="rounded-md border border-line bg-panel/60 p-3 text-xs text-slate-600" data-testid="export-cost-estimate-panel">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800">{t.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{t.description}</div>
        </div>
        <div className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700" data-testid="export-cost-complexity">
          {t.complexityValue(estimate.complexityFactor)}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <CostMetric label={t.duration} value={formatCostDuration(estimate.estimatedDurationSeconds)} testId="export-cost-duration" />
        <CostMetric label={t.diskUsage} value={t.sizeValue(estimate.estimatedFileSizeMb)} testId="export-cost-size" />
        <CostMetric label={t.cpuLoad} value={formatCostCpuLoad(estimate.cpuLoad)} testId="export-cost-cpu" tone={estimate.cpuLoad === 'heavy' ? 'bad' : estimate.cpuLoad === 'medium' ? 'warn' : 'ok'} />
        <CostMetric label={t.completion} value={formatCostCompletion(estimate.estimatedCompletionIso)} testId="export-cost-completion" />
        <CostMetric label={t.historyError} value={formatCostHistoryError(historyErrorPercent)} testId="export-cost-history-error" />
      </div>
    </section>
  );
}

function ExportOptimizationPanel({
  suggestions,
  onApply,
  onDismiss
}: {
  suggestions: ExportOptimizationSuggestion[];
  onApply(suggestion: ExportOptimizationSuggestion): void;
  onDismiss(suggestion: ExportOptimizationSuggestion): void;
}) {
  const t = zhCN.exportDialog.optimization;
  return (
    <section className="rounded-md border border-line bg-white p-3 text-xs" data-testid="export-optimization-panel">
      <div className="mb-2 flex items-start justify-between gap-3" data-testid="export-optimization-tab">
        <div>
          <div className="font-semibold text-slate-800">{t.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{t.description}</div>
        </div>
        <span className="rounded-full bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600" data-testid="export-optimization-count">{suggestions.length}</span>
      </div>
      {suggestions.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-panel/50 px-3 py-3 text-center text-slate-500" data-testid="export-optimization-empty">{t.empty}</div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id}
              className={`rounded-md border p-3 ${suggestion.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}
              data-testid={`export-optimization-suggestion-${suggestion.id}`}
              data-suggestion-id={suggestion.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800">{formatOptimizationSuggestionTitle(suggestion)}</div>
                  <div className="mt-1 text-slate-600">{formatOptimizationSuggestionMessage(suggestion)}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="rounded-md bg-brand px-2 py-1.5 font-semibold text-white hover:bg-[#176858]"
                    type="button"
                    data-testid={`apply-export-suggestion-${suggestion.id}`}
                    onClick={() => onApply(suggestion)}
                  >
                    {t.apply}
                  </button>
                  <button
                    className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid={`dismiss-export-suggestion-${suggestion.id}`}
                    onClick={() => onDismiss(suggestion)}
                  >
                    {t.dismiss}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatOptimizationSuggestionTitle(suggestion: ExportOptimizationSuggestion): string {
  return zhCN.exportDialog.optimization.suggestions[suggestion.id].title;
}

function formatOptimizationSuggestionMessage(suggestion: ExportOptimizationSuggestion): string {
  const messages = zhCN.exportDialog.optimization.suggestions;
  if (suggestion.id === 'proxy-for-4k-downscale') {
    return messages[suggestion.id].message(Math.max(1, suggestion.mediaIds.length));
  }
  if (suggestion.id === 'unify-frame-rate') {
    return messages[suggestion.id].message(suggestion.value ?? 0, suggestion.targetValue ?? 0);
  }
  if (suggestion.id === 'normalize-loudness') {
    return messages[suggestion.id].message(suggestion.value ?? 0);
  }
  if (suggestion.id === 'convert-vfr-to-cfr') {
    return messages[suggestion.id].message(Math.max(1, suggestion.mediaIds.length));
  }
  return messages[suggestion.id].message((suggestion.value ?? 0) / 60);
}

function CostMetric({ label, value, testId, tone }: { label: string; value: string; testId: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-slate-800';
  return (
    <div className="rounded-md bg-white px-2 py-2" data-testid={testId}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function ExportWarmupStatusPanel({ status }: { status: ExportWarmupUiStatus }) {
  const t = zhCN.exportDialog.warmup;
  const label = status.step ? t.steps[status.step] : undefined;
  const message = status.status === 'running' ? t.running(label ?? '') : status.status === 'cached' ? t.cached : t.complete;
  return (
    <section
      className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"
      data-testid="export-warmup-status"
      data-status={status.status}
      data-step={status.step ?? ''}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{t.title}</div>
          <div className="mt-1">{message}</div>
        </div>
        {status.status === 'running' ? <Loader2 className="shrink-0 animate-spin" size={16} /> : null}
      </div>
      {status.status === 'running' ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      ) : null}
    </section>
  );
}

function PreflightPanel({
  issues,
  onDismiss,
  onContinue,
  onRelink
}: {
  issues: PreflightResult[];
  onDismiss(): void;
  onContinue(): void;
  onRelink?: () => void;
}) {
  const hasBlocking = issues.some((issue) => issue.severity === 'blocking');
  const hasMissingMedia = issues.some((issue) => issue.type === 'missing-media');
  return (
    <section className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950" data-testid="export-preflight-panel">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{hasBlocking ? zhCN.exportDialog.preflight.blockedTitle : zhCN.exportDialog.preflight.warningTitle}</div>
          <div className="mt-1 text-amber-900">{hasBlocking ? zhCN.exportDialog.preflight.blockedMessage : zhCN.exportDialog.preflight.warningMessage}</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {issues.map((issue) => (
          <div key={issue.id} className="rounded border border-amber-200 bg-white/70 p-2" data-testid="export-preflight-issue" data-severity={issue.severity} data-type={issue.type}>
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${issue.severity === 'blocking' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                {zhCN.exportDialog.preflight.severity[issue.severity]}
              </span>
              <span className="font-semibold text-slate-800">{formatPreflightTitle(issue)}</span>
            </div>
            <div className="mt-1 text-slate-600">{formatPreflightMessage(issue)}</div>
            {issue.items.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                {issue.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hasMissingMedia && onRelink ? (
          <button className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel" type="button" data-testid="export-preflight-relink-button" onClick={onRelink}>
            {zhCN.exportDialog.preflight.relink}
          </button>
        ) : null}
        <button className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel" type="button" data-testid="export-preflight-dismiss-button" onClick={onDismiss}>
          {zhCN.common.close}
        </button>
        {!hasBlocking ? (
          <button className="rounded-md bg-brand px-2 py-1.5 font-medium text-white hover:bg-[#176858]" type="button" data-testid="export-preflight-continue-button" onClick={onContinue}>
            {zhCN.exportDialog.preflight.continue}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatPreflightTitle(issue: PreflightResult): string {
  return zhCN.exportDialog.preflight.issueTitle[issue.type];
}

function formatPreflightMessage(issue: PreflightResult): string {
  if (issue.type === 'missing-media') {
    return zhCN.exportDialog.preflight.missingMediaMessage(issue.items.length);
  }
  if (issue.type === 'missing-font') {
    return zhCN.exportDialog.preflight.missingFontMessage(issue.items.length);
  }
  if (issue.type === 'whisper-path') {
    return issue.items[0] ?? zhCN.exportDialog.preflight.whisperMessage;
  }
  if (issue.type === 'platform-duration') {
    return zhCN.exportDialog.preflight.platformDurationMessage(formatPlatformPresetName(issue.platformPreset), formatDuration(issue.durationSeconds), formatDuration(issue.limitSeconds));
  }
  if (issue.type === 'vfr-media') {
    return zhCN.exportDialog.preflight.vfrMediaMessage(issue.items.length);
  }
  if (issue.type === 'frame-rate-mismatch') {
    return zhCN.exportDialog.preflight.frameRateMismatchMessage(issue.items.length, issue.projectFrameRate ?? 30);
  }
  return zhCN.exportDialog.preflight.ffmpegMessage;
}

function formatPlatformPresetName(platformPreset: PreflightResult['platformPreset']): string {
  if (platformPreset === 'youtube-1080p') {
    return zhCN.exportPresets.builtins.youtube1080p.name;
  }
  if (platformPreset === 'youtube-shorts') {
    return zhCN.exportPresets.builtins.youtubeShorts.name;
  }
  if (platformPreset === 'tiktok') {
    return zhCN.exportPresets.builtins.tiktok.name;
  }
  if (platformPreset === 'instagram-reels') {
    return zhCN.exportPresets.builtins.instagramReels.name;
  }
  if (platformPreset === 'twitter-x') {
    return zhCN.exportPresets.builtins.twitterX.name;
  }
  if (platformPreset === 'bilibili') {
    return zhCN.exportPresets.builtins.bilibili.name;
  }
  return zhCN.exportDialog.preset;
}

function formatDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return zhCN.common.unavailable;
  }
  return `${Math.round(value * 10) / 10}s`;
}

function formatCostDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return zhCN.common.unavailable;
  }
  if (value < 60) {
    return zhCN.exportDialog.costEstimate.durationSeconds(Math.max(1, Math.round(value)));
  }
  return zhCN.exportDialog.costEstimate.durationMinutes(Math.floor(value / 60), Math.round(value % 60));
}

function formatCostCompletion(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return zhCN.common.unavailable;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCostCpuLoad(value: ExportCostCpuLoad): string {
  return zhCN.exportDialog.costEstimate.cpuLoadValues[value];
}

function formatCostHistoryError(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? zhCN.exportDialog.costEstimate.historyErrorValue(value) : zhCN.exportDialog.costEstimate.historyUnavailable;
}

function getLastExportDurationSeconds(history: ExportTaskHistoryEntry[]): number | undefined {
  const entry = history.find((item) => item.startedAt && item.finishedAt);
  if (!entry?.startedAt || !entry.finishedAt) {
    return undefined;
  }
  const started = Date.parse(entry.startedAt);
  const finished = Date.parse(entry.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return undefined;
  }
  return (finished - started) / 1000;
}

function formatOptionLabel(value: string): string {
  if (isLoudnessNormalizationOption(value)) {
    return zhCN.exportDialog.loudnessNormalization[value];
  }
  if (value === 'video' || value === 'audio' || value === 'audio-visualization') {
    return zhCN.exportDialog.outputModes[value];
  }
  if (value === 'waveform-line' || value === 'spectrum-bars' || value === 'circular-spectrum') {
    return zhCN.exportDialog.audioVisualization.styles[value];
  }
  if (value === 'solid' || value === 'gradient' || value === 'image') {
    return zhCN.exportDialog.audioVisualization.backgroundTypes[value];
  }
  if (value === 'srgb' || value === 'rec709' || value === 'dci-p3' || value === 'display-p3' || value === 'rec2020') {
    return zhCN.exportDialog.colorManagement.colorSpaces[value];
  }
  if (value === 'default') {
    return zhCN.exportDialog.options.default;
  }
  if (value === 'burn-in') {
    return zhCN.exportDialog.options.burnIn;
  }
  if (value === 'soft-sub') {
    return zhCN.exportDialog.options.softSub;
  }
  if (value === 'srt' || value === 'vtt' || value === 'ass' || value === 'ssa') {
    return zhCN.exportDialog.subtitleFormats[value];
  }
  if (value === 'none') {
    return zhCN.exportDialog.options.none;
  }
  if (value === 'fit') {
    return zhCN.exportDialog.options.fit;
  }
  if (value === 'source') {
    return zhCN.exportDialog.options.source;
  }
  if (value === '16:9' || value === '9:16' || value === '1:1' || value === '4:5' || value === '21:9') {
    return value;
  }
  if (value === 'm4a') {
    return 'm4a';
  }
  if (value === 'png-sequence') {
    return zhCN.exportDialog.options.pngSequence;
  }
  if (value === 'gif') {
    return zhCN.exportDialog.options.gif;
  }
  if (value === 'webp') {
    return zhCN.exportDialog.options.webp;
  }
  if (value === 'apng') {
    return zhCN.exportDialog.options.apng;
  }
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isLoudnessNormalizationOption(value: string): value is ExportLoudnessNormalization {
  return value === 'off' || value === 'youtube' || value === 'ebu-r128';
}

function estimateDimensions(width: number, height: number, format: string): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (format !== 'gif') {
    return { width: safeWidth, height: safeHeight };
  }
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= 1080) {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = 1080 / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio))
  };
}

function formatExportWarning(warning: string): string {
  const textClip = warning.match(/^Text clip (.+) was skipped because FFmpeg drawtext\/libfreetype is unavailable\.$/);
  if (textClip) {
    return zhCN.exportDialog.textClipSkippedDrawtext(textClip[1]);
  }
  const transitionVisual = warning.match(/^Transition (.+) was skipped because both clips must be visual media clips\.$/);
  if (transitionVisual) {
    return zhCN.exportDialog.transitionSkippedVisualOnly(transitionVisual[1]);
  }
  const transitionChained = warning.match(/^Transition (.+) was skipped because chained transitions are not yet supported in one export segment\.$/);
  if (transitionChained) {
    return zhCN.exportDialog.transitionSkippedChained(transitionChained[1]);
  }
  const transitionMissingInput = warning.match(/^Transition (.+) was skipped because one of its clips has no media input\.$/);
  if (transitionMissingInput) {
    return zhCN.exportDialog.transitionSkippedMissingInput(transitionMissingInput[1]);
  }
  const missingMedia = warning.match(/^Clip (.+) has no media path and was skipped\.$/);
  if (missingMedia) {
    return zhCN.exportDialog.clipSkippedMissingMedia(missingMedia[1]);
  }
  const speedRampFallback = warning.match(/^Speed ramp setpts for clip (.+) exceeded 4096 characters and fell back to average speed\.$/);
  if (speedRampFallback) {
    return zhCN.exportDialog.speedRampSetptsFallback(speedRampFallback[1]);
  }
  const customShaderSlowWarning = warning.match(/^Custom shader effect for clip (.+) will render frame-by-frame and may be slow\.$/);
  if (customShaderSlowWarning) {
    return zhCN.exportDialog.customShaderSlowWarning(customShaderSlowWarning[1]);
  }
  const opticalFlowFallback = warning.match(/^Optical flow slow motion for clip (.+) fell back to blend because the current FFmpeg build did not report minterpolate support\.$/);
  if (opticalFlowFallback) {
    return zhCN.exportDialog.opticalFlowFallbackBlend(opticalFlowFallback[1]);
  }
  const slowMotionSkipped = warning.match(/^Slow motion interpolation for clip (.+) was skipped because the current FFmpeg build does not support minterpolate\.$/);
  if (slowMotionSkipped) {
    return zhCN.exportDialog.slowMotionInterpolationSkipped(slowMotionSkipped[1]);
  }
  if (warning === 'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.') {
    return zhCN.exportDialog.ffmpegDrawtextUnavailable;
  }
  if (warning === 'Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.') {
    return zhCN.exportDialog.hardwareEncodingFallback;
  }
  return warning;
}

function Info({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-700';
  return (
    <div className="rounded-md bg-panel p-2">
      <div className="text-[11px] uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`truncate font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}

function ExportUploadSection({
  settings,
  password,
  onSettingsChange,
  onPasswordChange,
  onChooseDirectory
}: {
  settings: ExportUploadSettings;
  password: string;
  onSettingsChange(settings: ExportUploadSettings): void;
  onPasswordChange(password: string): void;
  onChooseDirectory(): void;
}) {
  const t = zhCN.exportDialog.upload;
  const updateWebdav = (patch: Partial<ExportUploadSettings['webdav']>) => onSettingsChange({ ...settings, webdav: { ...settings.webdav, ...patch } });
  const updateLocal = (patch: Partial<ExportUploadSettings['local']>) => onSettingsChange({ ...settings, local: { ...settings.local, ...patch } });

  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-upload-section">
      <label className="pt-1 text-xs font-medium text-slate-600">{t.title}</label>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs text-slate-500">{t.description}</div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              className="h-4 w-4 accent-brand"
              type="checkbox"
              checked={settings.enabled}
              data-testid="export-upload-enabled"
              onChange={(event) => onSettingsChange({ ...settings, enabled: event.target.checked })}
            />
            <span>{t.enabled}</span>
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-[180px_1fr]">
          <label className="block text-xs font-medium text-slate-600">
            {t.targetType}
            <select
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
              value={settings.targetType}
              data-testid="export-upload-target-select"
              onChange={(event) => onSettingsChange({ ...settings, targetType: event.target.value as ExportUploadTargetType })}
            >
              <option value="webdav">{t.targets.webdav}</option>
              <option value="local">{t.targets.local}</option>
            </select>
          </label>
          {settings.targetType === 'webdav' ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600 md:col-span-2">
                {t.webdavUrl}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.webdav.url ?? ''}
                  data-testid="export-upload-webdav-url"
                  onChange={(event) => updateWebdav({ url: event.target.value })}
                />
                <span className="mt-1 block text-[11px] font-normal text-amber-700" data-testid="export-upload-webdav-https-warning">
                  {t.httpsRequiredNote}
                </span>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.username}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.webdav.username ?? ''}
                  data-testid="export-upload-webdav-username"
                  onChange={(event) => updateWebdav({ username: event.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.password}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  type="password"
                  value={password}
                  data-testid="export-upload-webdav-password"
                  onChange={(event) => onPasswordChange(event.target.value)}
                />
              </label>
              <div className="text-[11px] text-slate-500 md:col-span-2">{t.passwordStorageNote}</div>
            </div>
          ) : (
            <label className="block text-xs font-medium text-slate-600">
              {t.localDirectory}
              <div className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.local.directory ?? ''}
                  data-testid="export-upload-local-directory"
                  onChange={(event) => updateLocal({ directory: event.target.value })}
                />
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                  type="button"
                  title={t.chooseDirectory}
                  aria-label={t.chooseDirectory}
                  data-testid="export-upload-local-choose"
                  onClick={onChooseDirectory}
                >
                  <FolderOpen size={14} />
                </button>
              </div>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportUploadStatusPanel({ upload, onRetry }: { upload: ExportUploadState; onRetry?: () => void }) {
  const t = zhCN.exportDialog.upload;
  const progress = Math.round(upload.progress * 100);
  return (
    <div className={`mt-2 rounded-md border p-2 text-[11px] ${uploadStatusClass(upload.status)}`} data-testid="export-upload-status" data-status={upload.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">
          {t.statusLabel}: {t.status[upload.status]}
        </div>
        <div className="tabular-nums" data-testid="export-upload-progress">
          {progress}%
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full bg-current transition-all" style={{ width: `${progress}%` }} />
      </div>
      {upload.destination ? (
        <div className="mt-1 truncate font-mono" title={upload.destination} data-testid="export-upload-destination">
          {upload.destination}
        </div>
      ) : null}
      {upload.error ? <div className="mt-1 whitespace-pre-wrap text-rose-800" data-testid="export-upload-error">{upload.error}</div> : null}
      {onRetry ? (
        <button className="mt-2 rounded-md border border-line bg-white px-2 py-1 font-medium text-slate-700 hover:bg-panel" type="button" data-testid="export-upload-retry-button" onClick={onRetry}>
          {t.retry}
        </button>
      ) : null}
    </div>
  );
}

function PostExportScriptResultPanel({ result }: { result: ExportPostExportScriptResult }) {
  const t = zhCN.exportDialog.postExportScript;
  return (
    <div
      className={`mt-2 rounded-md border p-2 text-[11px] ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
      data-testid="export-post-script-result"
      data-success={String(result.success)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.resultTitle}</div>
        <div className="tabular-nums" data-testid="export-post-script-exit-code">
          {t.exitCode(result.exitCode)}
        </div>
      </div>
      <div className="mt-1 truncate font-mono" title={result.resolvedCommand} data-testid="export-post-script-resolved">
        {result.resolvedCommand}
      </div>
      {result.error ? <div className="mt-1 whitespace-pre-wrap text-amber-800" data-testid="export-post-script-error">{result.error}</div> : null}
      {result.stdout ? (
        <pre className="mt-2 max-h-20 overflow-auto rounded bg-white/70 p-2 whitespace-pre-wrap" data-testid="export-post-script-stdout">{result.stdout}</pre>
      ) : null}
      {result.stderr ? (
        <pre className="mt-2 max-h-20 overflow-auto rounded bg-white/70 p-2 whitespace-pre-wrap" data-testid="export-post-script-stderr">{result.stderr}</pre>
      ) : null}
    </div>
  );
}

function ExportRecoveryPanel({ report }: { report: ExportRecoveryReport }) {
  const t = zhCN.exportDialog.recoveryLog;
  return (
    <div
      className={`mt-2 rounded-md border p-2 text-[11px] ${report.healed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}
      data-testid="export-recovery-report"
      data-healed={String(report.healed)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.title}</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-current px-2 py-0.5 font-semibold">{report.healed ? t.healed : t.failed}</span>
          <span className="tabular-nums">{t.attempts(report.attempts)}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-1">
        {report.entries.map((entry) => (
          <div
            key={entry.attempt}
            className="rounded-md bg-white/70 p-2"
            data-testid="export-recovery-entry"
            data-kind={entry.errorKind}
            data-action={entry.action}
            data-result={entry.result}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-slate-700">
                {t.attemptLabel(entry.attempt)} · {t.errorKind[entry.errorKind]}
              </div>
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold">{t.result[entry.result]}</span>
            </div>
            <div className="mt-1 text-slate-600">{t.action[entry.action]}</div>
            <div className="mt-1 truncate font-mono text-[10px] text-slate-500" title={entry.originalError}>
              {entry.originalError}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostExportQualityAssurancePanel({ result }: { result: PostExportQualityAssuranceResult }) {
  const t = zhCN.exportDialog.postExportQuality;
  return (
    <div className={`mt-2 rounded-md border p-2 text-[11px] ${postExportQualityStatusClass(result.status)}`} data-testid="post-export-quality-result" data-status={result.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.title}</div>
        <div className="rounded-full border border-current px-2 py-0.5 font-semibold" data-testid="post-export-quality-status">
          {t.status[result.status]}
        </div>
      </div>
      {result.retryRecommended ? <div className="mt-1 font-medium text-rose-800">{t.retryRecommended}</div> : null}
      <div className="mt-2 grid gap-1">
        {result.checks.map((check) => (
          <PostExportQualityCheckRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

function PostExportQualityCheckRow({ check }: { check: PostExportQualityCheckResult }) {
  const t = zhCN.exportDialog.postExportQuality;
  return (
    <div className="rounded-md bg-white/70 p-2" data-testid={`post-export-quality-check-${check.id}`} data-status={check.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.checks[check.id]}</div>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${postExportQualityStatusClass(check.status)}`}>{t.status[check.status]}</span>
      </div>
      <div className="mt-1 text-slate-600">{check.message}</div>
      {check.expected !== undefined || check.actual !== undefined ? (
        <div className="mt-1 grid gap-1 text-[10px] text-slate-500 sm:grid-cols-2">
          {check.expected !== undefined ? <div>{t.expected}: {formatPostExportQualityValue(check, check.expected)}</div> : null}
          {check.actual !== undefined ? <div>{t.actual}: {formatPostExportQualityValue(check, check.actual)}</div> : null}
        </div>
      ) : null}
      {check.ranges?.length ? <div className="mt-1 text-[10px] text-slate-500">{t.ranges(check.ranges.length)}</div> : null}
    </div>
  );
}

function QualityResultPanel({
  result,
  running,
  progress,
  error,
  onCancel
}: {
  result?: QualityEvaluationResult;
  running: boolean;
  progress: number;
  error?: string;
  onCancel(): void;
}) {
  const t = zhCN.exportDialog.quality;
  return (
    <div className="border-t border-line p-3 text-xs" data-testid="quality-result-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-800">{t.title}</div>
        {running ? (
          <button className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 font-medium text-rose-800 hover:bg-rose-100" type="button" data-testid="quality-cancel-button" onClick={onCancel}>
            {t.cancel}
          </button>
        ) : null}
      </div>
      {running ? (
        <div className="mb-2 flex items-center gap-2" data-testid="quality-progress">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="w-20 text-right tabular-nums text-slate-500">{t.running(progress)}</div>
        </div>
      ) : null}
      {error ? <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-700">{error}</div> : null}
      {result ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <QualityMetricCell metric="ssim" value={result.ssim} />
          <QualityMetricCell metric="psnr" value={result.psnr} suffix=" dB" />
          <QualityMetricCell metric="vmaf" value={result.vmafAvailable ? result.vmaf : undefined} />
        </div>
      ) : !running && !error ? (
        <div className="text-slate-500">{t.noResult}</div>
      ) : null}
    </div>
  );
}

function QualityMetricCell({ metric, value, suffix = '' }: { metric: 'ssim' | 'psnr' | 'vmaf'; value?: number; suffix?: string }) {
  const t = zhCN.exportDialog.quality;
  const level = assessQualityMetric(metric, value);
  return (
    <div className="rounded-md bg-panel p-2" data-testid={`quality-result-${metric}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.labels[metric]}</div>
        {level ? <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${qualityLevelClass(level)}`}>{t.levels[level]}</span> : null}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatQualityMetricValue(value, suffix)}</div>
      <div className="mt-1 text-[11px] leading-4 text-slate-500">{t.descriptions[metric]}</div>
    </div>
  );
}

function formatQualityMetricValue(value: number | undefined, suffix: string): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  return `${(value as number).toFixed(suffix ? 1 : 3)}${suffix}`;
}

function formatPostExportQualityValue(check: PostExportQualityCheckResult, value: string | number): string {
  if (typeof value === 'string') {
    return value;
  }
  if (check.id === 'fileSize') {
    return formatBytes(value);
  }
  if (check.id === 'duration') {
    return `${value.toFixed(3)}s`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function formatOptionalNumber(value: number | undefined, decimals: number): string {
  return Number.isFinite(value) ? (value as number).toFixed(decimals) : zhCN.exportDialog.quality.unavailable;
}

function formatBytes(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  const bytes = value as number;
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatMilliseconds(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  const seconds = (value as number) / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function qualityLevelClass(level: QualityLevel): string {
  switch (level) {
    case 'excellent':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'average':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'poor':
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function postExportQualityStatusClass(status: 'pass' | 'warning' | 'fail'): string {
  if (status === 'pass') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

function uploadStatusClass(status: ExportUploadState['status']): string {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (status === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function ExportTaskRow({ taskId }: { taskId: string }) {
  const task = useExportQueueStore((state) => state.tasks.find((item) => item.id === taskId));
  if (!task) {
    return null;
  }
  const progress = Math.round(task.progress * 100);
  const canCancel = task.status === 'scheduled' || task.status === 'pending' || task.status === 'running';
  const progressivePreviewSrc = task.progressive ? convertLocalFileSrc(task.progressive.partialPath) : undefined;
  return (
    <div className="border-b border-line px-3 py-2 last:border-b-0" data-testid={`export-task-${task.id}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-slate-800" title={task.outputPath}>
            {task.name}
          </div>
          <div className="truncate text-[11px] text-slate-500">{task.outputPath}</div>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500" data-testid="export-task-priority">
          {priorityLabel(task.priority)}
        </span>
        <StatusPill status={task.status} />
        {task.logPath ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" data-testid="export-task-log-button" onClick={() => void openPath(task.logPath!)}>
            <FileText size={13} className="inline-block" /> {zhCN.exportDialog.viewLog}
          </button>
        ) : null}
        {task.progressive && task.status === 'running' ? (
          <button
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            data-testid="export-task-progressive-pause-button"
            onClick={() => void pauseQueuedExportTask(task.id)}
          >
            {zhCN.exportDialog.progressive.pause}
          </button>
        ) : null}
        {canCancel ? (
          <button
            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
            data-testid="export-task-cancel-button"
            onClick={() => void cancelQueuedExportTask(task.id)}
          >
            {zhCN.exportDialog.cancelTask}
          </button>
        ) : task.status === 'success' ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" onClick={() => void revealExport(task.outputPath)}>
            {zhCN.exportDialog.openFolder}
          </button>
        ) : task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted' ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" data-testid="export-task-retry-button" onClick={() => retryQueuedExportTask(task.id)}>
            {zhCN.exportDialog.retryTask}
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="w-9 text-right text-[11px] tabular-nums text-slate-500">{progress}%</div>
      </div>
      {task.progressive ? (
        <div className="mt-2 grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900" data-testid="export-progressive-state">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">{zhCN.exportDialog.progressive.partialPath}</div>
              <div className="truncate font-mono" title={task.progressive.partialPath} data-testid="export-progressive-partial-path">
                {task.progressive.partialPath}
              </div>
            </div>
            <div className="tabular-nums" data-testid="export-progressive-completed">
              {zhCN.exportDialog.progressive.completed(formatDuration(task.progressive.completedDuration))}
            </div>
          </div>
          {progressivePreviewSrc ? (
            <div className="grid gap-2 sm:grid-cols-[160px_auto] sm:items-center">
              <video className="h-20 w-40 rounded border border-emerald-200 bg-black object-contain" src={progressivePreviewSrc} controls preload="metadata" data-testid="export-progressive-preview" />
              <button className="justify-self-start rounded-md border border-emerald-300 bg-white px-2 py-1 font-medium hover:bg-emerald-100" type="button" data-testid="export-progressive-open-partial" onClick={() => void openPath(task.progressive!.partialPath)}>
                {zhCN.exportDialog.progressive.preview}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {task.segments?.length ? (
        <div className="mt-2 grid gap-1" data-testid="export-task-segments">
          {task.segments.map((segment) => {
            const segmentProgress = Math.round(segment.progress * 100);
            return (
              <div key={segment.id} className="grid grid-cols-[72px_1fr_42px] items-center gap-2 text-[11px] text-slate-500" data-testid="export-task-segment-row" data-status={segment.status}>
                <span>{zhCN.exportDialog.renderFarm.segmentLabel(segment.index + 1)}</span>
                <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${segmentProgress}%` }} />
                </div>
                <span className="text-right tabular-nums">{segmentProgress}%</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {task.error ? <div className="mt-1 whitespace-pre-wrap text-[11px] text-rose-700">{task.error}</div> : null}
      {task.report?.loudness ? (
        <div className="mt-1 text-[11px] text-slate-600" data-testid="export-task-loudness-report">
          {zhCN.exportDialog.loudnessReport(formatLoudness(task.report.loudness.integratedLoudness))}
        </div>
      ) : null}
    </div>
  );
}

function formatLoudness(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : zhCN.common.unavailable;
}

function priorityLabel(priority: ExportTaskPriority): string {
  return zhCN.exportDialog.priorityOptions[priority];
}

function StatusPill({ status }: { status: ExportTaskStatus }) {
  const className =
    status === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'running'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : status === 'error'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : status === 'canceled'
            ? 'bg-slate-100 text-slate-600 border-slate-200'
            : status === 'interrupted'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`} data-testid="export-task-status" data-status={status}>
      {zhCN.exportDialog.status[status]}
    </span>
  );
}
