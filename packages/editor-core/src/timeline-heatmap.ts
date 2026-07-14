import { resolveAnimatedVolume } from './keyframes';
import { getTimelineDuration } from './timeline';
import type { Clip, Timeline } from './model-types';
import { round } from './time';

export type TimelineHeatmapType = 'edit-density' | 'volume' | 'cut-frequency';
export type TimelineHeatmapColorScheme = 'warm' | 'cool' | 'mono';

export interface TimelineHeatmapSegment {
  start: number;
  end: number;
  value: number;
  normalized: number;
}

export interface TimelineHeatmapOptions {
  bucketSeconds?: number;
  duration?: number;
  samplesPerBucket?: number;
}

const DEFAULT_BUCKET_SECONDS = 1;
const DEFAULT_SAMPLES_PER_BUCKET = 4;

export function calculateEditDensityHeatmap(
  timeline: Timeline,
  options: TimelineHeatmapOptions = {},
): TimelineHeatmapSegment[] {
  const buckets = createTimelineBuckets(timeline, options);
  const weightedClips = timeline.tracks.flatMap((track) =>
    track.clips.map((clip) => ({
      clip,
      weight: 1 + Math.max(0, clip.effects?.length ?? 0),
    })),
  );
  const segments = buckets.map((bucket) => {
    const value = weightedClips.reduce(
      (total, item) => (clipIntersectsBucket(item.clip, bucket.start, bucket.end) ? total + item.weight : total),
      0,
    );
    return { ...bucket, value };
  });
  return normalizeSegments(segments);
}

export function calculateVolumeHeatmap(
  timeline: Timeline,
  options: TimelineHeatmapOptions = {},
): TimelineHeatmapSegment[] {
  const buckets = createTimelineBuckets(timeline, options);
  const audioClips = timeline.tracks
    .filter((track) => track.type === 'audio' || track.type === 'video')
    .flatMap((track) =>
      track.clips
        .filter(
          (clip): clip is Extract<Clip, { type: 'audio' | 'video' }> => clip.type === 'audio' || clip.type === 'video',
        )
        .map((clip) => ({
          clip,
          trackVolume: normalizeTrackVolume(track.volume),
        })),
    );
  const samplesPerBucket = Math.max(1, Math.round(options.samplesPerBucket ?? DEFAULT_SAMPLES_PER_BUCKET));
  const segments = buckets.map((bucket) => {
    let total = 0;
    let count = 0;
    for (let index = 0; index < samplesPerBucket; index += 1) {
      const time = bucket.start + ((index + 0.5) / samplesPerBucket) * (bucket.end - bucket.start);
      for (const item of audioClips) {
        if (time < item.clip.start || time >= item.clip.start + item.clip.duration || item.clip.muted) {
          continue;
        }
        const localTime = time - item.clip.start;
        total += Math.min(2, Math.max(0, resolveAnimatedVolume(item.clip, localTime) * item.trackVolume));
        count += 1;
      }
    }
    return { ...bucket, value: count > 0 ? round(total / count) : 0 };
  });
  return normalizeSegments(segments, 2);
}

export function calculateCutFrequencyHeatmap(
  timeline: Timeline,
  options: TimelineHeatmapOptions = {},
): TimelineHeatmapSegment[] {
  const buckets = createTimelineBuckets(timeline, options);
  const cuts = timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start));
  const segments = buckets.map((bucket) => {
    const value =
      cuts.filter((cut) => cut >= bucket.start && cut < bucket.end).length / Math.max(0.001, bucket.end - bucket.start);
    return { ...bucket, value: round(value) };
  });
  return normalizeSegments(segments);
}

export function calculateTimelineHeatmap(
  type: TimelineHeatmapType,
  timeline: Timeline,
  options: TimelineHeatmapOptions = {},
): TimelineHeatmapSegment[] {
  if (type === 'volume') {
    return calculateVolumeHeatmap(timeline, options);
  }
  if (type === 'cut-frequency') {
    return calculateCutFrequencyHeatmap(timeline, options);
  }
  return calculateEditDensityHeatmap(timeline, options);
}

function createTimelineBuckets(
  timeline: Timeline,
  options: TimelineHeatmapOptions,
): Array<Pick<TimelineHeatmapSegment, 'start' | 'end'>> {
  const duration = Math.max(0, options.duration ?? getTimelineDuration(timeline));
  const bucketSeconds = Math.max(1 / 60, options.bucketSeconds ?? DEFAULT_BUCKET_SECONDS);
  const bucketCount = Math.max(1, Math.ceil(Math.max(duration, bucketSeconds) / bucketSeconds));
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = round(index * bucketSeconds);
    const end = round(Math.min(Math.max(duration, bucketSeconds), start + bucketSeconds));
    return { start, end };
  });
}

function clipIntersectsBucket(clip: Clip, start: number, end: number): boolean {
  return clip.start < end && clip.start + clip.duration > start;
}

function normalizeSegments(
  segments: Array<Omit<TimelineHeatmapSegment, 'normalized'>>,
  fixedMax?: number,
): TimelineHeatmapSegment[] {
  const max = fixedMax ?? Math.max(0, ...segments.map((segment) => segment.value));
  return segments.map((segment) => ({
    ...segment,
    value: round(segment.value),
    normalized: max > 0 ? round(Math.min(1, Math.max(0, segment.value / max))) : 0,
  }));
}

function normalizeTrackVolume(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 1;
}
