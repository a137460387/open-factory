import { describe, expect, it } from 'vitest';
import { sampleColorCurves } from '../src';
import {
  applyColorMatchTransformToRgb,
  buildColorMatchCurves,
  buildColorMatchTransform,
  calculateColorMatchStats,
  colorMatchTransformToCurves,
  type ColorMatchFrameSample
} from '../src/color-match';

function sampleFromPixels(pixels: Array<[number, number, number, number?]>): ColorMatchFrameSample {
  return {
    width: pixels.length,
    height: 1,
    data: pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a])
  };
}

describe('color match', () => {
  it('calculates per-channel mean and standard deviation from visible pixels', () => {
    const stats = calculateColorMatchStats(
      sampleFromPixels([
        [0, 64, 128],
        [255, 128, 255],
        [255, 255, 0, 0]
      ])
    );

    expect(stats.pixelCount).toBe(2);
    expect(stats.r.mean).toBeCloseTo(0.5, 3);
    expect(stats.g.mean).toBeCloseTo(0.376, 3);
    expect(stats.b.mean).toBeCloseTo(0.751, 3);
    expect(stats.r.stdDev).toBeCloseTo(0.5, 3);
  });

  it('builds affine channel transforms from source to reference statistics', () => {
    const transform = buildColorMatchTransform(
      calculateColorMatchStats(
        sampleFromPixels([
          [40, 80, 120],
          [80, 120, 160]
        ])
      ),
      calculateColorMatchStats(
        sampleFromPixels([
          [120, 120, 60],
          [200, 200, 140]
        ])
      )
    );

    expect(applyColorMatchTransformToRgb({ r: 40 / 255, g: 80 / 255, b: 120 / 255 }, transform)).toMatchObject({
      r: expect.closeTo(120 / 255, 0.01),
      g: expect.closeTo(120 / 255, 0.01),
      b: expect.closeTo(60 / 255, 0.01)
    });
    expect(applyColorMatchTransformToRgb({ r: 80 / 255, g: 120 / 255, b: 160 / 255 }, transform)).toMatchObject({
      r: expect.closeTo(200 / 255, 0.01),
      g: expect.closeTo(200 / 255, 0.01),
      b: expect.closeTo(140 / 255, 0.01)
    });
  });

  it('maps low-variance source clips by mean offset instead of dividing by zero', () => {
    const source = sampleFromPixels([[45, 108, 223]]);
    const reference = sampleFromPixels([[217, 85, 63]]);
    const curves = buildColorMatchCurves(source, reference);
    const matched = sampleColorCurves(curves, 45 / 255);

    expect(curves.r).toContainEqual({ x: expect.closeTo(45 / 255, 0.001), y: expect.closeTo(217 / 255, 0.001) });
    expect(matched.r).toBeCloseTo(217 / 255, 0.02);
  });

  it('converts transforms into non-default RGB color curves', () => {
    const curves = colorMatchTransformToCurves({
      r: { slope: 1, intercept: 0.2, sourceMean: 0.5 },
      g: { slope: 0.8, intercept: 0.1, sourceMean: 0.4 },
      b: { slope: 1.2, intercept: -0.1, sourceMean: 0.6 }
    });

    expect(curves.master).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ]);
    expect(curves.r).not.toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ]);
    expect(curves.g.length).toBeGreaterThan(2);
    expect(curves.b.length).toBeGreaterThan(2);
  });
});
