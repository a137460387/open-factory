/**
 * AI 内容生成模块
 *
 * 功能：
 * 1. 字幕生成 - 基于音频能量检测与静音分段，自动对齐时间轴生成字幕
 * 2. AI 配音 - 文本分析 + 韵律生成 + 时间映射，输出配音参数
 * 3. AI 配乐 - 基于风格、情绪、节奏的音乐结构生成（intro-verse-chorus-outro）
 * 4. AI 特效 - 粒子 / 光效 / 天气等特效参数计算
 * 5. 统一配置、验证、估算、提示构建与 AI 响应解析
 * 6. 批量生成与进度事件
 *
 * 所有函数均为纯计算，无副作用。
 */
import type { AiModuleResult, TranslateFn } from '../ai-module-types';
/** 内容类型 */
export type ContentType = 'subtitle' | 'dubbing' | 'music' | 'effect' | 'voiceover';
/** 内容质量等级 */
export type ContentQuality = 'draft' | 'standard' | 'high' | 'ultra';
/** 音乐风格 */
export type MusicGenre = 'cinematic' | 'pop' | 'electronic' | 'ambient' | 'jazz' | 'rock' | 'classical' | 'lo-fi';
/** 音乐情绪 */
export type MusicMood = 'happy' | 'sad' | 'epic' | 'calm' | 'tense' | 'romantic' | 'mysterious' | 'energetic';
/** 特效类型 */
export type AIEffectType = 'particle' | 'light-leak' | 'lens-flare' | 'glitch' | 'smoke' | 'fire' | 'rain' | 'snow' | 'sparkle' | 'bokeh';
/** 字幕位置 */
export type SubtitlePosition = 'bottom' | 'top' | 'center';
/** 字幕样式 */
export interface SubtitleStyleConfig {
    /** 字体颜色（CSS 颜色值） */
    color?: string;
    /** 背景颜色（CSS 颜色值） */
    backgroundColor?: string;
    /** 背景不透明度 (0-1) */
    backgroundOpacity?: number;
    /** 描边颜色 */
    strokeColor?: string;
    /** 描边宽度 (px) */
    strokeWidth?: number;
    /** 阴影 */
    textShadow?: string;
}
/**
 * 内容生成通用配置
 */
export interface ContentGenerationConfig {
    /** 内容类型 */
    type: ContentType;
    /** 语言代码 */
    language?: string;
    /** 是否启用 GPU 加速 */
    enableGPU?: boolean;
    /** 输出质量 */
    quality?: ContentQuality;
    /** 输出格式 */
    outputFormat?: string;
    /** 自定义参数 */
    customParams?: Record<string, unknown>;
}
/**
 * 字幕生成配置
 */
export interface SubtitleGenerationConfig {
    /** 语言 */
    language?: string;
    /** 每行最大字符数 */
    maxCharsPerLine?: number;
    /** 最大行数 */
    maxLines?: number;
    /** 字幕样式 */
    style?: SubtitleStyleConfig;
    /** 字幕位置 */
    position?: SubtitlePosition;
    /** 字体大小 (px) */
    fontSize?: number;
    /** 是否自动断行 */
    autoBreak?: boolean;
    /** 是否启用说话人分离 */
    speakerDiarization?: boolean;
}
/**
 * AI 配音配置
 */
export interface DubbingConfig {
    /** 语音 ID */
    voiceId?: string;
    /** 语言 */
    language?: string;
    /** 语速 (0.5-2.0) */
    speed?: number;
    /** 音调 (0.5-2.0) */
    pitch?: number;
    /** 情感 */
    emotion?: string;
    /** 音量 (0-1) */
    volume?: number;
    /** 是否启用口型同步 */
    lipSync?: boolean;
}
/**
 * AI 配乐配置
 */
export interface MusicGenerationConfig {
    /** 音乐风格 */
    genre?: MusicGenre;
    /** 音乐情绪 */
    mood?: MusicMood;
    /** 时长（秒） */
    duration?: number;
    /** 节奏 (BPM) */
    tempo?: number;
    /** 乐器列表 */
    instruments?: string[];
    /** 是否循环 */
    loopable?: boolean;
    /** 淡入时长（秒） */
    fadeIn?: number;
    /** 淡出时长（秒） */
    fadeOut?: number;
}
/**
 * AI 特效配置
 */
export interface EffectGenerationConfig {
    /** 特效类型 */
    effectType: AIEffectType;
    /** 强度 (0-1) */
    intensity?: number;
    /** 时长（秒） */
    duration?: number;
    /** 特效参数 */
    parameters?: Record<string, unknown>;
}
/**
 * 生成内容结果
 */
export interface GeneratedContent {
    /** 内容 ID */
    id: string;
    /** 内容类型 */
    type: ContentType;
    /** 生成的数据（字幕文本 / 音频参数 / 音乐结构 / 特效参数） */
    data: unknown;
    /** 时长（秒） */
    duration: number;
    /** 元数据 */
    metadata: Record<string, unknown>;
    /** 质量等级 */
    quality: ContentQuality;
    /** 生成耗时（毫秒） */
    generationTimeMs: number;
}
/**
 * 内容生成结果
 */
export interface ContentGenerationResult {
    /** 生成的内容列表 */
    contents: GeneratedContent[];
    /** 总生成耗时（毫秒） */
    totalGenerationTimeMs: number;
    /** 是否使用了 GPU */
    gpuUsed: boolean;
    /** 警告信息 */
    warnings: string[];
}
/**
 * 批量生成请求
 */
export interface ContentGenerationBatchRequest {
    /** 批量生成项 */
    items: ContentGenerationConfig[];
}
/**
 * 内容生成进度事件
 */
export interface ContentGenerationProgressEvent {
    /** 内容 ID */
    contentId: string;
    /** 当前阶段 */
    phase: 'initializing' | 'processing' | 'encoding' | 'finalizing';
    /** 进度 (0-1) */
    progress: number;
    /** 预估剩余时间（毫秒） */
    estimatedRemainingMs?: number;
}
/**
 * 音乐段落
 */
export interface MusicSection {
    /** 段落类型 */
    type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
    /** 起始拍号 */
    startBeat: number;
    /** 结束拍号 */
    endBeat: number;
    /** 强度 (0-1) */
    intensity: number;
}
/**
 * 音乐结构
 */
export interface MusicStructure {
    /** 段落列表 */
    sections: MusicSection[];
    /** 总拍数 */
    totalBeats: number;
    /** 拍号 (BPM) */
    tempo: number;
    /** 拍子记号 */
    timeSignature: [number, number];
    /** 调式 */
    key: string;
}
/**
 * 计算音频能量包络
 *
 * 将音频信号按指定窗口大小分帧，计算每帧的 RMS 能量并转换为分贝值。
 * 输出长度为 `ceil(audioData.length / windowSize)`。
 *
 * @param audioData - 音频 PCM 数据（Float32Array，范围 -1 到 1）
 * @param windowSize - 分析窗口大小（样本数）
 * @returns 每帧的能量值（分贝），长度为 ceil(audioData.length / windowSize)
 */
export declare function computeAudioEnergyEnvelope(audioData: Float32Array, windowSize: number): Float32Array;
/**
 * 检测音频中的静音段
 *
 * 基于能量包络分析，将连续低于阈值的区域标记为静音段。
 * 会合并间隔过小的相邻静音段，并过滤掉时长过短的静音段。
 *
 * @param audioData - 音频 PCM 数据（Float32Array，范围 -1 到 1）
 * @param sampleRate - 采样率（Hz）
 * @param thresholdDb - 静音阈值（分贝，默认 -40 dB）
 * @param minDurationMs - 最小静音时长（毫秒，默认 200 ms）
 * @returns 静音段列表，每项包含 startMs 和 endMs
 */
export declare function detectSilence(audioData: Float32Array, sampleRate: number, thresholdDb?: number, minDurationMs?: number): Array<{
    startMs: number;
    endMs: number;
}>;
/**
 * 基于音频生成字幕
 *
 * 纯算法实现流程：
 * 1. 计算音频能量包络，检测静音段
 * 2. 根据静音段切分音频为有声片段
 * 3. 对每个有声片段进行自适应断行（考虑 maxCharsPerLine 和 maxLines）
 * 4. 生成带时间戳的字幕数据
 *
 * @param audioData - 音频 PCM 数据（Float32Array，范围 -1 到 1）
 * @param sampleRate - 采样率（Hz）
 * @param config - 字幕生成配置
 * @returns 生成的字幕内容
 */
export declare function generateSubtitle(audioData: Float32Array, sampleRate: number, config?: SubtitleGenerationConfig): GeneratedContent;
/**
 * AI 配音生成
 *
 * 纯算法实现流程：
 * 1. 文本分析 - 统计字符数、词数、句子数
 * 2. 韵律生成 - 基于语速、音调、情感计算韵律参数
 * 3. 时间映射 - 逐句计算时间戳
 * 4. 输出配音参数（不直接生成音频波形）
 *
 * @param text - 要配音的文本
 * @param config - 配音配置
 * @returns 生成的配音参数内容
 */
export declare function generateDubbing(text: string, config?: DubbingConfig): GeneratedContent;
/**
 * 生成音乐结构
 *
 * 基于风格、情绪、时长和节奏生成 intro-verse-chorus-outro 结构。
 * 每个段落有起始拍号、结束拍号和强度值。
 *
 * @param genre - 音乐风格
 * @param mood - 音乐情绪
 * @param duration - 时长（秒）
 * @param tempo - 节奏（BPM）
 * @returns 音乐结构
 */
export declare function generateMusicStructure(genre: MusicGenre, mood: MusicMood, duration: number, tempo: number): MusicStructure;
/**
 * AI 配乐生成
 *
 * 基于配置参数生成完整的音乐结构和编曲参数。
 * 不直接生成音频波形，而是输出可用于音频引擎的结构化数据。
 *
 * @param config - 配乐配置
 * @returns 生成的配乐内容
 */
export declare function generateMusic(config?: MusicGenerationConfig): GeneratedContent;
/**
 * AI 特效生成
 *
 * 基于特效类型和强度计算特效参数。
 * 不直接渲染，而是输出可用于渲染引擎的结构化参数。
 *
 * @param config - 特效配置
 * @returns 生成的特效参数内容
 */
export declare function generateEffect(config: EffectGenerationConfig): GeneratedContent;
/**
 * 估算生成时间（毫秒）
 *
 * 基于内容类型、质量等级和配置参数综合估算。
 *
 * @param config - 内容生成配置
 * @returns 预估生成时间（毫秒）
 */
export declare function estimateGenerationTime(config: ContentGenerationConfig): number;
/**
 * 创建默认内容生成配置
 *
 * @param type - 内容类型
 * @returns 默认配置
 */
export declare function createDefaultContentGenerationConfig(type: ContentType): ContentGenerationConfig;
/**
 * 验证内容生成配置
 *
 * 检查配置参数的完整性和合法性。
 *
 * @param config - 内容生成配置
 * @returns 配置是否有效
 */
export declare function validateContentGenerationConfig(config: ContentGenerationConfig): boolean;
/**
 * 构建 AI 系统提示
 *
 * 根据内容类型生成用于指导 AI 模型的系统提示词。
 *
 * @param type - 内容类型
 * @returns 系统提示词
 */
export declare function buildContentGenerationSystemPrompt(type: ContentType): string;
/**
 * 构建 AI 用户提示
 *
 * 将配置参数转换为 AI 模型可理解的用户提示词。
 *
 * @param config - 内容生成配置
 * @returns 用户提示词
 */
export declare function buildContentGenerationUserPrompt(config: ContentGenerationConfig): string;
/**
 * 解析 AI 内容生成响应
 *
 * 从 AI 返回的 JSON 中提取结构化的内容生成结果。
 * 如果解析失败则抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param type - 内容类型
 * @returns 解析后的内容生成结果
 * @throws 当 JSON 格式不合法时抛出错误
 */
export declare function parseContentGenerationResponse(json: unknown, type: ContentType): ContentGenerationResult;
/**
 * 安全解析 AI 内容生成响应
 *
 * 包装 parseContentGenerationResponse，在解析失败时返回错误信息而非抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param type - 内容类型
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的内容生成结果
 */
export declare function parseContentGenerationResponseSafe(json: unknown, type: ContentType, t?: TranslateFn): Promise<AiModuleResult<ContentGenerationResult>>;
//# sourceMappingURL=content-generation.d.ts.map