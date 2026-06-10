export const DEFAULT_FPS = 30;
export const DEFAULT_SNAP_GRID = 1 / DEFAULT_FPS;

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
