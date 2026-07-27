/** AI智能响度适配建议：简化K-weighting + RMS响度估算 + 平台目标映射 */
/** 平台目标响度（LUFS） */
export declare const PLATFORM_TARGETS: {
    readonly tiktok: -14;
    readonly youtube: -14;
    readonly broadcast: -23;
    readonly podcast: -16;
};
export type PlatformTarget = keyof typeof PLATFORM_TARGETS;
/** 响度建议 */
export interface LoudnessSuggestion {
    measuredLUFS: number;
    targetPlatform: PlatformTarget;
    targetLUFS: number;
    suggestedGainDb: number;
    appliedAt: number | null;
}
/**
 * 简化K-weighting滤波。
 * 模拟ITU-R BS.1770 K-weighting的简化版本：
 * 对低频做衰减（约-4dB@100Hz），对高频做适度提升（约+1dB@10kHz）。
 * 使用一阶IIR滤波器近似。
 */
export declare function applyKWeighting(samples: Float32Array, sampleRate: number): Float32Array;
/**
 * 计算RMS能量。
 */
export declare function calculateBlockRms(samples: Float32Array): number;
/**
 * 估算近似响度（LUFS）。
 * 使用简化K-weighting + 门限RMS测量。
 * 注：这是近似值，不声称完全符合EBU R128。
 */
export declare function estimateLoudness(samples: Float32Array, sampleRate: number): number;
/**
 * 计算建议增益（dB）。
 */
export declare function calculateGainDelta(measuredLUFS: number, targetLUFS: number): number;
/**
 * 判断是否应该生成增益建议（|增益| > threshold dB）。
 */
export declare function shouldSuggestGain(gainDb: number, threshold?: number): boolean;
/**
 * 创建LoudnessSuggestion对象。
 */
export declare function createLoudnessSuggestion(measuredLUFS: number, targetPlatform: PlatformTarget, suggestedGainDb: number): LoudnessSuggestion;
/**
 * 规范化LoudnessSuggestion，处理旧项目兼容。
 */
export declare function normalizeLoudnessSuggestion(input: unknown): LoudnessSuggestion | undefined;
//# sourceMappingURL=ai-loudness-suggestion.d.ts.map