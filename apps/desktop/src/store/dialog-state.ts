/**
 * Dialog/panel open state management.
 *
 * Extracted from editorUIStore to reduce store bloat (H4 fix).
 * All 62 dialog states use the same pattern: boolean + generic setter.
 * This module provides a single Record<string, boolean> approach
 * with a generic setter, reducing ~180 lines of repetitive code to ~30.
 */

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

/** All known dialog/panel keys. Add new dialogs here. */
export const DIALOG_KEYS = [
  'batchTranscodeOpen',
  'batchWatermarkOpen',
  'batchProjectProcessingOpen',
  'lutEditorOpen',
  'colorNodeEditorOpen',
  'colorAnalysisOpen',
  'professionalNleExportOpen',
  'mediaPrecheckOpen',
  'videoStitchWizardOpen',
  'syncCompareOpen',
  'sceneReorderOpen',
  'styleTransferOpen',
  'collaborationNotesOpen',
  'operationRecordingOpen',
  'complexityScoreOpen',
  'smartRecommendationsOpen',
  'contentAnalysisOpen',
  'profilerOpen',
  'rhythmAnalysisOpen',
  'timelineSearchOpen',
  'snapshotNameOpen',
  'snapshotHistoryOpen',
  'snapshotCompareOpen',
  'timelineCompareOpen',
  'releaseWorkflowOpen',
  'projectEncryptionSaveOpen',
  'projectTemplateOpen',
  'settingsOpen',
  'beatSyncOpen',
  'smartRoughCutOpen',
  'aiRoughCutOpen',
  'directorModeOpen',
  'musicMatchOpen',
  'highlightReelOpen',
  'contextualTranslationOpen',
  'aiChatEditorOpen',
  'videoSummaryOpen',
  'narrationOpen',
  'historyPanelOpen',
  'projectDocumentationOpen',
  'storyboardOpen',
  'macroHistoryOpen',
  'projectHealthOpen',
  'mediaHealthDashboardOpen',
  'duplicateMediaOpen',
  'mediaOrganizerOpen',
  'shortcutCheatsheetOpen',
  'pasteKeyframeDialogOpen',
  'previewWindowOpen',
  'autoAudioSyncOpen',
  'errorKnowledgeOpen',
  'sequenceCompareOpen',
  'subtitleSyncOpen',
  'proxyVerifyOpen',
  'formatConverterOpen',
  'emotionAnalysisOpen',
  'aiSubtitleWorkflowOpen',
  'exportHistoryClassifierOpen',
  'smartCreationOpen',
  'smartDistributionOpen',
  'smartMontageOpen',
  'noiseReductionOpen',
  'spectrumAnalyzerOpen',
  'assistEditingOpen',
  'contentGenerationOpen',
  'qualityAssessmentOpen',
  'automationOpen',
] as const;

export type DialogKey = (typeof DIALOG_KEYS)[number];

export type DialogState = Record<DialogKey, boolean>;

/** Creates the initial dialog state (all closed). */
export function createInitialDialogState(): DialogState {
  const state = {} as DialogState;
  for (const key of DIALOG_KEYS) {
    state[key] = false;
  }
  return state;
}

/** Generic dialog open/close setter. */
export function applyDialogUpdate(state: DialogState, key: DialogKey, updater: Updater<boolean>): DialogState {
  return { ...state, [key]: applyUpdater(state[key], updater) };
}
