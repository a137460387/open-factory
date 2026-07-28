/**
 * AI 辅助剪辑模块
 *
 * 在 smart-editing.ts 的基础算法之上，提供更高级的"自动剪辑建议"功能。
 * 基于内容分析（场景、情绪、节奏、说话人、关键帧）自动生成剪辑方案。
 *
 * 所有函数均为纯计算，无副作用。
 */
import type { AiModuleResult, TranslateFn } from '../ai-module-types';
/**
 * 场景类型枚举
 */
export type SceneType = 'intro' | 'action' | 'dialogue' | 'transition' | 'climax' | 'outro' | 'montage' | 'b-roll';
/**
 * 场景信息
 */
export interface SceneInfo {
    /** 开始时间（秒） */
    startTime: number;
    /** 结束时间（秒） */
    endTime: number;
    /** 场景类型 */
    sceneType: SceneType;
    /** 场景描述 */
    description: string;
    /** 置信度 (0-1) */
    confidence: number;
}
/**
 * 节奏配置
 */
export interface RhythmProfile {
    /** BPM（每分钟节拍数） */
    bpm: number;
    /** 节拍时间点数组（秒） */
    beatTimes: number[];
    /** 能量曲线（归一化 0-1，每秒一个采样点） */
    energyCurve: number[];
    /** 速度变化点数组，包含时间和新 BPM */
    tempoChanges: Array<{
        time: number;
        bpm: number;
    }>;
}
/**
 * 说话人片段
 */
export interface SpeakerSegment {
    /** 开始时间（秒） */
    startTime: number;
    /** 结束时间（秒） */
    endTime: number;
    /** 说话人 ID */
    speakerId: string;
    /** 说话文本（可选，由语音识别提供） */
    text: string;
    /** 情绪标签 */
    emotion: string;
}
/**
 * 内容分析结果
 */
export interface ContentAnalysisResult {
    /** 检测到的场景列表 */
    scenes: SceneInfo[];
    /** 情绪曲线（每秒一个采样点，归一化 0-1，0=消极，1=积极） */
    emotionCurve: number[];
    /** 节奏配置 */
    rhythmProfile: RhythmProfile;
    /** 说话人片段列表 */
    speakerSegments: SpeakerSegment[];
    /** 关键帧时间点数组（秒） */
    keyFrames: number[];
}
/**
 * 辅助剪辑配置
 */
export interface AssistEditingConfig {
    /** 是否启用自动剪切 */
    enableAutoCut: boolean;
    /** 是否启用节奏同步 */
    enableRhythmSync: boolean;
    /** 是否启用情绪感知 */
    enableEmotionAware: boolean;
    /** 是否启用内容分析 */
    enableContentAnalysis: boolean;
    /** 目标总时长（秒），可选 */
    targetDuration?: number;
    /** 最大剪切数量，可选 */
    maxCutCount?: number;
    /** 最小片段时长（秒） */
    minSegmentDuration: number;
    /** 最大片段时长（秒） */
    maxSegmentDuration: number;
    /** 偏好剪切类型列表 */
    preferredCutTypes: string[];
    /** 过渡偏好 */
    transitionPreference: string;
}
/**
 * 辅助剪辑建议
 */
export interface AssistEditingSuggestion {
    /** 建议 ID */
    id: string;
    /** 剪切开始时间（秒） */
    startTime: number;
    /** 剪切结束时间（秒） */
    endTime: number;
    /** 剪切类型 */
    cutType: string;
    /** 置信度 (0-1) */
    confidence: number;
    /** 建议原因 */
    reason: string;
    /** 来源分析类型 */
    sourceAnalysis: 'scene' | 'rhythm' | 'emotion' | 'speaker' | 'keyframe' | 'combined';
    /** 建议的过渡效果 */
    suggestedTransition: string;
    /** 优先级 (1-10，10 最高) */
    priority: number;
}
/**
 * 辅助剪辑结果
 */
export interface AssistEditingResult {
    /** 剪辑建议列表 */
    suggestions: AssistEditingSuggestion[];
    /** 内容分析结果 */
    analysisResult: ContentAnalysisResult;
    /** 节奏配置 */
    rhythmProfile: RhythmProfile;
    /** 预估总时长（秒） */
    totalEstimatedDuration: number;
    /** 质量评分 (0-1) */
    qualityScore: number;
    /** 处理耗时（毫秒） */
    processingTimeMs: number;
}
/**
 * 辅助剪辑预设
 */
export type AssistEditingPreset = 'quick-cut' | 'rhythm-match' | 'emotion-driven' | 'content-aware' | 'custom';
/**
 * 辅助剪辑进度事件
 */
export interface AssistEditingProgressEvent {
    /** 当前阶段 */
    phase: 'analysis' | 'suggestion' | 'ranking' | 'complete';
    /** 进度 (0-1) */
    progress: number;
    /** 进度消息 */
    message: string;
}
/**
 * 分析视频内容，检测场景、情绪、节奏
 *
 * 基于帧间差异检测场景转换，基于音频能量和过零率分析情绪和节奏。
 * 所有计算在本地完成，无副作用。
 *
 * @param frames - 视频帧数据数组（每帧为 Uint8Array，假设 RGBA 格式）
 * @param audioData - 音频采样数据（单声道浮点，范围 -1 到 1）
 * @param sampleRate - 音频采样率（Hz）
 * @returns 内容分析结果
 */
export declare function analyzeContent(frames: Uint8Array[], audioData: Float32Array, sampleRate: number): ContentAnalysisResult;
/**
 * 基于内容分析结果生成剪辑建议
 *
 * 根据配置中的开关，分别从场景、节奏、情绪、说话人、关键帧等维度
 * 生成剪辑建议，然后合并去重、评估优先级。
 *
 * @param analysis - 内容分析结果
 * @param config - 辅助剪辑配置
 * @returns 剪辑建议列表（已排序）
 */
export declare function generateAssistEditingSuggestions(analysis: ContentAnalysisResult, config: AssistEditingConfig): AssistEditingSuggestion[];
/**
 * 应用预设配置
 *
 * 根据预设名称返回对应的配置对象。
 *
 * @param preset - 预设名称
 * @returns 辅助剪辑配置
 */
export declare function applyAssistEditingPreset(preset: AssistEditingPreset): AssistEditingConfig;
/**
 * 评估单条剪辑建议的质量分数
 *
 * 综合考虑置信度、来源分析可信度、与情绪曲线的匹配度、
 * 时长合理性等因素。
 *
 * @param suggestion - 剪辑建议
 * @param context - 内容分析上下文
 * @returns 质量评分 (0-1)
 */
export declare function scoreSuggestionQuality(suggestion: AssistEditingSuggestion, context: ContentAnalysisResult): number;
/**
 * 过滤和排序剪辑建议
 *
 * 按优先级和质量评分排序，去除超出 maxCount 的低质量建议。
 *
 * @param suggestions - 原始建议列表
 * @param maxCount - 最大返回数量
 * @returns 排序和过滤后的建议列表
 */
export declare function filterAndRankSuggestions(suggestions: AssistEditingSuggestion[], maxCount: number): AssistEditingSuggestion[];
/**
 * 创建默认辅助剪辑配置
 *
 * @returns 默认配置对象
 */
export declare function createDefaultAssistEditingConfig(): AssistEditingConfig;
/**
 * 验证辅助剪辑配置的合法性
 *
 * 检查所有必填字段的类型和数值范围。
 *
 * @param config - 待验证的配置
 * @returns 配置是否合法
 */
export declare function validateAssistEditingConfig(config: AssistEditingConfig): boolean;
/**
 * 构建 AI 辅助剪辑的系统提示
 *
 * 用于调用 LLM 生成剪辑方案时的 system prompt。
 *
 * @returns 系统提示字符串
 */
export declare function buildAssistEditingSystemPrompt(): string;
/**
 * 构建 AI 辅助剪辑的用户提示
 *
 * 将内容分析结果和配置序列化为 LLM 可理解的文本。
 *
 * @param analysis - 内容分析结果
 * @param config - 辅助剪辑配置
 * @returns 用户提示字符串
 */
export declare function buildAssistEditingUserPrompt(analysis: ContentAnalysisResult, config: AssistEditingConfig): string;
/**
 * 解析 AI 响应为辅助剪辑结果
 *
 * 严格解析，失败时抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @returns 辅助剪辑结果
 * @throws 解析失败时抛出错误
 */
export declare function parseAssistEditingResponse(json: unknown): AssistEditingResult;
/**
 * 安全解析 AI 响应
 *
 * 包装 parseAssistEditingResponse，捕获异常并返回 AiModuleResult。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param t - 翻译函数，默认使用 identityTranslator
 * @returns 包含数据或错误信息的 AiModuleResult
 */
export declare function parseAssistEditingResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<AssistEditingResult>>;
/**
 * 检测场景转换点
 *
 * 通过计算相邻帧之间的像素差异来检测场景切换。
 * 使用 RGB 三通道的平均绝对差作为帧间距离度量。
 *
 * @param frames - 视频帧数据数组（Uint8Array，假设 RGBA 格式）
 * @param threshold - 转换阈值 (0-1)，默认 0.35
 * @returns 场景转换点对应的帧索引数组
 */
export declare function detectSceneTransitions(frames: Uint8Array[], threshold?: number): number[];
/**
 * 检测音频起音点（onset detection）
 *
 * 基于短时能量变化率检测音频中的起音点。
 * 起音点通常对应声音的开始（如打击乐、语音起始等）。
 *
 * @param audioData - 音频采样数据（单声道浮点）
 * @param sampleRate - 音频采样率（Hz）
 * @returns 起音点时间数组（秒）
 */
export declare function computeAudioOnsets(audioData: Float32Array, sampleRate: number): number[];
/**
 * 合并相近的剪辑点
 *
 * 当两个剪辑建议的时间间隔小于 minGap 时，保留优先级更高的那个。
 *
 * @param suggestions - 剪辑建议列表
 * @param minGap - 最小间隔（秒）
 * @returns 合并后的建议列表
 */
export declare function mergeNearbyCuts(suggestions: AssistEditingSuggestion[], minGap: number): AssistEditingSuggestion[];
//# sourceMappingURL=assist-editing.d.ts.map