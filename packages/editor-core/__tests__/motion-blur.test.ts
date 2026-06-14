import { describe, expect, it } from 'vitest';
import {
  buildMotionBlurConvolutionFilter,
  buildMotionBlurConvolutionKernel,
  buildMotionBlurExportFilter,
  buildMotionBlurPreviewVector,
  calculateMotionBlurSampleOffsets,
  normalizeMotionBlurParams
} from '../src';

describe('motion blur helpers', () => {
  it('normalizes intensity, angle, sample count, and jitter', () => {
    expect(normalizeMotionBlurParams({ intensity: 1.4, angle: -45, samples: 31, jitter: 2 })).toEqual({
      intensity: 1,
      angle: 315,
      samples: 32,
      jitter: 1
    });
  });

  it('calculates directional sampling offsets along the configured angle', () => {
    const offsets = calculateMotionBlurSampleOffsets({ intensity: 0.5, angle: 0, samples: 4, jitter: 0 }, 8);

    expect(offsets).toEqual([
      { x: -2, y: 0 },
      { x: -0.6667, y: 0 },
      { x: 0.6667, y: 0 },
      { x: 2, y: 0 }
    ]);
    expect(calculateMotionBlurSampleOffsets({ intensity: 1, angle: 90, samples: 4 }, 6).map((offset) => offset.x)).toEqual([0, 0, 0, 0]);
    expect(calculateMotionBlurSampleOffsets({ intensity: 0, angle: 45, samples: 16 })).toEqual([{ x: 0, y: 0 }]);
  });

  it('generates a normalized convolution kernel for export', () => {
    const kernel = buildMotionBlurConvolutionKernel({ intensity: 1, angle: 0, samples: 8 });
    const centerRow = kernel.matrix.slice(21, 28);

    expect(kernel.size).toBe(7);
    expect(kernel.sum).toBe(1);
    expect(centerRow.filter((value) => value > 0).length).toBeGreaterThan(3);
    expect(kernel.matrix.slice(0, 21).every((value) => value === 0)).toBe(true);
    expect(kernel.matrix.slice(28).every((value) => value === 0)).toBe(true);
  });

  it('builds FFmpeg convolution filter only when intensity is non-zero', () => {
    expect(buildMotionBlurConvolutionFilter({ intensity: 0, angle: 0, samples: 8 })).toBeUndefined();
    const filter = buildMotionBlurConvolutionFilter({ intensity: 0.6, angle: 45, samples: 16, jitter: 0.4 });

    expect(filter).toContain('convolution=');
    expect(filter).toContain("0m='");
    expect(filter).toContain('crop=w=');
    expect(filter).toContain('sin(n*12.9898)');
  });

  it('builds FFmpeg temporal blend export filters for motion blur', () => {
    expect(buildMotionBlurExportFilter({ intensity: 0, angle: 0, samples: 8 }, 30)).toBeUndefined();
    const filter = buildMotionBlurExportFilter({ intensity: 0.6, angle: 45, samples: 16, jitter: 0.4 }, 30);

    expect(filter).toContain('minterpolate=fps=90:mi_mode=blend');
    expect(filter).toContain('tblend=all_mode=average:all_opacity=0.6');
    expect(filter).toContain('crop=w=');
  });

  it('calculates the WebGL preview vector in pixels', () => {
    expect(buildMotionBlurPreviewVector({ intensity: 0.25, angle: 180, samples: 4, jitter: 0.5 }, 20)).toEqual({
      x: -5,
      y: 0,
      samples: 4,
      jitter: 4
    });
  });
});
