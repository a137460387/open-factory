export const DEFAULT_FPS = 30;
export const DEFAULT_SNAP_GRID = 1 / DEFAULT_FPS;
export const PROJECT_TIMEBASE = 600;
export const SUPPORTED_PROJECT_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60] as const;
export type SupportedProjectFps = (typeof SUPPORTED_PROJECT_FPS)[number];
export type TimecodeFormat = 'ndf' | 'df';

export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('min cannot be greater than max');
  }
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function snap(time: number, grid = DEFAULT_SNAP_GRID): number {
  if (grid <= 0) {
    return round(time);
  }
  return round(Math.round(time / grid) * grid);
}

export function secondsToFrames(seconds: number, fps = DEFAULT_FPS): number {
  if (fps <= 0) {
    throw new RangeError('fps must be greater than 0');
  }
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames: number, fps = DEFAULT_FPS): number {
  if (fps <= 0) {
    throw new RangeError('fps must be greater than 0');
  }
  return round(frames / fps);
}

export function normalizeProjectFps(value: number | undefined): SupportedProjectFps {
  if (!Number.isFinite(value)) {
    return DEFAULT_FPS;
  }
  return SUPPORTED_PROJECT_FPS.reduce((closest, candidate) => (Math.abs(candidate - value!) < Math.abs(closest - value!) ? candidate : closest), DEFAULT_FPS as SupportedProjectFps);
}

export function supportsDropFrameTimecode(fps: number): boolean {
  const normalized = normalizeProjectFps(fps);
  return normalized === 29.97 || normalized === 59.94;
}

export function normalizeTimecodeFormat(format: TimecodeFormat | undefined, fps: number): TimecodeFormat {
  return format === 'df' && supportsDropFrameTimecode(fps) ? 'df' : 'ndf';
}

export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * PROJECT_TIMEBASE));
}

export function ticksToSeconds(ticks: number): number {
  return round(Math.max(0, Number.isFinite(ticks) ? ticks : 0) / PROJECT_TIMEBASE);
}

export function ticksToTimecode(ticks: number, fps = DEFAULT_FPS, format: TimecodeFormat = 'ndf'): string {
  return secondsToTimecode(ticksToSeconds(ticks), fps, format);
}

export function secondsToTimecode(seconds: number, fps = DEFAULT_FPS, format: TimecodeFormat = 'ndf'): string {
  const normalizedFps = normalizeProjectFps(fps);
  const nominalFps = Math.round(normalizedFps);
  const totalFrames = Math.max(0, Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * normalizedFps));
  const timecodeFrames = normalizeTimecodeFormat(format, normalizedFps) === 'df' ? addDropFrameLabels(totalFrames, nominalFps) : totalFrames;
  const frames = timecodeFrames % nominalFps;
  const totalSeconds = Math.floor(timecodeFrames / nominalFps);
  const displaySeconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, minutes, displaySeconds, frames].map((part) => String(part).padStart(2, '0')).join(':');
}

function addDropFrameLabels(totalFrames: number, nominalFps: number): number {
  const dropFrames = nominalFps === 60 ? 4 : 2;
  const framesPerMinute = nominalFps * 60 - dropFrames;
  const framesPer10Minutes = nominalFps * 60 * 10 - dropFrames * 9;
  const tenMinuteBlocks = Math.floor(totalFrames / framesPer10Minutes);
  const remainingFrames = totalFrames % framesPer10Minutes;
  const droppedFrames = dropFrames * (tenMinuteBlocks * 9 + Math.floor(Math.max(0, remainingFrames - dropFrames) / framesPerMinute));
  return totalFrames + droppedFrames;
}
