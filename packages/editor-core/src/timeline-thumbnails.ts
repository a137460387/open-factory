import { normalizeCachePath } from './cache/cache-key';
import { round } from './time';

export const TIMELINE_THUMBNAIL_WIDTH = 80;

export interface TimelineThumbnailSamplingInput {
  clipDuration: number;
  clipPixelWidth: number;
  thumbWidth?: number;
  trimStart?: number;
  speed?: number;
}

export interface TimelineThumbnailCachePlan {
  hits: number[];
  misses: number[];
  keys: string[];
}

export function calculateTimelineThumbnailTimestamps(input: TimelineThumbnailSamplingInput): number[] {
  const clipDuration = Math.max(0, input.clipDuration);
  if (clipDuration <= 0) {
    return [];
  }
  const thumbWidth = Math.max(1, input.thumbWidth ?? TIMELINE_THUMBNAIL_WIDTH);
  const count = Math.max(1, Math.ceil(Math.max(1, input.clipPixelWidth) / thumbWidth));
  const sourceStart = Math.max(0, input.trimStart ?? 0);
  const speed = Math.max(0.001, input.speed ?? 1);
  const sourceVisibleDuration = clipDuration * speed;
  const segmentDuration = sourceVisibleDuration / count;

  return Array.from({ length: count }, (_, index) => round(sourceStart + segmentDuration * (index + 0.5)));
}

export function buildTimelineThumbnailCacheKey(mediaPath: string, timestamp: number): string {
  return `${normalizeCachePath(mediaPath)}|t=${round(Math.max(0, timestamp)).toFixed(3)}`;
}

export function planTimelineThumbnailCache(mediaPath: string, timestamps: number[], cachedKeys: ReadonlySet<string>): TimelineThumbnailCachePlan {
  const hits: number[] = [];
  const misses: number[] = [];
  const keys = timestamps.map((timestamp, index) => {
    const key = buildTimelineThumbnailCacheKey(mediaPath, timestamp);
    if (cachedKeys.has(key)) {
      hits.push(index);
    } else {
      misses.push(index);
    }
    return key;
  });
  return { hits, misses, keys };
}
