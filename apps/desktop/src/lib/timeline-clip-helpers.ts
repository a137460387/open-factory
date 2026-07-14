import type {
  Timeline,
  Clip,
  Track,
  SubtitleDataImportMode,
  Project,
  KeyframeProperty,
} from '@open-factory/editor-core';
import { getClipSpeed } from '@open-factory/editor-core';

export function getSubtitleDataImportTargetTrackId(
  timeline: Timeline,
  mode: SubtitleDataImportMode,
  selectedClipIds: string[],
): string | undefined {
  if (mode === 'new-track') {
    return undefined;
  }
  const selected = new Set(selectedClipIds);
  const selectedSubtitleTrack = timeline.tracks.find(
    (track: Track) => track.type === 'subtitle' && track.clips.some((clip: Clip) => selected.has(clip.id)),
  );
  return selectedSubtitleTrack?.id ?? timeline.tracks.find((track: Track) => track.type === 'subtitle')?.id;
}

export function findTimelineClipForMediaSourceTime(
  timeline: Timeline,
  mediaId: string,
  sourceTime: number,
  preferredClip?: Clip,
): { clip: Clip; timelineTime: number } | undefined {
  const candidates: Clip[] = [
    ...(preferredClip ? [preferredClip] : []),
    ...timeline.tracks.flatMap((track: Track) => track.clips).filter((clip: Clip) => clip.id !== preferredClip?.id),
  ];
  for (const clip of candidates) {
    if (!('mediaId' in clip) || clip.mediaId !== mediaId) {
      continue;
    }
    const speed = Math.max(0.001, getClipSpeed(clip));
    const localTime = (sourceTime - clip.trimStart) / speed;
    if (localTime <= 0.000001 || localTime >= clip.duration - 0.000001) {
      continue;
    }
    return { clip, timelineTime: clip.start + localTime };
  }
  return undefined;
}

export function isPiPVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

export function isSceneReorderClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image';
}

export function getClipSourceDimensions(project: Project, clip: Clip): { width: number; height: number } {
  if (clip.type === 'nested-sequence') {
    return { width: project.settings.width, height: project.settings.height };
  }
  if ('mediaId' in clip) {
    const asset = project.media.find((item) => item.id === clip.mediaId);
    return {
      width: Math.max(1, asset?.width || project.settings.width),
      height: Math.max(1, asset?.height || project.settings.height),
    };
  }
  return { width: project.settings.width, height: project.settings.height };
}

export function collectClipKeyframeRefs(
  clip: Clip,
): Array<{ clipId: string; property: KeyframeProperty; keyframeId: string }> {
  return (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).flatMap((property) =>
    (clip.keyframes?.[property] ?? []).map((frame) => ({ clipId: clip.id, property, keyframeId: frame.id })),
  );
}
