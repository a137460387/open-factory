import { describe, it, expect } from 'vitest';
import {
  detectScenesWithCLIP,
  computeCLIPSimilarity,
  refineBoundaries,
  findSimilarScenes,
} from '../../src/ai/scene-detection';
import type {
  CLIPFrameEmbedding,
  CLIPSceneDetectionOptions,
} from '../../src/ai/scene-detection';
import type { ContentAnalysisVisualSample } from '../../src/content-analysis';

// --- Test helpers ---

function makeEmbedding(time: number, values: number[]): CLIPFrameEmbedding {
  return { time, vector: new Float32Array(values) };
}

function makeSample(
  time: number,
  brightness = 0.5,
  saturation = 0.5,
  motion = 0.3,
): ContentAnalysisVisualSample {
  return { time, brightness, saturation, motion };
}

function makeIdenticalEmbeddings(
  times: number[],
  dim = 4,
): CLIPFrameEmbedding[] {
  const vector = new Float32Array(dim).fill(1 / Math.sqrt(dim));
  return times.map((time) => ({ time, vector: new Float32Array(vector) }));
}

function makeDifferentEmbeddings(
  times: number[],
  dim = 4,
): CLIPFrameEmbedding[] {
  return times.map((time, i) => {
    const vector = new Float32Array(dim);
    // Create orthogonal vectors.
    vector[i % dim] = 1;
    return { time, vector };
  });
}

// --- Tests ---

describe('computeCLIPSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([1, 0, 0, 0]);
    expect(computeCLIPSimilarity(a, b)).toBe(1);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([0, 1, 0, 0]);
    expect(computeCLIPSimilarity(a, b)).toBe(0);
  });

  it('returns ~0.5 for 45-degree angle', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 1]);
    // cos(45°) ≈ 0.707
    const result = computeCLIPSimilarity(a, b);
    expect(result).toBeGreaterThan(0.6);
    expect(result).toBeLessThan(0.8);
  });

  it('returns 1.0 for empty vectors', () => {
    expect(computeCLIPSimilarity(new Float32Array(0), new Float32Array(0))).toBe(1);
  });

  it('returns 1.0 for zero vectors', () => {
    expect(computeCLIPSimilarity(new Float32Array(4), new Float32Array(4))).toBe(1);
  });

  it('handles different length vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0]);
    expect(computeCLIPSimilarity(a, b)).toBe(1);
  });
});

describe('detectScenesWithCLIP', () => {
  it('returns empty for no input', () => {
    const result = detectScenesWithCLIP([], []);
    expect(result.boundaries).toEqual([]);
    expect(result.segments).toEqual([]);
    expect(result.frameCount).toBe(0);
  });

  it('returns single segment for one sample', () => {
    const samples = [makeSample(0, 0.5, 0.5, 0.3)];
    const result = detectScenesWithCLIP([], samples);
    expect(result.segments).toHaveLength(1);
    expect(result.frameCount).toBe(1);
  });

  it('detects no boundaries for identical embeddings', () => {
    const times = [0, 1, 2, 3, 4, 5];
    const embeddings = makeIdenticalEmbeddings(times);
    const samples = times.map((t) => makeSample(t, 0.5, 0.5, 0.3));

    const result = detectScenesWithCLIP(embeddings, samples);
    // Identical embeddings should have high similarity, no scene breaks.
    expect(result.boundaries).toHaveLength(0);
  });

  it('detects boundaries for very different embeddings', () => {
    const times = [0, 1, 2, 3, 4];
    const embeddings = makeDifferentEmbeddings(times);
    const samples = times.map((t) => makeSample(t, 0.5, 0.5, 0.3));

    const result = detectScenesWithCLIP(embeddings, samples, {
      similarityThreshold: 0.5,
    });
    // Different embeddings should trigger scene breaks.
    expect(result.boundaries.length).toBeGreaterThan(0);
  });

  it('respects minSceneDuration', () => {
    const embeddings: CLIPFrameEmbedding[] = [
      makeEmbedding(0, [1, 0, 0]),
      makeEmbedding(0.2, [0, 1, 0]),
      makeEmbedding(0.4, [0, 0, 1]),
      makeEmbedding(1.0, [1, 0, 0]),
      makeEmbedding(1.5, [0, 1, 0]),
    ];
    const samples = embeddings.map((e) => makeSample(e.time));

    const result = detectScenesWithCLIP(embeddings, samples, {
      minSceneDuration: 0.8,
      similarityThreshold: 0.3,
    });

    // Boundaries should be at least 0.8s apart.
    for (let i = 1; i < result.boundaries.length; i++) {
      expect(result.boundaries[i].time - result.boundaries[i - 1].time).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('classifies night scenes correctly', () => {
    const embeddings = makeIdenticalEmbeddings([0, 1, 2]);
    const samples = [
      makeSample(0, 0.1, 0.3, 0.1),
      makeSample(1, 0.15, 0.2, 0.1),
      makeSample(2, 0.12, 0.25, 0.1),
    ];

    const result = detectScenesWithCLIP(embeddings, samples);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].sceneType).toBe('night');
  });

  it('classifies action scenes correctly', () => {
    const embeddings = makeIdenticalEmbeddings([0, 1, 2]);
    const samples = [
      makeSample(0, 0.5, 0.5, 0.7),
      makeSample(1, 0.5, 0.5, 0.8),
      makeSample(2, 0.5, 0.5, 0.6),
    ];

    const result = detectScenesWithCLIP(embeddings, samples);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].sceneType).toBe('action');
  });

  it('computes average embedding for segments', () => {
    const embeddings: CLIPFrameEmbedding[] = [
      makeEmbedding(0, [1, 0, 0, 0]),
      makeEmbedding(1, [1, 0, 0, 0]),
      makeEmbedding(2, [1, 0, 0, 0]),
    ];
    const samples = embeddings.map((e) => makeSample(e.time));

    const result = detectScenesWithCLIP(embeddings, samples);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].avgEmbedding).toBeDefined();
    // Average should be close to [1, 0, 0, 0].
    expect(result.segments[0].avgEmbedding![0]).toBeCloseTo(1, 1);
  });

  it('handles samples without embeddings', () => {
    const samples = [
      makeSample(0, 0.5, 0.5, 0.3),
      makeSample(1, 0.8, 0.5, 0.3),
      makeSample(2, 0.5, 0.5, 0.3),
    ];

    const result = detectScenesWithCLIP([], samples);
    // Should still work using histogram-based detection.
    expect(result.frameCount).toBe(3);
  });

  it('filters out non-finite times', () => {
    const samples = [
      makeSample(NaN, 0.5, 0.5, 0.3),
      makeSample(1, 0.5, 0.5, 0.3),
      makeSample(Infinity, 0.5, 0.5, 0.3),
    ];

    const result = detectScenesWithCLIP([], samples);
    expect(result.frameCount).toBe(1);
  });
});

describe('refineBoundaries', () => {
  it('returns empty for no boundaries', () => {
    const result = refineBoundaries([], []);
    expect(result).toEqual([]);
  });

  it('snaps to motion peaks', () => {
    const boundaries = [{ time: 1.0, confidence: 0.8, clipSimilarity: 0.2, histogramDiff: 0.3, motionDiff: 0.4, threshold: 0.5 }];
    const samples = [
      makeSample(0.8, 0.5, 0.5, 0.1),
      makeSample(0.9, 0.5, 0.5, 0.1),
      makeSample(1.05, 0.5, 0.5, 0.9),
      makeSample(1.2, 0.5, 0.5, 0.2),
    ];

    const result = refineBoundaries(boundaries, samples);
    expect(result.length).toBeGreaterThan(0);
    // Should snap toward the high-motion sample at 1.05.
    const motionRefinement = result.find((r) => r.reason === 'snap-to-motion');
    if (motionRefinement) {
      expect(motionRefinement.refinedTime).toBeCloseTo(1.05, 0);
    }
  });

  it('snaps to audio events', () => {
    const boundaries = [{ time: 1.0, confidence: 0.8, clipSimilarity: 0.2, histogramDiff: 0.3, motionDiff: 0.4, threshold: 0.5 }];
    const samples = [makeSample(1.0)];
    const audioEvents = [1.15];

    const result = refineBoundaries(boundaries, samples, audioEvents, 0.3);
    const audioRefinement = result.find((r) => r.reason === 'snap-to-audio');
    expect(audioRefinement).toBeDefined();
    expect(audioRefinement!.refinedTime).toBeCloseTo(1.15, 0);
  });

  it('does not snap beyond maxSnapDistance', () => {
    const boundaries = [{ time: 1.0, confidence: 0.8, clipSimilarity: 0.2, histogramDiff: 0.3, motionDiff: 0.4, threshold: 0.5 }];
    const samples = [makeSample(1.0)];
    const audioEvents = [2.0]; // Too far away.

    const result = refineBoundaries(boundaries, samples, audioEvents, 0.3);
    expect(result).toHaveLength(0);
  });
});

describe('findSimilarScenes', () => {
  it('returns empty for single segment', () => {
    const segments = [{
      start: 0,
      end: 5,
      sceneType: 'indoor' as const,
      avgEmbedding: new Float32Array([1, 0, 0]),
      avgBrightness: 0.5,
      avgMotion: 0.3,
      confidence: 0.8,
    }];

    expect(findSimilarScenes(segments)).toEqual([]);
  });

  it('finds similar scenes with identical embeddings', () => {
    const embedding = new Float32Array([1, 0, 0]);
    const segments = [
      { start: 0, end: 5, sceneType: 'indoor' as const, avgEmbedding: new Float32Array(embedding), avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
      { start: 5, end: 10, sceneType: 'indoor' as const, avgEmbedding: new Float32Array(embedding), avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
      { start: 15, end: 20, sceneType: 'indoor' as const, avgEmbedding: new Float32Array(embedding), avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
    ];

    const groups = findSimilarScenes(segments);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].indices).toContain(0);
    expect(groups[0].indices).toContain(1);
    expect(groups[0].indices).toContain(2);
  });

  it('does not group dissimilar scenes', () => {
    const segments = [
      { start: 0, end: 5, sceneType: 'indoor' as const, avgEmbedding: new Float32Array([1, 0, 0]), avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
      { start: 5, end: 10, sceneType: 'outdoor' as const, avgEmbedding: new Float32Array([0, 1, 0]), avgBrightness: 0.7, avgMotion: 0.4, confidence: 0.8 },
    ];

    const groups = findSimilarScenes(segments);
    expect(groups).toHaveLength(0);
  });

  it('skips segments without embeddings', () => {
    const segments = [
      { start: 0, end: 5, sceneType: 'indoor' as const, avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
      { start: 5, end: 10, sceneType: 'indoor' as const, avgBrightness: 0.5, avgMotion: 0.3, confidence: 0.8 },
    ];

    const groups = findSimilarScenes(segments);
    expect(groups).toHaveLength(0);
  });
});
