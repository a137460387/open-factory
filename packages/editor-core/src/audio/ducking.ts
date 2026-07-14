import { createId, type Clip, type Keyframe, type Timeline } from '../model';
import { round } from '../time';

export interface LoudnessSample {
  time: number;
  db: number;
  duration?: number;
}

export interface DuckingRegion {
  start: number;
  end: number;
  peakDb: number;
}

export interface DetectDuckingRegionsOptions {
  sampleDuration?: number;
  minRegionDuration?: number;
  mergeGap?: number;
}

export interface DuckingKeyframeOptions {
  targetRatio: number;
  attack: number;
  release: number;
  idPrefix?: string;
}

export interface DuckingKeyframePlan {
  clipId: string;
  keyframes: Keyframe<number>[];
}

export function peakToDb(peak: number, floorDb = -60): number {
  if (typeof peak !== 'number' || !Number.isFinite(peak) || peak <= 0) {
    return floorDb;
  }
  return round(Math.max(floorDb, Math.min(0, 20 * Math.log10(Math.min(1, peak)))));
}

export function detectDuckingRegions(
  samples: LoudnessSample[],
  thresholdDb: number,
  options: DetectDuckingRegionsOptions = {},
): DuckingRegion[] {
  const ordered = samples
    .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.db))
    .map((sample) => ({ ...sample, time: Math.max(0, sample.time) }))
    .sort((left, right) => left.time - right.time);
  if (ordered.length === 0) {
    return [];
  }

  const fallbackDuration = Math.max(0.001, options.sampleDuration ?? inferSampleDuration(ordered));
  const rawRegions: DuckingRegion[] = [];
  let active: DuckingRegion | undefined;

  for (let index = 0; index < ordered.length; index += 1) {
    const sample = ordered[index];
    const next = ordered[index + 1];
    const start = sample.time;
    const end = Math.max(
      start + 0.001,
      sample.time + (sample.duration ?? (next ? Math.max(0.001, next.time - sample.time) : fallbackDuration)),
    );
    if (sample.db >= thresholdDb) {
      active ??= { start, end, peakDb: sample.db };
      active.end = Math.max(active.end, end);
      active.peakDb = Math.max(active.peakDb, sample.db);
      continue;
    }
    if (active) {
      rawRegions.push(toRoundedRegion(active));
      active = undefined;
    }
  }
  if (active) {
    rawRegions.push(toRoundedRegion(active));
  }

  const minRegionDuration = Math.max(0, options.minRegionDuration ?? 0);
  return mergeDuckingRegions(rawRegions, options.mergeGap ?? 0)
    .map(toRoundedRegion)
    .filter((region) => region.end - region.start >= minRegionDuration);
}

export function buildDuckingKeyframesForClip(
  clip: Clip,
  regions: DuckingRegion[],
  options: DuckingKeyframeOptions,
): Keyframe<number>[] {
  if (!('volume' in clip)) {
    return [];
  }
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  const baseVolume = clip.volume;
  const duckedVolume = round(baseVolume * clamp(options.targetRatio, 0, 1));
  const attack = clamp(options.attack, 0, 10);
  const release = clamp(options.release, 0, 10);
  const points: Array<{ time: number; value: number; easing: Keyframe<number>['easing']; order: number }> = [];
  let order = 0;

  for (const region of regions) {
    if (region.end <= clipStart || region.start >= clipEnd) {
      continue;
    }
    const attackStart = region.start - attack;
    const duckStart = Math.max(clipStart, region.start);
    const duckEnd = Math.min(clipEnd, region.end);
    const releaseEnd = region.end + release;

    if (attackStart > clipStart && attackStart < clipEnd) {
      points.push({ time: attackStart - clipStart, value: baseVolume, easing: 'ease-in', order: order++ });
    }
    points.push({ time: duckStart - clipStart, value: duckedVolume, easing: 'linear', order: order++ });
    if (duckEnd > duckStart) {
      points.push({ time: duckEnd - clipStart, value: duckedVolume, easing: 'ease-out', order: order++ });
    }
    if (releaseEnd > clipStart && releaseEnd < clipEnd) {
      points.push({ time: releaseEnd - clipStart, value: baseVolume, easing: 'linear', order: order++ });
    }
  }

  const byTime = new Map<number, { time: number; value: number; easing: Keyframe<number>['easing']; order: number }>();
  for (const point of points) {
    const time = round(clamp(point.time, 0, clip.duration));
    const existing = byTime.get(time);
    if (!existing || point.order >= existing.order) {
      byTime.set(time, { ...point, time });
    }
  }

  return Array.from(byTime.values())
    .sort((left, right) => left.time - right.time || left.order - right.order)
    .map((point, index) => ({
      id: `${options.idPrefix ?? createId('duck')}-${clip.id}-${index}`,
      time: point.time,
      value: round(point.value),
      easing: point.easing,
    }));
}

export function buildDuckingKeyframePlan(
  timeline: Timeline,
  backgroundTrackId: string,
  regions: DuckingRegion[],
  options: DuckingKeyframeOptions,
): DuckingKeyframePlan[] {
  const track = timeline.tracks.find((item) => item.id === backgroundTrackId);
  if (!track) {
    throw new Error(`Track ${backgroundTrackId} not found`);
  }
  return track.clips
    .map((clip) => ({ clipId: clip.id, keyframes: buildDuckingKeyframesForClip(clip, regions, options) }))
    .filter((plan) => plan.keyframes.length > 0);
}

function inferSampleDuration(samples: LoudnessSample[]): number {
  const deltas = samples
    .slice(1)
    .map((sample, index) => sample.time - samples[index].time)
    .filter((delta) => delta > 0);
  if (deltas.length === 0) {
    return 0.1;
  }
  deltas.sort((left, right) => left - right);
  return deltas[Math.floor(deltas.length / 2)];
}

function mergeDuckingRegions(regions: DuckingRegion[], mergeGap: number): DuckingRegion[] {
  const gap = Math.max(0, mergeGap);
  const merged: DuckingRegion[] = [];
  for (const region of regions) {
    const previous = merged[merged.length - 1];
    if (previous && region.start - previous.end <= gap) {
      previous.end = Math.max(previous.end, region.end);
      previous.peakDb = Math.max(previous.peakDb, region.peakDb);
      continue;
    }
    merged.push({ ...region });
  }
  return merged;
}

function toRoundedRegion(region: DuckingRegion): DuckingRegion {
  return {
    start: round(region.start),
    end: round(Math.max(region.start, region.end)),
    peakDb: round(region.peakDb),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
