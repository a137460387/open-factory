/** Available blend modes for clips composited on the timeline. */
export const CLIP_BLEND_MODES = [
    'normal',
    'overlay',
    'screen',
    'multiply',
    'difference',
    'color-burn',
    'color-dodge',
    'hard-light',
    'soft-light',
];
const CLIP_BLEND_MODE_SET = new Set(CLIP_BLEND_MODES);
/**
 * Normalize an unknown value to a valid ClipBlendMode, defaulting to 'normal'.
 * @param value - Raw value to normalize
 */
export function normalizeClipBlendMode(value) {
    return typeof value === 'string' && CLIP_BLEND_MODE_SET.has(value) ? value : 'normal';
}
/**
 * Map a ClipBlendMode to its FFmpeg xfilter blend mode name.
 * @param mode - Clip blend mode
 */
export function getFfmpegBlendMode(mode) {
    switch (normalizeClipBlendMode(mode)) {
        case 'color-burn':
            return 'burn';
        case 'color-dodge':
            return 'dodge';
        case 'hard-light':
            return 'hardlight';
        case 'soft-light':
            return 'softlight';
        default:
            return mode;
    }
}
export function clipBlendModeToShaderIndex(mode) {
    return CLIP_BLEND_MODES.indexOf(normalizeClipBlendMode(mode));
}
export function blendChannel(mode, baseValue, topValue) {
    const base = clamp01(baseValue);
    const top = clamp01(topValue);
    switch (normalizeClipBlendMode(mode)) {
        case 'multiply':
            return base * top;
        case 'screen':
            return 1 - (1 - base) * (1 - top);
        case 'overlay':
            return overlayChannel(base, top);
        case 'difference':
            return Math.abs(base - top);
        case 'color-burn':
            return top <= 0 ? 0 : 1 - Math.min(1, (1 - base) / top);
        case 'color-dodge':
            return top >= 1 ? 1 : Math.min(1, base / (1 - top));
        case 'hard-light':
            return top < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
        case 'soft-light':
            return softLightChannel(base, top);
        case 'normal':
        default:
            return top;
    }
}
export function blendPixels(mode, base, top) {
    return {
        r: round6(blendChannel(mode, base.r, top.r)),
        g: round6(blendChannel(mode, base.g, top.g)),
        b: round6(blendChannel(mode, base.b, top.b)),
    };
}
function overlayChannel(base, top) {
    return base < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
}
function softLightChannel(base, top) {
    if (top <= 0.5) {
        return base - (1 - 2 * top) * base * (1 - base);
    }
    const d = base <= 0.25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base);
    return base + (2 * top - 1) * (d - base);
}
function clamp01(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function round6(value) {
    return Math.round(clamp01(value) * 1_000_000) / 1_000_000;
}
//# sourceMappingURL=blend-modes.js.map