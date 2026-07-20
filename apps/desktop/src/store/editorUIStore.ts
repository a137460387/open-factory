/**
 * Editor UI state — barrel re-export entry point (H4 refactor).
 *
 * This file has been refactored into domain-specific sub-stores:
 * - panelStore.ts   — layout settings, panel visibility, viewport, review mode
 * - dialogStore.ts  — all 62 dialog open/close states and setters
 * - toolbarStore.ts — toolbar/menu state (re-exports from dialogStore)
 * - modalStore.ts   — modal dialog state (re-exports from dialogStore)
 *
 * The combined `useEditorUIStore` is preserved for backward compatibility.
 * New code should import from the specific sub-store directly.
 *
 * @deprecated Prefer `usePanelStore` or `useDialogStore` for new code.
 */

import { create } from 'zustand';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings,
} from '../layout/layoutSettings';
import { saveLayoutSettings } from '../settings/appSettings';
import { readViewportSize } from '../lib/ui-helpers';
import {
  createInitialDialogState,
  applyDialogUpdate,
  DIALOG_KEYS,
  type DialogKey,
  type DialogState,
} from './dialog-state';

// Re-export sub-store hooks and selector utilities for convenience
export {
  usePanelStore,
  useLayoutSettings,
  useReviewMode,
  useViewportSize,
  useSetLayoutSettings,
  useSetReviewMode,
  useSetViewportSize,
  usePersistLayoutPatch,
  usePersistPanelVisibilityPatch,
} from './panelStore';
export { useDialogStore, useDialogState, dialogBooleanSelector, dialogSetterSelector } from './dialogStore';
export { useToolbarStore } from './toolbarStore';
export { useModalStore } from './modalStore';

// Re-export dialog-state utilities
export type { DialogKey, DialogState } from './dialog-state';
export { DIALOG_KEYS, createInitialDialogState, applyDialogUpdate } from './dialog-state';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

/** Generate individual setter names: 'fooOpen' -> 'setFooOpen' */
function dialogSetterName(key: DialogKey): string {
  return `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export interface EditorUIState {
  layoutSettings: EditorLayoutSettings;
  reviewMode: boolean;
  viewportSize: { width: number; height: number };

  // Dialog / panel open states (from dialog-state module)
  dialogState: DialogState;

  // Individual dialog boolean accessors (backward compatibility)
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
  noiseReductionOpen: boolean;
  spectrumAnalyzerOpen: boolean;
  assistEditingOpen: boolean;
  contentGenerationOpen: boolean;
  qualityAssessmentOpen: boolean;
  automationOpen: boolean;

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
  setNoiseReductionOpen: (updater: Updater<boolean>) => void;
  setSpectrumAnalyzerOpen: (updater: Updater<boolean>) => void;
  setAssistEditingOpen: (updater: Updater<boolean>) => void;
  setContentGenerationOpen: (updater: Updater<boolean>) => void;
  setQualityAssessmentOpen: (updater: Updater<boolean>) => void;
  setAutomationOpen: (updater: Updater<boolean>) => void;
}

// Generate dialog state entries and setter entries from DIALOG_KEYS
const initialDialogs = createInitialDialogState();

export const useEditorUIStore = create<EditorUIState>((set, get) => {
  // Build dialog setters dynamically
  const dialogSetters = {} as Record<string, (updater: Updater<boolean>) => void>;
  for (const key of DIALOG_KEYS) {
    const k = key; // capture for closure
    dialogSetters[dialogSetterName(k)] = (updater: Updater<boolean>) => {
      set((state) => {
        const nextDialog = applyDialogUpdate(state.dialogState, k, updater);
        return { dialogState: nextDialog, [k]: nextDialog[k] } as Partial<EditorUIState>;
      });
    };
  }

  // Build individual boolean entries from DIALOG_KEYS
  const dialogBooleans = {} as Record<DialogKey, boolean>;
  for (const key of DIALOG_KEYS) {
    dialogBooleans[key] = initialDialogs[key];
  }

  return {
    layoutSettings: DEFAULT_EDITOR_LAYOUT_SETTINGS,
    reviewMode: typeof window === 'undefined' ? false : window.location.hash === '#review',
    viewportSize: readViewportSize(),

    // Dialog state (single source of truth)
    dialogState: initialDialogs,

    // Individual dialog booleans (derived from dialogState for backward compatibility)
    ...dialogBooleans,

    // Dynamically generated setters
    ...dialogSetters,

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
  } as EditorUIState;
});
