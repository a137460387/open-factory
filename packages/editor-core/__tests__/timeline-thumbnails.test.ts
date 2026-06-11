import { describe, expect, it } from 'vitest';
import { buildTimelineThumbnailCacheKey, calculateTimelineThumbnailTimestamps, planTimelineThumbnailCache } from '../src';

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
});
