import { describe, expect, it } from 'vitest';
import { calculateSubtitleScaleUpdates, calculateSubtitleShiftUpdates, findNearestSubtitlePeak } from '../src';

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
});
