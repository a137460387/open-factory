import type { FfmpegExportPlan, ExportSettings, ExportProject } from './export-types';
import type { ExportResourceEstimate } from './scheduling';
/**
 * 智能导出调度器 - 根据项目复杂度自动选择最优编码参数
 *
 * 基于项目复杂度（片段数量、特效种类、分辨率等）自动选择：
 * - 视频编码 preset（ultrafast/superfast/veryfast/faster/fast/medium/slow/slower/veryslow）
 * - 线程数
 * - 编码质量参数
 * - 硬件加速策略
 */
export interface ExportSchedulerConfig {
    /** 目标导出质量：'speed' | 'balanced' | 'quality' */
    qualityTarget: 'speed' | 'balanced' | 'quality';
    /** 可用硬件并发数 */
    hardwareConcurrency: number;
    /** 可用内存（MB） */
    availableMemoryMb: number;
    /** 是否启用硬件加速 */
    hardwareAccelerationEnabled: boolean;
    /** 硬件编码器 ID */
    hardwareEncoderId?: string;
    /** 最大线程数限制 */
    maxThreads?: number;
    /** 用户自定义 preset 覆盖 */
    presetOverride?: string;
}
export interface ExportSchedulerDecision {
    /** 推荐的编码 preset */
    preset: string;
    /** 推荐的线程数 */
    threads: number;
    /** 推荐的 CRF/CQ 值 */
    crf: number;
    /** 是否建议使用硬件加速 */
    useHardwareAcceleration: boolean;
    /** 调度理由 */
    reasons: string[];
    /** 资源估算 */
    resourceEstimate: ExportResourceEstimate;
    /** 预计编码速度倍数 */
    estimatedSpeedMultiplier: number;
    /** 预计输出文件大小（MB） */
    estimatedFileSizeMb: number;
}
export interface ProjectComplexityMetrics {
    /** 总片段数 */
    totalClips: number;
    /** 视频片段数 */
    videoClips: number;
    /** 图片片段数 */
    imageClips: number;
    /** 文本/字幕片段数 */
    textClips: number;
    /** 嵌套序列数 */
    nestedSequences: number;
    /** 特效数量 */
    effectCount: number;
    /** 转场数量 */
    transitionCount: number;
    /** 分辨率因子（相对于 1080p） */
    resolutionFactor: number;
    /** 帧率因子（相对于 30fps） */
    fpsFactor: number;
    /** 时长（秒） */
    durationSeconds: number;
    /** 是否包含复杂特效 */
    hasComplexEffects: boolean;
    /** 是否包含时间插值 */
    hasTemporalInterpolation: boolean;
    /** 是否包含色彩校正 */
    hasColorCorrection: boolean;
    /** 是否包含遮罩 */
    hasMasks: boolean;
}
/**
 * 分析项目复杂度
 */
export declare function analyzeProjectComplexity(project: ExportProject): ProjectComplexityMetrics;
/**
 * 计算导出复杂度分数（0-100）
 *
 * 注意：此函数与 complexity-score 模块中的 calculateComplexityScore 不同，
 * 专门用于导出调度参数选择。
 */
export declare function calculateExportComplexityScore(metrics: ProjectComplexityMetrics): number;
/**
 * 根据复杂度选择最优 preset
 */
export declare function selectOptimalPreset(complexityScore: number, qualityTarget: 'speed' | 'balanced' | 'quality', hardwareAcceleration: boolean): string;
/**
 * 计算最优线程数
 */
export declare function calculateOptimalThreads(complexityScore: number, hardwareConcurrency: number, availableMemoryMb: number, resourceEstimate: ExportResourceEstimate, maxThreads?: number): number;
/**
 * 计算最优 CRF/CQ 值
 */
export declare function calculateOptimalCrf(complexityScore: number, qualityTarget: 'speed' | 'balanced' | 'quality'): number;
/**
 * 估算编码速度倍数
 */
export declare function estimateSpeedMultiplier(preset: string, threads: number, complexityScore: number): number;
/**
 * 估算输出文件大小（MB）
 */
export declare function estimateFileSizeMb(settings: ExportSettings, durationSeconds: number, crf: number): number;
/**
 * 智能导出调度主函数
 */
export declare function scheduleExport(plan: FfmpegExportPlan, project: ExportProject, config: ExportSchedulerConfig): ExportSchedulerDecision;
/**
 * 将调度决策应用到导出计划
 */
export declare function applySchedulerDecision(plan: FfmpegExportPlan, decision: ExportSchedulerDecision): FfmpegExportPlan;
/**
 * 获取推荐的导出配置
 */
export declare function getRecommendedExportConfig(project: ExportProject, hardwareConcurrency?: number, availableMemoryMb?: number): ExportSchedulerConfig;
//# sourceMappingURL=export-scheduler.d.ts.map