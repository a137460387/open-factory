import type { MediaAsset, Clip, ClipKeyframes } from './model-types';
/** 兼容性检查严重程度 */
export type CompatSeverity = 'ok' | 'warning' | 'error';
/** 兼容性问题类型 */
export type CompatIssueType = 'resolution' | 'duration' | 'codec' | 'missing';
/** 单个 clip 的兼容性检查结果 */
export interface ClipCompatResult {
    clipId: string;
    clipName: string;
    severity: CompatSeverity;
    issues: CompatIssue[];
}
export interface CompatIssue {
    type: CompatIssueType;
    severity: Exclude<CompatSeverity, 'ok'>;
    message: string;
    expected?: string;
    actual?: string;
}
/** 时长处理策略 */
export type DurationStrategy = 'trim' | 'stretch' | 'keep';
/** 替换映射条目 */
export interface ReplaceMapping {
    clipId: string;
    oldAssetId: string;
    newAssetId: string;
    newAsset: MediaAsset;
    durationStrategy: DurationStrategy;
}
/** 批量替换预检报告 */
export interface BatchReplacePrecheckReport {
    totalClips: number;
    compatibleClips: number;
    warningClips: number;
    errorClips: number;
    results: ClipCompatResult[];
    canProceed: boolean;
}
/** 替换后失效警告 */
export interface PostReplaceWarning {
    clipId: string;
    clipName: string;
    warningType: 'keyframe-out-of-range' | 'effect-duration-mismatch';
    message: string;
    detail: string;
}
/** 批量替换执行结果 */
export interface BatchReplaceResult {
    report: BatchReplacePrecheckReport;
    warnings: PostReplaceWarning[];
    replacedClipIds: string[];
}
/**
 * 检查单个 clip 与新媒体资产的兼容性。
 */
export declare function checkClipCompatibility(clip: Pick<Clip, 'id' | 'name'> & {
    duration: number;
}, oldAsset: Pick<MediaAsset, 'id' | 'name' | 'width' | 'height' | 'duration' | 'videoCodec'> | undefined, newAsset: Pick<MediaAsset, 'id' | 'name' | 'width' | 'height' | 'duration' | 'videoCodec'>, durationStrategy?: DurationStrategy): ClipCompatResult;
/**
 * 按文件名匹配规则，在新目录中寻找同名文件。
 */
export declare function matchByFilename(oldAsset: Pick<MediaAsset, 'name'>, newAssets: MediaAsset[]): MediaAsset | undefined;
/**
 * 构建批量替换预检报告。
 */
export declare function buildBatchReplacePrecheckReport(mappings: ReplaceMapping[], getOldAsset: (assetId: string) => MediaAsset | undefined): BatchReplacePrecheckReport;
/**
 * 检测替换后关键帧/特效因新媒体属性差异而失效的情况。
 */
export declare function detectPostReplaceWarnings(clip: {
    id: string;
    name: string;
    duration: number;
    keyframes?: ClipKeyframes;
}, newAsset: Pick<MediaAsset, 'duration'>): PostReplaceWarning[];
//# sourceMappingURL=batch-media-replace.d.ts.map