/**
 * AI scene detection algorithm.
 *
 * Detects scene boundaries in video clips using color histogram
 * difference analysis, motion vector estimation, and adaptive thresholds.
 * All functions are pure with no side effects.
 */

import type { ContentAnalysisVisualSample, ContentSceneType } from './content-analysis';
import { clamp01 } from './utils/math';

// --- Types ---

/** Configuration options for scene detection. */
export interface SceneDetectionOptions {
  /** Histogram difference threshold base (default 0.35). */
  histogramThreshold?: number;
  /** Motion intensity threshold base (default 0.55). */
  motionThreshold?: number;
  /** Minimum scene duration in seconds (default 0.5). */
  minSceneDuration?: number;
  /** Histogram bin count per HSV channel (default 8). */
  histogramBins?: number;
  /** Weight of histogram difference in combined score (default 0.6). */
  histogramWeight?: number;
  /** Weight of motion change in combined score (default 0.4). */
  motionWeight?: number;
  /** Adaptive threshold sensitivity factor (default 1.0). */
  adaptiveSensitivity?: number;
}

/** A detected scene boundary point. */
export interface SceneBoundary {
  /** Time of the scene boundary in seconds. */
  time: number;
  /** Combined detection score at this boundary (0.0 ~ 1.0). */
  score: number;
  /** HSV histogram difference score (0.0 ~ 1.0). */
  histogramDiff: number;
  /** Motion vector change score (0.0 ~ 1.0). */
  motionDiff: number;
  /** Adaptive threshold used at this boundary (0.0 ~ 1.0). */
  threshold: number;
}

/** Result of scene detection over a sequence of samples. */
export interface SceneDetectionResult {
  /** Detected scene boundaries. */
  boundaries: SceneBoundary[];
  /** Scene segments derived from boundaries. */
  segments: Array<{
    start: number;
    end: number;
    sceneType: ContentSceneType;
    avgBrightness: number;
    avgMotion: number;
  }>;
  /** Adaptive threshold curve for debugging / visualization. */
  thresholdCurve: Array<{ time: number; threshold: number }>;
  /** Number of input samples processed. */
  sampleCount: number;
}

// --- Core detection ---

/**
 * Detect scene boundaries from visual samples.
 *
 * Uses a combination of HSV histogram difference analysis and motion vector
 * estimation with an adaptive threshold to identify scene transitions.
 *
 * @param samples - Visual samples extracted from video frames.
 * @param options - Optional detection configuration.
 * @returns Detection result with boundaries, segments, and diagnostics.
 */
export function detectScenes(
  samples: ContentAnalysisVisualSample[],
  options: SceneDetectionOptions = {},
): SceneDetectionResult {
  const {
    histogramThreshold = 0.35,
    motionThreshold = 0.55,
    minSceneDuration = 0.5,
    histogramBins = 8,
    histogramWeight = 0.6,
    motionWeight = 0.4,
    adaptiveSensitivity = 1.0,
  } = options;

  const sorted = [...samples].filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);

  if (sorted.length < 2) {
    return {
      boundaries: [],
      segments:
        sorted.length === 1
          ? [
              {
                start: sorted[0].time,
                end: sorted[0].time,
                sceneType: 'indoor',
                avgBrightness: round(sorted[0].brightness),
                avgMotion: round(sorted[0].motion),
              },
            ]
          : [],
      thresholdCurve: [],
      sampleCount: sorted.length,
    };
  }

  // Build synthetic HSV histograms from available sample data.
  const histograms = sorted.map((s) => buildSyntheticHistogram(s, histogramBins));

  // Compute per-pair scores.
  const pairScores: Array<{
    time: number;
    histogramDiff: number;
    motionDiff: number;
    combined: number;
  }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const hDiff = histogramDifference(histograms[i - 1], histograms[i]);
    const mDiff = motionChange(prev, curr);
    const combined = clamp01(hDiff * histogramWeight + mDiff * motionWeight);
    pairScores.push({
      time: curr.time,
      histogramDiff: round(hDiff),
      motionDiff: round(mDiff),
      combined: round(combined),
    });
  }

  // Compute adaptive thresholds using a sliding window of recent scores.
  const windowSize = Math.max(3, Math.min(10, Math.floor(sorted.length / 3)));
  const thresholdCurve: Array<{ time: number; threshold: number }> = [];
  const boundaries: SceneBoundary[] = [];
  let lastBoundaryTime = -Infinity;

  for (let i = 0; i < pairScores.length; i++) {
    const threshold = computeAdaptiveThreshold(
      pairScores,
      i,
      windowSize,
      histogramThreshold,
      motionThreshold,
      histogramWeight,
      motionWeight,
      adaptiveSensitivity,
    );
    const score = pairScores[i];
    thresholdCurve.push({ time: score.time, threshold: round(threshold) });

    const exceedsThreshold = score.combined > threshold;
    const respectsMinDuration = score.time - lastBoundaryTime >= minSceneDuration;

    if (exceedsThreshold && respectsMinDuration) {
      boundaries.push({
        time: round(score.time),
        score: score.combined,
        histogramDiff: score.histogramDiff,
        motionDiff: score.motionDiff,
        threshold: round(threshold),
      });
      lastBoundaryTime = score.time;
    }
  }

  // Build segments from boundaries.
  const segments = buildSegments(sorted, boundaries);

  return {
    boundaries,
    segments,
    thresholdCurve,
    sampleCount: sorted.length,
  };
}

// --- Histogram helpers ---

/**
 * Build a synthetic HSV histogram from a visual sample.
 *
 * Since we only have scalar brightness / saturation / motion values rather
 * than full pixel data, we construct a lightweight histogram approximation
 * that still allows meaningful difference calculations between frames.
 */
function buildSyntheticHistogram(sample: ContentAnalysisVisualSample, bins: number): Float32Array {
  const totalBins = bins * 3; // H, S, V channels
  const hist = new Float32Array(totalBins);
  const brightness = clamp01(sample.brightness);
  const saturation = clamp01(sample.saturation);
  const motion = clamp01(sample.motion);

  // Distribute brightness across V-channel bins with a gaussian-like shape.
  const vOffset = bins * 2;
  for (let b = 0; b < bins; b++) {
    const center = (b + 0.5) / bins;
    const dist = Math.abs(center - brightness);
    hist[vOffset + b] = Math.exp(-(dist * dist) * 18);
  }

  // Distribute saturation across S-channel bins.
  const sOffset = bins;
  for (let b = 0; b < bins; b++) {
    const center = (b + 0.5) / bins;
    const dist = Math.abs(center - saturation);
    hist[sOffset + b] = Math.exp(-(dist * dist) * 18);
  }

  // Hue channel uses motion as a proxy for scene complexity.
  for (let b = 0; b < bins; b++) {
    const center = (b + 0.5) / bins;
    const dist = Math.abs(center - (brightness * 0.6 + saturation * 0.4));
    hist[b] = Math.exp(-(dist * dist) * 12) * (1 - motion * 0.3);
  }

  // Normalize so the histogram sums to 1.
  let sum = 0;
  for (let i = 0; i < totalBins; i++) {
    sum += hist[i];
  }
  if (sum > 0) {
    for (let i = 0; i < totalBins; i++) {
      hist[i] /= sum;
    }
  }

  return hist;
}

/**
 * Compute the chi-squared distance between two histograms.
 * Returns a value clamped to [0, 1].
 */
function histogramDifference(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) {
    return 0;
  }
  let chiSq = 0;
  for (let i = 0; i < len; i++) {
    const sum = a[i] + b[i];
    if (sum > 0) {
      const diff = a[i] - b[i];
      chiSq += (diff * diff) / sum;
    }
  }
  // chi-squared distance is unbounded; normalize by sqrt to keep it in a usable range.
  return clamp01(Math.sqrt(chiSq) * 0.5);
}

// --- Motion helpers ---

/**
 * Estimate motion change between two adjacent frames using frame-difference.
 * Uses brightness and motion scalar changes as a proxy for pixel-level frame differencing.
 */
function motionChange(prev: ContentAnalysisVisualSample, curr: ContentAnalysisVisualSample): number {
  const brightnessDelta = Math.abs(clamp01(curr.brightness) - clamp01(prev.brightness));
  const motionDelta = Math.abs(clamp01(curr.motion) - clamp01(prev.motion));
  const saturationDelta = Math.abs(clamp01(curr.saturation) - clamp01(prev.saturation));
  // Combined motion intensity weighted toward direct motion measurement.
  return clamp01(brightnessDelta * 0.3 + motionDelta * 0.5 + saturationDelta * 0.2);
}

// --- Adaptive threshold ---

/**
 * Compute an adaptive threshold based on recent score history.
 *
 * The threshold adapts to the local content: in high-motion sequences the
 * threshold rises to avoid false positives; in quiet sequences it lowers
 * to catch subtle cuts.
 */
function computeAdaptiveThreshold(
  scores: Array<{ combined: number }>,
  index: number,
  windowSize: number,
  baseHistogramThreshold: number,
  baseMotionThreshold: number,
  histogramWeight: number,
  motionWeight: number,
  sensitivity: number,
): number {
  const windowStart = Math.max(0, index - windowSize);
  const windowEnd = Math.min(scores.length, index + 1);
  const windowSlice = scores.slice(windowStart, windowEnd);

  if (windowSlice.length === 0) {
    return clamp01((baseHistogramThreshold * histogramWeight + baseMotionThreshold * motionWeight) * sensitivity);
  }

  const meanScore = windowSlice.reduce((sum, s) => sum + s.combined, 0) / windowSlice.length;
  const variance = windowSlice.reduce((sum, s) => sum + (s.combined - meanScore) ** 2, 0) / windowSlice.length;
  const stddev = Math.sqrt(variance);

  // Base threshold from the weighted blend of the two base thresholds.
  const baseThreshold = baseHistogramThreshold * histogramWeight + baseMotionThreshold * motionWeight;

  // Raise threshold when the local neighborhood is noisy (high variance),
  // lower it when the neighborhood is stable.
  const adaptiveOffset = stddev * 1.5 - meanScore * 0.25;

  return clamp01((baseThreshold + adaptiveOffset) * clamp01(sensitivity));
}

// --- Segment builder ---

/**
 * Build scene segments from sorted samples and detected boundaries.
 */
function buildSegments(
  sorted: ContentAnalysisVisualSample[],
  boundaries: SceneBoundary[],
): Array<{
  start: number;
  end: number;
  sceneType: ContentSceneType;
  avgBrightness: number;
  avgMotion: number;
}> {
  if (sorted.length === 0) {
    return [];
  }

  const boundaryTimes = boundaries.map((b) => b.time);
  const segments: Array<{
    start: number;
    end: number;
    sceneType: ContentSceneType;
    avgBrightness: number;
    avgMotion: number;
  }> = [];

  let segStart = sorted[0].time;
  let segSamples: ContentAnalysisVisualSample[] = [];

  for (const sample of sorted) {
    const isBoundary = boundaryTimes.some((bt) => Math.abs(bt - sample.time) < 0.001);
    if (isBoundary && segSamples.length > 0) {
      segments.push(finalizeSegment(segStart, sample.time, segSamples));
      segStart = sample.time;
      segSamples = [];
    }
    segSamples.push(sample);
  }

  // Flush remaining samples.
  if (segSamples.length > 0) {
    const lastTime = sorted[sorted.length - 1].time;
    segments.push(finalizeSegment(segStart, lastTime, segSamples));
  }

  return segments;
}

/**
 * Finalize a single segment from its constituent samples.
 */
function finalizeSegment(
  start: number,
  end: number,
  samples: ContentAnalysisVisualSample[],
): {
  start: number;
  end: number;
  sceneType: ContentSceneType;
  avgBrightness: number;
  avgMotion: number;
} {
  const avgBrightness = round(average(samples.map((s) => clamp01(s.brightness))));
  const avgMotion = round(average(samples.map((s) => clamp01(s.motion))));
  const avgSaturation = round(average(samples.map((s) => clamp01(s.saturation))));

  let sceneType: ContentSceneType;
  if (avgBrightness < 0.28) {
    sceneType = 'night';
  } else if (avgMotion >= 0.58) {
    sceneType = 'action';
  } else if (avgBrightness >= 0.62 && avgSaturation >= 0.34) {
    sceneType = 'outdoor';
  } else {
    sceneType = 'indoor';
  }

  return {
    start: round(Math.max(0, start)),
    end: round(Math.max(0, end)),
    sceneType,
    avgBrightness,
    avgMotion,
  };
}

// --- Utility functions (replicated from content-analysis.ts for module independence) ---

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}
