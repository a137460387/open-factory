import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_CORRECTION,
  clampClipSpeed,
  getClipDisplayDuration,
  getClipSourceVisibleDuration,
  isDefaultColorCorrection,
  normalizeColorCorrection,
  normalizeTransitionDuration,
  normalizeTransitionType,
  setClipSpeed
} from '../src';
import { makeVideoClip } from './test-utils';

describe('clip speed and color correction helpers', () => {
  it('keeps valid clip speed unchanged', () => {
    expect(clampClipSpeed(1.75)).toBe(1.75);
  });

  it('clamps slow clip speed to 0.25x', () => {
    expect(clampClipSpeed(0.01)).toBe(0.25);
  });

  it('clamps fast clip speed to 4x', () => {
    expect(clampClipSpeed(8)).toBe(4);
  });

  it('falls back to default speed for invalid values', () => {
    expect(clampClipSpeed(Number.NaN)).toBe(1);
  });

  it('normalizes partial color correction with defaults', () => {
    expect(normalizeColorCorrection({ brightness: 0.25 })).toEqual({ ...DEFAULT_COLOR_CORRECTION, brightness: 0.25 });
  });

  it('clamps color correction lower bounds', () => {
    expect(normalizeColorCorrection({ brightness: -3, contrast: -1, saturation: -1, hue: -720 })).toEqual({
      brightness: -1,
      contrast: 0,
      saturation: 0,
      hue: -180,
      lutPath: null
    });
  });

  it('clamps color correction upper bounds', () => {
    expect(normalizeColorCorrection({ brightness: 3, contrast: 8, saturation: 8, hue: 720 })).toEqual({
      brightness: 1,
      contrast: 2,
      saturation: 2,
      hue: 180,
      lutPath: null
    });
  });

  it('normalizes LUT paths in color correction', () => {
    expect(normalizeColorCorrection({ lutPath: '  C:\\LUTs\\look.cube  ' }).lutPath).toBe('C:\\LUTs\\look.cube');
    expect(normalizeColorCorrection({ lutPath: '   ' }).lutPath).toBeNull();
  });

  it('detects default color correction', () => {
    expect(isDefaultColorCorrection(DEFAULT_COLOR_CORRECTION)).toBe(true);
  });

  it('detects non-default color correction', () => {
    expect(isDefaultColorCorrection({ hue: 1 })).toBe(false);
    expect(isDefaultColorCorrection({ lutPath: 'C:\\LUTs\\look.cube' })).toBe(false);
  });

  it('computes source duration from display duration and speed', () => {
    expect(getClipSourceVisibleDuration(makeVideoClip({ duration: 2, speed: 1.5 }))).toBe(3);
  });

  it('computes display duration from source duration and speed', () => {
    expect(getClipDisplayDuration(3, 1.5)).toBe(2);
  });

  it('updates speed while preserving source duration', () => {
    expect(setClipSpeed(makeVideoClip({ duration: 2, speed: 1 }), 4)).toMatchObject({ speed: 4, duration: 0.5 });
  });

  it('normalizes transition defaults and duration bounds', () => {
    expect(normalizeTransitionType(undefined)).toBe('dissolve');
    expect(normalizeTransitionType('fade-black')).toBe('fade-black');
    expect(normalizeTransitionDuration(undefined)).toBe(0.5);
    expect(normalizeTransitionDuration(Number.NaN)).toBe(0.5);
    expect(normalizeTransitionDuration(-1)).toBe(0.001);
  });
});
