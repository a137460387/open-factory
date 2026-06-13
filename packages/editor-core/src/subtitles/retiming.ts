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

const EPSILON = 0.000001;

export function calculateSubtitleShiftUpdates(clips: SubtitleTimingInput[], offsetSeconds: number, projectDuration: number): SubtitleTimingUpdate[] {
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
    ...clampSubtitleTiming(clip.start + offset, clip.duration, projectDuration)
  }));
}

export function calculateSubtitleScaleUpdates(
  clips: SubtitleTimingInput[],
  scale: number,
  projectDuration: number,
  minDuration = 1 / 30
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
      ...clampSubtitleTiming(start, duration, projectDuration, minDuration)
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
  maxDistance = 0.5
): SubtitleTimingUpdate | undefined {
  const peak = findNearestSubtitlePeak(clip.start, peakTimes, maxDistance);
  if (peak === undefined) {
    return undefined;
  }
  return {
    clipId: clip.id,
    ...clampSubtitleTiming(peak, clip.duration, projectDuration)
  };
}

export function calculateSubtitleBatchAdjustUpdates(
  clips: SubtitleTimingInput[],
  startDelta: number,
  endDelta: number,
  projectDuration: number,
  minDuration = 1 / 30
): SubtitleTimingUpdate[] {
  const startOffset = Number.isFinite(startDelta) ? startDelta : 0;
  const endOffset = Number.isFinite(endDelta) ? endDelta : 0;
  return normalizeSubtitleTimingInputs(clips).map((clip) => {
    const start = clip.start + startOffset;
    const end = clip.start + clip.duration + endOffset;
    return {
      clipId: clip.id,
      ...clampSubtitleTiming(start, end - start, projectDuration, minDuration)
    };
  });
}

function normalizeSubtitleTimingInputs(clips: SubtitleTimingInput[]): SubtitleTimingInput[] {
  return clips
    .filter((clip) => clip.id && Number.isFinite(clip.start) && Number.isFinite(clip.duration) && clip.duration > EPSILON)
    .map((clip) => ({ id: clip.id, start: Math.max(0, clip.start), duration: Math.max(EPSILON, clip.duration) }))
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

function clampSubtitleTiming(start: number, duration: number, projectDuration: number, minDuration = 1 / 30): { start: number; duration: number } {
  const timelineDuration = Math.max(minDuration, Number.isFinite(projectDuration) ? projectDuration : minDuration);
  const safeDuration = Math.min(timelineDuration, Math.max(minDuration, Number.isFinite(duration) ? duration : minDuration));
  const safeStart = Math.min(Math.max(0, timelineDuration - safeDuration), Math.max(0, Number.isFinite(start) ? start : 0));
  return {
    start: round(safeStart),
    duration: round(safeDuration)
  };
}
