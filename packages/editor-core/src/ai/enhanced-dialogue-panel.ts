/**
 * Enhanced Dialogue Panel with Creative Suggestions
 *
 * Extends the dialogue editing panel with suggestion mode:
 * - Generate multiple creative editing proposals from LLM
 * - Browse, compare, and selectively apply suggestions
 * - Provide feedback to improve future suggestions
 *
 * This module does NOT re-implement the dialogue panel reducer.
 * Instead it provides additive state and actions that can be
 * composed with the existing dialoguePanelReducer.
 */

import type {
  EditingSuggestion,
  SuggestionCategory,
  SuggestionRequest,
  SuggestionResponse,
  SuggestionComparison,
} from './suggestion-engine';
import {
  buildSuggestionMessages,
  parseSuggestionResponse,
  enrichSuggestionWithStyle,
  generateComparison,
  recordFeedback,
  filterSuggestions,
  rankSuggestions,
} from './suggestion-engine';
import type { StyleFingerprint } from './style-analyzer';
import type { MaterialMetadata } from './semantic-extractor';
import type { EditPlan } from './llm-orchestrator';

// ─── Suggestion State (additive to DialoguePanelState) ──────────

export type SuggestionPhase =
  | 'idle'
  | 'generating'
  | 'browsing'
  | 'comparing'
  | 'applying'
  | 'error';

export interface SuggestionState {
  /** Current suggestion phase */
  phase: SuggestionPhase;
  /** Generated suggestions */
  suggestions: EditingSuggestion[];
  /** Currently selected suggestion for preview */
  selectedSuggestionId?: string;
  /** Comparison view */
  comparison?: SuggestionComparison;
  /** Active filters */
  filters: {
    categories?: SuggestionCategory[];
    minConfidence?: number;
    tags?: string[];
  };
  /** Sort order */
  sortBy: 'confidence' | 'category' | 'feedback';
  /** Error message */
  error?: string;
  /** Available style fingerprints for enrichment */
  availableStyles: StyleFingerprint[];
  /** Style to apply to suggestions */
  activeStyleId?: string;
}

export function createInitialSuggestionState(): SuggestionState {
  return {
    phase: 'idle',
    suggestions: [],
    filters: {},
    sortBy: 'confidence',
    availableStyles: [],
  };
}

// ─── Suggestion Actions ─────────────────────────────────────────

export type SuggestionAction =
  | { type: 'SET_STYLES'; styles: StyleFingerprint[] }
  | { type: 'SET_ACTIVE_STYLE'; styleId: string | undefined }
  | { type: 'START_GENERATE'; request: SuggestionRequest }
  | { type: 'GENERATE_COMPLETE'; response: SuggestionResponse }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'SELECT_SUGGESTION'; suggestionId: string | undefined }
  | { type: 'APPLY_SUGGESTION'; suggestionId: string }
  | { type: 'APPLY_SUGGESTION_COMPLETE' }
  | { type: 'FEEDBACK'; suggestionId: string; score: number; notes?: string }
  | { type: 'SET_FILTERS'; filters: SuggestionState['filters'] }
  | { type: 'SET_SORT'; sortBy: SuggestionState['sortBy'] }
  | { type: 'START_COMPARE'; suggestionIds: string[] }
  | { type: 'STOP_COMPARE' }
  | { type: 'ENRICH_WITH_STYLE'; styleId: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

/**
 * Pure state reducer for the suggestion subsystem.
 * Compose with dialoguePanelReducer for full panel state.
 */
export function suggestionReducer(
  state: SuggestionState,
  action: SuggestionAction,
): SuggestionState {
  switch (action.type) {
    case 'SET_STYLES':
      return { ...state, availableStyles: action.styles };

    case 'SET_ACTIVE_STYLE':
      return { ...state, activeStyleId: action.styleId };

    case 'START_GENERATE':
      return { ...state, phase: 'generating', error: undefined, suggestions: [] };

    case 'GENERATE_COMPLETE':
      return {
        ...state,
        phase: 'browsing',
        suggestions: action.response.suggestions,
      };

    case 'GENERATE_ERROR':
      return { ...state, phase: 'error', error: action.error };

    case 'SELECT_SUGGESTION':
      return { ...state, selectedSuggestionId: action.suggestionId };

    case 'APPLY_SUGGESTION':
      return { ...state, phase: 'applying' };

    case 'APPLY_SUGGESTION_COMPLETE':
      return { ...state, phase: 'browsing' };

    case 'FEEDBACK': {
      const suggestions = state.suggestions.map((s) =>
        s.id === action.suggestionId ? recordFeedback(s, action.score, action.notes) : s,
      );
      return { ...state, suggestions };
    }

    case 'SET_FILTERS':
      return { ...state, filters: action.filters };

    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy };

    case 'START_COMPARE': {
      const selected = state.suggestions.filter((s) => action.suggestionIds.includes(s.id));
      const comparison = generateComparison(selected);
      return { ...state, phase: 'comparing', comparison };
    }

    case 'STOP_COMPARE':
      return { ...state, phase: 'browsing', comparison: undefined };

    case 'ENRICH_WITH_STYLE': {
      const style = state.availableStyles.find((s) => s.id === action.styleId);
      if (!style) return state;
      const suggestions = state.suggestions.map((s) => enrichSuggestionWithStyle(s, style));
      return { ...state, suggestions, activeStyleId: action.styleId };
    }

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    case 'RESET':
      return createInitialSuggestionState();

    default:
      return state;
  }
}

// ─── Derived Data Helpers ───────────────────────────────────────

/** Get filtered and sorted suggestions */
export function getDisplaySuggestions(state: SuggestionState): EditingSuggestion[] {
  let result = filterSuggestions(state.suggestions, state.filters);

  switch (state.sortBy) {
    case 'confidence':
      result = [...result].sort((a, b) => b.confidence - a.confidence);
      break;
    case 'feedback':
      result = [...result].sort((a, b) => (b.feedbackScore ?? 0) - (a.feedbackScore ?? 0));
      break;
    case 'category': {
      const order: SuggestionCategory[] = ['style-match', 'creative', 'platform', 'efficiency', 'experimentation'];
      result = [...result].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
      break;
    }
  }

  return result;
}

/** Get the selected suggestion object */
export function getSelectedSuggestion(state: SuggestionState): EditingSuggestion | undefined {
  return state.suggestions.find((s) => s.id === state.selectedSuggestionId);
}

/** Convert a suggestion to an EditPlan for execution */
export function suggestionToEditPlan(suggestion: EditingSuggestion): EditPlan {
  return {
    title: suggestion.title,
    description: suggestion.description,
    instructions: suggestion.previewInstructions.map((inst, i) => ({
      id: `sug-inst-${i}`,
      action: inst.action as never,
      target: inst.target,
      params: inst.params,
      confidence: suggestion.confidence,
      reason: inst.reason,
    })),
    estimatedDurationSec: 0,
    creativeNotes: suggestion.rationale,
  };
}

/** Build suggestion request from current context */
export function buildSuggestionRequest(
  materials: MaterialMetadata[],
  styles: StyleFingerprint[],
  options: {
    platform?: string;
    userGuidance?: string;
    maxSuggestions?: number;
    categories?: SuggestionCategory[];
  } = {},
): SuggestionRequest {
  return {
    materials,
    styles,
    platform: options.platform,
    userGuidance: options.userGuidance,
    maxSuggestions: options.maxSuggestions ?? 4,
    categories: options.categories,
  };
}

/** Format suggestion for display summary */
export function formatSuggestionSummary(suggestion: EditingSuggestion): string {
  const parts: string[] = [];
  parts.push(`[${suggestion.category}]`);
  parts.push(`${(suggestion.confidence * 100).toFixed(0)}% confidence`);
  parts.push(`${suggestion.previewInstructions.length} edits`);
  if (suggestion.feedbackScore !== undefined) {
    parts.push(`feedback: ${suggestion.feedbackScore > 0 ? '+' : ''}${suggestion.feedbackScore.toFixed(1)}`);
  }
  return parts.join(' · ');
}

/** Get category display info */
export function getCategoryInfo(category: SuggestionCategory): { label: string; color: string } {
  switch (category) {
    case 'creative': return { label: 'Creative', color: '#8b5cf6' };
    case 'style-match': return { label: 'Style Match', color: '#3b82f6' };
    case 'platform': return { label: 'Platform', color: '#10b981' };
    case 'efficiency': return { label: 'Efficiency', color: '#f59e0b' };
    case 'experimentation': return { label: 'Experimental', color: '#ef4444' };
  }
}
