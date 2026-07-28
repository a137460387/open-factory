/**
 * 发布计划调度系统
 *
 * 管理多平台定时发布调度，复用现有 publish-pipeline 基础设施。
 * 支持为每个平台设置独立的发布时间，统一管理发布历史。
 */
import type { ExportPublishPlatform } from '../export/publish-pipeline';
export interface DistributionSchedule {
    /** 计划 ID */
    id: string;
    /** 关联的批次 ID */
    batchId: string;
    /** 关联的任务 ID */
    taskId: string;
    /** 目标平台 ID */
    platformId: string;
    /** 目标平台名称 */
    platformName: string;
    /** 计划发布时间 (ISO 8601) */
    scheduledAt: string;
    /** 状态 */
    status: DistributionScheduleStatus;
    /** 发布配置 */
    publishConfig?: PublishConfig;
    /** 重试次数 */
    retryCount: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 错误信息 */
    error?: string;
}
export type DistributionScheduleStatus = 'pending' | 'ready' | 'publishing' | 'published' | 'failed' | 'canceled';
export interface PublishConfig {
    /** 目标平台 */
    platform: ExportPublishPlatform;
    /** 视频标题 */
    title?: string;
    /** 视频描述 */
    description?: string;
    /** 标签 */
    tags?: string[];
    /** 是否公开 */
    isPublic?: boolean;
    /** 定时发布时间窗口 */
    publishWindow?: {
        daysOfWeek: number[];
        startHour: number;
        endHour: number;
        timezoneOffsetMinutes: number;
    };
}
export interface DistributionHistoryEntry {
    /** 历史 ID */
    id: string;
    /** 计划 ID */
    scheduleId: string;
    /** 平台名称 */
    platformName: string;
    /** 发布状态 */
    status: 'success' | 'failed';
    /** 发布时间 */
    publishedAt: string;
    /** 输出文件路径 */
    outputPath?: string;
    /** 文件大小 (字节) */
    fileSizeBytes?: number;
    /** 错误信息 */
    error?: string;
    /** 耗时 (毫秒) */
    durationMs?: number;
}
/**
 * 创建发布计划
 */
export declare function createDistributionSchedule(input: {
    batchId: string;
    taskId: string;
    platformId: string;
    platformName: string;
    scheduledAt: string;
    publishConfig?: PublishConfig;
}): DistributionSchedule;
/**
 * 批量创建发布计划
 */
export declare function createBatchDistributionSchedules(input: {
    batchId: string;
    tasks: Array<{
        id: string;
        platformId: string;
        platformName: string;
    }>;
    scheduledAt: string;
    publishConfig?: PublishConfig;
}): DistributionSchedule[];
/** 更新计划状态 */
export declare function updateScheduleStatus(schedule: DistributionSchedule, status: DistributionScheduleStatus, error?: string): DistributionSchedule;
/** 检查计划是否可以重试 */
export declare function canRetrySchedule(schedule: DistributionSchedule): boolean;
/** 取消计划 */
export declare function cancelSchedule(schedule: DistributionSchedule): DistributionSchedule;
/**
 * 检查计划是否到达发布时间
 */
export declare function isScheduleReady(schedule: DistributionSchedule): boolean;
/**
 * 获取所有待发布的计划，按发布时间排序
 */
export declare function getPendingSchedules(schedules: DistributionSchedule[]): DistributionSchedule[];
/**
 * 获取所有已到期的计划
 */
export declare function getDueSchedules(schedules: DistributionSchedule[]): DistributionSchedule[];
export interface DistributionScheduleStats {
    total: number;
    pending: number;
    ready: number;
    publishing: number;
    published: number;
    failed: number;
    canceled: number;
}
/** 获取调度统计 */
export declare function getScheduleStats(schedules: DistributionSchedule[]): DistributionScheduleStats;
/** 添加历史记录 */
export declare function addHistoryEntry(history: DistributionHistoryEntry[], entry: DistributionHistoryEntry): DistributionHistoryEntry[];
/** 按平台过滤历史 */
export declare function filterHistoryByPlatform(history: DistributionHistoryEntry[], platformName: string): DistributionHistoryEntry[];
/** 获取最近的历史记录 */
export declare function getRecentHistory(history: DistributionHistoryEntry[], count?: number): DistributionHistoryEntry[];
export interface OptimalTimeSuggestion {
    platform: string;
    suggestedHour: number;
    suggestedDayOfWeek: number;
    reason: string;
}
/**
 * 基于平台特征建议最佳发布时间
 *
 * 简化版本，基于常见社交媒体发布时间最佳实践：
 * - YouTube: 周末下午 2-4 点
 * - TikTok: 晚上 7-9 点
 * - Instagram: 中午 11-1 点或晚上 7-9 点
 * - Bilibili: 晚上 6-10 点
 */
export declare function suggestOptimalPublishTime(platformId: string): OptimalTimeSuggestion;
/** 格式化发布时间 */
export declare function formatScheduledTime(isoString: string): string;
/** 获取星期名称 */
export declare function getDayOfWeekName(dayOfWeek: number): string;
//# sourceMappingURL=publish-scheduler.d.ts.map