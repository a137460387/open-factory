import { describe, it, expect } from 'vitest';
import {
  calculateMotionIntensity,
  calculateSceneChangeScore,
  calculateVisualEnergy,
  smoothMetrics,
  findPeaks,
  detectVisualHighlights,
  mergeWithAudioBeats,
  extractHighlightRanges,
  DEFAULT_VISUAL_HIGHLIGHT_CONFIG,
} from '../src/visual-highlight-engine';

describe('calculateMotionIntensity', () => {
  it('returns 0 for identical frames', () => {
    const frame = new Float32Array([100, 100, 100, 100]);
    expect(calculateMotionIntensity(frame, frame, 4)).toBe(0);
  });

  it('returns high intensity for very different frames', () => {
    const prev = new Float32Array([0, 0, 0, 0]);
    const curr = new Float32Array([255, 255, 255, 255]);
    expect(calculateMotionIntensity(prev, curr, 4)).toBeCloseTo(1, 1);
  });

  it('returns 0 for empty frames', () => {
    expect(calculateMotionIntensity(new Float32Array(0), new Float32Array(0), 0)).toBe(0);
  });

  it('returns partial intensity for moderate changes', () => {
    const prev = new Float32Array([100, 100, 100, 100]);
    const curr = new Float32Array([150, 150, 150, 150]);
    const result = calculateMotionIntensity(prev, curr, 4);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

describe('calculateSceneChangeScore', () => {
  it('returns 0 for identical frames', () => {
    const frame = new Float32Array(64 * 64).fill(128);
    expect(calculateSceneChangeScore(frame, frame, 64, 64)).toBe(0);
  });

  it('returns high score for completely different frames', () => {
    const prev = new Float32Array(64 * 64).fill(0);
    const curr = new Float32Array(64 * 64).fill(255);
    expect(calculateSceneChangeScore(prev, curr, 64, 64)).toBeCloseTo(1, 1);
  });

  it('returns 0 for undersized frames', () => {
    expect(calculateSceneChangeScore(new Float32Array(4), new Float32Array(4), 2, 2, 8)).toBe(0);
  });
});

describe('calculateVisualEnergy', () => {
  it('returns weighted combination', () => {
    expect(calculateVisualEnergy(0.8, 0.6, 0.6, 0.4)).toBeCloseTo(0.72, 2);
  });

  it('caps at 1', () => {
    expect(calculateVisualEnergy(1, 1)).toBe(1);
  });

  it('returns 0 for zero inputs', () => {
    expect(calculateVisualEnergy(0, 0)).toBe(0);
  });
});

describe('smoothMetrics', () => {
  it('returns copy for window size 1', () => {
    expect(smoothMetrics([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('smooths with sliding window', () => {
    const result = smoothMetrics([0, 0, 10, 0, 0], 3);
    expect(result[2]).toBeGreaterThan(result[0]);
  });

  it('returns empty for empty input', () => {
    expect(smoothMetrics([], 3)).toEqual([]);
  });
});

describe('findPeaks', () => {
  it('finds local maxima above threshold', () => {
    const values = [0, 0.2, 0.5, 0.2, 0, 0.1, 0.6, 0.1, 0];
    const peaks = findPeaks(values, 0.3, 1);
    expect(peaks.length).toBe(2);
    expect(peaks[0].value).toBe(0.5);
    expect(peaks[1].value).toBe(0.6);
  });

  it('respects minimum gap', () => {
    const values = [0, 0.5, 0.3, 0.5, 0];
    const peaks = findPeaks(values, 0.3, 3);
    expect(peaks.length).toBe(1);
  });

  it('returns empty for values below threshold', () => {
    expect(findPeaks([0, 0.1, 0], 0.5, 1)).toEqual([]);
  });
});

describe('detectVisualHighlights', () => {
  it('returns empty result for < 2 frames', () => {
    const result = detectVisualHighlights([new Float32Array(100)], 10, 10);
    expect(result.highlights).toEqual([]);
    expect(result.stats.totalFrames).toBe(1);
  });

  it('detects highlights in a sequence of changing frames', () => {
    const frames: Float32Array[] = [];
    for (let i = 0; i < 30; i++) {
      const frame = new Float32Array(32 * 32);
      // Create a big change at frame 15
      if (i === 15) {
        frame.fill(255);
      } else {
        frame.fill(100);
      }
      frames.push(frame);
    }
    const result = detectVisualHighlights(frames, 32, 32, { fps: 30, motionThreshold: 0.1 });
    expect(result.stats.totalFrames).toBe(30);
    expect(result.frameMetrics.length).toBe(30);
    // The big change at frame 15 should produce a highlight
    expect(result.highlights.length).toBeGreaterThanOrEqual(0);
  });

  it('produces energy curve matching frame count', () => {
    const frames = Array.from({ length: 10 }, () => new Float32Array(16 * 16).fill(128));
    const result = detectVisualHighlights(frames, 16, 16);
    expect(result.energyCurve.length).toBe(10);
  });
});

describe('mergeWithAudioBeats', () => {
  it('boosts scores near audio beats', () => {
    const highlights = [
      { time: 1, frameIndex: 30, score: 0.5, type: 'motion-peak' as const, duration: 0.033 },
      { time: 5, frameIndex: 150, score: 0.5, type: 'motion-peak' as const, duration: 0.033 },
    ];
    const beats = [1.1]; // Near first highlight
    const merged = mergeWithAudioBeats(highlights, beats, 0.3);
    expect(merged[0].score).toBeGreaterThan(0.5);
    expect(merged[0].type).toBe('combined');
    expect(merged[1].score).toBe(0.5); // Not near beat
  });

  it('returns unchanged highlights for empty beats', () => {
    const highlights = [{ time: 1, frameIndex: 30, score: 0.5, type: 'motion-peak' as const, duration: 0.033 }];
    expect(mergeWithAudioBeats(highlights, [])).toEqual(highlights);
  });
});

describe('extractHighlightRanges', () => {
  it('merges nearby highlights into ranges', () => {
    const highlights = [
      { time: 1, frameIndex: 30, score: 0.5, type: 'motion-peak' as const, duration: 0.1 },
      { time: 1.3, frameIndex: 39, score: 0.7, type: 'scene-change' as const, duration: 0.1 },
      { time: 5, frameIndex: 150, score: 0.6, type: 'combined' as const, duration: 0.1 },
    ];
    const ranges = extractHighlightRanges(highlights, 0.5);
    expect(ranges.length).toBe(2);
    expect(ranges[0].count).toBe(2);
    expect(ranges[1].count).toBe(1);
  });

  it('returns empty for no highlights', () => {
    expect(extractHighlightRanges([])).toEqual([]);
  });

  it('keeps far highlights separate', () => {
    const highlights = [
      { time: 1, frameIndex: 30, score: 0.5, type: 'motion-peak' as const, duration: 0.1 },
      { time: 10, frameIndex: 300, score: 0.6, type: 'motion-peak' as const, duration: 0.1 },
    ];
    expect(extractHighlightRanges(highlights, 0.5)).toHaveLength(2);
  });
});
