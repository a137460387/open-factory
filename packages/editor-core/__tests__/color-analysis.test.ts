import { describe, expect, it } from 'vitest';
import {
  analyzeColorFrameSample,
  buildColorAlignmentUpdates,
  buildTimelineColorHeatmapData,
  detectSceneColorJumps,
  estimateColorTemperatureKelvin,
  type ColorMatchFrameSample,
  type TimelineColorAnalysisResult
} from '../src';

function sampleFromPixels(pixels: Array<[number, number, number, number?]>): ColorMatchFrameSample {
  return {
    width: pixels.length,
    height: 1,
    data: pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a])
  };
}

function result(clipId: string, start: number, rgb: [number, number, number]): TimelineColorAnalysisResult {
  return {
    clipId,
    start,
    duration: 2,
    metrics: analyzeColorFrameSample(sampleFromPixels([rgb]))
  };
}

describe('color analysis', () => {
  it('estimates color temperature ranges from RGB means', () => {
    expect(estimateColorTemperatureKelvin({ r: 255, g: 244, b: 230 })).toBeGreaterThan(4500);
    expect(estimateColorTemperatureKelvin({ r: 255, g: 244, b: 230 })).toBeLessThan(7500);
    expect(estimateColorTemperatureKelvin({ r: 255, g: 170, b: 90 })).toBeLessThan(4500);
    expect(estimateColorTemperatureKelvin({ r: 150, g: 190, b: 255 })).toBeGreaterThan(7500);
  });

  it('calculates five-axis color analysis metrics', () => {
    const metrics = analyzeColorFrameSample(
      sampleFromPixels([
        [45, 108, 223],
        [60, 118, 230],
        [255, 255, 255, 0]
      ])
    );

    expect(metrics.averageBrightness).toBeGreaterThan(90);
    expect(metrics.averageBrightness).toBeLessThan(120);
    expect(metrics.averageSaturation).toBeGreaterThan(0.7);
    expect(metrics.contrast).toBeGreaterThan(1);
    expect(metrics.colorTemperatureKelvin).toBeGreaterThan(7500);
    expect(metrics.tintBias).toBe('cool');
  });

  it('detects adjacent scene color differences above thresholds', () => {
    const jumps = detectSceneColorJumps([
      result('clip-a', 0, [45, 108, 223]),
      result('clip-b', 2, [217, 85, 63])
    ]);

    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toMatchObject({ fromClipId: 'clip-a', toClipId: 'clip-b', time: 2 });
    expect(jumps[0].score).toBeGreaterThan(0.35);
  });

  it('builds timeline heatmap points from brightness and color temperature', () => {
    const points = buildTimelineColorHeatmapData([
      result('clip-b', 3, [217, 85, 63]),
      result('clip-a', 0, [45, 108, 223])
    ]);

    expect(points.map((point) => point.clipId)).toEqual(['clip-a', 'clip-b']);
    expect(points[0]).toMatchObject({ start: 0, end: 2 });
    expect(points[0].height).toBeGreaterThan(0);
    expect(points[0].color).toMatch(/^rgb\(/);
  });

  it('creates one color alignment update for each non-reference clip', () => {
    const updates = buildColorAlignmentUpdates(
      [
        { clipId: 'reference', sample: sampleFromPixels([[217, 85, 63]]) },
        { clipId: 'target-a', sample: sampleFromPixels([[45, 108, 223]]) },
        { clipId: 'target-b', sample: sampleFromPixels([[80, 120, 160]]) }
      ],
      'reference'
    );

    expect(updates.map((update) => update.clipId)).toEqual(['target-a', 'target-b']);
    expect(updates).toHaveLength(2);
    expect(updates[0].colorCorrection.colorCurves?.r.length).toBeGreaterThan(2);
  });

  it('returns empty updates when reference clip is not found', () => {
    const updates = buildColorAlignmentUpdates(
      [{ clipId: 'target', sample: sampleFromPixels([[45, 108, 223]]) }],
      'nonexistent'
    );
    expect(updates).toEqual([]);
  });

  it('classifies tint bias as neutral when chroma offsets are close to zero', () => {
    const metrics = analyzeColorFrameSample(sampleFromPixels([[128, 128, 128]]));
    expect(metrics.tintBias).toBe('neutral');
    expect(metrics.averageBrightness).toBe(128);
  });
});
