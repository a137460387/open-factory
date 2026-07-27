/**
 * LLM Suggestion Engine
 *
 * Extends the LLM orchestrator with a "suggestion mode" that proactively
 * generates multiple creative editing proposals based on:
 * - Current material semantic analysis
 * - User's style fingerprint library
 * - Platform/audience context
 *
 * Distinct from "editing mode": suggestions are non-binding proposals
 * for the user to browse, compare, and selectively apply.
 */
import type { MaterialMetadata } from './semantic-extractor';
import type { StyleFingerprint } from './style-analyzer';
import type { LLMMessage } from './llm-orchestrator';
/** Suggestion category */
export type SuggestionCategory = 'creative' | 'style-match' | 'platform' | 'efficiency' | 'experimentation';
/** A single editing suggestion */
export interface EditingSuggestion {
    id: string;
    /** Suggestion category */
    category: SuggestionCategory;
    /** Short title */
    title: string;
    /** Detailed description */
    description: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Creative rationale */
    rationale: string;
    /** Preview instructions (lightweight edit plan for preview) */
    previewInstructions: SuggestionInstruction[];
    /** Tags for filtering */
    tags: string[];
    /** Which style fingerprint was used (if any) */
    styleId?: string;
    /** User feedback score (set after review) */
    feedbackScore?: number;
    /** User feedback notes */
    feedbackNotes?: string;
}
/** A single instruction within a suggestion */
export interface SuggestionInstruction {
    action: string;
    target: {
        materialIndex?: number;
        startSec?: number;
        endSec?: number;
        trackIndex?: number;
    };
    params: Record<string, unknown>;
    reason: string;
}
/** Request for generating suggestions */
export interface SuggestionRequest {
    /** Material metadata to analyze */
    materials: MaterialMetadata[];
    /** User's style fingerprints to consider */
    styles: StyleFingerprint[];
    /** Target platform (if any) */
    platform?: string;
    /** User's natural language guidance */
    userGuidance?: string;
    /** Max suggestions to generate */
    maxSuggestions?: number;
    /** Preferred categories */
    categories?: SuggestionCategory[];
}
/** Response containing suggestions */
export interface SuggestionResponse {
    suggestions: EditingSuggestion[];
    /** Overall analysis notes from LLM */
    analysisNotes: string;
    /** Token usage */
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    /** Latency in ms */
    latencyMs: number;
}
/** Suggestion comparison view */
export interface SuggestionComparison {
    suggestions: EditingSuggestion[];
    /** Comparison matrix: which suggestion is better for which dimension */
    dimensions: Array<{
        name: string;
        description: string;
        scores: Record<string, number>;
    }>;
}
/**
 * Parse suggestion response from LLM JSON output.
 */
export declare function parseSuggestionResponse(jsonStr: string): SuggestionResponse | null;
/**
 * Build suggestion prompt messages for LLM.
 * Use this with your existing LLM client, then parse with parseSuggestionResponse().
 */
export declare function buildSuggestionMessages(request: SuggestionRequest): LLMMessage[];
/**
 * Apply a style fingerprint to suggestion instructions.
 * Enriches instructions with style-specific parameters.
 */
export declare function enrichSuggestionWithStyle(suggestion: EditingSuggestion, style: StyleFingerprint, strength?: number): EditingSuggestion;
/**
 * Generate a comparison matrix for a set of suggestions.
 */
export declare function generateComparison(suggestions: EditingSuggestion[]): SuggestionComparison;
/**
 * Record user feedback on a suggestion.
 */
export declare function recordFeedback(suggestion: EditingSuggestion, score: number, notes?: string): EditingSuggestion;
/**
 * Filter suggestions by category, confidence threshold, or tags.
 */
export declare function filterSuggestions(suggestions: EditingSuggestion[], filters: {
    categories?: SuggestionCategory[];
    minConfidence?: number;
    tags?: string[];
}): EditingSuggestion[];
/**
 * Rank suggestions by weighted score combining confidence, category preference, and feedback.
 */
export declare function rankSuggestions(suggestions: EditingSuggestion[], weights?: {
    confidence?: number;
    categoryPreference?: Partial<Record<SuggestionCategory, number>>;
    feedbackWeight?: number;
}): EditingSuggestion[];
//# sourceMappingURL=suggestion-engine.d.ts.map