import { describe, it, expect } from 'vitest';
import {
  peakToDb,
  detectDuckingRegions,
} from '../src/audio/ducking';

describe('ducking', () => {
  describe('peakToDb', () => {
    it('converts peak 1 to 0 dB', () => {
      expect(peakToDb(1)).toBe(0);
    });

    it('converts peak 0.5 to approx -6 dB', () => {
      expect(peakToDb(0.5)).toBeCloseTo(-6, 0);
    });

    it('returns floor for 0', () => {
      expect(peakToDb(0)).toBe(-60);
    });

    it('returns floor for negative', () => {
      expect(peakToDb(-1)).toBe(-60);
    });

    it('returns floor for NaN', () => {
      expect(peakToDb(NaN)).toBe(-60);
    });

    it('returns floor for Infinity', () => {
      expect(peakToDb(Infinity)).toBe(-60);
    });

    it('uses custom floor', () => {
      expect(peakToDb(0, -80)).toBe(-80);
    });

    it('clamps to 0 dB max', () => {
      expect(peakToDb(2)).toBe(0);
    });
  });

  describe('detectDuckingRegions', () => {
    it('returns empty for empty samples', () => {
      expect(detectDuckingRegions([], -20)).toEqual([]);
    });

    it('detects region above threshold', () => {
      const samples = [
        { time: 0, db: -30 },
        { time: 1, db: -10 },
        { time: 2, db: -30 },
      ];
      const regions = detectDuckingRegions(samples, -20);
      expect(regions).toHaveLength(1);
      expect(regions[0].peakDb).toBe(-10);
    });

    it('returns empty when all below threshold', () => {
      const samples = [
        { time: 0, db: -40 },
        { time: 1, db: -30 },
      ];
      expect(detectDuckingRegions(samples, -20)).toEqual([]);
    });

    it('merges close regions with mergeGap', () => {
      const samples = [
        { time: 0, db: -10 },
        { time: 0.5, db: -30 },
        { time: 1, db: -10 },
      ];
      const regions = detectDuckingRegions(samples, -20, { mergeGap: 1 });
      expect(regions).toHaveLength(1);
    });

    it('filters by minRegionDuration', () => {
      const samples = [
        { time: 0, db: -10, duration: 0.1 },
        { time: 5, db: -10, duration: 2 },
      ];
      const regions = detectDuckingRegions(samples, -20, { minRegionDuration: 0.5 });
      expect(regions).toHaveLength(1);
    });

    it('filters out invalid samples', () => {
      const samples = [
        { time: NaN, db: -10 },
        { time: 1, db: NaN },
        { time: 2, db: -10 },
      ];
      const regions = detectDuckingRegions(samples, -20);
      expect(regions).toHaveLength(1);
    });
  });
});
