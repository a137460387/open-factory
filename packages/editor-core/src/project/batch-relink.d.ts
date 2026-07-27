import type { MediaAsset } from '../model';
export interface BatchRelinkCandidate {
    path: string;
}
export interface BatchRelinkReplacement {
    assetId: string;
    candidatePath: string;
}
export interface BatchRelinkWarning {
    assetId: string;
    fileName: string;
    reason: 'no-match' | 'duplicate-candidates';
    candidatePaths: string[];
}
export interface BatchRelinkPlan {
    replacements: BatchRelinkReplacement[];
    warnings: BatchRelinkWarning[];
}
export interface BatchRelinkOptions {
    caseInsensitive?: boolean;
}
export declare function planBatchRelinkByFileName(media: MediaAsset[], candidates: BatchRelinkCandidate[], options?: BatchRelinkOptions): BatchRelinkPlan;
export declare function fileNameFromPath(path: string): string;
//# sourceMappingURL=batch-relink.d.ts.map