import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  DEFAULT_CLIP_SPEED,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  type Clip,
  type MediaAsset,
  type Timeline,
  type Track,
  createAdjustmentClip,
  createId,
  getTimelineDuration
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

export function createClipFromAsset(asset: MediaAsset, track: Track, timeline: Timeline): Clip {
  const duration = asset.imageSequence ? Math.max(asset.imageSequence.frameCount / asset.imageSequence.frameRate, 1 / asset.imageSequence.frameRate) : asset.type === 'image' ? 5 : Math.max(asset.duration || 5, 1);
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
    transform: { ...DEFAULT_TRANSFORM },
    chromaKey: { ...DEFAULT_CHROMA_KEY, color: [...DEFAULT_CHROMA_KEY.color] as [number, number, number] },
    masks: [],
    sequenceFrameRate: asset.imageSequence?.frameRate
  };

  if (asset.type === 'audio') {
    return {
      ...base,
      type: 'audio',
      mediaId: asset.id,
      volume: 1,
      pitchSemitones: DEFAULT_AUDIO_PITCH_SEMITONES,
      reverseAudio: DEFAULT_AUDIO_REVERSE,
      fadeInDuration: DEFAULT_AUDIO_FADE_DURATION,
      fadeOutDuration: DEFAULT_AUDIO_FADE_DURATION,
      fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
      fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE
    };
  }
  if (asset.type === 'image') {
    return { ...base, type: 'image', mediaId: asset.id };
  }
  return {
    ...base,
    type: 'video',
    mediaId: asset.id,
    volume: 1,
    pitchSemitones: DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: DEFAULT_AUDIO_REVERSE,
    fadeInDuration: DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE
  };
}

export function createTextClip(track: Track, timeline: Timeline): Clip {
  return {
    id: createId('clip'),
    type: 'text',
    name: zhCN.clips.defaultTextName,
    trackId: track.id,
    start: findAppendStart(track, timeline),
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    chromaKey: { ...DEFAULT_CHROMA_KEY, color: [...DEFAULT_CHROMA_KEY.color] as [number, number, number] },
    masks: [],
    text: zhCN.clips.defaultTextContent,
    style: { ...DEFAULT_TEXT_STYLE }
  };
}

export function createAdjustmentLayerClip(track: Track, timeline: Timeline): Extract<Clip, { type: 'adjustment' }> {
  const timelineDuration = getTimelineDuration(timeline);
  return createAdjustmentClip({
    id: createId('clip'),
    name: zhCN.clips.defaultAdjustmentName,
    trackId: track.id,
    start: findAppendStart(track, timeline),
    duration: Math.max(timelineDuration || 5, 1),
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    masks: []
  });
}

export function findPreferredTrack(timeline: Timeline, asset: MediaAsset): Track | undefined {
  const wantedType = asset.type === 'audio' ? 'audio' : 'video';
  return timeline.tracks.find((track) => track.type === wantedType);
}

function findAppendStart(track: Track, timeline: Timeline): number {
  const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
  return Math.max(trackEnd, getTimelineDuration(timeline) === 0 ? 0 : trackEnd);
}
