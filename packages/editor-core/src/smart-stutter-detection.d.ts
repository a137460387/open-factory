/**
 * Stutter & Filler Detection for Smart Rough Cut
 *
 * Detects speech disfluencies: repeated syllables, filler words,
 * prolonged pauses mid-sentence, and abrupt pitch breaks.
 * Pure functions, no side effects.
 */
export type StutterType = 'repetition' | 'filler' | 'prolonged_pause' | 'pitch_break';
export interface StutterInterval {
    id: string;
    start: number;
    end: number;
    duration: number;
    type: StutterType;
    confidence: number;
    reason: string;
}
export interface StutterDetectionOptions {
    /** Minimum duration for a filler pause (seconds) */
    minFillerPauseDuration?: number;
    /** Minimum repetitions to count as stutter */
    minRepetitions?: number;
    /** Pitch variance threshold for pitch break detection */
    pitchBreakThreshold?: number;
    /** Minimum confidence to include */
    minConfidence?: number;
    /** Merge stutters within this gap (seconds) */
    mergeGap?: number;
}
export interface AudioFrameForStutter {
    time: number;
    duration: number;
    loudness: number;
    pitchHz?: number;
    zeroCrossingRate?: number;
    spectralCentroid?: number;
}
export interface WhisperSegmentForStutter {
    start: number;
    end: number;
    text: string;
}
export declare function detectStutters(frames: AudioFrameForStutter[], whisperSegments?: WhisperSegmentForStutter[], options?: StutterDetectionOptions): StutterInterval[];
export declare function buildRefinedCutIntervals(silenceRanges: Array<{
    start: number;
    end: number;
    duration: number;
}>, stutterIntervals: StutterInterval[], totalDuration: number, options?: {
    paddingBefore?: number;
    paddingAfter?: number;
    minSegmentDuration?: number;
}): Array<{
    start: number;
    end: number;
    duration: number;
}>;
export declare function estimateRefinedDuration(keepSegments: Array<{
    duration: number;
}>): number;
//# sourceMappingURL=smart-stutter-detection.d.ts.map