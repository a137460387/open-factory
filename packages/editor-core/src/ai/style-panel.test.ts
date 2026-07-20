import { describe, it, expect } from 'vitest';
import {
  stylePanelReducer,
  createInitialStylePanelState,
  filterStyles,
  getAllTags,
  formatStyleSummary,
  formatComparisonSummary,
  type StylePanelState,
  type StylePanelAction,
} from './style-panel';
import { STYLE_FINGERPRINT_VERSION, type StyleFingerprint } from './style-analyzer';
import type { TransitionType } from '../model-types';

// ─── Test Helpers ───────────────────────────────────────────────

function makeStyle(overrides: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    version: STYLE_FINGERPRINT_VERSION,
    id: `style-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Style',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analyzedProjectCount: 1,
    totalClipCount: 10,
    totalDurationSec: 60,
    transitions: [],
    rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 },
    colorGrading: { brightness: { mean: 0, stddev: 0, count: 0 }, contrast: { mean: 0, stddev: 0, count: 0 }, saturation: { mean: 0, stddev: 0, count: 0 }, hue: { mean: 0, stddev: 0, count: 0 }, preferredLutPath: null, lutUsageRatio: 0, temperatureTendency: 'neutral' },
    audioProcessing: { avgTargetLoudness: -14, loudnessStddev: 0, avgFadeInSec: 0.3, avgFadeOutSec: 0.5, musicSpeechRatio: 0.5, crossfadeRatio: 0.3 },
    effects: [],
    tags: ['test'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('style-panel', () => {
  describe('stylePanelReducer', () => {
    it('loads styles', () => {
      const state = createInitialStylePanelState();
      const styles = [makeStyle({ name: 'Style A' }), makeStyle({ name: 'Style B' })];
      const result = stylePanelReducer(state, { type: 'LOAD_STYLES', styles });
      expect(result.phase).toBe('browsing');
      expect(result.styles.length).toBe(2);
    });

    it('selects a style', () => {
      const style = makeStyle();
      let state = stylePanelReducer(createInitialStylePanelState(), { type: 'LOAD_STYLES', styles: [style] });
      state = stylePanelReducer(state, { type: 'SELECT_STYLE', styleId: style.id });
      expect(state.selectedStyleId).toBe(style.id);
    });

    it('starts and saves edit', () => {
      const style = makeStyle({ name: 'Original' });
      let state = stylePanelReducer(createInitialStylePanelState(), { type: 'LOAD_STYLES', styles: [style] });
      state = stylePanelReducer(state, { type: 'START_EDIT', styleId: style.id });
      expect(state.phase).toBe('editing');
      expect(state.editingStyle).toBeDefined();

      state = stylePanelReducer(state, { type: 'UPDATE_EDIT', updates: { name: 'Updated' } });
      expect(state.editingStyle!.name).toBe('Updated');

      state = stylePanelReducer(state, { type: 'SAVE_EDIT' });
      expect(state.phase).toBe('browsing');
      expect(state.styles[0].name).toBe('Updated');
    });

    it('cancels edit', () => {
      const style = makeStyle({ name: 'Original' });
      let state = stylePanelReducer(createInitialStylePanelState(), { type: 'LOAD_STYLES', styles: [style] });
      state = stylePanelReducer(state, { type: 'START_EDIT', styleId: style.id });
      state = stylePanelReducer(state, { type: 'CANCEL_EDIT' });
      expect(state.phase).toBe('browsing');
      expect(state.editingStyle).toBeUndefined();
    });

    it('deletes a style', () => {
      const style = makeStyle();
      let state = stylePanelReducer(createInitialStylePanelState(), { type: 'LOAD_STYLES', styles: [style] });
      state = stylePanelReducer(state, { type: 'DELETE_STYLE', styleId: style.id });
      expect(state.styles.length).toBe(0);
    });

    it('handles extract complete', () => {
      let state = createInitialStylePanelState();
      state = stylePanelReducer(state, { type: 'START_EXTRACT', project: {} as never });
      expect(state.phase).toBe('extracting');

      const style = makeStyle();
      state = stylePanelReducer(state, { type: 'EXTRACT_COMPLETE', style });
      expect(state.phase).toBe('browsing');
      expect(state.styles.length).toBe(1);
    });

    it('starts comparison and computes similarity', () => {
      const s1 = makeStyle({ id: 'a', name: 'A', rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 } });
      const s2 = makeStyle({ id: 'b', name: 'B', rhythm: { avgClipDurationSec: 6, clipDurationStddev: 2, cutsPerMinute: 10, regularity: 0.5, durationHistogram: [], shortClipRatio: 0.1, longClipRatio: 0.3 } });
      let state = stylePanelReducer(createInitialStylePanelState(), { type: 'LOAD_STYLES', styles: [s1, s2] });
      state = stylePanelReducer(state, { type: 'START_COMPARE', styleIds: ['a', 'b'] });
      expect(state.phase).toBe('comparing');
      expect(state.similarityMatrix['a']['b']).toBeGreaterThanOrEqual(0);
      expect(state.similarityMatrix['a']['a']).toBe(1);
    });
  });

  describe('filterStyles', () => {
    it('filters by search query', () => {
      const styles = [makeStyle({ name: 'Cinematic' }), makeStyle({ name: 'Vlog' })];
      expect(filterStyles(styles, 'cine', []).length).toBe(1);
    });

    it('filters by tags', () => {
      const styles = [makeStyle({ tags: ['fast'] }), makeStyle({ tags: ['slow'] })];
      expect(filterStyles(styles, '', ['fast']).length).toBe(1);
    });
  });

  describe('getAllTags', () => {
    it('returns unique sorted tags', () => {
      const styles = [makeStyle({ tags: ['a', 'b'] }), makeStyle({ tags: ['b', 'c'] })];
      expect(getAllTags(styles)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('formatStyleSummary', () => {
    it('formats a readable summary', () => {
      const style = makeStyle();
      const summary = formatStyleSummary(style);
      expect(summary).toContain('clips');
      expect(summary).toContain('cuts/min');
    });
  });
});
