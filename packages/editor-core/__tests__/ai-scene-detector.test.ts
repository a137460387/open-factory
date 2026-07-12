import { describe, it, expect } from 'vitest';
import { detectScenes } from '../src/ai-scene-detector';
import type { ContentAnalysisVisualSample } from '../src/content-analysis';

function sample(overrides: Partial<ContentAnalysisVisualSample> = {}): ContentAnalysisVisualSample {
  return {
    time: 0,
    brightness: 0.5,
    saturation: 0.5,
    motion: 0.3,
    ...overrides,
  };
}

describe('detectScenes', () => {
  it('returns empty result for empty input', () => {
    const result = detectScenes([]);
    expect(result.boundaries).toEqual([]);
    expect(result.segments).toEqual([]);
    expect(result.thresholdCurve).toEqual([]);
    expect(result.sampleCount).toBe(0);
  });

  it('returns single segment for a single sample', () => {
    const result = detectScenes([sample({ time: 1, brightness: 0.7, motion: 0.2 })]);
    expect(result.boundaries).toEqual([]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].start).toBe(1);
    expect(result.segments[0].end).toBe(1);
    expect(result.sampleCount).toBe(1);
  });

  it('merges similar samples into one scene when no significant change', () => {
    const samples = [
      sample({ time: 0, brightness: 0.5, saturation: 0.5, motion: 0.2 }),
      sample({ time: 1, brightness: 0.51, saturation: 0.5, motion: 0.21 }),
      sample({ time: 2, brightness: 0.5, saturation: 0.51, motion: 0.2 }),
      sample({ time: 3, brightness: 0.52, saturation: 0.5, motion: 0.22 }),
    ];
    const result = detectScenes(samples);
    // Very similar samples should produce no or very few boundaries
    expect(result.segments.length).toBeLessThanOrEqual(2);
    expect(result.sampleCount).toBe(4);
  });

  it('detects scene boundary on brightness突变', () => {
    const samples = [
      sample({ time: 0, brightness: 0.05, saturation: 0.1, motion: 0.02 }),
      sample({ time: 0.5, brightness: 0.05, saturation: 0.1, motion: 0.02 }),
      sample({ time: 1, brightness: 0.05, saturation: 0.1, motion: 0.02 }),
      sample({ time: 2, brightness: 0.95, saturation: 0.9, motion: 0.02 }),
      sample({ time: 3, brightness: 0.95, saturation: 0.9, motion: 0.02 }),
      sample({ time: 4, brightness: 0.95, saturation: 0.9, motion: 0.02 }),
      sample({ time: 5, brightness: 0.95, saturation: 0.9, motion: 0.02 }),
      sample({ time: 6, brightness: 0.95, saturation: 0.9, motion: 0.02 }),
    ];
    const result = detectScenes(samples, { histogramThreshold: 0.05, motionThreshold: 0.05 });
    expect(result.boundaries.length).toBeGreaterThanOrEqual(1);
  });

  it('detects scene boundary on motion突变', () => {
    const samples = [
      sample({ time: 0, brightness: 0.1, saturation: 0.1, motion: 0.02 }),
      sample({ time: 0.5, brightness: 0.1, saturation: 0.1, motion: 0.02 }),
      sample({ time: 1, brightness: 0.1, saturation: 0.1, motion: 0.02 }),
      sample({ time: 2, brightness: 0.95, saturation: 0.9, motion: 0.98 }),
      sample({ time: 3, brightness: 0.95, saturation: 0.9, motion: 0.98 }),
      sample({ time: 4, brightness: 0.95, saturation: 0.9, motion: 0.98 }),
      sample({ time: 5, brightness: 0.95, saturation: 0.9, motion: 0.98 }),
      sample({ time: 6, brightness: 0.95, saturation: 0.9, motion: 0.98 }),
    ];
    const result = detectScenes(samples, { histogramThreshold: 0.01, motionThreshold: 0.01 });
    expect(result.boundaries.length).toBeGreaterThanOrEqual(1);
  });

  it('respects custom histogramThreshold option', () => {
    const samples = [
      sample({ time: 0, brightness: 0.2, saturation: 0.3, motion: 0.1 }),
      sample({ time: 1, brightness: 0.2, saturation: 0.3, motion: 0.1 }),
      sample({ time: 2, brightness: 0.7, saturation: 0.3, motion: 0.1 }),
      sample({ time: 3, brightness: 0.7, saturation: 0.3, motion: 0.1 }),
    ];

    const lowThreshold = detectScenes(samples, { histogramThreshold: 0.01 });
    const highThreshold = detectScenes(samples, { histogramThreshold: 0.99 });

    // Lower threshold should detect more (or equal) boundaries
    expect(lowThreshold.boundaries.length).toBeGreaterThanOrEqual(highThreshold.boundaries.length);
  });

  it('respects custom minSceneDuration option', () => {
    const samples = [
      sample({ time: 0, brightness: 0.1, saturation: 0.3, motion: 0.1 }),
      sample({ time: 0.2, brightness: 0.9, saturation: 0.3, motion: 0.1 }),
      sample({ time: 0.4, brightness: 0.1, saturation: 0.3, motion: 0.1 }),
      sample({ time: 0.6, brightness: 0.9, saturation: 0.3, motion: 0.1 }),
      sample({ time: 5, brightness: 0.5, saturation: 0.3, motion: 0.1 }),
      sample({ time: 6, brightness: 0.5, saturation: 0.3, motion: 0.1 }),
    ];

    const shortMin = detectScenes(samples, { minSceneDuration: 0.1 });
    const longMin = detectScenes(samples, { minSceneDuration: 10 });

    expect(shortMin.boundaries.length).toBeGreaterThanOrEqual(longMin.boundaries.length);
  });

  it('respects custom motionThreshold option', () => {
    const samples = [
      sample({ time: 0, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 1, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 2, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 3, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
      sample({ time: 4, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
      sample({ time: 5, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
      sample({ time: 6, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 7, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 8, brightness: 0.5, saturation: 0.5, motion: 0.02 }),
      sample({ time: 9, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
      sample({ time: 10, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
      sample({ time: 11, brightness: 0.5, saturation: 0.5, motion: 0.98 }),
    ];

    const result = detectScenes(samples, {
      motionThreshold: 0.01,
      motionWeight: 0.9,
      histogramThreshold: 0.99,
      histogramWeight: 0.1,
      minSceneDuration: 0.01,
    });
    expect(result.boundaries.length).toBeGreaterThanOrEqual(1);
  });

  it('filters out samples with non-finite time', () => {
    const samples = [
      sample({ time: 0, brightness: 0.5 }),
      sample({ time: Number.NaN, brightness: 0.6 }),
      sample({ time: 1, brightness: 0.5 }),
      sample({ time: Infinity, brightness: 0.7 }),
      sample({ time: 2, brightness: 0.5 }),
    ];
    const result = detectScenes(samples);
    expect(result.sampleCount).toBe(3);
  });

  it('sorts samples by time regardless of input order', () => {
    const samples = [
      sample({ time: 3, brightness: 0.5, saturation: 0.5, motion: 0.1 }),
      sample({ time: 1, brightness: 0.5, saturation: 0.5, motion: 0.1 }),
      sample({ time: 2, brightness: 0.5, saturation: 0.5, motion: 0.1 }),
    ];
    const result = detectScenes(samples);
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    expect(result.segments[0].start).toBeLessThanOrEqual(result.segments[result.segments.length - 1].end);
  });

  it('generates thresholdCurve with same length as pair scores', () => {
    const samples = [
      sample({ time: 0, brightness: 0.5 }),
      sample({ time: 1, brightness: 0.6 }),
      sample({ time: 2, brightness: 0.7 }),
      sample({ time: 3, brightness: 0.5 }),
    ];
    const result = detectScenes(samples);
    // thresholdCurve should have entries for each pair (n-1 pairs)
    expect(result.thresholdCurve.length).toBe(samples.length - 1);
    result.thresholdCurve.forEach((entry) => {
      expect(entry).toHaveProperty('time');
      expect(entry).toHaveProperty('threshold');
    });
  });

  it('assigns scene types based on brightness and motion', () => {
    // Night scene: low brightness
    const nightSamples = [
      sample({ time: 0, brightness: 0.1, saturation: 0.2, motion: 0.05 }),
      sample({ time: 1, brightness: 0.15, saturation: 0.2, motion: 0.05 }),
    ];
    const nightResult = detectScenes(nightSamples);
    expect(nightResult.segments[0].sceneType).toBe('night');

    // Action scene: high motion
    const actionSamples = [
      sample({ time: 0, brightness: 0.5, saturation: 0.5, motion: 0.8 }),
      sample({ time: 1, brightness: 0.5, saturation: 0.5, motion: 0.7 }),
    ];
    const actionResult = detectScenes(actionSamples);
    expect(actionResult.segments[0].sceneType).toBe('action');
  });
});
