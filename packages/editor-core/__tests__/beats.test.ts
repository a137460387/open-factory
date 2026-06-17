import { describe, expect, it } from 'vitest';
import {
  buildBeatSyncSpeedKeyframes,
  calculateBeatAlignmentUpdates,
  calculateBeatGridLines,
  calculateBeatSnapUpdates,
  calculateBeatSplitTimesForClip,
  createBeatMarker,
  detectBeatPeaks,
  detectRmsBeatPeaks,
  estimateBpmFromBeatTimes,
  normalizeBeatMarkers,
  snapClipStartToBeat
} from '../src';
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

  it('detects strong RMS peaks in a 0.1s local-max window', () => {
    const samples = Array.from({ length: 80 }, (_, index) => ({ time: index * 0.01, rms: 0.08 }));
    for (const peak of [10, 30, 50]) {
      samples[peak - 1].rms = 0.35;
      samples[peak].rms = 1;
      samples[peak + 1].rms = 0.4;
    }

    expect(detectRmsBeatPeaks(samples, { windowSeconds: 0.1, threshold: 0.6 })).toEqual([0.1, 0.3, 0.5]);
    expect(detectRmsBeatPeaks(samples, { windowSeconds: 0.1, threshold: 0.99 })).toHaveLength(3);
  });

  it('estimates BPM from the median adjacent beat interval', () => {
    expect(estimateBpmFromBeatTimes([0, 0.5, 1, 1.5, 3.5])).toBe(120);
    expect(estimateBpmFromBeatTimes([1])).toBeUndefined();
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

  it('aligns video clip start and end only when both errors stay below 50ms', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0.97, duration: 2.07 }),
      makeVideoClip({ id: 'clip-b', start: 4.2, duration: 1 })
    ]);

    expect(calculateBeatAlignmentUpdates(timeline, ['clip-a', 'clip-b'], [1, 3, 4, 5], 0.05)).toEqual([
      { clipId: 'clip-a', fromStart: 0.97, toStart: 1, fromEnd: 3.04, toEnd: 3, startError: 0.03, endError: 0.04 }
    ]);
  });

  it('switches beat grid density between beat, measure, and four measures', () => {
    const beats = Array.from({ length: 17 }, (_, index) => index * 0.5);

    expect(calculateBeatGridLines(beats, 'beat')).toHaveLength(17);
    expect(calculateBeatGridLines(beats, 'measure')).toEqual([0, 2, 4, 6, 8]);
    expect(calculateBeatGridLines(beats, 'four-measures')).toEqual([0, 8]);
  });

  it('builds beat-sync speed keyframes for video clips only', () => {
    const video = makeVideoClip({ id: 'clip-speed', start: 1, duration: 2 });

    expect(buildBeatSyncSpeedKeyframes(video, [1, 1.4, 2.1, 3])).toEqual([
      { id: 'clip-speed-beat-speed-1', time: 0, value: 1.75, easing: 'linear' },
      { id: 'clip-speed-beat-speed-2', time: 0.4, value: 1, easing: 'linear' },
      { id: 'clip-speed-beat-speed-3', time: 1.1, value: 0.777778, easing: 'linear' },
      { id: 'clip-speed-beat-speed-4', time: 2, value: 0.777778, easing: 'linear' }
    ]);
    expect(buildBeatSyncSpeedKeyframes(makeAudioClip({ id: 'audio-speed' }), [0, 1, 2])).toEqual([]);
  });

  it('calculates clip-local beat split times inside clip bounds', () => {
    const clip = makeVideoClip({ id: 'clip-a', start: 1, duration: 3 });

    expect(calculateBeatSplitTimesForClip(clip, [0.5, 1, 1.5, 2.25, 2.25, 4, 4.1])).toEqual([0.5, 1.25]);
  });
});
