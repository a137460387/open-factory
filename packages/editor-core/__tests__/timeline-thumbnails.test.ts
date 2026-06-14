import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  buildTimelineThumbnailCacheKey,
  buildTimelineThumbnailTrackSamples,
  calculateTimelineThumbnailTimestamps,
  calculateTimelineThumbnailTrackInterval,
  calculateTimelineThumbnailTrackTimestamps,
  createTrack,
  planTimelineThumbnailCache,
  sortTimelineThumbnailSamplesByPriority,
  type Timeline,
  type VideoClip
} from '../src';

describe('timeline thumbnail sampling', () => {
  it('samples one thumbnail per 80px tile at the current zoom width', () => {
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 4, clipPixelWidth: 320 })).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 4, clipPixelWidth: 120 })).toEqual([1, 3]);
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 4, clipPixelWidth: 20 })).toEqual([2]);
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 2, clipPixelWidth: 160, thumbWidth: 40 })).toEqual([0.25, 0.75, 1.25, 1.75]);
  });

  it('returns no timestamps for empty clips and clamps invalid sampling inputs', () => {
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 0, clipPixelWidth: 160 })).toEqual([]);
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: -1, clipPixelWidth: 160 })).toEqual([]);
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 1, clipPixelWidth: 0, trimStart: -1, speed: 0 })).toEqual([0.0005]);
  });

  it('accounts for trim and speed when mapping display time to source timestamps', () => {
    expect(calculateTimelineThumbnailTimestamps({ clipDuration: 2, clipPixelWidth: 160, trimStart: 1, speed: 2 })).toEqual([2, 4]);
  });

  it('accounts for speed keyframes when mapping thumbnail timestamps', () => {
    expect(
      calculateTimelineThumbnailTimestamps({
        clipDuration: 1,
        clipPixelWidth: 160,
        speed: 1,
        keyframes: {
          speed: [
            { id: 'speed-a', time: 0, value: 1, easing: 'linear' },
            { id: 'speed-b', time: 1, value: 2, easing: 'linear' }
          ]
        }
      })
    ).toEqual([0.28125, 1.03125]);
  });

  it('reports cache hits and misses for requested timestamps', () => {
    const path = 'D:\\Media\\clip.mp4';
    const timestamps = [0.5, 1.5, 2.5];
    const cached = new Set([buildTimelineThumbnailCacheKey(path, 0.5), buildTimelineThumbnailCacheKey(path, 2.5)]);

    expect(planTimelineThumbnailCache(path, timestamps, cached)).toEqual({
      hits: [0, 2],
      misses: [1],
      keys: [
        'd:/media/clip.mp4|t=0.500',
        'd:/media/clip.mp4|t=1.500',
        'd:/media/clip.mp4|t=2.500'
      ]
    });
  });

  it('samples the thumbnail track at readable zoom-adaptive intervals', () => {
    expect(calculateTimelineThumbnailTrackInterval({ zoom: 6, trackWidth: 600 })).toBe(10);
    expect(calculateTimelineThumbnailTrackInterval({ zoom: 96, trackWidth: 600 })).toBe(1);
    expect(calculateTimelineThumbnailTrackTimestamps({ zoom: 10, trackWidth: 200, duration: 20 })).toEqual([0, 10, 20]);
    expect(calculateTimelineThumbnailTrackTimestamps({ zoom: 100, trackWidth: 500, duration: 5 })).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('normalizes empty thumbnail track sampling inputs and visible windows', () => {
    expect(calculateTimelineThumbnailTrackTimestamps({ zoom: Number.NaN, trackWidth: 0, duration: 10 })).toEqual([]);
    expect(calculateTimelineThumbnailTrackTimestamps({ zoom: 20, trackWidth: 400, duration: 20, visibleStart: 8, visibleEnd: 11 })).toEqual([5, 10, 11]);
  });

  it('maps thumbnail track timestamps to the main video track source media', () => {
    const clip = makeVideoClip('clip-a', 'media-a', 10, { trimStart: 2, speed: 2 });
    const timeline: Timeline = {
      tracks: [
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', color: 'green', clips: [clip] })
      ],
      transitions: [],
      markers: []
    };

    expect(buildTimelineThumbnailTrackSamples(timeline, { zoom: 100, trackWidth: 300, duration: 3 }).slice(0, 3)).toEqual([
      expect.objectContaining({ time: 0, clipId: 'clip-a', mediaId: 'media-a', sourceTimestamp: 2, trackColor: 'green' }),
      expect.objectContaining({ time: 1, clipId: 'clip-a', mediaId: 'media-a', sourceTimestamp: 4, trackColor: 'green' }),
      expect.objectContaining({ time: 2, clipId: 'clip-a', mediaId: 'media-a', sourceTimestamp: 6, trackColor: 'green' })
    ]);
  });

  it('prioritizes thumbnail work closest to the current playhead', () => {
    const samples = [0, 10, 20, 30].map((time) => ({ id: String(time), time, intervalSeconds: 10 }));

    expect(sortTimelineThumbnailSamplesByPriority(samples, 18).map((sample) => sample.time)).toEqual([20, 10, 30, 0]);
  });
});

function makeVideoClip(id: string, mediaId: string, duration: number, options: { trimStart?: number; speed?: number } = {}): VideoClip {
  return {
    id,
    type: 'video',
    name: id,
    trackId: 'track-video',
    mediaId,
    start: 0,
    duration,
    trimStart: options.trimStart ?? 0,
    trimEnd: 0,
    speed: options.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}
