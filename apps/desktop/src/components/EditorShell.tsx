import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
  SmartMontageCommand,
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
import { type ClipboardKeyframeGroup, type PasteMode, PasteKeyframesCommand } from '@open-factory/editor-core';
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
import {
  useProjectHealthCallbacks,
  useAudioAnalysisCallbacks,
  useBeatSyncCallbacks,
  useRecordingCallbacks,
} from '../hooks/useEditorShellCallbacks';
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
import { useEditorShellStoreSubscriptions } from '../hooks/useEditorShellStoreSubscriptions';
import { useEditorShellDerivedState } from '../hooks/useEditorShellDerivedState';
import { useEditorShellEffects } from '../hooks/useEditorShellEffects';
import { useEditorShellInlineCallbacks } from '../hooks/useEditorShellInlineCallbacks';
import { useEditorShellPanelCallbacks } from '../hooks/useEditorShellPanelCallbacks';
import { useEditorShellFloatingDialogsCallbacks } from '../hooks/useEditorShellFloatingDialogsCallbacks';
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
  type WorkspaceLayoutId,
} from '../layout/layoutSettings';
import type { ExportPreset } from '../export/export-presets';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { indexAndTagImportedMedia } from '../media/media-index-integration';
import { generateMediaFingerprint, scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import {
  buildArchiveDestinationPath,
  buildRenameDestinationPath,
  scanMediaCleanupReport,
  scanSmartDuplicateMediaGroups,
} from '../lib/mediaOrganizer';
import {
  buildSubtitleTrackFromDataCues,
  buildSubtitleTrackFromSrt,
  collectSubtitleSpeakersFromTrack,
  isSubtitlePath,
  parseSubtitleDataFile,
  pickSubtitleDataPaths,
  pickSubtitlePaths,
  readSubtitleText,
} from '../lib/subtitles';
import { createProjectArchivePlan, writeProjectArchive, type ArchiveProgress } from '../lib/projectArchive';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { buildProjectHealthAutoRepairInput, scanProjectHealth } from '../lib/projectHealth';
import {
  readMediaHealthAutoShowEnabled,
  scanMediaHealthDashboard,
  writeMediaHealthAutoShowEnabled,
} from '../lib/mediaHealthDashboard';
import { getReviewModeShellVisibility } from '../review/reviewMode';
import { saveReviewReport } from '../review/reviewReport';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import {
  canSeparateAudioForClip,
  getDemucsAvailability,
  separateAudioForClip,
  type DemucsAvailability,
} from '../lib/demucs';
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
  type ProjectFileEncryptionOptions,
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
  type RecordingSource,
  initMediaIndexDb,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  createPreviewWindowPlaybackState,
  normalizePreviewWindowPlaybackState,
  shouldApplyPreviewWindowPlaybackState,
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
  type TimelineHeatmapViewSettings,
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
  type TutorialSignals,
} from '../tutorial/tutorialState';
import {
  DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  type PreviewPerformanceSettings,
  type PreviewQualityMode,
  type PreviewSkipFrames,
} from '../lib/preview/preview-performance';
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

import {
  AudioMixer, Inspector, SmartRoughCutPanel, SmartRoughCutOrchestratorPanel,
  AIRoughCutPanel, DirectorModePanel, MusicMatchPanel, HighlightReelPanel,
  ContextualTranslationPanel, AIChatEditorPanel, AIVideoSummaryPanel, AINarrationPanel,
  SmartCreationPanel, HistoryPanel, ProjectDocumentationPanel, MediaPrecheckPanel,
  SyncComparePanel, CollaborationNotesPanel, ComplexityScorePanel, TimelineSearchPanel,
  SnapshotNameDialog, SnapshotHistoryDialog, SnapshotVersionCompareDialog,
  TimelineCompareDialog, ReleaseWorkflowDialog, ThumbnailGeneratorDialog,
  PerformanceMonitorPanel, AutoAudioSyncDialog, DuplicateMediaDialog, MediaOrganizerDialog,
  ProjectHealthDialog, MediaHealthDashboardDialog, ProjectTemplateDialog, TimelineTemplateDialog,
  MediaVersionComparePanel, ProjectEncryptionSaveDialog, ProjectPasswordDialog,
  AutosaveRecoveryDialog, ExportQueueRecoveryDialog, ArchiveProgressDialog,
  PasteKeyframeDialog, SharePackageProgressDialog, CharacterTimelinePanel,
  PreflightChecklistPanel, DubbingAdaptationPanel, CommandPalette, GestureTutorialOverlay,
  RoughCutComparePanel,
} from './lazyComponents';

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
import { getSubtitleDataImportTargetTrackId, isPiPVisualClip, isSceneReorderClip } from '../lib/timeline-clip-helpers';
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
import { mergeProjectSpeakers, sanitizeFileName, projectUsesMediaOnTimeline } from '@open-factory/editor-core';

export function EditorShell() {
  useEditorShellSettings();
  const { applyWorkspaceLayoutById, toggleProjectDocumentation } = useEditorShellInteractions();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [gestureTutorialOpen, setGestureTutorialOpen] = useState(false);
  const [roughCutCompareOpen, setRoughCutCompareOpen] = useState(false);

  // --- Store subscriptions (extracted to hook) ---
  const {
    project, selectedClipId, selectedClipIds, selectedKeyframe, selectedKeyframes,
    isPlaying, inPoint, outPoint, dirty, projectPath,
    setProject, setMedia, addMedia, setSelectedKeyframes, setMediaMetadata,
    setDirty, setProjectPath, setSelectedClipId, setSelectedClipIds, clearSelectedClipIds,
    setPlayheadTime, setIsPlaying, setPlaybackRate, setInPoint, setOutPoint,
    setBatchTranscodeOpen, setBatchWatermarkOpen, setBatchProjectProcessingOpen,
    setLutEditorOpen, setColorNodeEditorOpen, setColorAnalysisOpen,
    professionalNleExportOpen, setProfessionalNleExportOpen,
    mediaPrecheckOpen, setMediaPrecheckOpen,
    setVideoStitchWizardOpen, setSmartMontageOpen,
    syncCompareOpen, setSyncCompareOpen, setSceneReorderOpen, setStyleTransferOpen,
    collaborationNotesOpen, setCollaborationNotesOpen, setOperationRecordingOpen,
    complexityScoreOpen, setComplexityScoreOpen,
    setSmartRecommendationsOpen, setContentAnalysisOpen, setProfilerOpen,
    setRhythmAnalysisOpen, autoAudioSyncOpen, setAutoAudioSyncOpen,
    setErrorKnowledgeOpen, setSequenceCompareOpen, setSubtitleSyncOpen,
    setProxyVerifyOpen, setFormatConverterOpen, setEmotionAnalysisOpen,
    setExportHistoryClassifierOpen, setMacroHistoryOpen,
    lastBackupAt, setLastBackupAt,
    pipLayoutPosition, setPiPLayoutPosition,
    customSplitLayouts, setCustomSplitLayouts,
    batchTranscodeInitialPaths, setBatchTranscodeInitialPaths,
    thumbnailGeneratorAssetIds, setThumbnailGeneratorAssetIds,
    colorAnalysisBusy, setColorAnalysisBusy,
    colorAnalysisResults, setColorAnalysisResults,
    colorAnalysisJumps, setColorAnalysisJumps,
    colorHeatmapPoints, setColorHeatmapPoints,
    colorAnalysisSamples, setColorAnalysisSamples,
    setGifExportAsset, setSpectrumAsset,
    mediaVersionCompare, setMediaVersionCompare,
    setFormatConverterMockFiles, setMockSubtitleClips, setMockExportHistory,
    demucsAvailability, setDemucsAvailability,
    audioSeparationClipId, setAudioSeparationClipId,
    audioSeparationProgress, setAudioSeparationProgress,
    speakerDiarizationRunning, setSpeakerDiarizationRunning,
    speakerDiarizationResult, setSpeakerDiarizationResult,
    autoAudioSyncRunning, setAutoAudioSyncRunning,
    autoAudioSyncPrimaryClipId, setAutoAudioSyncPrimaryClipId,
    autoAudioSyncMode, setAutoAudioSyncMode,
    autoAudioSyncResults, setAutoAudioSyncResults,
    recordingTask, setRecordingTask,
    recordingElapsedSeconds, setRecordingElapsedSeconds,
    operationRecording, operationRecordingActive, operationRecordingStep,
    operationReplaySpeed, operationReplayRunning,
    profilerRecording, profilerElapsedMs, profilerReport,
    projectHealthReport, projectHealthScanning, projectHealthRepairReport,
    mediaHealthScanning, mediaHealthDashboard, mediaHealthAutoShowEnabled,
    setMediaHealthAutoShowEnabled,
    mediaHealthDashboardOpen, setMediaHealthDashboardOpen,
    setMediaHealthDashboard, setMediaHealthScanning,
    aiChatEditorOpen, setAiChatEditorOpen,
    aiRoughCutOpen, setAiRoughCutOpen,
    beatSyncOpen, setBeatSyncOpen,
    contextualTranslationOpen, setContextualTranslationOpen,
    directorModeOpen, setDirectorModeOpen,
    duplicateMediaOpen, setDuplicateMediaOpen,
    highlightReelOpen, setHighlightReelOpen,
    historyPanelOpen, setHistoryPanelOpen,
    mediaOrganizerOpen, setMediaOrganizerOpen,
    musicMatchOpen, setMusicMatchOpen,
    narrationOpen, setNarrationOpen,
    pasteKeyframeDialogOpen, setPasteKeyframeDialogOpen,
    previewWindowOpen, setPreviewWindowOpen,
    projectDocumentationOpen, setProjectDocumentationOpen,
    projectEncryptionSaveOpen, setProjectEncryptionSaveOpen,
    projectHealthOpen, setProjectHealthOpen,
    projectTemplateOpen, setProjectTemplateOpen,
    releaseWorkflowOpen, setReleaseWorkflowOpen,
    reviewMode, setReviewMode,
    shortcutCheatsheetOpen, setShortcutCheatsheetOpen,
    smartCreationOpen, setSmartCreationOpen,
    smartRoughCutOpen, setSmartRoughCutOpen,
    snapshotCompareOpen, setSnapshotCompareOpen,
    snapshotHistoryOpen, setSnapshotHistoryOpen,
    snapshotNameOpen, setSnapshotNameOpen,
    storyboardOpen, setStoryboardOpen,
    timelineCompareOpen, setTimelineCompareOpen,
    timelineSearchOpen, setTimelineSearchOpen,
    videoSummaryOpen, setVideoSummaryOpen,
    setSettingsOpen, setAssistEditingOpen, setContentGenerationOpen, setQualityAssessmentOpen,
    layoutSettings, setLayoutSettings,
    viewportSize, setViewportSize,
    persistLayoutPatch, persistPanelVisibilityPatch,
    beatSensitivity, setBeatSensitivity,
    beatSyncSpeedEnabled, setBeatSyncSpeedEnabled,
    beatSyncManualBpm, setBeatSyncManualBpm,
    sceneDetectionRequestId, setSceneDetectionRequestId,
    collaborationIdentity, setCollaborationIdentity,
    tutorialProgress, setTutorialProgress,
    tutorialCelebrationVisible, setTutorialCelebrationVisible,
    tutorialSignals, setTutorialSignals,
    safeFrameGuides, setSafeFrameGuides,
    thumbnailTrackVisible, setThumbnailTrackVisible,
    timelineMinimapVisible, setTimelineMinimapVisible,
    timelineHeatmap, setTimelineHeatmap,
    previewPerformance, setPreviewPerformance,
    previewWindowResolutionScale, setPreviewWindowResolutionScale,
    timelineGridSettings, setTimelineGridSettings,
    timelineInteractionSettings, setTimelineInteractionSettings,
    shortcutBindings, setShortcutBindings,
    macros, setMacros,
    sharedLibraryResources, setSharedLibraryResources,
    autosaveIntervalSeconds, setAutosaveIntervalSeconds,
    contentAnalysisRunningClipId, setContentAnalysisRunningClipId,
    duplicateMediaGroups, setDuplicateMediaGroups,
    macroRecordingActive, macroRecordingStepCount,
    mediaOrganizerGroups, setMediaOrganizerGroups,
    mediaOrganizerCleanup, setMediaOrganizerCleanup,
    mediaOrganizerScanning, setMediaOrganizerScanning,
    pasteKeyframeDialogGroups, setPasteKeyframeDialogGroups,
    projectPasswordRequest, setProjectPasswordRequest,
    recoveryCandidate, setRecoveryCandidate,
    archiveProgress, setArchiveProgress,
    setProjectHealthReport, setProjectHealthScanning, setProjectHealthRepairReport,
    timelineTemplateMode, setTimelineTemplateMode,
    templateExportPreset, setTemplateExportPreset,
    collaborationEnabled,
    proxySettings,
    demucsExecutablePath,
    recordingSettings,
  } = useEditorShellStoreSubscriptions();

  const {
    lastExportPath, setLastExportPath,
    exportDialogOpen, setExportDialogOpen,
    timelineExportDialogOpen, setTimelineExportDialogOpen,
    exportQueueRecovery, sharePackageProgress, sharePackageBusy,
    cancelCurrentExport, createCurrentSharePackage, exportCurrentFrame,
    restoreExportQueueRecovery, discardExportQueueRecovery,
  } = useExportQueue(project);

  // --- Derived state (extracted to hook) ---
  const {
    selectedClip, selectedClips, selectedClipMedia, allTimelineClips, visualTimelineClipRefs,
    selectedClipLocked, syncCompareClipRefs, canOpenSyncCompare, canOpenSceneDetection,
    canOpenSceneReorder, contentAnalysisTargets, mediaContentAnalysis, speakerDiarizationTarget,
    autoAudioSyncTargets, resolvedAutoAudioSyncPrimaryClipId, autoAudioSyncDialogTargets,
    canSeparateSelectedAudio, canRunSpeakerDiarization, canOpenAutoAudioSync, canDetectBeats,
    canCreateMulticamSequence, selectedPiPClips, canApplyPiPLayout, selectedSplitLayoutClips,
    canApplySplitLayout, selectedClipTimelineBeatTimes, beatSyncBeatTimes, detectedBeatBpm,
    canSnapToBeats, canSplitToBeats, timelineHeightPx, effectivePanels, reviewVisibility,
    workspaceLayouts, editorGridRows, mainGridColumns, rightPanelRows,
  } = useEditorShellDerivedState({
    project,
    selectedClipId: selectedClipId ?? null,
    selectedClipIds,
    demucsAvailability,
    audioSeparationClipId: audioSeparationClipId ?? null,
    speakerDiarizationRunning,
    autoAudioSyncRunning,
    autoAudioSyncPrimaryClipId: autoAudioSyncPrimaryClipId ?? null,
    layoutSettings,
    viewportSize,
    reviewMode,
  });

  // --- Extracted callback hooks ---
  const { handleProfilerFrame, startProfilerRecording, stopProfilerRecording, exportProfilerReportJson } =
    useEditorShellProfiler();

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
    undo, switchToPreviousHistoryBranch, redo,
    togglePlayback, reversePlayback, pausePlayback, forwardPlayback, stepFrame,
    addAnnotationAtPlayhead, addReviewAnnotationAtPlayhead, createReviewReport,
    addBookmarkAtPlayhead, jumpTimelineNavigationPoint,
    exportBookmarks, importBookmarks,
    setSingleExportRange, appendExportRange,
    markInPoint, markOutPoint, markMultiRangeInPoint, markMultiRangeOutPoint,
  } = useEditorShellPlaybackCallbacks();

  const saveProject = saveProjectFn;

  const {
    addAssetToTimeline, handleAddSubclipToTimeline,
    addAdjustmentLayer, applyEffectPresetToSelectedClip, addMotionGraphic,
    openColorNodeEditor, runTimelineColorAnalysis, alignTimelineColorToReference,
    openColorAnalysis, addTitleTemplate,
    splitSelected, seekSpectrumTime, setSpectrumSelectionRange, splitSpectrumAtTime,
    createMulticamSequence, applyPiPLayout, applySplitLayout, saveCustomSplitLayout,
    importEdlTimeline, importFcpXmlTimeline,
    deleteSelected, rippleDeleteSelected, selectAllTimelineItems,
    matchFrameToSource, revealMediaInTimeline, navigateToNextInstance,
    renderInOutRegion, navigatePrevGap, navigateNextGap,
  } = useEditorShellTimelineCallbacks({
    colorAnalysisBusy, colorAnalysisResults, colorAnalysisSamples,
    pipLayoutPosition, customSplitLayouts,
    canApplySplitLayout, selectedPiPClips, selectedSplitLayoutClips,
    visualTimelineClipRefs,
    projectPath: projectPath ?? null,
    setCustomSplitLayouts,
  });

  // --- Inline callbacks (extracted to hook) ---
  const {
    importVideosForStitchWizard, generateVideoStitchTimeline, generateSmartMontage,
    importSubtitles, importDataSubtitles,
    restoreRecovery, discardRecovery, importDropped,
    importSubtitlePaths, importSubtitleDataPaths,
    shortcutHandlers: inlineShortcutHandlers,
  } = useEditorShellInlineCallbacks({
    addMedia, setSelectedClipId, setSelectedClipIds, setPlayheadTime,
    setVideoStitchWizardOpen, setExportDialogOpen, setTemplateExportPreset,
    persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia,
    setTutorialSignals,
    projectPath: projectPath ?? null, project, selectedClipIds,
    requestProjectPassword, setProject, setDirty, setRecoveryCandidate,
    applyImportedMediaColorConversionChoice,
    togglePlayback, reversePlayback, pausePlayback, forwardPlayback, stepFrame,
    markInPoint, markOutPoint, markMultiRangeInPoint, markMultiRangeOutPoint,
    deleteSelected, rippleDeleteSelected, splitSelected, selectAllTimelineItems,
    clearSelectedClipIds, addAnnotationAtPlayhead, addBookmarkAtPlayhead,
    toggleTimelineGridSnap, jumpTimelineNavigationPoint,
    undo, switchToPreviousHistoryBranch, redo,
    saveProject, exportCurrentFrame, matchFrameToSource, revealMediaInTimeline,
    navigateToNextInstance, navigatePrevGap, navigateNextGap, renderInOutRegion,
  });

  // --- Content analysis, health, audio, recording, beat sync, proxy callbacks ---
  const { runSingleContentAnalysis, analyzeContentClip, analyzePreferredContentTargets, exportContentAnalysis } =
    useContentAnalysisCallbacks({ setContentAnalysisRunningClipId });

  const {
    refreshProjectHealth, openProjectHealth,
    refreshMediaHealthDashboard, openMediaHealthDashboard,
    setMediaHealthAutoShow, openMediaHealthRelinkPanel,
    relinkMissingFromHealth, removeOrphanFromHealth,
    mergeDuplicateFromHealth, queueProxyFromHealth,
    autoRepairProjectHealth, repairFromMediaHealthDashboard,
  } = useProjectHealthCallbacks({ projectHealthReport });

  const {
    separateSelectedAudio, runSpeakerDiarization, applySpeakerDiarization,
    openAutoAudioSync, runAutoAudioSync, applyAutoAudioSync, cancelAudioSeparation,
  } = useAudioAnalysisCallbacks({
    selectedClip, selectedClipMedia, addMedia, setSelectedClipId, setSelectedClipIds,
    demucsAvailability, demucsExecutablePath, audioSeparationClipId,
    speakerDiarizationTarget, speakerDiarizationResult,
    autoAudioSyncTargets, resolvedAutoAudioSyncPrimaryClipId,
    autoAudioSyncResults, autoAudioSyncMode, project,
  });

  const { startEditorRecording, stopEditorRecording } = useRecordingCallbacks({
    addMedia, persistMediaFingerprints, recordingTask, recordingSettings,
  });

  const { detectSelectedBeats, snapSelectedToBeats, splitSelectedToBeats, applyManualBeatBpm } = useBeatSyncCallbacks({
    selectedClip, selectedClipMedia, selectedClipId, selectedClipIds,
    beatSyncBeatTimes, beatSyncSpeedEnabled, beatSyncManualBpm, beatSensitivity,
    projectBeatMarkers: project.beatMarkers,
    setSelectedClipIds, clearSelectedClipIds,
  });

  const {
    generateProxyForMedia, deleteProxiesForMedia, regenerateProxiesForMedia,
    migrateProxiesToDirectory, convertVfrMediaToCfr,
  } = useProxyCallbacks({ proxySettings, projectFps: project.settings.fps });

  // --- Operation recording ---
  const {
    recordMacroHistory, startMacroRecording, stopMacroRecording, executeMacro,
    startOperationRecording, stopOperationRecording, saveOperationRecording,
    loadOperationRecording, pauseOperationReplay, replayOperationRecording,
    jumpOperationRecording, exportOperationRecordingSlides,
  } = useEditorShellOperationRecording();

  // --- Autosave, close guard, shortcuts ---
  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useShortcuts(inlineShortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, executeMacro);

  // --- Effects (extracted to hook, must come after media callbacks for refreshSharedLibraryResources) ---
  useEditorShellEffects({
    projectPath: projectPath ?? null,
    tutorialProgress: tutorialProgress ?? { enabled: true, currentStep: 0, completed: false, dismissed: false } as any,
    tutorialSignals, setTutorialProgress, setTutorialCelebrationVisible,
    demucsExecutablePath, setDemucsAvailability,
    audioSeparationClipId: audioSeparationClipId ?? null,
    setAudioSeparationProgress,
    recordingTask: recordingTask ?? null,
    setRecordingElapsedSeconds,
    detectedBeatBpm, selectedClipId: selectedClipId ?? null,
    setBeatSyncManualBpm,
    refreshSharedLibraryResources,
    setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen,
    setFormatConverterMockFiles, setMockSubtitleClips, setMockExportHistory,
    setArchiveProgress, setCommandPaletteOpen, setGestureTutorialOpen,
  });

  useBackgroundMediaJobs(project.media);

  // --- Callback memos ---
  const { leftPanelCallbacks } = useEditorShellPanelCallbacks({
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
    handleAddSubclipToTimeline, projectMediaMetadata: project.mediaMetadata,
  });

  const { floatingDialogsCallbacks } = useEditorShellFloatingDialogsCallbacks({
    templateExportPreset, exportDialogOpen, setExportDialogOpen,
    timelineExportDialogOpen, setTimelineExportDialogOpen, lastExportPath,
    setLastExportPath, setTutorialSignals, runAutomationForMedia,
    relinkAllMissing, importEdlTimeline, importFcpXmlTimeline, addMedia,
    createProjectFromTemplate, createProjectFromTimelineTemplate,
    colorAnalysisResults, colorAnalysisJumps, colorAnalysisBusy,
    runTimelineColorAnalysis, alignTimelineColorToReference,
    seekSpectrumTime, setSpectrumSelectionRange, splitSpectrumAtTime,
    importVideosForStitchWizard, generateVideoStitchTimeline, generateSmartMontage,
    addAssetToTimeline,
    analyzeContentClip, analyzePreferredContentTargets, exportContentAnalysis,
    applySpeakerDiarization, speakerDiarizationResult, contentAnalysisTargets,
    operationRecording, operationRecordingActive, operationReplayRunning,
    operationRecordingStep, operationReplaySpeed,
    startOperationRecording, stopOperationRecording, saveOperationRecording,
    loadOperationRecording, replayOperationRecording, pauseOperationReplay,
    jumpOperationRecording, exportOperationRecordingSlides,
    profilerRecording, profilerElapsedMs, profilerReport,
    startProfilerRecording, stopProfilerRecording, exportProfilerReportJson,
    saveNamedSnapshot, restoreSnapshotProject, applySnapshotDiffSelection,
    updateProjectReleaseVersion, syncCompareClipRefs, jumpToMediaAsset,
    detectedBeatBpm, beatSyncBeatTimes, canDetectBeats, canSnapToBeats,
    applyManualBeatBpm, detectSelectedBeats, snapSelectedToBeats,
    updatePreviewPerformance, updateTimelineInteractionSettings,
    deleteProxiesForMedia, regenerateProxiesForMedia, migrateProxiesToDirectory,
    executeMacro, confirmProjectEncryptionSave,
    refreshProjectHealth, autoRepairProjectHealth, relinkMissingFromHealth,
    removeOrphanFromHealth, mergeDuplicateFromHealth, queueProxyFromHealth,
    mergeDuplicateMediaGroups, refreshMediaHealthDashboard, repairFromMediaHealthDashboard,
    openMediaHealthRelinkPanel, refreshMediaOrganizer,
    confirmMediaOrganizerDuplicateGroups, removeMediaOrganizerReferences,
    archiveUnusedMedia, renameUnusedMedia,
    recoveryCandidate, exportQueueRecovery, archiveProgress, sharePackageProgress,
    restoreRecovery, discardRecovery, restoreExportQueueRecovery, discardExportQueueRecovery,
    skipTutorial, closeTutorialCelebration,
  });

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div
        className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: editorGridRows }}
        data-testid="editor-shell"
      >
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
          onOpenAssistEditing={() => setAssistEditingOpen(true)}
          onOpenContentGeneration={() => setContentGenerationOpen(true)}
          onOpenQualityAssessment={() => setQualityAssessmentOpen(true)}
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
          onOpenSmartMontage={() => setSmartMontageOpen(true)}
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
          onToggleSmartCreation={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setSmartCreationOpen((open) => !open);
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
          smartCreationOpen={smartCreationOpen}
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
          onPreviewQualityModeChange={(qualityMode: PreviewQualityMode) =>
            updatePreviewPerformance({ qualityMode, adaptiveEnabled: false })
          }
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
          onRoughCutCompare={() => setRoughCutCompareOpen(true)}
          leftPanelCallbacks={leftPanelCallbacks}
          beginTimelineResize={beginTimelineResize}
        />
        <Suspense fallback={null}>
          {complexityScoreOpen ? (
            <ComplexityScorePanel project={project} onClose={() => setComplexityScoreOpen(false)} />
          ) : null}
          {autoAudioSyncOpen ? (
            <AutoAudioSyncDialog
              targets={autoAudioSyncDialogTargets}
              primaryClipId={resolvedAutoAudioSyncPrimaryClipId}
              mode={autoAudioSyncMode}
              running={autoAudioSyncRunning}
              results={autoAudioSyncResults}
              onPrimaryChange={(clipId) => setAutoAudioSyncPrimaryClipId(clipId)}
              onModeChange={(mode) => setAutoAudioSyncMode(mode)}
              onAnalyze={() => void runAutoAudioSync()}
              onApply={() => void applyAutoAudioSync()}
              onClose={() => setAutoAudioSyncOpen(false)}
            />
          ) : null}
        </Suspense>
        <ShellFloatingDialogs {...floatingDialogsCallbacks} />
        <Suspense fallback={null}>
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onExecute={(cmd) => {
              switch (cmd.type) {
                case 'play':
                case 'pause':
                  setIsPlaying(!isPlaying);
                  break;
                case 'undo':
                  undo();
                  break;
                case 'redo':
                  redo();
                  break;
                case 'go-to':
                  if (cmd.timeRef !== undefined) setPlayheadTime(cmd.timeRef);
                  else setPlayheadTime(useEditorStore.getState().playheadTime);
                  break;
                case 'zoom-in':
                  break;
                case 'zoom-out':
                  break;
                case 'export':
                  setExportDialogOpen(true);
                  break;
                default:
                  break;
              }
            }}
          />
          <GestureTutorialOverlay
            open={gestureTutorialOpen}
            onClose={() => {
              setGestureTutorialOpen(false);
              localStorage.setItem('open-factory:gesture-tutorial-seen', '1');
            }}
          />
          {roughCutCompareOpen && project ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <RoughCutComparePanel
                highlights={[]}
                rhythmResult={null}
                sourceDuration={getTimelineDuration(project.timeline)}
                onApply={() => setRoughCutCompareOpen(false)}
                onClose={() => setRoughCutCompareOpen(false)}
              />
            </div>
          ) : null}
        </Suspense>
      </div>
    </ErrorBoundary>
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
