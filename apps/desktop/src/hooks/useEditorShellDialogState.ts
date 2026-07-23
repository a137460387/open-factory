import { useState, useCallback } from 'react';
import type { ExportTask } from '@open-factory/editor-core';
import type { ExportPreset } from '../export/export-presets';
import type { ArchiveProgress } from '../lib/projectArchive';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import type { AutosaveRecoveryCandidate } from '../export/export-queue-persistence';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import type { DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../media/MediaOrganizerDialog';

/**
 * 从 EditorShell 中提取的对话框状态。
 * 将 20+ 个对话框的 useState 集中管理。
 */
export function useEditorShellDialogState() {
  // --- 项目相关对话框 ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectTemplateOpen, setProjectTemplateOpen] = useState(false);
  const [timelineTemplateMode, setTimelineTemplateMode] = useState<'save' | 'new' | null>(null);
  const [snapshotNameOpen, setSnapshotNameOpen] = useState(false);
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState(false);
  const [snapshotCompareOpen, setSnapshotCompareOpen] = useState(false);
  const [timelineCompareOpen, setTimelineCompareOpen] = useState(false);
  const [projectPasswordRequest, setProjectPasswordRequest] = useState<any>(null);
  const [recoveryCandidate, setRecoveryCandidate] = useState<AutosaveRecoveryCandidate | undefined>(undefined);
  const [exportQueueRecovery, setExportQueueRecovery] = useState<ExportQueueRecoveryCandidate | undefined>(undefined);
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress | undefined>(undefined);
  const [sharePackageProgress, setSharePackageProgress] = useState<SharePackageWorkflowProgress | undefined>(undefined);

  // --- 媒体相关对话框 ---
  const [duplicateMediaGroups, setDuplicateMediaGroups] = useState<any[]>([]);
  const [duplicateMediaDialogOpen, setDuplicateMediaDialogOpen] = useState(false);
  const [mediaOrganizerDialogOpen, setMediaOrganizerDialogOpen] = useState(false);
  const [mediaOrganizerReport, setMediaOrganizerReport] = useState<any>(null);
  const [mediaHealthDashboardOpen, setMediaHealthDashboardOpen] = useState(false);
  const [mediaHealthDashboard, setMediaHealthDashboard] = useState<any>(null);
  const [projectHealthOpen, setProjectHealthOpen] = useState(false);
  const [projectHealthReport, setProjectHealthReport] = useState<any>(null);
  const [projectHealthScanning, setProjectHealthScanning] = useState(false);
  const [projectHealthRepairReport, setProjectHealthRepairReport] = useState<any>(null);
  const [mediaHealthScanning, setMediaHealthScanning] = useState(false);

  // --- 时间线相关对话框 ---
  const [sceneDetectionRequestId, setSceneDetectionRequestId] = useState(0);
  const [sceneReorderOpen, setSceneReorderOpen] = useState(false);
  const [styleTransferOpen, setStyleTransferOpen] = useState(false);
  const [collaborationNotesOpen, setCollaborationNotesOpen] = useState(false);
  const [operationRecordingOpen, setOperationRecordingOpen] = useState(false);
  const [complexityScoreOpen, setComplexityScoreOpen] = useState(false);
  const [smartRecommendationsOpen, setSmartRecommendationsOpen] = useState(false);
  const [contentAnalysisOpen, setContentAnalysisOpen] = useState(false);
  const [profilerOpen, setProfilerOpen] = useState(false);
  const [rhythmAnalysisOpen, setRhythmAnalysisOpen] = useState(false);
  const [beatSyncOpen, setBeatSyncOpen] = useState(false);
  const [autoAudioSyncOpen, setAutoAudioSyncOpen] = useState(false);
  const [errorKnowledgeOpen, setErrorKnowledgeOpen] = useState(false);
  const [sequenceCompareOpen, setSequenceCompareOpen] = useState(false);
  const [subtitleSyncOpen, setSubtitleSyncOpen] = useState(false);
  const [proxyVerifyOpen, setProxyVerifyOpen] = useState(false);
  const [formatConverterOpen, setFormatConverterOpen] = useState(false);
  const [emotionAnalysisOpen, setEmotionAnalysisOpen] = useState(false);
  const [exportHistoryClassifierOpen, setExportHistoryClassifierOpen] = useState(false);
  const [macroHistoryOpen, setMacroHistoryOpen] = useState(false);

  // --- AI 相关对话框 ---
  const [smartRoughCutOpen, setSmartRoughCutOpen] = useState(false);
  const [aiRoughCutOpen, setAiRoughCutOpen] = useState(false);
  const [directorModeOpen, setDirectorModeOpen] = useState(false);
  const [musicMatchOpen, setMusicMatchOpen] = useState(false);
  const [highlightReelOpen, setHighlightReelOpen] = useState(false);
  const [contextualTranslationOpen, setContextualTranslationOpen] = useState(false);
  const [aiChatEditorOpen, setAiChatEditorOpen] = useState(false);
  const [smartCreationOpen, setSmartCreationOpen] = useState(false);
  const [videoSummaryOpen, setVideoSummaryOpen] = useState(false);
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [assistEditingOpen, setAssistEditingOpen] = useState(false);
  const [contentGenerationOpen, setContentGenerationOpen] = useState(false);
  const [qualityAssessmentOpen, setQualityAssessmentOpen] = useState(false);

  // --- 面板状态 ---
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [projectDocumentationOpen, setProjectDocumentationOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [lutEditorOpen, setLutEditorOpen] = useState(false);
  const [colorNodeEditorOpen, setColorNodeEditorOpen] = useState(false);
  const [colorAnalysisOpen, setColorAnalysisOpen] = useState(false);
  const [professionalNleExportOpen, setProfessionalNleExportOpen] = useState(false);
  const [mediaPrecheckOpen, setMediaPrecheckOpen] = useState(false);
  const [videoStitchWizardOpen, setVideoStitchWizardOpen] = useState(false);
  const [smartMontageOpen, setSmartMontageOpen] = useState(false);
  const [syncCompareOpen, setSyncCompareOpen] = useState(false);
  const [batchTranscodeOpen, setBatchTranscodeOpen] = useState(false);
  const [batchWatermarkOpen, setBatchWatermarkOpen] = useState(false);
  const [batchProjectProcessingOpen, setBatchProjectProcessingOpen] = useState(false);
  const [releaseWorkflowOpen, setReleaseWorkflowOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [timelineExportDialogOpen, setTimelineExportDialogOpen] = useState(false);
  const [thumbnailGeneratorAssetIds, setThumbnailGeneratorAssetIds] = useState<string[]>([]);
  const [gifExportAsset, setGifExportAsset] = useState<any>(null);
  const [spectrumAsset, setSpectrumAsset] = useState<any>(null);
  const [pasteKeyframeDialogOpen, setPasteKeyframeDialogOpen] = useState(false);

  // --- 教程状态 ---
  const [tutorialProgress, setTutorialProgress] = useState<any>(null);
  const [tutorialCelebrationVisible, setTutorialCelebrationVisible] = useState(false);

  // --- 宏录制状态 ---
  const [macroRecordingActive, setMacroRecordingActive] = useState(false);
  const [macroRecordingStepCount, setMacroRecordingStepCount] = useState(0);

  return {
    // 项目相关
    settingsOpen, setSettingsOpen,
    projectTemplateOpen, setProjectTemplateOpen,
    timelineTemplateMode, setTimelineTemplateMode,
    snapshotNameOpen, setSnapshotNameOpen,
    snapshotHistoryOpen, setSnapshotHistoryOpen,
    snapshotCompareOpen, setSnapshotCompareOpen,
    timelineCompareOpen, setTimelineCompareOpen,
    projectPasswordRequest, setProjectPasswordRequest,
    recoveryCandidate, setRecoveryCandidate,
    exportQueueRecovery, setExportQueueRecovery,
    archiveProgress, setArchiveProgress,
    sharePackageProgress, setSharePackageProgress,

    // 媒体相关
    duplicateMediaGroups, setDuplicateMediaGroups,
    duplicateMediaDialogOpen, setDuplicateMediaDialogOpen,
    mediaOrganizerDialogOpen, setMediaOrganizerDialogOpen,
    mediaOrganizerReport, setMediaOrganizerReport,
    mediaHealthDashboardOpen, setMediaHealthDashboardOpen,
    mediaHealthDashboard, setMediaHealthDashboard,
    projectHealthOpen, setProjectHealthOpen,
    projectHealthReport, setProjectHealthReport,
    projectHealthScanning, setProjectHealthScanning,
    projectHealthRepairReport, setProjectHealthRepairReport,
    mediaHealthScanning, setMediaHealthScanning,

    // 时间线相关
    sceneDetectionRequestId, setSceneDetectionRequestId,
    sceneReorderOpen, setSceneReorderOpen,
    styleTransferOpen, setStyleTransferOpen,
    collaborationNotesOpen, setCollaborationNotesOpen,
    operationRecordingOpen, setOperationRecordingOpen,
    complexityScoreOpen, setComplexityScoreOpen,
    smartRecommendationsOpen, setSmartRecommendationsOpen,
    contentAnalysisOpen, setContentAnalysisOpen,
    profilerOpen, setProfilerOpen,
    rhythmAnalysisOpen, setRhythmAnalysisOpen,
    beatSyncOpen, setBeatSyncOpen,
    autoAudioSyncOpen, setAutoAudioSyncOpen,
    errorKnowledgeOpen, setErrorKnowledgeOpen,
    sequenceCompareOpen, setSequenceCompareOpen,
    subtitleSyncOpen, setSubtitleSyncOpen,
    proxyVerifyOpen, setProxyVerifyOpen,
    formatConverterOpen, setFormatConverterOpen,
    emotionAnalysisOpen, setEmotionAnalysisOpen,
    exportHistoryClassifierOpen, setExportHistoryClassifierOpen,
    macroHistoryOpen, setMacroHistoryOpen,

    // AI 相关
    smartRoughCutOpen, setSmartRoughCutOpen,
    aiRoughCutOpen, setAiRoughCutOpen,
    directorModeOpen, setDirectorModeOpen,
    musicMatchOpen, setMusicMatchOpen,
    highlightReelOpen, setHighlightReelOpen,
    contextualTranslationOpen, setContextualTranslationOpen,
    aiChatEditorOpen, setAiChatEditorOpen,
    smartCreationOpen, setSmartCreationOpen,
    videoSummaryOpen, setVideoSummaryOpen,
    narrationOpen, setNarrationOpen,
    assistEditingOpen, setAssistEditingOpen,
    contentGenerationOpen, setContentGenerationOpen,
    qualityAssessmentOpen, setQualityAssessmentOpen,

    // 面板状态
    historyPanelOpen, setHistoryPanelOpen,
    projectDocumentationOpen, setProjectDocumentationOpen,
    storyboardOpen, setStoryboardOpen,
    lutEditorOpen, setLutEditorOpen,
    colorNodeEditorOpen, setColorNodeEditorOpen,
    colorAnalysisOpen, setColorAnalysisOpen,
    professionalNleExportOpen, setProfessionalNleExportOpen,
    mediaPrecheckOpen, setMediaPrecheckOpen,
    videoStitchWizardOpen, setVideoStitchWizardOpen,
    smartMontageOpen, setSmartMontageOpen,
    syncCompareOpen, setSyncCompareOpen,
    batchTranscodeOpen, setBatchTranscodeOpen,
    batchWatermarkOpen, setBatchWatermarkOpen,
    batchProjectProcessingOpen, setBatchProjectProcessingOpen,
    releaseWorkflowOpen, setReleaseWorkflowOpen,
    exportDialogOpen, setExportDialogOpen,
    timelineExportDialogOpen, setTimelineExportDialogOpen,
    thumbnailGeneratorAssetIds, setThumbnailGeneratorAssetIds,
    gifExportAsset, setGifExportAsset,
    spectrumAsset, setSpectrumAsset,
    pasteKeyframeDialogOpen, setPasteKeyframeDialogOpen,

    // 教程状态
    tutorialProgress, setTutorialProgress,
    tutorialCelebrationVisible, setTutorialCelebrationVisible,

    // 宏录制状态
    macroRecordingActive, setMacroRecordingActive,
    macroRecordingStepCount, setMacroRecordingStepCount,
  };
}
