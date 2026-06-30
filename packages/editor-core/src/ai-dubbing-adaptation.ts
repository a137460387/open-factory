/**
 * AI配音时长适配建议（纯本地算法，不发AI）
 *
 * 对每个 TTS 配音 segment 计算 durationDelta，
 * 当差值超过原始时长的 15% 时自动生成适配建议。
 */

import type { TtsSegment, TimingAdaptation, DubbingAdaptationType, Project } from './model-types';

/** 超过此比例视为需要适配 */
export const DURATION_DELTA_THRESHOLD = 0.15;

/** atempo 最小值（FFmpeg 限制） */
export const ATEMPO_MIN = 0.75;

/** atempo 最大值 */
export const ATEMPO_MAX = 1.0;

/**
 * 计算单个 TTS segment 的时长适配建议
 */
export function computeTimingAdaptation(
  originalDuration: number,
  dubbedDuration: number,
  nextSegmentStart?: number,
): TimingAdaptation {
  const durationDelta = dubbedDuration - originalDuration;

  if (originalDuration <= 0) {
    return { durationDelta, adaptationType: 'none', atempoRatio: null, suggestedOutPoint: null };
  }

  const ratio = Math.abs(durationDelta) / originalDuration;

  if (ratio <= DURATION_DELTA_THRESHOLD) {
    return { durationDelta, adaptationType: 'none', atempoRatio: null, suggestedOutPoint: null };
  }

  if (durationDelta > 0) {
    // 配音比原始字幕长 → 建议压缩或延长
    const rawAtempo = originalDuration / dubbedDuration;
    const clampedAtempo = Math.max(ATEMPO_MIN, Math.min(ATEMPO_MAX, rawAtempo));

    if (clampedAtempo > ATEMPO_MIN || rawAtempo >= ATEMPO_MIN) {
      // atempo 在可接受范围内，建议压缩
      return {
        durationDelta,
        adaptationType: 'compress',
        atempoRatio: clampedAtempo,
        suggestedOutPoint: null,
      };
    }

    // atempo 太极端，建议延长 outpoint（如果无冲突）
    const suggestedOut = originalDuration + durationDelta;
    if (nextSegmentStart === undefined || suggestedOut <= nextSegmentStart) {
      return {
        durationDelta,
        adaptationType: 'compress',
        atempoRatio: clampedAtempo,
        suggestedOutPoint: suggestedOut,
      };
    }

    // 有冲突，还是用 atempo
    return {
      durationDelta,
      adaptationType: 'compress',
      atempoRatio: clampedAtempo,
      suggestedOutPoint: null,
    };
  } else {
    // 配音比原始字幕短 → 建议 padding 或缩短
    return {
      durationDelta,
      adaptationType: 'pad',
      atempoRatio: null,
      suggestedOutPoint: null,
    };
  }
}

/**
 * 检查 outpoint 是否与下一 segment 冲突
 */
export function hasOutpointConflict(
  suggestedOutPoint: number,
  nextSegmentStart: number,
): boolean {
  return suggestedOutPoint > nextSegmentStart;
}

/**
 * 对项目中所有 TTS segments 批量生成适配建议
 * 返回更新后的 segments 数组（不修改原数组）
 */
export function batchComputeAdaptations(
  segments: TtsSegment[],
): TtsSegment[] {
  return segments.map((seg, index) => {
    const nextSeg = segments[index + 1];
    const adaptation = computeTimingAdaptation(
      seg.originalDuration,
      seg.dubbedDuration,
      nextSeg?.originalDuration !== undefined
        ? nextSeg.originalDuration + (nextSeg.dubbedDuration - nextSeg.originalDuration > 0 ? 0 : 0)
        : undefined,
    );
    return { ...seg, timingAdaptation: adaptation };
  });
}

/**
 * 获取项目中有配音时长问题的 TTS segments
 */
export function getSegmentsNeedingAdaptation(project: Project): TtsSegment[] {
  return (project.ttsSegments ?? []).filter(
    (seg) => seg.timingAdaptation?.adaptationType !== 'none' && seg.timingAdaptation?.adaptationType !== undefined,
  );
}
