/** Available blend modes for clips composited on the timeline. */
export declare const CLIP_BLEND_MODES: readonly ["normal", "overlay", "screen", "multiply", "difference", "color-burn", "color-dodge", "hard-light", "soft-light"];
/** Union type of all valid clip blend mode strings. */
export type ClipBlendMode = (typeof CLIP_BLEND_MODES)[number];
/** RGB pixel value with channels in [0, 1] range. */
export interface RgbPixel {
    r: number;
    g: number;
    b: number;
}
/**
 * Normalize an unknown value to a valid ClipBlendMode, defaulting to 'normal'.
 * @param value - Raw value to normalize
 */
export declare function normalizeClipBlendMode(value: unknown): ClipBlendMode;
/**
 * Map a ClipBlendMode to its FFmpeg xfilter blend mode name.
 * @param mode - Clip blend mode
 */
export declare function getFfmpegBlendMode(mode: ClipBlendMode): string;
export declare function clipBlendModeToShaderIndex(mode: ClipBlendMode): number;
export declare function blendChannel(mode: ClipBlendMode, baseValue: number, topValue: number): number;
export declare function blendPixels(mode: ClipBlendMode, base: RgbPixel, top: RgbPixel): RgbPixel;
//# sourceMappingURL=blend-modes.d.ts.map