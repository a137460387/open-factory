import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AddAdjustmentLayerCommand,
  AddClipCommand,
  AddMediaFolderCommand,
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddProjectBookmarkCommand,
  ApplySplitLayoutCommand,
  BatchImportSubtitleCommand,
  AddTrackCommand,
  AddTransitionCommand,
  CreateMulticamSequenceCommand,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_REVIEW_ANNOTATION_COLOR,
  DeleteGroupCommand,
  DeleteClipsCommand,
  DeleteMediaFolderCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MergeMediaCommand,
  NewProjectCommand,
  RemoveMediaCommand,
  MoveMediaToFolderCommand,
  RippleDeleteCommand,
  RenameMediaFolderCommand,
  PiPLayoutCommand,
  SetMediaFolderCollapsedCommand,
  SnapToBeatsCommand,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectExportRangesCommand,
  UpdateClipCommand,
  createBeatMarker,
  calculateBeatSplitTimesForClip,
  createExportRange,
  createId,
  createProject,
  createTrack,
  buildVideoStitchSequence,
  buildTimelineNavigationPoints,
  createMainSideSplitLayout,
  detectSubtitleDataOverlaps,
  dirname,
  getSplitLayoutDefinition,
  getClipSpeed,
  getCfrTargetFrameRate,
  getProjectFrameRateConversionTarget,
  getTimelineDuration,
  isFrameRateMismatch,
  findCompleteClipGroup,
  findSyncCompareClipRefs,
  findTimelineNavigationPoint,
  normalizeClipGroups,
  normalizeExportRanges,
  applyTimelineVersionDiffSelection,
  instantiateProjectTemplate,
  instantiateTitleTemplate,
  mergeImportedTimelineBookmarks,
  parseTimelineBookmarksJson,
  mergeOverlappingSubtitleDataCues,
  replaceProjectActiveTimeline,
  serializeTimelineBookmarks,
  type DuplicateMediaGroup,
  type DuplicateMediaIssue,
  type MissingMediaIssue,
  type MediaAsset,
  type OrphanMediaIssue,
  type ProjectHealthReport,
  type Project,
  type ReviewAnnotation,
  type Clip,
  type BeatSensitivity,
  type KeyframeProperty,
  type PiPLayoutPosition,
  type ProjectTemplateId,
  type ProxyMissingIssue,
  type SplitLayoutDefinition,
  type SubtitleDataImportMode,
  type Timeline as CoreTimeline,
  type TimelineGridSettings,
  type TimelineGridUnit,
  type TitleTemplateId,
  type ExportTask
} from '@open-factory/editor-core';
import { ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { runConfiguredAutomationForMedia, type AutomationActionDependencies } from '../automation/automation-rules';
import { ErrorBoundary } from './common/ErrorBoundary';
import { MediaBin } from './MediaBin/MediaBin';
import { StoryboardView } from './Storyboard/StoryboardView';
import { Timeline } from './Timeline/Timeline';
import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useExportQueue } from '../hooks/useExportQueue';
import { useMacroShortcuts } from '../hooks/useMacroShortcuts';
import { useShortcuts } from '../hooks/useShortcuts';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import { revealExport } from '../lib/exportVideo';
import { clearMediaCache } from '../cache/cache-service';
import { createAdjustmentLayerClip, createClipFromAsset, findPreferredTrack } from '../lib/clipFactory';
import { zhCN } from '../i18n/strings';
import {
  applyWorkspaceLayout,
  BUILT_IN_WORKSPACE_LAYOUT_IDS,
  clampTimelineHeight,
  createCustomWorkspaceLayout,
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  getEffectivePanelState,
  getWorkspaceLayoutById,
  normalizeStoredLayoutSettings,
  resolveWorkspaceLayoutShortcut,
  type EditorLayoutSettings,
  type WorkspaceLayoutDefinition,
  type WorkspaceLayoutId
} from '../layout/layoutSettings';
import type { ExportPreset } from '../export/export-presets';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import {
  buildSubtitleTrackFromDataCues,
  buildSubtitleTrackFromSrt,
  isSubtitlePath,
  parseSubtitleDataFile,
  pickSubtitleDataPaths,
  pickSubtitlePaths,
  readSubtitleText
} from '../lib/subtitles';
import { createProjectArchivePlan, writeProjectArchive, type ArchiveProgress } from '../lib/projectArchive';
import { collectProjectArchivePreflight, saveClipReport, saveOfflineMediaReport } from '../lib/mediaReport';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { scanProjectHealth } from '../lib/projectHealth';
import { getReviewModeShellVisibility } from '../review/reviewMode';
import { saveReviewReport } from '../review/reviewReport';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import { canSeparateAudioForClip, getDemucsAvailability, separateAudioForClip, type DemucsAvailability } from '../lib/demucs';
import {
  chooseProjectSavePath,
  chooseProjectToOpen,
  confirmDiscardChanges,
  deleteAutosaveAfterSave,
  discardAutosaveRecovery,
  findStartupAutosaveRecovery,
  readAutosaveIntervalSeconds,
  readProjectFile,
  restoreAutosaveRecovery,
  writeAutosaveIntervalSeconds,
  writeProjectFile,
  type AutosaveRecoveryCandidate
} from '../lib/projectFiles';
import {
  bridgeConfirm,
  cancelDemucs,
  copyFile as bridgeCopyFile,
  detectBeats,
  listenBridge,
  openDirectoryDialog,
  openFileDialog as bridgeOpenFileDialog,
  removeFile as bridgeRemoveFile,
  readFile as bridgeReadFile,
  saveFileDialog as bridgeSaveFileDialog,
  sendNotification,
  startRecording,
  stopRecording,
  writeFile as bridgeWriteFile,
  type DemucsProgressEvent,
  type RecordingSource
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  appendMacroHistoryEntry,
  buildMacroCommands,
  findMacroTargetClip,
  readClipMacros,
  readMacroHistory,
  snapshotCommand,
  writeClipMacros,
  type ClipMacro,
  type CommandSnapshot,
  type MacroHistoryEntry
} from '../macros/clip-macros';
import {
  readBackupSettings,
  readCustomSplitLayouts,
  readLayoutSettings,
  readPreviewPerformanceSettings,
  readTimelineGridSettings,
  readViewSettings,
  saveCustomSplitLayouts,
  saveLayoutSettings,
  savePreviewPerformanceSettings,
  saveTimelineGridSettings,
  saveViewSettings
} from '../settings/appSettings';
import { DEFAULT_PREVIEW_PERFORMANCE_SETTINGS, type PreviewPerformanceSettings, type PreviewQualityMode, type PreviewSkipFrames } from '../lib/preview/preview-performance';
import { createProxyForAsset, type ProxyGenerationOptions } from '../media/proxy';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { DuplicateMediaDialog, type DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import { useMediaJobStore } from '../media/media-job-store';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import { ProjectHealthDialog } from '../project-health/ProjectHealthDialog';
import { ProjectTemplateDialog } from '../project-templates/ProjectTemplateDialog';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { selectClipById, useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';

const AudioMixer = lazy(() => import('./AudioMixer/AudioMixer').then((module) => ({ default: module.AudioMixer })));
const Inspector = lazy(() => import('./Inspector/Inspector').then((module) => ({ default: module.Inspector })));
const PreviewCanvas = lazy(() => import('./PreviewCanvas/PreviewCanvas').then((module) => ({ default: module.PreviewCanvas })));
const SmartRoughCutPanel = lazy(() => import('./SmartRoughCut/SmartRoughCutPanel').then((module) => ({ default: module.SmartRoughCutPanel })));
const HistoryPanel = lazy(() => import('./History/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const ExportDialog = lazy(() => import('../export/ExportDialog').then((module) => ({ default: module.ExportDialog })));
const SettingsDialog = lazy(() => import('../settings/SettingsDialog').then((module) => ({ default: module.SettingsDialog })));
const MacroHistoryDialog = lazy(() => import('../macros/MacroHistoryDialog').then((module) => ({ default: module.MacroHistoryDialog })));
const TimelineExportDialog = lazy(() => import('../timeline-export/TimelineExportDialog').then((module) => ({ default: module.TimelineExportDialog })));
const BatchTranscodeDialog = lazy(() => import('../media/BatchTranscodeDialog').then((module) => ({ default: module.BatchTranscodeDialog })));
const BatchWatermarkDialog = lazy(() => import('../media/BatchWatermarkDialog').then((module) => ({ default: module.BatchWatermarkDialog })));
const GifExportDialog = lazy(() => import('../media/GifExportDialog'));
const AudioSpectrumDialog = lazy(() => import('../media/AudioSpectrumDialog'));
const MediaPrecheckPanel = lazy(() => import('../media/MediaPrecheckPanel').then((module) => ({ default: module.MediaPrecheckPanel })));
const VideoStitchWizardDialog = lazy(() => import('../video-stitching/VideoStitchWizardDialog').then((module) => ({ default: module.VideoStitchWizardDialog })));
const SyncComparePanel = lazy(() => import('../sync-compare/SyncComparePanel').then((module) => ({ default: module.SyncComparePanel })));
const SceneReorderDialog = lazy(() => import('../scene-reorder/SceneReorderDialog').then((module) => ({ default: module.SceneReorderDialog })));
const TimelineSearchPanel = lazy(() => import('../timeline-search/TimelineSearchPanel').then((module) => ({ default: module.TimelineSearchPanel })));
const SnapshotNameDialog = lazy(() => import('../project-snapshots/SnapshotNameDialog').then((module) => ({ default: module.SnapshotNameDialog })));
const SnapshotHistoryDialog = lazy(() => import('../project-snapshots/SnapshotHistoryDialog').then((module) => ({ default: module.SnapshotHistoryDialog })));
const SnapshotVersionCompareDialog = lazy(() => import('../project-snapshots/SnapshotVersionCompareDialog').then((module) => ({ default: module.SnapshotVersionCompareDialog })));

export function EditorShell() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProject = useEditorStore((state) => state.setProject);
  const setMedia = useEditorStore((state) => state.setMedia);
  const addMedia = useEditorStore((state) => state.addMedia);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);
  const setMediaMetadata = useEditorStore((state) => state.setMediaMetadata);
  const setDirty = useEditorStore((state) => state.setDirty);
  const setProjectPath = useEditorStore((state) => state.setProjectPath);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setPlaybackRate = useEditorStore((state) => state.setPlaybackRate);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const [batchTranscodeOpen, setBatchTranscodeOpen] = useState(false);
  const [batchWatermarkOpen, setBatchWatermarkOpen] = useState(false);
  const [batchTranscodeInitialPaths, setBatchTranscodeInitialPaths] = useState<string[]>([]);
  const [gifExportAsset, setGifExportAsset] = useState<MediaAsset>();
  const [spectrumAsset, setSpectrumAsset] = useState<MediaAsset>();
  const [mediaPrecheckOpen, setMediaPrecheckOpen] = useState(false);
  const [videoStitchWizardOpen, setVideoStitchWizardOpen] = useState(false);
  const [syncCompareOpen, setSyncCompareOpen] = useState(false);
  const [sceneReorderOpen, setSceneReorderOpen] = useState(false);
  const [timelineSearchOpen, setTimelineSearchOpen] = useState(false);
  const [snapshotNameOpen, setSnapshotNameOpen] = useState(false);
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState(false);
  const [snapshotCompareOpen, setSnapshotCompareOpen] = useState(false);
  const [projectTemplateOpen, setProjectTemplateOpen] = useState(false);
  const [templateExportPreset, setTemplateExportPreset] = useState<ExportPreset>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [beatSensitivity, setBeatSensitivity] = useState<BeatSensitivity>('medium');
  const [smartRoughCutOpen, setSmartRoughCutOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [macroHistoryOpen, setMacroHistoryOpen] = useState(false);
  const [projectHealthOpen, setProjectHealthOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(() => (typeof window === 'undefined' ? false : window.location.hash === '#review'));
  const [projectHealthReport, setProjectHealthReport] = useState<ProjectHealthReport>();
  const [projectHealthScanning, setProjectHealthScanning] = useState(false);
  const [duplicateMediaGroups, setDuplicateMediaGroups] = useState<DuplicateMediaGroup[]>([]);
  const [duplicateMediaOpen, setDuplicateMediaOpen] = useState(false);
  const [shortcutBindings, setShortcutBindings] = useState<TimelineShortcutBindings>({});
  const [macros, setMacros] = useState<ClipMacro[]>([]);
  const [macroHistory, setMacroHistory] = useState<MacroHistoryEntry[]>([]);
  const [macroRecordingActive, setMacroRecordingActive] = useState(false);
  const [macroRecordingStepCount, setMacroRecordingStepCount] = useState(0);
  const [autosaveIntervalSeconds, setAutosaveIntervalSeconds] = useState(() => readAutosaveIntervalSeconds());
  const [recoveryCandidate, setRecoveryCandidate] = useState<AutosaveRecoveryCandidate>();
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress>();
  const [layoutSettings, setLayoutSettings] = useState<EditorLayoutSettings>(DEFAULT_EDITOR_LAYOUT_SETTINGS);
  const [safeFrameGuides, setSafeFrameGuides] = useState(false);
  const [thumbnailTrackVisible, setThumbnailTrackVisible] = useState(true);
  const [previewPerformance, setPreviewPerformance] = useState<PreviewPerformanceSettings>(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
  const [timelineGridSettings, setTimelineGridSettings] = useState<TimelineGridSettings>(DEFAULT_TIMELINE_GRID_SETTINGS);
  const [pipLayoutPosition, setPiPLayoutPosition] = useState<PiPLayoutPosition>('bottom-right');
  const [customSplitLayouts, setCustomSplitLayouts] = useState<SplitLayoutDefinition[]>([]);
  const [viewportSize, setViewportSize] = useState(() => readViewportSize());
  const [lastBackupAt, setLastBackupAt] = useState<string>();
  const [demucsAvailability, setDemucsAvailability] = useState<DemucsAvailability>({ ready: false, error: zhCN.demucs.notConfigured });
  const [audioSeparationClipId, setAudioSeparationClipId] = useState<string>();
  const [audioSeparationProgress, setAudioSeparationProgress] = useState<number>();
  const [recordingTask, setRecordingTask] = useState<{ taskId: string; source: RecordingSource; outputPath: string; startedAt: number }>();
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const {
    lastExportPath,
    setLastExportPath,
    exportDialogOpen,
    setExportDialogOpen,
    timelineExportDialogOpen,
    setTimelineExportDialogOpen,
    exportQueueRecovery,
    sharePackageProgress,
    sharePackageBusy,
    cancelCurrentExport,
    createCurrentSharePackage,
    exportCurrentFrame,
    restoreExportQueueRecovery,
    discardExportQueueRecovery
  } = useExportQueue(project);
  const macroRecorderRef = useRef<{ active: boolean; replaying: boolean; steps: CommandSnapshot[] }>({ active: false, replaying: false, steps: [] });

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClips = useMemo(() => selectedClipIds.map((id) => selectClipById(project, id)).filter((clip): clip is Clip => Boolean(clip)), [project, selectedClipIds]);
  const selectedClipMedia = useMemo(
    () => (selectedClip && 'mediaId' in selectedClip ? project.media.find((asset) => asset.id === selectedClip.mediaId) : undefined),
    [project.media, selectedClip]
  );
  const selectedClipLocked = useMemo(
    () => Boolean(selectedClip && project.timeline.tracks.find((track) => track.id === selectedClip.trackId)?.locked),
    [project.timeline.tracks, selectedClip]
  );
  const canCreateMulticamSequence = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 8) {
      return false;
    }
    const selected = selectedClipIds
      .map((id) => project.timeline.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track }))).find((item) => item.clip.id === id))
      .filter(Boolean);
    return (
      selected.length === selectedClipIds.length &&
      selected.every((item) => item?.track.type === 'video' && (item.clip.type === 'video' || item.clip.type === 'image'))
    );
  }, [project.timeline.tracks, selectedClipIds]);
  const selectedPiPClips = useMemo(() => {
    if (selectedClipIds.length !== 2) {
      return [];
    }
    type ClipWithTrack = { clip: Clip; track: Project['timeline']['tracks'][number]; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, track, trackIndex })));
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);
  const canApplyPiPLayout = selectedPiPClips.length === 2;
  const selectedSplitLayoutClips = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 4) {
      return [];
    }
    type ClipWithTrack = { clip: Clip; track: Project['timeline']['tracks'][number]; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, track, trackIndex })));
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);
  const canApplySplitLayout = selectedSplitLayoutClips.length >= 2 && selectedSplitLayoutClips.length <= 4;
  const syncCompareClipRefs = useMemo(() => findSyncCompareClipRefs(project.timeline, selectedClipIds), [project.timeline, selectedClipIds]);
  const canOpenSyncCompare = syncCompareClipRefs.length === 2;
  const canOpenSceneReorder = useMemo(() => selectedClips.filter(isSceneReorderClip).length >= 2, [selectedClips]);
  const canSeparateSelectedAudio = canSeparateAudioForClip(selectedClip, selectedClipMedia, demucsAvailability.ready) && !audioSeparationClipId;
  const canDetectBeats = Boolean(
    selectedClip &&
      selectedClipMedia &&
      (selectedClip.type === 'audio' || selectedClip.type === 'video') &&
      (selectedClipMedia.type === 'audio' || selectedClipMedia.hasAudio)
  );
  const canSnapToBeats = selectedClipIds.length > 0 && (project.beatMarkers?.length ?? 0) > 0;
  const canSplitToBeats = Boolean(selectedClip && (project.beatMarkers?.length ?? 0) > 0);
  const timelineHeightPx = clampTimelineHeight(layoutSettings.timelineHeightPx, viewportSize.height);
  const effectivePanels = useMemo(() => getEffectivePanelState(layoutSettings, viewportSize.width), [layoutSettings, viewportSize.width]);
  const reviewVisibility = useMemo(() => getReviewModeShellVisibility(reviewMode), [reviewMode]);
  const workspaceLayouts = useMemo<WorkspaceLayoutDefinition[]>(
    () => [...BUILT_IN_WORKSPACE_LAYOUT_IDS.map((id) => getWorkspaceLayoutById(layoutSettings, id)).filter((layout): layout is WorkspaceLayoutDefinition => Boolean(layout)), ...layoutSettings.customWorkspaceLayouts],
    [layoutSettings]
  );
  const editorGridRows = reviewMode ? 'auto minmax(0,1fr)' : `auto minmax(0,1fr) 6px ${timelineHeightPx}px`;
  const mainGridColumns = reviewMode ? 'minmax(0,1fr)' : `${effectivePanels.leftPanelCollapsed ? 48 : layoutSettings.leftPanelWidthPx}px minmax(0,1fr) ${effectivePanels.rightPanelCollapsed ? 48 : layoutSettings.rightPanelWidthPx}px`;
  const rightPanelRows =
    effectivePanels.rightPrimaryPanelVisible && effectivePanels.audioMixerVisible
      ? `minmax(0,1fr) ${layoutSettings.mixerHeightPx}px`
      : 'minmax(0,1fr)';

  const persistLayoutPatch = useCallback((patch: Partial<EditorLayoutSettings>) => {
    setLayoutSettings((current) => {
      const next = normalizeStoredLayoutSettings({ ...current, ...patch }) ?? { ...DEFAULT_EDITOR_LAYOUT_SETTINGS };
      void saveLayoutSettings(next).catch((error) => {
        console.warn('Unable to save layout settings', error);
      });
      return next;
    });
  }, []);

  const persistPanelVisibilityPatch = useCallback(
    (patch: Partial<EditorLayoutSettings['panels']>) => {
      persistLayoutPatch({ panels: { ...layoutSettings.panels, ...patch } });
    },
    [layoutSettings.panels, persistLayoutPatch]
  );

  const applyWorkspaceLayoutById = useCallback(
    (layoutId: WorkspaceLayoutId) => {
      const layout = getWorkspaceLayoutById(layoutSettings, layoutId);
      if (!layout) {
        showToast({ kind: 'warning', title: zhCN.layout.workspaceApplyFailed, message: zhCN.layout.workspaceMissing });
        return;
      }
      const next = applyWorkspaceLayout(layoutSettings, layout);
      setLayoutSettings(next);
      setHistoryPanelOpen(layout.panels.history);
      setSmartRoughCutOpen(false);
      void saveLayoutSettings(next).catch((error) => {
        console.warn('Unable to save workspace layout', error);
      });
      showToast({ kind: 'success', title: zhCN.layout.workspaceApplied, message: getWorkspaceLayoutDisplayName(layout) });
    },
    [layoutSettings]
  );

  const saveCurrentWorkspaceLayout = useCallback(async () => {
    const name = window.prompt(zhCN.layout.saveWorkspacePrompt, zhCN.layout.customWorkspaceDefaultName)?.trim();
    if (!name) {
      return;
    }
    const customLayout = createCustomWorkspaceLayout(name, layoutSettings);
    const next = {
      ...layoutSettings,
      activeWorkspaceLayoutId: customLayout.id,
      customWorkspaceLayouts: [...layoutSettings.customWorkspaceLayouts, customLayout]
    };
    setLayoutSettings(next);
    try {
      await saveLayoutSettings(next);
      showToast({ kind: 'success', title: zhCN.layout.workspaceSaved, message: customLayout.shortcutSlot ? zhCN.layout.workspaceShortcut(customLayout.shortcutSlot) : customLayout.name });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.layout.workspaceSaveFailed, message: error instanceof Error ? error.message : zhCN.layout.workspaceSaveFailedMessage });
    }
  }, [layoutSettings]);

  const toggleSafeFrameGuides = useCallback(() => {
    setSafeFrameGuides((current) => {
      const next = !current;
      void saveViewSettings({ safeFrameGuides: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const toggleThumbnailTrackVisible = useCallback(() => {
    setThumbnailTrackVisible((current) => {
      const next = !current;
      void saveViewSettings({ thumbnailTrackVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const updatePreviewPerformance = useCallback((patch: Partial<PreviewPerformanceSettings>) => {
    setPreviewPerformance((current) => {
      const optimistic = { ...current, ...patch };
      void savePreviewPerformanceSettings(optimistic)
        .then((saved) => setPreviewPerformance(saved))
        .catch((error) => {
          console.warn('Unable to save preview performance settings', error);
        });
      return optimistic;
    });
  }, []);

  const updateTimelineGridSettings = useCallback((patch: Partial<TimelineGridSettings>) => {
    setTimelineGridSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const toggleTimelineGridSnap = useCallback(() => {
    setTimelineGridSettings((current) => {
      const optimistic = { ...current, enabled: !current.enabled };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const changeTimelineGridUnit = useCallback(
    (unit: TimelineGridUnit) => {
      updateTimelineGridSettings({ unit });
    },
    [updateTimelineGridSettings]
  );

  const runAutomationForMedia = useCallback(async (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => {
    if (media.length === 0) {
      return;
    }
    const dependencies: AutomationActionDependencies = {
      enqueueProxy: (asset) => {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, { force: true });
        void ensureMediaJobRunner();
      },
      setLabel: (assetId, labelColor) => {
        useEditorStore.getState().setMediaMetadata(assetId, { labelColor });
      },
      moveToGroup: (asset, groupName) => {
        moveAutomationMediaToGroup(asset.id, groupName);
      },
      notify: (title, body) => sendNotification(title, body)
    };
    try {
      await runConfiguredAutomationForMedia({ trigger, media, projectName: useEditorStore.getState().project.name }, dependencies);
    } catch (error) {
      console.warn('Automation rule execution failed', error);
    }
  }, []);

  useEffect(() => {
    let canceled = false;
    void getDemucsAvailability({ executablePath: demucsExecutablePath }).then((availability) => {
      if (!canceled) {
        setDemucsAvailability(availability);
      }
    });
    return () => {
      canceled = true;
    };
  }, [demucsExecutablePath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenBridge<DemucsProgressEvent>('demucs-progress', (payload) => {
      if (payload.clipId === audioSeparationClipId) {
        setAudioSeparationProgress(payload.progress);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [audioSeparationClipId]);

  useEffect(() => {
    if (!recordingTask) {
      setRecordingElapsedSeconds(0);
      return undefined;
    }
    const update = () => setRecordingElapsedSeconds((Date.now() - recordingTask.startedAt) / 1000);
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [recordingTask]);

  useEffect(() => {
    let canceled = false;
    void readPreviewPerformanceSettings()
      .then((settings) => {
        if (!canceled) {
          setPreviewPerformance(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load preview performance settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTimelineGridSettings()
      .then((settings) => {
        if (!canceled) {
          setTimelineGridSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline grid settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readViewSettings()
      .then((view) => {
        if (!canceled) {
          setSafeFrameGuides(view.safeFrameGuides);
          setThumbnailTrackVisible(view.thumbnailTrackVisible);
        }
      })
      .catch((error) => {
        console.warn('Unable to load view settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const beginTimelineResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = timelineHeightPx;
      let nextHeight = startHeight;
      const onPointerMove = (moveEvent: PointerEvent) => {
        nextHeight = clampTimelineHeight(startHeight + startY - moveEvent.clientY, readViewportSize().height);
        setLayoutSettings((current) => ({ ...current, timelineHeightPx: nextHeight }));
      };
      const finish = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        setLayoutSettings((current) => {
          const next = { ...current, timelineHeightPx: nextHeight };
          void saveLayoutSettings(next).catch((error) => {
            console.warn('Unable to save layout settings', error);
          });
          return next;
        });
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [timelineHeightPx]
  );

  const saveProject = useCallback(async () => {
    const nextPath = projectPath ?? (await chooseProjectSavePath(`${project.name}.cutproj.json`));
    if (!nextPath && !projectPath) {
      return;
    }
    const targetPath = nextPath ?? projectPath;
    if (!targetPath) {
      return;
    }
    await writeProjectFile(project, targetPath);
    await deleteAutosaveAfterSave(targetPath, projectPath);
    try {
      setLastBackupAt((await readBackupSettings()).lastBackupAt);
    } catch (error) {
      console.warn(zhCN.settings.backup.statusSaveFailed, error);
    }
    setProjectPath(targetPath);
    setDirty(false);
    showToast({ kind: 'success', title: zhCN.editorToasts.projectSaved });
  }, [project, projectPath, setDirty, setProjectPath]);

  const archiveCurrentProject = useCallback(async () => {
    try {
      const preflight = await collectProjectArchivePreflight(project);
      if (preflight.missingRows.length > 0) {
        const shouldContinue = await bridgeConfirm(zhCN.projectArchive.missingMediaConfirm(preflight.missingRows.length), {
          title: zhCN.projectArchive.title,
          kind: 'warning'
        });
        if (!shouldContinue) {
          return;
        }
      }
      const archiveParentDir = projectPath ? dirname(projectPath) : await openDirectoryDialog();
      if (!archiveParentDir) {
        return;
      }
      const plan = createProjectArchivePlan(project, archiveParentDir, { skipSourcePaths: preflight.missingPaths });
      setArchiveProgress({ copied: 0, total: plan.copyTasks.filter((task) => task.copyRequired).length });
      await writeProjectArchive(plan, { copyFile: bridgeCopyFile, writeFile: bridgeWriteFile }, setArchiveProgress);
      commandManager.clear();
      setProject(plan.project, plan.projectPath);
      setProjectPath(plan.projectPath);
      setDirty(false);
      showToast({ kind: 'success', title: zhCN.projectArchive.success, message: plan.projectPath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectArchive.failed, message: error instanceof Error ? error.message : zhCN.projectArchive.failedMessage });
    } finally {
      setArchiveProgress(undefined);
    }
  }, [project, projectPath, setDirty, setProject, setProjectPath]);

  const createMediaReport = useCallback(async () => {
    try {
      const outputPath = await saveOfflineMediaReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.mediaReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaReport.failed, message: error instanceof Error ? error.message : zhCN.mediaReport.failedMessage });
    }
  }, [project]);

  const createClipReport = useCallback(async () => {
    try {
      const outputPath = await saveClipReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.clipReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.clipReport.failed, message: error instanceof Error ? error.message : zhCN.clipReport.failedMessage });
    }
  }, [project]);

  const jumpToMediaAsset = useCallback((assetId: string) => {
    const element = document.querySelector(`[data-testid="media-card-${assetId}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'nearest' });
    element?.focus();
  }, []);

  useEffect(() => {
    let canceled = false;
    void findStartupAutosaveRecovery()
      .then((candidate) => {
        if (!canceled && candidate) {
          setRecoveryCandidate(candidate);
        }
      })
      .catch((error) => {
        console.warn(zhCN.editorToasts.autosaveCheckFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomKeybindings()
      .then((bindings) => {
        if (!canceled) {
          setShortcutBindings(bindings);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.shortcuts.loadFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readClipMacros()
      .then((entries) => {
        if (!canceled) {
          setMacros(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.macros.saveFailed, error);
      });
    void readMacroHistory()
      .then((entries) => {
        if (!canceled) {
          setMacroHistory(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.macros.history.title, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    commandManager.setOnExecute((command) => {
      const recorder = macroRecorderRef.current;
      if (!recorder.active || recorder.replaying) {
        return;
      }
      const snapshot = snapshotCommand(command);
      if (!snapshot) {
        return;
      }
      recorder.steps = [...recorder.steps, snapshot];
      setMacroRecordingStepCount(recorder.steps.length);
    });
    return () => commandManager.setOnExecute(undefined);
  }, []);

  useEffect(() => {
    let canceled = false;
    void readBackupSettings()
      .then((settings) => {
        if (!canceled) {
          setLastBackupAt(settings.lastBackupAt);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.backup.statusSaveFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readLayoutSettings()
      .then((settings) => {
        if (!canceled) {
          setLayoutSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load layout settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomSplitLayouts()
      .then((layouts) => {
        if (!canceled) {
          setCustomSplitLayouts(layouts);
        }
      })
      .catch((error) => {
        console.warn('Unable to load custom split layouts', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewportSize(readViewportSize());
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setTimelineSearchOpen(true);
        return;
      }
      const workspaceLayoutId = resolveWorkspaceLayoutShortcut(event, layoutSettings.customWorkspaceLayouts);
      if (workspaceLayoutId && !isEditableKeyboardEventTarget(event.target)) {
        event.preventDefault();
        applyWorkspaceLayoutById(workspaceLayoutId);
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [applyWorkspaceLayoutById, layoutSettings.customWorkspaceLayouts]);

  useEffect(() => {
    const onHashChange = () => setReviewMode(window.location.hash === '#review');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const targetHash = reviewMode ? '#review' : '';
    if (window.location.hash === targetHash) {
      return;
    }
    const nextUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [reviewMode]);

  const queueFrameRateConversionForImportedMedia = useCallback(
    async (media: MediaAsset[]) => {
      if (project.settings.vfrHandling === 'ignore') {
        return;
      }
      const frameRateMedia = media.filter((asset) => asset.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, project.settings.fps)));
      if (frameRateMedia.length === 0) {
        return;
      }
      if (project.settings.vfrHandling === 'ask') {
        const shouldConvert = await bridgeConfirm(zhCN.editorToasts.frameRateConversionPrompt(frameRateMedia.length, getProjectFrameRateConversionTarget(project.settings.fps)), {
          title: zhCN.editorToasts.frameRateConversionPromptTitle,
          kind: 'warning'
        });
        if (!shouldConvert) {
          return;
        }
      }
      for (const asset of frameRateMedia) {
        const cfrFrameRate = isFrameRateMismatch(asset.frameRate, project.settings.fps)
          ? getProjectFrameRateConversionTarget(project.settings.fps)
          : getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? project.settings.fps);
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
          force: true,
          cfrFrameRate
        });
      }
      void ensureMediaJobRunner();
    },
    [project.settings.fps, project.settings.vfrHandling]
  );

  const importMedia = useCallback(async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return;
      }
      const result = await probeMediaPaths(paths, project.media);
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      if (result.media.length > 0) {
        addMedia(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
    }
  }, [addMedia, project.media, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const openBatchTranscode = useCallback((paths: string[] = []) => {
    setBatchTranscodeInitialPaths(paths);
    setBatchTranscodeOpen(true);
  }, []);

  const importVideosForStitchWizard = useCallback(async (): Promise<string[]> => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return [];
      }
      const result = await probeMediaPaths(paths, useEditorStore.getState().project.media);
      if (result.media.length > 0) {
        addMedia(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      return result.media.filter((asset) => asset.type === 'video').map((asset) => asset.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.videoStitchWizard.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      return [];
    }
  }, [addMedia, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const generateVideoStitchTimeline = useCallback(
    (settings: VideoStitchWizardSettings) => {
      try {
        const currentProject = useEditorStore.getState().project;
        const assets = settings.assetIds.flatMap((assetId) => {
          const asset = currentProject.media.find((item) => item.id === assetId && item.type === 'video');
          return asset ? [asset] : [];
        });
        if (assets.length < 2) {
          throw new Error(zhCN.videoStitchWizard.empty);
        }
        const track = createTrack({
          id: createId('track'),
          type: 'video',
          name: zhCN.videoStitchWizard.trackName,
          clips: []
        });
        const sequence = buildVideoStitchSequence(
          assets.map((asset) => ({ mediaId: asset.id, name: asset.name, duration: asset.duration || 5 })),
          {
            trackId: track.id,
            transitionEnabled: settings.transitionEnabled,
            transitionDuration: settings.transitionDuration
          }
        );
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
        for (const clip of sequence.clips) {
          commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        }
        for (const transition of sequence.transitions) {
          commandManager.execute(new AddTransitionCommand(timelineAccessor, transition));
        }
        setSelectedClipIds(sequence.clips.map((clip) => clip.id));
        setPlayheadTime(0);
        setTemplateExportPreset({
          id: 'video-stitch-wizard',
          name: zhCN.videoStitchWizard.exportPresetName,
          description: zhCN.videoStitchWizard.exportPresetDescription,
          builtin: true,
          settings: {
            width: settings.width,
            height: settings.height,
            fps: settings.fps,
            videoCodec: 'libx264',
            audioCodec: 'aac',
            format: 'mp4',
            outputMode: 'video',
            scaleMode: 'fit',
            targetAspectRatio: 'source',
            reframeOffsetX: 0,
            reframeOffsetY: 0,
            hardwareEncoding: false
          }
        });
        setVideoStitchWizardOpen(false);
        setExportDialogOpen(true);
        showToast({ kind: 'success', title: zhCN.videoStitchWizard.createdTitle, message: zhCN.videoStitchWizard.createdMessage(sequence.clips.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.videoStitchWizard.generateFailed, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
      }
    },
    [setPlayheadTime, setSelectedClipIds]
  );

  const saveNamedSnapshot = useCallback(
    async (name: string) => {
      try {
        const snapshot = await saveProjectSnapshot(project, name, projectPath);
        setSnapshotNameOpen(false);
        showToast({ kind: 'success', title: zhCN.projectSnapshots.saved, message: snapshot.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectSnapshots.saveFailed, message: error instanceof Error ? error.message : zhCN.projectSnapshots.saveFailed });
      }
    },
    [project, projectPath]
  );

  const restoreSnapshotProject = useCallback(
    (snapshotProject: Project) => {
      commandManager.execute(new LoadProjectCommand(projectAccessor, snapshotProject, zhCN.projectSnapshots.restoreCommand));
      clearSelectedClipIds();
      setPlayheadTime(0);
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const applySnapshotDiffSelection = useCallback(
    (sourceProject: Project, itemIds: string[]) => {
      const currentProject = useEditorStore.getState().project;
      const nextTimeline = applyTimelineVersionDiffSelection(currentProject.timeline, sourceProject.timeline, itemIds);
      const nextProject = replaceProjectActiveTimeline(currentProject, nextTimeline);
      commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.projectSnapshots.appliedDiffs));
      clearSelectedClipIds();
      setPlayheadTime(0);
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const scanDuplicateMedia = useCallback(async () => {
    try {
      const groups = await scanDuplicateMediaGroups(useEditorStore.getState().project.media);
      if (groups.length === 0) {
        showToast({ kind: 'info', title: zhCN.duplicateMedia.empty });
        return;
      }
      setDuplicateMediaGroups(groups);
      setDuplicateMediaOpen(true);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.duplicateMedia.scanFailed,
        message: error instanceof Error ? error.message : zhCN.duplicateMedia.scanFailedMessage
      });
    }
  }, []);

  const mergeDuplicateMediaGroups = useCallback((selections: DuplicateMediaMergeSelection[]) => {
    try {
      for (const selection of selections) {
        commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, selection.assetIds));
      }
      setDuplicateMediaOpen(false);
      setDuplicateMediaGroups([]);
      showToast({ kind: 'success', title: zhCN.duplicateMedia.mergedTitle, message: zhCN.duplicateMedia.mergedMessage(selections.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
    }
  }, []);

  const importSubtitles = useCallback(async () => {
    try {
      const paths = await pickSubtitlePaths();
      await importSubtitlePaths(paths);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.subtitleImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.subtitleImportFailedMessage });
    }
  }, [project.timeline]);

  const importDataSubtitles = useCallback(
    async (mode: SubtitleDataImportMode) => {
      try {
        const paths = await pickSubtitleDataPaths();
        await importSubtitleDataPaths(paths, mode);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.subtitleImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.subtitleImportFailedMessage });
      }
    },
    [selectedClipIds]
  );

  const openSyncCompare = useCallback(() => {
    const state = useEditorStore.getState();
    const refs = findSyncCompareClipRefs(state.project.timeline, state.selectedClipIds);
    if (refs.length !== 2) {
      showToast({ kind: 'warning', title: zhCN.syncCompare.unavailableTitle, message: zhCN.syncCompare.unavailableMessage });
      return;
    }
    setPlayheadTime(Math.min(refs[0].clip.start, refs[1].clip.start));
    setSyncCompareOpen(true);
  }, [setPlayheadTime]);

  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({ kind: 'error', title: zhCN.editorToasts.noCompatibleTrack, message: zhCN.editorToasts.noCompatibleTrackMessage });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, project.timeline);
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project, setSelectedClipId]
  );

  const addAdjustmentLayer = useCallback(() => {
    try {
      const adjustmentTrackCount = project.timeline.tracks.filter((track) => track.type === 'video' && track.clips.some((clip) => clip.type === 'adjustment')).length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.timeline.adjustmentTrackName(adjustmentTrackCount + 1),
        clips: []
      });
      const clip = createAdjustmentLayerClip(track, project.timeline);
      commandManager.execute(new AddAdjustmentLayerCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [project.timeline, setSelectedClipId]);

  const addTitleTemplate = useCallback(
    (templateId: TitleTemplateId) => {
      const track = project.timeline.tracks.find((item) => item.type === 'text');
      if (!track) {
        showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
        return;
      }
      try {
        const label = zhCN.titleTemplates[templateId];
        const clip = instantiateTitleTemplate(templateId, track, project.timeline, {
          name: label.name,
          text: label.defaultText
        });
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project.timeline, setSelectedClipId]
  );

  const createMediaFolder = useCallback((parentId?: string | null) => {
    try {
      commandManager.execute(new AddMediaFolderCommand(projectAccessor, { name: zhCN.mediaBin.newFolder, parentId }));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.mediaBin.newFolder, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, []);

  const renameMediaFolder = useCallback((folderId: string, name: string) => {
    commandManager.execute(new RenameMediaFolderCommand(projectAccessor, folderId, name));
  }, []);

  const deleteMediaFolder = useCallback((folderId: string) => {
    commandManager.execute(new DeleteMediaFolderCommand(projectAccessor, folderId));
  }, []);

  const setMediaFolderCollapsed = useCallback((folderId: string, collapsed: boolean) => {
    commandManager.execute(new SetMediaFolderCollapsedCommand(projectAccessor, folderId, collapsed));
  }, []);

  const moveMediaToFolder = useCallback((assetIds: string[], folderId?: string | null) => {
    commandManager.execute(new MoveMediaToFolderCommand(projectAccessor, assetIds, folderId));
  }, []);

  const relinkMedia = useCallback(
    async (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (!relinked) {
          return;
        }
        setMedia(project.media.map((item) => (item.id === assetId ? relinked : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    [project.media, setMedia]
  );

  const relinkAllMissing = useCallback(async () => {
    try {
      const result = await relinkMissingMediaInDirectory(project.media);
      setMedia(result.media);
      showToast({
        kind: result.relinkedCount > 0 ? 'success' : 'warning',
        title: zhCN.editorToasts.relinkComplete,
        message: zhCN.editorToasts.relinkCompleteMessage(result.relinkedCount, result.warnings.length)
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkMissingFailedMessage });
    }
  }, [project.media, setMedia]);

  const refreshProjectHealth = useCallback(async () => {
    try {
      setProjectHealthScanning(true);
      const state = useEditorStore.getState();
      setProjectHealthReport(await scanProjectHealth(state.project, useProxySettingsStore.getState().settings));
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectHealth.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.scanFailedMessage
      });
    } finally {
      setProjectHealthScanning(false);
    }
  }, []);

  const openProjectHealth = useCallback(() => {
    setProjectHealthOpen(true);
    void refreshProjectHealth();
  }, [refreshProjectHealth]);

  const relinkMissingFromHealth = useCallback(
    async (issue: MissingMediaIssue) => {
      const state = useEditorStore.getState();
      const asset = state.project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (relinked) {
          const current = useEditorStore.getState();
          current.setMedia(current.project.media.map((item) => (item.id === issue.assetId ? relinked : item)));
          showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
        }
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const removeOrphanFromHealth = useCallback(
    async (issue: OrphanMediaIssue) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, issue.assetId));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.orphanRemoved, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const mergeDuplicateFromHealth = useCallback(
    async (issue: DuplicateMediaIssue) => {
      try {
        commandManager.execute(new MergeMediaCommand(projectAccessor, issue.keepAssetId, issue.assets.map((asset) => asset.assetId)));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.duplicateMerged });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const queueProxyFromHealth = useCallback(
    async (issue: ProxyMissingIssue) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings);
        void ensureMediaJobRunner();
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.proxyQueued, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const separateSelectedAudio = useCallback(async () => {
    if (!selectedClip || (selectedClip.type !== 'audio' && selectedClip.type !== 'video') || !selectedClipMedia) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: zhCN.demucs.noClipSelected });
      return;
    }
    if (!demucsAvailability.ready) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: demucsAvailability.error ?? zhCN.demucs.notConfigured });
      return;
    }
    setAudioSeparationClipId(selectedClip.id);
    setAudioSeparationProgress(0);
    showToast({ kind: 'info', title: zhCN.demucs.runningTitle, message: zhCN.demucs.runningMessage(0) });
    try {
      const separation = await separateAudioForClip(selectedClip, selectedClipMedia, { executablePath: demucsExecutablePath });
      addMedia(separation.media);
      for (const track of separation.tracks) {
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      }
      const separatedClipIds = separation.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
      setSelectedClipIds(separatedClipIds);
      showToast({ kind: 'success', title: zhCN.demucs.completeTitle, message: zhCN.demucs.completeMessage(separation.media.length) });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.demucs.failedMessage;
      const canceled = message.toLowerCase().includes('canceled') || message.includes('取消');
      showToast({ kind: canceled ? 'warning' : 'error', title: canceled ? zhCN.demucs.canceledTitle : zhCN.demucs.failedTitle, message });
    } finally {
      setAudioSeparationClipId(undefined);
      setAudioSeparationProgress(undefined);
    }
  }, [addMedia, demucsAvailability, demucsExecutablePath, selectedClip, selectedClipMedia, setSelectedClipIds]);

  const cancelAudioSeparation = useCallback(async () => {
    if (!audioSeparationClipId) {
      return;
    }
    try {
      await cancelDemucs(audioSeparationClipId);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.demucs.cancelFailedTitle, message: error instanceof Error ? error.message : zhCN.demucs.failedMessage });
    }
  }, [audioSeparationClipId]);

  const startEditorRecording = useCallback(
    async (source: RecordingSource) => {
      if (recordingTask) {
        return;
      }
      const taskId = createId('recording');
      try {
        const result = await startRecording({
          taskId,
          source,
          width: recordingSettings.width,
          height: recordingSettings.height,
          frameRate: recordingSettings.frameRate
        });
        setRecordingTask({ taskId: result.taskId, source, outputPath: result.outputPath, startedAt: Date.now() });
        showToast({ kind: 'info', title: zhCN.recording.startedTitle, message: zhCN.recording.startedMessage(source) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.recording.startFailedTitle, message: error instanceof Error ? error.message : zhCN.recording.failedMessage });
      }
    },
    [recordingSettings, recordingTask]
  );

  const stopEditorRecording = useCallback(async () => {
    const task = recordingTask;
    if (!task) {
      return;
    }
    try {
      const result = await stopRecording(task.taskId);
      const imported = await probeMediaPaths([result.outputPath], useEditorStore.getState().project.media);
      if (imported.media.length > 0) {
        addMedia(imported.media);
      }
      showToast({ kind: 'success', title: zhCN.recording.stoppedTitle, message: zhCN.recording.importedMessage(imported.media.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.recording.stopFailedTitle, message: error instanceof Error ? error.message : zhCN.recording.failedMessage });
    } finally {
      setRecordingTask(undefined);
      setRecordingElapsedSeconds(0);
    }
  }, [addMedia, recordingTask]);

  const executeNewProject = useCallback(
    (nextProject: ReturnType<typeof createProject>, nextTemplatePreset?: ExportPreset) => {
      commandManager.execute(
        new NewProjectCommand(
          {
            getProject: projectAccessor.getProject,
            setProject: (project) => setProject(project, undefined)
          },
          nextProject,
          zhCN.toolbar.newProject
        )
      );
      commandManager.clear();
      setProjectPath(undefined);
      setDirty(false);
      setTemplateExportPreset(nextTemplatePreset);
    },
    [setDirty, setProject, setProjectPath]
  );

  const newProject = useCallback(async () => {
    if (dirty && !(await confirmDiscardChanges())) {
      return;
    }
    executeNewProject(createProject(zhCN.project.defaultName));
  }, [dirty, executeNewProject]);

  const createProjectFromTemplate = useCallback(
    async (templateId: ProjectTemplateId) => {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const copy = projectTemplateCopy(templateId);
      const instance = instantiateProjectTemplate(templateId, { name: copy.name });
      executeNewProject(instance.project, {
        id: `template-${templateId}`,
        name: copy.name,
        description: copy.description,
        builtin: true,
        settings: instance.exportSettings
      });
      setProjectTemplateOpen(false);
    },
    [dirty, executeNewProject]
  );

  const openProject = useCallback(async () => {
    try {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const path = await chooseProjectToOpen();
      if (!path) {
        return;
      }
      const nextProject = await readProjectFile(path);
      commandManager.clear();
      setProject(nextProject, path);
      void runAutomationForMedia('on-project-open', nextProject.media);
      setTemplateExportPreset(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.projectOpened });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.openFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.openFailedMessage });
    }
  }, [dirty, runAutomationForMedia, setProject]);

  const splitSelected = useCallback(() => {
    if (!selectedClip) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClip.id, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.splitUnavailable, message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage });
    }
  }, [playheadTime, selectedClip]);

  const seekSpectrumTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const match = findTimelineClipForMediaSourceTime(project.timeline, asset.id, sourceTime, selectedClip);
      if (match) {
        setSelectedClipId(match.clip.id);
        setPlayheadTime(match.timelineTime);
        return;
      }
      setPlayheadTime(sourceTime);
    },
    [project.timeline, selectedClip, setPlayheadTime, setSelectedClipId]
  );

  const setSpectrumSelectionRange = useCallback(
    (range: { inPoint: number; outPoint: number }) => {
      setInPoint(range.inPoint);
      setOutPoint(range.outPoint);
    },
    [setInPoint, setOutPoint]
  );

  const splitSpectrumAtTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const match = findTimelineClipForMediaSourceTime(project.timeline, asset.id, sourceTime, selectedClip);
      if (!match) {
        showToast({ kind: 'warning', title: zhCN.mediaBin.spectrum.splitFailedTitle, message: zhCN.mediaBin.spectrum.splitFailedMessage });
        return;
      }
      try {
        setSelectedClipId(match.clip.id);
        setPlayheadTime(match.timelineTime);
        commandManager.execute(new SplitClipCommand(timelineAccessor, match.clip.id, match.timelineTime));
      } catch (error) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitUnavailable, message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage });
      }
    },
    [project.timeline, selectedClip, setPlayheadTime, setSelectedClipId]
  );

  const detectSelectedBeats = useCallback(async () => {
    if (!selectedClip || !selectedClipMedia || (selectedClip.type !== 'audio' && selectedClip.type !== 'video') || (selectedClipMedia.type !== 'audio' && !selectedClipMedia.hasAudio)) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatDetectFailed, message: zhCN.editorToasts.beatDetectNoClip });
      return;
    }
    showToast({ kind: 'info', title: zhCN.editorToasts.beatDetectRunning, message: selectedClip.name });
    try {
      const sourceBeatTimes = await detectBeats(selectedClipMedia.path, beatSensitivity);
      const speed = getClipSpeed(selectedClip);
      const detected = sourceBeatTimes
        .map((sourceTime) => {
          const localTime = (sourceTime - selectedClip.trimStart) / speed;
          if (!Number.isFinite(localTime) || localTime < -0.000001 || localTime > selectedClip.duration + 0.000001) {
            return undefined;
          }
          return createBeatMarker(selectedClip.start + Math.min(selectedClip.duration, Math.max(0, localTime)));
        })
        .filter((marker): marker is ReturnType<typeof createBeatMarker> => Boolean(marker));
      if (detected.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.beatDetectFailed, message: zhCN.editorToasts.beatDetectNoMarkers });
        return;
      }
      const clipStart = selectedClip.start;
      const clipEnd = selectedClip.start + selectedClip.duration;
      const preserved = (project.beatMarkers ?? []).filter((marker) => marker.time < clipStart - 0.000001 || marker.time > clipEnd + 0.000001);
      commandManager.execute(new UpdateProjectBeatMarkersCommand(projectAccessor, [...preserved, ...detected]));
      showToast({ kind: 'success', title: zhCN.editorToasts.beatDetectComplete(detected.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.beatDetectFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.beatDetectNoMarkers });
    }
  }, [beatSensitivity, project.beatMarkers, selectedClip, selectedClipMedia]);

  const snapSelectedToBeats = useCallback(() => {
    const ids = selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : [];
    if (ids.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: zhCN.editorToasts.beatSnapNoSelection });
      return;
    }
    const beatTimes = (project.beatMarkers ?? []).map((marker) => marker.time);
    if (beatTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: zhCN.editorToasts.beatSnapNoMarkers });
      return;
    }
    try {
      const command = new SnapToBeatsCommand(timelineAccessor, ids, beatTimes, 0.35);
      commandManager.execute(command);
      setSelectedClipIds(ids);
      showToast({ kind: 'success', title: zhCN.editorToasts.beatSnapComplete(command.appliedUpdates.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, [project.beatMarkers, selectedClipId, selectedClipIds, setSelectedClipIds]);

  const splitSelectedToBeats = useCallback(() => {
    if (!selectedClip) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSplitNoSelection });
      return;
    }
    const beatTimes = (project.beatMarkers ?? []).map((marker) => marker.time);
    if (beatTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSnapNoMarkers });
      return;
    }
    const splitTimes = calculateBeatSplitTimesForClip(selectedClip, beatTimes);
    if (splitTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSplitNoMarkers });
      return;
    }
    try {
      commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, selectedClip.id, splitTimes));
      clearSelectedClipIds();
      showToast({ kind: 'success', title: zhCN.editorToasts.beatSplitComplete(splitTimes.length + 1), message: zhCN.editorToasts.beatSplitCompleteMessage(splitTimes.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, [clearSelectedClipIds, project.beatMarkers, selectedClip]);

  const createMulticamSequence = useCallback(() => {
    try {
      const command = new CreateMulticamSequenceCommand(projectAccessor, selectedClipIds, zhCN.timeline.multicamSequenceName(project.sequences.length));
      commandManager.execute(command);
      if (command.multicamClipId) {
        setSelectedClipId(command.multicamClipId);
        setSelectedClipIds([command.multicamClipId]);
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.multicamCreated });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.multicamCreateFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.multicamCreateFailedMessage });
    }
  }, [project.sequences.length, selectedClipIds, setSelectedClipId, setSelectedClipIds]);

  const applyPiPLayout = useCallback(() => {
    if (selectedPiPClips.length !== 2) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.pipApplyFailed, message: zhCN.editorToasts.pipApplyFailedMessage });
      return;
    }
    const [main, pip] = selectedPiPClips;
    const pipSource = getClipSourceDimensions(project, pip.clip);
    try {
      commandManager.execute(
        new PiPLayoutCommand(timelineAccessor, main.clip.id, pip.clip.id, {
          position: pipLayoutPosition,
          canvasWidth: project.settings.width,
          canvasHeight: project.settings.height,
          pipSourceWidth: pipSource.width,
          pipSourceHeight: pipSource.height
        })
      );
      setSelectedClipIds([pip.clip.id]);
      showToast({ kind: 'success', title: zhCN.editorToasts.pipApplied });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.pipApplyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.pipApplyFailedMessage });
    }
  }, [pipLayoutPosition, project, selectedPiPClips, setSelectedClipIds]);

  const applySplitLayout = useCallback(
    (layoutId: string) => {
      if (!canApplySplitLayout) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: zhCN.editorToasts.splitLayoutApplyFailedMessage });
        return;
      }
      const layout = getSplitLayoutDefinition(layoutId, customSplitLayouts);
      if (!layout) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: zhCN.editorToasts.splitLayoutMissingMessage });
        return;
      }
      const sources = Object.fromEntries(
        selectedSplitLayoutClips.map((item) => {
          const dimensions = getClipSourceDimensions(project, item.clip);
          return [item.clip.id, dimensions];
        })
      );
      try {
        commandManager.execute(
          new ApplySplitLayoutCommand(
            timelineAccessor,
            selectedSplitLayoutClips.map((item) => item.clip.id),
            {
              layout,
              canvasWidth: project.settings.width,
              canvasHeight: project.settings.height,
              sources
            }
          )
        );
        setSelectedClipIds(selectedSplitLayoutClips.map((item) => item.clip.id));
        showToast({ kind: 'success', title: zhCN.editorToasts.splitLayoutApplied });
      } catch (error) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.splitLayoutApplyFailedMessage });
      }
    },
    [canApplySplitLayout, customSplitLayouts, project, selectedSplitLayoutClips, setSelectedClipIds]
  );

  const saveCustomSplitLayout = useCallback(
    async (ratio: number) => {
      const layout = createMainSideSplitLayout(createId('split-layout'), zhCN.toolbar.customSplitLayoutName(customSplitLayouts.length + 1), ratio);
      const next = await saveCustomSplitLayouts([...customSplitLayouts, layout]);
      setCustomSplitLayouts(next);
      return layout.id;
    },
    [customSplitLayouts]
  );

  const importEdlTimeline = useCallback(
    (contents: string, path: string) => {
      const fileName = path.split(/[\\/]/).pop()?.replace(/\.edl$/i, '') || undefined;
      const command = new ImportEDLCommand(projectAccessor, contents, { sequenceName: fileName });
      commandManager.execute(command);
      clearSelectedClipIds();
      setPlayheadTime(0);
      const result = command.result;
      return {
        title: result?.title ?? fileName ?? zhCN.timelineExport.importEdl,
        matchedCount: result?.matchedCount ?? 0,
        missingCount: result?.missingCount ?? 0
      };
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const deleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    const groups = normalizeClipGroups(state.project.clipGroups, state.project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));
    const group = findCompleteClipGroup(groups, ids);
    if (group) {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      clearSelectedClipIds();
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const rippleDeleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, ids, state.project.protectedRanges));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const generateProxyForMedia = useCallback(
    async (assetId: string, options: ProxyGenerationOptions = {}) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? { ...item, proxyStatus: 'pending', proxyError: undefined } : item)));
      try {
        const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined }, proxySettings, options);
        setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? proxyAsset : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyReady, message: proxyAsset.name });
      } catch (error) {
        setMedia(
          useEditorStore
            .getState()
            .project.media.map((item) =>
              item.id === assetId
                ? { ...item, proxyStatus: 'error', proxyError: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage }
                : item
            )
        );
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage });
      }
    },
    [proxySettings, setMedia]
  );

  const deleteProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      const ids = new Set(assetIds);
      const media = useEditorStore.getState().project.media;
      const proxyPaths = media.filter((asset) => ids.has(asset.id) && asset.proxyPath).map((asset) => asset.proxyPath!);
      try {
        await Promise.all(proxyPaths.map((path) => bridgeRemoveFile(path).catch(() => undefined)));
        setMedia(
          useEditorStore.getState().project.media.map((asset) =>
            ids.has(asset.id)
              ? {
                  ...asset,
                  proxyPath: undefined,
                  proxyStatus: asset.type === 'video' ? 'none' : undefined,
                  proxyError: undefined
                }
              : asset
          )
        );
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyDeleted, message: zhCN.editorToasts.proxyDeletedMessage(proxyPaths.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyDeleteFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyDeleteFailedMessage });
      }
    },
    [setMedia]
  );

  const regenerateProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      for (const assetId of assetIds) {
        await generateProxyForMedia(assetId, { force: true });
      }
    },
    [generateProxyForMedia]
  );

  const convertVfrMediaToCfr = useCallback(
    (assetId: string) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      const cfrFrameRate = getProjectFrameRateConversionTarget(project.settings.fps, getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? 30));
      void generateProxyForMedia(assetId, { force: true, cfrFrameRate });
    },
    [generateProxyForMedia, project.settings.fps]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearMediaCache();
      showToast({ kind: 'success', title: zhCN.editorToasts.cacheCleared });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.cacheClearFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.cacheClearFailedMessage });
    }
  }, []);

  const undo = useCallback(() => commandManager.undo(), []);
  const switchToPreviousHistoryBranch = useCallback(() => commandManager.switchToPreviousBranch(), []);
  const redo = useCallback(() => commandManager.redo(), []);
  const togglePlayback = useCallback(() => {
    if (getTimelineDuration(project.timeline) === 0) {
      return;
    }
    const isPlaying = useEditorStore.getState().isPlaying;
    if (!isPlaying) {
      setPlaybackRate(1);
    }
    setIsPlaying(!isPlaying);
  }, [project.timeline, setIsPlaying, setPlaybackRate]);
  const reversePlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(-1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const pausePlayback = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const forwardPlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      const state = useEditorStore.getState();
      const fps = state.project.settings.fps || 30;
      setIsPlaying(false);
      setPlaybackRate(1);
      state.setPlayheadTime(state.playheadTime + direction / fps);
    },
    [setIsPlaying, setPlaybackRate]
  );

  const addAnnotationAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectAnnotationCommand(projectAccessor, {
          time: state.playheadTime,
          text: zhCN.timeline.annotationLabel((state.project.annotations?.length ?? 0) + 1),
          color: DEFAULT_PROJECT_ANNOTATION_COLOR
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.annotationRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addAnnotationFailed });
    }
  }, []);

  const addReviewAnnotationAtPlayhead = useCallback((annotation: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>) => {
    try {
      commandManager.execute(
        new AddReviewAnnotationCommand(projectAccessor, {
          ...annotation,
          color: annotation.color ?? DEFAULT_REVIEW_ANNOTATION_COLOR
        })
      );
      showToast({ kind: 'success', title: zhCN.preview.reviewAnnotationAdded, message: annotation.text });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.preview.reviewAnnotationFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewAnnotationFailedMessage });
    }
  }, []);

  const createReviewReport = useCallback(async () => {
    try {
      const outputPath = await saveReviewReport(useEditorStore.getState().project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.preview.reviewReportSaved, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.preview.reviewReportFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewReportFailedMessage });
    }
  }, []);

  const addBookmarkAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time: state.playheadTime,
          note: zhCN.timeline.bookmarkLabel((state.project.bookmarks?.length ?? 0) + 1)
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed });
    }
  }, []);

  const jumpTimelineNavigationPoint = useCallback(
    (direction: 'previous' | 'next') => {
      const state = useEditorStore.getState();
      const points = buildTimelineNavigationPoints(state.project.bookmarks, state.project.timeline.markers, getTimelineDuration(state.project.timeline));
      const point = findTimelineNavigationPoint(points, state.playheadTime, direction);
      if (point) {
        setPlayheadTime(point.time);
      }
    },
    [setPlayheadTime]
  );

  const exportBookmarks = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      const outputPath = await bridgeSaveFileDialog(`${state.project.name}-bookmarks.json`, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      if (!outputPath) {
        return;
      }
      await bridgeWriteFile(outputPath, serializeTimelineBookmarks(state.project.bookmarks ?? [], getTimelineDuration(state.project.timeline)));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksExported, message: outputPath });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksExportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksExportFailedMessage });
    }
  }, []);

  const importBookmarks = useCallback(async () => {
    try {
      const paths = await bridgeOpenFileDialog(false, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      const inputPath = paths[0];
      if (!inputPath) {
        return;
      }
      const state = useEditorStore.getState();
      const imported = parseTimelineBookmarksJson(await bridgeReadFile(inputPath), getTimelineDuration(state.project.timeline));
      const nextBookmarks = mergeImportedTimelineBookmarks(state.project.bookmarks ?? [], imported, getTimelineDuration(state.project.timeline));
      commandManager.execute(new UpdateProjectBookmarksCommand(projectAccessor, nextBookmarks));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksImported, message: zhCN.timeline.bookmarksImportedMessage(imported.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksImportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksImportFailedMessage });
    }
  }, []);

  const setSingleExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const range = createExportRange(
      {
        id: state.project.exportRanges[0]?.id,
        label: zhCN.timeline.exportRangeLabel(1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [range]));
  }, []);

  const appendExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const existing = normalizeExportRanges(state.project.exportRanges, duration);
    const range = createExportRange(
      {
        label: zhCN.timeline.exportRangeLabel(existing.length + 1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [...existing, range]));
  }, []);

  const markInPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setInPoint(time);
    if (typeof state.outPoint === 'number') {
      setSingleExportRange(time, state.outPoint);
    }
  }, [setInPoint, setSingleExportRange]);

  const markOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      setSingleExportRange(state.inPoint, time);
    }
  }, [setOutPoint, setSingleExportRange]);

  const markMultiRangeInPoint = useCallback(() => {
    setInPoint(useEditorStore.getState().playheadTime);
  }, [setInPoint]);

  const markMultiRangeOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      appendExportRange(state.inPoint, time);
    }
  }, [appendExportRange, setOutPoint]);

  const selectAllTimelineItems = useCallback(() => {
    const state = useEditorStore.getState();
    const clip = selectClipById(state.project, state.selectedClipId);
    const keyframes = clip ? collectClipKeyframeRefs(clip) : [];
    if (keyframes.length > 0) {
      setSelectedKeyframes(keyframes);
      return;
    }
    setSelectedClipIds(state.project.timeline.tracks.flatMap((track) => track.clips.map((item) => item.id)));
  }, [setSelectedClipIds, setSelectedKeyframes]);

  const shortcutHandlers = useMemo(
    () => ({
      togglePlayback,
      reversePlayback,
      pausePlayback,
      forwardPlayback,
      stepBackwardFrame: () => stepFrame(-1),
      stepForwardFrame: () => stepFrame(1),
      setInPoint: markInPoint,
      setOutPoint: markOutPoint,
      addExportRangeIn: markMultiRangeInPoint,
      addExportRangeOut: markMultiRangeOutPoint,
      deleteSelected,
      rippleDeleteSelected,
      splitSelected,
      selectAll: selectAllTimelineItems,
      clearSelection: clearSelectedClipIds,
      addAnnotation: addAnnotationAtPlayhead,
      addBookmark: addBookmarkAtPlayhead,
      toggleGridSnap: toggleTimelineGridSnap,
      jumpToPreviousNavigationPoint: () => jumpTimelineNavigationPoint('previous'),
      jumpToNextNavigationPoint: () => jumpTimelineNavigationPoint('next'),
      undo,
      switchToPreviousHistoryBranch,
      redo,
      save: () => void saveProject(),
      exportCurrentFrame: () => void exportCurrentFrame()
    }),
    [
      addAnnotationAtPlayhead,
      addBookmarkAtPlayhead,
      clearSelectedClipIds,
      deleteSelected,
      exportCurrentFrame,
      forwardPlayback,
      jumpTimelineNavigationPoint,
      markInPoint,
      markMultiRangeInPoint,
      markMultiRangeOutPoint,
      markOutPoint,
      pausePlayback,
      redo,
      reversePlayback,
      rippleDeleteSelected,
      saveProject,
      selectAllTimelineItems,
      setSelectedClipIds,
      splitSelected,
      stepFrame,
      switchToPreviousHistoryBranch,
      togglePlayback,
      toggleTimelineGridSnap,
      undo
    ]
  );

  const recordMacroHistory = useCallback(async (entry: MacroHistoryEntry) => {
    try {
      setMacroHistory(await appendMacroHistoryEntry(entry));
    } catch (error) {
      console.warn(zhCN.macros.history.title, error);
    }
  }, []);

  const startMacroRecording = useCallback(() => {
    macroRecorderRef.current = { active: true, replaying: false, steps: [] };
    setMacroRecordingActive(true);
    setMacroRecordingStepCount(0);
    showToast({ kind: 'info', title: zhCN.settings.macros.recordingStarted, message: zhCN.settings.macros.recordingStartedMessage });
  }, []);

  const stopMacroRecording = useCallback(async () => {
    const recorder = macroRecorderRef.current;
    if (!recorder.active) {
      return;
    }
    recorder.active = false;
    setMacroRecordingActive(false);
    setMacroRecordingStepCount(recorder.steps.length);
    const steps = recorder.steps;
    if (steps.length === 0) {
      showToast({ kind: 'warning', title: zhCN.settings.macros.recordingStopped, message: zhCN.settings.macros.recordingEmpty });
      return;
    }
    const defaultName = zhCN.settings.macros.recordingDefaultName(new Date().toLocaleString('zh-CN', { hour12: false }));
    const name = window.prompt(zhCN.settings.macros.recordNamePrompt, defaultName)?.trim();
    if (!name) {
      return;
    }
    try {
      const saved = await writeClipMacros([
        ...macros,
        {
          id: createId('macro'),
          name,
          description: zhCN.settings.macros.savedRecordingMessage(steps.length),
          steps
        }
      ]);
      setMacros(saved);
      showToast({ kind: 'success', title: zhCN.settings.macros.savedRecording, message: zhCN.settings.macros.savedRecordingMessage(steps.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.settings.macros.saveFailed, message: error instanceof Error ? error.message : zhCN.settings.macros.saveFailedMessage });
    }
  }, [macros]);

  const executeMacro = useCallback(
    async (macro: ClipMacro) => {
      const state = useEditorStore.getState();
      const target = findMacroTargetClip(state.project.timeline, state.selectedClipIds, state.playheadTime);
      const baseEntry = {
        id: createId('macro-history'),
        macroId: macro.id,
        macroName: macro.name,
        triggeredAt: new Date().toISOString(),
        shortcut: macro.shortcut
      };
      if (!target) {
        await recordMacroHistory({
          ...baseEntry,
          success: false,
          error: zhCN.settings.macros.noTargetClip
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.noTargetClip, message: zhCN.settings.macros.noTargetClipMessage });
        return;
      }
      try {
        const commands = buildMacroCommands(timelineAccessor, macro, target.id);
        if (commands.length === 0) {
          throw new Error(zhCN.settings.macros.invalidSteps);
        }
        macroRecorderRef.current.replaying = true;
        try {
          for (const command of commands) {
            commandManager.execute(command);
          }
        } finally {
          macroRecorderRef.current.replaying = false;
        }
        setSelectedClipId(target.id);
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: true
        });
        showToast({ kind: 'success', title: zhCN.settings.macros.executed, message: `${macro.name} · ${target.name}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : zhCN.settings.macros.executeFailed;
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: false,
          error: message
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.executeFailed, message });
      }
    },
    [recordMacroHistory, setSelectedClipId]
  );

  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useShortcuts(shortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, executeMacro);
  useBackgroundMediaJobs(project.media);

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: editorGridRows }} data-testid="editor-shell">
        <Toolbar
          onNewProject={newProject}
          onNewFromTemplate={() => setProjectTemplateOpen(true)}
          onOpenProject={openProject}
          onSaveProject={() => void saveProject()}
          onArchiveProject={() => void archiveCurrentProject()}
          onCreateMediaReport={() => void createMediaReport()}
          onCreateClipReport={() => void createClipReport()}
          onCreateSharePackage={() => void createCurrentSharePackage()}
          onImportBookmarks={() => void importBookmarks()}
          onExportBookmarks={() => void exportBookmarks()}
          onSaveSnapshot={() => setSnapshotNameOpen(true)}
          onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
          onOpenSnapshotCompare={() => setSnapshotCompareOpen(true)}
          onImportMedia={() => void importMedia()}
          onBatchTranscode={() => openBatchTranscode()}
          onOpenBatchWatermark={() => setBatchWatermarkOpen(true)}
          onOpenMediaPrecheck={() => setMediaPrecheckOpen(true)}
          onOpenVideoStitchWizard={() => setVideoStitchWizardOpen(true)}
          onOpenSyncCompare={openSyncCompare}
          onOpenSceneReorder={() => setSceneReorderOpen(true)}
          onDetectBeats={() => void detectSelectedBeats()}
          onSnapToBeats={snapSelectedToBeats}
          onSplitToBeats={splitSelectedToBeats}
          onOpenMacroHistory={() => setMacroHistoryOpen(true)}
          onStartMacroRecording={startMacroRecording}
          onStopMacroRecording={() => void stopMacroRecording()}
          onImportSubtitles={() => void importSubtitles()}
          onImportDataSubtitles={(mode) => void importDataSubtitles(mode)}
          onStartRecording={(source) => void startEditorRecording(source)}
          onStopRecording={() => void stopEditorRecording()}
          onExportVideo={() => setExportDialogOpen(true)}
          onExportTimeline={() => setTimelineExportDialogOpen(true)}
          onExportCurrentFrame={() => void exportCurrentFrame()}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={splitSelected}
          onToggleSmartRoughCut={() => {
            setHistoryPanelOpen(false);
            setSmartRoughCutOpen((open) => !open);
          }}
          onSeparateAudio={() => void separateSelectedAudio()}
          onCancelAudioSeparation={() => void cancelAudioSeparation()}
          onCreateMulticamSequence={createMulticamSequence}
          onApplyPiPLayout={applyPiPLayout}
          onApplySplitLayout={applySplitLayout}
          onSaveCustomSplitLayout={(ratio) => saveCustomSplitLayout(ratio)}
          canCreateMulticamSequence={canCreateMulticamSequence}
          canApplyPiPLayout={canApplyPiPLayout}
          canApplySplitLayout={canApplySplitLayout}
          canOpenSyncCompare={canOpenSyncCompare}
          canOpenSceneReorder={canOpenSceneReorder}
          pipLayoutPosition={pipLayoutPosition}
          onPiPLayoutPositionChange={setPiPLayoutPosition}
          customSplitLayouts={customSplitLayouts}
          canDetectBeats={canDetectBeats}
          canSnapToBeats={canSnapToBeats}
          canSplitToBeats={canSplitToBeats}
          beatSensitivity={beatSensitivity}
          onBeatSensitivityChange={setBeatSensitivity}
          canSeparateAudio={canSeparateSelectedAudio}
          audioSeparationRunning={Boolean(audioSeparationClipId)}
          audioSeparationProgress={audioSeparationProgress}
          macroRecordingActive={macroRecordingActive}
          macroRecordingStepCount={macroRecordingStepCount}
          recordingActive={Boolean(recordingTask)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          smartRoughCutOpen={smartRoughCutOpen}
          historyPanelOpen={historyPanelOpen}
          storyboardOpen={storyboardOpen}
          workspaceLayouts={workspaceLayouts}
          activeWorkspaceLayoutId={layoutSettings.activeWorkspaceLayoutId}
          onApplyWorkspaceLayout={applyWorkspaceLayoutById}
          onSaveWorkspaceLayout={() => void saveCurrentWorkspaceLayout()}
          safeFrameGuides={safeFrameGuides}
          thumbnailTrackVisible={thumbnailTrackVisible}
          previewQualityMode={previewPerformance.qualityMode}
          timelineGridSettings={timelineGridSettings}
          reviewMode={reviewMode}
          onToggleReviewMode={() => setReviewMode((mode) => !mode)}
          onCreateReviewReport={() => void createReviewReport()}
          onPreviewQualityModeChange={(qualityMode: PreviewQualityMode) => updatePreviewPerformance({ qualityMode })}
          onToggleTimelineGridSnap={toggleTimelineGridSnap}
          onTimelineGridUnitChange={changeTimelineGridUnit}
          onToggleStoryboard={() => setStoryboardOpen((open) => !open)}
          onToggleSafeFrameGuides={toggleSafeFrameGuides}
          onToggleThumbnailTrack={toggleThumbnailTrackVisible}
          onToggleHistoryPanel={() => {
            setSmartRoughCutOpen(false);
            setHistoryPanelOpen((open) => {
              const next = !open;
              persistPanelVisibilityPatch({ history: next });
              return next;
            });
          }}
          onUndo={undo}
          onRedo={redo}
          onClearCache={() => void clearCache()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenProjectHealth={openProjectHealth}
          sharePackageBusy={sharePackageBusy}
          autosaveIntervalSeconds={autosaveIntervalSeconds}
          onAutosaveIntervalSecondsChange={(seconds) => {
            setAutosaveIntervalSeconds(writeAutosaveIntervalSeconds(seconds));
          }}
          lastExportPath={lastExportPath}
          onRevealExport={lastExportPath ? () => void revealExport(lastExportPath) : undefined}
          lastBackupAt={lastBackupAt}
        />
        <main
          className="grid min-h-0 min-w-0 gap-px bg-line transition-[grid-template-columns] duration-200 ease-out"
          style={{ gridTemplateColumns: mainGridColumns }}
          data-testid="editor-main-layout"
          data-left-collapsed={effectivePanels.leftPanelCollapsed ? 'true' : 'false'}
          data-right-collapsed={effectivePanels.rightPanelCollapsed ? 'true' : 'false'}
          data-right-auto-collapsed={effectivePanels.rightPanelAutoCollapsed ? 'true' : 'false'}
          data-workspace-layout={layoutSettings.activeWorkspaceLayoutId}
          data-review-mode={reviewMode ? 'true' : 'false'}
        >
          {reviewVisibility.showLeftPanel ? (
            effectivePanels.leftPanelCollapsed ? (
              <CollapsedPanelRail
                side="left"
                label={zhCN.layout.mediaPanelCollapsed}
                title={zhCN.layout.expandMediaPanel}
                testId="left-panel-expand-button"
                onClick={() => persistLayoutPatch({ leftPanelCollapsed: false, panels: { ...layoutSettings.panels, mediaLibrary: true } })}
              />
            ) : (
              <section className="relative h-full min-h-0 min-w-0 overflow-hidden" data-testid="left-panel" data-collapsed="false">
                <button
                  className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                  type="button"
                  title={zhCN.layout.collapseMediaPanel}
                  aria-label={zhCN.layout.collapseMediaPanel}
                  data-testid="left-panel-collapse-button"
                  onClick={() => persistLayoutPatch({ leftPanelCollapsed: true, panels: { ...layoutSettings.panels, mediaLibrary: false } })}
                >
                  <ChevronLeft size={16} />
                </button>
                <MediaBin
                  media={project.media}
                  mediaFolders={project.mediaFolders}
                  mediaMetadata={project.mediaMetadata}
                  projectFrameRate={project.settings.fps}
                  onImport={() => void importMedia()}
                  onImportPaths={(paths) => void importDropped(paths)}
                  onBatchTranscode={(paths) => openBatchTranscode(paths)}
                  onExportGif={(asset) => setGifExportAsset(asset)}
                  onAnalyzeSpectrum={(asset) => setSpectrumAsset(asset)}
                  onScanDuplicates={() => void scanDuplicateMedia()}
                  onAddToTimeline={addAssetToTimeline}
                  onAddAdjustmentLayer={addAdjustmentLayer}
                  onRelink={(assetId) => void relinkMedia(assetId)}
                  onRelinkAll={() => void relinkAllMissing()}
                  onGenerateProxy={(assetId) => void generateProxyForMedia(assetId)}
                  onConvertToCfr={convertVfrMediaToCfr}
                  onSetLabel={(assetId, labelColor) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], labelColor })}
                  onSetRating={(assetId, rating) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], rating })}
                  onSetFlag={(assetId, flag) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], flag })}
                  onAddTitleTemplate={addTitleTemplate}
                  onCreateFolder={createMediaFolder}
                  onRenameFolder={renameMediaFolder}
                  onDeleteFolder={deleteMediaFolder}
                  onSetFolderCollapsed={setMediaFolderCollapsed}
                  onMoveMediaToFolder={moveMediaToFolder}
                />
              </section>
            )
          ) : null}
          <ErrorBoundary name={zhCN.panels.preview}>
            <Suspense fallback={<PanelLoading label={zhCN.panels.preview} />}>
              <PreviewCanvas
                safeFrameGuides={safeFrameGuides}
                previewPerformance={previewPerformance}
                colorScopesVisible={layoutSettings.panels.colorScopes}
                onColorScopesVisibleChange={(colorScopes) => persistPanelVisibilityPatch({ colorScopes })}
                reviewMode={reviewMode}
                onAddReviewAnnotation={addReviewAnnotationAtPlayhead}
                onExportReviewReport={() => void createReviewReport()}
              />
            </Suspense>
          </ErrorBoundary>
          {reviewVisibility.showRightPanel ? (
            effectivePanels.rightPanelCollapsed ? (
              <CollapsedPanelRail
                side="right"
                label={zhCN.layout.inspectorPanelCollapsed}
                title={zhCN.layout.expandInspectorPanel}
                testId="right-panel-expand-button"
                onClick={() => persistLayoutPatch({ rightPanelCollapsed: false, panels: { ...layoutSettings.panels, inspector: true } })}
              />
            ) : (
              <aside
                className="relative grid h-full min-h-0 min-w-0 gap-px bg-line transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: rightPanelRows }}
                data-testid="right-panel"
                data-collapsed="false"
              >
              <button
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                type="button"
                title={zhCN.layout.collapseInspectorPanel}
                aria-label={zhCN.layout.collapseInspectorPanel}
                data-testid="right-panel-collapse-button"
                onClick={() => persistLayoutPatch({ rightPanelCollapsed: true, panels: { ...layoutSettings.panels, inspector: false, audioMixer: false } })}
              >
                <ChevronRight size={16} />
              </button>
              {effectivePanels.rightPrimaryPanelVisible ? (
                <ErrorBoundary name={historyPanelOpen ? zhCN.panels.history : smartRoughCutOpen ? zhCN.panels.smartRoughCut : zhCN.panels.inspector}>
                  <Suspense fallback={<PanelLoading label={historyPanelOpen ? zhCN.panels.history : smartRoughCutOpen ? zhCN.panels.smartRoughCut : zhCN.panels.inspector} />}>
                    {historyPanelOpen ? (
                      <HistoryPanel />
                    ) : smartRoughCutOpen ? (
                      <SmartRoughCutPanel selectedClip={selectedClip} media={project.media} />
                    ) : layoutSettings.panels.inspector ? (
                      <Inspector
                        clip={selectedClip}
                        selectedClips={selectedClips}
                        selectedCount={selectedClipIds.length}
                        selectedClipLocked={selectedClipLocked}
                        selectedKeyframe={selectedKeyframe}
                        selectedKeyframes={selectedKeyframes}
                        media={project.media}
                        playheadTime={playheadTime}
                        projectSettings={project.settings}
                      />
                    ) : null}
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              {effectivePanels.audioMixerVisible ? (
                <ErrorBoundary name={zhCN.panels.audioMixer}>
                  <Suspense fallback={<PanelLoading label={zhCN.panels.audioMixer} compact />}>
                    <AudioMixer />
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              </aside>
            )
          ) : null}
        </main>
        {reviewVisibility.showTimelineResizeHandle ? (
          <div
            className="flex cursor-row-resize items-center justify-center bg-line text-slate-500 transition hover:bg-brand/20 hover:text-brand"
            role="separator"
            aria-orientation="horizontal"
            aria-label={zhCN.layout.resizeTimeline}
            data-testid="timeline-resize-handle"
            onPointerDown={beginTimelineResize}
          >
            <GripHorizontal size={18} />
          </div>
        ) : null}
        {reviewVisibility.showTimeline ? (
          <section className="min-h-0 overflow-hidden transition-[height] duration-200 ease-out" data-testid="timeline-panel" style={{ height: timelineHeightPx }}>
            <ErrorBoundary name={storyboardOpen ? zhCN.storyboard.title : zhCN.panels.timeline}>
              {storyboardOpen ? (
                <StoryboardView />
              ) : (
                <Timeline
                  thumbnailTrackVisible={thumbnailTrackVisible}
                  timelineGridSettings={timelineGridSettings}
                  bookmarkPanelOpen={layoutSettings.panels.bookmarks}
                  onBookmarkPanelOpenChange={(bookmarks) => persistPanelVisibilityPatch({ bookmarks })}
                  onConvertMediaFrameRate={convertVfrMediaToCfr}
                />
              )}
            </ErrorBoundary>
          </section>
        ) : null}
        <Suspense fallback={null}>
          {exportDialogOpen ? (
            <ExportDialog
              project={project}
              initialPreset={templateExportPreset}
              selectedClipIds={selectedClipIds}
              inPoint={inPoint}
              outPoint={outPoint}
              onClose={() => setExportDialogOpen(false)}
              onCompleted={(path) => {
                setLastExportPath(path);
                void runAutomationForMedia('on-export-complete', useEditorStore.getState().project.media);
              }}
              onRelinkMissing={() => void relinkAllMissing()}
            />
          ) : null}
          {projectTemplateOpen ? <ProjectTemplateDialog onSelect={(templateId) => void createProjectFromTemplate(templateId)} onClose={() => setProjectTemplateOpen(false)} /> : null}
          {timelineExportDialogOpen ? <TimelineExportDialog project={project} onClose={() => setTimelineExportDialogOpen(false)} onImportEdl={importEdlTimeline} /> : null}
          {snapshotNameOpen ? <SnapshotNameDialog defaultName={project.name} onConfirm={(name) => void saveNamedSnapshot(name)} onClose={() => setSnapshotNameOpen(false)} /> : null}
          {snapshotHistoryOpen ? (
            <SnapshotHistoryDialog projectId={project.id} projectPath={projectPath} onRestore={restoreSnapshotProject} onClose={() => setSnapshotHistoryOpen(false)} />
          ) : null}
          {snapshotCompareOpen ? (
            <SnapshotVersionCompareDialog project={project} projectPath={projectPath} onApply={applySnapshotDiffSelection} onClose={() => setSnapshotCompareOpen(false)} />
          ) : null}
          {batchTranscodeOpen ? (
            <BatchTranscodeDialog
              initialPaths={batchTranscodeInitialPaths}
              existingMedia={project.media}
              onImport={addMedia}
              onClose={() => {
                setBatchTranscodeOpen(false);
                setBatchTranscodeInitialPaths([]);
              }}
            />
          ) : null}
          {batchWatermarkOpen ? <BatchWatermarkDialog project={project} onClose={() => setBatchWatermarkOpen(false)} /> : null}
          {gifExportAsset ? <GifExportDialog asset={gifExportAsset} onClose={() => setGifExportAsset(undefined)} /> : null}
          {spectrumAsset ? (
            <AudioSpectrumDialog
              asset={spectrumAsset}
              onClose={() => setSpectrumAsset(undefined)}
              onSeek={(time) => seekSpectrumTime(spectrumAsset, time)}
              onSelection={setSpectrumSelectionRange}
              onSplitAtTime={(time) => splitSpectrumAtTime(spectrumAsset, time)}
            />
          ) : null}
          {mediaPrecheckOpen ? <MediaPrecheckPanel project={project} onClose={() => setMediaPrecheckOpen(false)} onJumpToMedia={jumpToMediaAsset} /> : null}
          {videoStitchWizardOpen ? (
            <VideoStitchWizardDialog
              media={project.media}
              projectSettings={project.settings}
              onImportVideos={importVideosForStitchWizard}
              onGenerate={generateVideoStitchTimeline}
              onClose={() => setVideoStitchWizardOpen(false)}
            />
          ) : null}
          {syncCompareOpen && syncCompareClipRefs.length === 2 ? (
            <SyncComparePanel clips={[syncCompareClipRefs[0], syncCompareClipRefs[1]]} project={project} onClose={() => setSyncCompareOpen(false)} />
          ) : null}
          {sceneReorderOpen ? <SceneReorderDialog project={project} selectedClipIds={selectedClipIds} onClose={() => setSceneReorderOpen(false)} /> : null}
          {timelineSearchOpen ? <TimelineSearchPanel project={project} onClose={() => setTimelineSearchOpen(false)} /> : null}
          {settingsOpen ? (
            <SettingsDialog
              open={settingsOpen}
              project={project}
              selectedClip={selectedClip}
              shortcutBindings={shortcutBindings}
              macros={macros}
              onShortcutBindingsChange={setShortcutBindings}
              onMacrosChange={setMacros}
              onExecuteMacro={(macro) => void executeMacro(macro)}
              previewPerformance={previewPerformance}
              onPreviewSkipFramesChange={(skipFrames: PreviewSkipFrames) => updatePreviewPerformance({ skipFrames })}
              onDeleteProxies={(assetIds) => deleteProxiesForMedia(assetIds)}
              onRegenerateProxies={(assetIds) => regenerateProxiesForMedia(assetIds)}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
          {macroHistoryOpen ? <MacroHistoryDialog entries={macroHistory} onClose={() => setMacroHistoryOpen(false)} /> : null}
        </Suspense>
        {projectHealthOpen ? (
          <ProjectHealthDialog
            report={projectHealthReport}
            scanning={projectHealthScanning}
            onClose={() => setProjectHealthOpen(false)}
            onRescan={() => void refreshProjectHealth()}
            onRelink={(issue) => void relinkMissingFromHealth(issue)}
            onRemoveOrphan={(issue) => void removeOrphanFromHealth(issue)}
            onMergeDuplicate={(issue) => void mergeDuplicateFromHealth(issue)}
            onQueueProxy={(issue) => void queueProxyFromHealth(issue)}
          />
        ) : null}
        {duplicateMediaOpen ? (
          <DuplicateMediaDialog
            groups={duplicateMediaGroups}
            onConfirm={mergeDuplicateMediaGroups}
            onClose={() => setDuplicateMediaOpen(false)}
          />
        ) : null}
        {recoveryCandidate ? (
          <AutosaveRecoveryDialog
            onRestore={() => void restoreRecovery()}
            onDiscard={() => void discardRecovery()}
          />
        ) : null}
        {exportQueueRecovery ? (
          <ExportQueueRecoveryDialog
            candidate={exportQueueRecovery}
            onRestoreAll={() => void restoreExportQueueRecovery(exportQueueRecovery.tasks.map((task) => task.id))}
            onRestoreSelected={(taskIds) => void restoreExportQueueRecovery(taskIds)}
            onDiscardAll={() => void discardExportQueueRecovery()}
          />
        ) : null}
        {archiveProgress ? <ArchiveProgressDialog progress={archiveProgress} /> : null}
        {sharePackageProgress ? <SharePackageProgressDialog progress={sharePackageProgress} /> : null}
      </div>
    </ErrorBoundary>
  );

  async function restoreRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      const restored = await restoreAutosaveRecovery(recoveryCandidate);
      commandManager.clear();
      setProject(restored, recoveryCandidate.projectPath);
      setDirty(true);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.recoveryRestored, message: recoveryCandidate.autosavePath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.recoveryFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.recoveryFailedMessage });
    }
  }

  async function discardRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      await discardAutosaveRecovery(recoveryCandidate);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'info', title: zhCN.editorToasts.recoveryDiscarded });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.discardFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.discardFailedMessage });
    }
  }

  async function importDropped(paths: string[]): Promise<void> {
    try {
      const subtitlePaths = paths.filter(isSubtitlePath);
      const mediaPaths = paths.filter((path) => !isSubtitlePath(path));
      if (mediaPaths.length > 0) {
        const result = await probeMediaPaths(mediaPaths, project.media);
        if (result.duplicateCount > 0) {
          showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
        }
        addMedia(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
      }
      if (subtitlePaths.length > 0) {
        await importSubtitlePaths(subtitlePaths);
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.dropImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.dropImportFailedMessage });
    }
  }

  async function importSubtitlePaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      const track = buildSubtitleTrackFromSrt(path, contents, useEditorStore.getState().project.timeline);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.noSubtitlesFound, message: path });
        continue;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      importedCount += track.clips.length;
      setSelectedClipId(track.clips[0]?.id);
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: zhCN.editorToasts.subtitlesImported, message: zhCN.editorToasts.subtitlesImportedMessage(importedCount) });
    }
  }

  async function importSubtitleDataPaths(paths: string[], mode: SubtitleDataImportMode): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      let cues = parseSubtitleDataFile(path, contents);
      const overlaps = detectSubtitleDataOverlaps(cues);
      if (overlaps.length > 0) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.subtitleDataImportOverlaps,
          message: zhCN.editorToasts.subtitleDataImportOverlapsMessage(overlaps.length)
        });
        const shouldMerge = await bridgeConfirm(zhCN.editorToasts.subtitleDataImportMergePrompt(overlaps.length));
        if (shouldMerge) {
          cues = mergeOverlappingSubtitleDataCues(cues);
        }
      }
      const timeline = useEditorStore.getState().project.timeline;
      const targetTrackId = getSubtitleDataImportTargetTrackId(timeline, mode, selectedClipIds);
      const track = buildSubtitleTrackFromDataCues(path, cues, timeline, mode === 'new-track' ? undefined : targetTrackId);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.noSubtitlesFound, message: path });
        continue;
      }
      commandManager.execute(new BatchImportSubtitleCommand(timelineAccessor, track, { mode, targetTrackId }));
      importedCount += track.clips.length;
      setSelectedClipIds(track.clips.map((clip) => clip.id));
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: zhCN.editorToasts.subtitlesImported, message: zhCN.editorToasts.subtitlesImportedMessage(importedCount) });
    }
  }
}

function getSubtitleDataImportTargetTrackId(timeline: CoreTimeline, mode: SubtitleDataImportMode, selectedClipIds: string[]): string | undefined {
  if (mode === 'new-track') {
    return undefined;
  }
  const selected = new Set(selectedClipIds);
  const selectedSubtitleTrack = timeline.tracks.find((track) => track.type === 'subtitle' && track.clips.some((clip) => selected.has(clip.id)));
  return selectedSubtitleTrack?.id ?? timeline.tracks.find((track) => track.type === 'subtitle')?.id;
}

function PanelLoading({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex min-h-0 items-center justify-center bg-white text-xs text-slate-500 ${compact ? 'h-full' : 'h-full p-4'}`} data-testid="lazy-panel-loading">
      {label}
    </div>
  );
}

function CollapsedPanelRail({
  side,
  label,
  title,
  testId,
  onClick
}: {
  side: 'left' | 'right';
  label: string;
  title: string;
  testId: string;
  onClick(): void;
}) {
  const Icon = side === 'left' ? ChevronRight : ChevronLeft;
  return (
    <aside className="flex min-h-0 min-w-0 flex-col items-center gap-3 bg-white px-1.5 py-2" data-testid={`${side}-panel`} data-collapsed="true">
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel text-slate-600 hover:bg-white"
        type="button"
        title={title}
        aria-label={title}
        data-testid={testId}
        onClick={onClick}
      >
        <Icon size={16} />
      </button>
      <div className="text-[11px] font-semibold text-slate-500" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </div>
    </aside>
  );
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function isEditableKeyboardEventTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

function getWorkspaceLayoutDisplayName(layout: WorkspaceLayoutDefinition): string {
  return layout.builtIn ? zhCN.toolbar.workspaceLayouts[layout.id as keyof typeof zhCN.toolbar.workspaceLayouts] ?? layout.name : layout.name;
}

function findTimelineClipForMediaSourceTime(
  timeline: CoreTimeline,
  mediaId: string,
  sourceTime: number,
  preferredClip?: Clip
): { clip: Clip; timelineTime: number } | undefined {
  const candidates = [
    ...(preferredClip ? [preferredClip] : []),
    ...timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.id !== preferredClip?.id)
  ];
  for (const clip of candidates) {
    if (!('mediaId' in clip) || clip.mediaId !== mediaId) {
      continue;
    }
    const speed = Math.max(0.001, getClipSpeed(clip));
    const localTime = (sourceTime - clip.trimStart) / speed;
    if (localTime <= 0.000001 || localTime >= clip.duration - 0.000001) {
      continue;
    }
    return { clip, timelineTime: clip.start + localTime };
  }
  return undefined;
}

function isPiPVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

function isSceneReorderClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image';
}

function getClipSourceDimensions(project: Project, clip: Clip): { width: number; height: number } {
  if (clip.type === 'nested-sequence') {
    return { width: project.settings.width, height: project.settings.height };
  }
  if ('mediaId' in clip) {
    const asset = project.media.find((item) => item.id === clip.mediaId);
    return {
      width: Math.max(1, asset?.width || project.settings.width),
      height: Math.max(1, asset?.height || project.settings.height)
    };
  }
  return { width: project.settings.width, height: project.settings.height };
}

function collectClipKeyframeRefs(clip: Clip): Array<{ clipId: string; property: KeyframeProperty; keyframeId: string }> {
  return (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).flatMap((property) =>
    (clip.keyframes?.[property] ?? []).map((frame) => ({ clipId: clip.id, property, keyframeId: frame.id }))
  );
}

function moveAutomationMediaToGroup(assetId: string, groupName: string): void {
  const name = groupName.trim();
  if (!name) {
    return;
  }
  let folder = projectAccessor.getProject().mediaFolders.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!folder) {
    const command = new AddMediaFolderCommand(projectAccessor, { name });
    commandManager.execute(command);
    folder = command.folder;
  }
  if (folder) {
    commandManager.execute(new MoveMediaToFolderCommand(projectAccessor, [assetId], folder.id));
  }
}

function AutosaveRecoveryDialog({ onRestore, onDiscard }: { onRestore(): void; onDiscard(): void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="autosave-recovery-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.autosaveRecovery.title}</h2>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" onClick={onDiscard} data-testid="autosave-discard-button">
            {zhCN.autosaveRecovery.discard}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" onClick={onRestore} data-testid="autosave-restore-button">
            {zhCN.autosaveRecovery.restore}
          </button>
        </div>
      </section>
    </div>
  );
}

function ExportQueueRecoveryDialog({
  candidate,
  onRestoreAll,
  onRestoreSelected,
  onDiscardAll
}: {
  candidate: ExportQueueRecoveryCandidate;
  onRestoreAll(): void;
  onRestoreSelected(taskIds: string[]): void;
  onDiscardAll(): void;
}) {
  const [selectedIds, setSelectedIds] = useState(() => candidate.tasks.map((task) => task.id));
  const selected = new Set(selectedIds);
  const t = zhCN.exportDialog.recovery;

  function toggleTask(taskId: string, checked: boolean): void {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, taskId])) : current.filter((id) => id !== taskId)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="export-queue-recovery-dialog">
      <section className="w-full max-w-lg rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{t.title(candidate.tasks.length)}</h2>
          <div className="mt-1 text-xs text-slate-500">
            {t.pendingSummary(candidate.pendingCount)} · {t.interruptedSummary(candidate.interruptedCount)}
          </div>
        </div>
        <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {candidate.tasks.map((task) => (
              <label key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-line px-3 py-2 text-xs" data-testid="export-queue-recovery-task">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={selected.has(task.id)}
                  aria-label={t.selectTask}
                  onChange={(event) => toggleTask(task.id, event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{task.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{task.outputPath}</span>
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700" data-testid="export-queue-recovery-task-status" data-status={task.status}>
                  {zhCN.exportDialog.status[task.status]}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" data-testid="export-queue-discard-all" onClick={onDiscardAll}>
            {t.discardAll}
          </button>
          <button
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            data-testid="export-queue-restore-selected"
            disabled={selectedIds.length === 0}
            onClick={() => onRestoreSelected(selectedIds)}
          >
            {t.restoreSelected}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" type="button" data-testid="export-queue-restore-all" onClick={onRestoreAll}>
            {t.restoreAll}
          </button>
        </div>
      </section>
    </div>
  );
}

function ArchiveProgressDialog({ progress }: { progress: ArchiveProgress }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="archive-progress-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.projectArchive.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="text-sm font-medium text-ink" data-testid="archive-progress-message">
            {zhCN.projectArchive.copying(progress.copied, progress.total)}
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div
              className="h-full bg-brand transition-[width]"
              style={{ width: `${progress.total > 0 ? Math.round((progress.copied / progress.total) * 100) : 100}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SharePackageProgressDialog({ progress }: { progress: SharePackageWorkflowProgress }) {
  const label = progress.stage === 'exporting' ? zhCN.sharePackage.exporting : zhCN.sharePackage.packing(progress.current, progress.total);
  const percent = progress.total > 0 ? Math.round(progress.progress * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="share-package-progress-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.sharePackage.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
            <span data-testid="share-package-progress-message">{label}</span>
            <span className="tabular-nums text-slate-500">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function projectTemplateCopy(templateId: ProjectTemplateId): { name: string; description: string } {
  const templates = zhCN.projectTemplates.templates;
  switch (templateId) {
    case 'vertical-short':
      return templates.verticalShort;
    case 'youtube-horizontal':
      return templates.youtubeHorizontal;
    case 'square-social':
      return templates.squareSocial;
    case 'podcast':
      return templates.podcast;
    case 'cinema':
      return templates.cinema;
  }
}
