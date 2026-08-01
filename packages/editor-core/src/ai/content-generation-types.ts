/**
 * AI content generation - type definitions and constants
 */

import type {AiModuleResult, TranslateFn} from '../ai-module-types';

// ==================== Types ====================

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

// ==================== Constants ====================

/** 质量等级对应的基础生成时间系数（毫秒/单位） */
export const QUALITY_TIME_FACTOR: Record<ContentQuality, number> = {
  draft: 0.5,
  standard: 1.0,
  high: 2.0,
  ultra: 4.0,
};

/** 各内容类型的基础生成时间（毫秒） */
export const BASE_GENERATION_TIME_MS: Record<ContentType, number> = {
  subtitle: 500,
  dubbing: 1200,
  music: 2000,
  effect: 800,
  voiceover: 1000,
};

/** 默认每行最大字符数 */
export const DEFAULT_MAX_CHARS_PER_LINE = 20;

/** 默认最大行数 */
export const DEFAULT_MAX_LINES = 2;

/** 默认字体大小 */
export const DEFAULT_FONT_SIZE = 48;

/** 默认音频能量阈值 (dB) */
export const DEFAULT_SILENCE_THRESHOLD_DB = -40;

/** 默认最小静音时长 (毫秒) */
export const DEFAULT_MIN_SILENCE_DURATION_MS = 200;

/** 音频能量包络窗口大小 (样本数) */
export const DEFAULT_ENERGY_WINDOW_SIZE = 1024;

/** 音乐风格默认 BPM */
export const GENRE_DEFAULT_TEMPO: Record<MusicGenre, number> = {
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
export const GENRE_DEFAULT_KEY: Record<MusicGenre, string> = {
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
export const MOOD_INTENSITY_BASE: Record<MusicMood, number> = {
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
export const EFFECT_BASE_PARTICLE_COUNT: Record<AIEffectType, number> = {
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
export const DB_REF = 1.0;

// ==================== Utility Functions ====================

/** 生成唯一 ID */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** 分贝转振幅 */
export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}

/** 振幅转分贝 */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return -100;
  return 20 * Math.log10(amplitude);
}
