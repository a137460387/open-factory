import type { Clip, ClipFrameInterpolation, FrameInterpolationMode, FrameInterpolationQualityGrade } from '../model-types';
export declare const MIN_FRAME_INTERPOLATION_PROTECTION_FRAMES = 0;
export declare const MAX_FRAME_INTERPOLATION_PROTECTION_FRAMES = 5;
export declare const DEFAULT_FRAME_INTERPOLATION_PROTECTION_FRAMES = 2;
export interface SceneProtectionFrameRange {
    startFrame: number;
    endFrame: number;
}
export declare function clampFrameInterpolationProtectionFrames(value: number | undefined, fallback?: number): number;
export declare function buildSceneBoundaryProtectionRanges(sceneTimes: readonly number[] | undefined, fps: number, duration: number, protectionFrames: number): SceneProtectionFrameRange[];
export declare function isFrameProtectedBySceneBoundary(frameNumber: number, ranges: readonly SceneProtectionFrameRange[]): boolean;
export declare function selectAdaptiveFrameInterpolationMode(motionScore: number | undefined): Exclude<FrameInterpolationMode, 'adaptive'>;
export declare function resolveFrameInterpolationMode(mode: FrameInterpolationMode, motionScore?: number): Exclude<FrameInterpolationMode, 'adaptive'>;
export declare function averageClipMotionScore(clip: Pick<Clip, 'contentAnalysis' | 'motionTrack'>): number | undefined;
export declare function buildFrameInterpolationCacheKey(mediaPath: string, settings: Pick<ClipFrameInterpolation, 'targetFps' | 'mode' | 'protectionFrames'>): string;
export declare function frameInterpolationCacheDir(appDataDir: string): string;
export declare function frameInterpolationCachePath(appDataDir: string, mediaPath: string, settings: Pick<ClipFrameInterpolation, 'targetFps' | 'mode' | 'protectionFrames'>): string;
export declare function mapSsimToFrameInterpolationQualityGrade(ssim: number | undefined): FrameInterpolationQualityGrade;
export declare function collectMissingInterpolationFrames(totalFrameCount: number, existingFrameNumbers: Iterable<number>): number[];
//# sourceMappingURL=frame-interpolation.d.ts.map