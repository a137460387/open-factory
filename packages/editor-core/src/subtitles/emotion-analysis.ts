import type { SubtitleClip, SubtitleStyle } from '../model-types';
import type { TimelineHeatmapSegment } from '../timeline-heatmap';
import { round } from '../time';

export type SubtitleEmotionType = 'anger' | 'joy' | 'sadness' | 'surprise' | 'neutral';

export interface SubtitleEmotionScore {
  clipId: string;
  emotion: SubtitleEmotionType;
  confidence: number;
  scores: Record<SubtitleEmotionType, number>;
}

export interface EmotionColorSuggestion {
  emotion: SubtitleEmotionType;
  color: string;
  outlineColor: string;
  label: string;
}

export interface EmotionStyledSubtitle {
  clipId: string;
  partialStyle: Partial<SubtitleStyle>;
}

/** Keyword dictionaries per emotion (Chinese + common punctuation signals). */
const EMOTION_KEYWORDS: Record<SubtitleEmotionType, string[]> = {
  anger: [
    '愤怒',
    '气死',
    '混蛋',
    '可恶',
    '滚',
    '去死',
    '该死',
    '讨厌',
    '恨',
    '怒',
    '暴怒',
    '狂怒',
    '火大',
    '受不了',
    '忍无可忍',
  ],
  joy: [
    '太棒了',
    '开心',
    '高兴',
    '快乐',
    '幸福',
    '哈哈',
    '嘻嘻',
    '耶',
    '好极了',
    '棒',
    '笑',
    '乐',
    '赞',
    '美好',
    '甜蜜',
    '欢笑',
  ],
  sadness: [
    '伤心',
    '难过',
    '悲伤',
    '痛苦',
    '哭',
    '泪',
    '寂寞',
    '孤独',
    '心碎',
    '离别',
    '思念',
    '遗憾',
    '绝望',
    '哀',
    '凄',
    '惆怅',
  ],
  surprise: [
    '天哪',
    '哇',
    '啊',
    '不会吧',
    '竟然',
    '居然',
    '没想到',
    '意外',
    '震惊',
    '吃惊',
    '不可思议',
    '难以置信',
    '吓',
    '惊',
  ],
  neutral: [],
};

/** Weight assigned to each punctuation signal. */
const EXCLAMATION_BONUS = 0.15;
const QUESTION_BONUS = 0.05;

/** Compute raw emotion scores from text using keyword frequency and punctuation. */
export function scoreEmotionFromText(text: string): Record<SubtitleEmotionType, number> {
  const normalized = text.toLowerCase();
  const scores: Record<SubtitleEmotionType, number> = {
    anger: 0,
    joy: 0,
    sadness: 0,
    surprise: 0,
    neutral: 0,
  };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as Array<[SubtitleEmotionType, string[]]>) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        scores[emotion] += 1;
      }
    }
  }

  // Punctuation density bonus
  const exclamationCount = (text.match(/！|!/g) || []).length;
  const questionCount = (text.match(/？|\?/g) || []).length;

  if (exclamationCount > 0) {
    scores.anger += EXCLAMATION_BONUS * exclamationCount;
    scores.joy += EXCLAMATION_BONUS * exclamationCount * 0.5;
    scores.surprise += EXCLAMATION_BONUS * exclamationCount * 0.5;
  }
  if (questionCount > 0) {
    scores.surprise += QUESTION_BONUS * questionCount;
  }

  // If no emotion keywords detected, boost neutral
  const total = scores.anger + scores.joy + scores.sadness + scores.surprise;
  if (total === 0) {
    scores.neutral = 1;
  }

  return scores;
}

/** Analyze a single subtitle clip and return the dominant emotion with confidence. */
export function analyzeSubtitleEmotion(clip: SubtitleClip): SubtitleEmotionScore {
  const scores = scoreEmotionFromText(clip.text);
  const entries = Object.entries(scores) as Array<[SubtitleEmotionType, number]>;
  const maxScore = Math.max(...entries.map(([, v]) => v));
  const dominant = entries.find(([, v]) => v === maxScore)?.[0] ?? 'neutral';
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const confidence = total > 0 ? round(maxScore / total) : 0;
  return { clipId: clip.id, emotion: dominant, confidence, scores };
}

/** Batch-analyze subtitle clips. */
export function analyzeSubtitleClipEmotions(clips: SubtitleClip[]): SubtitleEmotionScore[] {
  return clips.map((clip) => analyzeSubtitleEmotion(clip));
}

/** Map emotion to suggested visual style. */
export const EMOTION_COLOR_MAP: Record<SubtitleEmotionType, EmotionColorSuggestion> = {
  anger: { emotion: 'anger', color: '#ff3333', outlineColor: '#cc0000', label: '愤怒 - 红色描边' },
  joy: { emotion: 'joy', color: '#ffe066', outlineColor: '#f5c518', label: '喜悦 - 黄色高亮' },
  sadness: { emotion: 'sadness', color: '#8899aa', outlineColor: '#667788', label: '悲伤 - 蓝灰色调' },
  surprise: { emotion: 'surprise', color: '#ff9933', outlineColor: '#cc7700', label: '惊讶 - 橙色强调' },
  neutral: { emotion: 'neutral', color: '#ffffff', outlineColor: '#000000', label: '中性 - 默认白字' },
};

/** Suggest color for an emotion score result. */
export function suggestEmotionColor(score: SubtitleEmotionScore): EmotionColorSuggestion {
  return EMOTION_COLOR_MAP[score.emotion];
}

/** Build partial style overrides for a given emotion. */
export function buildEmotionStyleOverrides(emotion: SubtitleEmotionType): Partial<SubtitleStyle> {
  const suggestion = EMOTION_COLOR_MAP[emotion];
  return {
    color: suggestion.color,
    outlineColor: suggestion.outlineColor,
    outlineWidth: emotion === 'neutral' ? 1 : 2,
  };
}

/** Batch-apply emotion styles: returns a mapping of clipId → partial style. */
export function batchApplyEmotionStyles(
  scores: SubtitleEmotionScore[],
  filterEmotion?: SubtitleEmotionType,
): EmotionStyledSubtitle[] {
  return scores
    .filter((s) => (filterEmotion ? s.emotion === filterEmotion : true))
    .map((s) => ({
      clipId: s.clipId,
      partialStyle: buildEmotionStyleOverrides(s.emotion),
    }));
}

export interface EmotionHeatmapOptions {
  bucketSeconds?: number;
  duration?: number;
}

const DEFAULT_HEATMAP_BUCKET = 1;

/** Compute an emotion-intensity heatmap over the timeline, reusing the heatmap segment structure. */
export function calculateEmotionHeatmap(
  clips: SubtitleClip[],
  scores: SubtitleEmotionScore[],
  options: EmotionHeatmapOptions = {},
): TimelineHeatmapSegment[] {
  if (clips.length === 0) return [];
  const scoreMap = new Map(scores.map((s) => [s.clipId, s]));
  const bucketSec = options.bucketSeconds ?? DEFAULT_HEATMAP_BUCKET;
  const maxEnd = options.duration ?? Math.max(...clips.map((c) => c.start + c.duration));
  const bucketCount = Math.max(1, Math.ceil(maxEnd / bucketSec));
  const buckets: Array<{ start: number; end: number; total: number; count: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ start: i * bucketSec, end: (i + 1) * bucketSec, total: 0, count: 0 });
  }

  for (const clip of clips) {
    const score = scoreMap.get(clip.id);
    if (!score) continue;
    // Emotion intensity = 1 - neutral ratio
    const nonNeutral =
      1 -
      score.scores.neutral /
        Math.max(
          1,
          Object.values(score.scores).reduce((a, b) => a + b, 0),
        );
    const intensity = round(nonNeutral);
    const startBucket = Math.floor(clip.start / bucketSec);
    const endBucket = Math.floor((clip.start + clip.duration) / bucketSec);
    for (let i = startBucket; i <= endBucket && i < buckets.length; i++) {
      buckets[i].total += intensity;
      buckets[i].count += 1;
    }
  }

  const maxVal = Math.max(1, ...buckets.map((b) => (b.count > 0 ? b.total / b.count : 0)));
  return buckets.map((b) => ({
    start: b.start,
    end: b.end,
    value: b.count > 0 ? round(b.total / b.count) : 0,
    normalized: b.count > 0 ? round(b.total / b.count / maxVal) : 0,
  }));
}

export const EMOTION_ACCURACY_DISCLAIMER = '基于关键词的启发式分析，仅供参考';
