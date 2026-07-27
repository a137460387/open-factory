import { describe, it, expect } from 'vitest';
import {
  MIN_TRACK_HEIGHT,
  MAX_TRACK_HEIGHT,
  DEFAULT_TRACK_HEIGHT,
  WAVEFORM_HIDE_THRESHOLD,
  clampTrackHeight,
  getEffectiveTrackHeight,
  shouldShowWaveform,
} from '../src/track-height';

describe('track-height', () => {
  describe('constants', () => {
    it('MIN_TRACK_HEIGHT is 24', () => {
      expect(MIN_TRACK_HEIGHT).toBe(24);
    });

    it('MAX_TRACK_HEIGHT is 200', () => {
      expect(MAX_TRACK_HEIGHT).toBe(200);
    });

    it('DEFAULT_TRACK_HEIGHT is 48', () => {
      expect(DEFAULT_TRACK_HEIGHT).toBe(48);
    });

    it('WAVEFORM_HIDE_THRESHOLD is 32', () => {
      expect(WAVEFORM_HIDE_THRESHOLD).toBe(32);
    });
  });

  describe('clampTrackHeight', () => {
    it('returns value within range', () => {
      expect(clampTrackHeight(100)).toBe(100);
    });

    it('clamps to minimum', () => {
      expect(clampTrackHeight(0)).toBe(MIN_TRACK_HEIGHT);
      expect(clampTrackHeight(-10)).toBe(MIN_TRACK_HEIGHT);
    });

    it('clamps to maximum', () => {
      expect(clampTrackHeight(300)).toBe(MAX_TRACK_HEIGHT);
    });

    it('rounds to nearest integer', () => {
      expect(clampTrackHeight(50.6)).toBe(51);
      expect(clampTrackHeight(50.3)).toBe(50);
    });
  });

  describe('getEffectiveTrackHeight', () => {
    it('returns default when undefined', () => {
      expect(getEffectiveTrackHeight(undefined)).toBe(DEFAULT_TRACK_HEIGHT);
    });

    it('returns default when null', () => {
      expect(getEffectiveTrackHeight(null)).toBe(DEFAULT_TRACK_HEIGHT);
    });

    it('returns default when NaN', () => {
      expect(getEffectiveTrackHeight(NaN)).toBe(DEFAULT_TRACK_HEIGHT);
    });

    it('returns default when Infinity', () => {
      expect(getEffectiveTrackHeight(Infinity)).toBe(DEFAULT_TRACK_HEIGHT);
    });

    it('clamps valid values', () => {
      expect(getEffectiveTrackHeight(100)).toBe(100);
      expect(getEffectiveTrackHeight(10)).toBe(MIN_TRACK_HEIGHT);
      expect(getEffectiveTrackHeight(500)).toBe(MAX_TRACK_HEIGHT);
    });
  });

  describe('shouldShowWaveform', () => {
    it('returns true when above threshold', () => {
      expect(shouldShowWaveform(48)).toBe(true);
      expect(shouldShowWaveform(100)).toBe(true);
    });

    it('returns false when below threshold', () => {
      expect(shouldShowWaveform(24)).toBe(false);
      expect(shouldShowWaveform(31)).toBe(false);
    });

    it('returns true at exact threshold', () => {
      expect(shouldShowWaveform(WAVEFORM_HIDE_THRESHOLD)).toBe(true);
    });
  });
});
