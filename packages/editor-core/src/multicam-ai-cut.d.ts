/**
 * AI multi-camera best-shot switching recommendation.
 *
 * Local feature extraction: for each 1-second window compute per-angle
 *   audio RMS (active-speaker proxy) and frame-diff motion amplitude.
 * The features are sent to an AI provider as a compact JSON payload
 *   (no raw video), and the response is parsed into cut suggestions.
 * A local post-processing step enforces a minimum 1.5 s gap between
 *   consecutive cuts (merging too-close suggestions, keeping the one
 *   with higher confidence).
 */
export interface MulticamAngleFeature {
    angleId: string;
    audioRMS: number;
    motionScore: number;
}
export interface MulticamWindowFeature {
    time: number;
    angles: MulticamAngleFeature[];
}
export interface MulticamFeaturePayload {
    windows: MulticamWindowFeature[];
}
export interface MulticamCutSuggestion {
    time: number;
    angleId: string;
    confidence: number;
    reason: string;
}
export interface MulticamAiCutResponse {
    cuts: Array<{
        time: number;
        angleId: string;
        reason?: string;
        confidence?: number;
    }>;
}
/**
 * Calculate RMS (root-mean-square) of a PCM sample buffer.
 * Returns a value in [0, 1] assuming samples are normalised.
 */
export declare function calculateAudioRMS(samples: ArrayLike<number>): number;
/**
 * Simple block-matching motion estimation between two luminance frames.
 * Frames are represented as flat arrays of normalised luminance [0,1]
 * with dimensions width x height.
 *
 * The image is divided into a gridSize x gridSize grid of blocks. For each block the
 * function searches a small neighbourhood (+-searchRadius pixels) in
 * the next frame using normalised cross-correlation (NCC) and picks
 * the displacement with the highest NCC score.
 *
 * Returns the mean displacement magnitude across all blocks.
 */
export declare function estimateFrameMotion(prevFrame: ArrayLike<number>, currFrame: ArrayLike<number>, width: number, height: number, gridSize?: number, searchRadius?: number): number;
export interface AngleAudioSamples {
    angleId: string;
    samples: number[];
    sampleRate: number;
}
export interface AngleMotionFrames {
    angleId: string;
    frames: number[][];
    width: number;
    height: number;
}
/**
 * Build the feature payload to be sent to the AI provider.
 * windowSeconds divides the duration into non-overlapping windows.
 * For each window, per-angle audio RMS and motion amplitude are computed.
 */
export declare function buildMulticamFeaturePayload(duration: number, windowSeconds: number, audioData: AngleAudioSamples[], motionData: AngleMotionFrames[]): MulticamFeaturePayload;
export declare function buildMulticamCutSystemPrompt(): string;
export declare function buildMulticamCutUserPrompt(payload: MulticamFeaturePayload): string;
export declare function parseMulticamCutResponse(json: unknown): MulticamCutSuggestion[];
export declare const DEFAULT_MIN_SWITCH_INTERVAL = 1.5;
/**
 * Enforce a minimum time gap between consecutive cut suggestions.
 * When two suggestions are closer than minInterval, the one with
 * lower confidence is dropped. Ties are broken by keeping the earlier
 * suggestion.
 */
export declare function enforceMinimumSwitchInterval(suggestions: MulticamCutSuggestion[], minInterval?: number): MulticamCutSuggestion[];
export declare function validateCutAngles(suggestions: MulticamCutSuggestion[], validAngleIds: string[]): MulticamCutSuggestion[];
//# sourceMappingURL=multicam-ai-cut.d.ts.map