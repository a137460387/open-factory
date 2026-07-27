/**
 * AI platform duration fit suggestion (local greedy algorithm).
 *
 * Given a list of clips with importance scores and a target platform
 * duration limit, greedily selects the highest-scoring clips that
 * fit within the limit, preserving original time order.
 * Optionally snaps cut points to scene-change boundaries.
 */
import type { PlatformFitSegment } from './model-types';
export type PlatformFitTarget = 'tiktok' | 'reels' | 'shorts' | 'custom';
export interface PlatformFitSuggestion {
    targetPlatform: PlatformFitTarget;
    limitSeconds: number;
    keptSegments: PlatformFitSegment[];
    removedSegments: PlatformFitSegment[];
}
export interface ClipWithDurationAndScore {
    clipId: string;
    start: number;
    end: number;
    score?: number;
}
export declare const PLATFORM_LIMITS: Record<Exclude<PlatformFitTarget, 'custom'>, number>;
/**
 * Calculate clip importance score, using AI highlight score if available
 * or falling back to the provided median default.
 */
export declare function calculateClipImportance(clip: ClipWithDurationAndScore, defaultScore?: number): number;
/**
 * Snap a time value to the nearest scene-change boundary within
 * the given tolerance.
 */
export declare function snapToSceneChange(time: number, sceneChangeTimes: readonly number[], tolerance?: number): number;
/**
 * Generate a platform duration fit suggestion.
 *
 * 1. Score each clip by importance.
 * 2. Sort by score descending and greedily select until duration limit.
 * 3. Re-sort selected clips by original time order.
 * 4. Optionally snap start/end to scene-change boundaries.
 */
export declare function generatePlatformFitSuggestion(clips: ClipWithDurationAndScore[], limitSeconds: number, sceneChangeTimes?: readonly number[], snapTolerance?: number): PlatformFitSuggestion;
//# sourceMappingURL=platform-fit.d.ts.map