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
import { identityTranslator } from '../ai-module-types';

// ==================== 类型定义 ====================

/** 内容类型 */
export type ContentType = 'subtitle' | 'dubbing' | 'music' | 'effect' | 'voiceover';

/** 内容质量等级 */
export type ContentQuality = 'draft' | 'standard' | 'high' | 'ultra';

/** 音乐风格 */
export type MusicGenre = 'cinematic' | 'pop' | 'electronic' | 'ambient' | 'jazz' | 'rock' | 'classical' | 'lo-fi';

/** 音乐情绪 */
export type MusicMood = 'happy' | 'sad' | 'epic' | 'calm' | 'tense' | 'romantic' | 'mysterious' | 'energetic';

/** 特效类型 */
export type AIEffectType =
  'particle' | 'light-leak' | 'lens-flare' | 'glitch' | 'smoke' | 'fire' | 'rain' | 'snow' | 'sparkle' | 'bokeh';

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

// ==================== 常量 ====================

/** 质量等级对应的基础生成时间系数（毫秒/单位） */
const QUALITY_TIME_FACTOR: Record<ContentQuality, number> = {
  draft: 0.5,
  standard: 1.0,
  high: 2.0,
  ultra: 4.0,
};

/** 各内容类型的基础生成时间（毫秒） */
const BASE_GENERATION_TIME_MS: Record<ContentType, number> = {
  subtitle: 500,
  dubbing: 1200,
  music: 2000,
  effect: 800,
  voiceover: 1000,
};

/** 默认每行最大字符数 */
const DEFAULT_MAX_CHARS_PER_LINE = 20;

/** 默认最大行数 */
const DEFAULT_MAX_LINES = 2;

/** 默认字体大小 */
const DEFAULT_FONT_SIZE = 48;

/** 默认音频能量阈值 (dB) */
const DEFAULT_SILENCE_THRESHOLD_DB = -40;

/** 默认最小静音时长 (毫秒) */
const DEFAULT_MIN_SILENCE_DURATION_MS = 200;

/** 音频能量包络窗口大小 (样本数) */
const DEFAULT_ENERGY_WINDOW_SIZE = 1024;

/** 音乐风格默认 BPM */
const GENRE_DEFAULT_TEMPO: Record<MusicGenre, number> = {
  cinematic: 90,
  pop: 120,
  electronic: 128,
  ambient: 70,
  jazz: 100,
  rock: 130,
  classical: 80,
  'lo-fi': 85,
};

/** 音乐风格默认调式 */
const GENRE_DEFAULT_KEY: Record<MusicGenre, string> = {
  cinematic: 'C minor',
  pop: 'C major',
  electronic: 'A minor',
  ambient: 'D major',
  jazz: 'Bb major',
  rock: 'E minor',
  classical: 'G major',
  'lo-fi': 'F major',
};

/** 情绪对强度的映射 */
const MOOD_INTENSITY_BASE: Record<MusicMood, number> = {
  happy: 0.7,
  sad: 0.3,
  epic: 0.9,
  calm: 0.2,
  tense: 0.8,
  romantic: 0.4,
  mysterious: 0.5,
  energetic: 0.85,
};

/** 特效基础粒子数量 */
const EFFECT_BASE_PARTICLE_COUNT: Record<AIEffectType, number> = {
  particle: 200,
  'light-leak': 0,
  'lens-flare': 0,
  glitch: 0,
  smoke: 150,
  fire: 300,
  rain: 500,
  snow: 400,
  sparkle: 250,
  bokeh: 100,
};

/** 音频分贝参考值 */
const DB_REF = 1.0;

// ==================== 工具函数 ====================

/** 将数值限制在指定范围 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 生成唯一 ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** 分贝转振幅 */
function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}

/** 振幅转分贝 */
function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return -100;
  return 20 * Math.log10(amplitude);
}

// ==================== 音频辅助函数 ====================

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
export function computeAudioEnergyEnvelope(audioData: Float32Array, windowSize: number): Float32Array {
  if (audioData.length === 0 || windowSize <= 0) {
    return new Float32Array(0);
  }

  const safeWindowSize = Math.max(1, Math.round(windowSize));
  const numFrames = Math.ceil(audioData.length / safeWindowSize);
  const envelope = new Float32Array(numFrames);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * safeWindowSize;
    const end = Math.min(start + safeWindowSize, audioData.length);
    let sumSquares = 0;

    for (let i = start; i < end; i++) {
      sumSquares += audioData[i] * audioData[i];
    }

    const rms = Math.sqrt(sumSquares / (end - start));
    envelope[frame] = amplitudeToDb(rms);
  }

  return envelope;
}

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
export function detectSilence(
  audioData: Float32Array,
  sampleRate: number,
  thresholdDb: number = DEFAULT_SILENCE_THRESHOLD_DB,
  minDurationMs: number = DEFAULT_MIN_SILENCE_DURATION_MS,
): Array<{ startMs: number; endMs: number }> {
  if (audioData.length === 0 || sampleRate <= 0) {
    return [];
  }

  const safeThreshold = clamp(thresholdDb, -100, 0);
  const safeMinDuration = Math.max(0, minDurationMs);

  // 使用较大窗口减少噪声影响（约 20ms 的窗口）
  const windowSize = Math.max(1, Math.round(sampleRate * 0.02));
  const envelope = computeAudioEnergyEnvelope(audioData, windowSize);

  const frameDurationMs = (windowSize / sampleRate) * 1000;
  const minSilenceFrames = Math.max(1, Math.ceil(safeMinDuration / frameDurationMs));

  // 检测低于阈值的连续帧
  const rawSegments: Array<{ startFrame: number; endFrame: number }> = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] < safeThreshold) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = i;
      }
    } else {
      if (inSilence) {
        const frameCount = i - silenceStart;
        if (frameCount >= minSilenceFrames) {
          rawSegments.push({ startFrame: silenceStart, endFrame: i });
        }
        inSilence = false;
      }
    }
  }

  // 处理末尾静音
  if (inSilence) {
    const frameCount = envelope.length - silenceStart;
    if (frameCount >= minSilenceFrames) {
      rawSegments.push({ startFrame: silenceStart, endFrame: envelope.length });
    }
  }

  // 合并间隔小于 minDurationMs 的相邻静音段
  const mergeGapFrames = Math.ceil(safeMinDuration / frameDurationMs);
  const merged: Array<{ startFrame: number; endFrame: number }> = [];

  for (const seg of rawSegments) {
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      if (seg.startFrame - last.endFrame <= mergeGapFrames) {
        last.endFrame = seg.endFrame;
        continue;
      }
    }
    merged.push({ ...seg });
  }

  // 转换为毫秒
  return merged.map((seg) => ({
    startMs: Math.round(seg.startFrame * frameDurationMs),
    endMs: Math.round(seg.endFrame * frameDurationMs),
  }));
}

// ==================== 字幕生成 ====================

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
export function generateSubtitle(
  audioData: Float32Array,
  sampleRate: number,
  config: SubtitleGenerationConfig = {},
): GeneratedContent {
  const startTime = performance.now();

  const maxCharsPerLine = clamp(config.maxCharsPerLine ?? DEFAULT_MAX_CHARS_PER_LINE, 5, 100);
  const maxLines = clamp(config.maxLines ?? DEFAULT_MAX_LINES, 1, 5);
  const fontSize = clamp(config.fontSize ?? DEFAULT_FONT_SIZE, 12, 200);
  const autoBreak = config.autoBreak ?? true;
  const position = config.position ?? 'bottom';

  // 检测静音段，用于切分音频
  const silenceSegments = detectSilence(audioData, sampleRate);

  // 将静音段转换为有声段
  const totalDurationMs = (audioData.length / sampleRate) * 1000;
  const speechSegments = silenceToSpeechSegments(silenceSegments, totalDurationMs);

  // 生成字幕条目
  const subtitles = speechSegments.map((seg, index) => {
    const durationMs = seg.endMs - seg.startMs;

    // 基于时长估算字数（中文约 4 字/秒，英文约 15 字符/秒）
    const estimatedChars = Math.round((durationMs / 1000) * 4);

    // 生成占位文本行（实际使用时由 ASR 替换）
    const textLines = autoBreak
      ? breakTextIntoLines(estimatedChars, maxCharsPerLine, maxLines)
      : [`[字幕 ${index + 1}]`];

    return {
      index,
      startMs: seg.startMs,
      endMs: seg.endMs,
      text: textLines.join('\n'),
      position,
      fontSize,
      style: config.style ?? {},
    };
  });

  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('subtitle'),
    type: 'subtitle',
    data: {
      subtitles,
      config: {
        language: config.language ?? 'auto',
        maxCharsPerLine,
        maxLines,
        position,
        fontSize,
        autoBreak,
        speakerDiarization: config.speakerDiarization ?? false,
      },
    },
    duration: totalDurationMs / 1000,
    metadata: {
      subtitleCount: subtitles.length,
      speechSegmentCount: speechSegments.length,
      silenceSegmentCount: silenceSegments.length,
      sampleRate,
      audioLengthSamples: audioData.length,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 将静音段列表转换为有声段列表
 */
function silenceToSpeechSegments(
  silenceSegments: Array<{ startMs: number; endMs: number }>,
  totalDurationMs: number,
): Array<{ startMs: number; endMs: number }> {
  if (silenceSegments.length === 0) {
    return [{ startMs: 0, endMs: Math.round(totalDurationMs) }];
  }

  const speech: Array<{ startMs: number; endMs: number }> = [];

  // 开头有声段
  if (silenceSegments[0].startMs > 0) {
    speech.push({ startMs: 0, endMs: silenceSegments[0].startMs });
  }

  // 中间有声段
  for (let i = 0; i < silenceSegments.length - 1; i++) {
    const gap = silenceSegments[i + 1].startMs - silenceSegments[i].endMs;
    if (gap > 50) {
      speech.push({
        startMs: silenceSegments[i].endMs,
        endMs: silenceSegments[i + 1].startMs,
      });
    }
  }

  // 末尾有声段
  const lastSilenceEnd = silenceSegments[silenceSegments.length - 1].endMs;
  if (lastSilenceEnd < totalDurationMs - 10) {
    speech.push({
      startMs: lastSilenceEnd,
      endMs: Math.round(totalDurationMs),
    });
  }

  return speech;
}

/**
 * 将估算的字符数自适应断行
 */
function breakTextIntoLines(totalChars: number, maxCharsPerLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let remaining = totalChars;

  for (let i = 0; i < maxLines && remaining > 0; i++) {
    const lineChars = Math.min(remaining, maxCharsPerLine);
    lines.push(`[文本 ${lineChars} 字]`);
    remaining -= lineChars;
  }

  return lines;
}

// ==================== AI 配音 ====================

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
export function generateDubbing(text: string, config: DubbingConfig = {}): GeneratedContent {
  const startTime = performance.now();

  const speed = clamp(config.speed ?? 1.0, 0.5, 2.0);
  const pitch = clamp(config.pitch ?? 1.0, 0.5, 2.0);
  const volume = clamp(config.volume ?? 1.0, 0.0, 1.0);

  // 文本分析
  const cleanedText = text.trim();
  const sentences = splitIntoSentences(cleanedText);
  const charCount = cleanedText.length;
  const wordCount = estimateWordCount(cleanedText);

  // 韵律生成：基于句子结构计算停顿和重音
  const prosodySegments = sentences.map((sentence) => {
    const sentenceChars = sentence.trim().length;
    const baseDurationMs = (sentenceChars / 4 / speed) * 1000; // 基于 4 字/秒的基准语速
    const emotionFactor = getEmotionFactor(config.emotion ?? 'neutral');

    return {
      text: sentence.trim(),
      durationMs: Math.round(baseDurationMs * emotionFactor),
      pitch,
      volume,
      speed,
      pauseAfterMs: estimatePauseAfterSentence(sentence),
      emphasis: detectEmphasisWords(sentence),
    };
  });

  // 时间映射
  let currentMs = 0;
  const timeline = prosodySegments.map((seg) => {
    const startMs = currentMs;
    const endMs = currentMs + seg.durationMs;
    currentMs = endMs + seg.pauseAfterMs;
    return {
      text: seg.text,
      startMs,
      endMs,
      durationMs: seg.durationMs,
      pitch: seg.pitch,
      volume: seg.volume,
      speed: seg.speed,
      pauseAfterMs: seg.pauseAfterMs,
      emphasis: seg.emphasis,
    };
  });

  const totalDurationMs = currentMs;
  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('dubbing'),
    type: 'dubbing',
    data: {
      timeline,
      prosody: prosodySegments,
      voiceId: config.voiceId ?? 'default',
      language: config.language ?? 'auto',
      lipSync: config.lipSync ?? false,
      emotion: config.emotion ?? 'neutral',
    },
    duration: totalDurationMs / 1000,
    metadata: {
      charCount,
      wordCount,
      sentenceCount: sentences.length,
      averageSpeed: speed,
      pitch,
      volume,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 将文本按句拆分
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // 按中英文句末标点拆分
  const parts = text.split(/(?<=[。！？!?。.!?])\s*/);
  const result = parts.filter((s) => s.trim().length > 0);

  // 如果没有句末标点，按逗号或长度拆分
  if (result.length <= 1 && text.length > 30) {
    const clauses = text.split(/(?<=[，；,;])\s*/);
    const filtered = clauses.filter((s) => s.trim().length > 0);
    if (filtered.length > 1) return filtered;

    // 按固定长度拆分
    const maxLen = 20;
    const forced: string[] = [];
    let remaining = text;
    while (remaining.length > maxLen) {
      forced.push(remaining.substring(0, maxLen));
      remaining = remaining.substring(maxLen);
    }
    if (remaining.length > 0) forced.push(remaining);
    return forced;
  }

  return result;
}

/**
 * 估算词数
 */
function estimateWordCount(text: string): number {
  if (!text) return 0;

  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
  let cjkCount = 0;
  let latinCount = 0;

  for (const char of text) {
    if (cjkPattern.test(char)) {
      cjkCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      latinCount++;
    }
  }

  // 中日韩按字计数，英文按空格分词
  const englishWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return cjkCount + englishWords;
}

/**
 * 获取情感系数（影响时长和音量变化）
 */
function getEmotionFactor(emotion: string): number {
  const factors: Record<string, number> = {
    neutral: 1.0,
    happy: 0.9,
    sad: 1.3,
    angry: 0.8,
    fearful: 1.2,
    excited: 0.85,
    calm: 1.15,
  };
  return factors[emotion] ?? 1.0;
}

/**
 * 估算句末停顿（毫秒）
 */
function estimatePauseAfterSentence(sentence: string): number {
  const trimmed = sentence.trim();
  if (!trimmed) return 0;

  const lastChar = trimmed[trimmed.length - 1];

  // 句末标点 -> 长停顿
  if (/[。！？!?]/.test(lastChar)) return 400;

  // 逗号分号 -> 中停顿
  if (/[,;，；]/.test(lastChar)) return 200;

  // 其他 -> 短停顿
  return 100;
}

/**
 * 检测句子中的重读词
 * 基于简单启发式：引号内、大写词、感叹词
 */
function detectEmphasisWords(sentence: string): string[] {
  const emphasis: string[] = [];

  // 引号内文字
  const quoted = sentence.match(/[""「]([^""」]+)[""」]/g);
  if (quoted) {
    for (const q of quoted) {
      emphasis.push(q.replace(/[""「」]/g, ''));
    }
  }

  // 全大写英文词
  const upperWords = sentence.match(/\b[A-Z]{2,}\b/g);
  if (upperWords) {
    emphasis.push(...upperWords);
  }

  return emphasis;
}

// ==================== AI 配乐 ====================

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
export function generateMusicStructure(
  genre: MusicGenre,
  mood: MusicMood,
  duration: number,
  tempo: number,
): MusicStructure {
  const safeDuration = clamp(duration, 5, 600);
  const safeTempo = clamp(tempo, 40, 240);

  const beatsPerSecond = safeTempo / 60;
  const totalBeats = Math.round(safeDuration * beatsPerSecond);
  const baseIntensity = MOOD_INTENSITY_BASE[mood];

  // 根据风格选择拍子记号
  const timeSignature: [number, number] = [4, 4];

  // 根据总拍数分配段落
  const sections = allocateSections(totalBeats, baseIntensity, genre);

  return {
    sections,
    totalBeats,
    tempo: safeTempo,
    timeSignature,
    key: GENRE_DEFAULT_KEY[genre],
  };
}

/**
 * 分配音乐段落
 */
function allocateSections(totalBeats: number, baseIntensity: number, genre: MusicGenre): MusicSection[] {
  const sections: MusicSection[] = [];
  let currentBeat = 0;

  // Intro: 占总长度 10-15%
  const introBeats = Math.max(4, Math.round(totalBeats * 0.12));
  sections.push({
    type: 'intro',
    startBeat: currentBeat,
    endBeat: currentBeat + introBeats,
    intensity: clamp(baseIntensity * 0.5, 0, 1),
  });
  currentBeat += introBeats;

  // 计算剩余拍数需要多少 verse-chorus 循环
  const remainingBeats = totalBeats - currentBeat;
  const isShort = remainingBeats < 32;

  if (isShort) {
    // 短曲：一个 verse + 一个 chorus + outro
    const verseBeats = Math.round(remainingBeats * 0.45);
    const chorusBeats = Math.round(remainingBeats * 0.4);

    sections.push({
      type: 'verse',
      startBeat: currentBeat,
      endBeat: currentBeat + verseBeats,
      intensity: clamp(baseIntensity * 0.7, 0, 1),
    });
    currentBeat += verseBeats;

    sections.push({
      type: 'chorus',
      startBeat: currentBeat,
      endBeat: currentBeat + chorusBeats,
      intensity: clamp(baseIntensity, 0, 1),
    });
    currentBeat += chorusBeats;
  } else {
    // 长曲：多段 verse-chorus，中间可能有 bridge
    const verseChorusUnitBeats =
      genre === 'ambient' || genre === 'lo-fi' ? Math.round(remainingBeats * 0.15) : Math.round(remainingBeats * 0.2);
    const verseBeats = Math.round(verseChorusUnitBeats * 0.55);
    const chorusBeats = verseChorusUnitBeats - verseBeats;

    let repeatCount = 0;
    const maxRepeats = Math.floor((remainingBeats * 0.85) / verseChorusUnitBeats);

    while (currentBeat < totalBeats * 0.8 && repeatCount < maxRepeats) {
      // Verse
      const vIntensity = clamp(baseIntensity * (0.6 + repeatCount * 0.05), 0, 1);
      sections.push({
        type: 'verse',
        startBeat: currentBeat,
        endBeat: currentBeat + verseBeats,
        intensity: vIntensity,
      });
      currentBeat += verseBeats;

      // Chorus
      const cIntensity = clamp(baseIntensity * (0.9 + repeatCount * 0.03), 0, 1);
      sections.push({
        type: 'chorus',
        startBeat: currentBeat,
        endBeat: currentBeat + chorusBeats,
        intensity: cIntensity,
      });
      currentBeat += chorusBeats;

      // 第二段后插入 bridge
      if (repeatCount === 1 && currentBeat < totalBeats * 0.7) {
        const bridgeBeats = Math.round(verseBeats * 0.7);
        sections.push({
          type: 'bridge',
          startBeat: currentBeat,
          endBeat: currentBeat + bridgeBeats,
          intensity: clamp(baseIntensity * 0.6, 0, 1),
        });
        currentBeat += bridgeBeats;
      }

      repeatCount++;
    }
  }

  // Outro: 占剩余拍数
  const outroBeats = Math.max(4, totalBeats - currentBeat);
  sections.push({
    type: 'outro',
    startBeat: currentBeat,
    endBeat: totalBeats,
    intensity: clamp(baseIntensity * 0.4, 0, 1),
  });

  return sections;
}

/**
 * AI 配乐生成
 *
 * 基于配置参数生成完整的音乐结构和编曲参数。
 * 不直接生成音频波形，而是输出可用于音频引擎的结构化数据。
 *
 * @param config - 配乐配置
 * @returns 生成的配乐内容
 */
export function generateMusic(config: MusicGenerationConfig = {}): GeneratedContent {
  const startTime = performance.now();

  const genre = config.genre ?? 'cinematic';
  const mood = config.mood ?? 'calm';
  const duration = clamp(config.duration ?? 30, 5, 600);
  const tempo = clamp(config.tempo ?? GENRE_DEFAULT_TEMPO[genre], 40, 240);
  const loopable = config.loopable ?? false;
  const fadeIn = clamp(config.fadeIn ?? 0, 0, 30);
  const fadeOut = clamp(config.fadeOut ?? 0, 0, 30);

  const structure = generateMusicStructure(genre, mood, duration, tempo);

  // 为每个段落生成编曲参数
  const arrangement = structure.sections.map((section) => ({
    ...section,
    instruments: config.instruments ?? getDefaultInstruments(genre),
    dynamics: computeDynamics(section.intensity, mood),
    harmonicProgression: generateChordProgression(genre, section.type),
  }));

  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('music'),
    type: 'music',
    data: {
      structure,
      arrangement,
      genre,
      mood,
      loopable,
      fadeIn,
      fadeOut,
    },
    duration,
    metadata: {
      tempo,
      key: structure.key,
      timeSignature: structure.timeSignature,
      sectionCount: structure.sections.length,
      totalBeats: structure.totalBeats,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 获取风格默认乐器列表
 */
function getDefaultInstruments(genre: MusicGenre): string[] {
  const instruments: Record<MusicGenre, string[]> = {
    cinematic: ['strings', 'brass', 'timpani', 'choir', 'piano'],
    pop: ['drums', 'bass', 'synth', 'vocals', 'guitar'],
    electronic: ['synth-bass', 'drum-machine', 'pad', 'lead-synth', 'fx'],
    ambient: ['pad', 'piano', 'strings', 'nature-sounds', 'reverb'],
    jazz: ['drums', 'upright-bass', 'piano', 'saxophone', 'trumpet'],
    rock: ['drums', 'bass', 'electric-guitar', 'vocals', 'keys'],
    classical: ['strings', 'woodwinds', 'brass', 'timpani', 'harp'],
    'lo-fi': ['drums', 'bass', 'electric-piano', 'vinyl-crackle', 'guitar'],
  };
  return instruments[genre] ?? instruments.cinematic;
}

/**
 * 计算动态参数
 */
function computeDynamics(
  intensity: number,
  mood: MusicMood,
): { volume: number; attack: number; release: number; sustain: number } {
  const safeIntensity = clamp(intensity, 0, 1);

  // 情绪对包络的影响
  const envelopePresets: Record<MusicMood, { attack: number; release: number; sustain: number }> = {
    happy: { attack: 0.02, release: 0.1, sustain: 0.8 },
    sad: { attack: 0.1, release: 0.5, sustain: 0.6 },
    epic: { attack: 0.05, release: 0.3, sustain: 0.9 },
    calm: { attack: 0.2, release: 0.8, sustain: 0.5 },
    tense: { attack: 0.01, release: 0.2, sustain: 0.7 },
    romantic: { attack: 0.15, release: 0.6, sustain: 0.65 },
    mysterious: { attack: 0.3, release: 0.7, sustain: 0.4 },
    energetic: { attack: 0.01, release: 0.1, sustain: 0.85 },
  };

  const preset = envelopePresets[mood];

  return {
    volume: safeIntensity,
    attack: preset.attack,
    release: preset.release,
    sustain: preset.sustain * safeIntensity,
  };
}

/**
 * 生成和弦进行
 */
function generateChordProgression(genre: MusicGenre, sectionType: MusicSection['type']): string[] {
  // 基于风格和段落类型的常见和弦进行
  const progressions: Record<MusicGenre, Record<string, string[]>> = {
    cinematic: {
      intro: ['i', 'III'],
      verse: ['i', 'III', 'VII', 'VI'],
      chorus: ['i', 'iv', 'VII', 'V'],
      bridge: ['VI', 'III', 'iv', 'V'],
      outro: ['i', 'VII', 'i'],
    },
    pop: {
      intro: ['I', 'V'],
      verse: ['I', 'V', 'vi', 'IV'],
      chorus: ['I', 'V', 'vi', 'IV'],
      bridge: ['vi', 'IV', 'I', 'V'],
      outro: ['I', 'V', 'I'],
    },
    electronic: {
      intro: ['i', 'VII'],
      verse: ['i', 'VI', 'III', 'VII'],
      chorus: ['i', 'VII', 'VI', 'VII'],
      bridge: ['iv', 'VII', 'i', 'VI'],
      outro: ['i'],
    },
    ambient: {
      intro: ['I', 'add9'],
      verse: ['I', 'add9', 'sus2', 'add9'],
      chorus: ['I', 'add9', 'sus4', 'add9'],
      bridge: ['ii', 'add9', 'sus2'],
      outro: ['I', 'add9'],
    },
    jazz: {
      intro: ['IIMaj7', 'V7'],
      verse: ['IMaj7', 'VI7', 'IIMaj7', 'V7'],
      chorus: ['IMaj7', 'IIM7', 'IIIM7', 'IVMaj7'],
      bridge: ['bVIIMaj7', 'bIIIMaj7', 'bVIMaj7', 'V7'],
      outro: ['IMaj7', 'V7', 'IMaj7'],
    },
    rock: {
      intro: ['i', 'i'],
      verse: ['i', 'VI', 'III', 'VII'],
      chorus: ['i', 'VII', 'VI', 'VII'],
      bridge: ['iv', 'V', 'iv', 'V'],
      outro: ['i', 'VII', 'i'],
    },
    classical: {
      intro: ['I', 'I6'],
      verse: ['I', 'ii6', 'V', 'I'],
      chorus: ['I', 'IV', 'V', 'I'],
      bridge: ['vi', 'ii', 'IV', 'V'],
      outro: ['I', 'V', 'I'],
    },
    'lo-fi': {
      intro: ['IMaj7', 'add9'],
      verse: ['IMaj7', 'iiMaj7', 'iii7', 'IVMaj7'],
      chorus: ['IMaj7', 'IVMaj7', 'VMaj7', 'IVMaj7'],
      bridge: ['vi7', 'iiMaj7', 'V7', 'IMaj7'],
      outro: ['IMaj7'],
    },
  };

  const genreProgressions = progressions[genre] ?? progressions.cinematic;
  return genreProgressions[sectionType] ?? genreProgressions.verse;
}

// ==================== AI 特效 ====================

/**
 * AI 特效生成
 *
 * 基于特效类型和强度计算特效参数。
 * 不直接渲染，而是输出可用于渲染引擎的结构化参数。
 *
 * @param config - 特效配置
 * @returns 生成的特效参数内容
 */
export function generateEffect(config: EffectGenerationConfig): GeneratedContent {
  const startTime = performance.now();

  const intensity = clamp(config.intensity ?? 0.5, 0, 1);
  const duration = clamp(config.duration ?? 3, 0.1, 60);

  const effectParams = computeEffectParameters(config.effectType, intensity, duration, config.parameters);

  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('effect'),
    type: 'effect',
    data: {
      effectType: config.effectType,
      parameters: effectParams,
      intensity,
      duration,
    },
    duration,
    metadata: {
      effectType: config.effectType,
      intensity,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 计算特效参数
 */
function computeEffectParameters(
  effectType: AIEffectType,
  intensity: number,
  duration: number,
  customParams?: Record<string, unknown>,
): Record<string, unknown> {
  const baseParams: Record<string, unknown> = {
    effectType,
    intensity,
    duration,
  };

  switch (effectType) {
    case 'particle': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.particle * intensity * 3);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 4 + intensity * 6 },
        speed: { min: 10, max: 50 + intensity * 100 },
        spread: 360 * intensity,
        lifetime: { min: 0.5, max: duration * 0.8 },
        gravity: 0.1 + intensity * 0.3,
        color: customParams?.color ?? '#ffffff',
        opacity: { start: 1, end: 0 },
        blendMode: 'additive',
      };
    }

    case 'light-leak': {
      return {
        ...baseParams,
        leakCount: Math.round(1 + intensity * 4),
        leakSize: 0.2 + intensity * 0.5,
        position: { x: 0.3 + Math.random() * 0.4, y: 0.2 + Math.random() * 0.3 },
        color: customParams?.color ?? '#ffaa44',
        opacity: intensity * 0.7,
        falloff: 0.5 + (1 - intensity) * 0.4,
        animation: 'drift',
        driftSpeed: 0.05 + intensity * 0.1,
      };
    }

    case 'lens-flare': {
      return {
        ...baseParams,
        flareCount: Math.round(2 + intensity * 6),
        primarySize: 0.1 + intensity * 0.3,
        secondarySize: 0.05 + intensity * 0.15,
        position: { x: 0.5, y: 0.3 },
        color: customParams?.color ?? '#ffffff',
        opacity: 0.3 + intensity * 0.5,
        chromaticAberration: intensity * 0.1,
        starburst: intensity > 0.6,
        starburstRays: intensity > 0.6 ? 6 + Math.round(intensity * 6) : 0,
      };
    }

    case 'glitch': {
      return {
        ...baseParams,
        glitchIntensity: intensity,
        blockSize: Math.round(2 + (1 - intensity) * 20),
        frequency: 0.5 + intensity * 3,
        sliceCount: Math.round(1 + intensity * 8),
        colorShift: intensity * 0.3,
        scanlines: intensity > 0.4,
        scanlineSpacing: 2 + Math.round((1 - intensity) * 4),
        noiseAmount: intensity * 0.5,
        corruption: intensity > 0.7,
      };
    }

    case 'smoke': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.smoke * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 20, max: 80 + intensity * 120 },
        speed: { min: 5, max: 20 + intensity * 40 },
        direction: 'up',
        spread: 30 + intensity * 60,
        opacity: { start: intensity * 0.4, end: 0 },
        color: customParams?.color ?? '#888888',
        turbulence: 0.3 + intensity * 0.5,
        lifetime: { min: 2, max: duration * 0.9 },
      };
    }

    case 'fire': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.fire * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 4, max: 15 + intensity * 25 },
        speed: { min: 40, max: 100 + intensity * 150 },
        direction: 'up',
        spread: 15 + intensity * 30,
        opacity: { start: 1, end: 0 },
        colors: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'],
        heat: intensity,
        flicker: 0.3 + intensity * 0.5,
        smokeEmission: intensity > 0.5,
      };
    }

    case 'rain': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.rain * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 2 + intensity * 2 },
        speed: { min: 200, max: 400 + intensity * 300 },
        direction: 270, // 向下
        spread: 5 + intensity * 10,
        angle: 10 + intensity * 15,
        opacity: { start: 0.4 + intensity * 0.3, end: 0.1 },
        color: customParams?.color ?? '#aaccee',
        splashes: intensity > 0.5,
        splashSize: 2 + intensity * 4,
        mist: intensity > 0.7,
      };
    }

    case 'snow': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.snow * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 2, max: 5 + intensity * 8 },
        speed: { min: 20, max: 60 + intensity * 60 },
        direction: 270,
        spread: 60 + intensity * 40,
        drift: 0.3 + intensity * 0.5,
        opacity: { start: 0.7 + intensity * 0.3, end: 0 },
        color: '#ffffff',
        accumulation: intensity > 0.6,
        shimmer: 0.2 + intensity * 0.4,
      };
    }

    case 'sparkle': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.sparkle * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 4 + intensity * 6 },
        speed: { min: 5, max: 30 + intensity * 50 },
        spread: 360,
        opacity: { start: 1, end: 0 },
        color: customParams?.color ?? '#ffffcc',
        twinkle: 0.5 + intensity * 0.5,
        twinkleSpeed: 2 + intensity * 8,
        lifetime: { min: 0.3, max: 1.5 + intensity },
        glow: true,
        glowSize: 3 + intensity * 5,
      };
    }

    case 'bokeh': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.bokeh * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 10, max: 40 + intensity * 80 },
        speed: { min: 1, max: 10 + intensity * 20 },
        spread: 360,
        opacity: { start: 0.3 + intensity * 0.3, end: 0 },
        color: customParams?.color ?? '#ffffff',
        shape: 'circle',
        blur: 5 + intensity * 15,
        chromatic: intensity > 0.5,
        drift: 0.1 + intensity * 0.3,
      };
    }

    default:
      return baseParams;
  }
}

// ==================== 估算与配置 ====================

/**
 * 估算生成时间（毫秒）
 *
 * 基于内容类型、质量等级和配置参数综合估算。
 *
 * @param config - 内容生成配置
 * @returns 预估生成时间（毫秒）
 */
export function estimateGenerationTime(config: ContentGenerationConfig): number {
  const baseTime = BASE_GENERATION_TIME_MS[config.type];
  const qualityFactor = QUALITY_TIME_FACTOR[config.quality ?? 'standard'];
  const gpuFactor = config.enableGPU ? 0.6 : 1.0;

  let contentFactor = 1.0;

  // 根据自定义参数调整
  if (config.customParams) {
    // 如果有 duration 参数，按比例调整
    if (typeof config.customParams.duration === 'number') {
      contentFactor *= clamp(config.customParams.duration / 30, 0.5, 10);
    }
    // 如果有文本长度，按比例调整
    if (typeof config.customParams.textLength === 'number') {
      contentFactor *= clamp(config.customParams.textLength / 100, 0.3, 5);
    }
  }

  return Math.round(baseTime * qualityFactor * gpuFactor * contentFactor);
}

/**
 * 创建默认内容生成配置
 *
 * @param type - 内容类型
 * @returns 默认配置
 */
export function createDefaultContentGenerationConfig(type: ContentType): ContentGenerationConfig {
  return {
    type,
    language: 'auto',
    enableGPU: false,
    quality: 'standard',
    outputFormat: getDefaultOutputFormat(type),
    customParams: {},
  };
}

/**
 * 获取默认输出格式
 */
function getDefaultOutputFormat(type: ContentType): string {
  const formats: Record<ContentType, string> = {
    subtitle: 'srt',
    dubbing: 'wav',
    music: 'wav',
    effect: 'json',
    voiceover: 'wav',
  };
  return formats[type];
}

/**
 * 验证内容生成配置
 *
 * 检查配置参数的完整性和合法性。
 *
 * @param config - 内容生成配置
 * @returns 配置是否有效
 */
export function validateContentGenerationConfig(config: ContentGenerationConfig): boolean {
  if (!config || !config.type) {
    return false;
  }

  const validTypes: ContentType[] = ['subtitle', 'dubbing', 'music', 'effect', 'voiceover'];
  if (!validTypes.includes(config.type)) {
    return false;
  }

  if (config.quality !== undefined) {
    const validQualities: ContentQuality[] = ['draft', 'standard', 'high', 'ultra'];
    if (!validQualities.includes(config.quality)) {
      return false;
    }
  }

  return true;
}

// ==================== AI 提示构建与响应解析 ====================

/**
 * 构建 AI 系统提示
 *
 * 根据内容类型生成用于指导 AI 模型的系统提示词。
 *
 * @param type - 内容类型
 * @returns 系统提示词
 */
export function buildContentGenerationSystemPrompt(type: ContentType): string {
  const basePrompt = '你是一个专业的视频内容生成助手。请根据用户的要求生成高质量的内容，并以 JSON 格式返回结果。';

  const typePrompts: Record<ContentType, string> = {
    subtitle: `${basePrompt}
你的任务是为视频生成字幕。要求：
1. 字幕应自然断行，每行不超过指定字符数
2. 时间戳应与音频精确对齐
3. 支持多语言和说话人分离
4. 返回格式：{ "subtitles": [{ "text": string, "startMs": number, "endMs": number }] }`,

    dubbing: `${basePrompt}
你的任务是生成配音参数。要求：
1. 根据文本内容调整语速、音调和情感
2. 生成自然的韵律和停顿
3. 支持口型同步
4. 返回格式：{ "timeline": [{ "text": string, "startMs": number, "endMs": number, "speed": number, "pitch": number }] }`,

    music: `${basePrompt}
你的任务是生成配乐结构和参数。要求：
1. 根据指定风格和情绪生成音乐结构
2. 包含 intro-verse-chorus-outro 段落
3. 为每个段落指定乐器和动态参数
4. 返回格式：{ "structure": { "sections": [...] }, "arrangement": [...] }`,

    effect: `${basePrompt}
你的任务是生成视觉特效参数。要求：
1. 根据特效类型计算粒子/光效参数
2. 参数应可直接用于渲染引擎
3. 支持强度和时长调节
4. 返回格式：{ "effectType": string, "parameters": { ... } }`,

    voiceover: `${basePrompt}
你的任务是生成旁白配音参数。要求：
1. 根据文本内容生成自然的旁白节奏
2. 适当停顿以配合画面
3. 控制语速和情感表达
4. 返回格式：{ "segments": [{ "text": string, "startMs": number, "endMs": number, "speed": number }] }`,
  };

  return typePrompts[type];
}

/**
 * 构建 AI 用户提示
 *
 * 将配置参数转换为 AI 模型可理解的用户提示词。
 *
 * @param config - 内容生成配置
 * @returns 用户提示词
 */
export function buildContentGenerationUserPrompt(config: ContentGenerationConfig): string {
  const parts: string[] = [`请生成 ${config.type} 类型的内容。`];

  if (config.language && config.language !== 'auto') {
    parts.push(`语言：${config.language}。`);
  }

  if (config.quality) {
    parts.push(`质量等级：${config.quality}。`);
  }

  if (config.enableGPU) {
    parts.push('请启用 GPU 加速优化。');
  }

  if (config.outputFormat) {
    parts.push(`输出格式：${config.outputFormat}。`);
  }

  if (config.customParams) {
    const paramEntries = Object.entries(config.customParams);
    if (paramEntries.length > 0) {
      parts.push('自定义参数：');
      for (const [key, value] of paramEntries) {
        parts.push(`  - ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  parts.push('请以 JSON 格式返回结果。');

  return parts.join('\n');
}

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
export function parseContentGenerationResponse(json: unknown, type: ContentType): ContentGenerationResult {
  if (!json || typeof json !== 'object') {
    throw new Error('无效的 AI 响应：不是对象');
  }

  const obj = json as Record<string, unknown>;
  const contents: GeneratedContent[] = [];
  const warnings: string[] = [];

  // 尝试从不同格式中提取内容
  const contentsSource = Array.isArray(obj.contents) ? obj.contents : Array.isArray(obj) ? obj : [obj];

  for (let i = 0; i < contentsSource.length; i++) {
    const item = contentsSource[i];
    if (!item || typeof item !== 'object') {
      warnings.push(`内容项 ${i} 不是有效对象，已跳过`);
      continue;
    }

    const itemObj = item as Record<string, unknown>;

    const content: GeneratedContent = {
      id: typeof itemObj.id === 'string' ? itemObj.id : generateId(type),
      type,
      data: itemObj.data ?? itemObj.parameters ?? itemObj,
      duration: typeof itemObj.duration === 'number' ? itemObj.duration : 0,
      metadata:
        typeof itemObj.metadata === 'object' && itemObj.metadata !== null
          ? (itemObj.metadata as Record<string, unknown>)
          : {},
      quality: isContentQuality(itemObj.quality) ? itemObj.quality : 'standard',
      generationTimeMs: typeof itemObj.generationTimeMs === 'number' ? itemObj.generationTimeMs : 0,
    };

    contents.push(content);
  }

  if (contents.length === 0) {
    throw new Error('AI 响应中没有有效内容');
  }

  return {
    contents,
    totalGenerationTimeMs:
      typeof obj.totalGenerationTimeMs === 'number'
        ? obj.totalGenerationTimeMs
        : contents.reduce((sum, c) => sum + c.generationTimeMs, 0),
    gpuUsed: typeof obj.gpuUsed === 'boolean' ? obj.gpuUsed : false,
    warnings,
  };
}

/**
 * 类型守卫：检查值是否为有效的 ContentQuality
 */
function isContentQuality(value: unknown): value is ContentQuality {
  return value === 'draft' || value === 'standard' || value === 'high' || value === 'ultra';
}

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
export async function parseContentGenerationResponseSafe(
  json: unknown,
  type: ContentType,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<ContentGenerationResult>> {
  try {
    const data = parseContentGenerationResponse(json, type);
    return { data, error: null };
  } catch {
    const emptyResult: ContentGenerationResult = {
      contents: [],
      totalGenerationTimeMs: 0,
      gpuUsed: false,
      warnings: [],
    };
    return { data: emptyResult, error: t('aiModules.error.parseFailed') };
  }
}
