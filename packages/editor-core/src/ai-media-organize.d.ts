import type { MediaCollection } from './model-types';
export interface AIMediaOrganizeSuggestion {
    name: string;
    mediaIds: string[];
    reason: string;
}
export interface AIMediaOrganizeResponse {
    collections: AIMediaOrganizeSuggestion[];
}
export declare function buildMediaTagPrompt(media: Array<{
    id: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
    };
}>): string;
export declare function parseAIMediaOrganizeResponse(json: unknown): AIMediaOrganizeResponse;
export declare function buildMediaCollectionsFromAI(suggestions: AIMediaOrganizeSuggestion[], existingCollections?: MediaCollection[]): MediaCollection[];
export declare function mergeCollectionsWithExisting(aiCollections: MediaCollection[], existingCollections: MediaCollection[]): MediaCollection[];
export declare function filterAlreadyCategorizedMedia(media: Array<{
    id: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
    };
}>, existingCollections: MediaCollection[]): Array<{
    id: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
    };
}>;
//# sourceMappingURL=ai-media-organize.d.ts.map