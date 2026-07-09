import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AddAdjustmentLayerCommand,
  AutoRepairProjectHealthCommand,
  AddClipCommand,
  AddMotionGraphicCommand,
  AddMediaFolderCommand,
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddSpeakerDiarizationTracksCommand,
  AddProjectBookmarkCommand,
  AddSubclipCommand,
  ApplyEffectPresetCommand,
  ApplySplitLayoutCommand,
  BatchImportSubtitleCommand,
  BatchAlignToBeatCommand,
  BatchRenameMediaCommand,
  BatchShiftClipsCommand,
  BatchUpdateClipCommand,
  BatchUpdateMetadataCommand,
  AddTrackCommand,
  AddTransitionCommand,
  buildConformMediaReplacements,
  buildConformPreflight,
  buildConformReport,
  analyzeColorFrameSample,
  buildColorAlignmentUpdates,
  buildTimelineColorHeatmapData,
  CreateMulticamSequenceCommand,
  detectSceneColorJumps,
  ConformMediaCommand,
  UpdateProjectMediaCollectionsCommand,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_REVIEW_ANNOTATION_COLOR,
  DeleteGroupCommand,
  DeleteClipsCommand,
  DeleteMediaFolderCommand,
  DeleteSubclipCommand,
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
  SplitClipCommand,
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
  createMainSideSplitLayout,
  detectSubtitleDataOverlaps,
  dirname,
  round,
  replaceMediaPathBasename,
  getSplitLayoutDefinition,
  getClipSpeed,
  getClipSourceVisibleDuration,
  getCfrTargetFrameRate,
  getColorSpaceDisplayName,
  getProjectFrameRateConversionTarget,
  getTimelineDuration,
  isFrameRateMismatch,
  findCompleteClipGroup,
  findSyncCompareClipRefs,
  findTimelineNavigationPoint,
  normalizeClipGroups,
  normalizeProjectWorkingColorSpace,
  normalizeProjectSpeakers,
  normalizeExportRanges,
  resolveAutoAudioSyncApplyRoute,
  applyTimelineVersionDiffSelection,
  instantiateProjectTemplate,
  instantiateTitleTemplate,
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
  type ColorAnalysisClipSample,
  type SceneColorDifference,
  type TimelineColorAnalysisResult,
  type TimelineColorHeatmapPoint,
  type AutoAudioSyncApplyMode,
  type AutoAudioSyncResult,
  type MediaVersionCompareRequest,
  type MediaRenamePreviewItem,
  type SmartDuplicateGroup,
  matchConformByFilename,
  hasLowConfidenceSpeakerSegments,
} from '@open-factory/editor-core';
import {
  matchFrameFromClip,
  revealInTimeline as coreRevealInTimeline,
  navigateToNextInstance as coreNavigateToNextInstance,
  getMediaInstanceNavigation,
  type ClipboardKeyframeGroup,
  type PasteMode,
  PasteKeyframesCommand,
  computeTimelineGaps,
  navigateGap
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
import { useShortcuts } from '../hooks/useShortcuts';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import { isEditableKeyboardTarget, isShortcutCheatsheetKey } from '../accessibility/keyboard-navigation';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import { useExportQueueStore } from '../export/export-queue-store';
import { revealExport } from '../lib/exportVideo';
import { clearMediaCache } from '../cache/cache-service';
import { createAdjustmentLayerClip, createClipFromAsset, createMotionGraphicClip, findPreferredTrack } from '../lib/clipFactory';
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
import { collectProjectArchivePreflight, saveClipReport, saveOfflineMediaReport } from '../lib/mediaReport';
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
  readColorMatchFrameSample,
  saveFileDialog as bridgeSaveFileDialog,
  sendNotification,
  startRecording,
  stopRecording,
  writeFile as bridgeWriteFile,
  type DemucsProgressEvent,
  type PreviewWindowState,
  type RecordingSource
} from '../lib/tauri-bridge';
import { renderPreviewCache } from '../lib/tauri-bridge';
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
  saveCustomSplitLayouts,
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
import { useEditorMiscStore } from '../store/editorMiscStore';
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
  findTimelineClipForMediaSourceTime,
  isPiPVisualClip,
  isSceneReorderClip,
  getClipSourceDimensions,
  collectClipKeyframeRefs,
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

  const refreshSharedLibraryResources = useCallback(async () => {
    try {
      setSharedLibraryResources(await loadSharedLibrary());
    } catch (error) {
      console.warn('Unable to load shared library', error);
      setSharedLibraryResources([]);
    }
  }, []);

  useEffect(() => {
    void refreshSharedLibraryResources();
    const onSharedLibraryUpdated = () => {
      void refreshSharedLibraryResources();
    };
    window.addEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
    return () => window.removeEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
  }, [refreshSharedLibraryResources]);

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

  const toggleTimelineMinimapVisible = useCallback(() => {
    setTimelineMinimapVisible((current) => {
      const next = !current;
      void saveViewSettings({ timelineMinimapVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const updateTimelineHeatmap = useCallback((patch: Partial<TimelineHeatmapViewSettings>) => {
    setTimelineHeatmap((current) => {
      const optimistic = normalizeTimelineHeatmapViewSettings({ ...current, ...patch });
      void saveViewSettings({ timelineHeatmap: optimistic })
        .then((view) => setTimelineHeatmap(view.timelineHeatmap))
        .catch((error) => {
          console.warn('Unable to save timeline heatmap settings', error);
        });
      return optimistic;
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

  const updateTimelineInteractionSettings = useCallback((patch: Partial<TimelineInteractionSettings>) => {
    setTimelineInteractionSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineInteractionSettings(optimistic)
        .then((saved) => setTimelineInteractionSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline interaction settings', error);
        });
      return optimistic;
    });
  }, []);

  const persistPreviewWindowState = useCallback((state: PreviewWindowState) => {
    if (!state.bounds) {
      return;
    }
    setPreviewWindowResolutionScale(state.resolutionScale);
    void savePreviewWindowSettings({
      bounds: state.bounds,
      alwaysOnTop: state.alwaysOnTop,
      resolutionScale: state.resolutionScale
    }).catch((error) => {
      console.warn('Unable to save preview window settings', error);
    });
  }, []);

  const openDetachedPreview = useCallback(async () => {
    try {
      const settings = await readPreviewWindowSettings();
      const state = await openPreviewWindow(settings);
      setPreviewWindowOpen(state.open);
      setPreviewWindowResolutionScale(state.resolutionScale);
      if (state.bounds) {
        persistPreviewWindowState(state);
      }
      await emitBridge('preview-window-project-state', {
        source: 'main',
        project,
        playheadTime,
        isPlaying,
        previewPerformance,
        resolutionScale: state.resolutionScale
      });
      await emitBridge('preview-window-sync', createPreviewWindowPlaybackState('main', playheadTime, isPlaying));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.toolbar.popoutPreview, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  }, [isPlaying, persistPreviewWindowState, playheadTime, previewPerformance, project]);

  const reembedPreviewWindow = useCallback(async () => {
    const state = await closePreviewWindow().catch(() => undefined);
    if (state) {
      persistPreviewWindowState(state);
    }
    setPreviewWindowOpen(false);
  }, [persistPreviewWindowState]);

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

  const requestProjectPassword = useCallback((title: string, description: string) => {
    return new Promise<string | undefined>((resolve) => {
      setProjectPasswordRequest({ title, description, resolve });
    });
  }, []);

  const saveProject = useCallback(async (options: ProjectFileEncryptionOptions = {}) => {
    const encryptedSave = options.encrypted === true;
    const nextPath =
      projectPath && !encryptedSave
        ? projectPath
        : await chooseProjectSavePath(`${project.name}${encryptedSave ? '.cutproj.enc' : '.cutproj.json'}`, encryptedSave);
    if (!nextPath && !projectPath) {
      return;
    }
    const targetPath = nextPath ?? projectPath;
    if (!targetPath) {
      return;
    }
    await writeProjectFile(project, targetPath, { ...options, encrypted: encryptedSave || isEncryptedProjectPath(targetPath) });
    await deleteAutosaveAfterSave(targetPath, projectPath);
    try {
      setLastBackupAt((await readBackupSettings()).lastBackupAt);
    } catch (error) {
      console.warn(zhCN.settings.backup.statusSaveFailed, error);
    }
    setProjectPath(targetPath);
    setDirty(false);
    setTutorialSignals((current) => ({ ...current, projectSaved: true }));
    showToast({ kind: 'success', title: zhCN.editorToasts.projectSaved });
  }, [project, projectPath, setDirty, setProjectPath]);

  const saveEncryptedProject = useCallback(() => {
    setProjectEncryptionSaveOpen(true);
  }, []);

  const startTutorial = useCallback(() => {
    const nextProgress = normalizeTutorialProgressSettings({ tutorialStep: 0, tutorialSkipped: false, tutorialCompleted: false });
    setTutorialCelebrationVisible(false);
    setTutorialSignals(DEFAULT_TUTORIAL_SIGNALS);
    setTutorialProgress(nextProgress);
    void saveTutorialProgressSettings(nextProgress).catch((error) => {
      console.warn('Unable to save tutorial progress settings', error);
    });
  }, []);

  const skipTutorial = useCallback(() => {
    setTutorialCelebrationVisible(false);
    setTutorialProgress((current) => {
      const nextProgress = skipTutorialProgress(current ?? normalizeTutorialProgressSettings(undefined));
      void saveTutorialProgressSettings(nextProgress).catch((error) => {
        console.warn('Unable to save tutorial progress settings', error);
      });
      return nextProgress;
    });
  }, []);

  const closeTutorialCelebration = useCallback(() => {
    setTutorialCelebrationVisible(false);
  }, []);

  const confirmProjectEncryptionSave = useCallback(
    async (options: ProjectFileEncryptionOptions) => {
      setProjectEncryptionSaveOpen(false);
      await saveProject(options);
    },
    [saveProject]
  );

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

  const conformMedia = useCallback(async () => {
    try {
      const directory = await openDirectoryDialog();
      if (!directory) {
        showToast({ kind: 'info', title: zhCN.conformMedia.canceledTitle });
        return;
      }
      const paths = await scanDirectory(directory, 3);
      const currentProject = useEditorStore.getState().project;
      const matches = matchConformByFilename(
        currentProject.media,
        paths.map((path) => ({ path })),
        { caseInsensitive: true }
      );
      const preflight = buildConformPreflight(currentProject.media, matches, { fallbackFrameRate: currentProject.settings.fps });
      const replacements = buildConformMediaReplacements(preflight);
      const report = buildConformReport(preflight, { selectedOnly: true });

      if (replacements.length === 0) {
        showToast({ kind: 'warning', title: zhCN.conformMedia.noMatchesTitle, message: zhCN.conformMedia.noMatchesMessage });
        return;
      }

      commandManager.execute(new ConformMediaCommand(projectAccessor, replacements, zhCN.conformMedia.commandDescription));
      showToast({
        kind: report.failureCount > 0 || report.warningCount > 0 ? 'warning' : 'success',
        title: zhCN.conformMedia.completedTitle,
        message: zhCN.conformMedia.completedMessage(report.successCount, report.warningCount, report.failureCount)
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.conformMedia.failedTitle,
        message: error instanceof Error ? error.message : zhCN.conformMedia.failedMessage
      });
    }
  }, []);

  const jumpToMediaAsset = useCallback((assetId: string) => {
    const element = document.querySelector(`[data-testid="media-card-${assetId}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'nearest' });
    element?.focus();
  }, []);

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

  const persistMediaFingerprints = useCallback(async (media: MediaAsset[]) => {
    for (const asset of media) {
      try {
        const fingerprint = await generateMediaFingerprint(asset);
        if (fingerprint) {
          const metadata = useEditorStore.getState().project.mediaMetadata[asset.id];
          useEditorStore.getState().setMediaMetadata(asset.id, { ...metadata, fingerprint });
        }
      } catch {
        // Fingerprints improve duplicate detection but must not block local import.
      }
    }
  }, []);

  const applyImportedMediaColorConversionChoice = useCallback(async (media: MediaAsset[]): Promise<MediaAsset[]> => {
    const workingColorSpace = normalizeProjectWorkingColorSpace(useEditorStore.getState().project.settings.workingColorSpace);
    const mismatched = media.filter((asset) => asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace);
    if (mismatched.length === 0) {
      return media;
    }
    const confirmed = await bridgeConfirm(zhCN.editorToasts.colorConversionPrompt(mismatched.length, getColorSpaceDisplayName(workingColorSpace)), {
      title: zhCN.settings.general.workingColorSpace
    });
    if (!confirmed) {
      return media;
    }
    return media.map((asset) =>
      asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace
        ? { ...asset, colorProfile: { ...asset.colorProfile, autoConvertToWorkingSpace: true } }
        : asset
    );
  }, []);

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
        const importedMedia = await applyImportedMediaColorConversionChoice(result.media);
        addMedia(importedMedia);
        await persistMediaFingerprints(importedMedia);
        await queueFrameRateConversionForImportedMedia(importedMedia);
        void runAutomationForMedia('on-import', importedMedia);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
    }
  }, [addMedia, applyImportedMediaColorConversionChoice, persistMediaFingerprints, project.media, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const addVersionForMedia = useCallback(
    async (assetId: string) => {
      const currentProject = useEditorStore.getState().project;
      const asset = currentProject.media.find((item) => item.id === assetId);
      if (!asset) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionMissingAsset });
        return;
      }
      try {
        const paths = await pickMediaPaths();
        const path = paths[0];
        if (!path) {
          return;
        }
        if (path === asset.path) {
          showToast({ kind: 'warning', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionSameFile });
          return;
        }
        const latestProject = useEditorStore.getState().project;
        const existing = latestProject.media.find((item) => item.path === path);
        const result = existing ? { media: [] as MediaAsset[], duplicateCount: 1 } : await probeMediaPaths([path], latestProject.media);
        const importedMedia = result.media.length > 0 ? await applyImportedMediaColorConversionChoice(result.media) : result.media;
        const versionAsset = existing ?? importedMedia[0];
        if (!versionAsset) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.importFailedMessage });
          return;
        }
        if (versionAsset.type !== asset.type) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionTypeMismatch });
          return;
        }
        if (importedMedia.length > 0) {
          addMedia(importedMedia);
          await persistMediaFingerprints(importedMedia);
          await queueFrameRateConversionForImportedMedia(importedMedia);
          void runAutomationForMedia('on-import', importedMedia);
        }
        const metadata = useEditorStore.getState().project.mediaMetadata[assetId];
        setMediaMetadata(assetId, appendMediaVersion(metadata, versionAsset));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaVersionAdded, message: zhCN.editorToasts.mediaVersionAddedMessage(versionAsset.name) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      }
    },
    [addMedia, applyImportedMediaColorConversionChoice, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia, setMediaMetadata]
  );

  const openMediaVersionCompare = useCallback(
    (assetId: string) => {
      const request = buildMediaVersionCompareRequest(useEditorStore.getState().project, assetId, undefined, undefined, playheadTime);
      if (!request) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.mediaVersionCompareUnavailable, message: zhCN.editorToasts.mediaVersionCompareUnavailableMessage });
        return;
      }
      setMediaVersionCompare(request);
    },
    [playheadTime]
  );

  const openBatchTranscode = useCallback((paths: string[] = []) => {
    setBatchTranscodeInitialPaths(paths);
    setBatchTranscodeOpen(true);
  }, []);

  const batchGenerateCovers = useCallback(async () => {
    const tasks = buildCoverFrameBatchTasks(useEditorStore.getState().project.media);
    if (tasks.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.coverBatchFailed, message: zhCN.editorToasts.coverBatchNoVideo });
      return;
    }
    try {
      const baseDir = projectPath ? dirname(projectPath) : await getAppDataDir();
      const result = await batchExtractCoverFrames({
        outputDir: joinLocalPath(baseDir, 'covers'),
        tasks
      });
      const completed = result.results.filter((item) => item.status === 'completed').length;
      if (completed === 0) {
        showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: result.results.find((item) => item.error)?.error ?? zhCN.editorToasts.coverBatchFailedMessage });
        return;
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.coverBatchCompleted, message: zhCN.editorToasts.coverBatchCompletedMessage(completed) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.coverBatchFailedMessage });
    }
  }, [projectPath]);

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

  const updateProjectReleaseVersion = useCallback((version: string) => {
    commandManager.execute(new UpdateProjectReleaseVersionCommand(projectAccessor, version));
  }, []);

  const scanDuplicateMedia = useCallback(async () => {
    try {
      const currentProject = useEditorStore.getState().project;
      const groups = await scanDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata);
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

  const refreshMediaOrganizer = useCallback(async () => {
    setMediaOrganizerScanning(true);
    try {
      const currentProject = useEditorStore.getState().project;
      const [groups, cleanup] = await Promise.all([
        scanSmartDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata),
        scanMediaCleanupReport(currentProject)
      ]);
      setMediaOrganizerGroups(groups);
      setMediaOrganizerCleanup(cleanup);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaOrganizer.scanFailed,
        message: error instanceof Error ? error.message : zhCN.mediaOrganizer.scanFailedMessage
      });
    } finally {
      setMediaOrganizerScanning(false);
    }
  }, []);

  const openMediaOrganizer = useCallback(() => {
    setMediaOrganizerOpen(true);
    void refreshMediaOrganizer();
  }, [refreshMediaOrganizer]);

  const confirmMediaOrganizerDuplicateGroups = useCallback(
    async (selections: MediaOrganizerDuplicateSelection[], moveFilesToTrash: boolean) => {
      try {
        const assetById = new Map(useEditorStore.getState().project.media.map((asset) => [asset.id, asset]));
        if (moveFilesToTrash) {
          for (const assetId of selections.flatMap((selection) => selection.removeAssetIds)) {
            const asset = assetById.get(assetId);
            if (asset) {
              await bridgeTrashFile(asset.path);
            }
          }
        }
        let removedCount = 0;
        for (const selection of selections) {
          commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, [selection.keepAssetId, ...selection.removeAssetIds]));
          removedCount += selection.removeAssetIds.length;
        }
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(removedCount) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const removeMediaOrganizerReferences = useCallback(
    (assetIds: string[]) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, assetIds));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(assetIds.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const archiveUnusedMedia = useCallback(async () => {
    const unused = mediaOrganizerCleanup?.unused ?? [];
    if (unused.length === 0) {
      return;
    }
    try {
      const archiveDir = await openDirectoryDialog();
      if (!archiveDir) {
        showToast({ kind: 'info', title: zhCN.mediaOrganizer.archiveCanceled });
        return;
      }
      const relinkEntries = [];
      for (let index = 0; index < unused.length; index += 1) {
        const asset = unused[index];
        const destination = buildArchiveDestinationPath(archiveDir, asset, index);
        await bridgeMoveFile(asset.path, destination);
        relinkEntries.push({ assetId: asset.id, newPath: destination });
      }
      const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
      commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.archivedTitle));
      showToast({ kind: 'success', title: zhCN.mediaOrganizer.archivedTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
      void refreshMediaOrganizer();
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaOrganizer.archiveFailed, message: error instanceof Error ? error.message : zhCN.mediaOrganizer.archiveFailed });
    }
  }, [mediaOrganizerCleanup, refreshMediaOrganizer]);

  const renameUnusedMedia = useCallback(
    async (template: string) => {
      const unused = mediaOrganizerCleanup?.unused ?? [];
      if (unused.length === 0) {
        return;
      }
      try {
        const relinkEntries = [];
        for (let index = 0; index < unused.length; index += 1) {
          const asset = unused[index];
          const destination = buildRenameDestinationPath(asset, template, index);
          await bridgeMoveFile(asset.path, destination);
          relinkEntries.push({ assetId: asset.id, newPath: destination });
        }
        const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
        commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.renameTitle));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.renameTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [mediaOrganizerCleanup, refreshMediaOrganizer]
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

  // --- 提取到 useContentAnalysisCallbacks hook ---
  const {
    runSingleContentAnalysis,
    analyzeContentClip,
    analyzePreferredContentTargets,
    exportContentAnalysis,
  } = useContentAnalysisCallbacks({ setContentAnalysisRunningClipId });

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
        if (asset.type === 'video') {
          useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
            force: true,
            priority: 'high',
            sourceStart: clip.trimStart,
            sourceDuration: getClipSourceVisibleDuration(clip)
          });
          void ensureMediaJobRunner();
        }
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project, setSelectedClipId]
  );



  const handleAddSubclip = useCallback((subclip: Subclip) => {
    commandManager.execute(new AddSubclipCommand(projectAccessor, subclip));
    showToast({ kind: 'success', title: zhCN.subclip.newSubclip, message: subclip.name });
  }, []);

  const handleUpdateSubclip = useCallback((subclipId: string, patch: Partial<Subclip>) => {
    commandManager.execute(new UpdateSubclipCommand(projectAccessor, subclipId, patch));
  }, []);

  const handleDeleteSubclip = useCallback((subclipId: string) => {
    commandManager.execute(new DeleteSubclipCommand(projectAccessor, subclipId));
    showToast({ kind: 'info', title: zhCN.subclip.deleteSubclip, message: '' });
  }, []);

  const handleAddSubclipToTimeline = useCallback((assetId: string, subclip: Subclip) => {
    const asset = project.media.find((item) => item.id === assetId);
    const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
    if (!asset || !track) {
      showToast({ kind: 'error', title: zhCN.editorToasts.noCompatibleTrack, message: zhCN.editorToasts.noCompatibleTrackMessage });
      return;
    }
    try {
      const clip = createClipFromAsset(asset, track, project.timeline, { subclip, subclipName: subclip.name });
      commandManager.execute(new AddClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [project, setSelectedClipId]);

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

  const applyEffectPresetToSelectedClip = useCallback(
    (preset: EffectPreset) => {
      if (!selectedClip) {
        showToast({ kind: 'warning', title: zhCN.effectPresetLibrary.noClipSelected, message: zhCN.effectPresetLibrary.noClipSelectedMessage });
        return;
      }
      try {
        commandManager.execute(new ApplyEffectPresetCommand(timelineAccessor, selectedClip.id, preset));
        showToast({ kind: 'success', title: zhCN.effectPresetLibrary.applied, message: preset.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.effectPresetLibrary.applyFailed, message: error instanceof Error ? error.message : zhCN.effectPresetLibrary.applyFailedMessage });
      }
    },
    [selectedClip]
  );

  const addMotionGraphic = useCallback(() => {
    try {
      const trackCount = project.timeline.tracks.filter((track) => track.type === 'video').length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.motionGraphics.trackName(trackCount + 1),
        clips: []
      });
      const clip = createMotionGraphicClip(track, project.timeline, playheadTime);
      commandManager.execute(new AddMotionGraphicCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [playheadTime, project.timeline, setSelectedClipId]);

  const openColorNodeEditor = useCallback(() => {
    if (!selectedClip || selectedClip.type === 'audio') {
      showToast({ kind: 'warning', title: zhCN.colorNodeEditor.unavailableTitle, message: zhCN.colorNodeEditor.unavailableMessage });
      return;
    }
    setColorNodeEditorOpen(true);
  }, [selectedClip]);

  const runTimelineColorAnalysis = useCallback(async () => {
    if (colorAnalysisBusy) {
      return;
    }
    setColorAnalysisBusy(true);
    const results: TimelineColorAnalysisResult[] = [];
    const samples: ColorAnalysisClipSample[] = [];
    for (const item of visualTimelineClipRefs) {
      try {
        const sample = await readColorMatchFrameSample(item.media.path);
        if (!sample) {
          continue;
        }
        const metrics = analyzeColorFrameSample(sample);
        results.push({
          clipId: item.clip.id,
          trackId: item.trackId,
          mediaId: item.media.id,
          name: item.clip.name || item.media.name,
          start: item.clip.start,
          duration: item.clip.duration,
          metrics
        });
        samples.push({ clipId: item.clip.id, sample });
      } catch {
        // Skip unreadable clips so one failed background sample cannot block the whole analysis.
      }
    }
    const jumps = detectSceneColorJumps(results);
    setColorAnalysisResults(results);
    setColorAnalysisSamples(samples);
    setColorAnalysisJumps(jumps);
    setColorHeatmapPoints(buildTimelineColorHeatmapData(results));
    setColorAnalysisBusy(false);
    showToast({ kind: 'success', title: zhCN.colorAnalysis.completedTitle, message: zhCN.colorAnalysis.completedMessage(results.length, jumps.length) });
  }, [colorAnalysisBusy, visualTimelineClipRefs]);

  const alignTimelineColorToReference = useCallback(
    (referenceClipId: string) => {
      const updates = buildColorAlignmentUpdates(colorAnalysisSamples, referenceClipId);
      if (updates.length === 0) {
        showToast({ kind: 'warning', title: zhCN.colorAnalysis.title, message: zhCN.colorAnalysis.alignSkipped });
        return;
      }
      commandManager.execute(
        new BatchUpdateClipCommand(
          timelineAccessor,
          updates.map((update) => ({
            clipId: update.clipId,
            patch: { colorCorrection: update.colorCorrection }
          }))
        )
      );
      showToast({ kind: 'success', title: zhCN.colorAnalysis.title, message: zhCN.colorAnalysis.alignApplied(updates.length) });
    },
    [colorAnalysisSamples]
  );

  const openColorAnalysis = useCallback(() => {
    setColorAnalysisOpen(true);
    if (colorAnalysisResults.length === 0) {
      void runTimelineColorAnalysis();
    }
  }, [colorAnalysisResults.length, runTimelineColorAnalysis]);

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

  const batchUpdateMediaMetadata = useCallback((assetIds: string[], metadata: BatchEditableMediaMetadata) => {
    if (assetIds.length === 0) {
      return;
    }
    commandManager.execute(new BatchUpdateMetadataCommand(projectAccessor, assetIds.map((assetId) => ({ assetId, metadata }))));
    showToast({ kind: 'success', title: zhCN.mediaBin.batchEditMetadata, message: zhCN.mediaBin.batchMetadataUpdated(assetIds.length) });
  }, []);

  const batchRenameMedia = useCallback(async (_assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => {
    const state = useEditorStore.getState();
    const assetById = new Map(state.project.media.map((asset) => [asset.id, asset]));
    const renamePlan = preview
      .filter((item) => item.changed)
      .map((item) => {
        const asset = assetById.get(item.assetId);
        return asset
          ? {
              assetId: item.assetId,
              name: item.nextName,
              oldPath: asset.path,
              nextPath: renameFiles ? replaceMediaPathBasename(asset.path, item.nextName) : asset.path
            }
          : undefined;
      })
      .filter((item): item is { assetId: string; name: string; oldPath: string; nextPath: string } => Boolean(item));
    if (renamePlan.length === 0) {
      return;
    }
    let commandExecuted = false;
    try {
      commandManager.execute(
        new BatchRenameMediaCommand(
          projectAccessor,
          renamePlan.map((item) => ({
            assetId: item.assetId,
            name: item.name,
            path: renameFiles ? item.nextPath : undefined
          }))
        )
      );
      commandExecuted = true;
      if (renameFiles) {
        for (const item of renamePlan) {
          if (item.oldPath !== item.nextPath) {
            await bridgeMoveFile(item.oldPath, item.nextPath);
          }
        }
      }
      showToast({ kind: 'success', title: zhCN.mediaBin.batchRename, message: zhCN.mediaBin.batchRenameCompleted(renamePlan.length) });
    } catch (error) {
      if (commandExecuted && renameFiles) {
        commandManager.undo();
      }
      showToast({
        kind: 'error',
        title: zhCN.mediaBin.batchRenameFailed,
        message: error instanceof Error ? error.message : zhCN.mediaBin.batchRenameFailedMessage
      });
    }
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
      setActiveProjectEncryptionPassword(undefined);
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

  const createProjectFromTimelineTemplate = useCallback(
    async (nextProject: Project) => {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      executeNewProject(nextProject);
      setTimelineTemplateMode(undefined);
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
      const password = isEncryptedProjectPath(path)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(path) && !password) {
        return;
      }
      const nextProject = await readProjectFile(path, path, { password });
      commandManager.clear();
      setProject(nextProject, path);
      void runAutomationForMedia('on-project-open', nextProject.media);
      setTemplateExportPreset(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.projectOpened });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.openFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.openFailedMessage });
    }
  }, [dirty, requestProjectPassword, runAutomationForMedia, setProject]);

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

  // --- 提取到 useProxyCallbacks hook ---
  const {
    generateProxyForMedia,
    deleteProxiesForMedia,
    regenerateProxiesForMedia,
    migrateProxiesToDirectory,
    convertVfrMediaToCfr,
  } = useProxyCallbacks({ proxySettings, projectFps: project.settings.fps });

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

  const matchFrameToSource = useCallback(() => {
    if (!selectedClipId) return;
    const result = matchFrameFromClip({
      timeline: project.timeline,
      clipId: selectedClipId,
      playheadTime,
      sequences: project.sequences,
      activeSequenceId: project.activeSequenceId,
      penetrationMode: 'source'
    });
    if (result) {
      const asset = project.media.find((m) => m.id === result.mediaId);
      if (asset) {
        showToast({ kind: 'info', title: t('matchFrame.matchFrame'), message: `${asset.name} @ ${result.sourceTime.toFixed(1)}s` });
      }
    }
  }, [selectedClipId, project, playheadTime, showToast]);

  const revealMediaInTimeline = useCallback(() => {
    if (!selectedClipMedia) return;
    const result = coreRevealInTimeline(project.timeline, selectedClipMedia.id, project.sequences);
    if (result.instances.length > 0) {
      setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      if (result.instances[0]) {
        setSelectedClipId(result.instances[0].clipId);
        setPlayheadTime(result.instances[0].startTime);
      }
      showToast({ kind: 'info', title: t('matchFrame.revealInTimeline'), message: `找到 ${result.instances.length} 个实例` });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, [selectedClipMedia, project, setSelectedClipIds, setSelectedClipId, setPlayheadTime, showToast]);

  const navigateToNextInstance = useCallback(() => {
    if (!selectedClipMedia || !selectedClipId) return;
    const nextId = coreNavigateToNextInstance(project.timeline, selectedClipMedia.id, selectedClipId, project.sequences);
    if (nextId) {
      setSelectedClipId(nextId);
      const nav = getMediaInstanceNavigation(project.timeline, selectedClipMedia.id, nextId, project.sequences);
      showToast({ kind: 'info', title: t('matchFrame.navigateNext'), message: `${nav.currentIndex + 1}/${nav.total}` });
    }
  }, [selectedClipMedia, selectedClipId, project, setSelectedClipId, showToast]);

  const renderInOutRegion = useCallback(async () => {
    const startSec = inPoint ?? 0;
    const endSec = outPoint ?? getTimelineDuration(project.timeline);
    if (endSec <= startSec) {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.noInOutPoint') });
      return;
    }
    try {
      const result = await renderPreviewCache({
        projectId: project.name,
        startSec,
        endSec,
        sourcePath: projectPath ?? '',
        width: project.settings.width,
        height: project.settings.height
      });
      if (result.success) {
        showToast({ kind: 'success', title: t('renderCache.renderInOut'), message: t('renderCache.renderComplete') });
      } else {
        showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: result.error ?? t('renderCache.renderFailed') });
      }
    } catch {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.renderFailed') });
    }
  }, [inPoint, outPoint, project, projectPath, showToast]);

  const favoriteIds = useEditorMiscStore((s) => s.favoriteIds);


  const setFavoriteIds = useEditorMiscStore((s) => s.setFavoriteIds);
  const pinnedIds = useEditorMiscStore((s) => s.pinnedIds);
  const setPinnedIds = useEditorMiscStore((s) => s.setPinnedIds);
  const recentMediaIds = useEditorMiscStore((s) => s.recentMediaIds);

  const setRecentMediaIds = useEditorMiscStore((s) => s.setRecentMediaIds);

  const handleToggleFavorite = useCallback((assetId: string) => {
    setFavoriteIds((prev) => prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]);
  }, []);

  const handlePinToSession = useCallback((assetId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const handleRevealFromMediaBin = useCallback((assetId: string) => {
    const result = coreRevealInTimeline(project.timeline, assetId, project.sequences);
    if (result.instances.length > 0) {
      setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      showToast({ kind: 'info', title: t('matchFrame.revealInTimeline'), message: 'Found ' + result.instances.length + ' instances' });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, [project, t, setSelectedClipIds, showToast]);

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
      navigatePrevGap: () => {
        const gaps = computeTimelineGaps(project.timeline);
        const target = navigateGap(gaps, playheadTime, -1);
        if (target) setPlayheadTime(target.start);
      },
      navigateNextGap: () => {
        const gaps = computeTimelineGaps(project.timeline);
        const target = navigateGap(gaps, playheadTime, 1);
        if (target) setPlayheadTime(target.start);
      },
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
      undo,
      matchFrameToSource,
      revealMediaInTimeline,
      navigateToNextInstance,
      renderInOutRegion,
      project,
      playheadTime,
      setPlayheadTime
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
