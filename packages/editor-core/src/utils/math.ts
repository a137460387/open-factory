/**
 * Clamp a number to [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp a number to [0, 1] range.
 */
export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Linear interpolation between a and b by factor t.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
