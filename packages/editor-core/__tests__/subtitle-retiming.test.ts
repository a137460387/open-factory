import { describe, expect, it } from 'vitest';
import { calculateSubtitleBatchAdjustUpdates, calculateSubtitlePeakAlignUpdate, calculateSubtitleScaleUpdates, calculateSubtitleShiftUpdates, findNearestSubtitlePeak } from '../src';

describe('subtitle retiming helpers', () => {
  it('clamps shifted subtitle timing inside the project duration', () => {
    const updates = calculateSubtitleShiftUpdates(
      [
        { id: 'sub-a', start: 0.5, duration: 1 },
        { id: 'sub-b', start: 3.6, duration: 1 }
      ],
      2,
      5
    );

    expect(updates).toEqual([
      { clipId: 'sub-a', start: 0.9, duration: 1 },
      { clipId: 'sub-b', start: 4, duration: 1 }
    ]);
  });

  it('scales subtitle timing around the first subtitle as the anchor', () => {
    const updates = calculateSubtitleScaleUpdates(
      [
        { id: 'sub-a', start: 1, duration: 1 },
        { id: 'sub-b', start: 3, duration: 2 }
      ],
      1.5,
      10
    );

    expect(updates).toEqual([
      { clipId: 'sub-a', start: 1, duration: 1.5 },
      { clipId: 'sub-b', start: 4, duration: 3 }
    ]);
  });

  it('finds the nearest audio peak inside the subtitle alignment window only', () => {
    expect(findNearestSubtitlePeak(2, [0.9, 1.55, 2.42, 2.7], 0.5)).toBe(2.42);
    expect(findNearestSubtitlePeak(2, [1.2, 2.7], 0.5)).toBeUndefined();
  });

  it('aligns a subtitle start to the nearest valid peak and preserves duration bounds', () => {
    expect(calculateSubtitlePeakAlignUpdate({ id: 'sub-a', start: 4.9, duration: 2 }, [4.45, 5.2], 6)).toEqual({
      clipId: 'sub-a',
      start: 4,
      duration: 2
    });
    expect(calculateSubtitlePeakAlignUpdate({ id: 'sub-b', start: 3, duration: 1 }, [4], 10)).toBeUndefined();
  });

  it('batch adjusts subtitle start and end while clamping minimum duration and timeline edges', () => {
    const updates = calculateSubtitleBatchAdjustUpdates(
      [
        { id: 'late', start: 4.8, duration: 1 },
        { id: 'short', start: 1, duration: 0.2 },
        { id: '', start: 2, duration: 1 },
        { id: 'invalid', start: Number.NaN, duration: 1 }
      ],
      0.5,
      -0.3,
      5,
      0.25
    );

    expect(updates).toEqual([
      { clipId: 'short', start: 1.5, duration: 0.25 },
      { clipId: 'late', start: 4.75, duration: 0.25 }
    ]);
  });

  it('normalizes invalid scale and shift inputs to safe defaults', () => {
    expect(calculateSubtitleShiftUpdates([], 1, 10)).toEqual([]);
    expect(calculateSubtitleShiftUpdates([{ id: 'sub-a', start: -1, duration: 1 }], Number.NaN, Number.NaN)).toEqual([
      { clipId: 'sub-a', start: 0, duration: 0.033333 }
    ]);
    expect(calculateSubtitleScaleUpdates([{ id: 'sub-b', start: 1, duration: 1 }], Number.NaN, 10)).toEqual([{ clipId: 'sub-b', start: 1, duration: 1 }]);
    expect(findNearestSubtitlePeak(Number.NaN, [1])).toBeUndefined();
  });
});
