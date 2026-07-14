import { round } from './time';
import { calculateBeatGridLines, type BeatGridDensity } from './beats';
import {
  findTimelineSnapTarget,
  type SnapEdge,
  type TimelineSnapInput,
  type TimelineSnapTarget,
} from './timeline-snapping';

export type TimelineGridUnit =
  'frame' | '5-frames' | '10-frames' | 'second' | '5-seconds' | 'beat' | 'measure' | 'four-measures';

export interface TimelineGridSettings {
  enabled: boolean;
  unit: TimelineGridUnit;
}

export interface TimelineGridLine {
  time: number;
  major: boolean;
}

export interface TimelineGridBuildInput {
  unit: TimelineGridUnit;
  fps: number;
  duration: number;
  visibleStart: number;
  visibleEnd: number;
  zoom: number;
  viewportWidth: number;
  beatTimes?: number[];
  minPixelSpacing?: number;
}

export interface TimelineGridSnapInput {
  clipStart: number;
  clipDuration: number;
  unit: TimelineGridUnit;
  fps: number;
  pixelsPerSecond: number;
  disabled?: boolean;
  thresholdPx?: number;
  edges?: SnapEdge[];
  beatTimes?: number[];
}

export interface TimelineGridTimeSnapInput {
  time: number;
  unit: TimelineGridUnit;
  fps: number;
  pixelsPerSecond: number;
  disabled?: boolean;
  thresholdPx?: number;
  beatTimes?: number[];
}

export type TimelineSnapInputWithGrid = TimelineSnapInput & {
  grid?: Omit<
    TimelineGridSnapInput,
    'clipStart' | 'clipDuration' | 'pixelsPerSecond' | 'disabled' | 'thresholdPx' | 'edges'
  > & {
    enabled?: boolean;
  };
};

export const DEFAULT_TIMELINE_GRID_SETTINGS: TimelineGridSettings = {
  enabled: false,
  unit: 'frame',
};

const DEFAULT_GRID_MIN_PIXEL_SPACING = 8;
const DEFAULT_GRID_SNAP_THRESHOLD_PX = 8;
const EPSILON = 0.000001;

export function normalizeTimelineGridSettings(value: unknown): TimelineGridSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_TIMELINE_GRID_SETTINGS };
  }
  const input = value as Partial<TimelineGridSettings>;
  return {
    enabled: input.enabled === true,
    unit: normalizeTimelineGridUnit(input.unit),
  };
}

export function normalizeTimelineGridUnit(value: unknown): TimelineGridUnit {
  return value === 'frame' ||
    value === '5-frames' ||
    value === '10-frames' ||
    value === 'second' ||
    value === '5-seconds' ||
    value === 'beat' ||
    value === 'measure' ||
    value === 'four-measures'
    ? value
    : 'frame';
}

export function getTimelineGridIntervalSeconds(unit: TimelineGridUnit, fps: number): number | undefined {
  const safeFps = Math.max(1, fps || 30);
  if (unit === 'frame') {
    return 1 / safeFps;
  }
  if (unit === '5-frames') {
    return 5 / safeFps;
  }
  if (unit === '10-frames') {
    return 10 / safeFps;
  }
  if (unit === 'second') {
    return 1;
  }
  if (unit === '5-seconds') {
    return 5;
  }
  return undefined;
}

export function buildTimelineGridLines(input: TimelineGridBuildInput): TimelineGridLine[] {
  if (input.duration <= 0 || input.zoom <= 0 || input.viewportWidth <= 0 || input.visibleEnd < input.visibleStart) {
    return [];
  }

  if (isBeatGridUnit(input.unit)) {
    return filterDenseGridLines(
      buildBeatGridTimes(input.beatTimes, beatGridDensityForUnit(input.unit)).map((time, index) => ({
        time,
        major: input.unit !== 'beat' || index % 4 === 0,
      })),
      input.visibleStart,
      Math.min(input.duration, input.visibleEnd),
      input.zoom,
      input.minPixelSpacing ?? DEFAULT_GRID_MIN_PIXEL_SPACING,
    );
  }

  const interval = getTimelineGridIntervalSeconds(input.unit, input.fps);
  if (!interval || interval <= 0) {
    return [];
  }

  const minPixelSpacing = Math.max(1, input.minPixelSpacing ?? DEFAULT_GRID_MIN_PIXEL_SPACING);
  const stepMultiplier = Math.max(1, Math.ceil(minPixelSpacing / Math.max(EPSILON, interval * input.zoom)));
  const step = interval * stepMultiplier;
  const start = Math.max(0, Math.floor(Math.max(0, input.visibleStart) / step) * step);
  const end = Math.min(input.duration, input.visibleEnd);
  const lines: TimelineGridLine[] = [];
  for (let time = start; time <= end + EPSILON; time += step) {
    if (time + EPSILON < input.visibleStart) {
      continue;
    }
    const index = Math.round(time / interval);
    lines.push({ time: round(time), major: index % majorEveryForUnit(input.unit, stepMultiplier) === 0 });
  }
  return lines;
}

export function findTimelineSnapTargetWithGrid(input: TimelineSnapInputWithGrid): TimelineSnapTarget | null {
  const timelineTarget = findTimelineSnapTarget(input);
  if (timelineTarget || input.disabled || input.grid?.enabled !== true) {
    return timelineTarget;
  }
  return findTimelineGridSnapTarget({
    clipStart: input.clipStart,
    clipDuration: input.clipDuration,
    unit: input.grid.unit,
    fps: input.grid.fps,
    beatTimes: input.grid.beatTimes,
    pixelsPerSecond: input.pixelsPerSecond,
    thresholdPx: input.thresholdPx,
    disabled: input.disabled,
    edges: input.edges,
  });
}

export function findTimelineGridSnapTarget(input: TimelineGridSnapInput): TimelineSnapTarget | null {
  if (input.disabled || input.pixelsPerSecond <= 0 || input.clipDuration <= 0) {
    return null;
  }
  const threshold = Math.max(0, input.thresholdPx ?? DEFAULT_GRID_SNAP_THRESHOLD_PX);
  const edges = input.edges ?? ['start', 'end'];
  let best: TimelineSnapTarget | null = null;

  for (const edge of edges) {
    const edgeTime = edge === 'start' ? input.clipStart : input.clipStart + input.clipDuration;
    const candidateTime = nearestGridTime(edgeTime, input);
    if (candidateTime === undefined || candidateTime < 0) {
      continue;
    }
    const delta = candidateTime - edgeTime;
    const distancePx = Math.abs(delta * input.pixelsPerSecond);
    if (distancePx > threshold + EPSILON) {
      continue;
    }
    const snappedStart = round(Math.max(0, input.clipStart + delta));
    const target: TimelineSnapTarget = {
      edge,
      candidate: { time: round(candidateTime), kind: 'grid' },
      snappedStart,
      delta: round(delta),
      distancePx,
    };
    if (!best || target.distancePx < best.distancePx - EPSILON) {
      best = target;
    }
  }

  return best;
}

export function snapTimelineTimeToGrid(input: TimelineGridTimeSnapInput): number {
  if (input.disabled || input.pixelsPerSecond <= 0) {
    return round(input.time);
  }
  const candidateTime = nearestGridTime(input.time, input);
  if (candidateTime === undefined || candidateTime < 0) {
    return round(input.time);
  }
  const threshold = Math.max(0, input.thresholdPx ?? DEFAULT_GRID_SNAP_THRESHOLD_PX);
  const distancePx = Math.abs((candidateTime - input.time) * input.pixelsPerSecond);
  return distancePx <= threshold + EPSILON ? round(candidateTime) : round(input.time);
}

function nearestGridTime(
  time: number,
  input: Pick<TimelineGridSnapInput, 'unit' | 'fps' | 'beatTimes'>,
): number | undefined {
  if (isBeatGridUnit(input.unit)) {
    return nearestTime(time, buildBeatGridTimes(input.beatTimes, beatGridDensityForUnit(input.unit)));
  }
  const interval = getTimelineGridIntervalSeconds(input.unit, input.fps);
  return interval ? Math.round(time / interval) * interval : undefined;
}

function nearestTime(time: number, candidates: number[]): number | undefined {
  let best: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - time);
    if (distance < bestDistance - EPSILON) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function buildBeatGridTimes(beatTimes: unknown, density: BeatGridDensity): number[] {
  if (!Array.isArray(beatTimes)) {
    return [];
  }
  return calculateBeatGridLines(
    beatTimes.filter((time): time is number => typeof time === 'number' && Number.isFinite(time) && time >= 0),
    density,
  );
}

function isBeatGridUnit(
  unit: TimelineGridUnit,
): unit is Extract<TimelineGridUnit, 'beat' | 'measure' | 'four-measures'> {
  return unit === 'beat' || unit === 'measure' || unit === 'four-measures';
}

function beatGridDensityForUnit(
  unit: Extract<TimelineGridUnit, 'beat' | 'measure' | 'four-measures'>,
): BeatGridDensity {
  return unit === 'four-measures' ? 'four-measures' : unit === 'measure' ? 'measure' : 'beat';
}

function filterDenseGridLines(
  lines: TimelineGridLine[],
  visibleStart: number,
  visibleEnd: number,
  zoom: number,
  minPixelSpacing: number,
): TimelineGridLine[] {
  const result: TimelineGridLine[] = [];
  let lastAccepted = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (line.time + EPSILON < visibleStart || line.time - EPSILON > visibleEnd) {
      continue;
    }
    if ((line.time - lastAccepted) * zoom + EPSILON < minPixelSpacing) {
      continue;
    }
    result.push(line);
    lastAccepted = line.time;
  }
  return result;
}

function majorEveryForUnit(unit: TimelineGridUnit, stepMultiplier: number): number {
  if (unit === 'frame' || unit === '5-frames' || unit === '10-frames') {
    return Math.max(1, 30 * stepMultiplier);
  }
  if (unit === 'second') {
    return Math.max(1, 5 * stepMultiplier);
  }
  return 1;
}
