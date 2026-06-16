import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  DEFAULT_CLIP_SPEED,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TEXT_PATH,
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  DEFAULT_SPATIAL_AUDIO,
  normalizeChromaKey,
  type Clip,
  type MediaAsset,
  type Timeline,
  type Track,
  createAdjustmentClip,
  createCreditsClip as createCoreCreditsClip,
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
    chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
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
      fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE,
      spatialAudio: { ...DEFAULT_SPATIAL_AUDIO }
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
    fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE,
    spatialAudio: { ...DEFAULT_SPATIAL_AUDIO }
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
    chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
    masks: [],
    text: zhCN.clips.defaultTextContent,
    style: { ...DEFAULT_TEXT_STYLE },
    pathText: { ...DEFAULT_TEXT_PATH, path: DEFAULT_TEXT_PATH.path.map((point) => ({ ...point, handleIn: point.handleIn ? { ...point.handleIn } : undefined, handleOut: point.handleOut ? { ...point.handleOut } : undefined })) }
  };
}

export function createCreditsClip(track: Track, timeline: Timeline, text = zhCN.clips.defaultCreditsContent, start?: number): Extract<Clip, { type: 'credits' }> {
  return createCoreCreditsClip({
    id: createId('clip'),
    name: zhCN.clips.defaultCreditsName,
    trackId: track.id,
    start: start ?? findAppendStart(track, timeline),
    duration: 8,
    trimStart: 0,
    trimEnd: 0,
    text,
    transform: { ...DEFAULT_TRANSFORM },
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
    masks: []
  });
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
