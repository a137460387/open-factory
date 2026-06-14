import { describe, expect, it } from 'vitest';
import { calculateBeatSnapUpdates, calculateBeatSplitTimesForClip, createBeatMarker, detectBeatPeaks, normalizeBeatMarkers, snapClipStartToBeat } from '../src';
import { makeAudioClip, makeTimeline, makeVideoClip } from './test-utils';

describe('beat detection helpers', () => {
  it('detects local RMS peaks with sensitivity-specific spacing', () => {
    const samples = [
      { time: 0, rms: 0.1 },
      { time: 0.25, rms: 0.8 },
      { time: 0.5, rms: 0.2 },
      { time: 0.52, rms: 0.7 },
      { time: 0.9, rms: 0.1 },
      { time: 1.2, rms: 0.6 },
      { time: 1.45, rms: 0.1 }
    ];

    expect(detectBeatPeaks(samples, 'medium')).toEqual([0.25, 0.52, 1.2]);
    expect(detectBeatPeaks(samples, 'low')).toEqual([0.25, 1.2]);
    expect(detectBeatPeaks(samples.map((sample) => ({ ...sample, rms: 0 })), 'high')).toEqual([]);
  });

  it('normalizes markers by sorting, clamping, and dropping invalid times', () => {
    expect(
      normalizeBeatMarkers(
        [
          { id: 'b', time: 3 },
          { id: '', time: -1 },
          { id: 'late', time: 99 },
          { id: 'bad', time: Number.NaN }
        ],
        4
      ).map((marker) => ({ id: marker.id, time: marker.time }))
    ).toEqual([
      { id: expect.any(String), time: 0 },
      { id: 'b', time: 3 },
      { id: 'late', time: 4 }
    ]);

    expect(createBeatMarker(1.23456, 'beat-a')).toEqual({ id: 'beat-a', time: 1.23456 });
  });

  it('calculates selected clip start updates to the nearest beat only inside the snap range', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0.88, duration: 1 }),
      makeVideoClip({ id: 'clip-b', start: 2.4, duration: 1 }),
      makeAudioClip({ id: 'audio-a', start: 4.12, duration: 1 })
    ]);

    expect(calculateBeatSnapUpdates(timeline, ['clip-a', 'clip-b', 'audio-a'], [1, 2, 4], 0.2)).toEqual([
      { clipId: 'clip-a', from: 0.88, to: 1 },
      { clipId: 'audio-a', from: 4.12, to: 4 }
    ]);
    expect(snapClipStartToBeat(timeline.tracks[0].clips[1], [1, 2, 4], 0.2)).toBe(2.4);
  });

  it('calculates clip-local beat split times inside clip bounds', () => {
    const clip = makeVideoClip({ id: 'clip-a', start: 1, duration: 3 });

    expect(calculateBeatSplitTimesForClip(clip, [0.5, 1, 1.5, 2.25, 2.25, 4, 4.1])).toEqual([0.5, 1.25]);
  });
});
