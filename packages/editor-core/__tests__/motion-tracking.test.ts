import { describe, expect, it } from 'vitest';
import { bindMotionTrackToPositionKeyframes, DEFAULT_TRANSFORM, motionTrackToPositionKeyframes, normalizeMotionTrack } from '../src';

describe('motion tracking keyframe binding', () => {
  it('normalizes motion track points by filtering invalid values and clamping time', () => {
    expect(
      normalizeMotionTrack(
        [
          { time: 2, dx: 0.2, dy: -0.1 },
          { time: Number.NaN, dx: 1, dy: 1 },
          { time: -1, dx: 200_000, dy: -200_000 },
          { time: 10, dx: 0.4, dy: 0.5 }
        ],
        3
      )
    ).toEqual([
      { time: 0, dx: 100000, dy: -100000 },
      { time: 2, dx: 0.2, dy: -0.1 },
      { time: 3, dx: 0.4, dy: 0.5 }
    ]);
  });

  it('turns motion vectors into x and y position keyframes', () => {
    const keyframes = motionTrackToPositionKeyframes(
      [
        { time: 0, dx: 0, dy: 0 },
        { time: 0.5, dx: 0.1, dy: -0.2 },
        { time: 1, dx: -0.05, dy: 0.15 }
      ],
      { ...DEFAULT_TRANSFORM, x: 0.2, y: -0.1 },
      2
    );

    expect(keyframes.x?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 0.2],
      [0.5, 0.3],
      [1, 0.15]
    ]);
    expect(keyframes.y?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, -0.1],
      [0.5, -0.3],
      [1, 0.05]
    ]);
  });

  it('returns empty keyframes when motion track points are undefined', () => {
    const keyframes = motionTrackToPositionKeyframes(undefined, DEFAULT_TRANSFORM, 2);
    expect(keyframes.x).toEqual([]);
    expect(keyframes.y).toEqual([]);
  });

  it('binds tracking data to a new keyframe set when existing is undefined', () => {
    const keyframes = bindMotionTrackToPositionKeyframes(
      undefined,
      [{ time: 0.5, dx: 0.1, dy: 0.2 }],
      DEFAULT_TRANSFORM,
      1
    );

    expect(keyframes?.x).toEqual([{ id: 'motion-track-x-0', time: 0.5, value: 0.1, easing: 'linear' }]);
    expect(keyframes?.y).toEqual([{ id: 'motion-track-y-0', time: 0.5, value: 0.2, easing: 'linear' }]);
  });

  it('replaces only position keyframes when binding tracking data', () => {
    const keyframes = bindMotionTrackToPositionKeyframes(
      {
        opacity: [{ id: 'opacity-a', time: 0, value: 1, easing: 'linear' }],
        x: [{ id: 'old-x', time: 0, value: 0.8, easing: 'linear' }]
      },
      [{ time: 0.25, dx: 0.1, dy: 0.2 }],
      DEFAULT_TRANSFORM,
      1
    );

    expect(keyframes?.opacity).toEqual([{ id: 'opacity-a', time: 0, value: 1, easing: 'linear' }]);
    expect(keyframes?.x).toEqual([{ id: 'motion-track-x-0', time: 0.25, value: 0.1, easing: 'linear' }]);
    expect(keyframes?.y).toEqual([{ id: 'motion-track-y-0', time: 0.25, value: 0.2, easing: 'linear' }]);
  });
});
