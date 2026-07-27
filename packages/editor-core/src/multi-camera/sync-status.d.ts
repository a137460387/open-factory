/**
 * 多机位同步状态可视化指示器模块
 *
 * 提供同步质量评估、状态指示和可视化数据生成。
 * 纯函数化设计，不依赖 UI 框架。
 */
/** 同步质量等级 */
export type SyncQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unsynced';
/** 单个机位的同步状态 */
export interface AngleSyncStatus {
    angleId: string;
    angleName: string;
    offsetMs: number;
    offsetSeconds: number;
    confidence: number;
    quality: SyncQualityLevel;
    driftRateMsPerMin: number;
    hasDrift: boolean;
}
/** 整体同步状态摘要 */
export interface MulticamSyncStatusSummary {
    overallQuality: SyncQualityLevel;
    averageConfidence: number;
    maxOffsetMs: number;
    anyDriftDetected: boolean;
    angleStatuses: AngleSyncStatus[];
    syncedAt: number;
    /** 同步进度 (0-1)，用于进度条显示 */
    syncProgress: number;
}
/** 同步可视化时间轴数据点 */
export interface SyncTimelinePoint {
    time: number;
    offsets: Record<string, number>;
    scores: Record<string, number>;
}
/** 同步波形对齐预览数据 */
export interface SyncAlignmentPreview {
    referencePeaks: number[];
    candidatePeaks: Record<string, number[]>;
    offsets: Record<string, number>;
}
/**
 * 根据偏移量和置信度评估单个机位的同步质量等级
 */
export declare function evaluateSyncQuality(offsetMs: number, confidence: number): SyncQualityLevel;
/**
 * 计算整体同步质量（取所有机位中最差的等级）
 */
export declare function calculateOverallSyncQuality(angleQualities: SyncQualityLevel[]): SyncQualityLevel;
/**
 * 为每个机位生成同步状态
 */
export declare function buildAngleSyncStatuses(angleIds: string[], angleNames: Record<string, string>, offsets: Record<string, number>, confidences: Record<string, number>, driftRates?: Record<string, number>): AngleSyncStatus[];
/**
 * 构建完整的同步状态摘要
 */
export declare function buildSyncStatusSummary(angleIds: string[], angleNames: Record<string, string>, offsets: Record<string, number>, confidences: Record<string, number>, driftRates?: Record<string, number>, syncProgress?: number): MulticamSyncStatusSummary;
/**
 * 生成同步质量的颜色指示（用于 UI 渲染）
 * 返回 CSS 兼容的颜色值
 */
export declare function getSyncQualityColor(quality: SyncQualityLevel): string;
/**
 * 生成同步质量的中文标签
 */
export declare function getSyncQualityLabel(quality: SyncQualityLevel): string;
/**
 * 生成偏移量的可读格式
 */
export declare function formatOffsetDisplay(offsetMs: number): string;
/**
 * 构建同步时间轴数据（用于波形对齐可视化）
 * 将窗口同步结果转换为可绘制的时间轴数据
 */
export declare function buildSyncTimelineData(windowResults: Array<{
    startTime: number;
    endTime: number;
    offsetSeconds: number;
    score: number;
}>, angleId: string): SyncTimelinePoint[];
//# sourceMappingURL=sync-status.d.ts.map