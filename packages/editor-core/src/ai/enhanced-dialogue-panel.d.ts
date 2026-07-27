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
import type { EditingSuggestion, SuggestionCategory, SuggestionRequest, SuggestionResponse, SuggestionComparison } from './suggestion-engine';
import type { StyleFingerprint } from './style-analyzer';
import type { MaterialMetadata } from './semantic-extractor';
import type { EditPlan } from './llm-orchestrator';
export type SuggestionPhase = 'idle' | 'generating' | 'browsing' | 'comparing' | 'applying' | 'error';
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
export declare function createInitialSuggestionState(): SuggestionState;
export type SuggestionAction = {
    type: 'SET_STYLES';
    styles: StyleFingerprint[];
} | {
    type: 'SET_ACTIVE_STYLE';
    styleId: string | undefined;
} | {
    type: 'START_GENERATE';
    request: SuggestionRequest;
} | {
    type: 'GENERATE_COMPLETE';
    response: SuggestionResponse;
} | {
    type: 'GENERATE_ERROR';
    error: string;
} | {
    type: 'SELECT_SUGGESTION';
    suggestionId: string | undefined;
} | {
    type: 'APPLY_SUGGESTION';
    suggestionId: string;
} | {
    type: 'APPLY_SUGGESTION_COMPLETE';
} | {
    type: 'FEEDBACK';
    suggestionId: string;
    score: number;
    notes?: string;
} | {
    type: 'SET_FILTERS';
    filters: SuggestionState['filters'];
} | {
    type: 'SET_SORT';
    sortBy: SuggestionState['sortBy'];
} | {
    type: 'START_COMPARE';
    suggestionIds: string[];
} | {
    type: 'STOP_COMPARE';
} | {
    type: 'ENRICH_WITH_STYLE';
    styleId: string;
} | {
    type: 'CLEAR_ERROR';
} | {
    type: 'RESET';
};
/**
 * Pure state reducer for the suggestion subsystem.
 * Compose with dialoguePanelReducer for full panel state.
 */
export declare function suggestionReducer(state: SuggestionState, action: SuggestionAction): SuggestionState;
/** Get filtered and sorted suggestions */
export declare function getDisplaySuggestions(state: SuggestionState): EditingSuggestion[];
/** Get the selected suggestion object */
export declare function getSelectedSuggestion(state: SuggestionState): EditingSuggestion | undefined;
/** Convert a suggestion to an EditPlan for execution */
export declare function suggestionToEditPlan(suggestion: EditingSuggestion): EditPlan;
/** Build suggestion request from current context */
export declare function buildSuggestionRequest(materials: MaterialMetadata[], styles: StyleFingerprint[], options?: {
    platform?: string;
    userGuidance?: string;
    maxSuggestions?: number;
    categories?: SuggestionCategory[];
}): SuggestionRequest;
/** Format suggestion for display summary */
export declare function formatSuggestionSummary(suggestion: EditingSuggestion): string;
/** Get category display info */
export declare function getCategoryInfo(category: SuggestionCategory): {
    label: string;
    color: string;
};
//# sourceMappingURL=enhanced-dialogue-panel.d.ts.map