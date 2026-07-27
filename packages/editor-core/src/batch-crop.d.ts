import type { MediaAsset, Timeline } from './model';
import { type ReframeCrop, type TargetAspectRatio } from './reframe';
export declare const CUSTOM_ASPECT_RATIO_KEY = "custom";
export declare const BATCH_ASPECT_RATIO_OPTIONS: readonly ["16:9", "9:16", "1:1", "4:5", "21:9", "custom"];
export type BatchAspectRatioOption = (typeof BATCH_ASPECT_RATIO_OPTIONS)[number];
export interface BatchCropAnchor {
    mode: 'center' | 'smart';
    offsetX: number;
    offsetY: number;
}
export interface BatchCropTarget {
    clipId: string;
    sourceWidth: number;
    sourceHeight: number;
    name: string;
}
export interface BatchCropPreview {
    clipId: string;
    name: string;
    sourceWidth: number;
    sourceHeight: number;
    cropWidth: number;
    cropHeight: number;
    cropX: number;
    cropY: number;
    reframeCrop: ReframeCrop | undefined;
}
export interface BatchCropResult {
    clipId: string;
    targetAspectRatio: TargetAspectRatio;
    offsetX: number;
    offsetY: number;
}
export declare function normalizeBatchAspectRatioOption(value: unknown): BatchAspectRatioOption;
export declare function isCustomBatchAspectRatio(option: BatchAspectRatioOption): boolean;
export declare function resolveCustomRatioValue(width: number, height: number): number;
export declare function smartAnchorForClip(clip: {
    id: string;
    name?: string;
}, sourceWidth: number, sourceHeight: number): BatchCropAnchor;
export declare function calculateBatchCropPreview(target: BatchCropTarget, targetAspectRatio: TargetAspectRatio, anchor: BatchCropAnchor): BatchCropPreview;
export declare function calculateBatchCropPreviews(targets: BatchCropTarget[], targetAspectRatio: TargetAspectRatio, anchors: Map<string, BatchCropAnchor>): BatchCropPreview[];
export declare function buildBatchCropResults(targets: BatchCropTarget[], targetAspectRatio: TargetAspectRatio, anchors: Map<string, BatchCropAnchor>): BatchCropResult[];
export declare function collectBatchCropTargets(timeline: Timeline, clipIds: string[], media: MediaAsset[]): BatchCropTarget[];
export declare function formatAspectRatioLabel(option: BatchAspectRatioOption): string;
//# sourceMappingURL=batch-crop.d.ts.map