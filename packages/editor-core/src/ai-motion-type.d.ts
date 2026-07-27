/**
 * AI camera motion type recognition (local-only, no external AI calls).
 *
 * Samples frames at ~5 fps, uses block-matching (shared with shake-analysis)
 * to estimate per-frame displacement vectors, then classifies motion type
 * based on vector direction consistency, magnitude, and corner divergence.
 */
import type { AiModuleResult, TranslateFn } from './ai-module-types';
export type MotionType = 'static' | 'pan' | 'tilt' | 'zoom_in' | 'zoom_out' | 'handheld';
export interface ClipMotionType {
    type: MotionType;
    confidence: number;
    analyzedAt: string;
}
export interface MotionVectorField {
    vectors: Array<{
        dx: number;
        dy: number;
    }>;
    blockVectors?: Array<Array<{
        dx: number;
        dy: number;
    }>>;
}
export declare const STATIC_MAGNITUDE_THRESHOLD = 1.5;
export declare const DIRECTION_CONSISTENCY_THRESHOLD = 0.7;
export declare const HANDHELD_DIRECTION_CHANGE_THRESHOLD = 0.4;
export declare const ZOOM_CORNER_DIVERGENCE_THRESHOLD = 0.3;
export declare const ZOOM_CENTER_LESS_THAN_CORNER_RATIO = 0.6;
export declare function computeMotionVectorField(frames: ArrayLike<number>[], width: number, height: number, gridSize?: number, searchRadius?: number): MotionVectorField;
export declare function classifyMotionType(vectors: Array<{
    dx: number;
    dy: number;
}>, blockVectors?: Array<Array<{
    dx: number;
    dy: number;
}>>, gridSize?: number): ClipMotionType;
export declare function analyzeMotionType(frames: ArrayLike<number>[], width: number, height: number, gridSize?: number, searchRadius?: number): {
    motionType: ClipMotionType;
    vectorField: MotionVectorField;
};
export declare function buildSharedMotionData(vectors: Array<{
    dx: number;
    dy: number;
}>): {
    shakeVectors: Array<{
        dx: number;
        dy: number;
    }>;
    meanMagnitude: number;
    variance: number;
};
export declare function filterMediaByMotionType(media: Array<{
    id: string;
    motionType?: ClipMotionType;
}>, filterType: MotionType): Array<{
    id: string;
    motionType?: ClipMotionType;
}>;
export interface DirectionStats {
    horizontalRatio: number;
    verticalRatio: number;
    dominantAxisConfidence: number;
    changeRatio: number;
}
export declare function analyzeDirectionConsistency(vectors: Array<{
    dx: number;
    dy: number;
}>): DirectionStats;
export declare function analyzeMotionTypeSafe(frames: ArrayLike<number>[], width: number, height: number, gridSize?: number, searchRadius?: number, t?: TranslateFn): Promise<AiModuleResult<{
    motionType: ClipMotionType;
    vectorField: MotionVectorField;
}>>;
//# sourceMappingURL=ai-motion-type.d.ts.map