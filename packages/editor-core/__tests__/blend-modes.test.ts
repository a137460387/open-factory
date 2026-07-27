import { describe, it, expect } from 'vitest';
import {
  CLIP_BLEND_MODES,
  normalizeClipBlendMode,
  getFfmpegBlendMode,
  clipBlendModeToShaderIndex,
  blendChannel,
  blendPixels,
} from '../src/blend-modes';

describe('blend-modes', () => {
  describe('CLIP_BLEND_MODES', () => {
    it('contains expected modes', () => {
      expect(CLIP_BLEND_MODES).toContain('normal');
      expect(CLIP_BLEND_MODES).toContain('multiply');
      expect(CLIP_BLEND_MODES).toContain('screen');
      expect(CLIP_BLEND_MODES).toContain('overlay');
    });
  });

  describe('normalizeClipBlendMode', () => {
    it('returns valid mode as-is', () => {
      expect(normalizeClipBlendMode('multiply')).toBe('multiply');
      expect(normalizeClipBlendMode('normal')).toBe('normal');
    });

    it('returns normal for invalid input', () => {
      expect(normalizeClipBlendMode('invalid')).toBe('normal');
      expect(normalizeClipBlendMode(42)).toBe('normal');
      expect(normalizeClipBlendMode(null)).toBe('normal');
      expect(normalizeClipBlendMode(undefined)).toBe('normal');
    });
  });

  describe('getFfmpegBlendMode', () => {
    it('maps color-burn to burn', () => {
      expect(getFfmpegBlendMode('color-burn')).toBe('burn');
    });

    it('maps color-dodge to dodge', () => {
      expect(getFfmpegBlendMode('color-dodge')).toBe('dodge');
    });

    it('maps hard-light to hardlight', () => {
      expect(getFfmpegBlendMode('hard-light')).toBe('hardlight');
    });

    it('maps soft-light to softlight', () => {
      expect(getFfmpegBlendMode('soft-light')).toBe('softlight');
    });

    it('returns mode as-is for standard modes', () => {
      expect(getFfmpegBlendMode('normal')).toBe('normal');
      expect(getFfmpegBlendMode('multiply')).toBe('multiply');
      expect(getFfmpegBlendMode('screen')).toBe('screen');
    });
  });

  describe('clipBlendModeToShaderIndex', () => {
    it('returns 0 for normal', () => {
      expect(clipBlendModeToShaderIndex('normal')).toBe(0);
    });

    it('returns correct index for each mode', () => {
      CLIP_BLEND_MODES.forEach((mode, index) => {
        expect(clipBlendModeToShaderIndex(mode)).toBe(index);
      });
    });
  });

  describe('blendChannel', () => {
    it('normal mode returns top value', () => {
      expect(blendChannel('normal', 0.5, 0.8)).toBe(0.8);
    });

    it('multiply mode multiplies values', () => {
      expect(blendChannel('multiply', 0.5, 0.8)).toBeCloseTo(0.4, 5);
    });

    it('screen mode applies screen formula', () => {
      expect(blendChannel('screen', 0.5, 0.8)).toBeCloseTo(0.9, 5);
    });

    it('difference mode returns absolute difference', () => {
      expect(blendChannel('difference', 0.3, 0.8)).toBeCloseTo(0.5, 5);
    });

    it('clamps inputs to 0-1 range', () => {
      expect(blendChannel('normal', -1, 0.5)).toBe(0.5);
      expect(blendChannel('normal', 2, 0.5)).toBe(0.5);
    });

    it('color-dodge returns 1 when top is 1', () => {
      expect(blendChannel('color-dodge', 0.5, 1)).toBe(1);
    });

    it('color-burn returns 0 when top is 0', () => {
      expect(blendChannel('color-burn', 0.5, 0)).toBe(0);
    });
  });

  describe('blendPixels', () => {
    it('normal mode returns top pixel', () => {
      const result = blendPixels('normal', { r: 0, g: 0, b: 0 }, { r: 1, g: 0.5, b: 0.25 });
      expect(result.r).toBeCloseTo(1, 5);
      expect(result.g).toBeCloseTo(0.5, 5);
      expect(result.b).toBeCloseTo(0.25, 5);
    });

    it('multiply mode multiplies each channel', () => {
      const result = blendPixels('multiply', { r: 1, g: 1, b: 1 }, { r: 0.5, g: 0.5, b: 0.5 });
      expect(result.r).toBeCloseTo(0.5, 5);
      expect(result.g).toBeCloseTo(0.5, 5);
      expect(result.b).toBeCloseTo(0.5, 5);
    });

    it('returns clamped values', () => {
      const result = blendPixels('screen', { r: 1, g: 1, b: 1 }, { r: 1, g: 1, b: 1 });
      expect(result.r).toBeCloseTo(1, 5);
      expect(result.g).toBeCloseTo(1, 5);
      expect(result.b).toBeCloseTo(1, 5);
    });
  });
});
