import { describe, expect, it } from 'vitest';
import {
  buildThumbnailPrerenderPlan,
  buildThumbnailPrerenderProgress,
  filterUncachedThumbnails,
  PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD,
  PRERENDER_LOW_RES_WIDTH,
  type PrerenderClipInput,
  type PrerenderVisibleRange
} from '../src/timeline-prerender';

function makeClip(overrides: Partial<PrerenderClipInput> = {}): PrerenderClipInput {
  return {
    clipId: 'clip-1',
    mediaPath: '/media/video.mp4',
    mediaId: 'media-1',
    duration: 10,
    clipPixelWidth: 800,
    ...overrides
  };
}

describe('buildThumbnailPrerenderPlan', () => {
  it('returns all tasks as remaining when no visible range provided', () => {
    const clips = [makeClip()];
    const plan = buildThumbnailPrerenderPlan(clips, new Set());
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.every((t) => t.zone === 'remaining')).toBe(true);
  });

  it('prioritizes visible zone over remaining', () => {
    const clips = [makeClip({ clipPixelWidth: 1600 })];
    const visibleRange: PrerenderVisibleRange = { startTime: 2, endTime: 6, nearbyMargin: 1 };
    const plan = buildThumbnailPrerenderPlan(clips, new Set(), visibleRange);
    const visibleTasks = plan.tasks.filter((t) => t.zone === 'visible');
    const remainingTasks = plan.tasks.filter((t) => t.zone === 'remaining');
    expect(visibleTasks.length).toBeGreaterThan(0);
    if (remainingTasks.length > 0) {
      expect(visibleTasks[0].priority).toBeLessThan(remainingTasks[0].priority);
    }
  });

  it('prioritizes nearby zone between visible and remaining', () => {
    const clips = [makeClip({ clipPixelWidth: 1600, duration: 20 })];
    const visibleRange: PrerenderVisibleRange = { startTime: 2, endTime: 4, nearbyMargin: 2 };
    const plan = buildThumbnailPrerenderPlan(clips, new Set(), visibleRange);
    const zones = plan.tasks.map((t) => t.zone);
    const visibleIdx = zones.indexOf('visible');
    const nearbyIdx = zones.indexOf('nearby');
    const remainingIdx = zones.indexOf('remaining');
    if (visibleIdx >= 0 && nearbyIdx >= 0) {
      expect(visibleIdx).toBeLessThan(nearbyIdx);
    }
    if (nearbyIdx >= 0 && remainingIdx >= 0) {
      expect(nearbyIdx).toBeLessThan(remainingIdx);
    }
  });

  it('counts cached items correctly', () => {
    const clips = [makeClip()];
    const plan = buildThumbnailPrerenderPlan(clips, new Set());
    const allKeys = plan.tasks.map((t) => t.cacheKey);
    const cachedKeys = new Set(allKeys.slice(0, 3));
    const planWithCache = buildThumbnailPrerenderPlan(clips, cachedKeys);
    expect(planWithCache.cachedCount).toBe(3);
    expect(planWithCache.tasks.length).toBe(plan.tasks.length - 3);
  });

  it('uses low resolution for large projects', () => {
    const clips = Array.from({ length: PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD + 1 }, (_, i) =>
      makeClip({ clipId: `clip-${i}`, mediaId: `media-${i}`, mediaPath: `/media/video-${i}.mp4` })
    );
    const plan = buildThumbnailPrerenderPlan(clips, new Set());
    expect(plan.lowResolution).toBe(true);
  });

  it('does not use low resolution for small projects', () => {
    const clips = [makeClip()];
    const plan = buildThumbnailPrerenderPlan(clips, new Set());
    expect(plan.lowResolution).toBe(false);
  });

  it('cross-project cache hit: same media file skips already cached keys', () => {
    const clips = [makeClip()];
    const plan1 = buildThumbnailPrerenderPlan(clips, new Set());
    const allKeys = new Set(plan1.tasks.map((t) => t.cacheKey));
    const plan2 = buildThumbnailPrerenderPlan(clips, allKeys);
    expect(plan2.tasks.length).toBe(0);
    expect(plan2.cachedCount).toBe(plan1.tasks.length + plan1.cachedCount);
  });
});

describe('buildThumbnailPrerenderProgress', () => {
  it('returns active=false when total is 0', () => {
    const progress = buildThumbnailPrerenderProgress(0, 0);
    expect(progress.active).toBe(false);
    expect(progress.fraction).toBe(0);
  });

  it('returns active=true when in progress', () => {
    const progress = buildThumbnailPrerenderProgress(5, 10);
    expect(progress.active).toBe(true);
    expect(progress.fraction).toBe(0.5);
  });

  it('returns active=false when completed equals total', () => {
    const progress = buildThumbnailPrerenderProgress(10, 10);
    expect(progress.active).toBe(false);
    expect(progress.fraction).toBe(1);
  });

  it('clamps completed to total', () => {
    const progress = buildThumbnailPrerenderProgress(15, 10);
    expect(progress.completed).toBe(10);
    expect(progress.fraction).toBe(1);
  });
});

describe('filterUncachedThumbnails', () => {
  it('returns all timestamps when cache is empty', () => {
    const result = filterUncachedThumbnails('/media/video.mp4', [1, 2, 3], new Set());
    expect(result.uncachedTimestamps).toEqual([1, 2, 3]);
    expect(result.uncachedKeys.length).toBe(3);
  });

  it('filters out already cached timestamps', () => {
    const cachedKeys = new Set(['/media/video.mp4|t=1.000', '/media/video.mp4|t=3.000']);
    const result = filterUncachedThumbnails('/media/video.mp4', [1, 2, 3], cachedKeys);
    expect(result.uncachedTimestamps).toEqual([2]);
  });
});
