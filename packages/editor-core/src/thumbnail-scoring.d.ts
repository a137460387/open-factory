import type { TargetAspectRatio } from './reframe';
export declare const THUMBNAIL_SAMPLE_COUNT = 20;
export declare const THUMBNAIL_TOP_CANDIDATE_COUNT = 5;
export type ThumbnailPlatformPreset = 'youtube' | 'bilibili' | 'douyin';
export interface ThumbnailPlatformSize {
    width: number;
    height: number;
    label: string;
    aspectRatio: Exclude<TargetAspectRatio, 'source'>;
}
export declare const THUMBNAIL_PLATFORM_SIZES: Record<ThumbnailPlatformPreset, ThumbnailPlatformSize>;
export interface ThumbnailExportSettings {
    width: number;
    height: number;
    format: 'jpg';
    outputMode: 'video';
    audioCodec: 'aac';
    scaleMode: 'none' | 'fit';
    targetAspectRatio: TargetAspectRatio;
}
export interface ThumbnailFrameSample {
    timestamp: number;
    width: number;
    height: number;
    data: ArrayLike<number>;
    faceDetected?: boolean;
}
export interface ThumbnailScoreBreakdown {
    face: number;
    clarity: number;
    color: number;
    motion: number;
    total: number;
}
export interface ThumbnailCandidate extends ThumbnailFrameSample {
    score: ThumbnailScoreBreakdown;
}
export declare function buildThumbnailSampleTimestamps(duration: number, count?: number): number[];
export declare function normalizeThumbnailPlatformPreset(value: unknown): ThumbnailPlatformPreset;
export declare function getThumbnailPlatformSize(value: unknown): ThumbnailPlatformSize;
export declare function buildThumbnailExportSettings(value: unknown, crop?: boolean): ThumbnailExportSettings;
export declare function rankThumbnailCandidates(candidates: readonly ThumbnailCandidate[], limit?: number): ThumbnailCandidate[];
export declare function scoreThumbnailFrame(sample: ThumbnailFrameSample, neighbors?: {
    previous?: ThumbnailFrameSample;
    next?: ThumbnailFrameSample;
}): ThumbnailScoreBreakdown;
export declare function buildThumbnailOutputFileStem(name: string): string;
export declare function buildThumbnailOutputFileName(name: string): string;
export declare function buildThumbnailOutputPath(directory: string, sourceName: string): string;
//# sourceMappingURL=thumbnail-scoring.d.ts.map