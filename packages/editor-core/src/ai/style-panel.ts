/**
 * Style Management Panel
 *
 * Data layer for the "Style Management" UI panel.
 * Manages style fingerprint browsing, editing, and application.
 *
 * Designed to be consumed by any frontend framework (React, Vue, Svelte, etc.)
 */

import type {
  StyleFingerprint,
  StyleTransitionPreference,
  StyleRhythmProfile,
  ColorGradingStyle,
  AudioProcessingStyle,
  EffectUsagePattern,
} from './style-analyzer';
import {
  extractProjectStyle,
  mergeStyleFingerprints,
  computeStyleSimilarity,
  STYLE_FINGERPRINT_VERSION,
} from './style-analyzer';
import type { Project } from '../model-types';

// ─── Panel State ────────────────────────────────────────────────

export type StylePanelPhase =
  | 'idle'
  | 'loading'
  | 'browsing'
  | 'editing'
  | 'extracting'
  | 'comparing'
  | 'error';

export interface StylePanelState {
  /** Current phase */
  phase: StylePanelPhase;
  /** All saved style fingerprints */
  styles: StyleFingerprint[];
  /** Currently selected style ID */
  selectedStyleId?: string;
  /** Style being edited (copy for immutable editing) */
  editingStyle?: StyleFingerprint;
  /** Comparison mode: IDs of styles being compared */
  comparingStyleIds: string[];
  /** Similarity scores for comparison */
  similarityMatrix: Record<string, Record<string, number>>;
  /** Extraction progress 0-1 */
  extractionProgress: number;
  /** Error message */
  error?: string;
  /** Filter/search query */
  searchQuery: string;
  /** Active tag filter */
  tagFilter: string[];
}

export function createInitialStylePanelState(): StylePanelState {
  return {
    phase: 'idle',
    styles: [],
    comparingStyleIds: [],
    similarityMatrix: {},
    extractionProgress: 0,
    searchQuery: '',
    tagFilter: [],
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type StylePanelAction =
  | { type: 'LOAD_STYLES'; styles: StyleFingerprint[] }
  | { type: 'SELECT_STYLE'; styleId: string | undefined }
  | { type: 'START_EDIT'; styleId: string }
  | { type: 'UPDATE_EDIT'; updates: Partial<StyleFingerprint> }
  | { type: 'SAVE_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'DELETE_STYLE'; styleId: string }
  | { type: 'START_EXTRACT'; project: Project }
  | { type: 'EXTRACT_PROGRESS'; progress: number }
  | { type: 'EXTRACT_COMPLETE'; style: StyleFingerprint }
  | { type: 'EXTRACT_ERROR'; error: string }
  | { type: 'START_COMPARE'; styleIds: string[] }
  | { type: 'UPDATE_SIMILARITY'; matrix: Record<string, Record<string, number>> }
  | { type: 'STOP_COMPARE' }
  | { type: 'MERGE_STYLES'; styleIds: string[]; name: string }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_TAG_FILTER'; tags: string[] }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

/**
 * Pure state reducer for the style management panel.
 */
export function stylePanelReducer(
  state: StylePanelState,
  action: StylePanelAction,
): StylePanelState {
  switch (action.type) {
    case 'LOAD_STYLES':
      return { ...state, styles: action.styles, phase: 'browsing' };

    case 'SELECT_STYLE':
      return { ...state, selectedStyleId: action.styleId };

    case 'START_EDIT': {
      const style = state.styles.find((s) => s.id === action.styleId);
      if (!style) return { ...state, error: `Style not found: ${action.styleId}` };
      return { ...state, phase: 'editing', editingStyle: { ...style } };
    }

    case 'UPDATE_EDIT': {
      if (!state.editingStyle) return state;
      return {
        ...state,
        editingStyle: { ...state.editingStyle, ...action.updates, updatedAt: new Date().toISOString() },
      };
    }

    case 'SAVE_EDIT': {
      if (!state.editingStyle) return state;
      const updated = state.styles.map((s) =>
        s.id === state.editingStyle!.id ? state.editingStyle! : s,
      );
      const exists = updated.some((s) => s.id === state.editingStyle!.id);
      const styles = exists ? updated : [...updated, state.editingStyle!];
      return { ...state, phase: 'browsing', styles, editingStyle: undefined };
    }

    case 'CANCEL_EDIT':
      return { ...state, phase: 'browsing', editingStyle: undefined };

    case 'DELETE_STYLE': {
      const styles = state.styles.filter((s) => s.id !== action.styleId);
      const selectedStyleId = state.selectedStyleId === action.styleId ? undefined : state.selectedStyleId;
      return { ...state, styles, selectedStyleId };
    }

    case 'START_EXTRACT':
      return { ...state, phase: 'extracting', extractionProgress: 0, error: undefined };

    case 'EXTRACT_PROGRESS':
      return { ...state, extractionProgress: action.progress };

    case 'EXTRACT_COMPLETE':
      return {
        ...state,
        phase: 'browsing',
        styles: [...state.styles, action.style],
        selectedStyleId: action.style.id,
        extractionProgress: 1,
      };

    case 'EXTRACT_ERROR':
      return { ...state, phase: 'error', error: action.error, extractionProgress: 0 };

    case 'START_COMPARE': {
      // Compute similarity matrix for selected styles
      const matrix: Record<string, Record<string, number>> = {};
      const selected = state.styles.filter((s) => action.styleIds.includes(s.id));
      for (const a of selected) {
        matrix[a.id] = {};
        for (const b of selected) {
          matrix[a.id][b.id] = a.id === b.id ? 1 : computeStyleSimilarity(a, b);
        }
      }
      return {
        ...state,
        phase: 'comparing',
        comparingStyleIds: action.styleIds,
        similarityMatrix: matrix,
      };
    }

    case 'UPDATE_SIMILARITY':
      return { ...state, similarityMatrix: action.matrix };

    case 'STOP_COMPARE':
      return { ...state, phase: 'browsing', comparingStyleIds: [], similarityMatrix: {} };

    case 'MERGE_STYLES': {
      const toMerge = state.styles.filter((s) => action.styleIds.includes(s.id));
      const merged = mergeStyleFingerprints(toMerge, action.name);
      if (!merged) return { ...state, error: 'Cannot merge: no valid styles' };
      return {
        ...state,
        styles: [...state.styles, merged],
        selectedStyleId: merged.id,
        phase: 'browsing',
      };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    case 'SET_TAG_FILTER':
      return { ...state, tagFilter: action.tags };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    case 'RESET':
      return createInitialStylePanelState();

    default:
      return state;
  }
}

// ─── Derived Data Helpers ───────────────────────────────────────

/** Filter styles by search query and tag filter */
export function filterStyles(
  styles: StyleFingerprint[],
  searchQuery: string,
  tagFilter: string[],
): StyleFingerprint[] {
  return styles.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = s.name.toLowerCase().includes(q);
      const matchesTags = s.tags.some((t) => t.toLowerCase().includes(q));
      const matchesDesc = s.description?.toLowerCase().includes(q) ?? false;
      if (!matchesName && !matchesTags && !matchesDesc) return false;
    }
    if (tagFilter.length > 0) {
      if (!tagFilter.some((t) => s.tags.includes(t))) return false;
    }
    return true;
  });
}

/** Get all unique tags across all styles */
export function getAllTags(styles: StyleFingerprint[]): string[] {
  const tagSet = new Set<string>();
  for (const s of styles) {
    for (const t of s.tags) {
      tagSet.add(t);
    }
  }
  return Array.from(tagSet).sort();
}

/** Format style summary for display */
export function formatStyleSummary(style: StyleFingerprint): string {
  const parts: string[] = [];
  parts.push(`${style.totalClipCount} clips`);
  parts.push(`${Math.round(style.totalDurationSec)}s total`);
  parts.push(`${style.rhythm.cutsPerMinute.toFixed(1)} cuts/min`);
  parts.push(style.colorGrading.temperatureTendency + ' tones');
  if (style.transitions.length > 0) {
    parts.push(`prefers ${style.transitions[0].type}`);
  }
  return parts.join(' · ');
}

/** Get style comparison summary text */
export function formatComparisonSummary(
  styles: StyleFingerprint[],
  matrix: Record<string, Record<string, number>>,
): string {
  if (styles.length < 2) return 'Select at least 2 styles to compare';

  const pairs: Array<{ a: string; b: string; sim: number }> = [];
  for (let i = 0; i < styles.length; i++) {
    for (let j = i + 1; j < styles.length; j++) {
      const sim = matrix[styles[i].id]?.[styles[j].id] ?? 0;
      pairs.push({ a: styles[i].name, b: styles[j].name, sim });
    }
  }

  return pairs
    .sort((a, b) => b.sim - a.sim)
    .map((p) => `${p.a} ↔ ${p.b}: ${(p.sim * 100).toFixed(0)}%`)
    .join('\n');
}
