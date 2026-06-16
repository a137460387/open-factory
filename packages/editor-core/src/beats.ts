import { createId } from './model';
import type { BeatMarker, Clip, Timeline } from './model-types';
import { round } from './time';

export type BeatSensitivity = 'low' | 'medium' | 'high';
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

const SENSITIVITY_THRESHOLD: Record<BeatSensitivity, number> = {
  low: 0.72,
  medium: 0.55,
  high: 0.38
};

const SENSITIVITY_MIN_GAP: Record<BeatSensitivity, number> = {
  low: 0.35,
  medium: 0.25,
  high: 0.18
};

export function createBeatMarker(time: number, id = createId('beat')): BeatMarker {
  return {
    id,
    time: round(Math.max(0, finiteOrDefault(time, 0)))
  };
}

export function normalizeBeatMarkers(markers: BeatMarker[] | undefined, maxTime?: number): BeatMarker[] {
  const limit = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : Number.POSITIVE_INFINITY;
  return [...(markers ?? [])]
    .filter((marker) => marker && typeof marker.time === 'number' && Number.isFinite(marker.time))
    .map((marker) => ({ id: typeof marker.id === 'string' && marker.id ? marker.id : createId('beat'), time: round(Math.min(limit, Math.max(0, marker.time))) }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
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

export function calculateBeatSnapUpdates(timeline: Timeline, clipIds: string[], beatTimes: number[], maxDistance = 0.25): BeatSnapUpdate[] {
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
      return beat === undefined || Math.abs(beat - clip.start) <= 0.000001 ? [] : [{ clipId: clip.id, from: clip.start, to: beat }];
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

function finiteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
