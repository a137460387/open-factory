import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AutoRepairProjectHealthCommand,
  AddClipCommand,
  AddMediaFolderCommand,
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddSpeakerDiarizationTracksCommand,
  AddProjectBookmarkCommand,
  AddSubclipCommand,
  BatchImportSubtitleCommand,
  BatchAlignToBeatCommand,
  BatchRenameMediaCommand,
  BatchShiftClipsCommand,
  BatchUpdateMetadataCommand,
  AddTrackCommand,
  AddTransitionCommand,
  buildConformMediaReplacements,
  buildConformPreflight,
  buildConformReport,
  ConformMediaCommand,
  UpdateProjectMediaCollectionsCommand,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_REVIEW_ANNOTATION_COLOR,
  DeleteMediaFolderCommand,
  DeleteSubclipCommand,
  LoadProjectCommand,
  MergeMediaCommand,
  NewProjectCommand,
  RemoveMediaCommand,
  MoveMediaToFolderCommand,
  RenameMediaFolderCommand,
  SetMediaFolderCollapsedCommand,
  SplitClipAtTimesCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectExportRangesCommand,
  UpdateProjectReleaseVersionCommand,
  UpdateProjectSpeakersCommand,
  UpdateClipCommand,
  UpdateSubclipCommand,
  createBeatMarker,
  calculateBeatSplitTimesForClip,
  estimateBpmFromBeatMarkers,
  createExportRange,
  createId,
  createProject,
  createSubclip,
  createTrack,
  buildVideoStitchSequence,
  buildCoverFrameBatchTasks,
  buildTimelineNavigationPoints,
  detectSubtitleDataOverlaps,
  dirname,
  round,
  replaceMediaPathBasename,
  getClipSpeed,
  getCfrTargetFrameRate,
  getColorSpaceDisplayName,
  getProjectFrameRateConversionTarget,
  getTimelineDuration,
  isFrameRateMismatch,
  findSyncCompareClipRefs,
  findTimelineNavigationPoint,
  normalizeProjectWorkingColorSpace,
  normalizeProjectSpeakers,
  normalizeExportRanges,
  resolveAutoAudioSyncApplyRoute,
  applyTimelineVersionDiffSelection,
  instantiateProjectTemplate,
  mergeImportedTimelineBookmarks,
  addMediaVersion as appendMediaVersion,
  buildMediaVersionCompareRequest,
  parseTimelineBookmarksJson,
  mergeOverlappingSubtitleDataCues,
  replaceProjectActiveTimeline,
  serializeTimelineBookmarks,
  applyArchiveRelinkPlan,
  shouldAutoShowMediaHealthDashboard,
  type DuplicateMediaGroup,
  type DuplicateMediaIssue,
  type MediaHealthDashboard,
  type MediaCleanupReport,
  type MissingMediaIssue,
  type MediaAsset,
  type MediaLabelColor,
  type MediaFlag,
  type OrphanMediaIssue,
  type ProjectHealthReport,
  type Project,
  type ProjectSpeaker,
  type ReviewAnnotation,
  type Clip,
  type Subclip,
  type BatchEditableMediaMetadata,
  type ClipContentAnalysis,
  type BeatSensitivity,
  type KeyframeProperty,
  type PiPLayoutPosition,
  type ProjectTemplateId,
  type ProxyMissingIssue,
  type ProjectHealthRepairReport,
  type SplitLayoutDefinition,
  type SubtitleDataImportMode,
  type Timeline as CoreTimeline,
  type TimelineGridSettings,
  type TimelineGridUnit,
  type TitleTemplateId,
  type ExportTask,
  type EffectPreset,
  type AutoAudioSyncApplyMode,
  type AutoAudioSyncResult,
  type MediaVersionCompareRequest,
  type MediaRenamePreviewItem,
  type SmartDuplicateGroup,
  matchConformByFilename,
  hasLowConfidenceSpeakerSegments,
} from '@open-factory/editor-core';
import {
  type ClipboardKeyframeGroup,
  type PasteMode,
  PasteKeyframesCommand,
} from '@open-factory/editor-core';
import { Toolbar } from './Toolbar';
import { runConfiguredAutomationForMedia, type AutomationActionDependencies } from '../automation/automation-rules';
import { ErrorBoundary } from './common/ErrorBoundary';
import { MediaBin } from './MediaBin/MediaBin';
import { ShortcutCheatsheetPanel } from './ShortcutCheatsheetPanel';

import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useExportQueue } from '../hooks/useExportQueue';
import { useMacroShortcuts } from '../hooks/useMacroShortcuts';
import { useEditorShellSettings } from '../hooks/useEditorShellSettings';
import { useEditorShellInteractions } from '../hooks/useEditorShellInteractions';
import { useEditorShellProfiler } from '../hooks/useEditorShellProfiler';
import { useEditorShellOperationRecording } from '../hooks/useEditorShellOperationRecording';
import { useProjectHealthCallbacks, useAudioAnalysisCallbacks, useBeatSyncCallbacks, useRecordingCallbacks } from '../hooks/useEditorShellCallbacks';
import { useContentAnalysisCallbacks } from '../hooks/useEditorShellContentAnalysisCallbacks';
import { useProxyCallbacks } from '../hooks/useEditorShellProxyCallbacks';
import { useEditorShellViewSettingsCallbacks } from '../hooks/useEditorShellViewSettingsCallbacks';
import { useEditorShellPlaybackCallbacks } from '../hooks/useEditorShellPlaybackCallbacks';
import { useEditorShellProjectCallbacks } from '../hooks/useEditorShellProjectCallbacks';
import { useEditorShellMediaCallbacks } from '../hooks/useEditorShellMediaCallbacks';
import { useEditorShellTimelineCallbacks } from '../hooks/useEditorShellTimelineCallbacks';
import { useEditorShellMiscCallbacks } from '../hooks/useEditorShellMiscCallbacks';
import { useShortcuts } from '../hooks/useShortcuts';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import { isEditableKeyboardTarget, isShortcutCheatsheetKey } from '../accessibility/keyboard-navigation';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import { useExportQueueStore } from '../export/export-queue-store';
import { revealExport } from '../lib/exportVideo';
import { createClipFromAsset } from '../lib/clipFactory';
import { zhCN, t } from '../i18n/strings';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import { PerformanceAlertIcon } from './PerformanceAlertIcon';
import {
  applyWorkspaceLayout,
  BUILT_IN_WORKSPACE_LAYOUT_IDS,
  clampTimelineHeight,
  createCustomWorkspaceLayout,
  getEffectivePanelState,
  getWorkspaceLayoutById,
  resolveWorkspaceLayoutShortcut,
  type WorkspaceLayoutDefinition,
  type WorkspaceLayoutId
} from '../layout/layoutSettings';
import type { ExportPreset } from '../export/export-presets';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { generateMediaFingerprint, scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import { buildArchiveDestinationPath, buildRenameDestinationPath, scanMediaCleanupReport, scanSmartDuplicateMediaGroups } from '../lib/mediaOrganizer';
import {
  buildSubtitleTrackFromDataCues,
  buildSubtitleTrackFromSrt,
  collectSubtitleSpeakersFromTrack,
  isSubtitlePath,
  parseSubtitleDataFile,
  pickSubtitleDataPaths,
  pickSubtitlePaths,
  readSubtitleText
} from '../lib/subtitles';
import { createProjectArchivePlan, writeProjectArchive, type ArchiveProgress } from '../lib/projectArchive';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { buildProjectHealthAutoRepairInput, scanProjectHealth } from '../lib/projectHealth';
import { readMediaHealthAutoShowEnabled, scanMediaHealthDashboard, writeMediaHealthAutoShowEnabled } from '../lib/mediaHealthDashboard';
import { getReviewModeShellVisibility } from '../review/reviewMode';
import { saveReviewReport } from '../review/reviewReport';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import { canSeparateAudioForClip, getDemucsAvailability, separateAudioForClip, type DemucsAvailability } from '../lib/demucs';
import { analyzeSpeakerDiarizationForClip } from '../lib/speakerDiarization';
import { analyzeAutoAudioSyncTargets, type AutoAudioSyncTarget } from '../lib/autoAudioSync';
import {
  chooseProjectSavePath,
  chooseProjectToOpen,
  confirmDiscardChanges,
  deleteAutosaveAfterSave,
  discardAutosaveRecovery,
  findStartupAutosaveRecovery,
  isEncryptedProjectPath,
  readAutosaveIntervalSeconds,
  readProjectFile,
  setActiveProjectEncryptionPassword,
  writeAutosaveIntervalSeconds,
  writeProjectFile,
  type AutosaveRecoveryCandidate,
  type ProjectFileEncryptionOptions
} from '../lib/projectFiles';
import {
  bridgeConfirm,
  batchExtractCoverFrames,
  cancelDemucs,
  closePreviewWindow,
  convertLocalFileSrc,
  copyFile as bridgeCopyFile,
  detectBeats,
  emitBridge,
  getAppDataDir,
  getCacheSize,
  getPreviewWindowState,
  listenBridge,
  openPreviewWindow,
  openDirectoryDialog,
  openFileDialog as bridgeOpenFileDialog,
  scanDirectory,
  moveFile as bridgeMoveFile,
  removeFile as bridgeRemoveFile,
  trashFile as bridgeTrashFile,
  readFile as bridgeReadFile,
  saveFileDialog as bridgeSaveFileDialog,
  sendNotification,
  startRecording,
  stopRecording,
  writeFile as bridgeWriteFile,
  type DemucsProgressEvent,
  type PreviewWindowState,
  type RecordingSource
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  createPreviewWindowPlaybackState,
  normalizePreviewWindowPlaybackState,
  shouldApplyPreviewWindowPlaybackState
} from '../lib/previewWindowSync';
import {
  readBackupSettings,
  readCollaborationIdentitySettings,
  readCustomSplitLayouts,
  readLayoutSettings,
  readLocalCoeditingSettings,
  readPreviewPerformanceSettings,
  readTutorialProgressSettings,
  readPreviewWindowSettings,
  readTimelineInteractionSettings,
  readTimelineGridSettings,
  readViewSettings,
  DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  DEFAULT_TIMELINE_INTERACTION_SETTINGS,
  normalizeTimelineHeatmapViewSettings,
  saveLayoutSettings,
  savePreviewPerformanceSettings,
  saveTutorialProgressSettings,
  savePreviewWindowSettings,
  saveTimelineInteractionSettings,
  saveTimelineGridSettings,
  saveViewSettings,
  type PreviewWindowSettings,
  type CollaborationIdentitySettings,
  type TimelineInteractionSettings,
  type TimelineHeatmapViewSettings
} from '../settings/appSettings';
import { collaborationController } from '../collaboration/local-network';
import { applyLocalCoeditingSettings } from '../collaboration/settings';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import {
  DEFAULT_TUTORIAL_SIGNALS,
  advanceTutorialProgress,
  normalizeTutorialProgressSettings,
  shouldShowTutorial,
  skipTutorialProgress,
  type TutorialProgressSettings,
  type TutorialSignals
} from '../tutorial/tutorialState';
import { DEFAULT_PREVIEW_PERFORMANCE_SETTINGS, type PreviewPerformanceSettings, type PreviewQualityMode, type PreviewSkipFrames } from '../lib/preview/preview-performance';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { runScheduledProxyIntegrityCheck } from '../media/proxy-integrity';
import type { DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../media/MediaOrganizerDialog';
import { useMediaJobStore } from '../media/media-job-store';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import { loadSharedLibrary, type SharedLibraryResource } from '../shared-library/sharedLibrary';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useCollaborationStore } from '../store/collaborationStore';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { selectClipById, useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';

const AudioMixer = lazy(() => import('./AudioMixer/AudioMixer').then((module) => ({ default: module.AudioMixer })));
const Inspector = lazy(() => import('./Inspector/Inspector').then((module) => ({ default: module.Inspector })));
const SmartRoughCutPanel = lazy(() => import('./SmartRoughCut/SmartRoughCutPanel').then((module) => ({ default: module.SmartRoughCutPanel })));
const AIRoughCutPanel = lazy(() => import('./AIRoughCut/AIRoughCutPanel').then((module) => ({ default: module.AIRoughCutPanel })));
const DirectorModePanel = lazy(() => import('./DirectorMode/DirectorModePanel').then((module) => ({ default: module.DirectorModePanel })));
const MusicMatchPanel = lazy(() => import('./MusicMatch/MusicMatchPanel').then((module) => ({ default: module.MusicMatchPanel })));
const HighlightReelPanel = lazy(() => import('./HighlightReel/HighlightReelPanel').then((module) => ({ default: module.HighlightReelPanel })));
const ContextualTranslationPanel = lazy(() => import('./ContextualTranslation/ContextualTranslationPanel').then((module) => ({ default: module.ContextualTranslationPanel })));
const AIChatEditorPanel = lazy(() => import('./AIChatEditor/AIChatEditorPanel').then((module) => ({ default: module.AIChatEditorPanel })));
const AIVideoSummaryPanel = lazy(() => import('./AIVideoSummary/AIVideoSummaryPanel').then((module) => ({ default: module.AIVideoSummaryPanel })));
const AINarrationPanel = lazy(() => import('./AINarration/AINarrationPanel').then((module) => ({ default: module.AINarrationPanel })));
const HistoryPanel = lazy(() => import('./History/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const ProjectDocumentationPanel = lazy(() => import('./ProjectDocumentationPanel').then((module) => ({ default: module.ProjectDocumentationPanel })));
const MediaPrecheckPanel = lazy(() => import('../media/MediaPrecheckPanel').then((module) => ({ default: module.MediaPrecheckPanel })));
const SyncComparePanel = lazy(() => import('../sync-compare/SyncComparePanel').then((module) => ({ default: module.SyncComparePanel })));
const CollaborationNotesPanel = lazy(() => import('../collaboration/CollaborationNotesPanel'));
const ComplexityScorePanel = lazy(() => import('../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })));
const TimelineSearchPanel = lazy(() => import('../timeline-search/TimelineSearchPanel').then((module) => ({ default: module.TimelineSearchPanel })));
const SnapshotNameDialog = lazy(() => import('../project-snapshots/SnapshotNameDialog').then((module) => ({ default: module.SnapshotNameDialog })));
const SnapshotHistoryDialog = lazy(() => import('../project-snapshots/SnapshotHistoryDialog').then((module) => ({ default: module.SnapshotHistoryDialog })));
const SnapshotVersionCompareDialog = lazy(() => import('../project-snapshots/SnapshotVersionCompareDialog').then((module) => ({ default: module.SnapshotVersionCompareDialog })));
const TimelineCompareDialog = lazy(() => import('../timeline-compare/TimelineCompareDialog').then((module) => ({ default: module.TimelineCompareDialog })));
const ReleaseWorkflowDialog = lazy(() => import('../release/ReleaseWorkflowDialog').then((module) => ({ default: module.ReleaseWorkflowDialog })));
const ThumbnailGeneratorDialog = lazy(() => import('../thumbnail/ThumbnailGeneratorDialog').then((module) => ({ default: module.ThumbnailGeneratorDialog })));

const PerformanceMonitorPanel = lazy(() => import('./PerformanceMonitorPanel').then((module) => ({ default: module.PerformanceMonitorPanel })));
const AutoAudioSyncDialog = lazy(() => import('../audio-sync/AutoAudioSyncDialog').then((module) => ({ default: module.AutoAudioSyncDialog })));
const DuplicateMediaDialog = lazy(() => import('../media/DuplicateMediaDialog').then((module) => ({ default: module.DuplicateMediaDialog })));
const MediaOrganizerDialog = lazy(() => import('../media/MediaOrganizerDialog').then((module) => ({ default: module.MediaOrganizerDialog })));
const ProjectHealthDialog = lazy(() => import('../project-health/ProjectHealthDialog').then((module) => ({ default: module.ProjectHealthDialog })));
const MediaHealthDashboardDialog = lazy(() => import('../media/MediaHealthDashboardDialog').then((module) => ({ default: module.MediaHealthDashboardDialog })));
const ProjectTemplateDialog = lazy(() => import('../project-templates/ProjectTemplateDialog').then((module) => ({ default: module.ProjectTemplateDialog })));
const TimelineTemplateDialog = lazy(() => import('../timeline-templates/TimelineTemplateDialog').then((module) => ({ default: module.TimelineTemplateDialog })));
const MediaVersionComparePanel = lazy(() => import('./MediaVersionComparePanel').then((module) => ({ default: module.MediaVersionComparePanel })));
const ProjectEncryptionSaveDialog = lazy(() => import('./dialogs/ProjectEncryptionSaveDialog').then((module) => ({ default: module.ProjectEncryptionSaveDialog })));
const ProjectPasswordDialog = lazy(() => import('./dialogs/ProjectPasswordDialog').then((module) => ({ default: module.ProjectPasswordDialog })));
const AutosaveRecoveryDialog = lazy(() => import('./dialogs/AutosaveRecoveryDialog').then((module) => ({ default: module.AutosaveRecoveryDialog })));
const ExportQueueRecoveryDialog = lazy(() => import('./dialogs/ExportQueueRecoveryDialog').then((module) => ({ default: module.ExportQueueRecoveryDialog })));
const ArchiveProgressDialog = lazy(() => import('./dialogs/ArchiveProgressDialog').then((module) => ({ default: module.ArchiveProgressDialog })));
const PasteKeyframeDialog = lazy(() => import('./dialogs/PasteKeyframeDialog').then((module) => ({ default: module.PasteKeyframeDialog })));
const SharePackageProgressDialog = lazy(() => import('./dialogs/SharePackageProgressDialog').then((module) => ({ default: module.SharePackageProgressDialog })));
const CharacterTimelinePanel = lazy(() => import('./Timeline/CharacterTimelinePanel').then((module) => ({ default: module.CharacterTimelinePanel })));
const PreflightChecklistPanel = lazy(() => import('./Export/PreflightChecklistPanel').then((module) => ({ default: module.PreflightChecklistPanel })));
const DubbingAdaptationPanel = lazy(() => import('./Export/DubbingAdaptationPanel').then((module) => ({ default: module.DubbingAdaptationPanel })));

import { SettingsDialogs } from './dialogs/SettingsDialogs';
import { ExportDialogs } from './dialogs/ExportDialogs';
import { AnalysisDialogs } from './dialogs/AnalysisDialogs';
import { BeatSyncDialog } from './dialogs/BeatSyncDialog';
import { SnapshotDialogs } from './dialogs/SnapshotDialogs';
import { ProjectHealthDialogs } from './dialogs/ProjectHealthDialogs';
import { MediaCompareDialogs } from './dialogs/MediaCompareDialogs';
import { RecoveryDialogs } from './dialogs/RecoveryDialogs';
import { SecurityDialogs } from './dialogs/SecurityDialogs';
import { CollapsedPanelRail } from './CollapsedPanelRail';
import { ShellFloatingDialogs } from './layout/ShellFloatingDialogs';
import { ShellMainArea } from './layout/ShellMainArea';
import {
  getSubtitleDataImportTargetTrackId,
  isPiPVisualClip,
  isSceneReorderClip,
} from '../lib/timeline-clip-helpers';
import {
  isContentAnalysisClip,
  collectContentAnalysisTargets,
  findSpeakerDiarizationTarget,
  collectAutoAudioSyncTargets,
  collectSpeakerDiarizationDialogueIntervals,
  summarizeContentAnalysisByMedia,
} from '../lib/content-analysis-helpers';
import {
  readViewportSize,
  isEditableKeyboardEventTarget,
  joinLocalPath,
  getWorkspaceLayoutDisplayName,
  moveAutomationMediaToGroup,
} from '../lib/ui-helpers';
import type { ProjectPasswordRequest } from './dialogs/ProjectPasswordDialog';
import {
  mergeProjectSpeakers,
  sanitizeFileName,
  projectUsesMediaOnTimeline,
} from '@open-factory/editor-core';

export function EditorShell() {
  useEditorShellSettings();
  const { applyWorkspaceLayoutById, toggleProjectDocumentation } = useEditorShellInteractions();
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
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
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);
  const setBatchTranscodeOpen = useEditorUIStore((s) => s.setBatchTranscodeOpen);
  const setBatchWatermarkOpen = useEditorUIStore((s) => s.setBatchWatermarkOpen);
  const setBatchProjectProcessingOpen = useEditorUIStore((s) => s.setBatchProjectProcessingOpen);
  const setBatchTranscodeInitialPaths = useEditorFeatureStore((s) => s.setBatchTranscodeInitialPaths);
  const thumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.thumbnailGeneratorAssetIds);
  const setThumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.setThumbnailGeneratorAssetIds);
  const setLutEditorOpen = useEditorUIStore((s) => s.setLutEditorOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const colorAnalysisBusy = useEditorFeatureStore((s) => s.colorAnalysisBusy);

  const setColorAnalysisBusy = useEditorFeatureStore((s) => s.setColorAnalysisBusy);
  const colorAnalysisResults = useEditorFeatureStore((s) => s.colorAnalysisResults);

  const setColorAnalysisResults = useEditorFeatureStore((s) => s.setColorAnalysisResults);
  const colorAnalysisJumps = useEditorFeatureStore((s) => s.colorAnalysisJumps);

  const setColorAnalysisJumps = useEditorFeatureStore((s) => s.setColorAnalysisJumps);
  const colorHeatmapPoints = useEditorFeatureStore((s) => s.colorHeatmapPoints);

  const setColorHeatmapPoints = useEditorFeatureStore((s) => s.setColorHeatmapPoints);
  const colorAnalysisSamples = useEditorFeatureStore((s) => s.colorAnalysisSamples);

  const setColorAnalysisSamples = useEditorFeatureStore((s) => s.setColorAnalysisSamples);
  const professionalNleExportOpen = useEditorUIStore((s) => s.professionalNleExportOpen);
  const setProfessionalNleExportOpen = useEditorUIStore((s) => s.setProfessionalNleExportOpen);
  const setGifExportAsset = useEditorFeatureStore((s) => s.setGifExportAsset);
  const setSpectrumAsset = useEditorFeatureStore((s) => s.setSpectrumAsset);
  const mediaVersionCompare = useEditorFeatureStore((s) => s.mediaVersionCompare);

  const setMediaVersionCompare = useEditorFeatureStore((s) => s.setMediaVersionCompare);
  const mediaPrecheckOpen = useEditorUIStore((s) => s.mediaPrecheckOpen);
  const setMediaPrecheckOpen = useEditorUIStore((s) => s.setMediaPrecheckOpen);
  const setVideoStitchWizardOpen = useEditorUIStore((s) => s.setVideoStitchWizardOpen);
  const syncCompareOpen = useEditorUIStore((s) => s.syncCompareOpen);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);
  const setSceneReorderOpen = useEditorUIStore((s) => s.setSceneReorderOpen);
  const setStyleTransferOpen = useEditorUIStore((s) => s.setStyleTransferOpen);
  const collaborationNotesOpen = useEditorUIStore((s) => s.collaborationNotesOpen);
  const setCollaborationNotesOpen = useEditorUIStore((s) => s.setCollaborationNotesOpen);
  const setOperationRecordingOpen = useEditorUIStore((s) => s.setOperationRecordingOpen);
  const operationRecording = useEditorFeatureStore((s) => s.operationRecording);
  const operationRecordingActive = useEditorFeatureStore((s) => s.operationRecordingActive);
  const operationRecordingStep = useEditorFeatureStore((s) => s.operationRecordingStep);
  const operationReplaySpeed = useEditorFeatureStore((s) => s.operationReplaySpeed);
  const operationReplayRunning = useEditorFeatureStore((s) => s.operationReplayRunning);
  const complexityScoreOpen = useEditorUIStore((s) => s.complexityScoreOpen);
  const setComplexityScoreOpen = useEditorUIStore((s) => s.setComplexityScoreOpen);
  const setSmartRecommendationsOpen = useEditorUIStore((s) => s.setSmartRecommendationsOpen);
  const setContentAnalysisOpen = useEditorUIStore((s) => s.setContentAnalysisOpen);
  const setProfilerOpen = useEditorUIStore((s) => s.setProfilerOpen);
  const profilerRecording = useEditorFeatureStore((s) => s.profilerRecording);
  const profilerElapsedMs = useEditorFeatureStore((s) => s.profilerElapsedMs);
  const profilerReport = useEditorFeatureStore((s) => s.profilerReport);
  const setRhythmAnalysisOpen = useEditorUIStore((s) => s.setRhythmAnalysisOpen);
  const contentAnalysisRunningClipId = useEditorFeatureStore((s) => s.contentAnalysisRunningClipId);

  const setContentAnalysisRunningClipId = useEditorFeatureStore((s) => s.setContentAnalysisRunningClipId);
  const timelineSearchOpen = useEditorUIStore((s) => s.timelineSearchOpen);
  const setTimelineSearchOpen = useEditorUIStore((s) => s.setTimelineSearchOpen);
  const snapshotNameOpen = useEditorUIStore((s) => s.snapshotNameOpen);
  const setSnapshotNameOpen = useEditorUIStore((s) => s.setSnapshotNameOpen);
  const snapshotHistoryOpen = useEditorUIStore((s) => s.snapshotHistoryOpen);
  const setSnapshotHistoryOpen = useEditorUIStore((s) => s.setSnapshotHistoryOpen);
  const snapshotCompareOpen = useEditorUIStore((s) => s.snapshotCompareOpen);
  const setSnapshotCompareOpen = useEditorUIStore((s) => s.setSnapshotCompareOpen);
  const timelineCompareOpen = useEditorUIStore((s) => s.timelineCompareOpen);
  const setTimelineCompareOpen = useEditorUIStore((s) => s.setTimelineCompareOpen);
  const releaseWorkflowOpen = useEditorUIStore((s) => s.releaseWorkflowOpen);
  const setReleaseWorkflowOpen = useEditorUIStore((s) => s.setReleaseWorkflowOpen);
  const projectEncryptionSaveOpen = useEditorUIStore((s) => s.projectEncryptionSaveOpen);
  const setProjectEncryptionSaveOpen = useEditorUIStore((s) => s.setProjectEncryptionSaveOpen);
  const projectPasswordRequest = useEditorFeatureStore((s) => s.projectPasswordRequest);

  const setProjectPasswordRequest = useEditorFeatureStore((s) => s.setProjectPasswordRequest);
  const projectTemplateOpen = useEditorUIStore((s) => s.projectTemplateOpen);
  const setProjectTemplateOpen = useEditorUIStore((s) => s.setProjectTemplateOpen);
  const timelineTemplateMode = useEditorFeatureStore((s) => s.timelineTemplateMode);

  const setTimelineTemplateMode = useEditorFeatureStore((s) => s.setTimelineTemplateMode);
  const templateExportPreset = useEditorFeatureStore((s) => s.templateExportPreset);

  const setTemplateExportPreset = useEditorFeatureStore((s) => s.setTemplateExportPreset);
  const setSettingsOpen = useEditorUIStore((s) => s.setSettingsOpen);
  const beatSensitivity = useEditorSettingsStore((s) => s.beatSensitivity);

  const setBeatSensitivity = useEditorSettingsStore((s) => s.setBeatSensitivity);
  const beatSyncOpen = useEditorUIStore((s) => s.beatSyncOpen);
  const setBeatSyncOpen = useEditorUIStore((s) => s.setBeatSyncOpen);
  const beatSyncSpeedEnabled = useEditorSettingsStore((s) => s.beatSyncSpeedEnabled);

  const setBeatSyncSpeedEnabled = useEditorSettingsStore((s) => s.setBeatSyncSpeedEnabled);
  const beatSyncManualBpm = useEditorSettingsStore((s) => s.beatSyncManualBpm);

  const setBeatSyncManualBpm = useEditorSettingsStore((s) => s.setBeatSyncManualBpm);
  const sceneDetectionRequestId = useEditorSettingsStore((s) => s.sceneDetectionRequestId);

  const setSceneDetectionRequestId = useEditorSettingsStore((s) => s.setSceneDetectionRequestId);
  const smartRoughCutOpen = useEditorUIStore((s) => s.smartRoughCutOpen);
  const setSmartRoughCutOpen = useEditorUIStore((s) => s.setSmartRoughCutOpen);
  const aiRoughCutOpen = useEditorUIStore((s) => s.aiRoughCutOpen);
  const setAiRoughCutOpen = useEditorUIStore((s) => s.setAiRoughCutOpen);
  const directorModeOpen = useEditorUIStore((s) => s.directorModeOpen);
  const setDirectorModeOpen = useEditorUIStore((s) => s.setDirectorModeOpen);
  const musicMatchOpen = useEditorUIStore((s) => s.musicMatchOpen);
  const setMusicMatchOpen = useEditorUIStore((s) => s.setMusicMatchOpen);
  const highlightReelOpen = useEditorUIStore((s) => s.highlightReelOpen);
  const setHighlightReelOpen = useEditorUIStore((s) => s.setHighlightReelOpen);
  const contextualTranslationOpen = useEditorUIStore((s) => s.contextualTranslationOpen);
  const setContextualTranslationOpen = useEditorUIStore((s) => s.setContextualTranslationOpen);
  const aiChatEditorOpen = useEditorUIStore((s) => s.aiChatEditorOpen);
  const setAiChatEditorOpen = useEditorUIStore((s) => s.setAiChatEditorOpen);
  const videoSummaryOpen = useEditorUIStore((s) => s.videoSummaryOpen);
  const setVideoSummaryOpen = useEditorUIStore((s) => s.setVideoSummaryOpen);
  const narrationOpen = useEditorUIStore((s) => s.narrationOpen);
  const setNarrationOpen = useEditorUIStore((s) => s.setNarrationOpen);
  const historyPanelOpen = useEditorUIStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useEditorUIStore((s) => s.setHistoryPanelOpen);
  const projectDocumentationOpen = useEditorUIStore((s) => s.projectDocumentationOpen);
  const setProjectDocumentationOpen = useEditorUIStore((s) => s.setProjectDocumentationOpen);
  const storyboardOpen = useEditorUIStore((s) => s.storyboardOpen);
  const setStoryboardOpen = useEditorUIStore((s) => s.setStoryboardOpen);
  const setMacroHistoryOpen = useEditorUIStore((s) => s.setMacroHistoryOpen);
  const projectHealthOpen = useEditorUIStore((s) => s.projectHealthOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const mediaHealthDashboardOpen = useEditorUIStore((s) => s.mediaHealthDashboardOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const reviewMode = useEditorUIStore((s) => s.reviewMode);
  const setReviewMode = useEditorUIStore((s) => s.setReviewMode);
  const projectHealthReport = useEditorFeatureStore((s) => s.projectHealthReport);

  const setProjectHealthReport = useEditorFeatureStore((s) => s.setProjectHealthReport);
  const projectHealthRepairReport = useEditorFeatureStore((s) => s.projectHealthRepairReport);

  const setProjectHealthRepairReport = useEditorFeatureStore((s) => s.setProjectHealthRepairReport);
  const projectHealthScanning = useEditorFeatureStore((s) => s.projectHealthScanning);

  const setProjectHealthScanning = useEditorFeatureStore((s) => s.setProjectHealthScanning);
  const mediaHealthDashboard = useEditorFeatureStore((s) => s.mediaHealthDashboard);

  const setMediaHealthDashboard = useEditorFeatureStore((s) => s.setMediaHealthDashboard);
  const mediaHealthScanning = useEditorFeatureStore((s) => s.mediaHealthScanning);

  const setMediaHealthScanning = useEditorFeatureStore((s) => s.setMediaHealthScanning);
  const mediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.mediaHealthAutoShowEnabled);
  const setMediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.setMediaHealthAutoShowEnabled);
  const mediaHealthAutoShowCheckedRef = useRef(false);
  const duplicateMediaGroups = useEditorFeatureStore((s) => s.duplicateMediaGroups);

  const setDuplicateMediaGroups = useEditorFeatureStore((s) => s.setDuplicateMediaGroups);
  const duplicateMediaOpen = useEditorUIStore((s) => s.duplicateMediaOpen);
  const setDuplicateMediaOpen = useEditorUIStore((s) => s.setDuplicateMediaOpen);
  const mediaOrganizerOpen = useEditorUIStore((s) => s.mediaOrganizerOpen);
  const setMediaOrganizerOpen = useEditorUIStore((s) => s.setMediaOrganizerOpen);
  const mediaOrganizerGroups = useEditorFeatureStore((s) => s.mediaOrganizerGroups);

  const setMediaOrganizerGroups = useEditorFeatureStore((s) => s.setMediaOrganizerGroups);
  const mediaOrganizerCleanup = useEditorFeatureStore((s) => s.mediaOrganizerCleanup);

  const setMediaOrganizerCleanup = useEditorFeatureStore((s) => s.setMediaOrganizerCleanup);
  const mediaOrganizerScanning = useEditorFeatureStore((s) => s.mediaOrganizerScanning);

  const setMediaOrganizerScanning = useEditorFeatureStore((s) => s.setMediaOrganizerScanning);
  const shortcutBindings = useEditorSettingsStore((s) => s.shortcutBindings);

  const setShortcutBindings = useEditorSettingsStore((s) => s.setShortcutBindings);
  const shortcutCheatsheetOpen = useEditorUIStore((s) => s.shortcutCheatsheetOpen);
  const setShortcutCheatsheetOpen = useEditorUIStore((s) => s.setShortcutCheatsheetOpen);
  const pasteKeyframeDialogOpen = useEditorUIStore((s) => s.pasteKeyframeDialogOpen);
  const setPasteKeyframeDialogOpen = useEditorUIStore((s) => s.setPasteKeyframeDialogOpen);
  const pasteKeyframeDialogGroups = useEditorFeatureStore((s) => s.pasteKeyframeDialogGroups);

  const setPasteKeyframeDialogGroups = useEditorFeatureStore((s) => s.setPasteKeyframeDialogGroups);
  const macros = useEditorSettingsStore((s) => s.macros);

  const setMacros = useEditorSettingsStore((s) => s.setMacros);

  const sharedLibraryResources = useEditorSettingsStore((s) => s.sharedLibraryResources);

  const setSharedLibraryResources = useEditorSettingsStore((s) => s.setSharedLibraryResources);
  const macroRecordingActive = useEditorFeatureStore((s) => s.macroRecordingActive);

  const macroRecordingStepCount = useEditorFeatureStore((s) => s.macroRecordingStepCount);


  const autosaveIntervalSeconds = useEditorSettingsStore((s) => s.autosaveIntervalSeconds);
  const setAutosaveIntervalSeconds = useEditorSettingsStore((s) => s.setAutosaveIntervalSeconds);
  const recoveryCandidate = useEditorFeatureStore((s) => s.recoveryCandidate);

  const setRecoveryCandidate = useEditorFeatureStore((s) => s.setRecoveryCandidate);
  const archiveProgress = useEditorFeatureStore((s) => s.archiveProgress);

  const setArchiveProgress = useEditorFeatureStore((s) => s.setArchiveProgress);
  const layoutSettings = useEditorUIStore((s) => s.layoutSettings);
  const setLayoutSettings = useEditorUIStore((s) => s.setLayoutSettings);
  const safeFrameGuides = useEditorSettingsStore((s) => s.safeFrameGuides);

  const setSafeFrameGuides = useEditorSettingsStore((s) => s.setSafeFrameGuides);
  const thumbnailTrackVisible = useEditorSettingsStore((s) => s.thumbnailTrackVisible);

  const setThumbnailTrackVisible = useEditorSettingsStore((s) => s.setThumbnailTrackVisible);
  const timelineMinimapVisible = useEditorSettingsStore((s) => s.timelineMinimapVisible);

  const setTimelineMinimapVisible = useEditorSettingsStore((s) => s.setTimelineMinimapVisible);
  const timelineHeatmap = useEditorSettingsStore((s) => s.timelineHeatmap);
  const setTimelineHeatmap = useEditorSettingsStore((s) => s.setTimelineHeatmap);
  const previewPerformance = useEditorSettingsStore((s) => s.previewPerformance);

  const setPreviewPerformance = useEditorSettingsStore((s) => s.setPreviewPerformance);
  const previewWindowOpen = useEditorUIStore((s) => s.previewWindowOpen);
  const setPreviewWindowOpen = useEditorUIStore((s) => s.setPreviewWindowOpen);
  const previewWindowResolutionScale = useEditorSettingsStore((s) => s.previewWindowResolutionScale);

  const setPreviewWindowResolutionScale = useEditorSettingsStore((s) => s.setPreviewWindowResolutionScale);
  const timelineGridSettings = useEditorSettingsStore((s) => s.timelineGridSettings);

  const setTimelineGridSettings = useEditorSettingsStore((s) => s.setTimelineGridSettings);
  const timelineInteractionSettings = useEditorSettingsStore((s) => s.timelineInteractionSettings);

  const setTimelineInteractionSettings = useEditorSettingsStore((s) => s.setTimelineInteractionSettings);
  const collaborationIdentity = useEditorSettingsStore((s) => s.collaborationIdentity);
  const setCollaborationIdentity = useEditorSettingsStore((s) => s.setCollaborationIdentity);
  const tutorialProgress = useEditorSettingsStore((s) => s.tutorialProgress);

  const setTutorialProgress = useEditorSettingsStore((s) => s.setTutorialProgress);
  const tutorialCelebrationVisible = useEditorSettingsStore((s) => s.tutorialCelebrationVisible);

  const setTutorialCelebrationVisible = useEditorSettingsStore((s) => s.setTutorialCelebrationVisible);
  const tutorialSignals = useEditorSettingsStore((s) => s.tutorialSignals);

  const setTutorialSignals = useEditorSettingsStore((s) => s.setTutorialSignals);

  // Advance tutorial when signals change
  useEffect(() => {
    const current = normalizeTutorialProgressSettings(tutorialProgress);
    const nextProgress = advanceTutorialProgress(current, tutorialSignals);
    if (nextProgress.tutorialStep !== current.tutorialStep || nextProgress.tutorialCompleted !== current.tutorialCompleted) {
      setTutorialProgress(nextProgress);
      if (nextProgress.tutorialCompleted) {
        setTutorialCelebrationVisible(true);
      }
      void saveTutorialProgressSettings(nextProgress).catch((error) => {
        console.warn('Unable to save tutorial progress', error);
      });
    }
  }, [tutorialSignals, tutorialProgress, setTutorialProgress, setTutorialCelebrationVisible]);

  const pipLayoutPosition = useEditorSettingsStore((s) => s.pipLayoutPosition);

  const setPiPLayoutPosition = useEditorSettingsStore((s) => s.setPiPLayoutPosition);
  const customSplitLayouts = useEditorSettingsStore((s) => s.customSplitLayouts);

  const setCustomSplitLayouts = useEditorSettingsStore((s) => s.setCustomSplitLayouts);
  const viewportSize = useEditorUIStore((s) => s.viewportSize);
  const setViewportSize = useEditorUIStore((s) => s.setViewportSize);
  const lastBackupAt = useEditorSettingsStore((s) => s.lastBackupAt);

  const setLastBackupAt = useEditorSettingsStore((s) => s.setLastBackupAt);
  const demucsAvailability = useEditorFeatureStore((s) => s.demucsAvailability);

  const setDemucsAvailability = useEditorFeatureStore((s) => s.setDemucsAvailability);
  const audioSeparationClipId = useEditorFeatureStore((s) => s.audioSeparationClipId);

  const setAudioSeparationClipId = useEditorFeatureStore((s) => s.setAudioSeparationClipId);
  const audioSeparationProgress = useEditorFeatureStore((s) => s.audioSeparationProgress);

  const setAudioSeparationProgress = useEditorFeatureStore((s) => s.setAudioSeparationProgress);
  const speakerDiarizationRunning = useEditorFeatureStore((s) => s.speakerDiarizationRunning);

  const setSpeakerDiarizationRunning = useEditorFeatureStore((s) => s.setSpeakerDiarizationRunning);
  const speakerDiarizationResult = useEditorFeatureStore((s) => s.speakerDiarizationResult);

  const setSpeakerDiarizationResult = useEditorFeatureStore((s) => s.setSpeakerDiarizationResult);
  const autoAudioSyncOpen = useEditorUIStore((s) => s.autoAudioSyncOpen);
  const setAutoAudioSyncOpen = useEditorUIStore((s) => s.setAutoAudioSyncOpen);
  const setErrorKnowledgeOpen = useEditorUIStore((s) => s.setErrorKnowledgeOpen);
  const setSequenceCompareOpen = useEditorUIStore((s) => s.setSequenceCompareOpen);
  const setSubtitleSyncOpen = useEditorUIStore((s) => s.setSubtitleSyncOpen);
  const setProxyVerifyOpen = useEditorUIStore((s) => s.setProxyVerifyOpen);
  const setFormatConverterOpen = useEditorUIStore((s) => s.setFormatConverterOpen);
  const setEmotionAnalysisOpen = useEditorUIStore((s) => s.setEmotionAnalysisOpen);
  const setExportHistoryClassifierOpen = useEditorUIStore((s) => s.setExportHistoryClassifierOpen);
  const setFormatConverterMockFiles = useEditorFeatureStore((s) => s.setFormatConverterMockFiles);
  const setMockSubtitleClips = useEditorFeatureStore((s) => s.setMockSubtitleClips);
  const setMockExportHistory = useEditorFeatureStore((s) => s.setMockExportHistory);

  // E2E: expose stores for test instrumentation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__PERF_MONITOR_STORE__ = usePerformanceMonitorStore;
      window.__APP_STORE__ = {
        setFormatConverterOpen,
        setEmotionAnalysisOpen,
        setEmotionPanelOpen: setEmotionAnalysisOpen,
        setFormatConverterMockFiles,
        setExportHistoryClassifierOpen,
        setExportHistoryPanelOpen: setExportHistoryClassifierOpen,
        setMockSubtitleClips,
        setMockExportHistory,
        setArchiveProgress,
      };
    }
  }, [setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen, setArchiveProgress]);
  const autoAudioSyncRunning = useEditorFeatureStore((s) => s.autoAudioSyncRunning);

  const setAutoAudioSyncRunning = useEditorFeatureStore((s) => s.setAutoAudioSyncRunning);
  const autoAudioSyncPrimaryClipId = useEditorFeatureStore((s) => s.autoAudioSyncPrimaryClipId);

  const setAutoAudioSyncPrimaryClipId = useEditorFeatureStore((s) => s.setAutoAudioSyncPrimaryClipId);
  const autoAudioSyncMode = useEditorFeatureStore((s) => s.autoAudioSyncMode);

  const setAutoAudioSyncMode = useEditorFeatureStore((s) => s.setAutoAudioSyncMode);
  const autoAudioSyncResults = useEditorFeatureStore((s) => s.autoAudioSyncResults);

  const setAutoAudioSyncResults = useEditorFeatureStore((s) => s.setAutoAudioSyncResults);
  const recordingTask = useEditorFeatureStore((s) => s.recordingTask);

  const setRecordingTask = useEditorFeatureStore((s) => s.setRecordingTask);
  const recordingElapsedSeconds = useEditorFeatureStore((s) => s.recordingElapsedSeconds);

  const setRecordingElapsedSeconds = useEditorFeatureStore((s) => s.setRecordingElapsedSeconds);
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

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClips = useMemo(() => selectedClipIds.map((id) => selectClipById(project, id)).filter((clip): clip is Clip => Boolean(clip)), [project, selectedClipIds]);
  const selectedClipMedia = useMemo(
    () => (selectedClip && 'mediaId' in selectedClip ? project.media.find((asset) => asset.id === selectedClip.mediaId) : undefined),
    [project.media, selectedClip]
  );
  const allTimelineClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline.tracks]);
  const visualTimelineClipRefs = useMemo(
    () =>
      project.timeline.tracks
        .flatMap((track) =>
          track.clips
            .filter((clip) => clip.type === 'video' || clip.type === 'image')
            .map((clip) => ({
              clip,
              trackId: track.id,
              media: project.media.find((asset) => 'mediaId' in clip && asset.id === clip.mediaId)
            }))
        )
        .filter((item): item is { clip: Extract<Clip, { type: 'video' | 'image' }>; trackId: string; media: MediaAsset } => Boolean(item.media))
        .sort((left, right) => left.clip.start - right.clip.start || left.clip.id.localeCompare(right.clip.id)),
    [project.media, project.timeline.tracks]
  );
  const { handleProfilerFrame, startProfilerRecording, stopProfilerRecording, exportProfilerReportJson } = useEditorShellProfiler();

  const {
    saveCurrentWorkspaceLayout,
    toggleSafeFrameGuides,
    toggleThumbnailTrackVisible,
    toggleTimelineMinimapVisible,
    updateTimelineHeatmap,
    updatePreviewPerformance,
    updateTimelineInteractionSettings,
    persistPreviewWindowState,
    openDetachedPreview,
    reembedPreviewWindow,
    updateTimelineGridSettings,
    toggleTimelineGridSnap,
    changeTimelineGridUnit,
    runAutomationForMedia,
    beginTimelineResize,
  } = useEditorShellViewSettingsCallbacks({ layoutSettings, setLayoutSettings });

  const {
    requestProjectPassword,
    saveProject: saveProjectFn,
    saveEncryptedProject,
    startTutorial,
    skipTutorial,
    closeTutorialCelebration,
    confirmProjectEncryptionSave,
    archiveCurrentProject,
    executeNewProject,
    newProject,
    createProjectFromTemplate,
    createProjectFromTimelineTemplate,
    openProject,
    saveNamedSnapshot,
    restoreSnapshotProject,
    applySnapshotDiffSelection,
  } = useEditorShellProjectCallbacks();

  const {
    refreshSharedLibraryResources,
    persistMediaFingerprints,
    applyImportedMediaColorConversionChoice,
    queueFrameRateConversionForImportedMedia,
    importMedia,
    addVersionForMedia,
    openBatchTranscode,
    batchGenerateCovers,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    setMediaFolderCollapsed,
    moveMediaToFolder,
    batchUpdateMediaMetadata,
    batchRenameMedia,
    relinkMedia,
    relinkAllMissing,
    scanDuplicateMedia,
    mergeDuplicateMediaGroups,
    refreshMediaOrganizer,
    openMediaOrganizer,
    confirmMediaOrganizerDuplicateGroups,
    removeMediaOrganizerReferences,
    archiveUnusedMedia,
    renameUnusedMedia,
    conformMedia,
    handleAddSubclip,
    handleUpdateSubclip,
    handleDeleteSubclip,
    jumpToMediaAsset,
    updateProjectReleaseVersion,
  } = useEditorShellMediaCallbacks({ runAutomationForMedia });

  // --- 提取到 useEditorShellMiscCallbacks hook ---
  const {
    createMediaReport,
    createClipReport,
    openMediaVersionCompare,
    openSyncCompare,
    clearCache,
    handleToggleFavorite,
    handlePinToSession,
    handleRevealFromMediaBin,
  } = useEditorShellMiscCallbacks();

  const {
    undo,
    switchToPreviousHistoryBranch,
    redo,
    togglePlayback,
    reversePlayback,
    pausePlayback,
    forwardPlayback,
    stepFrame,
    addAnnotationAtPlayhead,
    addReviewAnnotationAtPlayhead,
    createReviewReport,
    addBookmarkAtPlayhead,
    jumpTimelineNavigationPoint,
    exportBookmarks,
    importBookmarks,
    setSingleExportRange,
    appendExportRange,
    markInPoint,
    markOutPoint,
    markMultiRangeInPoint,
    markMultiRangeOutPoint,
  } = useEditorShellPlaybackCallbacks();

  const saveProject = saveProjectFn;

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

  // --- 提取到 useEditorShellTimelineCallbacks hook ---
  const {
    addAssetToTimeline,
    handleAddSubclipToTimeline,
    addAdjustmentLayer,
    applyEffectPresetToSelectedClip,
    addMotionGraphic,
    openColorNodeEditor,
    runTimelineColorAnalysis,
    alignTimelineColorToReference,
    openColorAnalysis,
    addTitleTemplate,
    splitSelected,
    seekSpectrumTime,
    setSpectrumSelectionRange,
    splitSpectrumAtTime,
    createMulticamSequence,
    applyPiPLayout,
    applySplitLayout,
    saveCustomSplitLayout,
    importEdlTimeline,
    deleteSelected,
    rippleDeleteSelected,
    selectAllTimelineItems,
    matchFrameToSource,
    revealMediaInTimeline,
    navigateToNextInstance,
    renderInOutRegion,
    navigatePrevGap,
    navigateNextGap,
  } = useEditorShellTimelineCallbacks({
    colorAnalysisBusy,
    colorAnalysisResults,
    colorAnalysisSamples,
    pipLayoutPosition,
    customSplitLayouts,
    canApplySplitLayout,
    selectedPiPClips,
    selectedSplitLayoutClips,
    visualTimelineClipRefs,
    projectPath: projectPath ?? null,
    setCustomSplitLayouts,
  });

  const syncCompareClipRefs = useMemo(() => findSyncCompareClipRefs(project.timeline, selectedClipIds), [project.timeline, selectedClipIds]);
  const canOpenSyncCompare = syncCompareClipRefs.length === 2;
  const canOpenSceneDetection = Boolean(selectedClip && selectedClipMedia && selectedClip.type === 'video');
  const canOpenSceneReorder = useMemo(() => selectedClips.filter(isSceneReorderClip).length >= 2, [selectedClips]);
  const contentAnalysisTargets = useMemo(() => collectContentAnalysisTargets(project), [project]);
  const mediaContentAnalysis = useMemo(() => summarizeContentAnalysisByMedia(contentAnalysisTargets), [contentAnalysisTargets]);
  const speakerDiarizationTarget = useMemo(() => findSpeakerDiarizationTarget(project, selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []), [project, selectedClipId, selectedClipIds]);
  const autoAudioSyncTargets = useMemo(() => collectAutoAudioSyncTargets(project, selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []), [project, selectedClipId, selectedClipIds]);
  const resolvedAutoAudioSyncPrimaryClipId = autoAudioSyncTargets.some((target) => target.clip.id === autoAudioSyncPrimaryClipId) ? autoAudioSyncPrimaryClipId! : (autoAudioSyncTargets[0]?.clip.id ?? '');
  const autoAudioSyncDialogTargets = useMemo(
    () =>
      autoAudioSyncTargets.map((target) => ({
        clipId: target.clip.id,
        clipName: target.clip.name,
        mediaName: target.asset.name,
        trackName: target.track.name,
        start: target.clip.start
      })),
    [autoAudioSyncTargets]
  );
  const canSeparateSelectedAudio = canSeparateAudioForClip(selectedClip, selectedClipMedia, demucsAvailability.ready) && !audioSeparationClipId;
  const canRunSpeakerDiarization = Boolean(speakerDiarizationTarget && !speakerDiarizationRunning);
  const canOpenAutoAudioSync = autoAudioSyncTargets.length >= 2 && autoAudioSyncTargets.length <= 5 && !autoAudioSyncRunning;
  const canDetectBeats = Boolean(
    selectedClip &&
      selectedClipMedia &&
      (selectedClip.type === 'audio' || selectedClip.type === 'video') &&
      (selectedClipMedia.type === 'audio' || selectedClipMedia.hasAudio)
  );
  const selectedClipTimelineBeatTimes = useMemo(() => {
    const times = selectedClips.flatMap((clip) => (clip.beatMarkers ?? []).map((marker) => round(clip.start + marker.time)));
    return Array.from(new Set(times)).sort((left, right) => left - right);
  }, [selectedClips]);
  const beatSyncBeatTimes = useMemo(() => {
    return selectedClipTimelineBeatTimes.length > 0 ? selectedClipTimelineBeatTimes : (project.beatMarkers ?? []).map((marker) => marker.time);
  }, [project.beatMarkers, selectedClipTimelineBeatTimes]);
  const detectedBeatBpm = selectedClip?.detectedBpm ?? estimateBpmFromBeatMarkers(selectedClip?.beatMarkers);
  const canSnapToBeats = selectedClipIds.length > 0 && beatSyncBeatTimes.length > 0;
  const canSplitToBeats = Boolean(selectedClip && beatSyncBeatTimes.length > 0);
  useEffect(() => {
    setBeatSyncManualBpm(detectedBeatBpm ? String(detectedBeatBpm) : '');
  }, [detectedBeatBpm, selectedClip?.id]);
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

  const persistLayoutPatch = useEditorUIStore((s) => s.persistLayoutPatch);
  const persistPanelVisibilityPatch = useEditorUIStore((s) => s.persistPanelVisibilityPatch);

  useEffect(() => {
    void refreshSharedLibraryResources();
    const onSharedLibraryUpdated = () => {
      void refreshSharedLibraryResources();
    };
    window.addEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
    return () => window.removeEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
  }, [refreshSharedLibraryResources]);

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

  const importVideosForStitchWizard = useCallback(async (): Promise<string[]> => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return [];
      }
      const result = await probeMediaPaths(paths, useEditorStore.getState().project.media);
      if (result.media.length > 0) {
        addMedia(result.media);
        await persistMediaFingerprints(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
        setTutorialSignals((current: TutorialSignals) => ({ ...current, mediaImported: true }));
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
  }, [addMedia, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

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

  // --- 提取到 useContentAnalysisCallbacks hook ---
  const {
    runSingleContentAnalysis,
    analyzeContentClip,
    analyzePreferredContentTargets,
    exportContentAnalysis,
  } = useContentAnalysisCallbacks({ setContentAnalysisRunningClipId });

  // --- 提取到 useEditorShellCallbacks hook ---
  const {
    refreshProjectHealth,
    openProjectHealth,
    refreshMediaHealthDashboard,
    openMediaHealthDashboard,
    setMediaHealthAutoShow,
    openMediaHealthRelinkPanel,
    relinkMissingFromHealth,
    removeOrphanFromHealth,
    mergeDuplicateFromHealth,
    queueProxyFromHealth,
    autoRepairProjectHealth,
    repairFromMediaHealthDashboard,
  } = useProjectHealthCallbacks({ projectHealthReport });

  const {
    separateSelectedAudio,
    runSpeakerDiarization,
    applySpeakerDiarization,
    openAutoAudioSync,
    runAutoAudioSync,
    applyAutoAudioSync,
    cancelAudioSeparation,
  } = useAudioAnalysisCallbacks({
    selectedClip,
    selectedClipMedia,
    addMedia,
    setSelectedClipId,
    setSelectedClipIds,
    demucsAvailability,
    demucsExecutablePath,
    audioSeparationClipId,
    speakerDiarizationTarget,
    speakerDiarizationResult,
    autoAudioSyncTargets,
    resolvedAutoAudioSyncPrimaryClipId,
    autoAudioSyncResults,
    autoAudioSyncMode,
    project,
  });

  const {
    startEditorRecording,
    stopEditorRecording,
  } = useRecordingCallbacks({
    addMedia,
    persistMediaFingerprints,
    recordingTask,
    recordingSettings,
  });

  const {
    detectSelectedBeats,
    snapSelectedToBeats,
    splitSelectedToBeats,
    applyManualBeatBpm,
  } = useBeatSyncCallbacks({
    selectedClip,
    selectedClipMedia,
    selectedClipId,
    selectedClipIds,
    beatSyncBeatTimes,
    beatSyncSpeedEnabled,
    beatSyncManualBpm,
    beatSensitivity,
    projectBeatMarkers: project.beatMarkers,
    setSelectedClipIds,
    clearSelectedClipIds,
  });

  // --- 提取到 useProxyCallbacks hook ---
  const {
    generateProxyForMedia,
    deleteProxiesForMedia,
    regenerateProxiesForMedia,
    migrateProxiesToDirectory,
    convertVfrMediaToCfr,
  } = useProxyCallbacks({ proxySettings, projectFps: project.settings.fps });

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
      exportCurrentFrame: () => void exportCurrentFrame(),
      matchFrame: () => void matchFrameToSource(),
      revealInTimeline: () => void revealMediaInTimeline(),
      navigateNextInstance: () => void navigateToNextInstance(),
      navigatePrevGap,
      navigateNextGap,
      renderInOut: () => void renderInOutRegion()
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
      navigateNextGap,
      navigatePrevGap,
      pausePlayback,
      redo,
      renderInOutRegion,
      reversePlayback,
      rippleDeleteSelected,
      saveProject,
      selectAllTimelineItems,
      splitSelected,
      stepFrame,
      switchToPreviousHistoryBranch,
      togglePlayback,
      toggleTimelineGridSnap,
      undo,
    ]
  );

  const {
    recordMacroHistory,
    startMacroRecording,
    stopMacroRecording,
    executeMacro,
    startOperationRecording,
    stopOperationRecording,
    saveOperationRecording,
    loadOperationRecording,
    pauseOperationReplay,
    replayOperationRecording,
    jumpOperationRecording,
    exportOperationRecordingSlides,
  } = useEditorShellOperationRecording();

  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useShortcuts(shortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, executeMacro);
  useBackgroundMediaJobs(project.media);

  const leftPanelCallbacks = useMemo(() => ({
    onImport: () => void importMedia(),
    onImportPaths: (paths: string[]) => void importDropped(paths),
    onBatchTranscode: (paths: string[]) => openBatchTranscode(paths),
    onBatchGenerateCovers: () => void batchGenerateCovers(),
    onGenerateThumbnails: (assetIds: string[]) => setThumbnailGeneratorAssetIds(assetIds),
    onExportGif: (asset: MediaAsset) => setGifExportAsset(asset),
    onAnalyzeSpectrum: (asset: MediaAsset) => setSpectrumAsset(asset),
    onScanDuplicates: () => void scanDuplicateMedia(),
    onAddToTimeline: addAssetToTimeline,
    onAddVersion: (assetId: string) => void addVersionForMedia(assetId),
    onCompareVersions: openMediaVersionCompare,
    onAddAdjustmentLayer: addAdjustmentLayer,
    onRelink: (assetId: string) => void relinkMedia(assetId),
    onRelinkAll: () => void relinkAllMissing(),
    onGenerateProxy: (assetId: string) => void generateProxyForMedia(assetId),
    onConvertToCfr: convertVfrMediaToCfr,
    onSetLabel: (assetId: string, labelColor?: MediaLabelColor) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], labelColor }),
    onSetRating: (assetId: string, rating: number) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], rating }),
    onSetFlag: (assetId: string, flag?: MediaFlag) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], flag }),
    onBatchUpdateMetadata: batchUpdateMediaMetadata,
    onBatchRenameMedia: batchRenameMedia,
    onAddTitleTemplate: addTitleTemplate,
    onCreateFolder: createMediaFolder,
    onRenameFolder: renameMediaFolder,
    onDeleteFolder: deleteMediaFolder,
    onSetFolderCollapsed: setMediaFolderCollapsed,
    onMoveMediaToFolder: moveMediaToFolder,
    onApplyEffectPreset: applyEffectPresetToSelectedClip,
    onToggleFavorite: handleToggleFavorite,
    onRevealInTimeline: handleRevealFromMediaBin,
    onPinToSession: handlePinToSession,
    onAddSubclip: handleAddSubclip,
    onUpdateSubclip: handleUpdateSubclip,
    onDeleteSubclip: handleDeleteSubclip,
    onAddSubclipToTimeline: handleAddSubclipToTimeline,
  }), [
    importMedia, importDropped, openBatchTranscode, batchGenerateCovers,
    setThumbnailGeneratorAssetIds, setGifExportAsset, setSpectrumAsset,
    scanDuplicateMedia, addAssetToTimeline, addVersionForMedia,
    openMediaVersionCompare, addAdjustmentLayer, relinkMedia, relinkAllMissing,
    generateProxyForMedia, convertVfrMediaToCfr, setMediaMetadata,
    batchUpdateMediaMetadata, batchRenameMedia, addTitleTemplate,
    createMediaFolder, renameMediaFolder, deleteMediaFolder,
    setMediaFolderCollapsed, moveMediaToFolder, applyEffectPresetToSelectedClip,
    handleToggleFavorite, handleRevealFromMediaBin, handlePinToSession,
    handleAddSubclip, handleUpdateSubclip, handleDeleteSubclip,
    handleAddSubclipToTimeline, project.mediaMetadata,
  ]);

  const floatingDialogsCallbacks = useMemo(() => ({
    templateExportPreset,
    exportDialogOpen,
    setExportDialogOpen,
    timelineExportDialogOpen,
    setTimelineExportDialogOpen,
    lastExportPath,
    onExportCompleted: (path: string) => {
      setLastExportPath(path);
      setTutorialSignals((current: TutorialSignals) => ({ ...current, videoExported: true }));
      void runAutomationForMedia('on-export-complete', useEditorStore.getState().project.media);
    },
    onRelinkMissing: () => void relinkAllMissing(),
    importEdlTimeline,
    addMedia,
    createProjectFromTemplate,
    createProjectFromTimelineTemplate,
    colorAnalysisResults,
    colorAnalysisJumps,
    colorAnalysisBusy,
    runTimelineColorAnalysis,
    alignTimelineColorToReference,
    seekSpectrumTime,
    setSpectrumSelectionRange,
    splitSpectrumAtTime,
    importVideosForStitchWizard,
    generateVideoStitchTimeline,
    addAssetToTimeline,
    analyzeContentClip,
    analyzePreferredContentTargets,
    exportContentAnalysis,
    applySpeakerDiarization,
    speakerDiarizationResult,
    contentAnalysisTargets,
    operationRecording,
    operationRecordingActive,
    operationReplayRunning,
    operationRecordingStep,
    operationReplaySpeed,
    startOperationRecording,
    stopOperationRecording,
    saveOperationRecording,
    loadOperationRecording,
    replayOperationRecording,
    pauseOperationReplay,
    jumpOperationRecording,
    exportOperationRecordingSlides,
    profilerRecording,
    profilerElapsedMs,
    profilerReport,
    startProfilerRecording,
    stopProfilerRecording,
    exportProfilerReportJson,
    saveNamedSnapshot,
    restoreSnapshotProject,
    applySnapshotDiffSelection,
    updateProjectReleaseVersion,
    syncCompareClipRefs,
    jumpToMediaAsset,
    detectedBeatBpm,
    beatSyncBeatTimes,
    canDetectBeats,
    canSnapToBeats,
    applyManualBeatBpm,
    detectSelectedBeats: () => void detectSelectedBeats(),
    snapSelectedToBeats,
    updatePreviewPerformance,
    updateTimelineInteractionSettings,
    deleteProxiesForMedia,
    regenerateProxiesForMedia,
    migrateProxiesToDirectory,
    executeMacro,
    confirmProjectEncryptionSave,
    refreshProjectHealth,
    autoRepairProjectHealth,
    relinkMissingFromHealth,
    removeOrphanFromHealth,
    mergeDuplicateFromHealth,
    queueProxyFromHealth,
    mergeDuplicateMediaGroups,
    refreshMediaHealthDashboard,
    repairFromMediaHealthDashboard,
    openMediaHealthRelinkPanel,
    refreshMediaOrganizer,
    confirmMediaOrganizerDuplicateGroups,
    removeMediaOrganizerReferences,
    archiveUnusedMedia,
    renameUnusedMedia,
    recoveryCandidate,
    exportQueueRecovery,
    archiveProgress,
    sharePackageProgress,
    restoreRecovery,
    discardRecovery,
    restoreExportQueueRecovery,
    discardExportQueueRecovery,
    skipTutorial,
    closeTutorialCelebration,
    runAutomationForMedia,
    setLastExportPath,
    setTutorialSignals,
  }), [
    templateExportPreset, exportDialogOpen, setExportDialogOpen,
    timelineExportDialogOpen, setTimelineExportDialogOpen, lastExportPath,
    relinkAllMissing, importEdlTimeline, addMedia,
    createProjectFromTemplate, createProjectFromTimelineTemplate,
    colorAnalysisResults, colorAnalysisJumps, colorAnalysisBusy,
    runTimelineColorAnalysis, alignTimelineColorToReference,
    seekSpectrumTime, setSpectrumSelectionRange, splitSpectrumAtTime,
    importVideosForStitchWizard, generateVideoStitchTimeline,
    addAssetToTimeline, analyzeContentClip, analyzePreferredContentTargets,
    exportContentAnalysis, applySpeakerDiarization, speakerDiarizationResult,
    contentAnalysisTargets,
    operationRecording, operationRecordingActive, operationReplayRunning,
    operationRecordingStep, operationReplaySpeed,
    startOperationRecording, stopOperationRecording,
    saveOperationRecording, loadOperationRecording,
    replayOperationRecording, pauseOperationReplay,
    jumpOperationRecording, exportOperationRecordingSlides,
    profilerRecording, profilerElapsedMs, profilerReport,
    startProfilerRecording, stopProfilerRecording, exportProfilerReportJson,
    saveNamedSnapshot, restoreSnapshotProject,
    applySnapshotDiffSelection, updateProjectReleaseVersion,
    syncCompareClipRefs, jumpToMediaAsset,
    detectedBeatBpm, beatSyncBeatTimes, canDetectBeats, canSnapToBeats,
    applyManualBeatBpm, detectSelectedBeats, snapSelectedToBeats,
    updatePreviewPerformance, updateTimelineInteractionSettings,
    deleteProxiesForMedia, regenerateProxiesForMedia, migrateProxiesToDirectory,
    executeMacro, confirmProjectEncryptionSave,
    refreshProjectHealth, autoRepairProjectHealth,
    relinkMissingFromHealth, removeOrphanFromHealth,
    mergeDuplicateFromHealth, queueProxyFromHealth,
    mergeDuplicateMediaGroups, refreshMediaHealthDashboard,
    repairFromMediaHealthDashboard, openMediaHealthRelinkPanel,
    refreshMediaOrganizer, confirmMediaOrganizerDuplicateGroups,
    removeMediaOrganizerReferences, archiveUnusedMedia, renameUnusedMedia,
    recoveryCandidate, exportQueueRecovery, archiveProgress,
    sharePackageProgress, restoreRecovery, discardRecovery,
    restoreExportQueueRecovery, discardExportQueueRecovery,
    skipTutorial, closeTutorialCelebration, runAutomationForMedia,
    setLastExportPath, setTutorialSignals,
  ]);

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: editorGridRows }} data-testid="editor-shell">
        <Toolbar
          onNewProject={newProject}
          onNewFromTemplate={() => setProjectTemplateOpen(true)}
          onSaveTimelineTemplate={() => setTimelineTemplateMode('save')}
          onNewFromTimelineTemplate={() => setTimelineTemplateMode('new')}
          onOpenProject={openProject}
          onSaveProject={() => void saveProject()}
          onSaveEncryptedProject={saveEncryptedProject}
          onArchiveProject={() => void archiveCurrentProject()}
          onOpenReleaseWorkflow={() => setReleaseWorkflowOpen(true)}
          onCreateMediaReport={() => void createMediaReport()}
          onCreateClipReport={() => void createClipReport()}
          onGenerateVideoSummary={() => setVideoSummaryOpen(true)}
          onGenerateNarration={() => setNarrationOpen(true)}
          onCreateSharePackage={() => void createCurrentSharePackage()}
          onConformMedia={() => void conformMedia()}
          onImportBookmarks={() => void importBookmarks()}
          onExportBookmarks={() => void exportBookmarks()}
          onSaveSnapshot={() => setSnapshotNameOpen(true)}
          onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
          onOpenSnapshotCompare={() => setSnapshotCompareOpen(true)}
          onOpenTimelineCompare={() => setTimelineCompareOpen(true)}
          onImportMedia={() => void importMedia()}
          onBatchTranscode={() => openBatchTranscode()}
          onOpenBatchWatermark={() => setBatchWatermarkOpen(true)}
          onOpenBatchProjectProcessing={() => setBatchProjectProcessingOpen(true)}
          onOpenMediaPrecheck={() => setMediaPrecheckOpen(true)}
          onOpenMediaOrganizer={openMediaOrganizer}
          onOpenMediaHealthDashboard={openMediaHealthDashboard}
          onOpenVideoStitchWizard={() => setVideoStitchWizardOpen(true)}
          onAddMotionGraphic={addMotionGraphic}
          onOpenThumbnailGenerator={() => setThumbnailGeneratorAssetIds([])}
          onOpenLutEditor={() => setLutEditorOpen(true)}
          onOpenColorNodeEditor={openColorNodeEditor}
          onOpenColorAnalysis={openColorAnalysis}
          onOpenSyncCompare={openSyncCompare}
          onOpenSceneDetection={() => setSceneDetectionRequestId((id) => id + 1)}
          onOpenSceneReorder={() => setSceneReorderOpen(true)}
          onOpenStyleTransfer={() => setStyleTransferOpen(true)}
          onOpenCollaborationNotes={() => setCollaborationNotesOpen(true)}
          onOpenOperationRecording={() => setOperationRecordingOpen(true)}
          onOpenComplexityScore={() => setComplexityScoreOpen(true)}
          onOpenSmartRecommendations={() => setSmartRecommendationsOpen(true)}
          onOpenContentAnalysis={() => setContentAnalysisOpen(true)}
          onOpenPerformanceProfiler={() => setProfilerOpen(true)}
          onOpenRhythmAnalysis={() => setRhythmAnalysisOpen(true)}
          onOpenBeatSync={() => setBeatSyncOpen(true)}
          onDetectBeats={() => void detectSelectedBeats()}
          onSnapToBeats={snapSelectedToBeats}
          onSplitToBeats={splitSelectedToBeats}
          onOpenAutoAudioSync={openAutoAudioSync}
          onOpenMacroHistory={() => setMacroHistoryOpen(true)}
          onStartMacroRecording={startMacroRecording}
          onStopMacroRecording={() => void stopMacroRecording()}
          onImportSubtitles={() => void importSubtitles()}
          onImportDataSubtitles={(mode) => void importDataSubtitles(mode)}
          onStartRecording={(source) => void startEditorRecording(source)}
          onStopRecording={() => void stopEditorRecording()}
          onExportVideo={() => setExportDialogOpen(true)}
          onExportTimeline={() => setTimelineExportDialogOpen(true)}
          onExportProfessionalNle={() => setProfessionalNleExportOpen(true)}
          onExportCurrentFrame={() => void exportCurrentFrame()}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={splitSelected}
          onToggleSmartRoughCut={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen((open) => !open);
          }}
          onToggleAIRoughCut={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setAiRoughCutOpen((open) => !open);
          }}
          onToggleDirectorMode={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setDirectorModeOpen((open) => !open);
          }}
          onToggleMusicMatch={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setMusicMatchOpen((open) => !open);
          }}
          onToggleHighlightReel={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setHighlightReelOpen((open) => !open);
          }}
          onToggleContextualTranslation={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setContextualTranslationOpen((open) => !open);
          }}
          onToggleAIChatEditor={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setAiChatEditorOpen((open) => !open);
          }}
          onSeparateAudio={() => void separateSelectedAudio()}
          onCancelAudioSeparation={() => void cancelAudioSeparation()}
          onRunSpeakerDiarization={() => void runSpeakerDiarization()}
          onCreateMulticamSequence={createMulticamSequence}
          onApplyPiPLayout={applyPiPLayout}
          onApplySplitLayout={applySplitLayout}
          onSaveCustomSplitLayout={(ratio) => saveCustomSplitLayout(ratio)}
          canCreateMulticamSequence={canCreateMulticamSequence}
          canApplyPiPLayout={canApplyPiPLayout}
          canApplySplitLayout={canApplySplitLayout}
          canOpenSyncCompare={canOpenSyncCompare}
          canOpenSceneDetection={canOpenSceneDetection}
          canOpenSceneReorder={canOpenSceneReorder}
          pipLayoutPosition={pipLayoutPosition}
          onPiPLayoutPositionChange={setPiPLayoutPosition}
          customSplitLayouts={customSplitLayouts}
          canDetectBeats={canDetectBeats}
          canSnapToBeats={canSnapToBeats}
          canSplitToBeats={canSplitToBeats}
          canOpenAutoAudioSync={canOpenAutoAudioSync}
          beatSensitivity={beatSensitivity}
          onBeatSensitivityChange={setBeatSensitivity}
          canSeparateAudio={canSeparateSelectedAudio}
          audioSeparationRunning={Boolean(audioSeparationClipId)}
          audioSeparationProgress={audioSeparationProgress}
          canRunSpeakerDiarization={canRunSpeakerDiarization}
          speakerDiarizationRunning={speakerDiarizationRunning}
          autoAudioSyncRunning={autoAudioSyncRunning}
          macroRecordingActive={macroRecordingActive}
          macroRecordingStepCount={macroRecordingStepCount}
          recordingActive={Boolean(recordingTask)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          smartRoughCutOpen={smartRoughCutOpen}
          aiRoughCutOpen={aiRoughCutOpen}
          directorModeOpen={directorModeOpen}
          musicMatchOpen={musicMatchOpen}
          highlightReelOpen={highlightReelOpen}
          contextualTranslationOpen={contextualTranslationOpen}
          aiChatEditorOpen={aiChatEditorOpen}
          historyPanelOpen={historyPanelOpen}
          projectDocumentationOpen={projectDocumentationOpen}
          storyboardOpen={storyboardOpen}
          workspaceLayouts={workspaceLayouts}
          activeWorkspaceLayoutId={layoutSettings.activeWorkspaceLayoutId}
          onApplyWorkspaceLayout={applyWorkspaceLayoutById}
          onSaveWorkspaceLayout={() => void saveCurrentWorkspaceLayout()}
          safeFrameGuides={safeFrameGuides}
          thumbnailTrackVisible={thumbnailTrackVisible}
          timelineMinimapVisible={timelineMinimapVisible}
          timelineHeatmap={timelineHeatmap}
          previewQualityMode={previewPerformance.qualityMode}
          previewWindowOpen={previewWindowOpen}
          timelineGridSettings={timelineGridSettings}
          reviewMode={reviewMode}
          onToggleReviewMode={() => setReviewMode((mode) => !mode)}
          onCreateReviewReport={() => void createReviewReport()}
          onPreviewQualityModeChange={(qualityMode: PreviewQualityMode) => updatePreviewPerformance({ qualityMode, adaptiveEnabled: false })}
          onPopoutPreview={() => void openDetachedPreview()}
          onToggleTimelineGridSnap={toggleTimelineGridSnap}
          onTimelineGridUnitChange={changeTimelineGridUnit}
          onToggleStoryboard={() => setStoryboardOpen((open) => !open)}
          onToggleSafeFrameGuides={toggleSafeFrameGuides}
          onToggleThumbnailTrack={toggleThumbnailTrackVisible}
          onToggleTimelineMinimap={toggleTimelineMinimapVisible}
          onTimelineHeatmapChange={updateTimelineHeatmap}
          onToggleHistoryPanel={() => {
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setProjectDocumentationOpen(false);
            setHistoryPanelOpen((open) => {
              const next = !open;
              persistPanelVisibilityPatch({ history: next });
              return next;
            });
          }}
          onToggleProjectDocumentation={toggleProjectDocumentation}
          onUndo={undo}
          onRedo={redo}
          onClearCache={() => void clearCache()}
          onOpenSettings={() => setSettingsOpen(true)}
              onOpenErrorKnowledge={() => setErrorKnowledgeOpen(true)}
              onOpenSequenceCompare={() => setSequenceCompareOpen(true)}
              onOpenSubtitleSync={() => setSubtitleSyncOpen(true)}
              onOpenProxyVerify={() => setProxyVerifyOpen(true)}
              onOpenFormatConverter={() => setFormatConverterOpen(true)}
              onOpenEmotionAnalysis={() => setEmotionAnalysisOpen(true)}
              onOpenExportHistoryClassifier={() => setExportHistoryClassifierOpen(true)}
          onStartTutorial={startTutorial}
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
        <div className="absolute right-3 top-2 z-10">
          <PerformanceAlertIcon />
        </div>
        <ShellMainArea
          mainGridColumns={mainGridColumns}
          effectivePanels={effectivePanels}
          layoutSettings={layoutSettings}
          reviewMode={reviewMode}
          previewWindowOpen={previewWindowOpen}
          safeFrameGuides={safeFrameGuides}
          previewPerformance={previewPerformance}
          handleProfilerFrame={handleProfilerFrame}
          addReviewAnnotationAtPlayhead={addReviewAnnotationAtPlayhead}
          createReviewReport={createReviewReport}
          reembedPreviewWindow={reembedPreviewWindow}
          persistPanelVisibilityPatch={persistPanelVisibilityPatch}
          reviewVisibility={reviewVisibility}
          timelineHeightPx={timelineHeightPx}
          storyboardOpen={storyboardOpen}
          thumbnailTrackVisible={thumbnailTrackVisible}
          timelineMinimapVisible={timelineMinimapVisible}
          timelineHeatmap={timelineHeatmap}
          colorHeatmapPoints={colorHeatmapPoints}
          colorAnalysisJumps={colorAnalysisJumps}
          timelineGridSettings={timelineGridSettings}
          reduceMotion={timelineInteractionSettings.reduceMotion}
          convertVfrMediaToCfr={convertVfrMediaToCfr}
          sceneDetectionRequestId={sceneDetectionRequestId}
          leftPanelCallbacks={leftPanelCallbacks}
          beginTimelineResize={beginTimelineResize}
        />
        <ShellFloatingDialogs {...floatingDialogsCallbacks} />
      </div>
    </ErrorBoundary>
  );

  async function restoreRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      const password = isEncryptedProjectPath(recoveryCandidate.autosavePath)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(recoveryCandidate.autosavePath) && !password) {
        return;
      }
      const restored = await readProjectFile(recoveryCandidate.autosavePath, recoveryCandidate.projectPath ?? recoveryCandidate.autosavePath, { password });
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
        const importedMedia = await applyImportedMediaColorConversionChoice(result.media);
        addMedia(importedMedia);
        await persistMediaFingerprints(importedMedia);
        await queueFrameRateConversionForImportedMedia(importedMedia);
        void runAutomationForMedia('on-import', importedMedia);
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
      const importedSpeakers = collectSubtitleSpeakersFromTrack(track);
      if (importedSpeakers.length > 0) {
        commandManager.execute(new UpdateProjectSpeakersCommand(projectAccessor, mergeProjectSpeakers(useEditorStore.getState().project.speakers, importedSpeakers)));
      }
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
