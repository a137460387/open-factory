import { describe, expect, it } from 'vitest';
import {
  calculateCutFrequencyHeatmap,
  calculateEditDensityHeatmap,
  calculateTimelineHeatmap,
  calculateVolumeHeatmap,
  createTrack
} from '../src';
import { makeAudioClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline heatmap calculations', () => {
  it('calculates edit density from overlapping clips and effects per time bucket', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2, effects: [{ id: 'fx-a', type: 'blur', enabled: true, params: {} }] }),
      makeVideoClip({ id: 'clip-b', start: 1, duration: 2 })
    ]);

    const heatmap = calculateEditDensityHeatmap(timeline, { bucketSeconds: 1, duration: 3 });

    expect(heatmap.map((segment) => segment.value)).toEqual([2, 3, 1]);
    expect(heatmap.map((segment) => segment.normalized)).toEqual([0.666667, 1, 0.333333]);
  });

  it('samples average volume from clip volume keyframes', () => {
    const timeline = {
      tracks: [
        createTrack({
          id: 'track-audio',
          type: 'audio',
          name: 'Audio',
          volume: 0.5,
          clips: [
            makeAudioClip({
              id: 'clip-audio',
              trackId: 'track-audio',
              duration: 2,
              volume: 1,
              keyframes: {
                volume: [
                  { id: 'v0', time: 0, value: 0.5, easing: 'linear' },
                  { id: 'v1', time: 2, value: 1.5, easing: 'linear' }
                ]
              }
            })
          ]
        })
      ]
    };

    const heatmap = calculateVolumeHeatmap(timeline, { bucketSeconds: 1, duration: 2, samplesPerBucket: 1 });

    expect(heatmap.map((segment) => segment.value)).toEqual([0.375, 0.625]);
    expect(heatmap.map((segment) => segment.normalized)).toEqual([0.1875, 0.3125]);
  });

  it('calculates cut frequency per second from clip start times', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 0.5 }),
      makeVideoClip({ id: 'clip-b', start: 0.5, duration: 0.5 }),
      makeVideoClip({ id: 'clip-c', start: 1.2, duration: 0.5 })
    ]);

    const heatmap = calculateCutFrequencyHeatmap(timeline, { bucketSeconds: 1, duration: 2 });

    expect(heatmap.map((segment) => segment.value)).toEqual([2, 1]);
    expect(heatmap.map((segment) => segment.normalized)).toEqual([1, 0.5]);
  });

  it('dispatches heatmap type calculation through a shared entry point', () => {
    const timeline = makeTimeline([makeVideoClip({ start: 0, duration: 1 })]);

    expect(calculateTimelineHeatmap('edit-density', timeline, { duration: 1 })).toHaveLength(1);
    expect(calculateTimelineHeatmap('volume', timeline, { duration: 1 })).toHaveLength(1);
    expect(calculateTimelineHeatmap('cut-frequency', timeline, { duration: 1 })).toHaveLength(1);
  });

  it('skips muted clips in volume heatmap calculation', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-muted', trackId: 'track-video', start: 0, duration: 2, muted: true })]);

    const heatmap = calculateVolumeHeatmap(timeline, { bucketSeconds: 1, duration: 2 });

    expect(heatmap.every((segment) => segment.value === 0)).toBe(true);
  });
});
