import {
  TARGET_ASPECT_RATIOS,
  SUPPORTED_PROJECT_FPS,
  appendExportRangeSequence,
  buildExportProjectFromProject,
  buildFfmpegPreviewSamplePlans,
  clampReframeOffset,
  exportRenderRangeFromPoints,
  getTimelinePlaybackDuration,
  normalizeExportRenderRange,
  normalizeExportRanges,
  normalizeProjectFps,
  normalizeVideoRestoration,
  runExportPreflight,
  normalizeTargetAspectRatio,
  resolveReframeDimensions,
  suggestRenderFarmInstances,
  type ExportAudioVisualizationBackground,
  type ExportAudioVisualizationStyle,
  type ExportRenderRange,
  type NormalizedExportRenderRange,
  type ExportSubtitleFormat,
  type ExportTaskStatus,
  type ExportTaskPriority,
  type ExportLoudnessNormalization,
  type ExportPreviewSampleKind,
  type ExportWatermarkPosition,
  type FfmpegCapabilities,
  type PreflightResult,
  type Project,
  type TargetAspectRatio
} from '@open-factory/editor-core';
import { AlertTriangle, Clock3, FileText, FolderOpen, Image as ImageIcon, ListPlus, Minimize2, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { zhCN } from '../i18n/strings';
import { chooseExportPath, revealExport } from '../lib/exportVideo';
import { isFontFamilyAvailable } from '../lib/fonts';
import { convertLocalFileSrc, getAppDataDir, getFfmpegCapabilities, minimizeToTray, openFileDialog, openPath, runExportPowerAction, runExportPreviewSamples } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { readExportBackgroundSettings, type ExportBackgroundSettings } from '../settings/appSettings';
import { getWhisperAvailability } from '../lib/whisper';
import { useWhisperSettingsStore } from '../store/whisperSettingsStore';
import { cancelQueuedExportTask, enqueueExport, retryQueuedExportTask, setExportQueueMaxConcurrent, setExportQueuePaused } from './export-queue-runner';
import { EXPORT_COMPLETION_ACTIONS, localDatetimeInputValue, normalizeExportCompletionAction, normalizeScheduledExportStart, type ExportCompletionAction } from './export-background';
import { loadExportHistoryIntoStore } from './export-history';
import { estimateExportFileSizeBytes, formatEstimatedFileSize } from './export-size-estimate';
import { useExportQueueStore } from './export-queue-store';
import {
  BUILTIN_EXPORT_PRESETS,
  deleteCustomExportPreset,
  getExportPreset,
  loadExportPresets,
  saveCustomExportPreset,
  type ExportPreset,
  type ExportPresetSettings
} from './export-presets';

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

interface ExportJob {
  outputPath: string;
  range?: ExportRenderRange | null;
}

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

export function ExportDialog({ project, initialPreset, selectedClipIds = [], inPoint, outPoint, onClose, onCompleted, onRelinkMissing }: ExportDialogProps) {
  const t = zhCN.exportDialog;
  const [outputPath, setOutputPath] = useState('');
  const [capabilities, setCapabilities] = useState<FfmpegCapabilities | undefined>();
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<{ issues: PreflightResult[]; selectedJobs: ExportJob[] }>();
  const [presets, setPresets] = useState<ExportPreset[]>(initialPreset ? [initialPreset, ...BUILTIN_EXPORT_PRESETS] : BUILTIN_EXPORT_PRESETS);
  const [presetId, setPresetId] = useState(initialPreset?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
  const [draftSettings, setDraftSettings] = useState<ExportPresetSettings>({ ...(initialPreset?.settings ?? BUILTIN_EXPORT_PRESETS[0].settings) });
  const [exportRangeMode, setExportRangeMode] = useState<ExportRangeMode>('all');
  const [customPresetName, setCustomPresetName] = useState('');
  const [batchOutputPaths, setBatchOutputPaths] = useState('');
  const [priority, setPriority] = useState<ExportTaskPriority>('normal');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledStartInput, setScheduledStartInput] = useState(() => localDatetimeInputValue(new Date(Date.now() + 60_000)));
  const [completionAction, setCompletionAction] = useState<ExportCompletionAction>('none');
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({ allowPowerActions: false }));
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [previewSamples, setPreviewSamples] = useState<ExportPreviewThumbnail[]>([]);
  const suggestedRenderFarmInstances = useMemo(() => suggestRenderFarmInstances(typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency), []);
  const [renderFarmEnabled, setRenderFarmEnabled] = useState(false);
  const [renderFarmInstances, setRenderFarmInstances] = useState(suggestedRenderFarmInstances);
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
  const selectedPreset = useMemo(() => getExportPreset(presetId, presets), [presetId, presets]);
  const exportSettings = useMemo(() => normalizeDraftSettings(draftSettings), [draftSettings]);
  const isAudioVisualization = exportSettings.outputMode === 'audio-visualization';
  const isAudioOnly = !isAudioVisualization && (exportSettings.outputMode === 'audio' || exportSettings.format === 'm4a');
  const timelineVisualControlsDisabled = isAudioOnly || isAudioVisualization;
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
  const hardwareEncodingEligible = !isAudioOnly && (exportSettings.format === 'mp4' || exportSettings.format === 'mov');
  const hardwareEncodingRequested = hardwareEncodingEligible && exportSettings.hardwareEncoding === true;
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
    void loadExportHistoryIntoStore();
    void readExportBackgroundSettings()
      .then(setExportBackgroundSettings)
      .catch((reason) => {
        console.warn('Unable to load export background settings', reason);
      });
  }, []);

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

  async function addToQueue(): Promise<void> {
    try {
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
      const issues = await collectPreflightIssues();
      if (issues.length > 0) {
        setPreflight({ issues, selectedJobs });
        return;
      }
      await enqueueSelectedJobs(selectedJobs);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.exportFailed);
    }
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

  async function enqueueSelectedJobs(selectedJobs: ExportJob[]): Promise<void> {
    const scheduledStartAt = scheduleEnabled ? normalizeScheduledExportStart(scheduledStartInput) : undefined;
    if (scheduleEnabled && !scheduledStartAt) {
      setError(t.scheduleInvalid);
      return;
    }
    pendingCompletionAction.current = completionAction;
    completionActionHandled.current = false;
    for (const job of selectedJobs) {
      const task = await enqueueExport(
        project,
        job.outputPath,
        exportSettings,
        priority,
        renderFarmEnabled ? { enabled: true, maxInstances: renderFarmInstances } : undefined,
        scheduledStartAt,
        job.range
      );
      for (const warning of task.plan.warnings) {
        showToast({ kind: 'warning', title: t.exportWarningTitle, message: formatExportWarning(warning) });
      }
    }
    showToast({ kind: 'info', title: scheduleEnabled ? t.scheduledTitle : t.queuedTitle, message: t.queuedMessage(selectedJobs.length, selectedPreset.name) });
  }

  async function collectPreflightIssues(): Promise<PreflightResult[]> {
    const nextCapabilities = capabilities ?? (await getFfmpegCapabilities().catch(() => undefined));
    if (nextCapabilities && !capabilities) {
      setCapabilities(nextCapabilities);
    }
    const whisperAvailability = await getWhisperAvailability({
      executablePath: whisperExecutablePath,
      modelPath: whisperModelPath
    });
    return runExportPreflight(project, {
      ffmpegAvailable: nextCapabilities?.available === true,
      whisperReady: whisperAvailability.ready,
      whisperMessage: whisperAvailability.error,
      isFontFamilyAvailable,
      platformPreset: exportSettings.platformPreset
    });
  }

  async function continueAfterWarnings(): Promise<void> {
    if (!preflight || preflight.issues.some((issue) => issue.severity === 'blocking')) {
      return;
    }
    const jobs = preflight.selectedJobs;
    setPreflight(undefined);
    try {
      await enqueueSelectedJobs(jobs);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.exportFailed);
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
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
              disabled={selectedPreset.builtin}
              data-testid="export-delete-preset-button"
              onClick={() => void deletePreset()}
            >
              <Trash2 size={13} />
              {t.delete}
            </button>
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
            <PresetSelectField
              label={t.fields.loudnessNormalization}
              value={exportSettings.loudnessNormalization ?? 'off'}
              disabled={!loudnessNormalizationEligible}
              onChange={(value) => updateLoudnessNormalization(setDraftSettings, value)}
              testId="export-loudness-normalization-select"
              options={['off', 'youtube', 'ebu-r128']}
            />
          </div>
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
            <label className="pt-1 text-xs font-medium text-slate-600">{t.renderFarm.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input className="h-4 w-4 accent-brand" type="checkbox" checked={renderFarmEnabled} onChange={(event) => setRenderFarmEnabled(event.target.checked)} data-testid="export-render-farm-toggle" />
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
                  disabled={!renderFarmEnabled}
                  onChange={(event) => setRenderFarmInstances(Math.min(4, Math.max(1, Math.round(Number(event.target.value) || 1))))}
                  data-testid="export-render-farm-instances"
                />
                <span>{t.renderFarm.suggested(suggestedRenderFarmInstances)}</span>
              </div>
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
                  <div key={entry.id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0" data-testid="export-history-entry" data-status={entry.status}>
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" onClick={() => void addToQueue()} data-testid="export-enqueue-button">
            <ListPlus size={15} />
            {t.addToQueue}
          </button>
        </div>
      </section>
    </div>
  );
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
    targetAspectRatio,
    reframeOffsetX: clampReframeOffset(settings.reframeOffsetX),
    reframeOffsetY: clampReframeOffset(settings.reframeOffsetY),
    watermark,
    timecodeBurnIn,
    slate,
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
  return {
    style,
    color: normalizeHexColor(value?.color, DEFAULT_AUDIO_VISUALIZATION.color),
    background: normalizeAudioVisualizationBackgroundDraft(value?.background)
  };
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

function updateAudioVisualizationColor(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({
    ...current,
    audioVisualization: {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      color: normalizeHexColor(value, DEFAULT_AUDIO_VISUALIZATION.color)
    }
  }));
}

function updateAudioVisualizationBackgroundType(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const type = AUDIO_VISUALIZATION_BACKGROUND_TYPES.includes(value as ExportAudioVisualizationBackground['type'])
      ? (value as ExportAudioVisualizationBackground['type'])
      : 'solid';
    return {
      ...current,
      audioVisualization: {
        ...visualization,
        background:
          type === 'image'
            ? { type: 'image', path: visualization.background.type === 'image' ? visualization.background.path : '' }
            : type === 'gradient'
              ? { type: 'gradient', color: backgroundPrimaryColor(visualization.background), color2: '#1d4ed8' }
              : { type: 'solid', color: backgroundPrimaryColor(visualization.background) }
      }
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
      return {
        ...current,
        audioVisualization: { ...visualization, background: { ...background, [key]: normalizeHexColor(value, key === 'color' ? '#050816' : '#1d4ed8') } }
      };
    }
    return {
      ...current,
      audioVisualization: { ...visualization, background: { type: 'solid', color: normalizeHexColor(value, '#050816') } }
    };
  });
}

function updateAudioVisualizationBackgroundImagePath(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, path: string): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    return {
      ...current,
      audioVisualization: { ...visualization, background: { type: 'image', path } }
    };
  });
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
  const background = visualization.background;
  const backgroundType = background.type;
  const backgroundColor = background.type === 'image' ? '#050816' : background.color;
  const backgroundColor2 = background.type === 'gradient' ? background.color2 : '#1d4ed8';
  const backgroundPath = background.type === 'image' ? background.path : '';

  return (
    <section className="rounded-md border border-line p-3" data-testid="export-audio-viz-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-700">{t.title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
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

function ExportTaskRow({ taskId }: { taskId: string }) {
  const task = useExportQueueStore((state) => state.tasks.find((item) => item.id === taskId));
  if (!task) {
    return null;
  }
  const progress = Math.round(task.progress * 100);
  const canCancel = task.status === 'scheduled' || task.status === 'pending' || task.status === 'running';
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
        ) : task.status === 'error' || task.status === 'canceled' ? (
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
            : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`} data-testid="export-task-status" data-status={status}>
      {zhCN.exportDialog.status[status]}
    </span>
  );
}
