/**
 * AI camera shake stability analysis (local-only, no external AI calls).
 *
 * Samples frames at ~1 fps, uses simple block-matching to estimate
 * per-frame displacement vectors, then computes shake score as the
 * normalised variance of those vectors (0-100 scale).
 */
export type ShakeSeverity = 'low' | 'medium' | 'high';
export interface ShakeAnalysisResult {
    /** 0-100 normalised shake score (variance of displacement vectors) */
    shakeScore: number;
    /** Severity bucket: <20 low, 20-50 medium, >50 high */
    severity: ShakeSeverity;
    /** Suggested FFmpeg filter to reduce shake */
    suggestedFilter: 'vidstab' | 'none';
}
export interface TwoStepVidstabArgs {
    /** Args for the vidstabdetect pass */
    detectArgs: string[];
    /** Args for the vidstabtransform pass */
    transformArgs: string[];
}
/**
 * Compute per-frame displacement vectors from an array of sampled
 * luminance frames (each frame is a flat array of [0,1] values,
 * width x height).
 *
 * Re-uses the block-matching logic from multicam-ai-cut but
 * returns the full per-pair displacement vector instead of a scalar.
 */
export declare function estimateDisplacementVectors(frames: ArrayLike<number>[], width: number, height: number, gridSize?: number, searchRadius?: number): Array<{
    dx: number;
    dy: number;
}>;
/**
 * Compute shake score from displacement vectors.
 * Score = normalised variance of displacement magnitudes, scaled 0-100.
 */
export declare function calculateShakeScore(displacementVectors: Array<{
    dx: number;
    dy: number;
}>, maxExpectedVariance?: number): number;
/**
 * Classify shake severity from score.
 * <20 = low, 20-50 = medium, >50 = high.
 */
export declare function classifyShakeSeverity(score: number): ShakeSeverity;
/**
 * Run full shake analysis on sampled luminance frames.
 */
export declare function analyseShake(frames: ArrayLike<number>[], width: number, height: number, maxExpectedVariance?: number): ShakeAnalysisResult;
/**
 * Build the two-step FFmpeg arguments for vidstab stabilisation.
 * Pass 1: vidstabdetect → generates a .trf transform file.
 * Pass 2: vidstabtransform → applies the stabilisation.
 */
export declare function buildTwoStepVidstabArgs(inputPath: string, trfPath: string, smoothing?: number, zoom?: number): TwoStepVidstabArgs;
//# sourceMappingURL=shake-analysis.d.ts.map