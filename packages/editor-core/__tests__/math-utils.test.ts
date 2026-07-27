import { describe, it, expect } from 'vitest';
import {
  clamp,
  clamp01,
  round,
  average,
  lerp,
  mapRange,
  finiteOrDefault,
  dbToLinear,
  linearToDb,
  degToRad,
  radToDeg,
  distance,
  nonNegative,
  positive,
  normalizeOptionalHexColor,
} from '../src/math-utils';

describe('math-utils', () => {
  describe('clamp', () => {
    it('returns value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('throws when min > max', () => {
      expect(() => clamp(5, 10, 0)).toThrow(RangeError);
    });
  });

  describe('clamp01', () => {
    it('returns value within 0-1', () => {
      expect(clamp01(0.5)).toBe(0.5);
    });

    it('clamps to 0', () => {
      expect(clamp01(-1)).toBe(0);
    });

    it('clamps to 1', () => {
      expect(clamp01(2)).toBe(1);
    });
  });

  describe('round', () => {
    it('rounds to default 6 decimal places', () => {
      expect(round(1.0000001)).toBe(1);
    });

    it('rounds to specified precision', () => {
      expect(round(1.236, 2)).toBe(1.24);
    });

    it('handles negative values', () => {
      expect(round(-1.236, 2)).toBe(-1.24);
    });
  });

  describe('average', () => {
    it('calculates average', () => {
      expect(average([1, 2, 3, 4])).toBe(2.5);
    });

    it('returns 0 for empty array', () => {
      expect(average([])).toBe(0);
    });

    it('handles single value', () => {
      expect(average([5])).toBe(5);
    });
  });

  describe('lerp', () => {
    it('interpolates at t=0', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('interpolates at t=1', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('interpolates at t=0.5', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });

  describe('mapRange', () => {
    it('maps value from one range to another', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
    });

    it('returns outMin when inMin equals inMax', () => {
      expect(mapRange(5, 5, 5, 0, 100)).toBe(0);
    });

    it('handles inverted ranges', () => {
      expect(mapRange(0, 0, 10, 100, 0)).toBe(100);
    });
  });

  describe('finiteOrDefault', () => {
    it('returns value when finite', () => {
      expect(finiteOrDefault(42, 0)).toBe(42);
    });

    it('returns fallback for NaN', () => {
      expect(finiteOrDefault(NaN, 0)).toBe(0);
    });

    it('returns fallback for undefined', () => {
      expect(finiteOrDefault(undefined, 0)).toBe(0);
    });

    it('returns fallback for Infinity', () => {
      expect(finiteOrDefault(Infinity, 0)).toBe(0);
    });
  });

  describe('dbToLinear', () => {
    it('converts 0 dB to 1', () => {
      expect(dbToLinear(0)).toBeCloseTo(1, 5);
    });

    it('converts 20 dB to 10', () => {
      expect(dbToLinear(20)).toBeCloseTo(10, 5);
    });

    it('converts -20 dB to 0.1', () => {
      expect(dbToLinear(-20)).toBeCloseTo(0.1, 5);
    });
  });

  describe('linearToDb', () => {
    it('converts 1 to 0 dB', () => {
      expect(linearToDb(1)).toBeCloseTo(0, 5);
    });

    it('converts 10 to 20 dB', () => {
      expect(linearToDb(10)).toBeCloseTo(20, 5);
    });

    it('returns -Infinity for 0', () => {
      expect(linearToDb(0)).toBe(-Infinity);
    });

    it('returns -Infinity for negative', () => {
      expect(linearToDb(-1)).toBe(-Infinity);
    });
  });

  describe('degToRad', () => {
    it('converts 180 degrees to pi', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI, 5);
    });

    it('converts 90 degrees to pi/2', () => {
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('radToDeg', () => {
    it('converts pi to 180 degrees', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180, 5);
    });
  });

  describe('distance', () => {
    it('calculates distance between points', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    it('returns 0 for same point', () => {
      expect(distance(1, 1, 1, 1)).toBe(0);
    });
  });

  describe('nonNegative', () => {
    it('returns positive value as-is', () => {
      expect(nonNegative(5)).toBe(5);
    });

    it('clamps negative to 0', () => {
      expect(nonNegative(-5)).toBe(0);
    });
  });

  describe('positive', () => {
    it('returns positive value as-is', () => {
      expect(positive(5)).toBe(5);
    });

    it('returns fallback for 0', () => {
      expect(positive(0)).toBe(1);
    });

    it('returns custom fallback', () => {
      expect(positive(0, 10)).toBe(10);
    });

    it('returns fallback for negative', () => {
      expect(-1).toBeLessThan(0);
      expect(positive(-1)).toBe(1);
    });
  });

  describe('normalizeOptionalHexColor', () => {
    it('normalizes 6-digit hex', () => {
      expect(normalizeOptionalHexColor('#FF0000')).toBe('#ff0000');
    });

    it('expands 3-digit hex', () => {
      expect(normalizeOptionalHexColor('#abc')).toBe('#aabbcc');
    });

    it('returns undefined for empty', () => {
      expect(normalizeOptionalHexColor('')).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(normalizeOptionalHexColor(undefined)).toBeUndefined();
    });

    it('returns undefined for invalid format', () => {
      expect(normalizeOptionalHexColor('red')).toBeUndefined();
      expect(normalizeOptionalHexColor('#gg0000')).toBeUndefined();
    });

    it('trims whitespace', () => {
      expect(normalizeOptionalHexColor('  #fff  ')).toBe('#ffffff');
    });
  });
});
