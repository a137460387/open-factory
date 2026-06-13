import { describe, expect, it } from 'vitest';
import { DEFAULT_CHROMA_KEY, type Clip } from '@open-factory/editor-core';
import { buildChromaKeySamplePatch, calculatePreviewPixelCoordinates, clampPreviewZoom, getWheelPreviewZoom, rgbToHex, rgbToHsl } from './frame-inspector';

describe('frame inspector helpers', () => {
  it('clamps preview zoom between 25% and 400%', () => {
    expect(clampPreviewZoom(0.01)).toBe(0.25);
    expect(clampPreviewZoom(8)).toBe(4);
    expect(clampPreviewZoom(Number.NaN)).toBe(1);
    expect(getWheelPreviewZoom(1, -100)).toBeCloseTo(1.1);
    expect(getWheelPreviewZoom(0.25, 100)).toBe(0.25);
  });

  it('calculates pixel and normalized coordinates from preview offsets', () => {
    expect(
      calculatePreviewPixelCoordinates({
        canvasWidth: 1280,
        canvasHeight: 720,
        boundsWidth: 640,
        boundsHeight: 360,
        offsetX: 320,
        offsetY: 180
      })
    ).toEqual({
      x: 640,
      y: 360,
      webglY: 359,
      normalizedX: 640 / 1279,
      normalizedY: 360 / 719
    });
  });

  it('formats sampled colors and writes chroma key patches', () => {
    expect(rgbToHex([16, 32, 255])).toBe('#1020ff');
    expect(rgbToHsl([255, 0, 0])).toEqual({ h: 0, s: 100, l: 50 });

    const clip = { chromaKey: { ...DEFAULT_CHROMA_KEY, colors: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] } } as Pick<Clip, 'chromaKey'>;
    const patch = buildChromaKeySamplePatch(clip, [10, 20, 30]);
    expect(patch.chromaKey).toMatchObject({
      enabled: true,
      color: [1, 2, 3],
      colors: [
        [1, 2, 3],
        [4, 5, 6],
        [10, 20, 30]
      ]
    });
  });
});
