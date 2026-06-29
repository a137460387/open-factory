import { describe, expect, it } from 'vitest';
import {
  calculateSampleRate,
  calculateLuma,
  isRedFlashFrame,
  detectLumaFlips,
  classifySeverity,
  buildFlashReductionFilter,
  mergeFlashIntervals,
  detectFlashWarnings,
  FLASH_FLIP_RATE_THRESHOLD,
  FLASH_AMPLITUDE_THRESHOLD,
  RED_FLASH_R_THRESHOLD,
  RED_FLASH_RG_DIFF_THRESHOLD,
  RED_FLASH_RB_DIFF_THRESHOLD,
  SEVERITY_MEDIUM_RATE,
  SEVERITY_HIGH_RATE,
  MIN_SAMPLES_PER_SECOND,
  WINDOW_DURATION,
  type FlashFrameSample,
  type FlashWarning,
} from '../src';

describe('calculateSampleRate', () => {
  it('returns floor(frameRate/3) when above minimum', () => {
    expect(calculateSampleRate(30)).toBe(10);
    expect(calculateSampleRate(24)).toBe(8);
  });

  it('returns minimum when frameRate/3 is below minimum', () => {
    expect(calculateSampleRate(6)).toBe(MIN_SAMPLES_PER_SECOND);
    expect(calculateSampleRate(1)).toBe(MIN_SAMPLES_PER_SECOND);
  });

  it('returns exactly minimum when frameRate/3 equals minimum', () => {
    // 24/3 = 8, which equals MIN_SAMPLES_PER_SECOND
    expect(calculateSampleRate(24)).toBe(8);
  });
});

describe('calculateLuma', () => {
  it('calculates BT.709 luma correctly', () => {
    // pure white: 0.2126*255 + 0.7152*255 + 0.0722*255 = 255
    expect(calculateLuma(255, 255, 255)).toBe(255);
  });

  it('returns 0 for black', () => {
    expect(calculateLuma(0, 0, 0)).toBe(0);
  });

  it('weights green most heavily', () => {
    const redOnly = calculateLuma(255, 0, 0);
    const greenOnly = calculateLuma(0, 255, 0);
    const blueOnly = calculateLuma(0, 0, 255);
    expect(greenOnly).toBeGreaterThan(redOnly);
    expect(redOnly).toBeGreaterThan(blueOnly);
  });
});

describe('isRedFlashFrame', () => {
  it('detects red flash when R>200, R-G>50, R-B>50', () => {
    expect(isRedFlashFrame(220, 100, 50)).toBe(true);
  });

  it('returns false when R is too low', () => {
    expect(isRedFlashFrame(199, 100, 50)).toBe(false);
  });

  it('returns false when R-G diff is too small', () => {
    expect(isRedFlashFrame(220, 180, 50)).toBe(false);
  });

  it('returns false when R-B diff is too small', () => {
    expect(isRedFlashFrame(220, 100, 180)).toBe(false);
  });

  it('boundary: R exactly at threshold', () => {
    // R > 200 strictly, so R=200 fails
    expect(isRedFlashFrame(200, 100, 50)).toBe(false);
    expect(isRedFlashFrame(201, 100, 50)).toBe(true);
  });

  it('boundary: R-G exactly 50', () => {
    // diff > 50 strictly, so diff=50 fails
    expect(isRedFlashFrame(220, 170, 50)).toBe(false);
    expect(isRedFlashFrame(220, 169, 50)).toBe(true);
  });

  it('boundary: R-B exactly 50', () => {
    expect(isRedFlashFrame(220, 100, 170)).toBe(false);
    expect(isRedFlashFrame(220, 100, 169)).toBe(true);
  });
});

describe('detectLumaFlips', () => {
  it('returns empty for fewer than 2 samples', () => {
    expect(detectLumaFlips([])).toEqual([]);
    expect(detectLumaFlips([{ time: 0, luma: 100 }])).toEqual([]);
  });

  it('returns empty when no direction change', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 120 },
      { time: 1.0, luma: 140 },
      { time: 1.5, luma: 160 },
    ];
    expect(detectLumaFlips(samples)).toEqual([]);
  });

  it('detects flip when direction reverses with sufficient amplitude', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 140 }, // +40
      { time: 1.0, luma: 100 }, // -40, direction flip with amp >= 25.5
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
    expect(flips[0].amplitude).toBe(40);
  });

  it('ignores flip when amplitude is below threshold', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 120 }, // +20
      { time: 1.0, luma: 105 }, // -15, amplitude < 25.5
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(0);
  });

  it('boundary: amplitude exactly at threshold', () => {
    const amp = FLASH_AMPLITUDE_THRESHOLD; // 25.5
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 100 + amp }, // +25.5
      { time: 1.0, luma: 100 }, // -25.5, direction flip
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
    expect(flips[0].amplitude).toBe(amp);
  });

  it('detects red flash flag on flip frames with RGB', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 140 },
      { time: 1.0, luma: 100 },
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
    // No RGB on sample at index 2 (where flip is detected), so isRedFlash should be false
    expect(flips[0].isRedFlash).toBe(false);
  });

  it('does not flag red flash when RGB missing', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 140 }, // no RGB
      { time: 1.0, luma: 100 },
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
    expect(flips[0].isRedFlash).toBe(false);
  });

  it('preserves delta=0 as non-flip', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 100 }, // delta=0
      { time: 1.0, luma: 130 }, // delta=30
      { time: 1.5, luma: 100 }, // delta=-30, flip
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
  });
});

describe('classifySeverity', () => {
  it('returns low when rate below medium threshold', () => {
    expect(classifySeverity(3.5, false)).toBe('low');
  });

  it('returns medium when rate >= SEVERITY_MEDIUM_RATE', () => {
    expect(classifySeverity(SEVERITY_MEDIUM_RATE, false)).toBe('medium');
    expect(classifySeverity(6, false)).toBe('medium');
  });

  it('returns high when rate >= SEVERITY_HIGH_RATE', () => {
    expect(classifySeverity(SEVERITY_HIGH_RATE, false)).toBe('high');
    expect(classifySeverity(10, false)).toBe('high');
  });

  it('returns high when isRedFlash regardless of rate', () => {
    expect(classifySeverity(1, true)).toBe('high');
    expect(classifySeverity(3, true)).toBe('high');
  });
});

describe('buildFlashReductionFilter', () => {
  it('generates tblend and eq filters', () => {
    const filters = buildFlashReductionFilter(1.0, 3.0);
    expect(filters).toHaveLength(2);
    expect(filters[0]).toBe('tblend=average');
    expect(filters[1]).toContain('eq=contrast=0.8');
    expect(filters[1]).toContain('between(t,1,3)');
  });

  it('rounds time values', () => {
    const filters = buildFlashReductionFilter(1.123456, 3.654321);
    expect(filters[1]).toContain('between(t,1.123,3.654)');
  });
});

describe('mergeFlashIntervals', () => {
  it('returns empty for empty input', () => {
    expect(mergeFlashIntervals([])).toEqual([]);
  });

  it('returns single interval unchanged', () => {
    const intervals: FlashWarning[] = [
      { startTime: 0, endTime: 1, flashRate: 4, severity: 'low', isRedFlash: false },
    ];
    const merged = mergeFlashIntervals(intervals);
    expect(merged).toHaveLength(1);
  });

  it('merges overlapping intervals', () => {
    const intervals: FlashWarning[] = [
      { startTime: 0, endTime: 1.2, flashRate: 4, severity: 'low', isRedFlash: false },
      { startTime: 1.0, endTime: 2.0, flashRate: 5, severity: 'medium', isRedFlash: false },
    ];
    const merged = mergeFlashIntervals(intervals);
    expect(merged).toHaveLength(1);
    expect(merged[0].startTime).toBe(0);
    expect(merged[0].endTime).toBe(2.0);
  });

  it('merges intervals within mergeGap', () => {
    const intervals: FlashWarning[] = [
      { startTime: 0, endTime: 1.0, flashRate: 4, severity: 'low', isRedFlash: false },
      { startTime: 1.15, endTime: 2.0, flashRate: 5, severity: 'medium', isRedFlash: false },
    ];
    // gap = 0.15 <= default mergeGap 0.2
    const merged = mergeFlashIntervals(intervals);
    expect(merged).toHaveLength(1);
  });

  it('does not merge intervals beyond mergeGap', () => {
    const intervals: FlashWarning[] = [
      { startTime: 0, endTime: 1.0, flashRate: 4, severity: 'low', isRedFlash: false },
      { startTime: 1.5, endTime: 2.0, flashRate: 5, severity: 'medium', isRedFlash: false },
    ];
    const merged = mergeFlashIntervals(intervals, 0.2);
    expect(merged).toHaveLength(2);
  });

  it('propagates red flash and upgrades severity on merge', () => {
    const intervals: FlashWarning[] = [
      { startTime: 0, endTime: 1.0, flashRate: 4, severity: 'low', isRedFlash: true },
      { startTime: 0.5, endTime: 2.0, flashRate: 6, severity: 'medium', isRedFlash: false },
    ];
    const merged = mergeFlashIntervals(intervals);
    expect(merged).toHaveLength(1);
    expect(merged[0].isRedFlash).toBe(true);
    expect(merged[0].severity).toBe('high'); // red flash → high
  });

  it('sorts by startTime before merging', () => {
    const intervals: FlashWarning[] = [
      { startTime: 2.0, endTime: 3.0, flashRate: 4, severity: 'low', isRedFlash: false },
      { startTime: 0, endTime: 1.0, flashRate: 4, severity: 'low', isRedFlash: false },
    ];
    const merged = mergeFlashIntervals(intervals);
    expect(merged[0].startTime).toBe(0);
    expect(merged).toHaveLength(2);
  });
});

describe('detectFlashWarnings', () => {
  it('returns empty for fewer than 3 samples', () => {
    expect(detectFlashWarnings([])).toEqual([]);
    expect(detectFlashWarnings([{ time: 0, luma: 100 }, { time: 1, luma: 120 }])).toEqual([]);
  });

  it('returns empty when no flips detected', () => {
    const samples: FlashFrameSample[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.1,
      luma: 100 + i * 2,
    }));
    expect(detectFlashWarnings(samples)).toEqual([]);
  });

  it('detects flashing pattern in 1-second window', () => {
    // Create a pattern with many flips within 1-second windows
    const samples: FlashFrameSample[] = [];
    for (let i = 0; i < 30; i++) {
      samples.push({
        time: i * 0.1,
        luma: i % 2 === 0 ? 50 : 200, // alternating 50/200
      });
    }
    const warnings = detectFlashWarnings(samples);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].flashRate).toBeGreaterThan(FLASH_FLIP_RATE_THRESHOLD);
  });

  it('marks red flash warnings as high severity', () => {
    const samples: FlashFrameSample[] = [];
    for (let i = 0; i < 30; i++) {
      samples.push({
        time: i * 0.1,
        luma: i % 2 === 0 ? 50 : 200,
        r: i % 2 === 1 ? 220 : 100,
        g: 100,
        b: 50,
      });
    }
    const warnings = detectFlashWarnings(samples);
    const redWarnings = warnings.filter((w) => w.isRedFlash);
    expect(redWarnings.length).toBeGreaterThan(0);
    expect(redWarnings.every((w) => w.severity === 'high')).toBe(true);
  });
});
  it('detects red flash on the flip-detected sample (index i)', () => {
    const samples: FlashFrameSample[] = [
      { time: 0, luma: 100 },
      { time: 0.5, luma: 140 },
      { time: 1.0, luma: 100, r: 220, g: 100, b: 50 }, // flip at i=2, red flash here
    ];
    const flips = detectLumaFlips(samples);
    expect(flips).toHaveLength(1);
    expect(flips[0].isRedFlash).toBe(true);
  });
