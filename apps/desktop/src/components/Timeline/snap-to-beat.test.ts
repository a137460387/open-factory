import { describe, expect, it } from 'vitest';
import { snapToBeat } from './AudioWaveformDisplay';

describe('snapToBeat', () => {
  it('returns snapped=false when beatTimes is empty', () => {
    expect(snapToBeat(1.0, [])).toEqual({ snapped: false, time: 1.0 });
  });

  it('snaps to the nearest beat within tolerance', () => {
    const beats = [0, 0.5, 1.0, 1.5, 2.0];
    expect(snapToBeat(1.05, beats, 0.1)).toEqual({ snapped: true, time: 1.0 });
  });

  it('does not snap when outside tolerance', () => {
    const beats = [0, 0.5, 1.0, 1.5, 2.0];
    expect(snapToBeat(1.2, beats, 0.1)).toEqual({ snapped: false, time: 1.2 });
  });

  it('snaps to the exact beat time', () => {
    const beats = [0, 0.5, 1.0];
    expect(snapToBeat(0.5, beats)).toEqual({ snapped: true, time: 0.5 });
  });

  it('respects custom tolerance', () => {
    const beats = [0, 1.0, 2.0];
    // 0.3 away from 1.0, tolerance 0.5
    expect(snapToBeat(0.7, beats, 0.5)).toEqual({ snapped: true, time: 1.0 });
    // 0.3 away from 1.0, tolerance 0.2
    expect(snapToBeat(0.7, beats, 0.2)).toEqual({ snapped: false, time: 0.7 });
  });

  it('picks the closest beat when multiple are in range', () => {
    const beats = [0, 0.5, 1.0];
    // 0.45 is closer to 0.5 than to 0 or 1.0
    expect(snapToBeat(0.45, beats, 0.2)).toEqual({ snapped: true, time: 0.5 });
  });

  it('handles single beat array', () => {
    expect(snapToBeat(0.05, [0], 0.1)).toEqual({ snapped: true, time: 0 });
    expect(snapToBeat(0.5, [0], 0.1)).toEqual({ snapped: false, time: 0.5 });
  });
});
