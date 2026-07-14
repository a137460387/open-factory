import { createId } from './model';
import type { BeatMarker, Clip, Keyframe, Timeline } from './model-types';
import { round } from './time';

export type BeatSensitivity = 'low' | 'medium' | 'high';
export type BeatGridDensity = 'beat' | 'measure' | 'four-measures';
export type { BeatMarker } from './model-types';

export interface RmsSample {
  time: number;
  rms: number;
}

export interface BeatSnapUpdate {
  clipId: string;
  from: number;
  to: number;
}

export interface RmsBeatDetectionOptions {
  windowSeconds?: number;
  threshold?: number;
  minGapSeconds?: number;
}

export interface BeatAlignmentUpdate {
  clipId: string;
  fromStart: number;
  toStart: number;
  fromEnd: number;
  toEnd: number;
  startError: number;
  endError: number;
}

const SENSITIVITY_THRESHOLD: Record<BeatSensitivity, number> = {
  low: 0.72,
  medium: 0.55,
  high: 0.38,
};

const SENSITIVITY_MIN_GAP: Record<BeatSensitivity, number> = {
  low: 0.35,
  medium: 0.25,
  high: 0.18,
};

export function createBeatMarker(time: number, id = createId('beat')): BeatMarker {
  return {
    id,
    time: round(Math.max(0, finiteOrDefault(time, 0))),
  };
}

export function normalizeBeatMarkers(markers: BeatMarker[] | undefined, maxTime?: number): BeatMarker[] {
  const limit =
    typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : Number.POSITIVE_INFINITY;
  return [...(markers ?? [])]
    .filter((marker) => marker && typeof marker.time === 'number' && Number.isFinite(marker.time))
    .map((marker) => ({
      id: typeof marker.id === 'string' && marker.id ? marker.id : createId('beat'),
      time: round(Math.min(limit, Math.max(0, marker.time))),
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function detectRmsBeatPeaks(samples: RmsSample[], options: RmsBeatDetectionOptions = {}): number[] {
  const ordered = samples
    .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.rms))
    .map((sample) => ({ time: Math.max(0, sample.time), rms: Math.max(0, sample.rms) }))
    .sort((left, right) => left.time - right.time);
  if (ordered.length < 3) {
    return [];
  }
  const maxRms = Math.max(...ordered.map((sample) => sample.rms));
  if (maxRms <= 0) {
    return [];
  }

  const windowSeconds = Math.max(0.01, finiteOrDefault(options.windowSeconds ?? 0.1, 0.1));
  const halfWindow = windowSeconds / 2;
  const threshold =
    maxRms *
    Math.min(
      1,
      Math.max(0, finiteOrDefault(options.threshold ?? SENSITIVITY_THRESHOLD.medium, SENSITIVITY_THRESHOLD.medium)),
    );
  const minGap = Math.max(0, finiteOrDefault(options.minGapSeconds ?? windowSeconds, windowSeconds));
  const beats: number[] = [];
  let lastBeat = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (current.rms < threshold || current.time - lastBeat < minGap) {
      continue;
    }
    const isWindowMaximum = ordered.every((sample, otherIndex) => {
      if (otherIndex === index || Math.abs(sample.time - current.time) > halfWindow) {
        return true;
      }
      return current.rms >= sample.rms;
    });
    if (!isWindowMaximum) {
      continue;
    }
    beats.push(round(current.time));
    lastBeat = current.time;
  }
  return beats;
}

export function detectBeatPeaks(samples: RmsSample[], sensitivity: BeatSensitivity = 'medium'): number[] {
  const ordered = samples
    .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.rms))
    .map((sample) => ({ time: Math.max(0, sample.time), rms: Math.max(0, sample.rms) }))
    .sort((left, right) => left.time - right.time);
  if (ordered.length < 3) {
    return [];
  }
  const maxRms = Math.max(...ordered.map((sample) => sample.rms));
  if (maxRms <= 0) {
    return [];
  }
  const threshold = maxRms * SENSITIVITY_THRESHOLD[sensitivity];
  const minGap = SENSITIVITY_MIN_GAP[sensitivity];
  const beats: number[] = [];
  let lastBeat = Number.NEGATIVE_INFINITY;

  for (let index = 1; index < ordered.length - 1; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const next = ordered[index + 1];
    const isLocalMaximum = current.rms > previous.rms && current.rms >= next.rms;
    if (!isLocalMaximum || current.rms < threshold || current.time - lastBeat < minGap) {
      continue;
    }
    beats.push(round(current.time));
    lastBeat = current.time;
  }
  return beats;
}

export function estimateBpmFromBeatTimes(beatTimes: number[]): number | undefined {
  const times = normalizeBeatTimes(beatTimes);
  if (times.length < 2) {
    return undefined;
  }
  const intervals = times
    .slice(1)
    .map((time, index) => round(time - times[index]))
    .filter((interval) => interval > 0.000001)
    .sort((left, right) => left - right);
  if (intervals.length === 0) {
    return undefined;
  }
  const median = intervals[Math.floor(intervals.length / 2)];
  return round(60 / median);
}

export function estimateBpmFromBeatMarkers(markers: BeatMarker[] | undefined): number | undefined {
  return estimateBpmFromBeatTimes((markers ?? []).map((marker) => marker.time));
}

export function calculateBeatGridLines(beatTimes: number[], density: BeatGridDensity = 'beat'): number[] {
  const step = density === 'four-measures' ? 16 : density === 'measure' ? 4 : 1;
  return normalizeBeatTimes(beatTimes).filter((_time, index) => index % step === 0);
}

export function calculateBeatSnapUpdates(
  timeline: Timeline,
  clipIds: string[],
  beatTimes: number[],
  maxDistance = 0.25,
): BeatSnapUpdate[] {
  const beats = [...beatTimes].filter((time) => Number.isFinite(time) && time >= 0).sort((left, right) => left - right);
  if (beats.length === 0 || clipIds.length === 0) {
    return [];
  }
  const selected = new Set(clipIds);
  return timeline.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => selected.has(clip.id))
    .flatMap((clip) => {
      const beat = findNearestBeat(clip.start, beats, maxDistance);
      return beat === undefined || Math.abs(beat - clip.start) <= 0.000001
        ? []
        : [{ clipId: clip.id, from: clip.start, to: beat }];
    });
}

export function calculateBeatAlignmentUpdates(
  timeline: Timeline,
  clipIds: string[],
  beatTimes: number[],
  maxDistance = 0.05,
): BeatAlignmentUpdate[] {
  const beats = normalizeBeatTimes(beatTimes);
  if (beats.length === 0 || clipIds.length === 0) {
    return [];
  }
  const selected = new Set(clipIds);
  return timeline.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => selected.has(clip.id) && clip.type === 'video')
    .flatMap((clip) => {
      const clipEnd = round(clip.start + clip.duration);
      const startBeat = findNearestBeat(clip.start, beats, maxDistance);
      const endBeat = findNearestBeat(clipEnd, beats, maxDistance);
      const toStart = startBeat ?? clip.start;
      const toEnd = endBeat ?? clipEnd;
      const nextDuration = round(toEnd - toStart);
      if (nextDuration <= 0.000001) {
        return [];
      }
      if (Math.abs(toStart - clip.start) <= 0.000001 && Math.abs(toEnd - clipEnd) <= 0.000001) {
        return [];
      }
      return [
        {
          clipId: clip.id,
          fromStart: clip.start,
          toStart: round(toStart),
          fromEnd: clipEnd,
          toEnd: round(toEnd),
          startError: round(Math.abs(toStart - clip.start)),
          endError: round(Math.abs(toEnd - clipEnd)),
        },
      ];
    });
}

export function snapClipStartToBeat(clip: Clip, beatTimes: number[], maxDistance = 0.25): number {
  const nearest = findNearestBeat(clip.start, beatTimes, maxDistance);
  return nearest === undefined ? clip.start : nearest;
}

export function calculateBeatSplitTimesForClip(clip: Clip, beatTimes: number[]): number[] {
  const start = clip.start;
  const end = clip.start + clip.duration;
  const seen = new Set<number>();
  return [...beatTimes]
    .filter((time) => Number.isFinite(time) && time > start + 0.000001 && time < end - 0.000001)
    .map((time) => round(time - start))
    .filter((time) => {
      const key = Math.round(time * 1_000_000);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => left - right);
}

export function buildBeatSyncSpeedKeyframes(clip: Clip, beatTimes: number[]): Keyframe<number>[] {
  if (clip.type !== 'video') {
    return [];
  }
  const localBeats = normalizeBeatTimes(beatTimes)
    .filter((time) => time > clip.start + 0.000001 && time < clip.start + clip.duration - 0.000001)
    .map((time) => round(time - clip.start));
  const points = [0, ...localBeats, round(clip.duration)];
  if (points.length < 3) {
    return [];
  }
  const intervals = points
    .slice(1)
    .map((time, index) => round(time - points[index]))
    .filter((interval) => interval > 0.000001)
    .sort((left, right) => left - right);
  if (intervals.length === 0) {
    return [];
  }
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  const frames: Keyframe<number>[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previousInterval = index > 0 ? points[index] - points[index - 1] : undefined;
    const nextInterval = index < points.length - 1 ? points[index + 1] - points[index] : undefined;
    const interval = nextInterval ?? previousInterval ?? medianInterval;
    const speed = round(Math.min(4, Math.max(0.25, medianInterval / Math.max(0.000001, interval))));
    frames.push({
      id: `${clip.id}-beat-speed-${index + 1}`,
      time: round(points[index]),
      value: speed,
      easing: 'linear',
    });
  }
  return frames;
}

function findNearestBeat(time: number, beatTimes: number[], maxDistance: number): number | undefined {
  let best: number | undefined;
  let bestDistance = Math.max(0, maxDistance);
  for (const beat of beatTimes) {
    const distance = Math.abs(beat - time);
    if (distance <= bestDistance) {
      best = beat;
      bestDistance = distance;
    }
  }
  return best;
}

function normalizeBeatTimes(beatTimes: number[]): number[] {
  return Array.from(
    new Set(beatTimes.filter((time) => Number.isFinite(time) && time >= 0).map((time) => round(time))),
  ).sort((left, right) => left - right);
}

function finiteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
