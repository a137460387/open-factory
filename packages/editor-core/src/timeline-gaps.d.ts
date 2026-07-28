import type { Timeline, Track } from './model-types';
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
    byTrack: Record<string, {
        count: number;
        totalDuration: number;
    }>;
}
/**
 * 检测单条轨道的间隙区间。
 * 返回所有被 clip 覆盖不到的空白区域（排序后连续区间）。
 * - 首尾开放区间不计入间隙（即 clip 之前的空白和 clip 之后的空白不算间隙）
 * - 相邻 clip 恰好相接的区间不计（duration ≈ 0）
 * - minDuration 用于过滤极小间隙（默认 1帧 @30fps ≈ 0.033s）
 */
export declare function detectTrackGaps(track: Track, options?: {
    minDuration?: number;
}): TrackGap[];
/**
 * 检测整个时间线的所有轨道间隙。
 */
export declare function computeTimelineGaps(timeline: Timeline, options?: {
    minDuration?: number;
}): TrackGap[];
/**
 * 获取间隙统计信息。
 */
export declare function getGapStats(gaps: TrackGap[]): GapStats;
/**
 * 在间隙列表中按方向导航，返回目标间隙。
 * 支持循环：最后一个间隙 → 下一个 → 第一个间隙。
 * @param gaps 已排序的间隙列表
 * @param currentTime 当前播放头时间
 * @param direction 1 = 下一个间隙, -1 = 上一个间隙
 */
export declare function navigateGap(gaps: TrackGap[], currentTime: number, direction: 1 | -1): TrackGap | undefined;
//# sourceMappingURL=timeline-gaps.d.ts.map