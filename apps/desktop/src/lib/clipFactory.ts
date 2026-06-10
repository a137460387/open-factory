import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  type Clip,
  type MediaAsset,
  type Timeline,
  type Track,
  createId,
  getTimelineDuration
} from '@open-factory/editor-core';

export function createClipFromAsset(asset: MediaAsset, track: Track, timeline: Timeline): Clip {
  const duration = asset.type === 'image' ? 5 : Math.max(asset.duration || 5, 1);
  const start = findAppendStart(track, timeline);
  const base = {
    id: createId('clip'),
    name: asset.name,
    trackId: track.id,
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM }
  };

  if (asset.type === 'audio') {
    return { ...base, type: 'audio', mediaId: asset.id, volume: 1 };
  }
  if (asset.type === 'image') {
    return { ...base, type: 'image', mediaId: asset.id };
  }
  return { ...base, type: 'video', mediaId: asset.id, volume: 1 };
}

export function createTextClip(track: Track, timeline: Timeline): Clip {
  return {
    id: createId('clip'),
    type: 'text',
    name: 'Text',
    trackId: track.id,
    start: findAppendStart(track, timeline),
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    text: 'Title',
    style: { ...DEFAULT_TEXT_STYLE }
  };
}

export function findPreferredTrack(timeline: Timeline, asset: MediaAsset): Track | undefined {
  const wantedType = asset.type === 'audio' ? 'audio' : 'video';
  return timeline.tracks.find((track) => track.type === wantedType);
}

function findAppendStart(track: Track, timeline: Timeline): number {
  const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
  return Math.max(trackEnd, getTimelineDuration(timeline) === 0 ? 0 : trackEnd);
}
