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
