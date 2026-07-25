import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  rgbToLab,
  colorDistance,
  deltaE,
  createDefaultColorCorrection,
  validateColorCorrection,
  normalizeColorCorrection,
} from './color-grading';

describe('rgbToHsl', () => {
  it('converts black', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it('converts white', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(1);
  });

  it('converts pure red', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(1);
    expect(hsl.l).toBeCloseTo(0.5, 1);
  });

  it('converts pure green', () => {
    const hsl = rgbToHsl({ r: 0, g: 255, b: 0 });
    expect(hsl.h).toBe(120);
  });

  it('converts pure blue', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 255 });
    expect(hsl.h).toBe(240);
  });

  it('converts gray (achromatic)', () => {
    const hsl = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(hsl.s).toBe(0);
  });
});

describe('hslToRgb', () => {
  it('converts black', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 0 });
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('converts white', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 1 });
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(255);
    expect(rgb.b).toBe(255);
  });

  it('converts pure red', () => {
    const rgb = hslToRgb({ h: 0, s: 1, l: 0.5 });
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('handles hue in different ranges', () => {
    const r1 = hslToRgb({ h: 60, s: 1, l: 0.5 });
    expect(r1.r).toBe(255);
    expect(r1.g).toBe(255);

    const r2 = hslToRgb({ h: 180, s: 1, l: 0.5 });
    expect(r2.g).toBe(255);
    expect(r2.b).toBe(255);

    const r3 = hslToRgb({ h: 300, s: 1, l: 0.5 });
    expect(r3.r).toBe(255);
    expect(r3.b).toBe(255);
  });
});

describe('rgbToLab', () => {
  it('converts black', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 0);
  });

  it('converts white', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 0);
  });

  it('converts mid-gray', () => {
    const lab = rgbToLab({ r: 128, g: 128, b: 128 });
    expect(lab.l).toBeGreaterThan(40);
    expect(lab.l).toBeLessThan(60);
  });
});

describe('colorDistance', () => {
  it('returns 0 for same color', () => {
    expect(colorDistance({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBe(0);
  });

  it('returns positive for different colors', () => {
    const d = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(d).toBeGreaterThan(0);
  });

  it('is symmetric', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 100, b: 50 };
    expect(colorDistance(a, b)).toBeCloseTo(colorDistance(b, a));
  });
});

describe('deltaE', () => {
  it('returns 0 for same color', () => {
    const lab = { l: 50, a: 0, b: 0 };
    expect(deltaE(lab, lab)).toBe(0);
  });

  it('returns positive for different colors', () => {
    const d = deltaE({ l: 0, a: 0, b: 0 }, { l: 100, a: 0, b: 0 });
    expect(d).toBeGreaterThan(0);
  });
});

describe('createDefaultColorCorrection', () => {
  it('returns expected defaults', () => {
    const cc = createDefaultColorCorrection();
    expect(cc.brightness).toBe(0);
    expect(cc.contrast).toBe(0);
    expect(cc.saturation).toBe(0);
    expect(cc.temperature).toBe(0);
    expect(cc.tint).toBe(0);
    expect(cc.hueRotation).toBe(0);
    expect(cc.gamma).toBe(1);
    expect(cc.lift).toEqual({ r: 0, g: 0, b: 0 });
    expect(cc.gammaRGB).toEqual({ r: 0, g: 0, b: 0 });
    expect(cc.gain).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('validateColorCorrection', () => {
  it('returns true for valid params', () => {
    expect(validateColorCorrection(createDefaultColorCorrection())).toBe(true);
  });

  it('returns false for missing fields', () => {
    expect(validateColorCorrection({} as any)).toBe(false);
  });

  it('returns false for non-number brightness', () => {
    const cc = { ...createDefaultColorCorrection(), brightness: 'bad' as any };
    expect(validateColorCorrection(cc)).toBe(false);
  });

  it('returns false for non-object lift', () => {
    const cc = { ...createDefaultColorCorrection(), lift: 'bad' as any };
    expect(validateColorCorrection(cc)).toBe(false);
  });
});

describe('normalizeColorCorrection', () => {
  it('clamps brightness to [-1, 1]', () => {
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), brightness: 2 }).brightness).toBe(1);
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), brightness: -2 }).brightness).toBe(-1);
  });

  it('clamps gamma to [0.1, 3.0]', () => {
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), gamma: 5 }).gamma).toBe(3);
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), gamma: 0 }).gamma).toBe(0.1);
  });

  it('clamps hueRotation to [-180, 180]', () => {
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), hueRotation: 200 }).hueRotation).toBe(180);
    expect(normalizeColorCorrection({ ...createDefaultColorCorrection(), hueRotation: -200 }).hueRotation).toBe(-180);
  });

  it('clamps lift/gammaRGB/gain r/g/b', () => {
    const cc = normalizeColorCorrection({
      ...createDefaultColorCorrection(),
      lift: { r: 2, g: -2, b: 0.5 },
      gammaRGB: { r: 2, g: -2, b: 0 },
      gain: { r: 0.5, g: 2, b: -2 },
    });
    expect(cc.lift.r).toBe(1);
    expect(cc.lift.g).toBe(-1);
    expect(cc.lift.b).toBe(0.5);
    expect(cc.gammaRGB.r).toBe(1);
    expect(cc.gammaRGB.g).toBe(-1);
    expect(cc.gain.r).toBe(0.5);
    expect(cc.gain.g).toBe(1);
    expect(cc.gain.b).toBe(-1);
  });

  it('preserves values within range', () => {
    const cc = createDefaultColorCorrection();
    const result = normalizeColorCorrection(cc);
    expect(result).toEqual(cc);
  });
});
