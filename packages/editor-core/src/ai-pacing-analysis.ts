/**
 * AI pacing analysis (local-only, no external AI calls).
 *
 * Computes a cuts-per-minute (CPM) curve using a 30-second sliding window,
 * then classifies segments as slow (<60% of avg) or fast (>180% of avg).
 */

import type { CpmCurvePoint, PacingSegment, PacingAnalysis } from './model-types';

/** Default sliding window size in seconds */
export const DEFAULT_WINDOW_SECONDS = 30;

/** Step size between CPM samples (seconds) */
export const DEFAULT_STEP_SECONDS = 5;

/** Slow threshold: CPM below this fraction of overall average */
export const SLOW_THRESHOLD_RATIO = 0.6;

/** Fast threshold: CPM above this fraction of overall average */
export const FAST_THRESHOLD_RATIO = 1.8;

/** Minimum segment duration to report (seconds) */
export const MIN_SEGMENT_DURATION = 20;

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
export function calculateCpmCurve(
  cuts: number[],
  totalDuration: number,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  stepSeconds = DEFAULT_STEP_SECONDS
): CpmCurvePoint[] {
  if (totalDuration <= 0 || cuts.length === 0) return [];

  const curve: CpmCurvePoint[] = [];
  for (let t = 0; t <= totalDuration - windowSeconds / 2; t += stepSeconds) {
    const windowStart = t;
    const windowEnd = t + windowSeconds;
    const count = cuts.filter((c) => c >= windowStart && c < windowEnd).length;
    const cpm = (count / windowSeconds) * 60;
    curve.push({ time: t, cpm });
  }
  return curve;
}

/**
 * Calculate the overall average CPM from the full timeline.
 */
export function calculateOverallAvgCPM(
  cuts: number[],
  totalDuration: number
): number {
  if (totalDuration <= 0) return 0;
  return (cuts.length / totalDuration) * 60;
}

/**
 * Classify segments from the CPM curve as slow or fast.
 *
 * Slow: CPM < 60% of avg AND segment duration > 20s.
 * Fast: CPM > 180% of avg.
 */
export function classifyPacingSegments(
  curve: CpmCurvePoint[],
  avgCPM: number
): { slowSegments: PacingSegment[]; fastSegments: PacingSegment[] } {
  if (curve.length === 0 || avgCPM <= 0) {
    return { slowSegments: [], fastSegments: [] };
  }

  const slowThreshold = avgCPM * SLOW_THRESHOLD_RATIO;
  const fastThreshold = avgCPM * FAST_THRESHOLD_RATIO;

  const slowSegments = mergeContiguousSegments(curve, slowThreshold, 'below');
  const fastSegments = mergeContiguousSegments(curve, fastThreshold, 'above');

  return {
    slowSegments: slowSegments.filter((s) => (s.end - s.start) >= MIN_SEGMENT_DURATION),
    fastSegments
  };
}

function mergeContiguousSegments(
  curve: CpmCurvePoint[],
  threshold: number,
  direction: 'below' | 'above'
): PacingSegment[] {
  const segments: PacingSegment[] = [];
  let segStart: number | null = null;

  for (let i = 0; i < curve.length; i += 1) {
    const qualifies = direction === 'below'
      ? curve[i].cpm < threshold
      : curve[i].cpm > threshold;

    if (qualifies) {
      if (segStart === null) segStart = curve[i].time;
    } else if (segStart !== null) {
      segments.push({ start: segStart, end: curve[i].time });
      segStart = null;
    }
  }
  if (segStart !== null && curve.length > 0) {
    segments.push({ start: segStart, end: curve[curve.length - 1].time });
  }
  return segments;
}

/**
 * Run full pacing analysis on a timeline.
 *
 * @param clipStarts  Sorted array of clip start times (each start = a cut).
 * @param totalDuration  Total timeline duration.
 */
export function analyzePacing(
  clipStarts: number[],
  totalDuration: number,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  stepSeconds = DEFAULT_STEP_SECONDS
): PacingAnalysis {
  const cpmCurve = calculateCpmCurve(clipStarts, totalDuration, windowSeconds, stepSeconds);
  const overallAvgCPM = calculateOverallAvgCPM(clipStarts, totalDuration);
  const { slowSegments, fastSegments } = classifyPacingSegments(cpmCurve, overallAvgCPM);

  return { cpmCurve, slowSegments, fastSegments, overallAvgCPM };
}
