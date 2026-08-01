/**
 * AI content generation - subtitle generation
 */

import {clamp} from '../utils/math';
import {
  amplitudeToDb,
  DEFAULT_SILENCE_THRESHOLD_DB,
  DEFAULT_MIN_SILENCE_DURATION_MS,
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_MAX_LINES,
  DEFAULT_FONT_SIZE,
  generateId,
  type GeneratedContent,
  type SubtitleGenerationConfig,
} from './content-generation-types';

// ==================== Audio Helpers ====================

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

// ==================== Subtitle Generation ====================

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
