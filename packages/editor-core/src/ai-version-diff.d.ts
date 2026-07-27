/** AI版本对比摘要：快照diff算法 + AI摘要解析 */
/** 单个diff项 */
export interface SnapshotDiffItem {
    type: 'added' | 'removed' | 'modified' | 'track-count-changed';
    clipId?: string;
    trackId?: string;
    detail: string;
    /** 修剪点变化量（秒），仅modified类型有值 */
    delta?: number;
}
/** 版本diff结果 */
export interface VersionDiffResult {
    fromSnapshotId: string;
    toSnapshotId: string;
    items: SnapshotDiffItem[];
    summary: string;
    highlights: string[];
    generatedAt: string;
}
/** AI摘要响应 */
export interface VersionDiffAiResponse {
    summary: string;
    highlights: string[];
}
/** 版本对比摘要（用于数据结构） */
export interface VersionDiffSummary {
    fromSnapshotId: string;
    toSnapshotId: string;
    diff: SnapshotDiffItem[];
    aiSummary: string;
    generatedAt: string;
}
/** 简化剪辑信息（用于diff比较） */
interface ClipSnapshot {
    id: string;
    start: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
    trackId: string;
    mediaId?: string;
}
/** 简化时间线快照 */
interface TimelineSnapshot {
    tracks: Array<{
        id: string;
        type: string;
        clips: ClipSnapshot[];
    }>;
}
/** 修剪点变化阈值（秒） */
export declare const TRIM_DELTA_THRESHOLD = 0.1;
/**
 * 对比两个时间线快照，生成结构化diff。
 */
export declare function diffVersionSnapshots(from: TimelineSnapshot, to: TimelineSnapshot): SnapshotDiffItem[];
/**
 * 将diff结果序列化为AI提示词用的JSON字符串。
 */
export declare function serializeDiffForAi(items: SnapshotDiffItem[]): string;
/**
 * 解析AI返回的版本对比摘要响应。
 */
export declare function parseVersionDiffAiResponse(json: unknown): VersionDiffAiResponse;
/**
 * 创建VersionDiffSummary对象。
 */
export declare function createVersionDiffSummary(fromId: string, toId: string, items: SnapshotDiffItem[], aiResponse: VersionDiffAiResponse): VersionDiffSummary;
/**
 * 规范化VersionDiffSummary，处理旧项目兼容。
 */
export declare function normalizeVersionDiffSummary(input: unknown): VersionDiffSummary | undefined;
export {};
//# sourceMappingURL=ai-version-diff.d.ts.map