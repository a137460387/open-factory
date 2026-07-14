import { describe, expect, it } from 'vitest';
import {
  buildPreviewCompareDividerStyle,
  buildPreviewCompareOverlayStyle,
  calculatePreviewCompareSplitRatio,
  clampPreviewCompareSplitRatio,
  drawPreviewDifferenceFrame,
} from './compare';

describe('preview compare split calculations', () => {
  const bounds = { left: 100, top: 50, width: 800, height: 400 };

  it('calculates left-right split ratio from pointer x and clamps edges', () => {
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 500, clientY: 60 }, bounds)).toBe(0.5);
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 0, clientY: 60 }, bounds)).toBe(0.1);
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 1000, clientY: 60 }, bounds)).toBe(0.9);
  });

  it('clamps snapshot compare divider ratios into the draggable preview range', () => {
    expect(clampPreviewCompareSplitRatio(Number.NaN)).toBe(0.5);
    expect(clampPreviewCompareSplitRatio(0)).toBe(0.1);
    expect(clampPreviewCompareSplitRatio(1)).toBe(0.9);
    expect(clampPreviewCompareSplitRatio(0.42)).toBe(0.42);
  });

  it('calculates top-bottom split ratio from pointer y', () => {
    expect(calculatePreviewCompareSplitRatio('top-bottom', { clientX: 120, clientY: 250 }, bounds)).toBe(0.5);
  });

  it('builds clipping and divider styles for both split directions', () => {
    expect(buildPreviewCompareOverlayStyle('left-right', 0.375).clipPath).toBe('inset(0 0 0 37.5%)');
    expect(buildPreviewCompareOverlayStyle('top-bottom', 0.25).clipPath).toBe('inset(25% 0 0 0)');
    expect(buildPreviewCompareDividerStyle('left-right', 0.5)).toMatchObject({
      left: '50%',
      width: '2px',
      height: '100%',
    });
    expect(buildPreviewCompareDividerStyle('top-bottom', 0.5)).toMatchObject({
      top: '50%',
      width: '100%',
      height: '2px',
    });
  });

  it('draws amplified absolute frame differences', () => {
    let output: Uint8ClampedArray | undefined;
    const canvas = {
      width: 1,
      height: 1,
      getContext: () => ({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: (image: ImageData) => {
          output = image.data;
        },
      }),
    } as unknown as HTMLCanvasElement;

    drawPreviewDifferenceFrame(
      canvas,
      { width: 1, height: 1, origin: 'top-left', data: new Uint8ClampedArray([20, 120, 250, 255]) },
      { width: 1, height: 1, origin: 'top-left', data: new Uint8ClampedArray([10, 80, 100, 255]) },
    );

    expect(Array.from(output ?? [])).toEqual([20, 80, 255, 255]);
  });
});
