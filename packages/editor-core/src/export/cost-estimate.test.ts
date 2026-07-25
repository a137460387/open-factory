import { describe, it, expect } from 'vitest';
import {
  NO_EFFECT_COMPLEXITY_FACTOR,
  COLOR_CORRECTION_COMPLEXITY_FACTOR,
  VMAF_QUALITY_COMPLEXITY_FACTOR,
  EXPORT_COST_EFFECT_COMPLEXITY_FACTORS,
  calculateEstimateConfidence,
  buildEstimateHistoryComparison,
  learnComplexityCoefficients,
  applyLearnedCoefficients,
  createDebouncedEstimator,
  estimateExportFileSizeMb,
  calculateHistoricalExportSpeed,
  calculateHistoricalEstimateErrorPercent,
  parseExportBitrate,
  assertExportCostEffectCoverage,
} from './cost-estimate';

describe('constants', () => {
  it('NO_EFFECT_COMPLEXITY_FACTOR is 1', () => {
    expect(NO_EFFECT_COMPLEXITY_FACTOR).toBe(1);
  });

  it('COLOR_CORRECTION_COMPLEXITY_FACTOR is 1.3', () => {
    expect(COLOR_CORRECTION_COMPLEXITY_FACTOR).toBe(1.3);
  });

  it('VMAF_QUALITY_COMPLEXITY_FACTOR is 2.5', () => {
    expect(VMAF_QUALITY_COMPLEXITY_FACTOR).toBe(2.5);
  });

  it('EXPORT_COST_EFFECT_COMPLEXITY_FACTORS has expected entries', () => {
    expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS.blur).toBe(1.35);
    expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS.sharpen).toBe(1.2);
    expect(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS['custom-shader']).toBe(2.5);
  });
});

describe('calculateEstimateConfidence', () => {
  it('returns insufficient for 0 samples', () => {
    const r = calculateEstimateConfidence(0);
    expect(r.level).toBe('insufficient');
    expect(r.sampleCount).toBe(0);
  });

  it('returns low for 3 samples', () => {
    const r = calculateEstimateConfidence(3);
    expect(r.level).toBe('low');
  });

  it('returns medium for 6 samples', () => {
    const r = calculateEstimateConfidence(6);
    expect(r.level).toBe('medium');
  });

  it('returns high for 10 samples', () => {
    const r = calculateEstimateConfidence(10);
    expect(r.level).toBe('high');
  });

  it('floors fractional sample count', () => {
    const r = calculateEstimateConfidence(3.7);
    expect(r.sampleCount).toBe(3);
  });

  it('handles NaN', () => {
    const r = calculateEstimateConfidence(NaN);
    expect(r.level).toBe('insufficient');
    expect(r.sampleCount).toBe(0);
  });

  it('handles negative', () => {
    const r = calculateEstimateConfidence(-5);
    expect(r.level).toBe('insufficient');
  });
});

describe('buildEstimateHistoryComparison', () => {
  it('returns empty for empty input', () => {
    expect(buildEstimateHistoryComparison([])).toEqual([]);
  });

  it('filters out invalid samples', () => {
    const result = buildEstimateHistoryComparison([
      { exportDurationSeconds: -1, estimatedDurationSeconds: 10 },
      { exportDurationSeconds: 10, estimatedDurationSeconds: -1 },
      { exportDurationSeconds: 0, estimatedDurationSeconds: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it('computes error percent', () => {
    const result = buildEstimateHistoryComparison([
      { exportDurationSeconds: 11, estimatedDurationSeconds: 10 },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].errorPercent).toBeCloseTo(10, 0);
  });
});

describe('learnComplexityCoefficients', () => {
  it('returns empty for empty history', () => {
    const result = learnComplexityCoefficients([]);
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.learnedFactor).toBe(item.defaultFactor);
    }
  });
});

describe('applyLearnedCoefficients', () => {
  it('returns empty when all same as default', () => {
    const learned = [{ effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.35, sampleCount: 10 }];
    expect(applyLearnedCoefficients(learned)).toEqual({});
  });

  it('includes when learned differs and enough samples', () => {
    const learned = [{ effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.5, sampleCount: 10 }];
    const result = applyLearnedCoefficients(learned);
    expect(result.blur).toBe(1.5);
  });

  it('excludes when not enough samples', () => {
    const learned = [{ effectType: 'blur', defaultFactor: 1.35, learnedFactor: 1.5, sampleCount: 1 }];
    expect(applyLearnedCoefficients(learned)).toEqual({});
  });
});

describe('createDebouncedEstimator', () => {
  it('creates without throwing', () => {
    const est = createDebouncedEstimator((x: number) => x * 2, 100);
    expect(est.call).toBeDefined();
    expect(est.flush).toBeDefined();
    expect(est.cancel).toBeDefined();
    expect(est.lastResult).toBeDefined();
  });

  it('lastResult returns undefined initially', () => {
    const est = createDebouncedEstimator((x: number) => x * 2, 100);
    expect(est.lastResult()).toBeUndefined();
  });

  it('flush returns undefined when no pending call', () => {
    const est = createDebouncedEstimator((x: number) => x * 2, 100);
    expect(est.flush()).toBeUndefined();
  });

  it('cancel does not throw', () => {
    const est = createDebouncedEstimator((x: number) => x * 2, 100);
    expect(() => est.cancel()).not.toThrow();
  });
});

describe('parseExportBitrate', () => {
  it('parses plain number', () => {
    expect(parseExportBitrate('1000')).toBe(1000);
  });

  it('parses k suffix', () => {
    expect(parseExportBitrate('128k')).toBe(128_000);
  });

  it('parses K suffix', () => {
    expect(parseExportBitrate('128K')).toBe(128_000);
  });

  it('parses m suffix', () => {
    expect(parseExportBitrate('5m')).toBe(5_000_000);
  });

  it('parses M suffix', () => {
    expect(parseExportBitrate('5M')).toBe(5_000_000);
  });

  it('returns undefined for null', () => {
    expect(parseExportBitrate(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(parseExportBitrate(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseExportBitrate('')).toBeUndefined();
  });

  it('returns undefined for invalid format', () => {
    expect(parseExportBitrate('abc')).toBeUndefined();
  });

  it('returns undefined for zero', () => {
    expect(parseExportBitrate('0')).toBeUndefined();
  });

  it('returns undefined for negative', () => {
    expect(parseExportBitrate('-5k')).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(parseExportBitrate('  100k  ')).toBe(100_000);
  });

  it('handles decimal', () => {
    expect(parseExportBitrate('1.5m')).toBe(1_500_000);
  });
});

describe('calculateHistoricalExportSpeed', () => {
  it('returns undefined for undefined', () => {
    expect(calculateHistoricalExportSpeed(undefined)).toBeUndefined();
  });

  it('returns undefined for empty', () => {
    expect(calculateHistoricalExportSpeed([])).toBeUndefined();
  });

  it('computes average ratio', () => {
    const result = calculateHistoricalExportSpeed([
      { timelineDurationSeconds: 10, exportDurationSeconds: 20 },
    ]);
    expect(result).toBeCloseTo(2, 1);
  });

  it('filters invalid samples', () => {
    const result = calculateHistoricalExportSpeed([
      { timelineDurationSeconds: 0, exportDurationSeconds: 10 },
      { timelineDurationSeconds: 10, exportDurationSeconds: -1 },
      { timelineDurationSeconds: 10, exportDurationSeconds: 20 },
    ]);
    expect(result).toBeCloseTo(2, 1);
  });
});

describe('calculateHistoricalEstimateErrorPercent', () => {
  it('returns undefined for undefined inputs', () => {
    expect(calculateHistoricalEstimateErrorPercent(undefined, 10)).toBeUndefined();
    expect(calculateHistoricalEstimateErrorPercent(10, undefined)).toBeUndefined();
  });

  it('returns undefined for zero estimated', () => {
    expect(calculateHistoricalEstimateErrorPercent(0, 10)).toBeUndefined();
  });

  it('returns undefined for negative actual', () => {
    expect(calculateHistoricalEstimateErrorPercent(10, -1)).toBeUndefined();
  });

  it('computes error percent', () => {
    expect(calculateHistoricalEstimateErrorPercent(10, 12)).toBeCloseTo(20, 0);
  });

  it('uses absolute difference', () => {
    expect(calculateHistoricalEstimateErrorPercent(10, 8)).toBeCloseTo(20, 0);
  });
});

describe('estimateExportFileSizeMb', () => {
  it('estimates video file size', () => {
    const size = estimateExportFileSizeMb({
      durationSeconds: 60,
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(size).toBeGreaterThan(0);
  });

  it('estimates audio-only file size', () => {
    const size = estimateExportFileSizeMb({
      durationSeconds: 60,
      width: 1920,
      height: 1080,
      fps: 30,
      outputMode: 'audio',
    });
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(10);
  });

  it('estimates m4a file size', () => {
    const size = estimateExportFileSizeMb({
      durationSeconds: 60,
      width: 1920,
      height: 1080,
      fps: 30,
      format: 'm4a',
    });
    expect(size).toBeGreaterThan(0);
  });
});

describe('assertExportCostEffectCoverage', () => {
  it('returns true', () => {
    expect(assertExportCostEffectCoverage()).toBe(true);
  });
});
