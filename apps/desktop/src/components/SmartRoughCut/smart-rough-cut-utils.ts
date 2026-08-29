/**
 * 智能粗剪分步编排工具函数
 *
 * 从 SmartRoughCutStepPanel 抽出的纯函数与候选类型：
 * 场景切点候选、B-roll 候选、节拍时间轴派生、静音时长统计等。
 * 仅依赖 editor-core（round + 类型），零 store / 零 React 依赖。
 */
import {
  round,
  type Clip,
  type MediaAsset,
  type Project,
  type SilentRange,
  type SmartRoughCutBrollCandidate,
  type SmartRoughCutVisualClip,
  type Timeline,
} from '@open-factory/editor-core';

export interface SceneCandidate {
  id: string;
  start: number;
  end: number;
  splitTime?: number;
  thumbnail?: string;
}

export interface SilenceCandidate {
  id: string;
  range: SilentRange;
}

export function getClipMediaAsset(clip: Clip | undefined, media: MediaAsset[]): MediaAsset | undefined {
  if (!clip || !('mediaId' in clip)) {
    return undefined;
  }
  return media.find((asset) => asset.id === clip.mediaId);
}

export function getTimelineClips(timeline: Timeline): Clip[] {
  return timeline.tracks.flatMap((track) => track.clips);
}

export function isVisualClip(clip: Clip): clip is SmartRoughCutVisualClip {
  return clip.type === 'video' || clip.type === 'image';
}

export function getPrimaryVisualClips(
  timeline: Timeline,
  selectedVisualClips: SmartRoughCutVisualClip[],
): SmartRoughCutVisualClip[] {
  if (selectedVisualClips.length > 0) {
    return selectedVisualClips;
  }
  return (timeline.tracks.find((track) => track.type === 'video')?.clips ?? []).filter(isVisualClip);
}

export function buildBrollCandidates(media: MediaAsset[], selectedClips: Clip[]): SmartRoughCutBrollCandidate[] {
  const selectedMediaIds = new Set(selectedClips.flatMap((clip) => ('mediaId' in clip ? [clip.mediaId] : [])));
  const preferred = media.filter(
    (asset) => (asset.type === 'video' || asset.type === 'image') && !asset.missing && !selectedMediaIds.has(asset.id),
  );
  const fallback =
    preferred.length > 0
      ? preferred
      : media.filter((asset) => (asset.type === 'video' || asset.type === 'image') && !asset.missing);
  return fallback.map((asset) => ({ kind: 'media', asset }));
}

export function getRhythmBeatTimes(project: Project, selectedClips: Clip[]): number[] {
  const projectBeats = (project.beatMarkers ?? []).map((marker) => marker.time);
  if (projectBeats.length >= 2) {
    return projectBeats;
  }
  return selectedClips
    .flatMap((clip) => (clip.beatMarkers ?? []).map((marker) => round(clip.start + marker.time)))
    .sort((left, right) => left - right);
}

export function sumSilentDuration(ranges: SilentRange[]): number {
  return round(ranges.reduce((total, range) => total + range.duration, 0));
}

export function buildSceneCandidates(splitTimes: number[], duration: number, thumbnail?: string): SceneCandidate[] {
  const points = Array.from(new Set(splitTimes.map((time) => round(Math.min(duration, Math.max(0, time))))))
    .filter((time) => time > 0.000001 && time < duration - 0.000001)
    .sort((left, right) => left - right);
  const boundaries = [0, ...points, duration];
  return boundaries.slice(0, -1).map((start, index) => ({
    id: `scene-${index}`,
    start,
    end: boundaries[index + 1],
    splitTime: index < points.length ? boundaries[index + 1] : undefined,
    thumbnail,
  }));
}

export function formatSeconds(value: number): string {
  return `${round(value).toFixed(2)}s`;
}

// ─── 转写文本 → 语义引擎桥接（understandSpeech 入参组装） ────

/** 重叠判定容差（与 gap 操作的 1e-6 惯例一致） */
const TRANSCRIPT_OVERLAP_EPSILON = 1e-6;

export interface SubtitleTranscriptSource {
  /** 拼接后的转写文本（各 subtitle clip 以换行分隔） */
  transcript: string;
  /** 与 transcript 各段一一对应的时间区间（时间线绝对时间，秒） */
  timeAlignment: Array<{ start: number; end: number }>;
  /** 收集到的非空 subtitle clip 数量 */
  segmentCount: number;
}

/**
 * 从时间线 subtitle 轨收集与指定 clip 时间范围重叠的转写文本。
 *
 * whisper 产出的 subtitle clip 携带 clip 级 text 与时间对齐
 * （start/duration，时间线绝对时间，见 lib/subtitles.ts
 * buildSubtitleTrackFromSrt）。此处按 start 排序拼接文本并组装
 * understandSpeech(transcript, timeAlignment) 所需入参；
 * 纯函数，零 store / 零 React 依赖。
 */
export function collectSubtitleTranscriptForClip(
  timeline: Timeline,
  clip: Clip | undefined,
): SubtitleTranscriptSource {
  if (!clip) {
    return { transcript: '', timeAlignment: [], segmentCount: 0 };
  }
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  const subtitles = timeline.tracks
    .filter((track) => track.type === 'subtitle')
    .flatMap((track) => track.clips)
    .filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle')
    .filter((item) => item.text.trim().length > 0)
    .filter(
      (item) =>
        item.start < clipEnd - TRANSCRIPT_OVERLAP_EPSILON &&
        item.start + item.duration > clipStart + TRANSCRIPT_OVERLAP_EPSILON,
    )
    .sort((left, right) => left.start - right.start);
  return {
    transcript: subtitles.map((item) => item.text.trim()).join('\n'),
    timeAlignment: subtitles.map((item) => ({ start: item.start, end: round(item.start + item.duration) })),
    segmentCount: subtitles.length,
  };
}
