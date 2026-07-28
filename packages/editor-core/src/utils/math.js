/**
 * Clamp a number to [min, max] range.
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/**
 * Clamp a number to [0, 1] range.
 */
export function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
}
/**
 * Linear interpolation between a and b by factor t.
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
//# sourceMappingURL=math.js.map