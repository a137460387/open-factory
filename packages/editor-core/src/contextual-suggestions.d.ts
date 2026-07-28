/**
 * Contextual Suggestions Engine
 *
 * Analyzes the current timeline state and media content to generate
 * context-aware operation suggestions displayed as smart bubbles.
 *
 * Suggestion categories:
 * - Editing suggestions (transitions, cuts, pacing)
 * - Content suggestions (B-roll, effects, color)
 * - Technical suggestions (resolution, audio levels)
 * - Creative suggestions (style, mood, rhythm)
 */
import type { Timeline, Clip, MediaAsset } from './model-types';
export type SuggestionCategory = 'editing' | 'content' | 'technical' | 'creative';
export type SuggestionPriority = 'high' | 'medium' | 'low';
export interface ContextualSuggestion {
    /** Unique suggestion ID */
    id: string;
    /** Category */
    category: SuggestionCategory;
    /** Priority */
    priority: SuggestionPriority;
    /** Display title */
    title: string;
    /** Detailed description */
    description: string;
    /** Icon hint for UI */
    icon: string;
    /** Action type to execute */
    actionType: string;
    /** Action parameters */
    actionParams: Record<string, unknown>;
    /** Confidence 0-1 */
    confidence: number;
    /** Time relevance (seconds, -1 if not time-specific) */
    timeRelevance: number;
    /** Expiry timestamp (ms since epoch) */
    expiresAt: number;
}
export interface TimelineContext {
    /** Current playback time */
    currentTime: number;
    /** Selected clip IDs */
    selectedClipIds: string[];
    /** Zoom level */
    zoomLevel: number;
    /** Is playing */
    isPlaying: boolean;
    /** Active track ID */
    activeTrackId?: string;
    /** Recent actions (last N) */
    recentActions: string[];
}
export interface SuggestionConfig {
    /** Maximum suggestions to show */
    maxSuggestions: number;
    /** Minimum confidence threshold */
    minConfidence: number;
    /** Enable creative suggestions */
    enableCreative: boolean;
    /** Enable technical suggestions */
    enableTechnical: boolean;
    /** Suggestion expiry (ms) */
    expiryMs: number;
    /** Debounce interval (ms) */
    debounceMs: number;
}
export declare const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig;
/**
 * Detect if a transition would improve the cut between two clips.
 */
export declare function suggestTransition(prevClip: Clip | null, nextClip: Clip | null, currentTime: number): ContextualSuggestion | null;
/**
 * Detect pacing issues (too fast or too slow).
 */
export declare function suggestPacingFix(timeline: Timeline, currentTime: number): ContextualSuggestion | null;
/**
 * Suggest audio level adjustments based on analysis.
 */
export declare function suggestAudioFix(timeline: Timeline, currentTime: number): ContextualSuggestion | null;
/**
 * Suggest content improvements based on clip analysis.
 */
export declare function suggestContentImprovement(clip: Clip, media: MediaAsset[], currentTime: number): ContextualSuggestion | null;
/**
 * Suggest highlight marking for high-energy moments.
 */
export declare function suggestHighlightMark(clip: Clip, currentTime: number): ContextualSuggestion | null;
/**
 * Generate contextual suggestions based on current timeline state.
 */
export declare function generateContextualSuggestions(timeline: Timeline, media: MediaAsset[], context: TimelineContext, config?: Partial<SuggestionConfig>): ContextualSuggestion[];
/**
 * Get contextual suggestion icon SVG path.
 */
export declare function getSuggestionIcon(category: SuggestionCategory): string;
//# sourceMappingURL=contextual-suggestions.d.ts.map