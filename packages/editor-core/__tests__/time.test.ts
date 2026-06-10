import { describe, expect, it } from 'vitest';
import { clamp, framesToSeconds, round, secondsToFrames, snap } from '../src';

describe('time helpers', () => {
  it('clamps values and validates ranges', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(() => clamp(1, 2, 1)).toThrow(RangeError);
  });

  it('rounds, snaps, and converts frames', () => {
    expect(round(1.2345678, 3)).toBe(1.235);
    expect(snap(0.049, 1 / 30)).toBeCloseTo(1 / 30);
    expect(secondsToFrames(1.5, 30)).toBe(45);
    expect(framesToSeconds(45, 30)).toBe(1.5);
    expect(() => secondsToFrames(1, 0)).toThrow(RangeError);
    expect(() => framesToSeconds(1, 0)).toThrow(RangeError);
  });
});
