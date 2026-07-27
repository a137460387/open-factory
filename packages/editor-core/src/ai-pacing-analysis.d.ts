/**
 * AI pacing analysis (local-only, no external AI calls).
 *
 * Computes a cuts-per-minute (CPM) curve using a 30-second sliding window,
 * then classifies segments as slow (<60% of avg) or fast (>180% of avg).
 */
import type { CpmCurvePoint, PacingSegment, PacingAnalysis } from './model-types';
/** Default sliding window size in seconds */
export declare const DEFAULT_WINDOW_SECONDS = 30;
/** Step size between CPM samples (seconds) */
export declare const DEFAULT_STEP_SECONDS = 5;
/** Slow threshold: CPM below this fraction of overall average */
export declare const SLOW_THRESHOLD_RATIO = 0.6;
/** Fast threshold: CPM above this fraction of overall average */
export declare const FAST_THRESHOLD_RATIO = 1.8;
/** Minimum segment duration to report (seconds) */
export declare const MIN_SEGMENT_DURATION = 20;
export interface ClipCutPoint {
    /** Clip start time (seconds) — each clip start is a "cut" */
    time: number;
}
/**
 * Calculate the CPM curve using a sliding window over cut points.
 *
 * @param cuts  Sorted array of cut times (seconds). Each clip boundary counts.
 * @param totalDuration  Total timeline duration (seconds).
 * @param windowSeconds  Sliding window size (default 30s).
 * @param stepSeconds  Step between samples (default 5s).
 */
export declare function calculateCpmCurve(cuts: number[], totalDuration: number, windowSeconds?: number, stepSeconds?: number): CpmCurvePoint[];
/**
 * Calculate the overall average CPM from the full timeline.
 */
export declare function calculateOverallAvgCPM(cuts: number[], totalDuration: number): number;
/**
 * Classify segments from the CPM curve as slow or fast.
 *
 * Slow: CPM < 60% of avg AND segment duration > 20s.
 * Fast: CPM > 180% of avg.
 */
export declare function classifyPacingSegments(curve: CpmCurvePoint[], avgCPM: number): {
    slowSegments: PacingSegment[];
    fastSegments: PacingSegment[];
};
/**
 * Run full pacing analysis on a timeline.
 *
 * @param clipStarts  Sorted array of clip start times (each start = a cut).
 * @param totalDuration  Total timeline duration.
 */
export declare function analyzePacing(clipStarts: number[], totalDuration: number, windowSeconds?: number, stepSeconds?: number): PacingAnalysis;
//# sourceMappingURL=ai-pacing-analysis.d.ts.map