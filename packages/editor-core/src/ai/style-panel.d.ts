/**
 * Style Management Panel
 *
 * Data layer for the "Style Management" UI panel.
 * Manages style fingerprint browsing, editing, and application.
 *
 * Designed to be consumed by any frontend framework (React, Vue, Svelte, etc.)
 */
import type { StyleFingerprint } from './style-analyzer';
import type { Project } from '../model-types';
export type StylePanelPhase = 'idle' | 'loading' | 'browsing' | 'editing' | 'extracting' | 'comparing' | 'error';
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
export declare function createInitialStylePanelState(): StylePanelState;
export type StylePanelAction = {
    type: 'LOAD_STYLES';
    styles: StyleFingerprint[];
} | {
    type: 'SELECT_STYLE';
    styleId: string | undefined;
} | {
    type: 'START_EDIT';
    styleId: string;
} | {
    type: 'UPDATE_EDIT';
    updates: Partial<StyleFingerprint>;
} | {
    type: 'SAVE_EDIT';
} | {
    type: 'CANCEL_EDIT';
} | {
    type: 'DELETE_STYLE';
    styleId: string;
} | {
    type: 'START_EXTRACT';
    project: Project;
} | {
    type: 'EXTRACT_PROGRESS';
    progress: number;
} | {
    type: 'EXTRACT_COMPLETE';
    style: StyleFingerprint;
} | {
    type: 'EXTRACT_ERROR';
    error: string;
} | {
    type: 'START_COMPARE';
    styleIds: string[];
} | {
    type: 'UPDATE_SIMILARITY';
    matrix: Record<string, Record<string, number>>;
} | {
    type: 'STOP_COMPARE';
} | {
    type: 'MERGE_STYLES';
    styleIds: string[];
    name: string;
} | {
    type: 'SET_SEARCH';
    query: string;
} | {
    type: 'SET_TAG_FILTER';
    tags: string[];
} | {
    type: 'CLEAR_ERROR';
} | {
    type: 'RESET';
};
/**
 * Pure state reducer for the style management panel.
 */
export declare function stylePanelReducer(state: StylePanelState, action: StylePanelAction): StylePanelState;
/** Filter styles by search query and tag filter */
export declare function filterStyles(styles: StyleFingerprint[], searchQuery: string, tagFilter: string[]): StyleFingerprint[];
/** Get all unique tags across all styles */
export declare function getAllTags(styles: StyleFingerprint[]): string[];
/** Format style summary for display */
export declare function formatStyleSummary(style: StyleFingerprint): string;
/** Get style comparison summary text */
export declare function formatComparisonSummary(styles: StyleFingerprint[], matrix: Record<string, Record<string, number>>): string;
//# sourceMappingURL=style-panel.d.ts.map