import { normalizeCachePath } from './cache/cache-key';
import type { ClipKeyframes, Timeline, Track, VideoClip } from './model';
import { round } from './time';
import type { TimelineLabelColor } from './timeline-color-labels';
import { calculateSpeedCurveSourceDuration } from './timeline';

export const TIMELINE_THUMBNAIL_WIDTH = 80;
export const TIMELINE_THUMBNAIL_TRACK_HEIGHT = 48;
export const TIMELINE_THUMBNAIL_TRACK_MIN_SPACING_PX = 72;

export interface TimelineThumbnailSamplingInput {
  clipDuration: number;
  clipPixelWidth: number;
  thumbWidth?: number;
  trimStart?: number;
  speed?: number;
  keyframes?: ClipKeyframes;
}

export interface TimelineThumbnailCachePlan {
  hits: number[];
  misses: number[];
  keys: string[];
}

export interface TimelineThumbnailTrackSamplingInput {
  zoom: number;
  trackWidth: number;
  duration?: number;
  visibleStart?: number;
  visibleEnd?: number;
}

export interface TimelineThumbnailTrackSample {
  id: string;
  time: number;
  intervalSeconds: number;
  clipId?: string;
  mediaId?: string;
  sourceTimestamp?: number;
  trackColor?: TimelineLabelColor | null;
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
  if (!input.keyframes?.speed?.length) {
    const sourceVisibleDuration = clipDuration * speed;
    const sourceSegmentDuration = sourceVisibleDuration / count;
    return Array.from({ length: count }, (_, index) => round(sourceStart + sourceSegmentDuration * (index + 0.5)));
  }
  const segmentDuration = clipDuration / count;

  return Array.from({ length: count }, (_, index) => {
    const localTime = segmentDuration * (index + 0.5);
    return round(sourceStart + calculateSpeedCurveSourceDuration(localTime, input.keyframes, speed));
  });
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

export function calculateTimelineThumbnailTrackInterval(input: Pick<TimelineThumbnailTrackSamplingInput, 'zoom' | 'trackWidth'>): number {
  const zoom = Number.isFinite(input.zoom) ? Math.max(0.001, input.zoom) : 0.001;
  const targetIntervals = [1, 2, 5, 10];
  return targetIntervals.find((interval) => interval * zoom >= TIMELINE_THUMBNAIL_TRACK_MIN_SPACING_PX) ?? 10;
}

export function calculateTimelineThumbnailTrackTimestamps(input: TimelineThumbnailTrackSamplingInput): number[] {
  const zoom = Number.isFinite(input.zoom) ? Math.max(0.001, input.zoom) : 0.001;
  const trackWidth = Number.isFinite(input.trackWidth) ? Math.max(0, input.trackWidth) : 0;
  const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration ?? 0) : trackWidth / zoom;
  if (duration <= 0 || trackWidth <= 0) {
    return [];
  }
  const intervalSeconds = calculateTimelineThumbnailTrackInterval(input);
  const visibleStart = Math.max(0, Number.isFinite(input.visibleStart) ? input.visibleStart ?? 0 : 0);
  const visibleEnd = Math.min(duration, Math.max(visibleStart, Number.isFinite(input.visibleEnd) ? input.visibleEnd ?? duration : duration));
  const start = Math.max(0, Math.floor(visibleStart / intervalSeconds) * intervalSeconds);
  const timestamps: number[] = [];
  for (let time = start; time <= visibleEnd + 0.0001; time += intervalSeconds) {
    timestamps.push(round(Math.min(duration, time)));
  }
  if (timestamps.length === 0 || timestamps[timestamps.length - 1] < visibleEnd - 0.0001) {
    timestamps.push(round(visibleEnd));
  }
  return Array.from(new Set(timestamps));
}

export function buildTimelineThumbnailTrackSamples(timeline: Timeline, input: TimelineThumbnailTrackSamplingInput): TimelineThumbnailTrackSample[] {
  const mainVideoTrack = timeline.tracks.find((track) => track.type === 'video');
  const intervalSeconds = calculateTimelineThumbnailTrackInterval(input);
  return calculateTimelineThumbnailTrackTimestamps(input).map((time) => {
    const clip = findVideoClipAtTime(mainVideoTrack, time);
    return {
      id: `${time.toFixed(3)}-${clip?.id ?? 'empty'}`,
      time,
      intervalSeconds,
      clipId: clip?.id,
      mediaId: clip?.mediaId,
      sourceTimestamp: clip ? timelineTimeToClipSourceTimestamp(clip, time) : undefined,
      trackColor: mainVideoTrack?.color ?? null
    };
  });
}

export function sortTimelineThumbnailSamplesByPriority(samples: TimelineThumbnailTrackSample[], playheadTime: number): TimelineThumbnailTrackSample[] {
  const target = Number.isFinite(playheadTime) ? Math.max(0, playheadTime) : 0;
  return [...samples].sort((left, right) => Math.abs(left.time - target) - Math.abs(right.time - target) || left.time - right.time);
}

function findVideoClipAtTime(track: Track | undefined, time: number): VideoClip | undefined {
  return track?.clips
    .filter((clip): clip is VideoClip => clip.type === 'video')
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .find((clip) => time >= clip.start && time < clip.start + clip.duration);
}

function timelineTimeToClipSourceTimestamp(clip: VideoClip, timelineTime: number): number {
  const localTime = Math.max(0, timelineTime - clip.start);
  const speed = Math.max(0.001, clip.speed ?? 1);
  return round(Math.max(0, (clip.trimStart ?? 0) + calculateSpeedCurveSourceDuration(localTime, clip.keyframes, speed)));
}
