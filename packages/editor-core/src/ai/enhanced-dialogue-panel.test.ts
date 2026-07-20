import { describe, it, expect } from 'vitest';
import {
  suggestionReducer,
  createInitialSuggestionState,
  getDisplaySuggestions,
  getSelectedSuggestion,
  suggestionToEditPlan,
  buildSuggestionRequest,
  formatSuggestionSummary,
  getCategoryInfo,
  type SuggestionState,
} from './enhanced-dialogue-panel';
import { STYLE_FINGERPRINT_VERSION, type StyleFingerprint } from './style-analyzer';
import type { EditingSuggestion, SuggestionResponse } from './suggestion-engine';
import type { TransitionType } from '../model-types';

// ─── Test Helpers ───────────────────────────────────────────────

function makeSuggestion(overrides: Partial<EditingSuggestion> = {}): EditingSuggestion {
  return {
    id: `sug-${Math.random().toString(36).slice(2, 6)}`,
    category: 'creative',
    title: 'Test',
    description: 'Test suggestion',
    confidence: 0.8,
    rationale: 'Test rationale',
    previewInstructions: [],
    tags: [],
    ...overrides,
  };
}

function makeStyle(overrides: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    version: STYLE_FINGERPRINT_VERSION,
    id: 'style-1',
    name: 'Test Style',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analyzedProjectCount: 1,
    totalClipCount: 10,
    totalDurationSec: 60,
    transitions: [{ type: 'dissolve' as TransitionType, count: 5, avgDurationSec: 0.5, durationStddev: 0.1, ratio: 0.5 }],
    rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 },
    colorGrading: { brightness: { mean: 0, stddev: 0, count: 0 }, contrast: { mean: 0, stddev: 0, count: 0 }, saturation: { mean: 0, stddev: 0, count: 0 }, hue: { mean: 0, stddev: 0, count: 0 }, preferredLutPath: null, lutUsageRatio: 0, temperatureTendency: 'neutral' },
    audioProcessing: { avgTargetLoudness: -14, loudnessStddev: 0, avgFadeInSec: 0.3, avgFadeOutSec: 0.5, musicSpeechRatio: 0.5, crossfadeRatio: 0.3 },
    effects: [],
    tags: ['test'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('enhanced-dialogue-panel', () => {
  describe('suggestionReducer', () => {
    it('initializes with idle phase', () => {
      const state = createInitialSuggestionState();
      expect(state.phase).toBe('idle');
      expect(state.suggestions).toEqual([]);
    });

    it('handles generate flow', () => {
      let state = createInitialSuggestionState();
      state = suggestionReducer(state, { type: 'START_GENERATE', request: { materials: [], styles: [] } });
      expect(state.phase).toBe('generating');

      const response: SuggestionResponse = {
        suggestions: [makeSuggestion({ id: 's1' }), makeSuggestion({ id: 's2' })],
        analysisNotes: 'Test notes',
        usage: { inputTokens: 100, outputTokens: 200 },
        latencyMs: 500,
      };
      state = suggestionReducer(state, { type: 'GENERATE_COMPLETE', response });
      expect(state.phase).toBe('browsing');
      expect(state.suggestions.length).toBe(2);
    });

    it('handles generate error', () => {
      let state = createInitialSuggestionState();
      state = suggestionReducer(state, { type: 'START_GENERATE', request: { materials: [], styles: [] } });
      state = suggestionReducer(state, { type: 'GENERATE_ERROR', error: 'LLM timeout' });
      expect(state.phase).toBe('error');
      expect(state.error).toBe('LLM timeout');
    });

    it('selects a suggestion', () => {
      let state: SuggestionState = { ...createInitialSuggestionState(), suggestions: [makeSuggestion({ id: 's1' })] };
      state = suggestionReducer(state, { type: 'SELECT_SUGGESTION', suggestionId: 's1' });
      expect(state.selectedSuggestionId).toBe('s1');
    });

    it('records feedback', () => {
      let state: SuggestionState = { ...createInitialSuggestionState(), suggestions: [makeSuggestion({ id: 's1' })] };
      state = suggestionReducer(state, { type: 'FEEDBACK', suggestionId: 's1', score: 0.9, notes: 'Great!' });
      expect(state.suggestions[0].feedbackScore).toBe(0.9);
      expect(state.suggestions[0].feedbackNotes).toBe('Great!');
    });

    it('sets filters and sort', () => {
      let state = createInitialSuggestionState();
      state = suggestionReducer(state, { type: 'SET_FILTERS', filters: { categories: ['creative'], minConfidence: 0.5 } });
      expect(state.filters.categories).toEqual(['creative']);
      state = suggestionReducer(state, { type: 'SET_SORT', sortBy: 'feedback' });
      expect(state.sortBy).toBe('feedback');
    });

    it('starts and stops comparison', () => {
      const suggestions = [makeSuggestion({ id: 's1' }), makeSuggestion({ id: 's2' })];
      let state: SuggestionState = { ...createInitialSuggestionState(), suggestions };
      state = suggestionReducer(state, { type: 'START_COMPARE', suggestionIds: ['s1', 's2'] });
      expect(state.phase).toBe('comparing');
      expect(state.comparison).toBeDefined();
      expect(state.comparison!.suggestions.length).toBe(2);

      state = suggestionReducer(state, { type: 'STOP_COMPARE' });
      expect(state.phase).toBe('browsing');
      expect(state.comparison).toBeUndefined();
    });

    it('sets available styles', () => {
      const styles = [makeStyle()];
      let state = createInitialSuggestionState();
      state = suggestionReducer(state, { type: 'SET_STYLES', styles });
      expect(state.availableStyles.length).toBe(1);
    });
  });

  describe('getDisplaySuggestions', () => {
    it('returns filtered and sorted suggestions', () => {
      const state: SuggestionState = {
        ...createInitialSuggestionState(),
        suggestions: [
          makeSuggestion({ id: 's1', confidence: 0.9, category: 'creative' }),
          makeSuggestion({ id: 's2', confidence: 0.5, category: 'platform' }),
          makeSuggestion({ id: 's3', confidence: 0.7, category: 'creative' }),
        ],
        filters: { categories: ['creative'] },
        sortBy: 'confidence',
      };
      const result = getDisplaySuggestions(state);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('getSelectedSuggestion', () => {
    it('returns selected suggestion', () => {
      const sug = makeSuggestion({ id: 's1' });
      const state: SuggestionState = { ...createInitialSuggestionState(), suggestions: [sug], selectedSuggestionId: 's1' };
      expect(getSelectedSuggestion(state)?.id).toBe('s1');
    });

    it('returns undefined when nothing selected', () => {
      expect(getSelectedSuggestion(createInitialSuggestionState())).toBeUndefined();
    });
  });

  describe('suggestionToEditPlan', () => {
    it('converts suggestion to edit plan', () => {
      const sug = makeSuggestion({
        title: 'My Plan',
        previewInstructions: [
          { action: 'cut', target: { startSec: 5 }, params: {}, reason: 'Trim' },
        ],
      });
      const plan = suggestionToEditPlan(sug);
      expect(plan.title).toBe('My Plan');
      expect(plan.instructions.length).toBe(1);
      expect(plan.instructions[0].action).toBe('cut');
    });
  });

  describe('formatSuggestionSummary', () => {
    it('formats readable summary', () => {
      const sug = makeSuggestion({ confidence: 0.85, previewInstructions: [{ action: 'cut', target: {}, params: {}, reason: '' }] });
      const summary = formatSuggestionSummary(sug);
      expect(summary).toContain('creative');
      expect(summary).toContain('85%');
    });
  });

  describe('getCategoryInfo', () => {
    it('returns label and color for each category', () => {
      expect(getCategoryInfo('creative').label).toBe('Creative');
      expect(getCategoryInfo('style-match').color).toBe('#3b82f6');
      expect(getCategoryInfo('experimentation').label).toBe('Experimental');
    });
  });
});
