// -- Types --
import { parseSrt } from '../subtitles/srt';
import type { SubtitleClip, SubtitleStyle, SubtitleMode, SubtitleTrackType } from '../model-types';
import {
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_TRANSFORM,
  DEFAULT_COLOR_CORRECTION,
} from '../model/defaults';

/** 支持的转录语言 */
export type TranscriptionLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'auto';

/** 转录片段 */
export interface TranscriptionSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  speaker?: string;
  speakerId?: number;
}

/** 转录结果 */
export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: TranscriptionLanguage;
  durationMs: number;
  modelLoadedMs?: number;
}

/** 转录配置 */
export interface TranscriptionConfig {
  language?: TranscriptionLanguage;
  minSegmentDurationMs?: number;
  maxSegmentDurationMs?: number;
  mergeGapMs?: number;
  maxCharsPerSegment?: number;
  style?: SubtitleStyle;
  subtitleMode?: SubtitleMode;
  subtitleType?: SubtitleTrackType;
}

/** 转录进度事件 */
export interface TranscriptionProgressEvent {
  phase: 'loading-model' | 'decoding' | 'post-processing';
  progress: number;
  estimatedMs?: number;
}

/** 转录验证问题 */
export interface TranscriptionValidationIssue {
  index: number;
  type: 'too-short' | 'too-long' | 'overlap' | 'empty-text' | 'invalid-time';
  message: string;
}

// -- Constants --
const EPSILON = 0.000001;
const DEFAULT_MIN_SEGMENT_DURATION_MS = 500;
const DEFAULT_MAX_SEGMENT_DURATION_MS = 10000;
const DEFAULT_MERGE_GAP_MS = 300;
const DEFAULT_MAX_CHARS_PER_SEGMENT = 80;

// -- Language Detection --

/** 中文字符正则 */
const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf]/;
/** 日文假名正则 */
const JAPANESE_PATTERN = /[\u3040-\u309f\u30a0-\u30ff]/;
/** 韩文正则 */
const KOREAN_PATTERN = /[\uac00-\ud7af\u1100-\u11ff]/;

/**
 * 从文本内容检测语言
 * 基于 Unicode 字符范围的简单启发式检测
 */
export function detectLanguageFromText(text: string): TranscriptionLanguage {
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

  // 日文假名占比超过 10% 判定为日文
  if (japaneseCount / total > 0.1) {
    return 'ja';
  }
  // 韩文占比超过 30% 判定为韩文
  if (koreanCount / total > 0.3) {
    return 'ko';
  }
  // 中文字符占比超过 30% 判定为中文
  if (cjkCount / total > 0.3) {
    return 'zh';
  }
  // 拉丁字符为主判定为英文
  if (latinCount / total > 0.5) {
    return 'en';
  }

  return 'auto';
}

// -- SRT Parsing --

/**
 * 将 Whisper 输出的 SRT 内容解析为转录片段
 * 复用现有 parseSrt 解析器
 */
export function parseWhisperSrt(srtContent: string): TranscriptionSegment[] {
  if (!srtContent || srtContent.trim().length === 0) {
    return [];
  }

  const cues = parseSrt(srtContent);
  return cues.map((cue) => ({
    startMs: cue.startMs,
    endMs: cue.endMs,
    text: cue.text.trim(),
    speaker: cue.speaker,
  }));
}

/**
 * 将原始时间戳片段转换为 TranscriptionSegment
 * 接受毫秒级时间戳
 */
export function createSegmentsFromTimestamps(
  timestamps: Array<{ startMs: number; endMs: number; text: string }>,
): TranscriptionSegment[] {
  return timestamps
    .filter((ts) => ts.text.trim().length > 0)
    .map((ts) => ({
      startMs: Math.max(0, Math.round(ts.startMs)),
      endMs: Math.max(0, Math.round(ts.endMs)),
      text: ts.text.trim(),
    }))
    .sort((a, b) => a.startMs - b.startMs);
}

// -- Segment Processing --

/**
 * 合并间隔过短的相邻片段
 * 当两个片段之间的间隔小于 mergeGapMs 且合并后不超过 maxChars 时合并
 */
export function mergeShortSegments(
  segments: TranscriptionSegment[],
  minDurationMs: number = DEFAULT_MIN_SEGMENT_DURATION_MS,
  mergeGapMs: number = DEFAULT_MERGE_GAP_MS,
  maxChars: number = DEFAULT_MAX_CHARS_PER_SEGMENT,
): TranscriptionSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const result: TranscriptionSegment[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const gapMs = next.startMs - current.endMs;
    const currentDuration = current.endMs - current.startMs;
    const mergedText = `${current.text} ${next.text}`;

    // 合并条件：当前片段太短 或 间隔太小且合并后文本不超长
    if (
      (currentDuration < minDurationMs && gapMs < mergeGapMs * 3) ||
      (gapMs < mergeGapMs && mergedText.length <= maxChars)
    ) {
      current = {
        startMs: current.startMs,
        endMs: Math.max(current.endMs, next.endMs),
        text: mergedText,
        confidence:
          current.confidence != null && next.confidence != null
            ? Math.min(current.confidence, next.confidence)
            : (current.confidence ?? next.confidence),
        speaker: current.speaker ?? next.speaker,
        speakerId: current.speakerId ?? next.speakerId,
      };
    } else {
      result.push(current);
      current = { ...next };
    }
  }

  result.push(current);
  return result;
}

/**
 * 拆分过长的片段
 * 按句号、问号、感叹号等标点拆分，保持语义完整
 */
export function splitLongSegments(
  segments: TranscriptionSegment[],
  maxDurationMs: number = DEFAULT_MAX_SEGMENT_DURATION_MS,
  maxChars: number = DEFAULT_MAX_CHARS_PER_SEGMENT,
): TranscriptionSegment[] {
  const result: TranscriptionSegment[] = [];

  for (const segment of segments) {
    const duration = segment.endMs - segment.startMs;
    const needsSplit = duration > maxDurationMs || segment.text.length > maxChars;

    if (!needsSplit) {
      result.push(segment);
      continue;
    }

    const subSegments = splitSegmentText(segment, maxChars);
    const totalChars = subSegments.reduce((sum, s) => sum + s.text.length, 0);

    let currentMs = segment.startMs;
    for (const sub of subSegments) {
      const ratio = totalChars > 0 ? sub.text.length / totalChars : 1 / subSegments.length;
      const subDuration = Math.round(duration * ratio);
      result.push({
        startMs: currentMs,
        endMs: currentMs + subDuration,
        text: sub.text,
        confidence: segment.confidence,
        speaker: segment.speaker,
        speakerId: segment.speakerId,
      });
      currentMs += subDuration;
    }
  }

  return result;
}

/**
 * 时间戳偏移对齐
 * 将所有片段的时间戳整体偏移指定毫秒数
 */
export function alignTimestamps(segments: TranscriptionSegment[], offsetMs: number): TranscriptionSegment[] {
  if (Math.abs(offsetMs) < EPSILON) {
    return segments;
  }

  return segments.map((seg) => ({
    ...seg,
    startMs: Math.max(0, Math.round(seg.startMs + offsetMs)),
    endMs: Math.max(0, Math.round(seg.endMs + offsetMs)),
  }));
}

/**
 * 估算文本阅读时间（毫秒）
 * 基于语言类型的平均阅读速度
 */
export function estimateReadingTimeMs(text: string, language: TranscriptionLanguage = 'auto'): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const cleanText = text.trim();
  const detectedLang = language === 'auto' ? detectLanguageFromText(cleanText) : language;

  // 每字符毫秒数（基于平均阅读速度）
  const msPerChar: Record<TranscriptionLanguage, number> = {
    zh: 200, // 中文约 300 字/分钟
    en: 80, // 英文约 750 词/分钟，平均 5 字符/词
    ja: 180, // 日文约 330 字/分钟
    ko: 190, // 韩文约 315 字/分钟
    auto: 150, // 自动检测使用中间值
  };

  const charCount = cleanText.length;
  return Math.round(charCount * msPerChar[detectedLang]);
}

// -- SubtitleClip Conversion --

/**
 * 将转录片段转换为 SubtitleClip 对象
 * 用于插入时间线
 */
export function segmentsToSubtitleClips(
  segments: TranscriptionSegment[],
  trackId: string,
  config: TranscriptionConfig = {},
): SubtitleClip[] {
  const style = config.style ?? DEFAULT_SUBTITLE_STYLE;
  const subtitleMode = config.subtitleMode ?? DEFAULT_SUBTITLE_MODE;
  const subtitleType = config.subtitleType ?? 'subtitle';

  return segments.map((seg, index) => ({
    id: `ai-sub-${Date.now()}-${index}`,
    name: `AI-${index + 1}`,
    trackId,
    start: msToSeconds(seg.startMs),
    duration: msToSeconds(seg.endMs - seg.startMs),
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    type: 'subtitle' as const,
    subtitleType,
    text: seg.text,
    speaker: seg.speaker,
    speakerId: seg.speakerId,
    style,
    subtitleMode,
    transform: { ...DEFAULT_TRANSFORM },
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
  }));
}

// -- Validation --

/**
 * 验证转录结果的质量
 * 返回问题列表，空数组表示结果有效
 */
export function validateTranscriptionResult(
  segments: TranscriptionSegment[],
  minDurationMs: number = DEFAULT_MIN_SEGMENT_DURATION_MS,
): TranscriptionValidationIssue[] {
  const issues: TranscriptionValidationIssue[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // 空文本
    if (!seg.text || seg.text.trim().length === 0) {
      issues.push({
        index: i,
        type: 'empty-text',
        message: `片段 ${i + 1} 文本为空`,
      });
    }

    // 无效时间
    if (seg.startMs < 0 || seg.endMs < 0) {
      issues.push({
        index: i,
        type: 'invalid-time',
        message: `片段 ${i + 1} 时间戳为负数`,
      });
    }

    if (seg.endMs <= seg.startMs) {
      issues.push({
        index: i,
        type: 'invalid-time',
        message: `片段 ${i + 1} 结束时间不大于开始时间`,
      });
    }

    // 时长过短
    const duration = seg.endMs - seg.startMs;
    if (duration > 0 && duration < minDurationMs) {
      issues.push({
        index: i,
        type: 'too-short',
        message: `片段 ${i + 1} 时长 ${duration}ms 小于最小阈值 ${minDurationMs}ms`,
      });
    }

    // 时长过长
    if (duration > DEFAULT_MAX_SEGMENT_DURATION_MS) {
      issues.push({
        index: i,
        type: 'too-long',
        message: `片段 ${i + 1} 时长 ${duration}ms 超过最大阈值 ${DEFAULT_MAX_SEGMENT_DURATION_MS}ms`,
      });
    }

    // 与前一片段重叠
    if (i > 0 && seg.startMs < segments[i - 1].endMs - EPSILON) {
      issues.push({
        index: i,
        type: 'overlap',
        message: `片段 ${i + 1} 与片段 ${i} 存在时间重叠`,
      });
    }
  }

  return issues;
}

// -- Full Pipeline --

/**
 * 完整的转录后处理流水线
 * 解析 → 合并短片段 → 拆分长片段 → 验证
 */
export function processWhisperOutput(
  srtContent: string,
  config: TranscriptionConfig = {},
): { segments: TranscriptionSegment[]; issues: TranscriptionValidationIssue[]; language: TranscriptionLanguage } {
  const rawSegments = parseWhisperSrt(srtContent);

  // 检测语言
  const fullText = rawSegments.map((s) => s.text).join(' ');
  const detectedLanguage = config.language ?? detectLanguageFromText(fullText);

  // 后处理流水线
  const minDuration = config.minSegmentDurationMs ?? DEFAULT_MIN_SEGMENT_DURATION_MS;
  const mergeGap = config.mergeGapMs ?? DEFAULT_MERGE_GAP_MS;
  const maxChars = config.maxCharsPerSegment ?? DEFAULT_MAX_CHARS_PER_SEGMENT;
  const maxDuration = config.maxSegmentDurationMs ?? DEFAULT_MAX_SEGMENT_DURATION_MS;

  let processed = mergeShortSegments(rawSegments, minDuration, mergeGap, maxChars);
  processed = splitLongSegments(processed, maxDuration, maxChars);

  // 验证
  const issues = validateTranscriptionResult(processed, minDuration);

  return {
    segments: processed,
    issues,
    language: detectedLanguage,
  };
}

// -- Helpers --

/** 毫秒转秒（保留 3 位小数） */
function msToSeconds(ms: number): number {
  return Math.round(ms) / 1000;
}

/**
 * 按标点符号拆分文本为子片段
 * 优先在句号、问号、感叹号处拆分，其次在逗号、分号处拆分
 */
function splitSegmentText(segment: TranscriptionSegment, maxChars: number): Array<{ text: string }> {
  const text = segment.text;
  if (text.length <= maxChars) {
    return [{ text }];
  }

  // 按优先级拆分
  const splitPatterns = [
    /([。！？!?]+)/g, // 句末标点
    /([，；,;]+)/g, // 句中标点
    /(\s+)/g, // 空白
  ];

  for (const pattern of splitPatterns) {
    const parts = splitByPattern(text, pattern, maxChars);
    if (parts.length > 1) {
      return parts;
    }
  }

  // 无法按标点拆分，强制按字符数拆分
  return forceSplit(text, maxChars);
}

/** 按正则模式拆分文本 */
function splitByPattern(text: string, pattern: RegExp, maxChars: number): Array<{ text: string }> {
  const parts: Array<{ text: string }> = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let bestSplit = -1;
    let bestLength = 0;

    // 在 maxChars 范围内找最后一个匹配的拆分点
    const searchArea = remaining.substring(0, maxChars);
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, 'g');

    while ((match = regex.exec(searchArea)) !== null) {
      const splitPos = match.index + match[0].length;
      if (splitPos > bestLength) {
        bestSplit = match.index;
        bestLength = splitPos;
      }
    }

    if (bestSplit <= 0) {
      break;
    }

    parts.push({ text: remaining.substring(0, bestSplit + 1).trim() });
    remaining = remaining.substring(bestSplit + 1).trim();
  }

  if (remaining.length > 0) {
    parts.push({ text: remaining });
  }

  return parts;
}

/** 强制按字符数拆分 */
function forceSplit(text: string, maxChars: number): Array<{ text: string }> {
  const parts: Array<{ text: string }> = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    parts.push({ text: remaining.substring(0, maxChars) });
    remaining = remaining.substring(maxChars);
  }

  if (remaining.length > 0) {
    parts.push({ text: remaining });
  }

  return parts;
}
