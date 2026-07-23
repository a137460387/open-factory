import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import type { Clip, MediaAsset } from '@open-factory/editor-core';

/**
 * 从 EditorShell 中提取的 Zustand store 订阅。
 * 将 277 个 store 订阅集中管理，避免 EditorShell 组件臃肿。
 */
export function useEditorShellStoreSubscriptions() {
  // --- EditorStore 订阅 ---
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

  // --- EditorUIStore 订阅 ---
  const setBatchTranscodeOpen = useEditorUIStore((s) => s.setBatchTranscodeOpen);
  const setBatchWatermarkOpen = useEditorUIStore((s) => s.setBatchWatermarkOpen);
  const setBatchProjectProcessingOpen = useEditorUIStore((s) => s.setBatchProjectProcessingOpen);
  const setLutEditorOpen = useEditorUIStore((s) => s.setLutEditorOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const professionalNleExportOpen = useEditorUIStore((s) => s.professionalNleExportOpen);
  const setProfessionalNleExportOpen = useEditorUIStore((s) => s.setProfessionalNleExportOpen);
  const mediaPrecheckOpen = useEditorUIStore((s) => s.mediaPrecheckOpen);
  const setMediaPrecheckOpen = useEditorUIStore((s) => s.setMediaPrecheckOpen);
  const setVideoStitchWizardOpen = useEditorUIStore((s) => s.setVideoStitchWizardOpen);
  const setSmartMontageOpen = useEditorUIStore((s) => s.setSmartMontageOpen);
  const syncCompareOpen = useEditorUIStore((s) => s.syncCompareOpen);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);
  const setSceneReorderOpen = useEditorUIStore((s) => s.setSceneReorderOpen);
  const setStyleTransferOpen = useEditorUIStore((s) => s.setStyleTransferOpen);
  const collaborationNotesOpen = useEditorUIStore((s) => s.collaborationNotesOpen);
  const setCollaborationNotesOpen = useEditorUIStore((s) => s.setCollaborationNotesOpen);
  const setOperationRecordingOpen = useEditorUIStore((s) => s.setOperationRecordingOpen);
  const complexityScoreOpen = useEditorUIStore((s) => s.complexityScoreOpen);
  const setComplexityScoreOpen = useEditorUIStore((s) => s.setComplexityScoreOpen);
  const setSmartRecommendationsOpen = useEditorUIStore((s) => s.setSmartRecommendationsOpen);
  const setContentAnalysisOpen = useEditorUIStore((s) => s.setContentAnalysisOpen);
  const setProfilerOpen = useEditorUIStore((s) => s.setProfilerOpen);
  const setRhythmAnalysisOpen = useEditorUIStore((s) => s.setRhythmAnalysisOpen);
  const setBeatSyncOpen = useEditorUIStore((s) => s.setBeatSyncOpen);
  const setAutoAudioSyncOpen = useEditorUIStore((s) => s.setAutoAudioSyncOpen);
  const setErrorKnowledgeOpen = useEditorUIStore((s) => s.setErrorKnowledgeOpen);
  const setSequenceCompareOpen = useEditorUIStore((s) => s.setSequenceCompareOpen);
  const setSubtitleSyncOpen = useEditorUIStore((s) => s.setSubtitleSyncOpen);
  const setProxyVerifyOpen = useEditorUIStore((s) => s.setProxyVerifyOpen);
  const setFormatConverterOpen = useEditorUIStore((s) => s.setFormatConverterOpen);
  const setEmotionAnalysisOpen = useEditorUIStore((s) => s.setEmotionAnalysisOpen);
  const setExportHistoryClassifierOpen = useEditorUIStore((s) => s.setExportHistoryClassifierOpen);
  const setMacroHistoryOpen = useEditorUIStore((s) => s.setMacroHistoryOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const setArchiveProgress = useEditorUIStore((s) => s.setArchiveProgress);

  // --- EditorSettingsStore 订阅 ---
  const lastBackupAt = useEditorSettingsStore((s) => s.lastBackupAt);
  const setLastBackupAt = useEditorSettingsStore((s) => s.setLastBackupAt);
  const pipLayoutPosition = useEditorSettingsStore((s) => s.pipLayoutPosition);
  const setPiPLayoutPosition = useEditorSettingsStore((s) => s.setPiPLayoutPosition);
  const customSplitLayouts = useEditorSettingsStore((s) => s.customSplitLayouts);
  const setCustomSplitLayouts = useEditorSettingsStore((s) => s.setCustomSplitLayouts);

  // --- EditorFeatureStore 订阅 ---
  const batchTranscodeInitialPaths = useEditorFeatureStore((s) => s.batchTranscodeInitialPaths);
  const setBatchTranscodeInitialPaths = useEditorFeatureStore((s) => s.setBatchTranscodeInitialPaths);
  const thumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.thumbnailGeneratorAssetIds);
  const setThumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.setThumbnailGeneratorAssetIds);
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
  const setGifExportAsset = useEditorFeatureStore((s) => s.setGifExportAsset);
  const setSpectrumAsset = useEditorFeatureStore((s) => s.setSpectrumAsset);
  const mediaVersionCompare = useEditorFeatureStore((s) => s.mediaVersionCompare);
  const setMediaVersionCompare = useEditorFeatureStore((s) => s.setMediaVersionCompare);
  const setFormatConverterMockFiles = useEditorFeatureStore((s) => s.setFormatConverterMockFiles);
  const setMockSubtitleClips = useEditorFeatureStore((s) => s.setMockSubtitleClips);
  const setMockExportHistory = useEditorFeatureStore((s) => s.setMockExportHistory);
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
  const operationRecording = useEditorFeatureStore((s) => s.operationRecording);
  const operationRecordingActive = useEditorFeatureStore((s) => s.operationRecordingActive);
  const operationRecordingStep = useEditorFeatureStore((s) => s.operationRecordingStep);
  const operationReplaySpeed = useEditorFeatureStore((s) => s.operationReplaySpeed);
  const operationReplayRunning = useEditorFeatureStore((s) => s.operationReplayRunning);
  const profilerRecording = useEditorFeatureStore((s) => s.profilerRecording);
  const profilerElapsedMs = useEditorFeatureStore((s) => s.profilerElapsedMs);
  const profilerReport = useEditorFeatureStore((s) => s.profilerReport);
  const projectHealthReport = useEditorFeatureStore((s) => s.projectHealthReport);
  const projectHealthScanning = useEditorFeatureStore((s) => s.projectHealthScanning);
  const projectHealthRepairReport = useEditorFeatureStore((s) => s.projectHealthRepairReport);
  const mediaHealthScanning = useEditorFeatureStore((s) => s.mediaHealthScanning);
  const mediaHealthDashboard = useEditorFeatureStore((s) => s.mediaHealthDashboard);
  const mediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.mediaHealthAutoShowEnabled);
  const setMediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.setMediaHealthAutoShowEnabled);
  const mediaHealthDashboardOpen = useEditorUIStore((s) => s.mediaHealthDashboardOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const setMediaHealthDashboard = useEditorFeatureStore((s) => s.setMediaHealthDashboard);
  const setMediaHealthScanning = useEditorFeatureStore((s) => s.setMediaHealthScanning);

  // --- EditorUIStore: Dialog open states ---
  const aiChatEditorOpen = useEditorUIStore((s) => s.aiChatEditorOpen);
  const setAiChatEditorOpen = useEditorUIStore((s) => s.setAiChatEditorOpen);
  const aiRoughCutOpen = useEditorUIStore((s) => s.aiRoughCutOpen);
  const setAiRoughCutOpen = useEditorUIStore((s) => s.setAiRoughCutOpen);
  const beatSyncOpen = useEditorUIStore((s) => s.beatSyncOpen);
  const setBeatSyncOpen = useEditorUIStore((s) => s.setBeatSyncOpen);
  const contextualTranslationOpen = useEditorUIStore((s) => s.contextualTranslationOpen);
  const setContextualTranslationOpen = useEditorUIStore((s) => s.setContextualTranslationOpen);
  const directorModeOpen = useEditorUIStore((s) => s.directorModeOpen);
  const setDirectorModeOpen = useEditorUIStore((s) => s.setDirectorModeOpen);
  const duplicateMediaOpen = useEditorUIStore((s) => s.duplicateMediaOpen);
  const setDuplicateMediaOpen = useEditorUIStore((s) => s.setDuplicateMediaOpen);
  const highlightReelOpen = useEditorUIStore((s) => s.highlightReelOpen);
  const setHighlightReelOpen = useEditorUIStore((s) => s.setHighlightReelOpen);
  const historyPanelOpen = useEditorUIStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useEditorUIStore((s) => s.setHistoryPanelOpen);
  const mediaOrganizerOpen = useEditorUIStore((s) => s.mediaOrganizerOpen);
  const setMediaOrganizerOpen = useEditorUIStore((s) => s.setMediaOrganizerOpen);
  const musicMatchOpen = useEditorUIStore((s) => s.musicMatchOpen);
  const setMusicMatchOpen = useEditorUIStore((s) => s.setMusicMatchOpen);
  const narrationOpen = useEditorUIStore((s) => s.narrationOpen);
  const setNarrationOpen = useEditorUIStore((s) => s.setNarrationOpen);
  const pasteKeyframeDialogOpen = useEditorUIStore((s) => s.pasteKeyframeDialogOpen);
  const setPasteKeyframeDialogOpen = useEditorUIStore((s) => s.setPasteKeyframeDialogOpen);
  const previewWindowOpen = useEditorUIStore((s) => s.previewWindowOpen);
  const setPreviewWindowOpen = useEditorUIStore((s) => s.setPreviewWindowOpen);
  const projectDocumentationOpen = useEditorUIStore((s) => s.projectDocumentationOpen);
  const setProjectDocumentationOpen = useEditorUIStore((s) => s.setProjectDocumentationOpen);
  const projectEncryptionSaveOpen = useEditorUIStore((s) => s.projectEncryptionSaveOpen);
  const setProjectEncryptionSaveOpen = useEditorUIStore((s) => s.setProjectEncryptionSaveOpen);
  const projectHealthOpen = useEditorUIStore((s) => s.projectHealthOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const projectTemplateOpen = useEditorUIStore((s) => s.projectTemplateOpen);
  const setProjectTemplateOpen = useEditorUIStore((s) => s.setProjectTemplateOpen);
  const releaseWorkflowOpen = useEditorUIStore((s) => s.releaseWorkflowOpen);
  const setReleaseWorkflowOpen = useEditorUIStore((s) => s.setReleaseWorkflowOpen);
  const reviewMode = useEditorUIStore((s) => s.reviewMode);
  const setReviewMode = useEditorUIStore((s) => s.setReviewMode);
  const shortcutCheatsheetOpen = useEditorUIStore((s) => s.shortcutCheatsheetOpen);
  const setShortcutCheatsheetOpen = useEditorUIStore((s) => s.setShortcutCheatsheetOpen);
  const smartCreationOpen = useEditorUIStore((s) => s.smartCreationOpen);
  const setSmartCreationOpen = useEditorUIStore((s) => s.setSmartCreationOpen);
  const smartRoughCutOpen = useEditorUIStore((s) => s.smartRoughCutOpen);
  const setSmartRoughCutOpen = useEditorUIStore((s) => s.setSmartRoughCutOpen);
  const snapshotCompareOpen = useEditorUIStore((s) => s.snapshotCompareOpen);
  const setSnapshotCompareOpen = useEditorUIStore((s) => s.setSnapshotCompareOpen);
  const snapshotHistoryOpen = useEditorUIStore((s) => s.snapshotHistoryOpen);
  const setSnapshotHistoryOpen = useEditorUIStore((s) => s.setSnapshotHistoryOpen);
  const snapshotNameOpen = useEditorUIStore((s) => s.snapshotNameOpen);
  const setSnapshotNameOpen = useEditorUIStore((s) => s.setSnapshotNameOpen);
  const storyboardOpen = useEditorUIStore((s) => s.storyboardOpen);
  const setStoryboardOpen = useEditorUIStore((s) => s.setStoryboardOpen);
  const timelineCompareOpen = useEditorUIStore((s) => s.timelineCompareOpen);
  const setTimelineCompareOpen = useEditorUIStore((s) => s.setTimelineCompareOpen);
  const timelineSearchOpen = useEditorUIStore((s) => s.timelineSearchOpen);
  const setTimelineSearchOpen = useEditorUIStore((s) => s.setTimelineSearchOpen);
  const videoSummaryOpen = useEditorUIStore((s) => s.videoSummaryOpen);
  const setVideoSummaryOpen = useEditorUIStore((s) => s.setVideoSummaryOpen);
  const setSettingsOpen = useEditorUIStore((s) => s.setSettingsOpen);
  const setAssistEditingOpen = useEditorUIStore((s) => s.setAssistEditingOpen);
  const setContentGenerationOpen = useEditorUIStore((s) => s.setContentGenerationOpen);
  const setQualityAssessmentOpen = useEditorUIStore((s) => s.setQualityAssessmentOpen);
  const layoutSettings = useEditorUIStore((s) => s.layoutSettings);
  const setLayoutSettings = useEditorUIStore((s) => s.setLayoutSettings);
  const viewportSize = useEditorUIStore((s) => s.viewportSize);
  const setViewportSize = useEditorUIStore((s) => s.setViewportSize);
  const persistLayoutPatch = useEditorUIStore((s) => s.persistLayoutPatch);
  const persistPanelVisibilityPatch = useEditorUIStore((s) => s.persistPanelVisibilityPatch);

  // --- EditorSettingsStore: Additional settings ---
  const beatSensitivity = useEditorSettingsStore((s) => s.beatSensitivity);
  const setBeatSensitivity = useEditorSettingsStore((s) => s.setBeatSensitivity);
  const beatSyncSpeedEnabled = useEditorSettingsStore((s) => s.beatSyncSpeedEnabled);
  const setBeatSyncSpeedEnabled = useEditorSettingsStore((s) => s.setBeatSyncSpeedEnabled);
  const beatSyncManualBpm = useEditorSettingsStore((s) => s.beatSyncManualBpm);
  const setBeatSyncManualBpm = useEditorSettingsStore((s) => s.setBeatSyncManualBpm);
  const sceneDetectionRequestId = useEditorSettingsStore((s) => s.sceneDetectionRequestId);
  const setSceneDetectionRequestId = useEditorSettingsStore((s) => s.setSceneDetectionRequestId);
  const collaborationIdentity = useEditorSettingsStore((s) => s.collaborationIdentity);
  const setCollaborationIdentity = useEditorSettingsStore((s) => s.setCollaborationIdentity);
  const tutorialProgress = useEditorSettingsStore((s) => s.tutorialProgress);
  const setTutorialProgress = useEditorSettingsStore((s) => s.setTutorialProgress);
  const tutorialCelebrationVisible = useEditorSettingsStore((s) => s.tutorialCelebrationVisible);
  const setTutorialCelebrationVisible = useEditorSettingsStore((s) => s.setTutorialCelebrationVisible);
  const tutorialSignals = useEditorSettingsStore((s) => s.tutorialSignals);
  const setTutorialSignals = useEditorSettingsStore((s) => s.setTutorialSignals);
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
  const previewWindowResolutionScale = useEditorSettingsStore((s) => s.previewWindowResolutionScale);
  const setPreviewWindowResolutionScale = useEditorSettingsStore((s) => s.setPreviewWindowResolutionScale);
  const timelineGridSettings = useEditorSettingsStore((s) => s.timelineGridSettings);
  const setTimelineGridSettings = useEditorSettingsStore((s) => s.setTimelineGridSettings);
  const timelineInteractionSettings = useEditorSettingsStore((s) => s.timelineInteractionSettings);
  const setTimelineInteractionSettings = useEditorSettingsStore((s) => s.setTimelineInteractionSettings);
  const shortcutBindings = useEditorSettingsStore((s) => s.shortcutBindings);
  const setShortcutBindings = useEditorSettingsStore((s) => s.setShortcutBindings);
  const macros = useEditorSettingsStore((s) => s.macros);
  const setMacros = useEditorSettingsStore((s) => s.setMacros);
  const sharedLibraryResources = useEditorSettingsStore((s) => s.sharedLibraryResources);
  const setSharedLibraryResources = useEditorSettingsStore((s) => s.setSharedLibraryResources);
  const autosaveIntervalSeconds = useEditorSettingsStore((s) => s.autosaveIntervalSeconds);
  const setAutosaveIntervalSeconds = useEditorSettingsStore((s) => s.setAutosaveIntervalSeconds);

  // --- EditorFeatureStore: Additional state ---
  const contentAnalysisRunningClipId = useEditorFeatureStore((s) => s.contentAnalysisRunningClipId);
  const setContentAnalysisRunningClipId = useEditorFeatureStore((s) => s.setContentAnalysisRunningClipId);
  const duplicateMediaGroups = useEditorFeatureStore((s) => s.duplicateMediaGroups);
  const setDuplicateMediaGroups = useEditorFeatureStore((s) => s.setDuplicateMediaGroups);
  const macroRecordingActive = useEditorFeatureStore((s) => s.macroRecordingActive);
  const macroRecordingStepCount = useEditorFeatureStore((s) => s.macroRecordingStepCount);
  const mediaOrganizerGroups = useEditorFeatureStore((s) => s.mediaOrganizerGroups);
  const setMediaOrganizerGroups = useEditorFeatureStore((s) => s.setMediaOrganizerGroups);
  const mediaOrganizerCleanup = useEditorFeatureStore((s) => s.mediaOrganizerCleanup);
  const setMediaOrganizerCleanup = useEditorFeatureStore((s) => s.setMediaOrganizerCleanup);
  const mediaOrganizerScanning = useEditorFeatureStore((s) => s.mediaOrganizerScanning);
  const setMediaOrganizerScanning = useEditorFeatureStore((s) => s.setMediaOrganizerScanning);
  const pasteKeyframeDialogGroups = useEditorFeatureStore((s) => s.pasteKeyframeDialogGroups);
  const setPasteKeyframeDialogGroups = useEditorFeatureStore((s) => s.setPasteKeyframeDialogGroups);
  const projectPasswordRequest = useEditorFeatureStore((s) => s.projectPasswordRequest);
  const setProjectPasswordRequest = useEditorFeatureStore((s) => s.setProjectPasswordRequest);
  const recoveryCandidate = useEditorFeatureStore((s) => s.recoveryCandidate);
  const setRecoveryCandidate = useEditorFeatureStore((s) => s.setRecoveryCandidate);
  const archiveProgress = useEditorFeatureStore((s) => s.archiveProgress);
  const setArchiveProgress = useEditorFeatureStore((s) => s.setArchiveProgress);
  const setProjectHealthReport = useEditorFeatureStore((s) => s.setProjectHealthReport);
  const setProjectHealthScanning = useEditorFeatureStore((s) => s.setProjectHealthScanning);
  const setProjectHealthRepairReport = useEditorFeatureStore((s) => s.setProjectHealthRepairReport);
  const timelineTemplateMode = useEditorFeatureStore((s) => s.timelineTemplateMode);
  const setTimelineTemplateMode = useEditorFeatureStore((s) => s.setTimelineTemplateMode);
  const templateExportPreset = useEditorFeatureStore((s) => s.templateExportPreset);
  const setTemplateExportPreset = useEditorFeatureStore((s) => s.setTemplateExportPreset);

  // --- CollaborationStore 订阅 ---
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);

  // --- ProxySettingsStore 订阅 ---
  const proxySettings = useProxySettingsStore((state) => state.settings);

  // --- DemucsSettingsStore 订阅 ---
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);

  // --- RecordingSettingsStore 订阅 ---
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

    // EditorUIStore
    setBatchTranscodeOpen,
    setBatchWatermarkOpen,
    setBatchProjectProcessingOpen,
    setLutEditorOpen,
    setColorNodeEditorOpen,
    setColorAnalysisOpen,
    professionalNleExportOpen,
    setProfessionalNleExportOpen,
    mediaPrecheckOpen,
    setMediaPrecheckOpen,
    setVideoStitchWizardOpen,
    setSmartMontageOpen,
    syncCompareOpen,
    setSyncCompareOpen,
    setSceneReorderOpen,
    setStyleTransferOpen,
    collaborationNotesOpen,
    setCollaborationNotesOpen,
    setOperationRecordingOpen,
    complexityScoreOpen,
    setComplexityScoreOpen,
    setSmartRecommendationsOpen,
    setContentAnalysisOpen,
    setProfilerOpen,
    setRhythmAnalysisOpen,
    setBeatSyncOpen,
    setAutoAudioSyncOpen,
    setErrorKnowledgeOpen,
    setSequenceCompareOpen,
    setSubtitleSyncOpen,
    setProxyVerifyOpen,
    setFormatConverterOpen,
    setEmotionAnalysisOpen,
    setExportHistoryClassifierOpen,
    setMacroHistoryOpen,
    setProjectHealthOpen,
    setMediaHealthDashboardOpen,
    setArchiveProgress,

    // EditorSettingsStore
    lastBackupAt,
    setLastBackupAt,
    pipLayoutPosition,
    setPiPLayoutPosition,
    customSplitLayouts,
    setCustomSplitLayouts,

    // EditorFeatureStore
    batchTranscodeInitialPaths,
    setBatchTranscodeInitialPaths,
    thumbnailGeneratorAssetIds,
    setThumbnailGeneratorAssetIds,
    colorAnalysisBusy,
    setColorAnalysisBusy,
    colorAnalysisResults,
    setColorAnalysisResults,
    colorAnalysisJumps,
    setColorAnalysisJumps,
    colorHeatmapPoints,
    setColorHeatmapPoints,
    colorAnalysisSamples,
    setColorAnalysisSamples,
    setGifExportAsset,
    setSpectrumAsset,
    mediaVersionCompare,
    setMediaVersionCompare,
    setFormatConverterMockFiles,
    setMockSubtitleClips,
    setMockExportHistory,
    demucsAvailability,
    setDemucsAvailability,
    audioSeparationClipId,
    setAudioSeparationClipId,
    audioSeparationProgress,
    setAudioSeparationProgress,
    speakerDiarizationRunning,
    setSpeakerDiarizationRunning,
    speakerDiarizationResult,
    setSpeakerDiarizationResult,
    autoAudioSyncRunning,
    setAutoAudioSyncRunning,
    autoAudioSyncPrimaryClipId,
    setAutoAudioSyncPrimaryClipId,
    autoAudioSyncMode,
    setAutoAudioSyncMode,
    autoAudioSyncResults,
    setAutoAudioSyncResults,
    recordingTask,
    setRecordingTask,
    recordingElapsedSeconds,
    setRecordingElapsedSeconds,
    operationRecording,
    operationRecordingActive,
    operationRecordingStep,
    operationReplaySpeed,
    operationReplayRunning,
    profilerRecording,
    profilerElapsedMs,
    profilerReport,
    projectHealthReport,
    projectHealthScanning,
    projectHealthRepairReport,
    mediaHealthScanning,
    mediaHealthDashboard,
    mediaHealthAutoShowEnabled,
    setMediaHealthAutoShowEnabled,
    mediaHealthDashboardOpen,
    setMediaHealthDashboardOpen,
    setMediaHealthDashboard,
    setMediaHealthScanning,

    // EditorUIStore: Dialog open states
    aiChatEditorOpen,
    setAiChatEditorOpen,
    aiRoughCutOpen,
    setAiRoughCutOpen,
    beatSyncOpen,
    setBeatSyncOpen,
    contextualTranslationOpen,
    setContextualTranslationOpen,
    directorModeOpen,
    setDirectorModeOpen,
    duplicateMediaOpen,
    setDuplicateMediaOpen,
    highlightReelOpen,
    setHighlightReelOpen,
    historyPanelOpen,
    setHistoryPanelOpen,
    mediaOrganizerOpen,
    setMediaOrganizerOpen,
    musicMatchOpen,
    setMusicMatchOpen,
    narrationOpen,
    setNarrationOpen,
    pasteKeyframeDialogOpen,
    setPasteKeyframeDialogOpen,
    previewWindowOpen,
    setPreviewWindowOpen,
    projectDocumentationOpen,
    setProjectDocumentationOpen,
    projectEncryptionSaveOpen,
    setProjectEncryptionSaveOpen,
    projectHealthOpen,
    setProjectHealthOpen,
    projectTemplateOpen,
    setProjectTemplateOpen,
    releaseWorkflowOpen,
    setReleaseWorkflowOpen,
    reviewMode,
    setReviewMode,
    shortcutCheatsheetOpen,
    setShortcutCheatsheetOpen,
    smartCreationOpen,
    setSmartCreationOpen,
    smartRoughCutOpen,
    setSmartRoughCutOpen,
    snapshotCompareOpen,
    setSnapshotCompareOpen,
    snapshotHistoryOpen,
    setSnapshotHistoryOpen,
    snapshotNameOpen,
    setSnapshotNameOpen,
    storyboardOpen,
    setStoryboardOpen,
    timelineCompareOpen,
    setTimelineCompareOpen,
    timelineSearchOpen,
    setTimelineSearchOpen,
    videoSummaryOpen,
    setVideoSummaryOpen,
    setSettingsOpen,
    setAssistEditingOpen,
    setContentGenerationOpen,
    setQualityAssessmentOpen,
    layoutSettings,
    setLayoutSettings,
    viewportSize,
    setViewportSize,
    persistLayoutPatch,
    persistPanelVisibilityPatch,

    // EditorSettingsStore: Additional settings
    beatSensitivity,
    setBeatSensitivity,
    beatSyncSpeedEnabled,
    setBeatSyncSpeedEnabled,
    beatSyncManualBpm,
    setBeatSyncManualBpm,
    sceneDetectionRequestId,
    setSceneDetectionRequestId,
    collaborationIdentity,
    setCollaborationIdentity,
    tutorialProgress,
    setTutorialProgress,
    tutorialCelebrationVisible,
    setTutorialCelebrationVisible,
    tutorialSignals,
    setTutorialSignals,
    safeFrameGuides,
    setSafeFrameGuides,
    thumbnailTrackVisible,
    setThumbnailTrackVisible,
    timelineMinimapVisible,
    setTimelineMinimapVisible,
    timelineHeatmap,
    setTimelineHeatmap,
    previewPerformance,
    setPreviewPerformance,
    previewWindowResolutionScale,
    setPreviewWindowResolutionScale,
    timelineGridSettings,
    setTimelineGridSettings,
    timelineInteractionSettings,
    setTimelineInteractionSettings,
    shortcutBindings,
    setShortcutBindings,
    macros,
    setMacros,
    sharedLibraryResources,
    setSharedLibraryResources,
    autosaveIntervalSeconds,
    setAutosaveIntervalSeconds,

    // EditorFeatureStore: Additional state
    contentAnalysisRunningClipId,
    setContentAnalysisRunningClipId,
    duplicateMediaGroups,
    setDuplicateMediaGroups,
    macroRecordingActive,
    macroRecordingStepCount,
    mediaOrganizerGroups,
    setMediaOrganizerGroups,
    mediaOrganizerCleanup,
    setMediaOrganizerCleanup,
    mediaOrganizerScanning,
    setMediaOrganizerScanning,
    pasteKeyframeDialogGroups,
    setPasteKeyframeDialogGroups,
    projectPasswordRequest,
    setProjectPasswordRequest,
    recoveryCandidate,
    setRecoveryCandidate,
    archiveProgress,
    setArchiveProgress,
    setProjectHealthReport,
    setProjectHealthScanning,
    setProjectHealthRepairReport,
    timelineTemplateMode,
    setTimelineTemplateMode,
    templateExportPreset,
    setTemplateExportPreset,

    // Additional UI state
    exportDialogOpen,
    setExportDialogOpen,
    timelineExportDialogOpen,
    setTimelineExportDialogOpen,
    autoAudioSyncOpen,
    setAutoAudioSyncOpen,
    setErrorKnowledgeOpen,
    setSequenceCompareOpen,
    setSubtitleSyncOpen,
    setProxyVerifyOpen,
    setFormatConverterOpen,
    setEmotionAnalysisOpen,
    setExportHistoryClassifierOpen,

    // Additional Feature state
    demucsAvailability,
    setDemucsAvailability,
    audioSeparationClipId,
    setAudioSeparationClipId,
    audioSeparationProgress,
    setAudioSeparationProgress,
    speakerDiarizationRunning,
    setSpeakerDiarizationRunning,
    speakerDiarizationResult,
    setSpeakerDiarizationResult,
    autoAudioSyncRunning,
    setAutoAudioSyncRunning,
    autoAudioSyncPrimaryClipId,
    setAutoAudioSyncPrimaryClipId,
    autoAudioSyncMode,
    setAutoAudioSyncMode,
    autoAudioSyncResults,
    setAutoAudioSyncResults,
    recordingTask,
    setRecordingTask,
    recordingElapsedSeconds,
    setRecordingElapsedSeconds,
    setFormatConverterMockFiles,
    setMockSubtitleClips,
    setMockExportHistory,

    // CollaborationStore
    collaborationEnabled,

    // ProxySettingsStore
    proxySettings,

    // DemucsSettingsStore
    demucsExecutablePath,

    // RecordingSettingsStore
    recordingSettings,
  };
}
