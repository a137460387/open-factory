import { describe, expect, it } from 'vitest';
import {
  calculateCpmCurve,
  calculateOverallAvgCPM,
  classifyPacingSegments,
  analyzePacing,
  DEFAULT_WINDOW_SECONDS,
  SLOW_THRESHOLD_RATIO,
  FAST_THRESHOLD_RATIO,
  MIN_SEGMENT_DURATION
} from '../src';

describe('calculateCpmCurve', () => {
  it('returns empty for empty cuts', () => {
    expect(calculateCpmCurve([], 60)).toEqual([]);
  });

  it('returns empty for zero duration', () => {
    expect(calculateCpmCurve([0, 5], 0)).toEqual([]);
  });

  it('calculates CPM correctly for uniform cuts', () => {
    // 3 cuts in 60s timeline, 30s window, step=5s
    const cuts = [0, 20, 40];
    const curve = calculateCpmCurve(cuts, 60, 30, 5);
    expect(curve.length).toBeGreaterThan(0);
    // At t=0, window [0,30): cuts at 0,20 → 2 cuts → CPM = (2/30)*60 = 4
    expect(curve[0].cpm).toBeCloseTo(4.0, 1);
  });

  it('CPM is 0 when no cuts in window', () => {
    const cuts = [50];
    const curve = calculateCpmCurve(cuts, 100, 30, 5);
    // Early windows should have 0 CPM
    expect(curve[0].cpm).toBe(0);
  });

  it('handles single cut', () => {
    const cuts = [15];
    const curve = calculateCpmCurve(cuts, 60, 30, 5);
    // At t=0 window [0,30): 1 cut → CPM = 2
    expect(curve[0].cpm).toBeCloseTo(2.0, 1);
  });
});

describe('calculateOverallAvgCPM', () => {
  it('returns 0 for zero duration', () => {
    expect(calculateOverallAvgCPM([0, 5], 0)).toBe(0);
  });

  it('returns 0 for empty cuts', () => {
    expect(calculateOverallAvgCPM([], 60)).toBe(0);
  });

  it('calculates correct average', () => {
    // 6 cuts in 60s → (6/60)*60 = 6 CPM
    const cuts = [0, 10, 20, 30, 40, 50];
    expect(calculateOverallAvgCPM(cuts, 60)).toBeCloseTo(6.0, 1);
  });
});

describe('classifyPacingSegments', () => {
  it('returns empty segments for empty curve', () => {
    const result = classifyPacingSegments([], 6);
    expect(result.slowSegments).toEqual([]);
    expect(result.fastSegments).toEqual([]);
  });

  it('returns empty for zero avgCPM', () => {
    const result = classifyPacingSegments([{ time: 0, cpm: 1 }], 0);
    expect(result.slowSegments).toEqual([]);
    expect(result.fastSegments).toEqual([]);
  });

  it('identifies slow segments (< 60% of avg)', () => {
    const avgCPM = 10;
    // Build curve: first 25s very slow, then normal
    const curve = [
      { time: 0, cpm: 2 },   // 2 < 6 (60% of 10) → slow
      { time: 5, cpm: 3 },   // slow
      { time: 10, cpm: 2 },  // slow
      { time: 15, cpm: 3 },  // slow
      { time: 20, cpm: 2 },  // slow
      { time: 25, cpm: 10 }, // normal
      { time: 30, cpm: 10 }
    ];
    const result = classifyPacingSegments(curve, avgCPM);
    expect(result.slowSegments.length).toBe(1);
    expect(result.slowSegments[0].start).toBe(0);
    expect(result.slowSegments[0].end).toBe(25);
    // Duration = 25 >= MIN_SEGMENT_DURATION
    expect(result.slowSegments[0].end - result.slowSegments[0].start).toBeGreaterThanOrEqual(MIN_SEGMENT_DURATION);
  });

  it('identifies fast segments (> 180% of avg)', () => {
    const avgCPM = 6;
    const curve = [
      { time: 0, cpm: 15 },  // > 10.8 (180% of 6)
      { time: 5, cpm: 12 },
      { time: 10, cpm: 6 }   // normal
    ];
    const result = classifyPacingSegments(curve, avgCPM);
    expect(result.fastSegments.length).toBe(1);
  });

  it('filters out short slow segments (< 20s)', () => {
    const avgCPM = 10;
    const curve = [
      { time: 0, cpm: 2 },
      { time: 5, cpm: 2 },
      { time: 10, cpm: 10 }  // normal - segment is only 10s
    ];
    const result = classifyPacingSegments(curve, avgCPM);
    expect(result.slowSegments.length).toBe(0);
  });

  it('boundary: CPM exactly at 60% threshold is not slow', () => {
    const avgCPM = 10;
    const threshold = avgCPM * SLOW_THRESHOLD_RATIO; // 6.0
    const curve = Array.from({ length: 10 }, (_, i) => ({ time: i * 5, cpm: threshold }));
    const result = classifyPacingSegments(curve, avgCPM);
    expect(result.slowSegments.length).toBe(0);
  });
});

describe('analyzePacing', () => {
  it('produces valid pacing analysis structure', () => {
    const cuts = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    const result = analyzePacing(cuts, 100);
    expect(result.cpmCurve.length).toBeGreaterThan(0);
    expect(result.overallAvgCPM).toBeCloseTo(6.0, 1);
    expect(Array.isArray(result.slowSegments)).toBe(true);
    expect(Array.isArray(result.fastSegments)).toBe(true);
  });

  it('empty timeline returns empty analysis', () => {
    const result = analyzePacing([], 0);
    expect(result.cpmCurve).toEqual([]);
    expect(result.overallAvgCPM).toBe(0);
  });

  it('cPm curve points have time and cpm fields', () => {
    const cuts = [0, 30, 60];
    const result = analyzePacing(cuts, 90);
    for (const point of result.cpmCurve) {
      expect(typeof point.time).toBe('number');
      expect(typeof point.cpm).toBe('number');
      expect(point.cpm).toBeGreaterThanOrEqual(0);
    }
  });
});
