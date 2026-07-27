/**
 * AI Scene Tagger
 *
 * Analyzes media assets and generates semantic tags based on
 * content analysis results. Uses local AI analysis data (brightness,
 * motion, scene types, dialogue detection) — no external API calls.
 */
import type { MediaAsset, MediaMetadata } from './model-types';
import type { ClipContentAnalysis } from './content-analysis';
export interface SceneTag {
    tag: string;
    confidence: number;
    source: 'ai-analysis' | 'content-heuristic' | 'audio-analysis';
}
export interface MediaTagSuggestion {
    mediaId: string;
    tags: SceneTag[];
    analyzedAt: string;
}
export interface AutoTagOptions {
    /** Minimum confidence to include a tag */
    minConfidence?: number;
    /** Maximum number of tags per asset */
    maxTagsPerAsset?: number;
    /** Whether to include content analysis scene types */
    includeSceneTypes?: boolean;
    /** Whether to generate mood tags from brightness/emotion */
    includeMoodTags?: boolean;
    /** Whether to generate audio tags */
    includeAudioTags?: boolean;
}
export declare function generateAutoTags(asset: MediaAsset, contentAnalysis?: ClipContentAnalysis, options?: AutoTagOptions): MediaTagSuggestion;
export declare function generateAutoTagsBatch(assets: MediaAsset[], metadata: Record<string, MediaMetadata>, contentAnalyses: Record<string, ClipContentAnalysis>, options?: AutoTagOptions): MediaTagSuggestion[];
export declare function mergeAutoTagsWithExisting(existing: string[], autoTags: SceneTag[]): string[];
export declare function getTagsByCategory(tags: SceneTag[]): Record<string, SceneTag[]>;
//# sourceMappingURL=ai-scene-tagger.d.ts.map