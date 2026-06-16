import { describe, expect, it } from 'vitest';
import { CLIP_BLEND_MODES, blendChannel, blendPixels, clipBlendModeToShaderIndex, getFfmpegBlendMode, normalizeClipBlendMode } from '../src';

describe('clip blend modes', () => {
  it('normalizes supported blend modes and falls back to normal', () => {
    expect(CLIP_BLEND_MODES).toEqual(['normal', 'overlay', 'screen', 'multiply', 'difference', 'color-burn', 'color-dodge', 'hard-light', 'soft-light']);
    expect(normalizeClipBlendMode('overlay')).toBe('overlay');
    expect(normalizeClipBlendMode('bad-mode')).toBe('normal');
    expect(normalizeClipBlendMode(undefined)).toBe('normal');
  });

  it('maps clip blend modes to FFmpeg blend names', () => {
    expect(getFfmpegBlendMode('normal')).toBe('normal');
    expect(getFfmpegBlendMode('overlay')).toBe('overlay');
    expect(getFfmpegBlendMode('screen')).toBe('screen');
    expect(getFfmpegBlendMode('multiply')).toBe('multiply');
    expect(getFfmpegBlendMode('difference')).toBe('difference');
    expect(getFfmpegBlendMode('color-burn')).toBe('burn');
    expect(getFfmpegBlendMode('color-dodge')).toBe('dodge');
    expect(getFfmpegBlendMode('hard-light')).toBe('hardlight');
    expect(getFfmpegBlendMode('soft-light')).toBe('softlight');
  });

  it('maps blend modes to stable WebGL shader indexes', () => {
    expect(clipBlendModeToShaderIndex('normal')).toBe(0);
    expect(clipBlendModeToShaderIndex('overlay')).toBe(1);
    expect(clipBlendModeToShaderIndex('soft-light')).toBe(8);
  });

  it('calculates each supported blend formula', () => {
    expect(blendChannel('normal', 0.25, 0.8)).toBeCloseTo(0.8, 6);
    expect(blendChannel('multiply', 0.25, 0.8)).toBeCloseTo(0.2, 6);
    expect(blendChannel('screen', 0.25, 0.8)).toBeCloseTo(0.85, 6);
    expect(blendChannel('overlay', 0.25, 0.8)).toBeCloseTo(0.4, 6);
    expect(blendChannel('overlay', 0.75, 0.2)).toBeCloseTo(0.6, 6);
    expect(blendChannel('difference', 0.25, 0.8)).toBeCloseTo(0.55, 6);
    expect(blendChannel('color-burn', 0.6, 0.8)).toBeCloseTo(0.5, 6);
    expect(blendChannel('color-dodge', 0.4, 0.5)).toBeCloseTo(0.8, 6);
    expect(blendChannel('hard-light', 0.25, 0.8)).toBeCloseTo(0.7, 6);
    expect(blendChannel('soft-light', 0.25, 0.8)).toBeCloseTo(0.4, 6);
    expect(blendChannel('soft-light', 0.25, 0.25)).toBeCloseTo(0.15625, 6);
  });

  it('blends RGB pixels channel by channel', () => {
    expect(blendPixels('screen', { r: 0.2, g: 0.4, b: 0.6 }, { r: 0.1, g: 0.5, b: 0.9 })).toEqual({
      r: 0.28,
      g: 0.7,
      b: 0.96
    });
  });

  it('clamps invalid and out-of-range channel values', () => {
    expect(blendChannel('screen', Number.POSITIVE_INFINITY, 0.5)).toBeCloseTo(0.5, 6);
    expect(blendPixels('normal', { r: 0, g: 0, b: 0 }, { r: 1.25, g: -0.5, b: Number.NaN })).toEqual({
      r: 1,
      g: 0,
      b: 0
    });
  });
});
