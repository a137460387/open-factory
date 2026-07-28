import type { Clip, Sequence, Timeline } from './model';
/** 匹配到的源素材时间点结果 */
export interface MatchFrameResult {
    /** 源媒体 assetId */
    mediaId: string;
    /** 源素材时间点（秒） */
    sourceTime: number;
    /** 匹配到的 clip 信息 */
    clipId: string;
    /** clip 所在序列 id */
    sequenceId?: string;
    /** 若 clip 来源于虚拟子剪辑，记录其 subclipId */
    subclipId?: string;
}
/** 反向查找结果 */
export interface RevealResult {
    /** 包含该媒体的所有 clip 信息 */
    instances: RevealInstance[];
}
export interface RevealInstance {
    clipId: string;
    trackId: string;
    startTime: number;
    sequenceId?: string;
}
/** 嵌套穿透模式：'nested' = 仅匹配到嵌套序列级别，'source' = 穿透到源媒体 */
export type MatchFramePenetrationMode = 'nested' | 'source';
export interface MatchFrameOptions {
    timeline: Timeline;
    clipId: string;
    playheadTime: number;
    sequences?: Sequence[];
    activeSequenceId?: string;
    /** 嵌套穿透模式，默认 'source' */
    penetrationMode?: MatchFramePenetrationMode;
}
/**
 * 计算 clip 中 playhead 对应的源素材时间点。
 * sourceTime = clip.trimStart + (playhead - clip.startTime) / clip.speed
 */
export declare function calculateSourceTime(clipStart: number, clipTrimStart: number, clipSpeed: number, playheadTime: number): number;
/**
 * 获取 clip 的源媒体 ID（如有）。
 */
export declare function getClipMediaId(clip: Clip): string | undefined;
/**
 * 从时间线中匹配帧：选中 clip + playhead -> 源素材时间点。
 * 支持嵌套序列穿透。
 */
export declare function matchFrameFromClip(options: MatchFrameOptions): MatchFrameResult | undefined;
/**
 * 查找媒体在时间线中所有使用位置（反向 Reveal in Timeline）。
 * 遍历所有序列中的所有 clip，匹配 mediaId。
 */
export declare function revealInTimeline(timeline: Timeline, mediaId: string, sequences?: Sequence[]): RevealResult;
/**
 * 获取同一媒体在时间线中的所有实例及其序号。
 * 用于显示 "1/N" 导航控件。
 */
export declare function getMediaInstanceNavigation(timeline: Timeline, mediaId: string, currentClipId: string, sequences?: Sequence[]): {
    currentIndex: number;
    total: number;
};
/**
 * 跳转到同一媒体的下一个实例。
 * 返回下一个实例的 clipId，如果没有更多实例则返回 undefined。
 */
export declare function navigateToNextInstance(timeline: Timeline, mediaId: string, currentClipId: string, sequences?: Sequence[]): string | undefined;
//# sourceMappingURL=match-frame.d.ts.map