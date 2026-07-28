import type { FfmpegExportPlan, ExportSettings } from './export-types';
/**
 * VMAF 质量监控模块
 *
 * 在导出过程中抽样计算 VMAF 分数，若环境不支持实时计算，
 * 则降级为导出完成后生成质量报告。
 */
export type VmafMonitoringMode = 'realtime' | 'post-export' | 'disabled';
export interface VmafSamplePoint {
    /** 时间戳（秒） */
    timestamp: number;
    /** VMAF 分数 (0-100) */
    vmafScore: number;
    /** PSNR 分数 */
    psnrScore?: number;
    /** SSIM 分数 */
    ssimScore?: number;
    /** 样本路径 */
    samplePath?: string;
}
export interface VmafMonitoringConfig {
    /** 监控模式 */
    mode: VmafMonitoringMode;
    /** 抽样间隔（秒） */
    sampleInterval: number;
    /** 最大样本数 */
    maxSamples: number;
    /** 是否启用 PSNR */
    enablePsnr: boolean;
    /** 是否启用 SSIM */
    enableSsim: boolean;
    /** VMAF 模型路径 */
    modelPath?: string;
}
export interface VmafMonitoringResult {
    /** 监控模式 */
    mode: VmafMonitoringMode;
    /** 样本点 */
    samples: VmafSamplePoint[];
    /** 平均 VMAF 分数 */
    averageVmaf: number;
    /** 最小 VMAF 分数 */
    minVmaf: number;
    /** 最大 VMAF 分数 */
    maxVmaf: number;
    /** VMAF 标准差 */
    vmafStdDev: number;
    /** 质量评级 */
    qualityRating: 'excellent' | 'good' | 'fair' | 'poor';
    /** 质量警告 */
    warnings: string[];
    /** 总处理时间（毫秒） */
    processingTimeMs: number;
}
export interface VmafEnvironmentCapabilities {
    /** 是否支持 VMAF */
    vmafAvailable: boolean;
    /** 是否支持实时 VMAF */
    realtimeSupported: boolean;
    /** VMAF 版本 */
    vmafVersion?: string;
    /** 可用的 VMAF 模型 */
    availableModels: string[];
    /** 错误信息 */
    error?: string;
}
/**
 * 检测 VMAF 环境能力
 */
export declare function detectVmafCapabilities(): Promise<VmafEnvironmentCapabilities>;
/**
 * 确定最佳监控模式
 */
export declare function determineMonitoringMode(capabilities: VmafEnvironmentCapabilities, config?: Partial<VmafMonitoringConfig>): VmafMonitoringMode;
/**
 * 生成 VMAF 采样计划
 */
export declare function generateVmafSamplePlan(duration: number, config: VmafMonitoringConfig): number[];
/**
 * 构建 VMAF 采样 FFmpeg 命令
 */
export declare function buildVmafSampleCommand(sourcePath: string, outputPath: string, timestamp: number, config: VmafMonitoringConfig): string[];
/**
 * 解析 VMAF 结果
 */
export declare function parseVmafResult(jsonOutput: string): Partial<VmafSamplePoint>;
/**
 * 分析 VMAF 监控结果
 */
export declare function analyzeVmafResults(samples: VmafSamplePoint[]): Omit<VmafMonitoringResult, 'mode' | 'processingTimeMs'>;
/**
 * 生成 VMAF 质量报告
 */
export declare function generateVmafReport(result: VmafMonitoringResult, projectName?: string): string;
/**
 * 创建降级质量报告（当 VMAF 不可用时）
 */
export declare function createDegradedQualityReport(plan: FfmpegExportPlan, settings: ExportSettings, duration: number): VmafMonitoringResult;
//# sourceMappingURL=vmaf-monitoring.d.ts.map