import {
  buildTimelineThumbnailCacheKey,
  calculateTimelineThumbnailTimestamps,
  planTimelineThumbnailCache,
  TIMELINE_THUMBNAIL_WIDTH,
} from './timeline-thumbnails';
import type { Timeline, Track, VideoClip } from './model';
import { round } from './time';

export const PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD = 200;
export const PRERENDER_LOW_RES_WIDTH = 40;

export type ThumbnailPrerenderPriorityZone = 'visible' | 'nearby' | 'remaining';

export interface ThumbnailPrerenderTask {
  clipId: string;
  mediaPath: string;
  mediaId: string;
  timestamp: number;
  cacheKey: string;
  priority: number;
  zone: ThumbnailPrerenderPriorityZone;
}

export interface ThumbnailPrerenderPlan {
  tasks: ThumbnailPrerenderTask[];
  totalCount: number;
  cachedCount: number;
  lowResolution: boolean;
}

export interface ThumbnailPrerenderProgress {
  completed: number;
  total: number;
  fraction: number;
  active: boolean;
}

export interface PrerenderClipInput {
  clipId: string;
  mediaPath: string;
  mediaId: string;
  duration: number;
  clipPixelWidth: number;
  trimStart?: number;
  speed?: number;
}

export interface PrerenderVisibleRange {
  startTime: number;
  endTime: number;
  nearbyMargin?: number;
}

export function buildThumbnailPrerenderPlan(
  clips: PrerenderClipInput[],
  cachedKeys: ReadonlySet<string>,
  visibleRange?: PrerenderVisibleRange,
  thumbWidth?: number,
): ThumbnailPrerenderPlan {
  const isLargeProject = clips.length > PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD;
  const effectiveThumbWidth = isLargeProject ? PRERENDER_LOW_RES_WIDTH : (thumbWidth ?? TIMELINE_THUMBNAIL_WIDTH);
  const tasks: ThumbnailPrerenderTask[] = [];
  let cachedCount = 0;

  for (const clip of clips) {
    const timestamps = calculateTimelineThumbnailTimestamps({
      clipDuration: clip.duration,
      clipPixelWidth: clip.clipPixelWidth,
      thumbWidth: effectiveThumbWidth,
      trimStart: clip.trimStart,
      speed: clip.speed,
    });

    const plan = planTimelineThumbnailCache(clip.mediaPath, timestamps, cachedKeys);
    cachedCount += plan.hits.length;

    for (const missIndex of plan.misses) {
      const timestamp = timestamps[missIndex];
      const cacheKey = plan.keys[missIndex];
      const zone = classifyZone(timestamp, clip.clipId, visibleRange);
      const priority = zoneToPriority(zone);
      tasks.push({
        clipId: clip.clipId,
        mediaPath: clip.mediaPath,
        mediaId: clip.mediaId,
        timestamp,
        cacheKey,
        priority,
        zone,
      });
    }
  }

  tasks.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);

  return {
    tasks,
    totalCount: tasks.length + cachedCount,
    cachedCount,
    lowResolution: isLargeProject,
  };
}

export function buildThumbnailPrerenderProgress(completed: number, total: number): ThumbnailPrerenderProgress {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal);
  return {
    completed: safeCompleted,
    total: safeTotal,
    fraction: safeTotal > 0 ? round(safeCompleted / safeTotal) : 0,
    active: safeCompleted < safeTotal && safeTotal > 0,
  };
}

export function filterUncachedThumbnails(
  mediaPath: string,
  timestamps: number[],
  cachedKeys: ReadonlySet<string>,
): { uncachedTimestamps: number[]; uncachedKeys: string[] } {
  const uncachedTimestamps: number[] = [];
  const uncachedKeys: string[] = [];
  for (const timestamp of timestamps) {
    const key = buildTimelineThumbnailCacheKey(mediaPath, timestamp);
    if (!cachedKeys.has(key)) {
      uncachedTimestamps.push(timestamp);
      uncachedKeys.push(key);
    }
  }
  return { uncachedTimestamps, uncachedKeys };
}

function classifyZone(
  timestamp: number,
  clipId: string,
  visibleRange?: PrerenderVisibleRange,
): ThumbnailPrerenderPriorityZone {
  if (!visibleRange) {
    return 'remaining';
  }
  const margin = visibleRange.nearbyMargin ?? 5;
  if (timestamp >= visibleRange.startTime && timestamp <= visibleRange.endTime) {
    return 'visible';
  }
  if (timestamp >= visibleRange.startTime - margin && timestamp <= visibleRange.endTime + margin) {
    return 'nearby';
  }
  return 'remaining';
}

function zoneToPriority(zone: ThumbnailPrerenderPriorityZone): number {
  switch (zone) {
    case 'visible':
      return 0;
    case 'nearby':
      return 1;
    case 'remaining':
      return 2;
  }
}
