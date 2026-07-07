import type { BeatSnapSuggestion, Clip } from './model-types';
import { round } from './time';

export const BEAT_SNAP_TOLERANCE_MS = 150;

export interface BeatSnapResult {
  snappedClipIds: string[];
  suggestions: BeatSnapSuggestion[];
}

export function findNearestBeatBinarySearch(time: number, beatTimes: number[]): number | undefined {
  const sorted = beatTimes.filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [sorted[lo]];
  if (lo > 0) candidates.push(sorted[lo - 1]);
  let best = candidates[0];
  let bestDist = Math.abs(best - time);
  for (const c of candidates) {
    const dist = Math.abs(c - time);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

export function isWithinSnapTolerance(time: number, beatTime: number): boolean {
  return Math.abs(time - beatTime) * 1000 < BEAT_SNAP_TOLERANCE_MS;
}

export function calculateBeatSnapForClips(
  clips: Clip[],
  beatTimes: number[]
): BeatSnapResult {
  const snappedClipIds: string[] = [];
  const suggestions: BeatSnapSuggestion[] = [];
  const beats = beatTimes.filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
  if (beats.length === 0) return { snappedClipIds, suggestions };

  for (const clip of clips) {
    const clipEnd = round(clip.start + clip.duration);
    const nearestStart = findNearestBeatBinarySearch(clip.start, beats);
    const nearestEnd = findNearestBeatBinarySearch(clipEnd, beats);
    let startSnapped = false;
    let endSnapped = false;

    if (nearestStart !== undefined) {
      if (isWithinSnapTolerance(clip.start, nearestStart)) {
        startSnapped = true;
      } else if (Math.abs(nearestStart - clip.start) * 1000 < 2000) {
        suggestions.push({ clipId: clip.id, edge: 'in', suggestedTime: round(nearestStart), originalTime: clip.start });
      }
    }
    if (nearestEnd !== undefined) {
      if (isWithinSnapTolerance(clipEnd, nearestEnd)) {
        endSnapped = true;
      } else if (Math.abs(nearestEnd - clipEnd) * 1000 < 2000) {
        suggestions.push({ clipId: clip.id, edge: 'out', suggestedTime: round(nearestEnd), originalTime: clipEnd });
      }
    }
    if (startSnapped || endSnapped) {
      snappedClipIds.push(clip.id);
    }
  }
  return { snappedClipIds, suggestions };
}

export function applyBeatSnapToClip(clip: Clip, edge: 'in' | 'out', suggestedTime: number): Clip {
  if (edge === 'in') {
    const diff = suggestedTime - clip.start;
    return { ...clip, start: round(suggestedTime), duration: round(clip.duration - diff), beatSnapped: true };
  }
  const clipEnd = clip.start + clip.duration;
  const diff = suggestedTime - clipEnd;
  return { ...clip, duration: round(clip.duration + diff), beatSnapped: true };
}

export function removeSuggestion(
  suggestions: BeatSnapSuggestion[],
  clipId: string,
  edge: 'in' | 'out'
): BeatSnapSuggestion[] {
  return suggestions.filter((s) => !(s.clipId === clipId && s.edge === edge));
}
