export declare const CLIP_BLEND_MODES: readonly ["normal", "overlay", "screen", "multiply", "difference", "color-burn", "color-dodge", "hard-light", "soft-light"];
export type ClipBlendMode = (typeof CLIP_BLEND_MODES)[number];
export interface RgbPixel {
    r: number;
    g: number;
    b: number;
}
export declare function normalizeClipBlendMode(value: unknown): ClipBlendMode;
export declare function getFfmpegBlendMode(mode: ClipBlendMode): string;
export declare function clipBlendModeToShaderIndex(mode: ClipBlendMode): number;
export declare function blendChannel(mode: ClipBlendMode, baseValue: number, topValue: number): number;
export declare function blendPixels(mode: ClipBlendMode, base: RgbPixel, top: RgbPixel): RgbPixel;
//# sourceMappingURL=blend-modes.d.ts.map