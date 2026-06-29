import { describe, expect, it } from 'vitest';
import {
  calculateSkinToneEuclideanDistance,
  checkColorConsistency,
  generateCompensationWheel,
  SKIN_TONE_DISTANCE_THRESHOLD,
  type ClipColorInfo,
  type ColorConsistencyInput
} from '../src';

describe('calculateSkinToneEuclideanDistance', () => {
  it('returns 0 for identical samples', () => {
    expect(calculateSkinToneEuclideanDistance({ r: 128, g: 100, b: 80 }, { r: 128, g: 100, b: 80 })).toBe(0);
  });

  it('calculates correct euclidean distance', () => {
    // distance = sqrt(10^2 + 20^2 + 30^2) = sqrt(100+400+900) = sqrt(1400) ≈ 37.42
    const d = calculateSkinToneEuclideanDistance({ r: 100, g: 80, b: 60 }, { r: 110, g: 100, b: 90 });
    expect(d).toBeCloseTo(Math.sqrt(1400), 1);
  });

  it('returns maximum distance for black vs white', () => {
    const d = calculateSkinToneEuclideanDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(d).toBeCloseTo(Math.sqrt(3 * 255 * 255), 1);
  });
});

describe('checkColorConsistency', () => {
  const base: Omit<ColorConsistencyInput, 'clipA' | 'clipB'> = {
    clipAId: 'a', clipBId: 'b'
  };

  it('returns null when both skin-tone and white-balance match', () => {
    const info: ClipColorInfo = { skinToneRGB: { r: 120, g: 100, b: 80 }, whiteBalanceEstimate: 'neutral' };
    const result = checkColorConsistency({ ...base, clipA: info, clipB: info });
    expect(result).toBeNull();
  });

  it('detects skin-tone inconsistency above threshold', () => {
    const a: ClipColorInfo = { skinToneRGB: { r: 100, g: 80, b: 60 }, whiteBalanceEstimate: 'neutral' };
    const b: ClipColorInfo = { skinToneRGB: { r: 150, g: 130, b: 110 }, whiteBalanceEstimate: 'neutral' };
    const result = checkColorConsistency({ ...base, clipA: a, clipB: b });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('skin_tone');
    expect(result!.deltaRGB).toBeGreaterThan(SKIN_TONE_DISTANCE_THRESHOLD);
  });

  it('detects white-balance mismatch when no skin-tone present', () => {
    const a: ClipColorInfo = { skinToneRGB: null, whiteBalanceEstimate: 'warm' };
    const b: ClipColorInfo = { skinToneRGB: null, whiteBalanceEstimate: 'cool' };
    const result = checkColorConsistency({ ...base, clipA: a, clipB: b });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('white_balance');
    expect(result!.deltaRGB).toBeNull();
  });

  it('returns null when no skin-tone and same white-balance', () => {
    const a: ClipColorInfo = { skinToneRGB: null, whiteBalanceEstimate: 'neutral' };
    const b: ClipColorInfo = { skinToneRGB: null, whiteBalanceEstimate: 'neutral' };
    expect(checkColorConsistency({ ...base, clipA: a, clipB: b })).toBeNull();
  });

  it('detects both skin-tone and white-balance mismatch', () => {
    const a: ClipColorInfo = { skinToneRGB: { r: 100, g: 80, b: 60 }, whiteBalanceEstimate: 'warm' };
    const b: ClipColorInfo = { skinToneRGB: { r: 160, g: 140, b: 120 }, whiteBalanceEstimate: 'cool' };
    const result = checkColorConsistency({ ...base, clipA: a, clipB: b });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('both');
  });

  it('returns null when skin-tone distance exactly at threshold', () => {
    // Create two samples with distance exactly = threshold
    const a = { r: 0, g: 0, b: 0 };
    const dist = SKIN_TONE_DISTANCE_THRESHOLD;
    const b = { r: dist, g: 0, b: 0 };
    const exact = calculateSkinToneEuclideanDistance(a, b);
    expect(exact).toBeCloseTo(SKIN_TONE_DISTANCE_THRESHOLD, 5);
    const infoA: ClipColorInfo = { skinToneRGB: a, whiteBalanceEstimate: 'neutral' };
    const infoB: ClipColorInfo = { skinToneRGB: b, whiteBalanceEstimate: 'neutral' };
    // At exactly threshold, should NOT trigger (uses > not >=)
    expect(checkColorConsistency({ ...base, clipA: infoA, clipB: infoB })).toBeNull();
  });

  it('returns null when skin-tone distance just below threshold', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: SKIN_TONE_DISTANCE_THRESHOLD - 1, g: 0, b: 0 };
    const infoA: ClipColorInfo = { skinToneRGB: a, whiteBalanceEstimate: 'neutral' };
    const infoB: ClipColorInfo = { skinToneRGB: b, whiteBalanceEstimate: 'neutral' };
    expect(checkColorConsistency({ ...base, clipA: infoA, clipB: infoB })).toBeNull();
  });

  it('returns null when only one clip has no skin-tone and white-balance matches', () => {
    const a: ClipColorInfo = { skinToneRGB: { r: 100, g: 80, b: 60 }, whiteBalanceEstimate: 'neutral' };
    const b: ClipColorInfo = { skinToneRGB: null, whiteBalanceEstimate: 'neutral' };
    // Only one has skin -> bothHaveSkin is false, no skin-tone check
    expect(checkColorConsistency({ ...base, clipA: a, clipB: b })).toBeNull();
  });
});

describe('generateCompensationWheel', () => {
  it('returns neutral wheel for identical samples', () => {
    const wheel = generateCompensationWheel({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
    expect(wheel.lift.r).toBe(0);
    expect(wheel.lift.g).toBe(0);
    expect(wheel.lift.b).toBe(0);
  });

  it('generates offset in correct direction (reverse of difference)', () => {
    // clipA has more red than clipB -> compensation should add red to clipB
    const wheel = generateCompensationWheel({ r: 200, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
    // dr = 200-100 = 100 positive -> lift.r should be positive (add red)
    expect(wheel.lift.r).toBeGreaterThan(0);
  });

  it('clamps lift values to [-1, 1]', () => {
    const wheel = generateCompensationWheel({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(wheel.lift.r).toBeGreaterThanOrEqual(-1);
    expect(wheel.lift.r).toBeLessThanOrEqual(1);
    expect(wheel.lift.g).toBeGreaterThanOrEqual(-1);
    expect(wheel.lift.g).toBeLessThanOrEqual(1);
    expect(wheel.lift.b).toBeGreaterThanOrEqual(-1);
    expect(wheel.lift.b).toBeLessThanOrEqual(1);
  });

  it('intensity is always 1', () => {
    const wheel = generateCompensationWheel({ r: 50, g: 100, b: 150 }, { r: 200, g: 50, b: 80 });
    expect(wheel.lift.intensity).toBe(1);
  });
});
