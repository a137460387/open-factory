import type { Clip, Timeline, Track } from './model-types';
import { round } from './time';

const EPSILON = 0.000001;

/** 单条轨道上的间隙区间 */
export interface TrackGap {
  trackId: string;
  start: number;
  end: number;
  duration: number;
}

/** 全局间隙统计信息 */
export interface GapStats {
  totalCount: number;
  totalDuration: number;
  maxGap: TrackGap | undefined;
  minGap: TrackGap | undefined;
  /** 按 trackId 分组的统计 */
  byTrack: Record<string, { count: number; totalDuration: number }>;
}

/**
 * 检测单条轨道的间隙区间。
 * 返回所有被 clip 覆盖不到的空白区域（排序后连续区间）。
 * - 首尾开放区间不计入间隙（即 clip 之前的空白和 clip 之后的空白不算间隙）
 * - 相邻 clip 恰好相接的区间不计（duration ≈ 0）
 * - minDuration 用于过滤极小间隙（默认 1帧 @30fps ≈ 0.033s）
 */
export function detectTrackGaps(
  track: Track,
  options?: { minDuration?: number }
): TrackGap[] {
  const minDuration = options?.minDuration ?? 0;
  const sorted = [...track.clips].sort(
    (a, b) => a.start - b.start || a.id.localeCompare(b.id)
  );
  const gaps: TrackGap[] = [];
  let cursor = 0;
  let hasFirstClip = false;

  for (const clip of sorted) {
    if (!hasFirstClip) {
      // 第一个 clip 之前的空白是首部开放区间，不计为间隙
      cursor = clip.start + clip.duration;
      hasFirstClip = true;
      continue;
    }
    const gapStart = cursor;
    const gapEnd = clip.start;
    const gapDuration = round(gapEnd - gapStart);
    if (gapDuration > EPSILON && gapDuration >= minDuration) {
      gaps.push({
        trackId: track.id,
        start: round(gapStart),
        end: round(gapEnd),
        duration: gapDuration,
      });
    }
    cursor = Math.max(cursor, clip.start + clip.duration);
  }
  // clip 之后的尾部开放区间不计为间隙
  return gaps;
}

/**
 * 检测整个时间线的所有轨道间隙。
 */
export function computeTimelineGaps(
  timeline: Timeline,
  options?: { minDuration?: number }
): TrackGap[] {
  return timeline.tracks.flatMap((track) =>
    detectTrackGaps(track, options)
  );
}

/**
 * 获取间隙统计信息。
 */
export function getGapStats(gaps: TrackGap[]): GapStats {
  if (gaps.length === 0) {
    return {
      totalCount: 0,
      totalDuration: 0,
      maxGap: undefined,
      minGap: undefined,
      byTrack: {},
    };
  }
  const byTrack: Record<string, { count: number; totalDuration: number }> = {};
  let totalDuration = 0;
  let maxGap = gaps[0];
  let minGap = gaps[0];

  for (const gap of gaps) {
    totalDuration += gap.duration;
    if (gap.duration > maxGap.duration) maxGap = gap;
    if (gap.duration < minGap.duration) minGap = gap;
    const entry = byTrack[gap.trackId];
    if (entry) {
      entry.count += 1;
      entry.totalDuration = round(entry.totalDuration + gap.duration);
    } else {
      byTrack[gap.trackId] = { count: 1, totalDuration: gap.duration };
    }
  }

  return {
    totalCount: gaps.length,
    totalDuration: round(totalDuration),
    maxGap,
    minGap,
    byTrack,
  };
}

/**
 * 在间隙列表中按方向导航，返回目标间隙。
 * 支持循环：最后一个间隙 → 下一个 → 第一个间隙。
 * @param gaps 已排序的间隙列表
 * @param currentTime 当前播放头时间
 * @param direction 1 = 下一个间隙, -1 = 上一个间隙
 */
export function navigateGap(
  gaps: TrackGap[],
  currentTime: number,
  direction: 1 | -1
): TrackGap | undefined {
  if (gaps.length === 0) return undefined;
  const sorted = [...gaps].sort((a, b) => a.start - b.start);

  if (direction === 1) {
    // 找到 start > currentTime 的第一个间隙
    const next = sorted.find((g) => g.start > currentTime + EPSILON);
    return next ?? sorted[0]; // 循环回到第一个
  }

  // direction === -1: 找到 start < currentTime 的最后一个间隙
  const prev = [...sorted]
    .reverse()
    .find((g) => g.start < currentTime - EPSILON);
  return prev ?? sorted[sorted.length - 1]; // 循环回到最后一个
}
