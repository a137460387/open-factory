import { useMemo } from 'react';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import type { DialogKey } from '../store/dialog-state';

/**
 * 对话框状态 selectors，优化对话框相关的 store 订阅。
 */
export function useDialogStoreSelectors() {
  // --- 项目相关对话框 ---
  const settingsOpen = useEditorUIStore((s) => s.settingsOpen);
  const projectTemplateOpen = useEditorUIStore((s) => s.projectTemplateOpen);
  const timelineCompareOpen = useEditorUIStore((s) => s.timelineCompareOpen);
  const snapshotNameOpen = useEditorUIStore((s) => s.snapshotNameOpen);
  const snapshotHistoryOpen = useEditorUIStore((s) => s.snapshotHistoryOpen);
  const snapshotCompareOpen = useEditorUIStore((s) => s.snapshotCompareOpen);
  const releaseWorkflowOpen = useEditorUIStore((s) => s.releaseWorkflowOpen);
  const projectEncryptionSaveOpen = useEditorUIStore((s) => s.projectEncryptionSaveOpen);

  // --- 媒体相关对话框 ---
  const mediaPrecheckOpen = useEditorUIStore((s) => s.mediaPrecheckOpen);
  const mediaHealthDashboardOpen = useEditorUIStore((s) => s.mediaHealthDashboardOpen);
  const projectHealthOpen = useEditorUIStore((s) => s.projectHealthOpen);

  // --- 时间线相关对话框 ---
  const sceneReorderOpen = useEditorUIStore((s) => s.sceneReorderOpen);
  const styleTransferOpen = useEditorUIStore((s) => s.styleTransferOpen);
  const collaborationNotesOpen = useEditorUIStore((s) => s.collaborationNotesOpen);
  const operationRecordingOpen = useEditorUIStore((s) => s.operationRecordingOpen);
  const complexityScoreOpen = useEditorUIStore((s) => s.complexityScoreOpen);
  const smartRecommendationsOpen = useEditorUIStore((s) => s.smartRecommendationsOpen);
  const contentAnalysisOpen = useEditorUIStore((s) => s.contentAnalysisOpen);
  const profilerOpen = useEditorUIStore((s) => s.profilerOpen);
  const rhythmAnalysisOpen = useEditorUIStore((s) => s.rhythmAnalysisOpen);
  const beatSyncOpen = useEditorUIStore((s) => s.beatSyncOpen);
  const autoAudioSyncOpen = useEditorUIStore((s) => s.autoAudioSyncOpen);
  const errorKnowledgeOpen = useEditorUIStore((s) => s.errorKnowledgeOpen);
  const sequenceCompareOpen = useEditorUIStore((s) => s.sequenceCompareOpen);
  const subtitleSyncOpen = useEditorUIStore((s) => s.subtitleSyncOpen);
  const proxyVerifyOpen = useEditorUIStore((s) => s.proxyVerifyOpen);
  const formatConverterOpen = useEditorUIStore((s) => s.formatConverterOpen);
  const emotionAnalysisOpen = useEditorUIStore((s) => s.emotionAnalysisOpen);
  const exportHistoryClassifierOpen = useEditorUIStore((s) => s.exportHistoryClassifierOpen);
  const macroHistoryOpen = useEditorUIStore((s) => s.macroHistoryOpen);

  // --- AI 相关对话框 ---
  const smartRoughCutOpen = useEditorUIStore((s) => s.smartRoughCutOpen);
  const aiRoughCutOpen = useEditorUIStore((s) => s.aiRoughCutOpen);
  const directorModeOpen = useEditorUIStore((s) => s.directorModeOpen);
  const musicMatchOpen = useEditorUIStore((s) => s.musicMatchOpen);
  const highlightReelOpen = useEditorUIStore((s) => s.highlightReelOpen);
  const contextualTranslationOpen = useEditorUIStore((s) => s.contextualTranslationOpen);
  const aiChatEditorOpen = useEditorUIStore((s) => s.aiChatEditorOpen);
  const smartCreationOpen = useEditorUIStore((s) => s.smartCreationOpen);
  const videoSummaryOpen = useEditorUIStore((s) => s.videoSummaryOpen);
  const narrationOpen = useEditorUIStore((s) => s.narrationOpen);
  const assistEditingOpen = useEditorUIStore((s) => s.assistEditingOpen);
  const contentGenerationOpen = useEditorUIStore((s) => s.contentGenerationOpen);
  const qualityAssessmentOpen = useEditorUIStore((s) => s.qualityAssessmentOpen);

  // --- 面板状态 ---
  const historyPanelOpen = useEditorUIStore((s) => s.historyPanelOpen);
  const projectDocumentationOpen = useEditorUIStore((s) => s.projectDocumentationOpen);
  const storyboardOpen = useEditorUIStore((s) => s.storyboardOpen);
  const lutEditorOpen = useEditorUIStore((s) => s.lutEditorOpen);
  const colorNodeEditorOpen = useEditorUIStore((s) => s.colorNodeEditorOpen);
  const colorAnalysisOpen = useEditorUIStore((s) => s.colorAnalysisOpen);
  const professionalNleExportOpen = useEditorUIStore((s) => s.professionalNleExportOpen);
  const videoStitchWizardOpen = useEditorUIStore((s) => s.videoStitchWizardOpen);
  const smartMontageOpen = useEditorUIStore((s) => s.smartMontageOpen);
  const syncCompareOpen = useEditorUIStore((s) => s.syncCompareOpen);
  const batchTranscodeOpen = useEditorUIStore((s) => s.batchTranscodeOpen);
  const batchWatermarkOpen = useEditorUIStore((s) => s.batchWatermarkOpen);
  const batchProjectProcessingOpen = useEditorUIStore((s) => s.batchProjectProcessingOpen);

  return {
    // 项目相关
    settingsOpen,
    projectTemplateOpen,
    timelineCompareOpen,
    snapshotNameOpen,
    snapshotHistoryOpen,
    snapshotCompareOpen,
    releaseWorkflowOpen,
    projectEncryptionSaveOpen,

    // 媒体相关
    mediaPrecheckOpen,
    mediaHealthDashboardOpen,
    projectHealthOpen,

    // 时间线相关
    sceneReorderOpen,
    styleTransferOpen,
    collaborationNotesOpen,
    operationRecordingOpen,
    complexityScoreOpen,
    smartRecommendationsOpen,
    contentAnalysisOpen,
    profilerOpen,
    rhythmAnalysisOpen,
    beatSyncOpen,
    autoAudioSyncOpen,
    errorKnowledgeOpen,
    sequenceCompareOpen,
    subtitleSyncOpen,
    proxyVerifyOpen,
    formatConverterOpen,
    emotionAnalysisOpen,
    exportHistoryClassifierOpen,
    macroHistoryOpen,

    // AI 相关
    smartRoughCutOpen,
    aiRoughCutOpen,
    directorModeOpen,
    musicMatchOpen,
    highlightReelOpen,
    contextualTranslationOpen,
    aiChatEditorOpen,
    smartCreationOpen,
    videoSummaryOpen,
    narrationOpen,
    assistEditingOpen,
    contentGenerationOpen,
    qualityAssessmentOpen,

    // 面板状态
    historyPanelOpen,
    projectDocumentationOpen,
    storyboardOpen,
    lutEditorOpen,
    colorNodeEditorOpen,
    colorAnalysisOpen,
    professionalNleExportOpen,
    videoStitchWizardOpen,
    smartMontageOpen,
    syncCompareOpen,
    batchTranscodeOpen,
    batchWatermarkOpen,
    batchProjectProcessingOpen,
  };
}

/**
 * 对话框 setters selectors，优化对话框 setter 订阅。
 */
export function useDialogSetterSelectors() {
  const setSettingsOpen = useEditorUIStore((s) => s.setSettingsOpen);
  const setProjectTemplateOpen = useEditorUIStore((s) => s.setProjectTemplateOpen);
  const setTimelineCompareOpen = useEditorUIStore((s) => s.setTimelineCompareOpen);
  const setSnapshotNameOpen = useEditorUIStore((s) => s.setSnapshotNameOpen);
  const setSnapshotHistoryOpen = useEditorUIStore((s) => s.setSnapshotHistoryOpen);
  const setSnapshotCompareOpen = useEditorUIStore((s) => s.setSnapshotCompareOpen);
  const setReleaseWorkflowOpen = useEditorUIStore((s) => s.setReleaseWorkflowOpen);
  const setProjectEncryptionSaveOpen = useEditorUIStore((s) => s.setProjectEncryptionSaveOpen);
  const setMediaPrecheckOpen = useEditorUIStore((s) => s.setMediaPrecheckOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const setSceneReorderOpen = useEditorUIStore((s) => s.setSceneReorderOpen);
  const setStyleTransferOpen = useEditorUIStore((s) => s.setStyleTransferOpen);
  const setCollaborationNotesOpen = useEditorUIStore((s) => s.setCollaborationNotesOpen);
  const setOperationRecordingOpen = useEditorUIStore((s) => s.setOperationRecordingOpen);
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
  const setSmartRoughCutOpen = useEditorUIStore((s) => s.setSmartRoughCutOpen);
  const setAiRoughCutOpen = useEditorUIStore((s) => s.setAiRoughCutOpen);
  const setDirectorModeOpen = useEditorUIStore((s) => s.setDirectorModeOpen);
  const setMusicMatchOpen = useEditorUIStore((s) => s.setMusicMatchOpen);
  const setHighlightReelOpen = useEditorUIStore((s) => s.setHighlightReelOpen);
  const setContextualTranslationOpen = useEditorUIStore((s) => s.setContextualTranslationOpen);
  const setAiChatEditorOpen = useEditorUIStore((s) => s.setAiChatEditorOpen);
  const setSmartCreationOpen = useEditorUIStore((s) => s.setSmartCreationOpen);
  const setVideoSummaryOpen = useEditorUIStore((s) => s.setVideoSummaryOpen);
  const setNarrationOpen = useEditorUIStore((s) => s.setNarrationOpen);
  const setAssistEditingOpen = useEditorUIStore((s) => s.setAssistEditingOpen);
  const setContentGenerationOpen = useEditorUIStore((s) => s.setContentGenerationOpen);
  const setQualityAssessmentOpen = useEditorUIStore((s) => s.setQualityAssessmentOpen);
  const setHistoryPanelOpen = useEditorUIStore((s) => s.setHistoryPanelOpen);
  const setProjectDocumentationOpen = useEditorUIStore((s) => s.setProjectDocumentationOpen);
  const setStoryboardOpen = useEditorUIStore((s) => s.setStoryboardOpen);
  const setLutEditorOpen = useEditorUIStore((s) => s.setLutEditorOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const setProfessionalNleExportOpen = useEditorUIStore((s) => s.setProfessionalNleExportOpen);
  const setVideoStitchWizardOpen = useEditorUIStore((s) => s.setVideoStitchWizardOpen);
  const setSmartMontageOpen = useEditorUIStore((s) => s.setSmartMontageOpen);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);
  const setBatchTranscodeOpen = useEditorUIStore((s) => s.setBatchTranscodeOpen);
  const setBatchWatermarkOpen = useEditorUIStore((s) => s.setBatchWatermarkOpen);
  const setBatchProjectProcessingOpen = useEditorUIStore((s) => s.setBatchProjectProcessingOpen);

  return {
    setSettingsOpen,
    setProjectTemplateOpen,
    setTimelineCompareOpen,
    setSnapshotNameOpen,
    setSnapshotHistoryOpen,
    setSnapshotCompareOpen,
    setReleaseWorkflowOpen,
    setProjectEncryptionSaveOpen,
    setMediaPrecheckOpen,
    setMediaHealthDashboardOpen,
    setProjectHealthOpen,
    setSceneReorderOpen,
    setStyleTransferOpen,
    setCollaborationNotesOpen,
    setOperationRecordingOpen,
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
    setSmartRoughCutOpen,
    setAiRoughCutOpen,
    setDirectorModeOpen,
    setMusicMatchOpen,
    setHighlightReelOpen,
    setContextualTranslationOpen,
    setAiChatEditorOpen,
    setSmartCreationOpen,
    setVideoSummaryOpen,
    setNarrationOpen,
    setAssistEditingOpen,
    setContentGenerationOpen,
    setQualityAssessmentOpen,
    setHistoryPanelOpen,
    setProjectDocumentationOpen,
    setStoryboardOpen,
    setLutEditorOpen,
    setColorNodeEditorOpen,
    setColorAnalysisOpen,
    setProfessionalNleExportOpen,
    setVideoStitchWizardOpen,
    setSmartMontageOpen,
    setSyncCompareOpen,
    setBatchTranscodeOpen,
    setBatchWatermarkOpen,
    setBatchProjectProcessingOpen,
  };
}
