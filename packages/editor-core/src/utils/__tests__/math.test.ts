import { describe, it, expect } from 'vitest';
import { clamp, clamp01, lerp } from '../math';

describe('math utils', () => {
  describe('clamp', () => {
    it('returns value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('returns min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('returns max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('returns min when value equals min', () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    it('returns max when value equals max', () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('works with negative ranges', () => {
      expect(clamp(0, -10, -1)).toBe(-1);
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
    });
  });

  describe('clamp01', () => {
    it('clamps to 0-1 range', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(1)).toBe(1);
    });

    it('clamps below 0', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(-100)).toBe(0);
    });

    it('clamps above 1', () => {
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(100)).toBe(1);
    });
  });

  describe('lerp', () => {
    it('returns start at t=0', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('returns end at t=1', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('returns midpoint at t=0.5', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('works with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });

    it('extrapolates when t > 1', () => {
      expect(lerp(0, 10, 2)).toBe(20);
    });

    it('extrapolates when t < 0', () => {
      expect(lerp(0, 10, -1)).toBe(-10);
    });
  });
});
