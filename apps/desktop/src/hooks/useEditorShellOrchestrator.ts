import { useEditorShellProfiler } from './useEditorShellProfiler';
import { useEditorShellViewSettingsCallbacks } from './useEditorShellViewSettingsCallbacks';
import { useEditorShellProjectCallbacks } from './useEditorShellProjectCallbacks';
import { useEditorShellMediaCallbacks } from './useEditorShellMediaCallbacks';
import { useEditorShellMiscCallbacks } from './useEditorShellMiscCallbacks';
import { useEditorShellPlaybackCallbacks } from './useEditorShellPlaybackCallbacks';
import { useEditorShellTimelineCallbacks } from './useEditorShellTimelineCallbacks';
import { useEditorShellInlineCallbacks } from './useEditorShellInlineCallbacks';
import { useContentAnalysisCallbacks } from './useEditorShellContentAnalysisCallbacks';
import {
  useProjectHealthCallbacks,
  useAudioAnalysisCallbacks,
  useBeatSyncCallbacks,
  useRecordingCallbacks,
} from './useEditorShellCallbacks';
import { useProxyCallbacks } from './useEditorShellProxyCallbacks';
import { useEditorShellOperationRecording } from './useEditorShellOperationRecording';
import { useEditorShellPanelCallbacks } from './useEditorShellPanelCallbacks';
import { useEditorShellFloatingDialogsCallbacks } from './useEditorShellFloatingDialogsCallbacks';
import type { useEditorShellDerivedState } from './useEditorShellDerivedState';
import type { useEditorShellStoreSubscriptions } from './useEditorShellStoreSubscriptions';
import type { useExportQueue } from './useExportQueue';

// Use ReturnType to derive types from hook return values
type StoreSubscriptionsResult = ReturnType<typeof useEditorShellStoreSubscriptions>;
type DerivedStateResult = ReturnType<typeof useEditorShellDerivedState>;
type ExportQueueResult = ReturnType<typeof useExportQueue>;

/**
 * Consolidates all callback hooks from EditorShell into a single orchestrator.
 * Reduces EditorShell from ~270 lines of hook calls to a single call.
 */
export function useEditorShellOrchestrator(
  store: StoreSubscriptionsResult,
  derived: DerivedStateResult,
  exportQueue: ExportQueueResult,
  stateSetters: {
    setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setGestureTutorialOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setRoughCutCompareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  },
) {
  // Profiler
  const { handleProfilerFrame, startProfilerRecording, stopProfilerRecording, exportProfilerReportJson } =
    useEditorShellProfiler();

  // View settings
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
  } = useEditorShellViewSettingsCallbacks({ layoutSettings: store.layoutSettings, setLayoutSettings: store.setLayoutSettings });

  // Project
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

  // Media
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

  // Misc
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

  // Playback
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

  // Timeline
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
    colorAnalysisBusy: store.colorAnalysisBusy,
    colorAnalysisResults: store.colorAnalysisResults,
    colorAnalysisSamples: store.colorAnalysisSamples,
    pipLayoutPosition: store.pipLayoutPosition,
    customSplitLayouts: store.customSplitLayouts,
    canApplySplitLayout: derived.canApplySplitLayout,
    selectedPiPClips: derived.selectedPiPClips,
    selectedSplitLayoutClips: derived.selectedSplitLayoutClips,
    visualTimelineClipRefs: derived.visualTimelineClipRefs,
    projectPath: store.projectPath ?? null,
    setCustomSplitLayouts: store.setCustomSplitLayouts,
  });

  // Inline
  const {
    importVideosForStitchWizard, generateVideoStitchTimeline, generateSmartMontage,
    importSubtitles, importDataSubtitles,
    restoreRecovery, discardRecovery, importDropped,
    importSubtitlePaths, importSubtitleDataPaths,
    shortcutHandlers: inlineShortcutHandlers,
  } = useEditorShellInlineCallbacks({
    addMedia: store.addMedia, setSelectedClipId: store.setSelectedClipId, setSelectedClipIds: store.setSelectedClipIds,
    setPlayheadTime: store.setPlayheadTime, setVideoStitchWizardOpen: store.setVideoStitchWizardOpen,
    setExportDialogOpen: exportQueue.setExportDialogOpen, setTemplateExportPreset: store.setTemplateExportPreset,
    persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia,
    setTutorialSignals: store.setTutorialSignals,
    projectPath: store.projectPath ?? null, project: store.project, selectedClipIds: store.selectedClipIds,
    requestProjectPassword, setProject: store.setProject, setDirty: store.setDirty, setRecoveryCandidate: store.setRecoveryCandidate,
    applyImportedMediaColorConversionChoice,
    togglePlayback, reversePlayback, pausePlayback, forwardPlayback, stepFrame,
    markInPoint, markOutPoint, markMultiRangeInPoint, markMultiRangeOutPoint,
    deleteSelected, rippleDeleteSelected, splitSelected, selectAllTimelineItems,
    clearSelectedClipIds: store.clearSelectedClipIds, addAnnotationAtPlayhead, addBookmarkAtPlayhead,
    toggleTimelineGridSnap, jumpTimelineNavigationPoint,
    undo, switchToPreviousHistoryBranch, redo,
    saveProject, exportCurrentFrame: exportQueue.exportCurrentFrame,
    matchFrameToSource, revealMediaInTimeline, navigateToNextInstance, navigatePrevGap, navigateNextGap, renderInOutRegion,
  });

  // Content analysis, health, audio, recording, beat sync, proxy
  const { runSingleContentAnalysis, analyzeContentClip, analyzePreferredContentTargets, exportContentAnalysis } =
    useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: store.setContentAnalysisRunningClipId });

  const {
    refreshProjectHealth, openProjectHealth,
    refreshMediaHealthDashboard, openMediaHealthDashboard,
    setMediaHealthAutoShow, openMediaHealthRelinkPanel,
    relinkMissingFromHealth, removeOrphanFromHealth,
    mergeDuplicateFromHealth, queueProxyFromHealth,
    autoRepairProjectHealth, repairFromMediaHealthDashboard,
  } = useProjectHealthCallbacks({ projectHealthReport: store.projectHealthReport });

  const {
    separateSelectedAudio, runSpeakerDiarization, applySpeakerDiarization,
    openAutoAudioSync, runAutoAudioSync, applyAutoAudioSync, cancelAudioSeparation,
  } = useAudioAnalysisCallbacks({
    selectedClip: derived.selectedClip, selectedClipMedia: derived.selectedClipMedia,
    addMedia: store.addMedia, setSelectedClipId: store.setSelectedClipId, setSelectedClipIds: store.setSelectedClipIds,
    demucsAvailability: store.demucsAvailability, demucsExecutablePath: store.demucsExecutablePath,
    audioSeparationClipId: store.audioSeparationClipId, speakerDiarizationTarget: derived.speakerDiarizationTarget,
    speakerDiarizationResult: store.speakerDiarizationResult,
    autoAudioSyncTargets: derived.autoAudioSyncTargets, resolvedAutoAudioSyncPrimaryClipId: derived.resolvedAutoAudioSyncPrimaryClipId,
    autoAudioSyncResults: store.autoAudioSyncResults, autoAudioSyncMode: store.autoAudioSyncMode, project: store.project,
  });

  const { startEditorRecording, stopEditorRecording } = useRecordingCallbacks({
    addMedia: store.addMedia, persistMediaFingerprints,
    recordingTask: store.recordingTask, recordingSettings: store.recordingSettings,
  });

  const { detectSelectedBeats, snapSelectedToBeats, splitSelectedToBeats, applyManualBeatBpm } = useBeatSyncCallbacks({
    selectedClip: derived.selectedClip, selectedClipMedia: derived.selectedClipMedia,
    selectedClipId: store.selectedClipId, selectedClipIds: store.selectedClipIds,
    beatSyncBeatTimes: derived.beatSyncBeatTimes, beatSyncSpeedEnabled: store.beatSyncSpeedEnabled,
    beatSyncManualBpm: store.beatSyncManualBpm, beatSensitivity: store.beatSensitivity,
    projectBeatMarkers: store.project.beatMarkers,
    setSelectedClipIds: store.setSelectedClipIds, clearSelectedClipIds: store.clearSelectedClipIds,
  });

  const {
    generateProxyForMedia, deleteProxiesForMedia, regenerateProxiesForMedia,
    migrateProxiesToDirectory, convertVfrMediaToCfr,
  } = useProxyCallbacks({ proxySettings: store.proxySettings, projectFps: store.project.settings.fps });

  // Operation recording
  const {
    recordMacroHistory, startMacroRecording, stopMacroRecording, executeMacro,
    startOperationRecording, stopOperationRecording, saveOperationRecording,
    loadOperationRecording, pauseOperationReplay, replayOperationRecording,
    jumpOperationRecording, exportOperationRecordingSlides,
  } = useEditorShellOperationRecording();

  // Panel callbacks
  const { leftPanelCallbacks } = useEditorShellPanelCallbacks({
    importMedia, importDropped, openBatchTranscode, batchGenerateCovers,
    setThumbnailGeneratorAssetIds: store.setThumbnailGeneratorAssetIds,
    setGifExportAsset: store.setGifExportAsset, setSpectrumAsset: store.setSpectrumAsset,
    scanDuplicateMedia, addAssetToTimeline, addVersionForMedia,
    openMediaVersionCompare, addAdjustmentLayer, relinkMedia, relinkAllMissing,
    generateProxyForMedia, convertVfrMediaToCfr, setMediaMetadata: store.setMediaMetadata,
    batchUpdateMediaMetadata, batchRenameMedia, addTitleTemplate,
    createMediaFolder, renameMediaFolder, deleteMediaFolder,
    setMediaFolderCollapsed, moveMediaToFolder, applyEffectPresetToSelectedClip,
    handleToggleFavorite, handleRevealFromMediaBin, handlePinToSession,
    handleAddSubclip, handleUpdateSubclip, handleDeleteSubclip,
    handleAddSubclipToTimeline, projectMediaMetadata: store.project.mediaMetadata,
  });

  // Floating dialogs
  const { floatingDialogsCallbacks } = useEditorShellFloatingDialogsCallbacks({
    templateExportPreset: store.templateExportPreset,
    exportDialogOpen: exportQueue.exportDialogOpen, setExportDialogOpen: exportQueue.setExportDialogOpen,
    timelineExportDialogOpen: exportQueue.timelineExportDialogOpen, setTimelineExportDialogOpen: exportQueue.setTimelineExportDialogOpen,
    lastExportPath: exportQueue.lastExportPath, setLastExportPath: exportQueue.setLastExportPath,
    setTutorialSignals: store.setTutorialSignals, runAutomationForMedia,
    relinkAllMissing, importEdlTimeline, importFcpXmlTimeline, addMedia: store.addMedia,
    createProjectFromTemplate, createProjectFromTimelineTemplate,
    colorAnalysisResults: store.colorAnalysisResults, colorAnalysisJumps: store.colorAnalysisJumps,
    colorAnalysisBusy: store.colorAnalysisBusy,
    runTimelineColorAnalysis, alignTimelineColorToReference,
    seekSpectrumTime, setSpectrumSelectionRange, splitSpectrumAtTime,
    importVideosForStitchWizard, generateVideoStitchTimeline, generateSmartMontage,
    addAssetToTimeline,
    analyzeContentClip, analyzePreferredContentTargets, exportContentAnalysis,
    applySpeakerDiarization, speakerDiarizationResult: store.speakerDiarizationResult,
    contentAnalysisTargets: derived.contentAnalysisTargets,
    operationRecording: store.operationRecording, operationRecordingActive: store.operationRecordingActive,
    operationReplayRunning: store.operationReplayRunning,
    operationRecordingStep: store.operationRecordingStep, operationReplaySpeed: store.operationReplaySpeed,
    startOperationRecording, stopOperationRecording, saveOperationRecording,
    loadOperationRecording, replayOperationRecording, pauseOperationReplay,
    jumpOperationRecording, exportOperationRecordingSlides,
    profilerRecording: store.profilerRecording, profilerElapsedMs: store.profilerElapsedMs,
    profilerReport: store.profilerReport,
    startProfilerRecording, stopProfilerRecording, exportProfilerReportJson,
    saveNamedSnapshot, restoreSnapshotProject, applySnapshotDiffSelection,
    updateProjectReleaseVersion, syncCompareClipRefs: derived.syncCompareClipRefs,
    jumpToMediaAsset,
    detectedBeatBpm: derived.detectedBeatBpm, beatSyncBeatTimes: derived.beatSyncBeatTimes,
    canDetectBeats: derived.canDetectBeats, canSnapToBeats: derived.canSnapToBeats,
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
    recoveryCandidate: store.recoveryCandidate, exportQueueRecovery: exportQueue.exportQueueRecovery,
    archiveProgress: store.archiveProgress, sharePackageProgress: exportQueue.sharePackageProgress,
    restoreRecovery, discardRecovery,
    restoreExportQueueRecovery: exportQueue.restoreExportQueueRecovery,
    discardExportQueueRecovery: exportQueue.discardExportQueueRecovery,
    skipTutorial, closeTutorialCelebration,
  });

  return {
    // Profiler
    handleProfilerFrame,
    startProfilerRecording, stopProfilerRecording, exportProfilerReportJson,
    // View settings
    saveCurrentWorkspaceLayout, toggleSafeFrameGuides, toggleThumbnailTrackVisible,
    toggleTimelineMinimapVisible, updateTimelineHeatmap, updatePreviewPerformance,
    updateTimelineInteractionSettings, persistPreviewWindowState, openDetachedPreview,
    reembedPreviewWindow, updateTimelineGridSettings, toggleTimelineGridSnap,
    changeTimelineGridUnit, runAutomationForMedia, beginTimelineResize,
    // Project
    requestProjectPassword, saveProject, saveEncryptedProject,
    startTutorial, skipTutorial, closeTutorialCelebration, confirmProjectEncryptionSave,
    archiveCurrentProject, executeNewProject, newProject,
    createProjectFromTemplate, createProjectFromTimelineTemplate, openProject,
    saveNamedSnapshot, restoreSnapshotProject, applySnapshotDiffSelection,
    // Media
    refreshSharedLibraryResources, persistMediaFingerprints,
    applyImportedMediaColorConversionChoice, queueFrameRateConversionForImportedMedia,
    importMedia, addVersionForMedia, openBatchTranscode, batchGenerateCovers,
    createMediaFolder, renameMediaFolder, deleteMediaFolder, setMediaFolderCollapsed,
    moveMediaToFolder, batchUpdateMediaMetadata, batchRenameMedia,
    relinkMedia, relinkAllMissing, scanDuplicateMedia, mergeDuplicateMediaGroups,
    refreshMediaOrganizer, openMediaOrganizer, confirmMediaOrganizerDuplicateGroups,
    removeMediaOrganizerReferences, archiveUnusedMedia, renameUnusedMedia,
    conformMedia, handleAddSubclip, handleUpdateSubclip, handleDeleteSubclip,
    jumpToMediaAsset, updateProjectReleaseVersion,
    // Misc
    createMediaReport, createClipReport, openMediaVersionCompare, openSyncCompare,
    clearCache, handleToggleFavorite, handlePinToSession, handleRevealFromMediaBin,
    // Playback
    undo, redo, switchToPreviousHistoryBranch,
    togglePlayback, reversePlayback, pausePlayback, forwardPlayback, stepFrame,
    addAnnotationAtPlayhead, addReviewAnnotationAtPlayhead, createReviewReport,
    addBookmarkAtPlayhead, jumpTimelineNavigationPoint,
    exportBookmarks, importBookmarks,
    setSingleExportRange, appendExportRange,
    markInPoint, markOutPoint, markMultiRangeInPoint, markMultiRangeOutPoint,
    // Timeline
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
    // Inline
    importVideosForStitchWizard, generateVideoStitchTimeline, generateSmartMontage,
    importSubtitles, importDataSubtitles,
    restoreRecovery, discardRecovery, importDropped,
    importSubtitlePaths, importSubtitleDataPaths,
    inlineShortcutHandlers,
    // Content analysis
    runSingleContentAnalysis, analyzeContentClip, analyzePreferredContentTargets, exportContentAnalysis,
    // Health
    refreshProjectHealth, openProjectHealth,
    refreshMediaHealthDashboard, openMediaHealthDashboard,
    setMediaHealthAutoShow, openMediaHealthRelinkPanel,
    relinkMissingFromHealth, removeOrphanFromHealth,
    mergeDuplicateFromHealth, queueProxyFromHealth,
    autoRepairProjectHealth, repairFromMediaHealthDashboard,
    // Audio
    separateSelectedAudio, runSpeakerDiarization, applySpeakerDiarization,
    openAutoAudioSync, runAutoAudioSync, applyAutoAudioSync, cancelAudioSeparation,
    // Recording
    startEditorRecording, stopEditorRecording,
    // Beat sync
    detectSelectedBeats, snapSelectedToBeats, splitSelectedToBeats, applyManualBeatBpm,
    // Proxy
    generateProxyForMedia, deleteProxiesForMedia, regenerateProxiesForMedia,
    migrateProxiesToDirectory, convertVfrMediaToCfr,
    // Operation recording
    recordMacroHistory, startMacroRecording, stopMacroRecording, executeMacro,
    startOperationRecording, stopOperationRecording, saveOperationRecording,
    loadOperationRecording, pauseOperationReplay, replayOperationRecording,
    jumpOperationRecording, exportOperationRecordingSlides,
    // Composed callbacks
    leftPanelCallbacks, floatingDialogsCallbacks,
  };
}
