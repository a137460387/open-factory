import { describe, expect, it } from 'vitest';
import { buildPreviewCompareDividerStyle, buildPreviewCompareOverlayStyle, calculatePreviewCompareSplitRatio } from './compare';

describe('preview compare split calculations', () => {
  const bounds = { left: 100, top: 50, width: 800, height: 400 };

  it('calculates left-right split ratio from pointer x and clamps edges', () => {
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 500, clientY: 60 }, bounds)).toBe(0.5);
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 0, clientY: 60 }, bounds)).toBe(0.1);
    expect(calculatePreviewCompareSplitRatio('left-right', { clientX: 1000, clientY: 60 }, bounds)).toBe(0.9);
  });

  it('calculates top-bottom split ratio from pointer y', () => {
    expect(calculatePreviewCompareSplitRatio('top-bottom', { clientX: 120, clientY: 250 }, bounds)).toBe(0.5);
  });

  it('builds clipping and divider styles for both split directions', () => {
    expect(buildPreviewCompareOverlayStyle('left-right', 0.375).clipPath).toBe('inset(0 0 0 37.5%)');
    expect(buildPreviewCompareOverlayStyle('top-bottom', 0.25).clipPath).toBe('inset(25% 0 0 0)');
    expect(buildPreviewCompareDividerStyle('left-right', 0.5)).toMatchObject({ left: '50%', width: '2px', height: '100%' });
    expect(buildPreviewCompareDividerStyle('top-bottom', 0.5)).toMatchObject({ top: '50%', width: '100%', height: '2px' });
  });
});
