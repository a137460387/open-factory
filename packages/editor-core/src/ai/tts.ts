// -- Types --

/** TTS语言 */
export type TTSLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'auto';

/** TTS语音风格 */
export type TTSVoiceStyle =
  | 'neutral'    // 中性
  | 'happy'      // 欢快
  | 'sad'        // 悲伤
  | 'angry'      // 愤怒
  | 'fearful'    // 恐惧
  | 'disgusted'  // 厌恶
  | 'surprised'  // 惊讶
  | 'custom';    // 自定义

/** TTS语音性别 */
export type TTSVoiceGender = 'male' | 'female' | 'neutral';

/** TTS语音配置 */
export interface TTSVoice {
  /** 语音ID */
  id: string;
  /** 语音名称 */
  name: string;
  /** 语言 */
  language: TTSLanguage;
  /** 性别 */
  gender: TTSVoiceGender;
  /** 支持的风格 */
  styles: TTSVoiceStyle[];
  /** 采样率（Hz） */
  sampleRate: number;
  /** 是否支持情感控制 */
  supportsEmotion: boolean;
  /** 描述 */
  description?: string;
}

/** TTS合成参数 */
export interface TTSSynthesisParams {
  /** 要合成的文本 */
  text: string;
  /** 语音ID */
  voiceId: string;
  /** 语言（auto为自动检测） */
  language?: TTSLanguage;
  /** 语速（0.5-2.0，默认1.0） */
  speed?: number;
  /** 音调（0.5-2.0，默认1.0） */
  pitch?: number;
  /** 音量（0.0-1.0，默认1.0） */
  volume?: number;
  /** 语音风格 */
  style?: TTSVoiceStyle;
  /** 风格强度（0.0-1.0，默认0.5） */
  styleIntensity?: number;
  /** 输出格式 */
  outputFormat?: 'wav' | 'mp3' | 'ogg' | 'pcm';
  /** 采样率（覆盖语音默认值） */
  sampleRate?: number;
}

/** TTS合成结果 */
export interface TTSSynthesisResult {
  /** 音频数据（PCM Float32Array或编码后的ArrayBuffer） */
  audioData: Float32Array | ArrayBuffer;
  /** 采样率 */
  sampleRate: number;
  /** 时长（毫秒） */
  durationMs: number;
  /** 格式 */
  format: 'wav' | 'mp3' | 'ogg' | 'pcm';
  /** 字符到时间的映射（用于字幕对齐） */
  wordTimings?: WordTiming[];
  /** 合成统计 */
  stats: {
    /** 处理时间（毫秒） */
    processingTimeMs: number;
    /** 实时率（处理时间/音频时长，越小越好） */
    realTimeFactor: number;
    /** 字符数 */
    charCount: number;
    /** 词数 */
    wordCount: number;
  };
}

/** 字符/词时间映射 */
export interface WordTiming {
  /** 文本内容 */
  text: string;
  /** 开始时间（毫秒，相对于音频开头） */
  startMs: number;
  /** 结束时间（毫秒） */
  endMs: number;
  /** 置信度 */
  confidence: number;
}

/** TTS进度事件 */
export interface TTSProgressEvent {
  /** 阶段 */
  phase: 'loading-model' | 'synthesizing' | 'encoding' | 'post-processing';
  /** 进度（0-1） */
  progress: number;
  /** 预估剩余时间（毫秒） */
  estimatedMs?: number;
}

/** TTS配置 */
export interface TTSConfig {
  /** 默认语音ID */
  defaultVoiceId?: string;
  /** 默认语速 */
  defaultSpeed?: number;
  /** 默认音调 */
  defaultPitch?: number;
  /** 默认音量 */
  defaultVolume?: number;
  /** 最大文本长度（字符） */
  maxTextLength?: number;
  /** 是否启用自动分段 */
  enableAutoSegment?: boolean;
  /** 分段最大长度（字符） */
  segmentMaxLength?: number;
  /** 分段间隔（毫秒） */
  segmentPauseMs?: number;
}

/** 时间线对齐配置 */
export interface TimelineAlignmentConfig {
  /** 对齐模式 */
  mode: 'natural' | 'fixed' | 'custom';
  /** 固定间隔（毫秒，仅fixed模式） */
  fixedGapMs?: number;
  /** 自定义时间点（仅custom模式） */
  customTimings?: Array<{ startMs: number; endMs: number }>;
  /** 是否自动调整语速以匹配时间范围 */
  autoAdjustSpeed?: boolean;
  /** 目标时间范围（毫秒） */
  targetTimeRangeMs?: { start: number; end: number };
}

/** 时间线片段对齐结果 */
export interface TimelineAlignmentResult {
  /** 对齐后的片段 */
  segments: Array<{
    text: string;
    startMs: number;
    endMs: number;
    speed: number;
  }>;
  /** 总时长（毫秒） */
  totalDurationMs: number;
  /** 平均语速 */
  averageSpeed: number;
}

// -- Constants --
const DEFAULT_SPEED = 1.0;
const DEFAULT_PITCH = 1.0;
const DEFAULT_VOLUME = 1.0;
const DEFAULT_MAX_TEXT_LENGTH = 5000;
const DEFAULT_SEGMENT_MAX_LENGTH = 200;
const DEFAULT_SEGMENT_PAUSE_MS = 300;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2.0;
const MIN_PITCH = 0.5;
const MAX_PITCH = 2.0;
const MIN_VOLUME = 0.0;
const MAX_VOLUME = 1.0;

/** 语言检测正则 */
const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const JAPANESE_PATTERN = /[\u3040-\u309f\u30a0-\u30ff]/;
const KOREAN_PATTERN = /[\uac00-\ud7af\u1100-\u11ff]/;

/** 内置语音列表 */
const BUILT_IN_VOICES: TTSVoice[] = [
  {
    id: 'vits-zh-female-1',
    name: '小雨（女声）',
    language: 'zh',
    gender: 'female',
    styles: ['neutral', 'happy', 'sad'],
    sampleRate: 22050,
    supportsEmotion: true,
    description: '标准中文女声，清晰自然',
  },
  {
    id: 'vits-zh-male-1',
    name: '小明（男声）',
    language: 'zh',
    gender: 'male',
    styles: ['neutral', 'happy'],
    sampleRate: 22050,
    supportsEmotion: false,
    description: '标准中文男声，沉稳有力',
  },
  {
    id: 'vits-en-female-1',
    name: 'Emma (Female)',
    language: 'en',
    gender: 'female',
    styles: ['neutral', 'happy', 'sad', 'angry'],
    sampleRate: 22050,
    supportsEmotion: true,
    description: 'American English female voice',
  },
  {
    id: 'vits-en-male-1',
    name: 'James (Male)',
    language: 'en',
    gender: 'male',
    styles: ['neutral', 'happy'],
    sampleRate: 22050,
    supportsEmotion: false,
    description: 'American English male voice',
  },
  {
    id: 'vits-ja-female-1',
    name: 'さくら（女性）',
    language: 'ja',
    gender: 'female',
    styles: ['neutral', 'happy', 'sad'],
    sampleRate: 22050,
    supportsEmotion: true,
    description: '標準的な日本語の女性声',
  },
  {
    id: 'vits-ko-female-1',
    name: '지은 (여성)',
    language: 'ko',
    gender: 'female',
    styles: ['neutral', 'happy'],
    sampleRate: 22050,
    supportsEmotion: false,
    description: '표준 한국어 여성 음성',
  },
];

// -- Language Detection --

/**
 * 检测文本语言
 */
export function detectTTSLanguage(text: string): TTSLanguage {
  if (!text || text.trim().length === 0) {
    return 'auto';
  }

  let cjkCount = 0;
  let japaneseCount = 0;
  let koreanCount = 0;
  let latinCount = 0;

  for (const char of text) {
    if (JAPANESE_PATTERN.test(char)) {
      japaneseCount++;
    } else if (KOREAN_PATTERN.test(char)) {
      koreanCount++;
    } else if (CJK_PATTERN.test(char)) {
      cjkCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      latinCount++;
    }
  }

  const total = cjkCount + japaneseCount + koreanCount + latinCount;
  if (total === 0) {
    return 'auto';
  }

  if (japaneseCount / total > 0.1) {
    return 'ja';
  }
  if (koreanCount / total > 0.3) {
    return 'ko';
  }
  if (cjkCount / total > 0.3) {
    return 'zh';
  }
  if (latinCount / total > 0.5) {
    return 'en';
  }

  return 'auto';
}

// -- Voice Management --

/**
 * 获取所有可用语音
 */
export function getAvailableVoices(): TTSVoice[] {
  return [...BUILT_IN_VOICES];
}

/**
 * 按语言筛选语音
 */
export function getVoicesByLanguage(language: TTSLanguage): TTSVoice[] {
  if (language === 'auto') {
    return BUILT_IN_VOICES;
  }
  return BUILT_IN_VOICES.filter(v => v.language === language);
}

/**
 * 按性别筛选语音
 */
export function getVoicesByGender(gender: TTSVoiceGender): TTSVoice[] {
  return BUILT_IN_VOICES.filter(v => v.gender === gender);
}

/**
 * 根据ID获取语音
 */
export function getVoiceById(voiceId: string): TTSVoice | undefined {
  return BUILT_IN_VOICES.find(v => v.id === voiceId);
}

/**
 * 推荐语音
 * 基于文本语言和用户偏好推荐最佳语音
 */
export function recommendVoice(
  text: string,
  preferredGender?: TTSVoiceGender,
): TTSVoice | undefined {
  const language = detectTTSLanguage(text);
  const candidates = language === 'auto'
    ? BUILT_IN_VOICES
    : getVoicesByLanguage(language);

  if (candidates.length === 0) {
    return BUILT_IN_VOICES[0];
  }

  // 按性别偏好筛选
  if (preferredGender) {
    const genderMatch = candidates.filter(v => v.gender === preferredGender);
    if (genderMatch.length > 0) {
      return genderMatch[0];
    }
  }

  return candidates[0];
}

// -- Text Processing (Pure Computation) --

/**
 * 文本预处理
 * 清理文本，移除特殊字符，规范化标点
 */
export function preprocessText(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  let processed = text.trim();

  // 规规范化标点符号
  processed = processed
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/！/g, '!')
    .replace(/？/g, '?')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'");

  // 移除多余空白
  processed = processed.replace(/\s+/g, ' ');

  // 移除控制字符
  // eslint-disable-next-line no-control-regex
  processed = processed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return processed;
}

/**
 * 文本分段
 * 将长文本分割为适合TTS处理的短段
 */
export function segmentText(
  text: string,
  maxLength: number = DEFAULT_SEGMENT_MAX_LENGTH,
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const preprocessed = preprocessText(text);
  if (preprocessed.length <= maxLength) {
    return [preprocessed];
  }

  const segments: string[] = [];
  let remaining = preprocessed;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      segments.push(remaining);
      break;
    }

    // 在maxLength范围内找最佳分割点
    let splitPos = findBestSplitPoint(remaining, maxLength);

    segments.push(remaining.substring(0, splitPos).trim());
    remaining = remaining.substring(splitPos).trim();
  }

  return segments.filter(s => s.length > 0);
}

/**
 * 查找最佳分割点
 * 优先在句号、问号、感叹号处分割，其次在逗号、空格处分割
 */
function findBestSplitPoint(text: string, maxLength: number): number {
  const searchArea = text.substring(0, maxLength);

  // 优先级1：句末标点
  const sentenceEndPattern = /[.!?。！？]\s*/g;
  let bestPos = -1;
  let match: RegExpExecArray | null;

  while ((match = sentenceEndPattern.exec(searchArea)) !== null) {
    bestPos = match.index + match[0].length;
  }

  if (bestPos > maxLength * 0.5) {
    return bestPos;
  }

  // 优先级2：逗号、分号
  const clauseEndPattern = /[,;，；]\s*/g;
  bestPos = -1;

  while ((match = clauseEndPattern.exec(searchArea)) !== null) {
    bestPos = match.index + match[0].length;
  }

  if (bestPos > maxLength * 0.3) {
    return bestPos;
  }

  // 优先级3：空格
  const spacePattern = /\s+/g;
  bestPos = -1;

  while ((match = spacePattern.exec(searchArea)) !== null) {
    bestPos = match.index + match[0].length;
  }

  if (bestPos > 0) {
    return bestPos;
  }

  // 无法找到好的分割点，强制在maxLength处分割
  return maxLength;
}

/**
 * 计算文本统计信息
 */
export function calculateTextStats(text: string): {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  estimatedDurationMs: number;
  language: TTSLanguage;
} {
  if (!text || text.trim().length === 0) {
    return {
      charCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      estimatedDurationMs: 0,
      language: 'auto',
    };
  }

  const language = detectTTSLanguage(text);
  const charCount = text.length;

  // 词数统计（中文按字计数，英文按空格分词）
  let wordCount: number;
  if (language === 'zh' || language === 'ja') {
    // 中日文按字符计数
    wordCount = text.replace(/\s/g, '').length;
  } else {
    // 英文按空格分词
    wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  }

  // 句数统计
  const sentenceCount = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0).length;

  // 估算时长（基于平均语速）
  const charsPerSecond: Record<TTSLanguage, number> = {
    zh: 4,     // 中文约4字/秒
    en: 15,    // 英文约15字符/秒（含空格）
    ja: 5,     // 日文约5字/秒
    ko: 4.5,   // 韩文约4.5字/秒
    auto: 5,   // 自动检测使用中间值
  };

  const estimatedDurationMs = Math.round((charCount / charsPerSecond[language]) * 1000);

  return {
    charCount,
    wordCount,
    sentenceCount,
    estimatedDurationMs,
    language,
  };
}

// -- Speed/Pitch/Volume Adjustment (Pure Computation) --

/**
 * 验证并规范化TTS参数
 */
export function normalizeTTSParams(params: TTSSynthesisParams): TTSSynthesisParams {
  return {
    ...params,
    text: preprocessText(params.text),
    speed: clamp(params.speed ?? DEFAULT_SPEED, MIN_SPEED, MAX_SPEED),
    pitch: clamp(params.pitch ?? DEFAULT_PITCH, MIN_PITCH, MAX_PITCH),
    volume: clamp(params.volume ?? DEFAULT_VOLUME, MIN_VOLUME, MAX_VOLUME),
    styleIntensity: clamp(params.styleIntensity ?? 0.5, 0, 1),
  };
}

/**
 * 根据语速调整时长
 */
export function adjustDurationBySpeed(durationMs: number, speed: number): number {
  const normalizedSpeed = clamp(speed, MIN_SPEED, MAX_SPEED);
  return Math.round(durationMs / normalizedSpeed);
}

/**
 * 根据语速调整时间映射
 */
export function adjustTimingsBySpeed(
  timings: WordTiming[],
  speed: number,
): WordTiming[] {
  const normalizedSpeed = clamp(speed, MIN_SPEED, MAX_SPEED);

  return timings.map(timing => ({
    ...timing,
    startMs: Math.round(timing.startMs / normalizedSpeed),
    endMs: Math.round(timing.endMs / normalizedSpeed),
  }));
}

// -- Timeline Alignment (Pure Computation) --

/**
 * 将TTS结果对齐到时间线
 */
export function alignToTimeline(
  textSegments: string[],
  synthesisResults: TTSSynthesisResult[],
  config: TimelineAlignmentConfig = { mode: 'natural' },
): TimelineAlignmentResult {
  if (textSegments.length === 0 || synthesisResults.length === 0) {
    return {
      segments: [],
      totalDurationMs: 0,
      averageSpeed: 1.0,
    };
  }

  const segments: TimelineAlignmentResult['segments'] = [];
  let currentMs = 0;

  switch (config.mode) {
    case 'natural': {
      // 自然模式：按合成结果的自然时长排列
      for (let i = 0; i < textSegments.length; i++) {
        const result = synthesisResults[i];
        if (!result) continue;

        segments.push({
          text: textSegments[i],
          startMs: currentMs,
          endMs: currentMs + result.durationMs,
          speed: 1.0,
        });
        currentMs += result.durationMs;
      }
      break;
    }

    case 'fixed': {
      // 固定间隔模式
      const gapMs = config.fixedGapMs ?? DEFAULT_SEGMENT_PAUSE_MS;
      for (let i = 0; i < textSegments.length; i++) {
        const result = synthesisResults[i];
        if (!result) continue;

        segments.push({
          text: textSegments[i],
          startMs: currentMs,
          endMs: currentMs + result.durationMs,
          speed: 1.0,
        });
        currentMs += result.durationMs + gapMs;
      }
      break;
    }

    case 'custom': {
      // 自定义时间点模式
      const timings = config.customTimings ?? [];
      for (let i = 0; i < textSegments.length; i++) {
        if (i < timings.length) {
          segments.push({
            text: textSegments[i],
            startMs: timings[i].startMs,
            endMs: timings[i].endMs,
            speed: 1.0,
          });
        }
      }
      break;
    }
  }

  // 如果需要自动调整语速以匹配目标时间范围
  if (config.autoAdjustSpeed && config.targetTimeRangeMs && segments.length > 0) {
    const targetDuration = config.targetTimeRangeMs.end - config.targetTimeRangeMs.start;
    const currentDuration = segments[segments.length - 1].endMs - segments[0].startMs;

    if (currentDuration > 0 && targetDuration > 0) {
      const speedFactor = currentDuration / targetDuration;
      const adjustedSpeed = clamp(speedFactor, MIN_SPEED, MAX_SPEED);

      for (const seg of segments) {
        const segDuration = seg.endMs - seg.startMs;
        seg.endMs = seg.startMs + Math.round(segDuration / adjustedSpeed);
        seg.speed = adjustedSpeed;
      }

      // 重新计算开始时间
      let offset = config.targetTimeRangeMs.start;
      for (const seg of segments) {
        const duration = seg.endMs - seg.startMs;
        seg.startMs = offset;
        seg.endMs = offset + duration;
        offset = seg.endMs;
      }
    }
  }

  const totalDurationMs = segments.length > 0
    ? segments[segments.length - 1].endMs - segments[0].startMs
    : 0;

  const averageSpeed = segments.length > 0
    ? segments.reduce((sum, s) => sum + s.speed, 0) / segments.length
    : 1.0;

  return {
    segments,
    totalDurationMs,
    averageSpeed,
  };
}

/**
 * 合并多个TTS结果为连续音频
 */
export function mergeSynthesisResults(
  results: TTSSynthesisResult[],
  pauseMs: number = DEFAULT_SEGMENT_PAUSE_MS,
): {
  audioData: Float32Array;
  sampleRate: number;
  totalDurationMs: number;
  wordTimings: WordTiming[];
} {
  if (results.length === 0) {
    return {
      audioData: new Float32Array(0),
      sampleRate: 22050,
      totalDurationMs: 0,
      wordTimings: [],
    };
  }

  const sampleRate = results[0].sampleRate;
  const pauseSamples = Math.round((pauseMs / 1000) * sampleRate);

  // 计算总长度
  let totalSamples = 0;
  for (const result of results) {
    if (result.audioData instanceof Float32Array) {
      totalSamples += result.audioData.length;
    }
    totalSamples += pauseSamples;
  }

  // 合并音频
  const mergedAudio = new Float32Array(totalSamples);
  let offset = 0;
  let timeOffsetMs = 0;
  const mergedTimings: WordTiming[] = [];

  for (const result of results) {
    if (result.audioData instanceof Float32Array) {
      mergedAudio.set(result.audioData, offset);
      offset += result.audioData.length;

      // 调整词时间映射
      if (result.wordTimings) {
        for (const timing of result.wordTimings) {
          mergedTimings.push({
            ...timing,
            startMs: timing.startMs + timeOffsetMs,
            endMs: timing.endMs + timeOffsetMs,
          });
        }
      }

      timeOffsetMs += result.durationMs;
    }

    // 添加间隔
    offset += pauseSamples;
    timeOffsetMs += pauseMs;
  }

  return {
    audioData: mergedAudio,
    sampleRate,
    totalDurationMs: timeOffsetMs,
    wordTimings: mergedTimings,
  };
}

// -- Audio Processing (Pure Computation) --

/**
 * 应用音量调整
 */
export function applyVolume(audioData: Float32Array, volume: number): Float32Array {
  const normalizedVolume = clamp(volume, MIN_VOLUME, MAX_VOLUME);
  const result = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
    result[i] = clamp(audioData[i] * normalizedVolume, -1, 1);
  }

  return result;
}

/**
 * 应用淡入淡出
 */
export function applyFadeInOut(
  audioData: Float32Array,
  sampleRate: number,
  fadeInMs: number = 10,
  fadeOutMs: number = 10,
): Float32Array {
  const result = new Float32Array(audioData);
  const fadeInSamples = Math.round((fadeInMs / 1000) * sampleRate);
  const fadeOutSamples = Math.round((fadeOutMs / 1000) * sampleRate);

  // 淡入
  for (let i = 0; i < Math.min(fadeInSamples, result.length); i++) {
    result[i] *= i / fadeInSamples;
  }

  // 淡出
  for (let i = 0; i < Math.min(fadeOutSamples, result.length); i++) {
    const idx = result.length - 1 - i;
    result[idx] *= i / fadeOutSamples;
  }

  return result;
}

/**
 * 生成静音
 */
export function generateSilence(sampleRate: number, durationMs: number): Float32Array {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  return new Float32Array(samples);
}

/**
 * PCM转WAV
 */
export function pcmToWav(pcmData: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data
  let offset = headerSize;
  for (let i = 0; i < pcmData.length; i++) {
    const sample = clamp(pcmData[i], -1, 1);
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

// -- Validation --

/** TTS验证问题 */
export interface TTSValidationIssue {
  type: 'text-too-long' | 'invalid-params' | 'unsupported-language' | 'voice-not-found' | 'empty-text';
  message: string;
}

/**
 * 验证TTS合成参数
 */
export function validateTTSParams(
  params: TTSSynthesisParams,
  config: TTSConfig = {},
): TTSValidationIssue[] {
  const issues: TTSValidationIssue[] = [];
  const maxLength = config.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  // 空文本
  if (!params.text || params.text.trim().length === 0) {
    issues.push({
      type: 'empty-text',
      message: '文本内容为空',
    });
  }

  // 文本过长
  if (params.text && params.text.length > maxLength) {
    issues.push({
      type: 'text-too-long',
      message: `文本长度 ${params.text.length} 超过最大限制 ${maxLength}`,
    });
  }

  // 参数范围检查
  if (params.speed !== undefined && (params.speed < MIN_SPEED || params.speed > MAX_SPEED)) {
    issues.push({
      type: 'invalid-params',
      message: `语速 ${params.speed} 超出范围 [${MIN_SPEED}, ${MAX_SPEED}]`,
    });
  }

  if (params.pitch !== undefined && (params.pitch < MIN_PITCH || params.pitch > MAX_PITCH)) {
    issues.push({
      type: 'invalid-params',
      message: `音调 ${params.pitch} 超出范围 [${MIN_PITCH}, ${MAX_PITCH}]`,
    });
  }

  if (params.volume !== undefined && (params.volume < MIN_VOLUME || params.volume > MAX_VOLUME)) {
    issues.push({
      type: 'invalid-params',
      message: `音量 ${params.volume} 超出范围 [${MIN_VOLUME}, ${MAX_VOLUME}]`,
    });
  }

  // 语音存在性检查
  if (params.voiceId && !getVoiceById(params.voiceId)) {
    issues.push({
      type: 'voice-not-found',
      message: `未找到语音: ${params.voiceId}`,
    });
  }

  return issues;
}

// -- Helpers --

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
