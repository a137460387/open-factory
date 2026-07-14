import { create } from 'zustand';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings,
} from '../layout/layoutSettings';
import { saveLayoutSettings } from '../settings/appSettings';
import { readViewportSize } from '../lib/ui-helpers';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

export interface EditorUIState {
  layoutSettings: EditorLayoutSettings;
  reviewMode: boolean;
  viewportSize: { width: number; height: number };

  // Dialog / panel open states
  batchTranscodeOpen: boolean;
  batchWatermarkOpen: boolean;
  batchProjectProcessingOpen: boolean;
  lutEditorOpen: boolean;
  colorNodeEditorOpen: boolean;
  colorAnalysisOpen: boolean;
  professionalNleExportOpen: boolean;
  mediaPrecheckOpen: boolean;
  videoStitchWizardOpen: boolean;
  syncCompareOpen: boolean;
  sceneReorderOpen: boolean;
  styleTransferOpen: boolean;
  collaborationNotesOpen: boolean;
  operationRecordingOpen: boolean;
  complexityScoreOpen: boolean;
  smartRecommendationsOpen: boolean;
  contentAnalysisOpen: boolean;
  profilerOpen: boolean;
  rhythmAnalysisOpen: boolean;
  timelineSearchOpen: boolean;
  snapshotNameOpen: boolean;
  snapshotHistoryOpen: boolean;
  snapshotCompareOpen: boolean;
  timelineCompareOpen: boolean;
  releaseWorkflowOpen: boolean;
  projectEncryptionSaveOpen: boolean;
  projectTemplateOpen: boolean;
  settingsOpen: boolean;
  beatSyncOpen: boolean;
  smartRoughCutOpen: boolean;
  aiRoughCutOpen: boolean;
  directorModeOpen: boolean;
  musicMatchOpen: boolean;
  highlightReelOpen: boolean;
  contextualTranslationOpen: boolean;
  aiChatEditorOpen: boolean;
  videoSummaryOpen: boolean;
  narrationOpen: boolean;
  historyPanelOpen: boolean;
  projectDocumentationOpen: boolean;
  storyboardOpen: boolean;
  macroHistoryOpen: boolean;
  projectHealthOpen: boolean;
  mediaHealthDashboardOpen: boolean;
  duplicateMediaOpen: boolean;
  mediaOrganizerOpen: boolean;
  shortcutCheatsheetOpen: boolean;
  pasteKeyframeDialogOpen: boolean;
  previewWindowOpen: boolean;
  autoAudioSyncOpen: boolean;
  errorKnowledgeOpen: boolean;
  sequenceCompareOpen: boolean;
  subtitleSyncOpen: boolean;
  proxyVerifyOpen: boolean;
  formatConverterOpen: boolean;
  emotionAnalysisOpen: boolean;
  aiSubtitleWorkflowOpen: boolean;
  exportHistoryClassifierOpen: boolean;
  smartCreationOpen: boolean;
  smartDistributionOpen: boolean;
  smartMontageOpen: boolean;

  // Layout setters
  setLayoutSettings: (updater: Updater<EditorLayoutSettings>) => void;
  setReviewMode: (updater: Updater<boolean>) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  persistLayoutPatch: (patch: Partial<EditorLayoutSettings>) => void;
  persistPanelVisibilityPatch: (patch: Partial<EditorLayoutSettings['panels']>) => void;

  // Dialog / panel open setters
  setBatchTranscodeOpen: (updater: Updater<boolean>) => void;
  setBatchWatermarkOpen: (updater: Updater<boolean>) => void;
  setBatchProjectProcessingOpen: (updater: Updater<boolean>) => void;
  setLutEditorOpen: (updater: Updater<boolean>) => void;
  setColorNodeEditorOpen: (updater: Updater<boolean>) => void;
  setColorAnalysisOpen: (updater: Updater<boolean>) => void;
  setProfessionalNleExportOpen: (updater: Updater<boolean>) => void;
  setMediaPrecheckOpen: (updater: Updater<boolean>) => void;
  setVideoStitchWizardOpen: (updater: Updater<boolean>) => void;
  setSyncCompareOpen: (updater: Updater<boolean>) => void;
  setSceneReorderOpen: (updater: Updater<boolean>) => void;
  setStyleTransferOpen: (updater: Updater<boolean>) => void;
  setCollaborationNotesOpen: (updater: Updater<boolean>) => void;
  setOperationRecordingOpen: (updater: Updater<boolean>) => void;
  setComplexityScoreOpen: (updater: Updater<boolean>) => void;
  setSmartRecommendationsOpen: (updater: Updater<boolean>) => void;
  setContentAnalysisOpen: (updater: Updater<boolean>) => void;
  setProfilerOpen: (updater: Updater<boolean>) => void;
  setRhythmAnalysisOpen: (updater: Updater<boolean>) => void;
  setTimelineSearchOpen: (updater: Updater<boolean>) => void;
  setSnapshotNameOpen: (updater: Updater<boolean>) => void;
  setSnapshotHistoryOpen: (updater: Updater<boolean>) => void;
  setSnapshotCompareOpen: (updater: Updater<boolean>) => void;
  setTimelineCompareOpen: (updater: Updater<boolean>) => void;
  setReleaseWorkflowOpen: (updater: Updater<boolean>) => void;
  setProjectEncryptionSaveOpen: (updater: Updater<boolean>) => void;
  setProjectTemplateOpen: (updater: Updater<boolean>) => void;
  setSettingsOpen: (updater: Updater<boolean>) => void;
  setBeatSyncOpen: (updater: Updater<boolean>) => void;
  setSmartRoughCutOpen: (updater: Updater<boolean>) => void;
  setAiRoughCutOpen: (updater: Updater<boolean>) => void;
  setDirectorModeOpen: (updater: Updater<boolean>) => void;
  setMusicMatchOpen: (updater: Updater<boolean>) => void;
  setHighlightReelOpen: (updater: Updater<boolean>) => void;
  setContextualTranslationOpen: (updater: Updater<boolean>) => void;
  setAiChatEditorOpen: (updater: Updater<boolean>) => void;
  setVideoSummaryOpen: (updater: Updater<boolean>) => void;
  setNarrationOpen: (updater: Updater<boolean>) => void;
  setHistoryPanelOpen: (updater: Updater<boolean>) => void;
  setProjectDocumentationOpen: (updater: Updater<boolean>) => void;
  setStoryboardOpen: (updater: Updater<boolean>) => void;
  setMacroHistoryOpen: (updater: Updater<boolean>) => void;
  setProjectHealthOpen: (updater: Updater<boolean>) => void;
  setMediaHealthDashboardOpen: (updater: Updater<boolean>) => void;
  setDuplicateMediaOpen: (updater: Updater<boolean>) => void;
  setMediaOrganizerOpen: (updater: Updater<boolean>) => void;
  setShortcutCheatsheetOpen: (updater: Updater<boolean>) => void;
  setPasteKeyframeDialogOpen: (updater: Updater<boolean>) => void;
  setPreviewWindowOpen: (updater: Updater<boolean>) => void;
  setAutoAudioSyncOpen: (updater: Updater<boolean>) => void;
  setErrorKnowledgeOpen: (updater: Updater<boolean>) => void;
  setSequenceCompareOpen: (updater: Updater<boolean>) => void;
  setSubtitleSyncOpen: (updater: Updater<boolean>) => void;
  setProxyVerifyOpen: (updater: Updater<boolean>) => void;
  setFormatConverterOpen: (updater: Updater<boolean>) => void;
  setEmotionAnalysisOpen: (updater: Updater<boolean>) => void;
  setAiSubtitleWorkflowOpen: (updater: Updater<boolean>) => void;
  setExportHistoryClassifierOpen: (updater: Updater<boolean>) => void;
  setSmartCreationOpen: (updater: Updater<boolean>) => void;
  setSmartDistributionOpen: (updater: Updater<boolean>) => void;
  setSmartMontageOpen: (updater: Updater<boolean>) => void;
}

export const useEditorUIStore = create<EditorUIState>((set, get) => ({
  layoutSettings: DEFAULT_EDITOR_LAYOUT_SETTINGS,
  reviewMode: typeof window === 'undefined' ? false : window.location.hash === '#review',
  viewportSize: readViewportSize(),

  // Dialog / panel open states
  batchTranscodeOpen: false,
  batchWatermarkOpen: false,
  batchProjectProcessingOpen: false,
  lutEditorOpen: false,
  colorNodeEditorOpen: false,
  colorAnalysisOpen: false,
  professionalNleExportOpen: false,
  mediaPrecheckOpen: false,
  videoStitchWizardOpen: false,
  syncCompareOpen: false,
  sceneReorderOpen: false,
  styleTransferOpen: false,
  collaborationNotesOpen: false,
  operationRecordingOpen: false,
  complexityScoreOpen: false,
  smartRecommendationsOpen: false,
  contentAnalysisOpen: false,
  profilerOpen: false,
  rhythmAnalysisOpen: false,
  timelineSearchOpen: false,
  snapshotNameOpen: false,
  snapshotHistoryOpen: false,
  snapshotCompareOpen: false,
  timelineCompareOpen: false,
  releaseWorkflowOpen: false,
  projectEncryptionSaveOpen: false,
  projectTemplateOpen: false,
  settingsOpen: false,
  beatSyncOpen: false,
  smartRoughCutOpen: false,
  aiRoughCutOpen: false,
  directorModeOpen: false,
  musicMatchOpen: false,
  highlightReelOpen: false,
  contextualTranslationOpen: false,
  aiChatEditorOpen: false,
  videoSummaryOpen: false,
  narrationOpen: false,
  historyPanelOpen: false,
  projectDocumentationOpen: false,
  storyboardOpen: false,
  macroHistoryOpen: false,
  projectHealthOpen: false,
  mediaHealthDashboardOpen: false,
  duplicateMediaOpen: false,
  mediaOrganizerOpen: false,
  shortcutCheatsheetOpen: false,
  pasteKeyframeDialogOpen: false,
  previewWindowOpen: false,
  autoAudioSyncOpen: false,
  errorKnowledgeOpen: false,
  sequenceCompareOpen: false,
  subtitleSyncOpen: false,
  proxyVerifyOpen: false,
  formatConverterOpen: false,
  emotionAnalysisOpen: false,
  aiSubtitleWorkflowOpen: false,
  exportHistoryClassifierOpen: false,
  smartCreationOpen: false,
  smartDistributionOpen: false,
  smartMontageOpen: false,

  setLayoutSettings(updater) {
    set((state) => ({ layoutSettings: applyUpdater(state.layoutSettings, updater) }));
  },

  setReviewMode(updater) {
    set((state) => {
      const next = applyUpdater(state.reviewMode, updater);
      if (typeof window !== 'undefined') {
        if (next) {
          window.location.hash = '#review';
        } else {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      return { reviewMode: next };
    });
  },

  setViewportSize(size) {
    set({ viewportSize: size });
  },

  persistLayoutPatch(patch) {
    const { layoutSettings } = get();
    const next = normalizeStoredLayoutSettings({ ...layoutSettings, ...patch }) ?? {
      ...DEFAULT_EDITOR_LAYOUT_SETTINGS,
    };
    set({ layoutSettings: next });
    void saveLayoutSettings(next).catch((error: unknown) => {
      console.warn('Unable to save layout settings', error);
    });
  },

  persistPanelVisibilityPatch(patch) {
    const { layoutSettings, persistLayoutPatch } = get();
    persistLayoutPatch({ panels: { ...layoutSettings.panels, ...patch } });
  },

  // Dialog / panel open setters
  setBatchTranscodeOpen(updater) {
    set((s) => ({ batchTranscodeOpen: applyUpdater(s.batchTranscodeOpen, updater) }));
  },
  setBatchWatermarkOpen(updater) {
    set((s) => ({ batchWatermarkOpen: applyUpdater(s.batchWatermarkOpen, updater) }));
  },
  setBatchProjectProcessingOpen(updater) {
    set((s) => ({ batchProjectProcessingOpen: applyUpdater(s.batchProjectProcessingOpen, updater) }));
  },
  setLutEditorOpen(updater) {
    set((s) => ({ lutEditorOpen: applyUpdater(s.lutEditorOpen, updater) }));
  },
  setColorNodeEditorOpen(updater) {
    set((s) => ({ colorNodeEditorOpen: applyUpdater(s.colorNodeEditorOpen, updater) }));
  },
  setColorAnalysisOpen(updater) {
    set((s) => ({ colorAnalysisOpen: applyUpdater(s.colorAnalysisOpen, updater) }));
  },
  setProfessionalNleExportOpen(updater) {
    set((s) => ({ professionalNleExportOpen: applyUpdater(s.professionalNleExportOpen, updater) }));
  },
  setMediaPrecheckOpen(updater) {
    set((s) => ({ mediaPrecheckOpen: applyUpdater(s.mediaPrecheckOpen, updater) }));
  },
  setVideoStitchWizardOpen(updater) {
    set((s) => ({ videoStitchWizardOpen: applyUpdater(s.videoStitchWizardOpen, updater) }));
  },
  setSyncCompareOpen(updater) {
    set((s) => ({ syncCompareOpen: applyUpdater(s.syncCompareOpen, updater) }));
  },
  setSceneReorderOpen(updater) {
    set((s) => ({ sceneReorderOpen: applyUpdater(s.sceneReorderOpen, updater) }));
  },
  setStyleTransferOpen(updater) {
    set((s) => ({ styleTransferOpen: applyUpdater(s.styleTransferOpen, updater) }));
  },
  setCollaborationNotesOpen(updater) {
    set((s) => ({ collaborationNotesOpen: applyUpdater(s.collaborationNotesOpen, updater) }));
  },
  setOperationRecordingOpen(updater) {
    set((s) => ({ operationRecordingOpen: applyUpdater(s.operationRecordingOpen, updater) }));
  },
  setComplexityScoreOpen(updater) {
    set((s) => ({ complexityScoreOpen: applyUpdater(s.complexityScoreOpen, updater) }));
  },
  setSmartRecommendationsOpen(updater) {
    set((s) => ({ smartRecommendationsOpen: applyUpdater(s.smartRecommendationsOpen, updater) }));
  },
  setContentAnalysisOpen(updater) {
    set((s) => ({ contentAnalysisOpen: applyUpdater(s.contentAnalysisOpen, updater) }));
  },
  setProfilerOpen(updater) {
    set((s) => ({ profilerOpen: applyUpdater(s.profilerOpen, updater) }));
  },
  setRhythmAnalysisOpen(updater) {
    set((s) => ({ rhythmAnalysisOpen: applyUpdater(s.rhythmAnalysisOpen, updater) }));
  },
  setTimelineSearchOpen(updater) {
    set((s) => ({ timelineSearchOpen: applyUpdater(s.timelineSearchOpen, updater) }));
  },
  setSnapshotNameOpen(updater) {
    set((s) => ({ snapshotNameOpen: applyUpdater(s.snapshotNameOpen, updater) }));
  },
  setSnapshotHistoryOpen(updater) {
    set((s) => ({ snapshotHistoryOpen: applyUpdater(s.snapshotHistoryOpen, updater) }));
  },
  setSnapshotCompareOpen(updater) {
    set((s) => ({ snapshotCompareOpen: applyUpdater(s.snapshotCompareOpen, updater) }));
  },
  setTimelineCompareOpen(updater) {
    set((s) => ({ timelineCompareOpen: applyUpdater(s.timelineCompareOpen, updater) }));
  },
  setReleaseWorkflowOpen(updater) {
    set((s) => ({ releaseWorkflowOpen: applyUpdater(s.releaseWorkflowOpen, updater) }));
  },
  setProjectEncryptionSaveOpen(updater) {
    set((s) => ({ projectEncryptionSaveOpen: applyUpdater(s.projectEncryptionSaveOpen, updater) }));
  },
  setProjectTemplateOpen(updater) {
    set((s) => ({ projectTemplateOpen: applyUpdater(s.projectTemplateOpen, updater) }));
  },
  setSettingsOpen(updater) {
    set((s) => ({ settingsOpen: applyUpdater(s.settingsOpen, updater) }));
  },
  setBeatSyncOpen(updater) {
    set((s) => ({ beatSyncOpen: applyUpdater(s.beatSyncOpen, updater) }));
  },
  setSmartRoughCutOpen(updater) {
    set((s) => ({ smartRoughCutOpen: applyUpdater(s.smartRoughCutOpen, updater) }));
  },
  setAiRoughCutOpen(updater) {
    set((s) => ({ aiRoughCutOpen: applyUpdater(s.aiRoughCutOpen, updater) }));
  },
  setDirectorModeOpen(updater) {
    set((s) => ({ directorModeOpen: applyUpdater(s.directorModeOpen, updater) }));
  },
  setMusicMatchOpen(updater) {
    set((s) => ({ musicMatchOpen: applyUpdater(s.musicMatchOpen, updater) }));
  },
  setHighlightReelOpen(updater) {
    set((s) => ({ highlightReelOpen: applyUpdater(s.highlightReelOpen, updater) }));
  },
  setContextualTranslationOpen(updater) {
    set((s) => ({ contextualTranslationOpen: applyUpdater(s.contextualTranslationOpen, updater) }));
  },
  setAiChatEditorOpen(updater) {
    set((s) => ({ aiChatEditorOpen: applyUpdater(s.aiChatEditorOpen, updater) }));
  },
  setVideoSummaryOpen(updater) {
    set((s) => ({ videoSummaryOpen: applyUpdater(s.videoSummaryOpen, updater) }));
  },
  setNarrationOpen(updater) {
    set((s) => ({ narrationOpen: applyUpdater(s.narrationOpen, updater) }));
  },
  setHistoryPanelOpen(updater) {
    set((s) => ({ historyPanelOpen: applyUpdater(s.historyPanelOpen, updater) }));
  },
  setProjectDocumentationOpen(updater) {
    set((s) => ({ projectDocumentationOpen: applyUpdater(s.projectDocumentationOpen, updater) }));
  },
  setStoryboardOpen(updater) {
    set((s) => ({ storyboardOpen: applyUpdater(s.storyboardOpen, updater) }));
  },
  setMacroHistoryOpen(updater) {
    set((s) => ({ macroHistoryOpen: applyUpdater(s.macroHistoryOpen, updater) }));
  },
  setProjectHealthOpen(updater) {
    set((s) => ({ projectHealthOpen: applyUpdater(s.projectHealthOpen, updater) }));
  },
  setMediaHealthDashboardOpen(updater) {
    set((s) => ({ mediaHealthDashboardOpen: applyUpdater(s.mediaHealthDashboardOpen, updater) }));
  },
  setDuplicateMediaOpen(updater) {
    set((s) => ({ duplicateMediaOpen: applyUpdater(s.duplicateMediaOpen, updater) }));
  },
  setMediaOrganizerOpen(updater) {
    set((s) => ({ mediaOrganizerOpen: applyUpdater(s.mediaOrganizerOpen, updater) }));
  },
  setShortcutCheatsheetOpen(updater) {
    set((s) => ({ shortcutCheatsheetOpen: applyUpdater(s.shortcutCheatsheetOpen, updater) }));
  },
  setPasteKeyframeDialogOpen(updater) {
    set((s) => ({ pasteKeyframeDialogOpen: applyUpdater(s.pasteKeyframeDialogOpen, updater) }));
  },
  setPreviewWindowOpen(updater) {
    set((s) => ({ previewWindowOpen: applyUpdater(s.previewWindowOpen, updater) }));
  },
  setAutoAudioSyncOpen(updater) {
    set((s) => ({ autoAudioSyncOpen: applyUpdater(s.autoAudioSyncOpen, updater) }));
  },
  setErrorKnowledgeOpen(updater) {
    set((s) => ({ errorKnowledgeOpen: applyUpdater(s.errorKnowledgeOpen, updater) }));
  },
  setSequenceCompareOpen(updater) {
    set((s) => ({ sequenceCompareOpen: applyUpdater(s.sequenceCompareOpen, updater) }));
  },
  setSubtitleSyncOpen(updater) {
    set((s) => ({ subtitleSyncOpen: applyUpdater(s.subtitleSyncOpen, updater) }));
  },
  setProxyVerifyOpen(updater) {
    set((s) => ({ proxyVerifyOpen: applyUpdater(s.proxyVerifyOpen, updater) }));
  },
  setFormatConverterOpen(updater) {
    set((s) => ({ formatConverterOpen: applyUpdater(s.formatConverterOpen, updater) }));
  },
  setEmotionAnalysisOpen(updater) {
    set((s) => ({ emotionAnalysisOpen: applyUpdater(s.emotionAnalysisOpen, updater) }));
  },
  setAiSubtitleWorkflowOpen(updater) {
    set((s) => ({ aiSubtitleWorkflowOpen: applyUpdater(s.aiSubtitleWorkflowOpen, updater) }));
  },
  setExportHistoryClassifierOpen(updater) {
    set((s) => ({ exportHistoryClassifierOpen: applyUpdater(s.exportHistoryClassifierOpen, updater) }));
  },
  setSmartCreationOpen(updater) {
    set((s) => ({ smartCreationOpen: applyUpdater(s.smartCreationOpen, updater) }));
  },
  setSmartDistributionOpen(updater) {
    set((s) => ({ smartDistributionOpen: applyUpdater(s.smartDistributionOpen, updater) }));
  },
  setSmartMontageOpen(updater) {
    set((s) => ({ smartMontageOpen: applyUpdater(s.smartMontageOpen, updater) }));
  },
}));
