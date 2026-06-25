import { describe, expect, it } from 'vitest';
import {
  clampTrackHeight,
  getEffectiveTrackHeight,
  shouldShowWaveform,
  MIN_TRACK_HEIGHT,
  MAX_TRACK_HEIGHT,
  DEFAULT_TRACK_HEIGHT,
  WAVEFORM_HIDE_THRESHOLD
} from '../src';

describe('track height', () => {
  describe('clampTrackHeight', () => {
    it('clamps below minimum to MIN_TRACK_HEIGHT', () => {
      expect(clampTrackHeight(10)).toBe(MIN_TRACK_HEIGHT);
    });
    it('clamps above maximum to MAX_TRACK_HEIGHT', () => {
      expect(clampTrackHeight(300)).toBe(MAX_TRACK_HEIGHT);
    });
    it('returns value within range unchanged', () => {
      expect(clampTrackHeight(100)).toBe(100);
    });
    it('rounds fractional values', () => {
      expect(clampTrackHeight(50.7)).toBe(51);
    });
    it('accepts boundary values', () => {
      expect(clampTrackHeight(MIN_TRACK_HEIGHT)).toBe(MIN_TRACK_HEIGHT);
      expect(clampTrackHeight(MAX_TRACK_HEIGHT)).toBe(MAX_TRACK_HEIGHT);
    });
  });

  describe('getEffectiveTrackHeight', () => {
    it('returns default when displayHeight is undefined', () => {
      expect(getEffectiveTrackHeight(undefined)).toBe(DEFAULT_TRACK_HEIGHT);
    });
    it('returns default when displayHeight is null', () => {
      expect(getEffectiveTrackHeight(null)).toBe(DEFAULT_TRACK_HEIGHT);
    });
    it('returns default when displayHeight is NaN', () => {
      expect(getEffectiveTrackHeight(Number.NaN)).toBe(DEFAULT_TRACK_HEIGHT);
    });
    it('returns clamped value for valid input', () => {
      expect(getEffectiveTrackHeight(100)).toBe(100);
    });
    it('clamps out-of-range value', () => {
      expect(getEffectiveTrackHeight(999)).toBe(MAX_TRACK_HEIGHT);
    });
  });

  describe('shouldShowWaveform', () => {
    it('returns true at threshold', () => {
      expect(shouldShowWaveform(WAVEFORM_HIDE_THRESHOLD)).toBe(true);
    });
    it('returns true above threshold', () => {
      expect(shouldShowWaveform(50)).toBe(true);
    });
    it('returns false below threshold', () => {
      expect(shouldShowWaveform(30)).toBe(false);
    });
  });
});
