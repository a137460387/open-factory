import type { EffectParams } from './effect-types';
export type MotionBlurSampleCount = 4 | 8 | 16 | 32;
export interface MotionBlurParams extends EffectParams {
    intensity: number;
    angle: number;
    samples: MotionBlurSampleCount;
    jitter: number;
}
export interface MotionBlurSampleOffset {
    x: number;
    y: number;
}
export interface MotionBlurConvolutionKernel {
    size: number;
    matrix: number[];
    sum: number;
}
export declare const MOTION_BLUR_SAMPLE_COUNTS: MotionBlurSampleCount[];
export declare const DEFAULT_MOTION_BLUR_PARAMS: MotionBlurParams;
export declare function normalizeMotionBlurParams(params: EffectParams | undefined): MotionBlurParams;
export declare function calculateMotionBlurSampleOffsets(params: Partial<MotionBlurParams>, radiusPixels?: number): MotionBlurSampleOffset[];
export declare function buildMotionBlurConvolutionKernel(params: Partial<MotionBlurParams>, maxSize?: number): MotionBlurConvolutionKernel;
export declare function buildMotionBlurConvolutionFilter(params: Partial<MotionBlurParams>): string | undefined;
export declare function buildMotionBlurExportFilter(params: Partial<MotionBlurParams>, fps?: number): string | undefined;
export declare function buildMotionBlurPreviewVector(params: Partial<MotionBlurParams>, maxPixels?: number): {
    x: number;
    y: number;
    samples: number;
    jitter: number;
};
//# sourceMappingURL=motion-blur.d.ts.map