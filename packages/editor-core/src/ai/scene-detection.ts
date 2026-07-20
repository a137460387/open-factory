/**
 * AI-enhanced scene detection with CLIP embedding support.
 *
 * Extends the histogram-based scene detector with CLIP visual embedding
 * similarity analysis for more accurate scene boundary detection.
 * All functions are pure computation with no side effects.
 */

import type { ContentAnalysisVisualSample, ContentSceneType } from '../content-analysis';

// --- Types ---

/** CLIP embedding vector for a single frame. */
export interface CLIPFrameEmbedding {
  /** Timestamp in seconds. */
  time: number;
  /** Normalized embedding vector (typically 512 or 768 dimensions). */
  vector: Float32Array;
}

/** Configuration for CLIP-enhanced scene detection. */
export interface CLIPSceneDetectionOptions {
  /** Similarity threshold below which a scene break is detected (default 0.75). */
  similarityThreshold?: number;
  /** Minimum scene duration in seconds (default 0.5). */
  minSceneDuration?: number;
  /** Weight of CLIP similarity in combined score (default 0.6). */
  clipWeight?: number;
  /** Weight of histogram difference in combined score (default 0.3). */
  histogramWeight?: number;
  /** Weight of motion change in combined score (default 0.1). */
  motionWeight?: number;
  /** Adaptive threshold window size (default 5). */
  windowSize?: number;
  /** Sensitivity factor for adaptive threshold (default 1.0). */
  sensitivity?: number;
}

/** A scene boundary detected by CLIP-enhanced analysis. */
export interface CLIPSceneBoundary {
  /** Time of the boundary in seconds. */
  time: number;
  /** Overall confidence score (0.0 ~ 1.0). */
  confidence: number;
  /** CLIP cosine similarity at this point (0.0 ~ 1.0). */
  clipSimilarity: number;
  /** Histogram difference score (0.0 ~ 1.0). */
  histogramDiff: number;
  /** Motion change score (0.0 ~ 1.0). */
  motionDiff: number;
  /** Adaptive threshold used. */
  threshold: number;
}

/** A scene segment with classification. */
export interface CLIPSceneSegment {
  /** Segment start time in seconds. */
  start: number;
  /** Segment end time in seconds. */
  end: number;
  /** Classified scene type. */
  sceneType: ContentSceneType;
  /** Average CLIP embedding for the segment (for similarity search). */
  avgEmbedding?: Float32Array;
  /** Average brightness. */
  avgBrightness: number;
  /** Average motion. */
  avgMotion: number;
  /** Segment confidence (0.0 ~ 1.0). */
  confidence: number;
}

/** Result of CLIP-enhanced scene detection. */
export interface CLIPSceneDetectionResult {
  /** Detected scene boundaries. */
  boundaries: CLIPSceneBoundary[];
  /** Scene segments. */
  segments: CLIPSceneSegment[];
  /** Confidence curve for visualization. */
  confidenceCurve: Array<{ time: number; confidence: number }>;
  /** Number of frames processed. */
  frameCount: number;
}

/** Boundary refinement adjustment. */
export interface BoundaryRefinement {
  /** Original boundary time. */
  originalTime: number;
  /** Refined boundary time. */
  refinedTime: number;
  /** Refinement confidence (0.0 ~ 1.0). */
  confidence: number;
  /** Reason for refinement. */
  reason: 'snap-to-motion' | 'snap-to-audio' | 'merge-close' | 'split-long';
}

// --- Core detection ---

/**
 * Detect scene boundaries using CLIP embeddings combined with visual samples.
 *
 * @param embeddings - CLIP embeddings for video frames.
 * @param samples - Visual samples (brightness, motion, etc.).
 * @param options - Detection configuration.
 * @returns Detection result with boundaries and segments.
 */
export function detectScenesWithCLIP(
  embeddings: CLIPFrameEmbedding[],
  samples: ContentAnalysisVisualSample[],
  options: CLIPSceneDetectionOptions = {},
): CLIPSceneDetectionResult {
  const {
    similarityThreshold = 0.75,
    minSceneDuration = 0.5,
    clipWeight = 0.6,
    histogramWeight = 0.3,
    motionWeight = 0.1,
    windowSize = 5,
    sensitivity = 1.0,
  } = options;

  // Merge embeddings and samples by time alignment.
  const merged = mergeByTime(embeddings, samples);
  if (merged.length < 2) {
    return {
      boundaries: [],
      segments:
        merged.length === 1
          ? [
              {
                start: merged[0].time,
                end: merged[0].time,
                sceneType: 'indoor',
                avgBrightness: merged[0].brightness,
                avgMotion: merged[0].motion,
                confidence: 1.0,
              },
            ]
          : [],
      confidenceCurve: [],
      frameCount: merged.length,
    };
  }

  // Compute per-pair scores.
  const pairScores = computePairScores(merged, clipWeight, histogramWeight, motionWeight);

  // Adaptive threshold detection.
  const boundaries: CLIPSceneBoundary[] = [];
  const confidenceCurve: Array<{ time: number; confidence: number }> = [];
  let lastBoundaryTime = -Infinity;

  for (let i = 0; i < pairScores.length; i++) {
    const threshold = computeAdaptiveThreshold(pairScores, i, windowSize, similarityThreshold, sensitivity);
    const score = pairScores[i];
    confidenceCurve.push({ time: score.time, confidence: score.clipSimilarity });

    // Scene break = low similarity (high distance) + exceeds threshold.
    const sceneBreakScore = 1.0 - score.clipSimilarity;
    const exceedsThreshold = sceneBreakScore > threshold || score.combined > threshold;
    const respectsMinDuration = score.time - lastBoundaryTime >= minSceneDuration;

    if (exceedsThreshold && respectsMinDuration) {
      boundaries.push({
        time: round(score.time),
        confidence: round(sceneBreakScore),
        clipSimilarity: round(score.clipSimilarity),
        histogramDiff: round(score.histogramDiff),
        motionDiff: round(score.motionDiff),
        threshold: round(threshold),
      });
      lastBoundaryTime = score.time;
    }
  }

  // Build segments.
  const segments = buildCLIPSegments(merged, boundaries);

  return {
    boundaries,
    segments,
    confidenceCurve,
    frameCount: merged.length,
  };
}

/**
 * Refine detected boundaries by snapping to nearby motion peaks or audio events.
 *
 * @param boundaries - Detected boundaries.
 * @param samples - Visual samples for motion analysis.
 * @param audioEvents - Optional audio event times (e.g., speech onset/offset).
 * @param maxSnapDistance - Maximum snap distance in seconds (default 0.2).
 * @returns Refinement list.
 */
export function refineBoundaries(
  boundaries: CLIPSceneBoundary[],
  samples: ContentAnalysisVisualSample[],
  audioEvents?: number[],
  maxSnapDistance = 0.2,
): BoundaryRefinement[] {
  const refinements: BoundaryRefinement[] = [];

  for (const boundary of boundaries) {
    // Find nearby motion peaks.
    const nearbySamples = samples.filter((s) => Math.abs(s.time - boundary.time) <= maxSnapDistance);

    if (nearbySamples.length === 0) {
      continue;
    }

    // Find the sample with highest motion change near the boundary.
    let bestSample = nearbySamples[0];
    let bestMotionDelta = 0;

    for (const sample of nearbySamples) {
      const prevSample = samples.find((s) => s.time < sample.time && Math.abs(s.time - sample.time) < 0.5);
      if (prevSample) {
        const delta = Math.abs(sample.motion - prevSample.motion);
        if (delta > bestMotionDelta) {
          bestMotionDelta = delta;
          bestSample = sample;
        }
      }
    }

    // Snap to motion peak if it's significantly different from boundary.
    if (Math.abs(bestSample.time - boundary.time) > 0.05 && bestMotionDelta > 0.2) {
      refinements.push({
        originalTime: boundary.time,
        refinedTime: round(bestSample.time),
        confidence: round(Math.min(1, bestMotionDelta * 2)),
        reason: 'snap-to-motion',
      });
    }

    // Snap to nearest audio event if available.
    if (audioEvents && audioEvents.length > 0) {
      const nearestAudio = findNearest(audioEvents, boundary.time);
      if (nearestAudio !== null && Math.abs(nearestAudio - boundary.time) > 0.05) {
        const distance = Math.abs(nearestAudio - boundary.time);
        if (distance <= maxSnapDistance) {
          refinements.push({
            originalTime: boundary.time,
            refinedTime: round(nearestAudio),
            confidence: round(1 - distance / maxSnapDistance),
            reason: 'snap-to-audio',
          });
        }
      }
    }
  }

  // Merge close boundaries.
  const merged = mergeCloseRefinements(refinements, 0.3);
  return merged;
}

/**
 * Compute CLIP-based scene similarity for a pair of frames.
 * Returns cosine similarity (0.0 ~ 1.0).
 */
export function computeCLIPSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) {
    return 1.0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 1.0;
  }

  // Clamp to [0, 1] since embeddings are typically normalized.
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

/**
 * Find similar scenes across a video using CLIP embeddings.
 *
 * @param segments - Scene segments with average embeddings.
 * @param threshold - Similarity threshold (default 0.8).
 * @returns Groups of similar scene indices.
 */
export function findSimilarScenes(
  segments: CLIPSceneSegment[],
  threshold = 0.8,
): Array<{ indices: number[]; similarity: number }> {
  if (segments.length < 2) {
    return [];
  }

  const groups: Array<{ indices: number[]; similarity: number }> = [];
  const assigned = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (assigned.has(i) || !segments[i].avgEmbedding) {
      continue;
    }

    const group: number[] = [i];
    assigned.add(i);

    for (let j = i + 1; j < segments.length; j++) {
      if (assigned.has(j) || !segments[j].avgEmbedding) {
        continue;
      }

      const similarity = computeCLIPSimilarity(segments[i].avgEmbedding!, segments[j].avgEmbedding!);

      if (similarity >= threshold) {
        group.push(j);
        assigned.add(j);
      }
    }

    if (group.length > 1) {
      groups.push({
        indices: group,
        similarity: round(group.reduce((sum, idx) => sum + (segments[idx].confidence ?? 0), 0) / group.length),
      });
    }
  }

  return groups;
}

// --- Internal helpers ---

interface MergedFrame {
  time: number;
  brightness: number;
  saturation: number;
  motion: number;
  embedding?: Float32Array;
}

function mergeByTime(embeddings: CLIPFrameEmbedding[], samples: ContentAnalysisVisualSample[]): MergedFrame[] {
  const sortedSamples = [...samples].filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);

  const sortedEmbeddings = [...embeddings].filter((e) => Number.isFinite(e.time)).sort((a, b) => a.time - b.time);

  if (sortedEmbeddings.length === 0) {
    return sortedSamples.map((s) => ({
      time: s.time,
      brightness: s.brightness,
      saturation: s.saturation,
      motion: s.motion,
    }));
  }

  // Match each sample to its nearest embedding.
  return sortedSamples.map((sample) => {
    const nearest = findNearestEmbedding(sortedEmbeddings, sample.time);
    return {
      time: sample.time,
      brightness: sample.brightness,
      saturation: sample.saturation,
      motion: sample.motion,
      embedding: nearest?.vector,
    };
  });
}

function findNearestEmbedding(embeddings: CLIPFrameEmbedding[], time: number): CLIPFrameEmbedding | null {
  if (embeddings.length === 0) {
    return null;
  }

  let best = embeddings[0];
  let bestDist = Math.abs(best.time - time);

  for (let i = 1; i < embeddings.length; i++) {
    const dist = Math.abs(embeddings[i].time - time);
    if (dist < bestDist) {
      bestDist = dist;
      best = embeddings[i];
    }
  }

  // Only use if within 1 second.
  return bestDist <= 1 ? best : null;
}

interface PairScore {
  time: number;
  clipSimilarity: number;
  histogramDiff: number;
  motionDiff: number;
  combined: number;
}

function computePairScores(
  frames: MergedFrame[],
  clipWeight: number,
  histogramWeight: number,
  motionWeight: number,
): PairScore[] {
  const scores: PairScore[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];

    // CLIP similarity.
    let clipSim = 1.0;
    if (prev.embedding && curr.embedding) {
      clipSim = computeCLIPSimilarity(prev.embedding, curr.embedding);
    }

    // Histogram difference (simplified from ai-scene-detector).
    const brightnessDiff = Math.abs(clamp01(curr.brightness) - clamp01(prev.brightness));
    const saturationDiff = Math.abs(clamp01(curr.saturation) - clamp01(prev.saturation));
    const histDiff = clamp01((brightnessDiff + saturationDiff) * 0.5);

    // Motion change.
    const motionDiff = Math.abs(clamp01(curr.motion) - clamp01(prev.motion));

    // Combined: lower similarity = higher scene break probability.
    const clipBreakScore = 1.0 - clipSim;
    const combined = clamp01(clipBreakScore * clipWeight + histDiff * histogramWeight + motionDiff * motionWeight);

    scores.push({
      time: curr.time,
      clipSimilarity: round(clipSim),
      histogramDiff: round(histDiff),
      motionDiff: round(motionDiff),
      combined: round(combined),
    });
  }

  return scores;
}

function computeAdaptiveThreshold(
  scores: PairScore[],
  index: number,
  windowSize: number,
  baseThreshold: number,
  sensitivity: number,
): number {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(scores.length, index + 1);
  const window = scores.slice(start, end);

  if (window.length === 0) {
    return baseThreshold * sensitivity;
  }

  const mean = window.reduce((sum, s) => sum + (1 - s.clipSimilarity), 0) / window.length;
  const variance =
    window.reduce((sum, s) => {
      const d = 1 - s.clipSimilarity - mean;
      return sum + d * d;
    }, 0) / window.length;
  const stddev = Math.sqrt(variance);

  // In noisy regions, raise threshold to avoid false positives.
  const adaptiveOffset = stddev * 1.2 - mean * 0.2;
  return clamp01((baseThreshold + adaptiveOffset) * clamp01(sensitivity));
}

function buildCLIPSegments(frames: MergedFrame[], boundaries: CLIPSceneBoundary[]): CLIPSceneSegment[] {
  if (frames.length === 0) {
    return [];
  }

  const boundaryTimes = new Set(boundaries.map((b) => round(b.time)));
  const segments: CLIPSceneSegment[] = [];
  let segStart = frames[0].time;
  let segFrames: MergedFrame[] = [];

  for (const frame of frames) {
    const isBoundary = boundaryTimes.has(round(frame.time));
    if (isBoundary && segFrames.length > 0) {
      segments.push(finalizeCLIPSegment(segStart, frame.time, segFrames));
      segStart = frame.time;
      segFrames = [];
    }
    segFrames.push(frame);
  }

  if (segFrames.length > 0) {
    segments.push(finalizeCLIPSegment(segStart, frames[frames.length - 1].time, segFrames));
  }

  return segments;
}

function finalizeCLIPSegment(start: number, end: number, frames: MergedFrame[]): CLIPSceneSegment {
  const avgBrightness = round(average(frames.map((f) => clamp01(f.brightness))));
  const avgMotion = round(average(frames.map((f) => clamp01(f.motion))));
  const avgSaturation = round(average(frames.map((f) => clamp01(f.saturation))));

  // Compute average embedding if available.
  const embeddingsWithVector = frames.filter((f) => f.embedding);
  let avgEmbedding: Float32Array | undefined;
  if (embeddingsWithVector.length > 0) {
    const dim = embeddingsWithVector[0].embedding!.length;
    avgEmbedding = new Float32Array(dim);
    for (const frame of embeddingsWithVector) {
      for (let i = 0; i < dim; i++) {
        avgEmbedding[i] += frame.embedding![i];
      }
    }
    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] /= embeddingsWithVector.length;
    }
  }

  // Classify scene type.
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

  // Confidence based on frame count and embedding coverage.
  const embeddingCoverage = embeddingsWithVector.length / frames.length;
  const frameCountScore = Math.min(1, frames.length / 5);
  const confidence = round(embeddingCoverage * 0.6 + frameCountScore * 0.4);

  return {
    start: round(Math.max(0, start)),
    end: round(Math.max(0, end)),
    sceneType,
    avgEmbedding,
    avgBrightness,
    avgMotion,
    confidence,
  };
}

function findNearest(values: number[], target: number): number | null {
  if (values.length === 0) {
    return null;
  }
  let best = values[0];
  let bestDist = Math.abs(best - target);
  for (let i = 1; i < values.length; i++) {
    const dist = Math.abs(values[i] - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = values[i];
    }
  }
  return best;
}

function mergeCloseRefinements(refinements: BoundaryRefinement[], minGap: number): BoundaryRefinement[] {
  if (refinements.length <= 1) {
    return refinements;
  }

  const sorted = [...refinements].sort((a, b) => a.originalTime - b.originalTime);
  const merged: BoundaryRefinement[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].originalTime - last.originalTime < minGap) {
      // Keep the one with higher confidence.
      if (sorted[i].confidence > last.confidence) {
        merged[merged.length - 1] = sorted[i];
      }
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}
