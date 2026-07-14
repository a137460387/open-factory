import { round } from '../time';

export interface SubtitleTimingInput {
  id: string;
  start: number;
  duration: number;
}

export interface SubtitleTimingUpdate {
  clipId: string;
  start: number;
  duration: number;
}

export interface SubtitleAlignmentOptions {
  maxDistance?: number;
  minDuration?: number;
}

export interface SubtitleAlignmentReport {
  correctedCount: number;
  averageOffsetMs: number;
  updates: SubtitleTimingUpdate[];
}

const EPSILON = 0.000001;

export function calculateSubtitleShiftUpdates(
  clips: SubtitleTimingInput[],
  offsetSeconds: number,
  projectDuration: number,
): SubtitleTimingUpdate[] {
  const normalized = normalizeSubtitleTimingInputs(clips);
  if (normalized.length === 0) {
    return [];
  }
  const requestedOffset = Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
  const timelineDuration = Math.max(0, Number.isFinite(projectDuration) ? projectDuration : 0);
  const minStart = Math.min(...normalized.map((clip) => clip.start));
  const maxEnd = Math.max(...normalized.map((clip) => clip.start + clip.duration));
  const minOffset = -minStart;
  const maxOffset = Math.max(0, timelineDuration - maxEnd);
  const offset = Math.min(maxOffset, Math.max(minOffset, requestedOffset));
  return normalized.map((clip) => ({
    clipId: clip.id,
    ...clampSubtitleTiming(clip.start + offset, clip.duration, projectDuration),
  }));
}

export function calculateSubtitleScaleUpdates(
  clips: SubtitleTimingInput[],
  scale: number,
  projectDuration: number,
  minDuration = 1 / 30,
): SubtitleTimingUpdate[] {
  const normalized = normalizeSubtitleTimingInputs(clips);
  if (normalized.length === 0) {
    return [];
  }
  const factor = Number.isFinite(scale) ? Math.max(0.01, scale) : 1;
  const anchor = normalized[0].start;
  return normalized.map((clip) => {
    const start = anchor + (clip.start - anchor) * factor;
    const end = anchor + (clip.start + clip.duration - anchor) * factor;
    const duration = Math.max(minDuration, end - start);
    return {
      clipId: clip.id,
      ...clampSubtitleTiming(start, duration, projectDuration, minDuration),
    };
  });
}

export function findNearestSubtitlePeak(time: number, peakTimes: number[], maxDistance = 0.5): number | undefined {
  if (!Number.isFinite(time)) {
    return undefined;
  }
  const limit = Math.max(0, Number.isFinite(maxDistance) ? maxDistance : 0.5);
  let best: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const peak of peakTimes) {
    if (!Number.isFinite(peak) || peak < 0) {
      continue;
    }
    const distance = Math.abs(peak - time);
    if (distance <= limit + EPSILON && distance < bestDistance) {
      best = peak;
      bestDistance = distance;
    }
  }
  return best === undefined ? undefined : round(best);
}

export function calculateSubtitlePeakAlignUpdate(
  clip: SubtitleTimingInput,
  peakTimes: number[],
  projectDuration: number,
  maxDistance = 0.5,
): SubtitleTimingUpdate | undefined {
  const peak = findNearestSubtitlePeak(clip.start, peakTimes, maxDistance);
  if (peak === undefined) {
    return undefined;
  }
  return {
    clipId: clip.id,
    ...clampSubtitleTiming(peak, clip.duration, projectDuration),
  };
}

export function calculateSubtitleAlignmentUpdates(
  clips: SubtitleTimingInput[],
  peakTimes: number[],
  projectDuration: number,
  options: SubtitleAlignmentOptions = {},
): SubtitleAlignmentReport {
  const normalizedClips = normalizeSubtitleTimingInputs(clips);
  const normalizedPeaks = normalizeSubtitlePeakTimes(peakTimes);
  const limit = Math.max(0, Number.isFinite(options.maxDistance) ? options.maxDistance! : 0.3);
  const minDuration = Math.max(EPSILON, Number.isFinite(options.minDuration) ? options.minDuration! : 1 / 30);
  if (normalizedClips.length === 0 || normalizedPeaks.length === 0 || limit <= EPSILON) {
    return emptySubtitleAlignmentReport();
  }

  const alignment = alignSubtitleStartsToPeaks(normalizedClips, normalizedPeaks, limit);
  const updates = alignment.pairs.map((pair) => ({
    clipId: normalizedClips[pair.clipIndex].id,
    ...clampSubtitleTiming(pair.peak, normalizedClips[pair.clipIndex].duration, projectDuration, minDuration),
  }));
  return {
    correctedCount: updates.length,
    averageOffsetMs: updates.length === 0 ? 0 : Math.round((alignment.totalDistance / updates.length) * 1000),
    updates,
  };
}

export function calculateSubtitleBatchAdjustUpdates(
  clips: SubtitleTimingInput[],
  startDelta: number,
  endDelta: number,
  projectDuration: number,
  minDuration = 1 / 30,
): SubtitleTimingUpdate[] {
  const startOffset = Number.isFinite(startDelta) ? startDelta : 0;
  const endOffset = Number.isFinite(endDelta) ? endDelta : 0;
  return normalizeSubtitleTimingInputs(clips).map((clip) => {
    const start = clip.start + startOffset;
    const end = clip.start + clip.duration + endOffset;
    return {
      clipId: clip.id,
      ...clampSubtitleTiming(start, end - start, projectDuration, minDuration),
    };
  });
}

interface SubtitlePeakPair {
  clipIndex: number;
  peak: number;
  distance: number;
}

interface SubtitleAlignmentState {
  correctedCount: number;
  totalDistance: number;
  pairs: SubtitlePeakPair[];
}

function alignSubtitleStartsToPeaks(
  clips: SubtitleTimingInput[],
  peakTimes: number[],
  maxDistance: number,
): SubtitleAlignmentState {
  const states: Array<Array<SubtitleAlignmentState | undefined>> = Array.from({ length: clips.length + 1 }, () =>
    Array<SubtitleAlignmentState | undefined>(peakTimes.length + 1),
  );
  states[0][0] = { correctedCount: 0, totalDistance: 0, pairs: [] };

  for (let clipIndex = 0; clipIndex <= clips.length; clipIndex += 1) {
    for (let peakIndex = 0; peakIndex <= peakTimes.length; peakIndex += 1) {
      const current = states[clipIndex][peakIndex];
      if (!current) {
        continue;
      }
      if (clipIndex < clips.length) {
        setBetterSubtitleAlignmentState(states, clipIndex + 1, peakIndex, current);
      }
      if (peakIndex < peakTimes.length) {
        setBetterSubtitleAlignmentState(states, clipIndex, peakIndex + 1, current);
      }
      if (clipIndex < clips.length && peakIndex < peakTimes.length) {
        const distance = Math.abs(peakTimes[peakIndex] - clips[clipIndex].start);
        if (distance <= maxDistance + EPSILON && distance > EPSILON) {
          setBetterSubtitleAlignmentState(states, clipIndex + 1, peakIndex + 1, {
            correctedCount: current.correctedCount + 1,
            totalDistance: current.totalDistance + distance,
            pairs: [...current.pairs, { clipIndex, peak: peakTimes[peakIndex], distance }],
          });
        }
      }
    }
  }

  return states[clips.length][peakTimes.length] ?? { correctedCount: 0, totalDistance: 0, pairs: [] };
}

function setBetterSubtitleAlignmentState(
  states: Array<Array<SubtitleAlignmentState | undefined>>,
  clipIndex: number,
  peakIndex: number,
  candidate: SubtitleAlignmentState,
): void {
  const current = states[clipIndex][peakIndex];
  if (!current || isBetterSubtitleAlignmentState(candidate, current)) {
    states[clipIndex][peakIndex] = candidate;
  }
}

function isBetterSubtitleAlignmentState(candidate: SubtitleAlignmentState, current: SubtitleAlignmentState): boolean {
  if (candidate.correctedCount !== current.correctedCount) {
    return candidate.correctedCount > current.correctedCount;
  }
  if (Math.abs(candidate.totalDistance - current.totalDistance) > EPSILON) {
    return candidate.totalDistance < current.totalDistance;
  }
  return candidate.pairs.length < current.pairs.length;
}

function normalizeSubtitlePeakTimes(peakTimes: number[]): number[] {
  const normalized: number[] = [];
  for (const peak of peakTimes) {
    if (!Number.isFinite(peak) || peak < 0) {
      continue;
    }
    const rounded = round(peak);
    if (!normalized.some((item) => Math.abs(item - rounded) <= EPSILON)) {
      normalized.push(rounded);
    }
  }
  return normalized.sort((left, right) => left - right);
}

function emptySubtitleAlignmentReport(): SubtitleAlignmentReport {
  return { correctedCount: 0, averageOffsetMs: 0, updates: [] };
}

function normalizeSubtitleTimingInputs(clips: SubtitleTimingInput[]): SubtitleTimingInput[] {
  return clips
    .filter(
      (clip) => clip.id && Number.isFinite(clip.start) && Number.isFinite(clip.duration) && clip.duration > EPSILON,
    )
    .map((clip) => ({ id: clip.id, start: Math.max(0, clip.start), duration: Math.max(EPSILON, clip.duration) }))
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

function clampSubtitleTiming(
  start: number,
  duration: number,
  projectDuration: number,
  minDuration = 1 / 30,
): { start: number; duration: number } {
  const timelineDuration = Math.max(minDuration, Number.isFinite(projectDuration) ? projectDuration : minDuration);
  const safeDuration = Math.min(
    timelineDuration,
    Math.max(minDuration, Number.isFinite(duration) ? duration : minDuration),
  );
  const safeStart = Math.min(
    Math.max(0, timelineDuration - safeDuration),
    Math.max(0, Number.isFinite(start) ? start : 0),
  );
  return {
    start: round(safeStart),
    duration: round(safeDuration),
  };
}
