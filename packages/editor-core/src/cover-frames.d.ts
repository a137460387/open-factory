import type { MediaAsset } from './model-types';
export declare const DEFAULT_COVER_FRAME_COUNT = 6;
export declare const MAX_COVER_FRAME_COUNT = 24;
export interface CoverFrameBatchTask {
    assetId: string;
    sourcePath: string;
    outputFileName: string;
}
export declare function buildEvenCoverFrameTimestamps(duration: number, count?: number): number[];
export declare function buildCoverFrameBatchTasks(media: MediaAsset[]): CoverFrameBatchTask[];
export declare function sanitizeCoverFileStem(value: string): string;
//# sourceMappingURL=cover-frames.d.ts.map