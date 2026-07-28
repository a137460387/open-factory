/**
 * AI配音时长适配建议（纯本地算法，不发AI）
 *
 * 对每个 TTS 配音 segment 计算 durationDelta，
 * 当差值超过原始时长的 15% 时自动生成适配建议。
 */
import type { TtsSegment, TimingAdaptation, Project } from './model-types';
import type { AiModuleResult, TranslateFn } from './ai-module-types';
/** 超过此比例视为需要适配 */
export declare const DURATION_DELTA_THRESHOLD = 0.15;
/** atempo 最小值（FFmpeg 限制） */
export declare const ATEMPO_MIN = 0.75;
/** atempo 最大值 */
export declare const ATEMPO_MAX = 1;
/**
 * 计算单个 TTS segment 的时长适配建议
 */
export declare function computeTimingAdaptation(originalDuration: number, dubbedDuration: number, nextSegmentStart?: number): TimingAdaptation;
/**
 * 检查 outpoint 是否与下一 segment 冲突
 */
export declare function hasOutpointConflict(suggestedOutPoint: number, nextSegmentStart: number): boolean;
/**
 * 对项目中所有 TTS segments 批量生成适配建议
 * 返回更新后的 segments 数组（不修改原数组）
 */
export declare function batchComputeAdaptations(segments: TtsSegment[]): TtsSegment[];
/**
 * 获取项目中有配音时长问题的 TTS segments
 */
export declare function getSegmentsNeedingAdaptation(project: Project): TtsSegment[];
export declare function computeTimingAdaptationSafe(originalDuration: number, dubbedDuration: number, nextSegmentStart?: number, t?: TranslateFn): Promise<AiModuleResult<TimingAdaptation>>;
//# sourceMappingURL=ai-dubbing-adaptation.d.ts.map