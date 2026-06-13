import { describe, expect, it } from 'vitest';
import { buildDuckingKeyframePlan, buildDuckingKeyframesForClip, detectDuckingRegions, peakToDb } from '../src';
import { makeAudioClip, makeImageClip, makeTimeline, makeVideoClip } from './test-utils';

describe('audio ducking', () => {
  it('detects voiced regions from loudness samples above a threshold', () => {
    const regions = detectDuckingRegions(
      [
        { time: 0, db: -48 },
        { time: 0.5, db: -18 },
        { time: 1, db: -16 },
        { time: 1.5, db: -42 },
        { time: 2, db: -24 },
        { time: 2.5, db: -22 },
        { time: 3, db: -50 }
      ],
      -30,
      { sampleDuration: 0.5 }
    );

    expect(regions).toEqual([
      { start: 0.5, end: 1.5, peakDb: -16 },
      { start: 2, end: 3, peakDb: -22 }
    ]);
  });

  it('merges close voiced regions and filters short noise bursts', () => {
    const regions = detectDuckingRegions(
      [
        { time: 0, db: -12, duration: 0.1 },
        { time: 0.14, db: -14, duration: 0.1 },
        { time: 0.3, db: -50, duration: 0.1 },
        { time: 1, db: -10, duration: 0.02 },
        { time: 2, db: -50, duration: 0.1 },
        { time: Number.NaN, db: -1 }
      ],
      -30,
      { mergeGap: 0.05, minRegionDuration: 0.05 }
    );

    expect(regions).toEqual([{ start: 0, end: 0.24, peakDb: -12 }]);
    expect(detectDuckingRegions([], -30)).toEqual([]);
  });

  it('calculates attack, ducked, and release keyframes for an overlapping background clip', () => {
    const clip = makeAudioClip({ id: 'music', start: 10, duration: 5, volume: 0.8 });
    const keyframes = buildDuckingKeyframesForClip(clip, [{ start: 11, end: 12, peakDb: -12 }], {
      targetRatio: 0.25,
      attack: 0.25,
      release: 0.5,
      idPrefix: 'duck-test'
    });

    expect(keyframes.map((frame) => [frame.time, frame.value, frame.easing])).toEqual([
      [0.75, 0.8, 'ease-in'],
      [1, 0.2, 'linear'],
      [2, 0.2, 'ease-out'],
      [2.5, 0.8, 'linear']
    ]);
  });

  it('clips regions at clip boundaries and ignores clips without volume', () => {
    const clip = makeAudioClip({ id: 'music', start: 10, duration: 2, volume: 1 });
    const keyframes = buildDuckingKeyframesForClip(
      clip,
      [
        { start: 9.5, end: 10.25, peakDb: -10 },
        { start: 20, end: 21, peakDb: -8 }
      ],
      { targetRatio: Number.NaN, attack: Number.NaN, release: 0.5, idPrefix: 'duck-edge' }
    );

    expect(keyframes.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 0],
      [0.25, 0],
      [0.75, 1]
    ]);
    expect(buildDuckingKeyframesForClip(makeImageClip(), [{ start: 0, end: 1, peakDb: -4 }], { targetRatio: 0.5, attack: 0.2, release: 0.2 })).toEqual([]);
  });

  it('builds keyframe plans only for clips on the selected background track', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'voice', trackId: 'track-video', start: 0, duration: 4 }),
      makeAudioClip({ id: 'music', trackId: 'track-audio', start: 0, duration: 4 })
    ]);
    const plan = buildDuckingKeyframePlan(timeline, 'track-audio', [{ start: 1, end: 2, peakDb: -10 }], {
      targetRatio: 0.5,
      attack: 0.5,
      release: 0.5,
      idPrefix: 'duck-plan'
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].clipId).toBe('music');
    expect(plan[0].keyframes.map((frame) => frame.time)).toEqual([0.5, 1, 2, 2.5]);
    expect(() => buildDuckingKeyframePlan(timeline, 'missing-track', [], { targetRatio: 0.5, attack: 0.1, release: 0.1 })).toThrow('Track missing-track not found');
  });

  it('converts zero and normalized peaks to clamped dB values', () => {
    expect(peakToDb(0)).toBe(-60);
    expect(peakToDb(1)).toBe(0);
    expect(peakToDb(0.5)).toBe(-6.0206);
  });
});
