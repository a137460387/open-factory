import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculateEstimateConfidence,
  buildEstimateHistoryComparison,
  parseExportBitrate,
  calculateHistoricalExportSpeed,
  calculateHistoricalEstimateErrorPercent,
  createDebouncedEstimator,
  applyLearnedCoefficients,
  EXPORT_COST_EFFECT_COMPLEXITY_FACTORS,
} from '../src/export/cost-estimate';

describe('cost-estimate', () => {
  describe('calculateEstimateConfidence', () => {
    it('returns insufficient for 0 samples', () => {
      const result = calculateEstimateConfidence(0);
      expect(result.level).toBe('insufficient');
      expect(result.sampleCount).toBe(0);
    });

    it('returns insufficient for 2 samples', () => {
      expect(calculateEstimateConfidence(2).level).toBe('insufficient');
    });

    it('returns low for 3-5 samples', () => {
      expect(calculateEstimateConfidence(3).level).toBe('low');
      expect(calculateEstimateConfidence(5).level).toBe('low');
    });

    it('returns medium for 6-9 samples', () => {
      expect(calculateEstimateConfidence(6).level).toBe('medium');
      expect(calculateEstimateConfidence(9).level).toBe('medium');
    });

    it('returns high for 10+ samples', () => {
      expect(calculateEstimateConfidence(10).level).toBe('high');
      expect(calculateEstimateConfidence(100).level).toBe('high');
    });

    it('handles NaN input', () => {
      expect(calculateEstimateConfidence(NaN).level).toBe('insufficient');
      expect(calculateEstimateConfidence(NaN).sampleCount).toBe(0);
    });

    it('floors fractional values', () => {
      expect(calculateEstimateConfidence(3.7).sampleCount).toBe(3);
    });

    it('clamps negative to 0', () => {
      expect(calculateEstimateConfidence(-5).sampleCount).toBe(0);
    });
  });

  describe('buildEstimateHistoryComparison', () => {
    it('returns empty for no valid samples', () => {
      expect(buildEstimateHistoryComparison([])).toEqual([]);
    });

    it('filters out invalid samples', () => {
      const samples = [
        { exportDurationSeconds: 0, estimatedDurationSeconds: 10 },
        { exportDurationSeconds: 10, estimatedDurationSeconds: 0 },
        { exportDurationSeconds: NaN, estimatedDurationSeconds: 10 },
      ];
      expect(buildEstimateHistoryComparison(samples)).toEqual([]);
    });

    it('calculates error percent correctly', () => {
      const samples = [
        { exportDurationSeconds: 12, estimatedDurationSeconds: 10 },
      ];
      const result = buildEstimateHistoryComparison(samples);
      expect(result).toHaveLength(1);
      expect(result[0].errorPercent).toBeCloseTo(20, 0);
      expect(result[0].estimatedSeconds).toBe(10);
      expect(result[0].actualSeconds).toBe(12);
    });

    it('limits to 10 entries', () => {
      const samples = Array.from({ length: 15 }, (_, i) => ({
        exportDurationSeconds: 10 + i,
        estimatedDurationSeconds: 10,
      }));
      expect(buildEstimateHistoryComparison(samples)).toHaveLength(10);
    });
  });

  describe('parseExportBitrate', () => {
    it('parses plain number', () => {
      expect(parseExportBitrate('1000')).toBe(1000);
    });

    it('parses k suffix', () => {
      expect(parseExportBitrate('128k')).toBe(128000);
      expect(parseExportBitrate('128K')).toBe(128000);
    });

    it('parses m suffix', () => {
      expect(parseExportBitrate('5m')).toBe(5000000);
      expect(parseExportBitrate('5M')).toBe(5000000);
    });

    it('parses decimal values', () => {
      expect(parseExportBitrate('1.5m')).toBe(1500000);
    });

    it('returns undefined for invalid input', () => {
      expect(parseExportBitrate('')).toBeUndefined();
      expect(parseExportBitrate(null)).toBeUndefined();
      expect(parseExportBitrate(undefined)).toBeUndefined();
      expect(parseExportBitrate('abc')).toBeUndefined();
    });

    it('returns undefined for zero', () => {
      expect(parseExportBitrate('0')).toBeUndefined();
    });
  });

  describe('calculateHistoricalExportSpeed', () => {
    it('returns undefined for empty samples', () => {
      expect(calculateHistoricalExportSpeed([])).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(calculateHistoricalExportSpeed(undefined)).toBeUndefined();
    });

    it('calculates average speed ratio', () => {
      const samples = [
        { exportDurationSeconds: 10, timelineDurationSeconds: 5 },
        { exportDurationSeconds: 20, timelineDurationSeconds: 10 },
      ];
      expect(calculateHistoricalExportSpeed(samples)).toBe(2);
    });

    it('filters out invalid samples', () => {
      const samples = [
        { exportDurationSeconds: 10, timelineDurationSeconds: 5 },
        { exportDurationSeconds: -1, timelineDurationSeconds: 5 },
        { exportDurationSeconds: 10, timelineDurationSeconds: 0 },
      ];
      expect(calculateHistoricalExportSpeed(samples)).toBe(2);
    });
  });

  describe('calculateHistoricalEstimateErrorPercent', () => {
    it('returns undefined for invalid inputs', () => {
      expect(calculateHistoricalEstimateErrorPercent(undefined, 10)).toBeUndefined();
      expect(calculateHistoricalEstimateErrorPercent(10, undefined)).toBeUndefined();
      expect(calculateHistoricalEstimateErrorPercent(0, 10)).toBeUndefined();
      expect(calculateHistoricalEstimateErrorPercent(10, -1)).toBeUndefined();
    });

    it('calculates error percent', () => {
      expect(calculateHistoricalEstimateErrorPercent(10, 12)).toBeCloseTo(20, 0);
      expect(calculateHistoricalEstimateErrorPercent(10, 8)).toBeCloseTo(20, 0);
    });

    it('returns 0 for exact match', () => {
      expect(calculateHistoricalEstimateErrorPercent(10, 10)).toBe(0);
    });
  });

  describe('createDebouncedEstimator', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns initial state with no result', () => {
      vi.useFakeTimers();
      const estimator = createDebouncedEstimator((x: number) => x * 2, 100);
      expect(estimator.lastResult()).toBeUndefined();
    });

    it('flush executes immediately', () => {
      const estimator = createDebouncedEstimator((x: number) => x * 2, 100);
      estimator.call(5);
      const result = estimator.flush();
      expect(result).toBe(10);
      expect(estimator.lastResult()).toBe(10);
    });

    it('cancel prevents execution', () => {
      vi.useFakeTimers();
      const estimator = createDebouncedEstimator((x: number) => x * 2, 100);
      estimator.call(5);
      estimator.cancel();
      vi.advanceTimersByTime(200);
      expect(estimator.lastResult()).toBeUndefined();
    });
  });

  describe('applyLearnedCoefficients', () => {
    it('returns empty for items below min samples', () => {
      const result = applyLearnedCoefficients([
        { effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.5, sampleCount: 1 },
      ]);
      expect(result).toEqual({});
    });

    it('includes items with different learned factor', () => {
      const result = applyLearnedCoefficients([
        { effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.5, sampleCount: 3 },
      ]);
      expect(result).toEqual({ blur: 1.5 });
    });

    it('excludes items where learned equals default', () => {
      const result = applyLearnedCoefficients([
        { effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.35, sampleCount: 3 },
      ]);
      expect(result).toEqual({});
    });
  });

  describe('EXPORT_COST_EFFECT_COMPLEXITY_FACTORS', () => {
    it('has factors for all effect types', () => {
      expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS).toHaveProperty('blur');
      expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS).toHaveProperty('custom-shader');
      expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS).toHaveProperty('motion-blur');
    });

    it('all factors are > 1', () => {
      for (const factor of Object.values(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS)) {
        expect(factor).toBeGreaterThan(1);
      }
    });
  });
});
