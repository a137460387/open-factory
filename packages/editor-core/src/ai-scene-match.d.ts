import type { AiModuleResult, TranslateFn } from './ai-module-types';
export declare const SCENE_MATCH_MAX_SIMILAR = 3;
export declare const SCENE_MATCH_MAX_CONTRAST = 3;
export interface SceneMatchMediaItem {
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
export interface SceneMatchClipContext {
    clipId: string;
    clipName: string;
    clipType: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
    prevScene?: string;
    nextScene?: string;
}
export interface SceneMatchResult {
    mediaId: string;
    score: number;
    reason: string;
}
export interface SceneMatchResponse {
    similar: SceneMatchResult[];
    contrast: SceneMatchResult[];
}
export interface SceneMatchDragParams {
    mediaId: string;
    name: string;
    type: string;
    path: string;
    duration: number;
    width: number;
    height: number;
}
/**
 * Build the context for scene match analysis from the selected clip and its timeline neighbors.
 */
export declare function buildSceneMatchContext(clip: {
    id: string;
    name: string;
    type: string;
    mediaId?: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}, timelineClips: Array<{
    id: string;
    start: number;
    mediaId?: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}>, media: Array<{
    id: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}>): SceneMatchClipContext;
/**
 * Build media pool payload for scene match. Only includes items with aiAnalysis when library is large.
 */
export declare function buildSceneMatchMediaPayload(media: Array<{
    id: string;
    name: string;
    type: string;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
}>, largeLibraryThreshold?: number): SceneMatchMediaItem[];
export declare function buildSceneMatchSystemPrompt(): string;
export declare function buildSceneMatchUserPrompt(context: SceneMatchClipContext, mediaItems: SceneMatchMediaItem[]): string;
export declare function parseSceneMatchResponse(json: unknown): SceneMatchResponse;
/**
 * Build drag parameters for adding a recommended media asset to the timeline.
 */
export declare function buildSceneMatchDragParams(asset: {
    id: string;
    name: string;
    type: string;
    path: string;
    duration: number;
    width: number;
    height: number;
}): SceneMatchDragParams;
/**
 * Identify media items without aiAnalysis that are not in the result set (for fallback messaging).
 */
export declare function getUnanalyzedMediaIdsForSceneMatch(allMedia: Array<{
    id: string;
    aiAnalysis?: unknown;
}>, resultIds: Set<string>): string[];
export declare function parseSceneMatchResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<SceneMatchResponse>>;
//# sourceMappingURL=ai-scene-match.d.ts.map