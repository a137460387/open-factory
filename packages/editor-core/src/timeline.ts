import type { Clip, ClipKeyframes, KeyframeProperty, Timeline, Track, Transition } from './model';
import { clampClipSpeed, createId, normalizeTrackPan, normalizeTransitionDuration } from './model';
import { cloneClipKeyframes, normalizeClipKeyframes } from './keyframes';
import { DEFAULT_SNAP_GRID, round, snap } from './time';

const EPSILON = 0.000001;

export function findClipAtTime(track: Track, time: number): Clip | undefined {
  return track.clips.find((clip) => time >= clip.start && time < clip.start + clip.duration);
}

export function getActiveClipsAtTime(timeline: Timeline, time: number): Clip[] {
  return getRenderableTracks(timeline).flatMap((track) => track.clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration));
}

export function splitClip<TClip extends Clip>(clip: TClip, splitTime: number): [TClip, TClip] {
  const speed = getClipSpeed(clip);
  const clipEnd = clip.start + clip.duration;
  if (splitTime <= clip.start + EPSILON || splitTime >= clipEnd - EPSILON) {
    throw new RangeError('splitTime must be inside the clip bounds');
  }

  const leftDuration = round(splitTime - clip.start);
  const rightDuration = round(clip.duration - leftDuration);
  const left = {
    ...clip,
    id: createId('clip'),
    duration: leftDuration,
    trimEnd: round(clip.trimEnd + rightDuration * speed),
    transform: { ...clip.transform },
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), leftDuration)
  } as TClip;
  const right = {
    ...clip,
    id: createId('clip'),
    start: round(splitTime),
    duration: rightDuration,
    trimStart: round(clip.trimStart + leftDuration * speed),
    transform: { ...clip.transform },
    keyframes: shiftClipKeyframes(cloneClipKeyframes(clip.keyframes), leftDuration, rightDuration)
  } as TClip;

  return [left, right];
}

export function trimClip<TClip extends Clip>(clip: TClip, newTrimStart: number, newTrimEnd: number): TClip {
  const speed = getClipSpeed(clip);
  const sourceDuration = Math.max(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd, 0);
  const trimStart = round(Math.max(0, newTrimStart));
  const trimEnd = round(Math.max(0, newTrimEnd));
  if (trimStart + trimEnd >= sourceDuration - EPSILON) {
    throw new RangeError('trim values leave no visible clip duration');
  }

  const duration = getClipDisplayDuration(sourceDuration - trimStart - trimEnd, speed);
  return {
    ...clip,
    trimStart,
    trimEnd,
    duration,
    transform: { ...clip.transform },
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), duration)
  } as TClip;
}

export function moveClip<TClip extends Clip>(clip: TClip, newStart: number): TClip {
  return {
    ...clip,
    start: round(Math.max(0, newStart)),
    transform: { ...clip.transform },
    keyframes: cloneClipKeyframes(clip.keyframes)
  } as TClip;
}

export function detectOverlap(track: Track, clip: Clip, excludeId?: string): boolean {
  const start = clip.start;
  const end = clip.start + clip.duration;
  return track.clips.some((other) => {
    if (other.id === clip.id || other.id === excludeId) {
      return false;
    }
    const otherStart = other.start;
    const otherEnd = other.start + other.duration;
    return start < otherEnd - EPSILON && otherStart < end - EPSILON;
  });
}

export function snapTime(time: number, grid = DEFAULT_SNAP_GRID): number {
  return snap(time, grid);
}

export function getTimelineDuration(timeline: Timeline): number {
  return round(
    timeline.tracks.reduce((duration, track) => {
      const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
      return Math.max(duration, trackEnd);
    }, 0)
  );
}

export function getTimelinePlaybackDuration(timeline: Pick<Timeline, 'tracks' | 'transitions'>): number {
  return round(
    timeline.tracks.reduce((duration, track) => {
      let transitionOffset = 0;
      const clips = sortClipsByTime(track.clips);
      const trackEnd = clips.reduce((end, clip, index) => {
        const previous = clips[index - 1];
        const transition = previous ? findPairTransition(timeline.transitions ?? [], previous.id, clip.id) : undefined;
        if (previous && transition && areClipsAdjacent(previous, clip)) {
          transitionOffset = round(transitionOffset + clampTransitionDuration(transition.duration, previous, clip));
        }
        const playbackStart = round(clip.start - transitionOffset);
        return Math.max(end, playbackStart + clip.duration);
      }, 0);
      return Math.max(duration, trackEnd);
    }, 0)
  );
}

export function getRenderableTracks<TTrack extends { muted?: boolean; solo?: boolean }>(timeline: { tracks: TTrack[] }): TTrack[] {
  const hasSolo = timeline.tracks.some((track) => Boolean(track.solo));
  return timeline.tracks.filter((track) => {
    if (track.muted) {
      return false;
    }
    return hasSolo ? Boolean(track.solo) : true;
  });
}

export function getTrackVolume(track: Track): number {
  return typeof track.volume === 'number' && Number.isFinite(track.volume) ? Math.min(2, Math.max(0, track.volume)) : 1;
}

export function getTrackPan(track: Track): number {
  return normalizeTrackPan(track.pan);
}

export function getTransitionMaxDuration(
  fromClip: Pick<Clip, 'duration'> | { duration: number },
  toClip: Pick<Clip, 'duration'> | { duration: number }
): number {
  return round(Math.max(0, Math.min(fromClip.duration, toClip.duration) * 0.5));
}

export function clampTransitionDuration(
  duration: number | undefined,
  fromClip: Pick<Clip, 'duration'> | { duration: number },
  toClip: Pick<Clip, 'duration'> | { duration: number }
): number {
  return round(Math.min(normalizeTransitionDuration(duration), getTransitionMaxDuration(fromClip, toClip)));
}

export function areClipsAdjacent(
  fromClip: Pick<Clip, 'start' | 'duration'> | { start: number; duration: number },
  toClip: Pick<Clip, 'start'> | { start: number }
): boolean {
  return Math.abs(fromClip.start + fromClip.duration - toClip.start) <= 0.001;
}

export function findAdjacentTransitionClips(
  timeline: Pick<Timeline, 'tracks' | 'transitions'>,
  fromClipId: string,
  toClipId: string
): { track: Track; fromClip: Clip; toClip: Clip; fromIndex: number; toIndex: number } | undefined {
  for (const track of timeline.tracks) {
    const clips = sortClipsByTime(track.clips);
    const fromIndex = clips.findIndex((clip) => clip.id === fromClipId);
    const toIndex = clips.findIndex((clip) => clip.id === toClipId);
    if (fromIndex === -1 || toIndex === -1 || toIndex !== fromIndex + 1) {
      continue;
    }
    const fromClip = clips[fromIndex];
    const toClip = clips[toIndex];
    if (!areClipsAdjacent(fromClip, toClip)) {
      continue;
    }
    return { track, fromClip, toClip, fromIndex, toIndex };
  }
  return undefined;
}

export function getClipPlaybackStart(timeline: Pick<Timeline, 'tracks' | 'transitions'>, clipId: string): number | undefined {
  for (const track of timeline.tracks) {
    const clips = sortClipsByTime(track.clips);
    let transitionOffset = 0;
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const previous = clips[index - 1];
      const transition = previous ? findPairTransition(timeline.transitions ?? [], previous.id, clip.id) : undefined;
      if (previous && transition && areClipsAdjacent(previous, clip)) {
        transitionOffset = round(transitionOffset + clampTransitionDuration(transition.duration, previous, clip));
      }
      if (clip.id === clipId) {
        return round(clip.start - transitionOffset);
      }
    }
  }
  return undefined;
}

export function getTransitionPlaybackWindow(
  timeline: Pick<Timeline, 'tracks' | 'transitions'>,
  transition: Transition
): { start: number; end: number; duration: number; fromClip: Clip; toClip: Clip } | undefined {
  const pair = findAdjacentTransitionClips(timeline, transition.fromClipId, transition.toClipId);
  if (!pair) {
    return undefined;
  }
  const duration = clampTransitionDuration(transition.duration, pair.fromClip, pair.toClip);
  if (duration <= 0) {
    return undefined;
  }
  const toPlaybackStart = getClipPlaybackStart(timeline, pair.toClip.id);
  if (toPlaybackStart === undefined) {
    return undefined;
  }
  return {
    start: toPlaybackStart,
    end: round(toPlaybackStart + duration),
    duration,
    fromClip: pair.fromClip,
    toClip: pair.toClip
  };
}

export function getClipSpeed(clip: Pick<Clip, 'speed'> | { speed?: number }): number {
  return clampClipSpeed(clip.speed);
}

export function getClipSourceVisibleDuration(clip: Pick<Clip, 'duration' | 'speed'> | { duration: number; speed?: number }): number {
  return round(Math.max(0, clip.duration) * getClipSpeed(clip));
}

export function getClipDisplayDuration(sourceVisibleDuration: number, speed: number | undefined): number {
  return round(Math.max(0, sourceVisibleDuration) / getClipSpeed({ speed }));
}

export function setClipSpeed<TClip extends Clip>(clip: TClip, speed: number): TClip {
  const nextSpeed = getClipSpeed({ speed });
  const duration = getClipDisplayDuration(getClipSourceVisibleDuration(clip), nextSpeed);
  return {
    ...clip,
    speed: nextSpeed,
    duration,
    transform: { ...clip.transform },
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), duration)
  } as TClip;
}

export function replaceClip(timeline: Timeline, replacement: Clip): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) =>
      track.id === replacement.trackId
        ? {
            ...track,
            clips: track.clips.map((clip) => (clip.id === replacement.id ? replacement : clip))
          }
        : track
    )
  };
}

export function removeClip(timeline: Timeline, clipId: string): { timeline: Timeline; clip?: Clip; index: number; trackId?: string } {
  let removed: Clip | undefined;
  let removedIndex = -1;
  let removedTrackId: string | undefined;
  const tracks = timeline.tracks.map((track) => {
    const index = track.clips.findIndex((clip) => clip.id === clipId);
    if (index === -1) {
      return track;
    }
    removed = track.clips[index];
    removedIndex = index;
    removedTrackId = track.id;
    return { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) };
  });

  return {
    timeline: {
      ...timeline,
      tracks,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.fromClipId !== clipId && transition.toClipId !== clipId)
    },
    clip: removed,
    index: removedIndex,
    trackId: removedTrackId
  };
}

function sortClipsByTime<TClip extends { start: number; id: string }>(clips: TClip[]): TClip[] {
  return [...clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

function findPairTransition(transitions: Transition[], fromClipId: string, toClipId: string): Transition | undefined {
  return transitions.find((transition) => transition.fromClipId === fromClipId && transition.toClipId === toClipId);
}

function shiftClipKeyframes(keyframes: ClipKeyframes | undefined, offset: number, duration: number): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const shifted: ClipKeyframes = {};
  for (const property of Object.keys(keyframes) as KeyframeProperty[]) {
    const frames = keyframes[property];
    if (frames?.length) {
      shifted[property] = frames.map((frame) => ({
        ...frame,
        time: round(Math.max(0, frame.time - offset))
      }));
    }
  }
  return normalizeClipKeyframes(shifted, duration);
}
