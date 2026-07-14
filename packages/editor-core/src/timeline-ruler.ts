import { framesToSeconds, normalizeProjectFps, secondsToFrames, secondsToTimecode, type TimecodeFormat } from './time';

export type TimelineRulerTickUnit = 'frame' | 'ten-frames' | 'seconds' | 'minutes';

export interface TimelineRulerScaleInput {
  zoom: number;
  viewportWidth: number;
  fps?: number;
  minTickSpacingPx?: number;
}

export interface TimelineRulerScale {
  unit: TimelineRulerTickUnit;
  stepSeconds: number;
  stepFrames?: number;
  tickSpacingPx: number;
}

export interface TimelineRulerTick {
  time: number;
  label: string;
  unit: TimelineRulerTickUnit;
  major: boolean;
}

export interface TimelineRulerTickInput extends TimelineRulerScaleInput {
  duration: number;
  visibleStart?: number;
  visibleEnd?: number;
  timecodeFormat?: TimecodeFormat;
}

const DEFAULT_MIN_TICK_SPACING_PX = 72;
const FRAME_STEPS = [1, 2, 5, 10] as const;
const SECOND_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;

export function calculateTimelineRulerScale(input: TimelineRulerScaleInput): TimelineRulerScale {
  const zoom = normalizeZoom(input.zoom);
  const minSpacing = normalizeMinSpacing(input.minTickSpacingPx, input.viewportWidth);
  const fps = normalizeProjectFps(input.fps ?? 30);

  for (const stepFrames of FRAME_STEPS) {
    const tickSpacingPx = (stepFrames / fps) * zoom;
    if (tickSpacingPx >= minSpacing) {
      return {
        unit: stepFrames === 10 ? 'ten-frames' : 'frame',
        stepFrames,
        stepSeconds: framesToSeconds(stepFrames, fps),
        tickSpacingPx,
      };
    }
  }

  for (const stepSeconds of SECOND_STEPS) {
    const tickSpacingPx = stepSeconds * zoom;
    if (tickSpacingPx >= minSpacing) {
      return {
        unit: stepSeconds >= 60 ? 'minutes' : 'seconds',
        stepSeconds,
        tickSpacingPx,
      };
    }
  }

  const fallbackSeconds = SECOND_STEPS.at(-1)!;
  return {
    unit: 'minutes',
    stepSeconds: fallbackSeconds,
    tickSpacingPx: fallbackSeconds * zoom,
  };
}

export function buildTimelineRulerTicks(input: TimelineRulerTickInput): TimelineRulerTick[] {
  const duration = Math.max(0, Number.isFinite(input.duration) ? input.duration : 0);
  if (duration <= 0) {
    return [];
  }

  const scale = calculateTimelineRulerScale(input);
  const fps = normalizeProjectFps(input.fps ?? 30);
  const start = Math.max(0, Number.isFinite(input.visibleStart) ? input.visibleStart! : 0);
  const end = Math.min(duration, Math.max(start, Number.isFinite(input.visibleEnd) ? input.visibleEnd! : duration));
  const paddedStart = Math.max(0, start - scale.stepSeconds);
  const paddedEnd = Math.min(duration, end + scale.stepSeconds);

  if (scale.stepFrames) {
    const startFrame = Math.max(0, Math.floor(secondsToFrames(paddedStart, fps) / scale.stepFrames) * scale.stepFrames);
    const endFrame = Math.ceil(secondsToFrames(paddedEnd, fps) / scale.stepFrames) * scale.stepFrames;
    const ticks: TimelineRulerTick[] = [];
    for (let frame = startFrame; frame <= endFrame; frame += scale.stepFrames) {
      const time = framesToSeconds(frame, fps);
      if (time > duration + 0.000001) {
        break;
      }
      ticks.push({
        time,
        label: formatTimelineRulerTickLabel(time, scale.unit, fps, input.timecodeFormat),
        unit: scale.unit,
        major: frame % Math.max(1, Math.round(fps)) === 0,
      });
    }
    return ticks;
  }

  const firstTick = Math.floor(paddedStart / scale.stepSeconds) * scale.stepSeconds;
  const ticks: TimelineRulerTick[] = [];
  for (let tick = firstTick; tick <= paddedEnd + 0.000001; tick += scale.stepSeconds) {
    const time = Math.max(0, tick);
    ticks.push({
      time,
      label: formatTimelineRulerTickLabel(time, scale.unit, fps, input.timecodeFormat),
      unit: scale.unit,
      major: scale.unit === 'minutes' ? Math.round(time) % 300 === 0 : Math.round(time) % 10 === 0,
    });
  }
  return dedupeTicks(ticks).filter((tick) => tick.time <= duration + 0.000001);
}

export function formatTimelineRulerTickLabel(
  time: number,
  unit: TimelineRulerTickUnit,
  fps = 30,
  timecodeFormat: TimecodeFormat = 'ndf',
): string {
  if (unit === 'frame' || unit === 'ten-frames') {
    return `${secondsToFrames(time, fps)}f`;
  }
  return secondsToTimecode(time, fps, timecodeFormat);
}

function normalizeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function normalizeMinSpacing(minTickSpacingPx: number | undefined, viewportWidth: number): number {
  const requested = Number.isFinite(minTickSpacingPx) ? minTickSpacingPx! : DEFAULT_MIN_TICK_SPACING_PX;
  const viewportLimit =
    Number.isFinite(viewportWidth) && viewportWidth > 0 ? Math.max(48, viewportWidth / 10) : requested;
  return Math.max(48, Math.min(requested, viewportLimit));
}

function dedupeTicks(ticks: TimelineRulerTick[]): TimelineRulerTick[] {
  const seen = new Set<number>();
  const output: TimelineRulerTick[] = [];
  for (const tick of ticks) {
    const key = Math.round(tick.time * 1000);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(tick);
  }
  return output;
}
