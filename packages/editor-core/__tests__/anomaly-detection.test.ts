import { describe, expect, it } from 'vitest';
import {
  classifyBlackFrameSeverity,
  classifyStaticSeverity,
  detectAnomalies,
  detectBlackFrameIntervals,
  detectStaticIntervals,
  isBlackFrame,
  mergeAdjacentIntervals,
  type FrameAnalysisSample
} from '../src';

describe('black frame detection', () => {
  it('identifies frames below luma threshold as black', () => {
    expect(isBlackFrame(3)).toBe(true);
    expect(isBlackFrame(7.99)).toBe(true);
    expect(isBlackFrame(8)).toBe(false);
    expect(isBlackFrame(100)).toBe(false);
    expect(isBlackFrame(Number.NaN)).toBe(false);
  });

  it('classifies black frame severity by duration', () => {
    expect(classifyBlackFrameSeverity(0.5)).toBe('low');
    expect(classifyBlackFrameSeverity(1.5)).toBe('medium');
    expect(classifyBlackFrameSeverity(4)).toBe('high');
  });
});

describe('interval merging', () => {
  it('merges adjacent times within gap threshold', () => {
    const merged = mergeAdjacentIntervals([0, 0.5, 0.8, 2, 2.5], 1.0);
    expect(merged).toHaveLength(2);
    expect(merged[0].startTime).toBe(0);
    expect(merged[0].endTime).toBe(0.8);
    expect(merged[1].startTime).toBe(2);
    expect(merged[1].endTime).toBe(2.5);
  });

  it('returns empty for empty input', () => {
    expect(mergeAdjacentIntervals([])).toEqual([]);
  });

  it('handles single time', () => {
    expect(mergeAdjacentIntervals([5])).toEqual([{ startTime: 5, endTime: 5 }]);
  });
});

describe('black frame interval detection', () => {
  it('detects black frame intervals from samples', () => {
    const samples: FrameAnalysisSample[] = [
      { time: 0, lumaMean: 100, grayscaleDiff: 5 },
      { time: 1, lumaMean: 3, grayscaleDiff: 0.5 },
      { time: 2, lumaMean: 5, grayscaleDiff: 0.3 },
      { time: 3, lumaMean: 100, grayscaleDiff: 5 }
    ];
    const intervals = detectBlackFrameIntervals(samples);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].type).toBe('black');
    expect(intervals[0].startTime).toBe(1);
    expect(intervals[0].endTime).toBe(3);
  });
});

describe('static interval detection', () => {
  it('detects static intervals with low grayscale diff', () => {
    const samples: FrameAnalysisSample[] = [];
    for (let t = 0; t < 7; t++) {
      samples.push({ time: t, lumaMean: 50, grayscaleDiff: 0.5 });
    }
    const intervals = detectStaticIntervals(samples);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].type).toBe('static');
    expect(intervals[0].severity).toBe('medium');
  });

  it('classifies static severity by duration', () => {
    expect(classifyStaticSeverity(3)).toBe('low');
    expect(classifyStaticSeverity(7)).toBe('medium');
    expect(classifyStaticSeverity(15)).toBe('high');
  });

  it('ignores short static sequences', () => {
    const samples: FrameAnalysisSample[] = [];
    for (let t = 0; t < 3; t++) {
      samples.push({ time: t, lumaMean: 50, grayscaleDiff: 0.5 });
    }
    expect(detectStaticIntervals(samples)).toHaveLength(0);
  });
});

describe('combined anomaly detection', () => {
  it('detects both black and static anomalies', () => {
    const samples: FrameAnalysisSample[] = [
      { time: 0, lumaMean: 3, grayscaleDiff: 0.1 },
      { time: 1, lumaMean: 5, grayscaleDiff: 0.2 },
      { time: 2, lumaMean: 3, grayscaleDiff: 0.1 },
      { time: 3, lumaMean: 100, grayscaleDiff: 15 },
      { time: 4, lumaMean: 50, grayscaleDiff: 0.3 },
      { time: 5, lumaMean: 50, grayscaleDiff: 0.4 },
      { time: 6, lumaMean: 50, grayscaleDiff: 0.2 },
      { time: 7, lumaMean: 50, grayscaleDiff: 0.5 },
      { time: 8, lumaMean: 50, grayscaleDiff: 0.3 },
      { time: 9, lumaMean: 50, grayscaleDiff: 0.4 }
    ];
    const anomalies = detectAnomalies(samples);
    expect(anomalies.some((a) => a.type === 'black')).toBe(true);
    expect(anomalies.some((a) => a.type === 'static')).toBe(true);
  });
});
