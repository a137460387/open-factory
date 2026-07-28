import type { Clip, Timeline, Transition } from '@open-factory/editor-core';
import {
  applyClipKeyframes,
  getClipPlaybackStart,
  getRenderableTracks,
  getTransitionPlaybackWindow,
} from '@open-factory/editor-core';

export interface ClipRenderInstance {
  clip: Clip;
  playheadTime: number;
  trackIndex: number;
  start: number;
}

export function getTransitionAwareClipInstances(timeline: Timeline, playheadTime: number): ClipRenderInstance[] {
  const windows = (timeline.transitions ?? [])
    .map((transition) => ({ transition, window: getTransitionPlaybackWindow(timeline, transition) }))
    .filter(
      (item): item is { transition: Transition; window: NonNullable<ReturnType<typeof getTransitionPlaybackWindow>> } =>
        Boolean(item.window),
    );

  return getRenderableTracks(timeline)
    .flatMap((track, trackIndex) =>
      track.clips.map((clip) => {
        const playbackStart = getClipPlaybackStart(timeline, clip.id) ?? clip.start;
        return {
          clip,
          playbackStart,
          playbackEnd: playbackStart + clip.duration,
          trackIndex,
        };
      }),
    )
    .filter((item) => playheadTime >= item.playbackStart && playheadTime < item.playbackEnd)
    .map((item) => {
      const localTime = playheadTime - item.playbackStart;
      const animatedClip = applyClipKeyframes(item.clip, localTime);
      const opacity = getTransitionOpacity(windows, item.clip.id, playheadTime);
      const clip = opacity >= 0.999 ? animatedClip : withOpacity(animatedClip, opacity);
      return {
        clip,
        playheadTime: item.clip.start + localTime,
        trackIndex: item.trackIndex,
        start: item.playbackStart,
      };
    })
    .filter((item) => item.clip.transform.opacity > 0.001)
    .sort(
      (left, right) =>
        left.trackIndex - right.trackIndex || left.start - right.start || left.clip.id.localeCompare(right.clip.id),
    );
}

export function getTransitionOpacity(
  windows: Array<{ transition: Transition; window: NonNullable<ReturnType<typeof getTransitionPlaybackWindow>> }>,
  clipId: string,
  playheadTime: number,
): number {
  const active = windows.find(
    ({ window }) =>
      playheadTime >= window.start &&
      playheadTime < window.end &&
      (window.fromClip.id === clipId || window.toClip.id === clipId),
  );
  if (!active) {
    return 1;
  }
  const progress = Math.min(1, Math.max(0, (playheadTime - active.window.start) / active.window.duration));
  if (active.transition.type === 'fade-black') {
    if (clipId === active.window.fromClip.id) {
      return progress < 0.5 ? 1 - progress * 2 : 0;
    }
    return progress > 0.5 ? (progress - 0.5) * 2 : 0;
  }
  return clipId === active.window.fromClip.id ? 1 - progress : progress;
}

export function withOpacity<TClip extends Clip>(clip: TClip, opacity: number): TClip {
  return {
    ...clip,
    transform: {
      ...clip.transform,
      opacity: clip.transform.opacity * Math.max(0, Math.min(1, opacity)),
    },
  };
}

export function withCanvasKeyframedPosition<TClip extends Clip>(
  clip: TClip,
  canvasWidth: number,
  canvasHeight: number,
): TClip {
  if (!clip.keyframes?.x && !clip.keyframes?.y) {
    return clip;
  }
  return {
    ...clip,
    transform: {
      ...clip.transform,
      x: clip.keyframes?.x ? clip.transform.x * (canvasWidth / 2) : clip.transform.x,
      y: clip.keyframes?.y ? clip.transform.y * (canvasHeight / 2) : clip.transform.y,
    },
  } as TClip;
}
