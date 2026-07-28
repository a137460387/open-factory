/**
 * 批量导出引擎
 *
 * 编排多平台并行导出，复用现有 export-queue 和 scheduling 基础设施。
 * 为每个目标平台生成独立的导出任务，统一管理进度和错误处理。
 */
import type { Project } from '../model-types';
import type { ExportSettings } from '../export/export-types';
import type { ExportTaskPriority } from '../export/export-queue';
import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
import type { SmartCropResult } from './smart-crop';
export interface DistributionBatchRequest {
    /** 源项目 */
    project: Project;
    /** 目标平台列表 */
    platforms: DistributionPlatformId[];
    /** 各平台的裁剪结果（可选） */
    cropResults?: Map<string, SmartCropResult>;
    /** 输出目录 */
    outputDir: string;
    /** 文件名模板，支持 {platform}, {date}, {project} 占位符 */
    template?: string;
    /** 任务优先级 */
    priority?: ExportTaskPriority;
    /** 自定义设置覆盖 */
    settingsOverride?: Partial<ExportSettings>;
}
export interface DistributionTask {
    /** 任务 ID */
    id: string;
    /** 目标平台 */
    platform: DistributionPlatformSpec;
    /** 导出设置 */
    settings: ExportSettings;
    /** 预估导出时长（秒） */
    estimatedDurationSecs: number;
    /** 预估文件大小（字节） */
    estimatedFileSizeBytes: number;
    /** 状态 */
    status: DistributionTaskStatus;
    /** 进度 (0-1) */
    progress: number;
    /** 错误信息 */
    error?: string;
}
export type DistributionTaskStatus = 'pending' | 'running' | 'success' | 'error' | 'canceled';
export interface DistributionBatchResult {
    /** 批次 ID */
    batchId: string;
    /** 任务列表 */
    tasks: DistributionTask[];
    /** 总预估时长（秒） */
    totalEstimatedDurationSecs: number;
    /** 总预估文件大小（字节） */
    totalEstimatedFileSizeBytes: number;
}
/**
 * 应用文件名模板
 *
 * 支持的占位符：
 * - {platform}: 平台名称
 * - {platform_id}: 平台 ID
 * - {date}: 当前日期 (YYYY-MM-DD)
 * - {project}: 项目名称
 * - {resolution}: 分辨率 (如 1920x1080)
 * - {aspect}: 宽高比 (如 16-9)
 */
export declare function applyDistributionTemplate(template: string, platform: DistributionPlatformSpec, projectName: string): string;
/**
 * 为指定平台构建导出设置
 */
export declare function buildPlatformExportSettings(platform: DistributionPlatformSpec, outputDir: string, projectName: string, template?: string, cropResult?: SmartCropResult, override?: Partial<ExportSettings>): ExportSettings;
/**
 * 生成分发批次任务列表
 *
 * @param request 批量分发请求
 * @returns 批次结果，包含所有平台的导出任务
 */
export declare function createDistributionBatch(request: DistributionBatchRequest): DistributionBatchResult;
/** 更新任务进度 */
export declare function updateDistributionTaskProgress(tasks: DistributionTask[], taskId: string, progress: number): DistributionTask[];
/** 完成任务 */
export declare function finishDistributionTask(tasks: DistributionTask[], taskId: string): DistributionTask[];
/** 任务失败 */
export declare function failDistributionTask(tasks: DistributionTask[], taskId: string, error: string): DistributionTask[];
/** 取消任务 */
export declare function cancelDistributionTask(tasks: DistributionTask[], taskId: string): DistributionTask[];
/** 检查批次是否全部完成 */
export declare function isDistributionBatchComplete(tasks: DistributionTask[]): boolean;
/** 获取批次统计 */
export declare function getDistributionBatchStats(tasks: DistributionTask[]): {
    total: number;
    pending: number;
    running: number;
    success: number;
    error: number;
    canceled: number;
};
/** 格式化文件大小 */
export declare function formatFileSize(bytes: number): string;
//# sourceMappingURL=batch-export.d.ts.map