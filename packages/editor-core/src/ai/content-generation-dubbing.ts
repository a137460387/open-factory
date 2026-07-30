/**
 * AI content generation - dubbing generation
 */

import {clamp} from '../utils/math';
import {
  generateId,
  type GeneratedContent,
  type DubbingConfig,
} from './content-generation-types';

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
