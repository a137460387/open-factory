import type { TimelineMarker } from './model-types-primitives';
import { round } from './time';

export const DEFAULT_SCENE_DETECTION_THRESHOLD = 10;
export const DEFAULT_MIN_SCENE_SECONDS = 1;
export const SCENE_DETECTION_MAX_SECONDS = 60 * 60;
export const SCENE_CUT_MARKER_COLOR = '#f97316';

export interface SceneDetectionAnalysisLimit {
  analysisDuration: number;
  limited: boolean;
  maxDuration: number;
}

export type SceneMarkerInput = Omit<TimelineMarker, 'id'> & Partial<Pick<TimelineMarker, 'id'>>;

export function normalizeSceneCutTimes(cuts: readonly number[] | undefined, maxTime?: number): number[] | undefined {
  if (!Array.isArray(cuts)) {
    return undefined;
  }
  const limit =
    typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : Number.POSITIVE_INFINITY;
  const normalized = cuts
    .filter((time) => typeof time === 'number' && Number.isFinite(time))
    .map((time) => round(Math.min(limit, Math.max(0, time))))
    .sort((left, right) => left - right);
  const unique = normalized.filter((time, index) => index === 0 || Math.abs(time - normalized[index - 1]) > 0.000001);
  return unique.length > 0 ? unique : undefined;
}

export function mapSceneDetectThreshold(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SCENE_DETECTION_THRESHOLD;
  }
  return round(Math.min(100, Math.max(0, value)));
}

export function buildScdetFilterArg(threshold: number | undefined): string {
  return `scdet=threshold=${formatFilterNumber(mapSceneDetectThreshold(threshold))}`;
}

export function filterShortSceneCuts(
  cuts: readonly number[],
  clipDuration: number,
  minSceneSeconds = DEFAULT_MIN_SCENE_SECONDS,
): number[] {
  const duration = Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0);
  const minDuration = Math.max(0, Number.isFinite(minSceneSeconds) ? minSceneSeconds : DEFAULT_MIN_SCENE_SECONDS);
  const points =
    normalizeSceneCutTimes(cuts, duration)?.filter((time) => time > 0.000001 && time < duration - 0.000001) ?? [];
  if (minDuration <= 0) {
    return points;
  }
  const accepted: number[] = [];
  let previous = 0;
  for (const point of points) {
    if (point - previous >= minDuration - 0.000001) {
      accepted.push(point);
      previous = point;
    }
  }
  while (accepted.length > 0 && duration - accepted[accepted.length - 1] < minDuration - 0.000001) {
    accepted.pop();
  }
  return accepted;
}

export function buildSceneMarkerInputs(
  cuts: readonly number[],
  clipStart = 0,
  options: { idPrefix?: string; labelPrefix?: string; color?: string } = {},
): SceneMarkerInput[] {
  const start = Number.isFinite(clipStart) ? clipStart : 0;
  const labelPrefix = options.labelPrefix ?? '场景';
  const color = options.color ?? SCENE_CUT_MARKER_COLOR;
  return (normalizeSceneCutTimes(cuts) ?? []).map((cut, index) => {
    const time = round(start + cut);
    return {
      ...(options.idPrefix ? { id: `${options.idPrefix}-${index + 1}` } : {}),
      time,
      label: `${labelPrefix} ${index + 1}`,
      color,
    };
  });
}

export function buildYoutubeChapterLines(markers: readonly Pick<TimelineMarker, 'time' | 'label'>[]): string[] {
  return [...markers]
    .filter((marker) => Number.isFinite(marker.time) && marker.label.trim())
    .sort((left, right) => left.time - right.time || left.label.localeCompare(right.label))
    .map((marker) => `${formatYoutubeChapterTime(marker.time)} ${marker.label.trim()}`);
}

export function getSceneDetectionAnalysisLimit(
  clipDuration: number,
  maxDuration = SCENE_DETECTION_MAX_SECONDS,
): SceneDetectionAnalysisLimit {
  const duration = Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0);
  const max = Math.max(1, Number.isFinite(maxDuration) ? maxDuration : SCENE_DETECTION_MAX_SECONDS);
  return {
    analysisDuration: round(Math.min(duration, max)),
    limited: duration > max + 0.000001,
    maxDuration: max,
  };
}

export function estimateSceneCutCountForThreshold(
  previousCuts: readonly number[] | undefined,
  threshold: number | undefined,
  duration?: number,
): number {
  const normalizedThreshold = mapSceneDetectThreshold(threshold);
  const cuts = normalizeSceneCutTimes(previousCuts, duration);
  if (cuts?.length) {
    const sensitivityScale = DEFAULT_SCENE_DETECTION_THRESHOLD / Math.max(1, normalizedThreshold);
    return Math.max(0, Math.round(cuts.length * sensitivityScale));
  }
  if (!duration || duration <= 0) {
    return 0;
  }
  const sensitiveFactor = (100 - normalizedThreshold) / 100;
  return Math.max(0, Math.round((duration / 30) * sensitiveFactor));
}

function formatYoutubeChapterTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFilterNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '');
}
