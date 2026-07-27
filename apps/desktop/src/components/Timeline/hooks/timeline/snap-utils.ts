import type {Clip} from '@open-factory/editor-core';
import {
  calculateSpeedCurveDisplayDuration,
  calculateSpeedCurveSourceDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
  moveClip,
  round,
} from '@open-factory/editor-core';
import type {TimelineHandlerParams} from './types';

export function createSnapUtils(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    snapClipEnd: (time: number, clip: Clip, disabled: boolean) => number;
    minFrameDuration: () => number;
  },
) {
  const {project, allClips, zoom} = params;
  const {findClip, snapClipEnd, minFrameDuration} = helpers;

  function buildMovedPreviewTimeline(previewStartsByClipId: Record<string, number>) {
    const movedById = new Map(
      Object.entries(previewStartsByClipId).map(([clipId, start]) => [clipId, moveClip(findClip(clipId), start)]),
    );
    return {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip),
      })),
    };
  }

  function buildTrimPreview(clip: Clip, edge: 'left' | 'right', delta: number, snappingDisabled: boolean): Clip {
    const speed = getClipSpeed(clip);
    const sourceDuration = clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd;
    const minDurationVal = minFrameDuration();
    const minSourceDuration = calculateSpeedCurveSourceDuration(minDurationVal, clip.keyframes, speed);
    if (edge === 'left') {
      const sourceDelta = delta >= 0 ? calculateSpeedCurveSourceDuration(delta, clip.keyframes, speed) : delta * speed;
      const maxTrimStart = Math.max(0, sourceDuration - clip.trimEnd - minSourceDuration);
      const trimStart = round(Math.min(maxTrimStart, Math.max(0, clip.trimStart + sourceDelta)));
      const visibleSourceDuration = Math.max(0, sourceDuration - trimStart - clip.trimEnd);
      return {
        ...clip,
        trimStart,
        duration: round(
          Math.max(minDurationVal, calculateSpeedCurveDisplayDuration(visibleSourceDuration, clip.keyframes, speed)),
        ),
        transform: { ...clip.transform },
      } as Clip;
    }
    const proposedEnd = snapClipEnd(clip.start + Math.max(minDurationVal, clip.duration + delta), clip, snappingDisabled);
    const maxDuration = Math.max(
      minDurationVal,
      calculateSpeedCurveDisplayDuration(sourceDuration - clip.trimStart, clip.keyframes, speed),
    );
    const duration = round(Math.min(maxDuration, Math.max(minDurationVal, proposedEnd - clip.start)));
    const visibleSourceDuration = calculateSpeedCurveSourceDuration(duration, clip.keyframes, speed);
    return {
      ...clip,
      trimEnd: round(Math.max(0, sourceDuration - clip.trimStart - visibleSourceDuration)),
      duration,
      transform: { ...clip.transform },
    } as Clip;
  }

  function findClipById(clipId: string): Clip | undefined {
    return allClips.find((clip) => clip.id === clipId);
  }

  function getClipMediaAsset(clip: Clip) {
    if (!('mediaId' in clip)) {
      return undefined;
    }
    return project.media.find((asset) => asset.id === clip.mediaId);
  }

  return {
    buildMovedPreviewTimeline,
    buildTrimPreview,
    findClipById,
    getClipMediaAsset,
    minFrameDuration,
  };
}
