import type { AiModuleResult, TranslateFn } from './ai-module-types';
export declare const SEMANTIC_SEARCH_HISTORY_LIMIT = 10;
export declare const SEMANTIC_SEARCH_LARGE_LIBRARY_THRESHOLD = 200;
export declare const SEMANTIC_SEARCH_MAX_RESULTS = 20;
export interface SemanticSearchMediaItem {
    mediaId: string;
    name: string;
    type: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}
export interface SemanticSearchResult {
    mediaId: string;
    score: number;
    reason: string;
}
export interface SemanticSearchResponse {
    results: SemanticSearchResult[];
}
export interface SemanticSearchHistoryEntry {
    query: string;
    timestamp: number;
    resultCount: number;
}
/**
 * Build the media payload for semantic search.
 * When media count > threshold, only include items that have aiAnalysis.
 * For items without aiAnalysis, use filename as fallback info.
 */
export declare function buildSemanticSearchMediaPayload(media: Array<{
    id: string;
    name: string;
    type: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}>, largeLibraryThreshold?: number): SemanticSearchMediaItem[];
export declare function buildSemanticSearchSystemPrompt(): string;
export declare function buildSemanticSearchUserPrompt(query: string, mediaItems: SemanticSearchMediaItem[]): string;
export declare function parseSemanticSearchResponse(json: unknown): SemanticSearchResult[];
/**
 * Identify media items that have no aiAnalysis (for "unanalyzed" grouping).
 */
export declare function getUnanalyzedMediaIds(allMedia: Array<{
    id: string;
    aiAnalysis?: unknown;
}>, resultIds: Set<string>): string[];
export declare function appendSemanticSearchHistory(history: readonly SemanticSearchHistoryEntry[], entry: SemanticSearchHistoryEntry, limit?: number): SemanticSearchHistoryEntry[];
export declare function sanitizeSemanticSearchHistory(input: unknown, limit?: number): SemanticSearchHistoryEntry[];
/**
 * Check if any text provider is configured (for graying out the AI search button).
 * The semantic search only needs a text-capable provider, not vision.
 */
export declare function hasAvailableTextProvider(providers: Array<{
    enabled: boolean;
    apiKey?: string;
    isBuiltIn: boolean;
    id: string;
}>): boolean;
export declare function parseSemanticSearchResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<SemanticSearchResult[]>>;
//# sourceMappingURL=ai-semantic-search.d.ts.map