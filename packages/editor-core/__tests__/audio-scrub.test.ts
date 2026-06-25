import { describe, expect, it } from 'vitest';
import {
  getScrubSpeedTier,
  getScrubSampleIntervalMultiplier,
  getScrubSampleFrames,
  shouldTriggerScrub,
  filterScrubTracks
} from '../src';

describe('audio scrub', () => {
  describe('getScrubSpeedTier', () => {
    it('classifies slow drag (< 100px/s)', () => {
      expect(getScrubSpeedTier(50)).toBe('slow');
    });

    it('classifies medium drag (100-500px/s)', () => {
      expect(getScrubSpeedTier(200)).toBe('medium');
    });

    it('classifies fast drag (> 500px/s)', () => {
      expect(getScrubSpeedTier(800)).toBe('fast');
    });

    it('respects custom thresholds', () => {
      expect(getScrubSpeedTier(150, { slowSpeedPxPerSec: 200 })).toBe('slow');
    });
  });

  describe('getScrubSampleIntervalMultiplier', () => {
    it('slow = 1.0', () => {
      expect(getScrubSampleIntervalMultiplier('slow')).toBe(1.0);
    });
    it('medium = 0.5', () => {
      expect(getScrubSampleIntervalMultiplier('medium')).toBe(0.5);
    });
    it('fast = 0.25', () => {
      expect(getScrubSampleIntervalMultiplier('fast')).toBe(0.25);
    });
  });

  describe('getScrubSampleFrames', () => {
    it('calculates frames for 50ms at 44100Hz', () => {
      expect(getScrubSampleFrames(44100)).toBe(2205);
    });
    it('calculates frames for 50ms at 48000Hz', () => {
      expect(getScrubSampleFrames(48000)).toBe(2400);
    });
    it('respects custom window', () => {
      expect(getScrubSampleFrames(44100, { sampleWindowSec: 0.1 })).toBe(4410);
    });
  });

  describe('shouldTriggerScrub', () => {
    it('returns true when enough time has passed', () => {
      expect(shouldTriggerScrub(1000, 1031)).toBe(true);
    });
    it('returns false when too soon', () => {
      expect(shouldTriggerScrub(1000, 1020)).toBe(false);
    });
    it('respects custom interval', () => {
      expect(shouldTriggerScrub(1000, 1050, { minIntervalMs: 60 })).toBe(false);
    });
  });

  describe('filterScrubTracks', () => {
    const tracks = [
      { id: 'a1', type: 'audio', muted: false },
      { id: 'a2', type: 'audio', muted: true },
      { id: 'v1', type: 'video', muted: false },
    ];

    it('filters muted tracks and non-audio tracks', () => {
      const result = filterScrubTracks(tracks);
      expect(result).toEqual(['a1']);
    });

    it('respects solo: only solo tracks play', () => {
      const soloTracks = [
        { id: 'a1', type: 'audio', muted: false, solo: true },
        { id: 'a2', type: 'audio', muted: false },
      ];
      expect(filterScrubTracks(soloTracks)).toEqual(['a1']);
    });

    it('returns empty for all muted', () => {
      expect(filterScrubTracks([
        { id: 'a1', type: 'audio', muted: true },
      ])).toEqual([]);
    });
  });
});
