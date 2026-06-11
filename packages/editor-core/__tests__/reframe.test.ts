import { describe, expect, it } from 'vitest';
import { buildReframeCropFilter, calculateReframeCrop, clampReframeOffset, resolveReframeDimensions } from '../src';

describe('smart reframe helpers', () => {
  it('resolves export dimensions for target aspect ratios', () => {
    expect(resolveReframeDimensions(1920, 1080, '16:9')).toEqual({ width: 1920, height: 1080 });
    expect(resolveReframeDimensions(1920, 1080, '9:16')).toEqual({ width: 1080, height: 1920 });
    expect(resolveReframeDimensions(1920, 1080, '1:1')).toEqual({ width: 1920, height: 1920 });
    expect(resolveReframeDimensions(1920, 1080, '4:5')).toEqual({ width: 1536, height: 1920 });
    expect(resolveReframeDimensions(1920, 1080, '21:9')).toEqual({ width: 1920, height: 822 });
  });

  it('keeps source dimensions when target ratio is source or invalid', () => {
    expect(resolveReframeDimensions(1280, 720, 'source')).toEqual({ width: 1280, height: 720 });
    expect(resolveReframeDimensions(1280, 720, 'bad' as never)).toEqual({ width: 1280, height: 720 });
  });

  it('clamps manual reframe offsets', () => {
    expect(clampReframeOffset(-2)).toBe(-1);
    expect(clampReframeOffset(0.25)).toBe(0.25);
    expect(clampReframeOffset(2)).toBe(1);
    expect(clampReframeOffset(Number.NaN)).toBe(0);
  });

  it('builds centered crop expressions with clamped offsets', () => {
    const crop = calculateReframeCrop({ targetAspectRatio: '9:16', reframeOffsetX: 2, reframeOffsetY: -0.5 });

    expect(crop).toMatchObject({ targetAspectRatio: '9:16', offsetX: 1, offsetY: -0.5 });
    expect(buildReframeCropFilter({ targetAspectRatio: '9:16', reframeOffsetX: 2, reframeOffsetY: -0.5 })).toContain(
      "crop=w='if(gte(iw/ih\\,0.5625)\\,ih*0.5625\\,iw)'"
    );
    expect(buildReframeCropFilter({ targetAspectRatio: 'source' })).toBeUndefined();
  });
});
