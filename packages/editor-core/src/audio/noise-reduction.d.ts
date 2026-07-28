/**
 * 智能降噪参数处理模块
 * 基于 FFmpeg afftdn 滤镜提供降噪参数生成和预设管理
 */
/** 降噪预设强度级别 */
export type NoiseReductionPreset = 'light' | 'medium' | 'heavy' | 'custom';
/** 降噪参数 */
export interface NoiseReductionParams {
    /** 降噪强度 (dB)，值越小降噪越强，范围 [-60, 0] */
    noiseFloor: number;
    /** 降噪类型：0=弱, 1=中, 2=强 */
    nrType: number;
    /** 是否启用自动噪声采样 */
    autoNoiseSampling: boolean;
    /** 噪声采样时间窗口开始 (秒) */
    noiseSampleStart: number;
    /** 噪声采样时间窗口结束 (秒) */
    noiseSampleEnd: number;
}
/** 降噪预览结果 */
export interface NoiseReductionPreview {
    /** 应用前的峰值 (dB) */
    beforePeakDb: number;
    /** 应用后的峰值 (dB) */
    afterPeakDb: number;
    /** 估计的信噪比改善 (dB) */
    snrImprovement: number;
    /** FFmpeg 滤镜参数字符串 */
    filterArgs: string[];
}
/** 获取预设参数 */
export declare function getNoiseReductionPreset(preset: NoiseReductionPreset): NoiseReductionParams;
/** 获取所有预设名称 */
export declare function getNoiseReductionPresets(): NoiseReductionPreset[];
/** 获取预设的显示名称 */
export declare function getNoiseReductionPresetLabel(preset: NoiseReductionPreset): string;
/** 验证并规范化降噪参数 */
export declare function normalizeNoiseReductionParams(params: Partial<NoiseReductionParams>): NoiseReductionParams;
/**
 * 生成 FFmpeg afftdn 滤镜参数数组
 * 严格使用参数数组风格，不拼接 shell 字符串
 */
export declare function buildNoiseReductionFfmpegArgs(params: NoiseReductionParams): string[];
/**
 * 生成用于 FFmpeg -af 参数的滤镜字符串
 * 这是用于命令数组风格的单个滤镜参数
 */
export declare function buildNoiseReductionFilterString(params: NoiseReductionParams): string;
/**
 * 计算降噪效果预估
 * 基于输入参数估算降噪后的改善程度
 */
export declare function estimateNoiseReduction(params: NoiseReductionParams, inputPeakDb?: number): NoiseReductionPreview;
/**
 * 检查参数是否表示有效的降噪配置
 */
export declare function isValidNoiseReductionParams(params: Partial<NoiseReductionParams>): boolean;
/**
 * 根据强度百分比 (0-100) 生成降噪参数
 * 0 = 无降噪，100 = 最强降噪
 */
export declare function strengthToNoiseReductionParams(strength: number): NoiseReductionParams;
/**
 * 将降噪参数转换为效果槽参数格式
 * 用于与 mixer-types 的 AudioEffectSlot 集成
 */
export declare function noiseReductionToEffectParams(params: NoiseReductionParams): Record<string, number>;
//# sourceMappingURL=noise-reduction.d.ts.map