import { round } from './time';

export type ReadingSpeedSeverity = 'ok' | 'warning' | 'critical';

export interface ReadingSpeedWarning {
  charsPerSecond: number;
  recommendedMax: number;
  severity: ReadingSpeedSeverity;
}

export interface SubtitleSplitResult {
  textA: string;
  textB: string;
  splitTime: number;
}

/** 各语言推荐阅读速度上限（字符/秒） */
export const READING_SPEED_LIMITS: Record<string, number> = {
  zh: 6,
  en: 20,
  ja: 5,
  ko: 5.5,
};

export const WARNING_THRESHOLD_RATIO = 1.0;
export const CRITICAL_THRESHOLD_RATIO = 1.2; // 120%

/**
 * 计算字符数：中文按字数，英文按单词数
 */
export function countCharacters(text: string, language: string): number {
  if (!text) return 0;

  // CJK语言：直接按字符数
  if (['zh', 'ja', 'ko'].includes(language)) {
    // 过滤空白和标点，计算有效字符
    return text.replace(/[\s\p{P}]/gu, '').length;
  }

  // 英文等拉丁语系：按单词数
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * 获取语言推荐速度上限
 */
export function getRecommendedMax(language: string): number {
  return READING_SPEED_LIMITS[language] ?? READING_SPEED_LIMITS.en;
}

/**
 * 计算阅读速度警告
 */
export function calculateReadingSpeed(
  text: string,
  startTime: number,
  endTime: number,
  language: string = 'zh'
): ReadingSpeedWarning | null {
  const duration = endTime - startTime;
  if (duration <= 0 || !text) return null;

  const chars = countCharacters(text, language);
  const cps = chars / duration;
  const maxCps = getRecommendedMax(language);

  let severity: ReadingSpeedSeverity = 'ok';
  if (cps > maxCps * CRITICAL_THRESHOLD_RATIO) {
    severity = 'critical';
  } else if (cps > maxCps * WARNING_THRESHOLD_RATIO) {
    severity = 'warning';
  }

  if (severity === 'ok') return null;

  return {
    charsPerSecond: round(cps, 2),
    recommendedMax: maxCps,
    severity,
  };
}

/**
 * 检测连续字幕是否共享前缀（断句不当）
 */
export function detectSharedPrefix(
  textA: string,
  textB: string,
  minPrefixLength: number = 3
): boolean {
  if (!textA || !textB) return false;
  const prefixLen = Math.min(textA.length, textB.length, minPrefixLength);
  for (let i = 0; i < prefixLen; i++) {
    if (textA[i] !== textB[i]) return false;
  }
  return true;
}

/**
 * 自动拆分字幕文本
 * 按标点或中点粗略二分
 */
export function autoSplitSubtitle(
  text: string,
  startTime: number,
  endTime: number
): SubtitleSplitResult {
  const duration = endTime - startTime;

  // 尝试在标点符号处分割
  const punctuationRegex = /[，。！？、；：,.!?;:]/;
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < text.length; i++) {
    if (punctuationRegex.test(text[i])) {
      const dist = Math.abs(i - text.length / 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  let splitIdx: number;
  if (bestIdx >= 0) {
    splitIdx = bestIdx + 1;
  } else {
    // 没有标点，按中点分割
    splitIdx = Math.ceil(text.length / 2);
  }

  const textA = text.slice(0, splitIdx).trim();
  const textB = text.slice(splitIdx).trim();
  const ratio = textA.length / text.length;
  const splitTime = round(startTime + duration * ratio, 3);

  return { textA, textB, splitTime };
}

/**
 * 计算延长至安全时长后的结束时间
 */
export function calculateSafeDuration(
  text: string,
  startTime: number,
  language: string = 'zh'
): number {
  const chars = countCharacters(text, language);
  const maxCps = getRecommendedMax(language);
  const safeDuration = chars / maxCps;
  return round(startTime + safeDuration, 3);
}

/**
 * 检查延长后是否与下一字幕重叠
 */
export function wouldOverlapNextSegment(
  newEndTime: number,
  nextStartTime: number,
  tolerance: number = 0.01
): boolean {
  return newEndTime > nextStartTime + tolerance;
}
