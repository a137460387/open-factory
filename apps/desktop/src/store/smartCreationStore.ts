/**
 * Smart Creation Zustand Store.
 *
 * Manages state for the AI-native smart creation workflow,
 * including analysis progress, results, and UI interactions.
 */

import { create } from 'zustand';
import type { SmartCreationResult, SmartCreationProgress, SmartCreationOptions } from '@open-factory/editor-core';
import { orchestrateSmartCreation } from '@open-factory/editor-core';
import type { MediaAsset } from '@open-factory/editor-core';
import type { NarrativeGenerationResult } from '@open-factory/editor-core';

// ─── State Interface ───────────────────────────────────────

interface SmartCreationState {
  // Analysis state
  isAnalyzing: boolean;
  progress: SmartCreationProgress | null;
  result: SmartCreationResult | null;
  error: string | null;

  // UI state
  selectedRecommendations: string[];
  activeNarrativeTemplate: string;
  showEmotionCurve: boolean;
  showSceneTimeline: boolean;
  showRecommendations: boolean;
  showNarrative: boolean;

  // Actions
  startAnalysis: (media: MediaAsset[], options?: SmartCreationOptions) => Promise<void>;
  selectRecommendation: (clipId: string) => void;
  deselectRecommendation: (clipId: string) => void;
  clearSelection: () => void;
  setActiveTemplate: (template: string) => void;
  toggleEmotionCurve: () => void;
  toggleSceneTimeline: () => void;
  toggleRecommendations: () => void;
  toggleNarrative: () => void;
  clearResults: () => void;
  clearError: () => void;
}

// ─── Store Creation ────────────────────────────────────────

export const useSmartCreationStore = create<SmartCreationState>((set, get) => ({
  // Initial state
  isAnalyzing: false,
  progress: null,
  result: null,
  error: null,
  selectedRecommendations: [],
  activeNarrativeTemplate: 'documentary',
  showEmotionCurve: true,
  showSceneTimeline: true,
  showRecommendations: true,
  showNarrative: true,

  // Start analysis
  startAnalysis: async (media: MediaAsset[], options?: SmartCreationOptions) => {
    set({ isAnalyzing: true, progress: null, result: null, error: null });

    try {
      const result = await orchestrateSmartCreation(media, {
        ...options,
        onProgress: (progress) => set({ progress }),
      });

      set({ result, isAnalyzing: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败';
      set({ error: errorMessage, isAnalyzing: false });
    }
  },

  // Selection management
  selectRecommendation: (clipId: string) => {
    const { selectedRecommendations } = get();
    if (!selectedRecommendations.includes(clipId)) {
      set({ selectedRecommendations: [...selectedRecommendations, clipId] });
    }
  },

  deselectRecommendation: (clipId: string) => {
    const { selectedRecommendations } = get();
    set({
      selectedRecommendations: selectedRecommendations.filter((id) => id !== clipId),
    });
  },

  clearSelection: () => {
    set({ selectedRecommendations: [] });
  },

  // Template management
  setActiveTemplate: (template: string) => {
    set({ activeNarrativeTemplate: template });
  },

  // UI toggle
  toggleEmotionCurve: () => {
    set((state) => ({ showEmotionCurve: !state.showEmotionCurve }));
  },

  toggleSceneTimeline: () => {
    set((state) => ({ showSceneTimeline: !state.showSceneTimeline }));
  },

  toggleRecommendations: () => {
    set((state) => ({ showRecommendations: !state.showRecommendations }));
  },

  toggleNarrative: () => {
    set((state) => ({ showNarrative: !state.showNarrative }));
  },

  // Clear results
  clearResults: () => {
    set({
      result: null,
      progress: null,
      error: null,
      selectedRecommendations: [],
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
