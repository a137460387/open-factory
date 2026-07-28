import type { ClipSlowMotionMode } from '../model-types';
export type FrameInterpolationCompareMode = 'original' | 'blend' | 'mci' | 'optical-flow';
export declare const FRAME_INTERPOLATION_COMPARE_MODES: readonly FrameInterpolationCompareMode[];
export declare const FRAME_INTERPOLATION_ESTIMATE_COEFFICIENTS: Record<FrameInterpolationCompareMode, number>;
export declare function buildFrameInterpolationCompareArgs(mode: FrameInterpolationCompareMode, targetFps: number): string[];
export declare function estimateFrameInterpolationModeDurationMs(frameCount: number, mode: FrameInterpolationCompareMode): number;
export declare function frameInterpolationCompareModeToSlowMotionMode(mode: FrameInterpolationCompareMode): ClipSlowMotionMode;
export declare function buildFrameInterpolationCompareFrameTimes(clipStart: number, clipDuration: number, playheadTime: number, fps: number): number[];
//# sourceMappingURL=frame-interpolation-preview.d.ts.map