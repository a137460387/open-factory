import {useEditorStore} from '../store/editorStore';
import {useDialogStore} from '../store/dialogStore';
import {useEditorSettingsStore} from '../store/editorSettingsStore';
import {useMediaFeatureStore} from '../store/mediaFeatureStore';
import {useCollaborationStore} from '../store/collaborationStore';
import {useProxySettingsStore} from '../store/proxySettingsStore';
import {useDemucsSettingsStore} from '../store/demucsSettingsStore';
import {useRecordingSettingsStore} from '../store/recordingSettingsStore';
import {useShallow} from 'zustand/react/shallow';
/**
 * 从 EditorShell 中提取的 Zustand store 订阅。
 * 使用 useShallow 合并 dialog open states，减少 re-render 次数。
 */
export function useEditorShellStoreSubscriptions() {
  // --- EditorStore 订阅 (core state - individual selectors for frequent updates) ---
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProject = useEditorStore((state) => state.setProject);
  const setMedia = useEditorStore((state) => state.setMedia);
  const addMedia = useEditorStore((state) => state.addMedia);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
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

  // --- EditorUIStore: Dialog open states (merged with useShallow) ---
  const dialogStates = useDialogStore(useShallow((s) => ({
    professionalNleExportOpen: s.professionalNleExportOpen,
    mediaPrecheckOpen: s.mediaPrecheckOpen,
    syncCompareOpen: s.syncCompareOpen,
    collaborationNotesOpen: s.collaborationNotesOpen,
    complexityScoreOpen: s.complexityScoreOpen,
    autoAudioSyncOpen: s.autoAudioSyncOpen,
    aiChatEditorOpen: s.aiChatEditorOpen,
    aiRoughCutOpen: s.aiRoughCutOpen,
    beatSyncOpen: s.beatSyncOpen,
    contextualTranslationOpen: s.contextualTranslationOpen,
    directorModeOpen: s.directorModeOpen,
    duplicateMediaOpen: s.duplicateMediaOpen,
    highlightReelOpen: s.highlightReelOpen,
    historyPanelOpen: s.historyPanelOpen,
    mediaOrganizerOpen: s.mediaOrganizerOpen,
    musicMatchOpen: s.musicMatchOpen,
    narrationOpen: s.narrationOpen,
    pasteKeyframeDialogOpen: s.pasteKeyframeDialogOpen,
    previewWindowOpen: s.previewWindowOpen,
    projectDocumentationOpen: s.projectDocumentationOpen,
    projectEncryptionSaveOpen: s.projectEncryptionSaveOpen,
    projectHealthOpen: s.projectHealthOpen,
    projectTemplateOpen: s.projectTemplateOpen,
    releaseWorkflowOpen: s.releaseWorkflowOpen,
    reviewMode: s.reviewMode,
    shortcutCheatsheetOpen: s.shortcutCheatsheetOpen,
    smartCreationOpen: s.smartCreationOpen,
    smartRoughCutOpen: s.smartRoughCutOpen,
    snapshotCompareOpen: s.snapshotCompareOpen,
    snapshotHistoryOpen: s.snapshotHistoryOpen,
    snapshotNameOpen: s.snapshotNameOpen,
    storyboardOpen: s.storyboardOpen,
    timelineCompareOpen: s.timelineCompareOpen,
    timelineSearchOpen: s.timelineSearchOpen,
    videoSummaryOpen: s.videoSummaryOpen,
    videoGenerationOpen: s.videoGenerationOpen,
    mediaHealthDashboardOpen: s.mediaHealthDashboardOpen,
  })));

  // --- EditorUIStore: Setters (stable references, grouped with useShallow) ---
  const uiSetters = useDialogStore(useShallow((s) => ({
    setBatchTranscodeOpen: s.setBatchTranscodeOpen,
    setBatchWatermarkOpen: s.setBatchWatermarkOpen,
    setBatchProjectProcessingOpen: s.setBatchProjectProcessingOpen,
    setLutEditorOpen: s.setLutEditorOpen,
    setColorNodeEditorOpen: s.setColorNodeEditorOpen,
    setColorAnalysisOpen: s.setColorAnalysisOpen,
    setProfessionalNleExportOpen: s.setProfessionalNleExportOpen,
    setMediaPrecheckOpen: s.setMediaPrecheckOpen,
    setVideoStitchWizardOpen: s.setVideoStitchWizardOpen,
    setSmartMontageOpen: s.setSmartMontageOpen,
    setSyncCompareOpen: s.setSyncCompareOpen,
    setSceneReorderOpen: s.setSceneReorderOpen,
    setStyleTransferOpen: s.setStyleTransferOpen,
    setCollaborationNotesOpen: s.setCollaborationNotesOpen,
    setCollaborationPanelOpen: s.setCollaborationPanelOpen,
    setColorGradingWorkspaceOpen: s.setColorGradingWorkspaceOpen,
    setOperationRecordingOpen: s.setOperationRecordingOpen,
    setComplexityScoreOpen: s.setComplexityScoreOpen,
    setSmartRecommendationsOpen: s.setSmartRecommendationsOpen,
    setContentAnalysisOpen: s.setContentAnalysisOpen,
    setProfilerOpen: s.setProfilerOpen,
    setRhythmAnalysisOpen: s.setRhythmAnalysisOpen,
    setAutoAudioSyncOpen: s.setAutoAudioSyncOpen,
    setErrorKnowledgeOpen: s.setErrorKnowledgeOpen,
    setSequenceCompareOpen: s.setSequenceCompareOpen,
    setSubtitleSyncOpen: s.setSubtitleSyncOpen,
    setProxyVerifyOpen: s.setProxyVerifyOpen,
    setFormatConverterOpen: s.setFormatConverterOpen,
    setEmotionAnalysisOpen: s.setEmotionAnalysisOpen,
    setExportHistoryClassifierOpen: s.setExportHistoryClassifierOpen,
    setMacroHistoryOpen: s.setMacroHistoryOpen,
    setAiChatEditorOpen: s.setAiChatEditorOpen,
    setAiRoughCutOpen: s.setAiRoughCutOpen,
    setBeatSyncOpen: s.setBeatSyncOpen,
    setContextualTranslationOpen: s.setContextualTranslationOpen,
    setDirectorModeOpen: s.setDirectorModeOpen,
    setDuplicateMediaOpen: s.setDuplicateMediaOpen,
    setHighlightReelOpen: s.setHighlightReelOpen,
    setHistoryPanelOpen: s.setHistoryPanelOpen,
    setMediaOrganizerOpen: s.setMediaOrganizerOpen,
    setMusicMatchOpen: s.setMusicMatchOpen,
    setNarrationOpen: s.setNarrationOpen,
    setPasteKeyframeDialogOpen: s.setPasteKeyframeDialogOpen,
    setPreviewWindowOpen: s.setPreviewWindowOpen,
    setProjectDocumentationOpen: s.setProjectDocumentationOpen,
    setProjectEncryptionSaveOpen: s.setProjectEncryptionSaveOpen,
    setProjectHealthOpen: s.setProjectHealthOpen,
    setProjectTemplateOpen: s.setProjectTemplateOpen,
    setReleaseWorkflowOpen: s.setReleaseWorkflowOpen,
    setReviewMode: s.setReviewMode,
    setShortcutCheatsheetOpen: s.setShortcutCheatsheetOpen,
    setSmartCreationOpen: s.setSmartCreationOpen,
    setSmartRoughCutOpen: s.setSmartRoughCutOpen,
    setSnapshotCompareOpen: s.setSnapshotCompareOpen,
    setSnapshotHistoryOpen: s.setSnapshotHistoryOpen,
    setSnapshotNameOpen: s.setSnapshotNameOpen,
    setStoryboardOpen: s.setStoryboardOpen,
    setTimelineCompareOpen: s.setTimelineCompareOpen,
    setTimelineSearchOpen: s.setTimelineSearchOpen,
    setVideoSummaryOpen: s.setVideoSummaryOpen,
    setVideoGenerationOpen: s.setVideoGenerationOpen,
    setSettingsOpen: s.setSettingsOpen,
    setAssistEditingOpen: s.setAssistEditingOpen,
    setContentGenerationOpen: s.setContentGenerationOpen,
    setQualityAssessmentOpen: s.setQualityAssessmentOpen,
    setMediaHealthDashboardOpen: s.setMediaHealthDashboardOpen,
    layoutSettings: s.layoutSettings,
    setLayoutSettings: s.setLayoutSettings,
    viewportSize: s.viewportSize,
    setViewportSize: s.setViewportSize,
    // 语言变更计数：订阅它使语言切换时 EditorShell（含 Toolbar 等子树）重渲染。
    // 与 viewportSize 同一可靠通道（冷启动下 App 级订阅偶发不触发重渲染，e2e i18n:6）。
    languageVersion: s.languageVersion,
    persistLayoutPatch: s.persistLayoutPatch,
    persistPanelVisibilityPatch: s.persistPanelVisibilityPatch,
  })));

  // --- EditorSettingsStore (merged with useShallow) ---
  const settings = useEditorSettingsStore(useShallow((s) => ({
    lastBackupAt: s.lastBackupAt,
    setLastBackupAt: s.setLastBackupAt,
    pipLayoutPosition: s.pipLayoutPosition,
    setPiPLayoutPosition: s.setPiPLayoutPosition,
    customSplitLayouts: s.customSplitLayouts,
    setCustomSplitLayouts: s.setCustomSplitLayouts,
    beatSensitivity: s.beatSensitivity,
    setBeatSensitivity: s.setBeatSensitivity,
    beatSyncSpeedEnabled: s.beatSyncSpeedEnabled,
    setBeatSyncSpeedEnabled: s.setBeatSyncSpeedEnabled,
    beatSyncManualBpm: s.beatSyncManualBpm,
    setBeatSyncManualBpm: s.setBeatSyncManualBpm,
    sceneDetectionRequestId: s.sceneDetectionRequestId,
    setSceneDetectionRequestId: s.setSceneDetectionRequestId,
    collaborationIdentity: s.collaborationIdentity,
    setCollaborationIdentity: s.setCollaborationIdentity,
    tutorialProgress: s.tutorialProgress,
    setTutorialProgress: s.setTutorialProgress,
    tutorialCelebrationVisible: s.tutorialCelebrationVisible,
    setTutorialCelebrationVisible: s.setTutorialCelebrationVisible,
    tutorialSignals: s.tutorialSignals,
    setTutorialSignals: s.setTutorialSignals,
    safeFrameGuides: s.safeFrameGuides,
    setSafeFrameGuides: s.setSafeFrameGuides,
    thumbnailTrackVisible: s.thumbnailTrackVisible,
    setThumbnailTrackVisible: s.setThumbnailTrackVisible,
    timelineMinimapVisible: s.timelineMinimapVisible,
    setTimelineMinimapVisible: s.setTimelineMinimapVisible,
    timelineHeatmap: s.timelineHeatmap,
    setTimelineHeatmap: s.setTimelineHeatmap,
    previewPerformance: s.previewPerformance,
    setPreviewPerformance: s.setPreviewPerformance,
    previewWindowResolutionScale: s.previewWindowResolutionScale,
    setPreviewWindowResolutionScale: s.setPreviewWindowResolutionScale,
    timelineGridSettings: s.timelineGridSettings,
    setTimelineGridSettings: s.setTimelineGridSettings,
    timelineInteractionSettings: s.timelineInteractionSettings,
    setTimelineInteractionSettings: s.setTimelineInteractionSettings,
    shortcutBindings: s.shortcutBindings,
    setShortcutBindings: s.setShortcutBindings,
    macros: s.macros,
    setMacros: s.setMacros,
    sharedLibraryResources: s.sharedLibraryResources,
    setSharedLibraryResources: s.setSharedLibraryResources,
    autosaveIntervalSeconds: s.autosaveIntervalSeconds,
    setAutosaveIntervalSeconds: s.setAutosaveIntervalSeconds,
  })));

  // --- EditorFeatureStore (merged with useShallow) ---
  const features = useMediaFeatureStore(useShallow((s) => ({
    batchTranscodeInitialPaths: s.batchTranscodeInitialPaths,
    setBatchTranscodeInitialPaths: s.setBatchTranscodeInitialPaths,
    thumbnailGeneratorAssetIds: s.thumbnailGeneratorAssetIds,
    setThumbnailGeneratorAssetIds: s.setThumbnailGeneratorAssetIds,
    colorAnalysisBusy: s.colorAnalysisBusy,
    setColorAnalysisBusy: s.setColorAnalysisBusy,
    colorAnalysisResults: s.colorAnalysisResults,
    setColorAnalysisResults: s.setColorAnalysisResults,
    colorAnalysisJumps: s.colorAnalysisJumps,
    setColorAnalysisJumps: s.setColorAnalysisJumps,
    colorHeatmapPoints: s.colorHeatmapPoints,
    setColorHeatmapPoints: s.setColorHeatmapPoints,
    colorAnalysisSamples: s.colorAnalysisSamples,
    setColorAnalysisSamples: s.setColorAnalysisSamples,
    setGifExportAsset: s.setGifExportAsset,
    setSpectrumAsset: s.setSpectrumAsset,
    mediaVersionCompare: s.mediaVersionCompare,
    setMediaVersionCompare: s.setMediaVersionCompare,
    setFormatConverterMockFiles: s.setFormatConverterMockFiles,
    setMockSubtitleClips: s.setMockSubtitleClips,
    setMockExportHistory: s.setMockExportHistory,
    demucsAvailability: s.demucsAvailability,
    setDemucsAvailability: s.setDemucsAvailability,
    audioSeparationClipId: s.audioSeparationClipId,
    setAudioSeparationClipId: s.setAudioSeparationClipId,
    audioSeparationProgress: s.audioSeparationProgress,
    setAudioSeparationProgress: s.setAudioSeparationProgress,
    speakerDiarizationRunning: s.speakerDiarizationRunning,
    setSpeakerDiarizationRunning: s.setSpeakerDiarizationRunning,
    speakerDiarizationResult: s.speakerDiarizationResult,
    setSpeakerDiarizationResult: s.setSpeakerDiarizationResult,
    autoAudioSyncRunning: s.autoAudioSyncRunning,
    setAutoAudioSyncRunning: s.setAutoAudioSyncRunning,
    autoAudioSyncPrimaryClipId: s.autoAudioSyncPrimaryClipId,
    setAutoAudioSyncPrimaryClipId: s.setAutoAudioSyncPrimaryClipId,
    autoAudioSyncMode: s.autoAudioSyncMode,
    setAutoAudioSyncMode: s.setAutoAudioSyncMode,
    autoAudioSyncResults: s.autoAudioSyncResults,
    setAutoAudioSyncResults: s.setAutoAudioSyncResults,
    recordingTask: s.recordingTask,
    setRecordingTask: s.setRecordingTask,
    recordingElapsedSeconds: s.recordingElapsedSeconds,
    setRecordingElapsedSeconds: s.setRecordingElapsedSeconds,
    operationRecording: s.operationRecording,
    operationRecordingActive: s.operationRecordingActive,
    operationRecordingStep: s.operationRecordingStep,
    operationReplaySpeed: s.operationReplaySpeed,
    operationReplayRunning: s.operationReplayRunning,
    profilerRecording: s.profilerRecording,
    profilerElapsedMs: s.profilerElapsedMs,
    profilerReport: s.profilerReport,
    projectHealthReport: s.projectHealthReport,
    projectHealthScanning: s.projectHealthScanning,
    projectHealthRepairReport: s.projectHealthRepairReport,
    mediaHealthScanning: s.mediaHealthScanning,
    mediaHealthDashboard: s.mediaHealthDashboard,
    mediaHealthAutoShowEnabled: s.mediaHealthAutoShowEnabled,
    setMediaHealthAutoShowEnabled: s.setMediaHealthAutoShowEnabled,
    setMediaHealthDashboard: s.setMediaHealthDashboard,
    setMediaHealthScanning: s.setMediaHealthScanning,
    contentAnalysisRunningClipId: s.contentAnalysisRunningClipId,
    setContentAnalysisRunningClipId: s.setContentAnalysisRunningClipId,
    duplicateMediaGroups: s.duplicateMediaGroups,
    setDuplicateMediaGroups: s.setDuplicateMediaGroups,
    macroRecordingActive: s.macroRecordingActive,
    macroRecordingStepCount: s.macroRecordingStepCount,
    mediaOrganizerGroups: s.mediaOrganizerGroups,
    setMediaOrganizerGroups: s.setMediaOrganizerGroups,
    mediaOrganizerCleanup: s.mediaOrganizerCleanup,
    setMediaOrganizerCleanup: s.setMediaOrganizerCleanup,
    mediaOrganizerScanning: s.mediaOrganizerScanning,
    setMediaOrganizerScanning: s.setMediaOrganizerScanning,
    pasteKeyframeDialogGroups: s.pasteKeyframeDialogGroups,
    setPasteKeyframeDialogGroups: s.setPasteKeyframeDialogGroups,
    projectPasswordRequest: s.projectPasswordRequest,
    setProjectPasswordRequest: s.setProjectPasswordRequest,
    recoveryCandidate: s.recoveryCandidate,
    setRecoveryCandidate: s.setRecoveryCandidate,
    archiveProgress: s.archiveProgress,
    setArchiveProgress: s.setArchiveProgress,
    setProjectHealthReport: s.setProjectHealthReport,
    setProjectHealthScanning: s.setProjectHealthScanning,
    setProjectHealthRepairReport: s.setProjectHealthRepairReport,
    timelineTemplateMode: s.timelineTemplateMode,
    setTimelineTemplateMode: s.setTimelineTemplateMode,
    templateExportPreset: s.templateExportPreset,
    setTemplateExportPreset: s.setTemplateExportPreset,
  })));

  // --- Other stores (single subscriptions) ---
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);

  return {
    // EditorStore
    project,
    selectedClipId,
    selectedClipIds,
    selectedKeyframe,
    selectedKeyframes,
    isPlaying,
    inPoint,
    outPoint,
    dirty,
    projectPath,
    setProject,
    setMedia,
    addMedia,
    setSelectedKeyframes,
    setMediaMetadata,
    setDirty,
    setProjectPath,
    setSelectedClipId,
    setSelectedClipIds,
    clearSelectedClipIds,
    setPlayheadTime,
    setIsPlaying,
    setPlaybackRate,
    setInPoint,
    setOutPoint,

    // EditorUIStore: Dialog states (from useShallow)
    ...dialogStates,
    ...uiSetters,

    // EditorSettingsStore (from useShallow)
    ...settings,

    // EditorFeatureStore (from useShallow)
    ...features,

    // Other stores
    collaborationEnabled,
    proxySettings,
    demucsExecutablePath,
    recordingSettings,
  };
}
