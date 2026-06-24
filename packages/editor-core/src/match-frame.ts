import type { Clip, NestedSequenceClip, Sequence, Timeline, Track } from './model';
import { round } from './time';

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
export function calculateSourceTime(
  clipStart: number,
  clipTrimStart: number,
  clipSpeed: number,
  playheadTime: number
): number {
  const safeSpeed = clipSpeed > 0 ? clipSpeed : 1;
  const raw = clipTrimStart + (playheadTime - clipStart) / safeSpeed;
  return round(Math.max(0, raw));
}

/**
 * 获取 clip 的源媒体 ID（如有）。
 */
export function getClipMediaId(clip: Clip): string | undefined {
  if (clip.type === 'video' || clip.type === 'audio' || clip.type === 'image') {
    return clip.mediaId;
  }
  return undefined;
}

/**
 * 从时间线中匹配帧：选中 clip + playhead -> 源素材时间点。
 * 支持嵌套序列穿透。
 */
export function matchFrameFromClip(options: MatchFrameOptions): MatchFrameResult | undefined {
  const { timeline, clipId, playheadTime, sequences, activeSequenceId, penetrationMode = 'source' } = options;
  const clip = findClipInTimeline(timeline, clipId);
  if (!clip) {
    return undefined;
  }

  // 如果是嵌套序列 clip 且选择匹配到嵌套级别
  if (clip.type === 'nested-sequence') {
    if (penetrationMode === 'nested') {
      return {
        mediaId: clip.id,
        sourceTime: calculateSourceTime(clip.start, clip.trimStart, clip.speed, playheadTime),
        subclipId: clip.subclipId,
        clipId: clip.id,
        sequenceId: (clip as NestedSequenceClip).sequenceId,
      };
    }
    // source 模式：穿透到嵌套序列内部，找到第一个带 mediaId 的 clip
    const nestedSeq = sequences?.find((s) => s.id === (clip as NestedSequenceClip).sequenceId);
    if (nestedSeq) {
      const nestedClipTime = calculateSourceTime(clip.start, clip.trimStart, clip.speed, playheadTime);
      const nestedClip = findClipAtTime(nestedSeq.timeline, nestedClipTime);
      if (nestedClip) {
        const mediaId = getClipMediaId(nestedClip);
        if (mediaId) {
          return {
            mediaId,
            sourceTime: calculateSourceTime(nestedClip.start, nestedClip.trimStart, nestedClip.speed, nestedClipTime),
            clipId: nestedClip.id,
            sequenceId: nestedSeq.id,
          };
        }
      }
    }
    return undefined;
  }

  const mediaId = getClipMediaId(clip);
  if (!mediaId) {
    return undefined;
  }

  return {
      mediaId,
      sourceTime: calculateSourceTime(clip.start, clip.trimStart, clip.speed, playheadTime),
      subclipId: clip.subclipId,
      clipId: clip.id,
      sequenceId: activeSequenceId,
    };
}

/**
 * 查找媒体在时间线中所有使用位置（反向 Reveal in Timeline）。
 * 遍历所有序列中的所有 clip，匹配 mediaId。
 */
export function revealInTimeline(
  timeline: Timeline,
  mediaId: string,
  sequences?: Sequence[]
): RevealResult {
  const instances: RevealInstance[] = [];
  collectInstancesFromTimeline(timeline, mediaId, instances);
  if (sequences) {
    for (const seq of sequences) {
      collectInstancesFromTimeline(seq.timeline, mediaId, instances, seq.id);
    }
  }
  return { instances };
}

/**
 * 获取同一媒体在时间线中的所有实例及其序号。
 * 用于显示 "1/N" 导航控件。
 */
export function getMediaInstanceNavigation(
  timeline: Timeline,
  mediaId: string,
  currentClipId: string,
  sequences?: Sequence[]
): { currentIndex: number; total: number } {
  const { instances } = revealInTimeline(timeline, mediaId, sequences);
  const total = instances.length;
  const currentIndex = instances.findIndex((inst) => inst.clipId === currentClipId);
  return { currentIndex: currentIndex >= 0 ? currentIndex : 0, total };
}

/**
 * 跳转到同一媒体的下一个实例。
 * 返回下一个实例的 clipId，如果没有更多实例则返回 undefined。
 */
export function navigateToNextInstance(
  timeline: Timeline,
  mediaId: string,
  currentClipId: string,
  sequences?: Sequence[]
): string | undefined {
  const { instances } = revealInTimeline(timeline, mediaId, sequences);
  if (instances.length <= 1) {
    return undefined;
  }
  const currentIndex = instances.findIndex((inst) => inst.clipId === currentClipId);
  const nextIndex = (currentIndex + 1) % instances.length;
  return instances[nextIndex].clipId;
}

// ── internal helpers ──

function collectInstancesFromTimeline(
  timeline: Timeline,
  mediaId: string,
  out: RevealInstance[],
  sequenceId?: string
): void {
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipMediaId = getClipMediaId(clip);
      if (clipMediaId === mediaId) {
        out.push({
          clipId: clip.id,
          trackId: track.id,
          startTime: clip.start,
          sequenceId,
        });
      }
    }
  }
}

function findClipInTimeline(timeline: Timeline, clipId: string): Clip | undefined {
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.id === clipId) {
        return clip;
      }
    }
  }
  return undefined;
}

function findClipAtTime(timeline: Timeline, time: number): Clip | undefined {
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (time >= clip.start && time < clip.start + clip.duration) {
        return clip;
      }
    }
  }
  return undefined;
}

