import {
  DEFAULT_TRANSFORM,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  createTrack,
  createAdjustmentClip,
  normalizeChromaKey,
  normalizeAudioDenoise,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMotionTrack,
  normalizeSequenceFrameRate,
  normalizeStabilization,
  type Clip,
  type Project,
  type SubtitleStyle,
  type TextStyle,
  type Timeline,
  type TimelineAccessor,
  type Transform,
  type ColorCorrection,
  createProject
} from '../src';

type ClipOverrides<TClip extends Clip> = Partial<Omit<TClip, 'transform' | 'style' | 'colorCorrection'>> & {
  transform?: Partial<Transform>;
  style?: Partial<TextStyle> | Partial<SubtitleStyle>;
  colorCorrection?: Partial<ColorCorrection>;
};

export function makeVideoClip(overrides: ClipOverrides<Extract<Clip, { type: 'video' }>> = {}): Extract<Clip, { type: 'video' }> {
  return {
    id: overrides.id ?? 'clip-1',
    type: 'video',
    name: overrides.name ?? 'Clip',
    mediaId: overrides.mediaId ?? 'asset-1',
    trackId: overrides.trackId ?? 'track-video',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    volume: overrides.volume ?? 1,
    muted: overrides.muted,
    pitchSemitones: overrides.pitchSemitones ?? DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: overrides.reverseAudio ?? DEFAULT_AUDIO_REVERSE,
    fadeInDuration: overrides.fadeInDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: overrides.fadeOutDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: overrides.fadeInCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: overrides.fadeOutCurve ?? DEFAULT_AUDIO_FADE_CURVE
  };
}

export function makeAudioClip(overrides: ClipOverrides<Extract<Clip, { type: 'audio' }>> = {}): Extract<Clip, { type: 'audio' }> {
  return {
    id: overrides.id ?? 'audio-1',
    type: 'audio',
    name: overrides.name ?? 'Audio',
    mediaId: overrides.mediaId ?? 'asset-audio',
    trackId: overrides.trackId ?? 'track-audio',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    volume: overrides.volume ?? 1,
    muted: overrides.muted,
    pitchSemitones: overrides.pitchSemitones ?? DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: overrides.reverseAudio ?? DEFAULT_AUDIO_REVERSE,
    fadeInDuration: overrides.fadeInDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: overrides.fadeOutDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: overrides.fadeInCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: overrides.fadeOutCurve ?? DEFAULT_AUDIO_FADE_CURVE
  };
}

export function makeAdjustmentClip(overrides: ClipOverrides<Extract<Clip, { type: 'adjustment' }>> = {}): Extract<Clip, { type: 'adjustment' }> {
  return createAdjustmentClip({
    id: overrides.id ?? 'adjustment-1',
    name: overrides.name ?? 'Adjustment Layer',
    trackId: overrides.trackId ?? 'track-adjustment',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    keyframes: overrides.keyframes,
    effects: overrides.effects
  });
}

export function makeTextClip(overrides: ClipOverrides<Extract<Clip, { type: 'text' }>> = {}): Extract<Clip, { type: 'text' }> {
  return {
    id: overrides.id ?? 'text-1',
    type: 'text',
    name: overrides.name ?? 'Title',
    trackId: overrides.trackId ?? 'track-text',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 5,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 5),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    text: overrides.text ?? 'Hello',
    style: {
      fontSize: overrides.style?.fontSize ?? 48,
      color: overrides.style?.color ?? '#fff',
      backgroundColor: overrides.style?.backgroundColor ?? '#000000',
      backgroundOpacity: overrides.style?.backgroundOpacity ?? 0,
      fontFamily: overrides.style?.fontFamily ?? 'Inter',
      bold: overrides.style?.bold ?? false,
      italic: overrides.style?.italic ?? false
    }
  };
}

export function makeSubtitleClip(overrides: ClipOverrides<Extract<Clip, { type: 'subtitle' }>> = {}): Extract<Clip, { type: 'subtitle' }> {
  return {
    id: overrides.id ?? 'subtitle-1',
    type: 'subtitle',
    name: overrides.name ?? 'Subtitle',
    trackId: overrides.trackId ?? 'track-subtitle',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 2,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 2),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    text: overrides.text ?? 'Subtitle line',
    subtitleMode: overrides.subtitleMode ?? DEFAULT_SUBTITLE_MODE,
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      ...overrides.style
    }
  };
}

export function makeTimeline(clips: Clip[] = []): Timeline {
  return {
    transitions: [],
    tracks: [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: clips.filter((clip) => clip.trackId === 'track-video') }),
      createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: clips.filter((clip) => clip.trackId === 'track-audio') }),
      createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: clips.filter((clip) => clip.trackId === 'track-text') })
    ]
  };
}

export function makeAccessor(initial: Timeline): TimelineAccessor & { current(): Timeline } {
  let timeline = initial;
  return {
    getTimeline: () => timeline,
    setTimeline: (next) => {
      timeline = next;
    },
    current: () => timeline
  };
}

export function makeProject(): Project {
  const project = createProject('Test Project');
  return {
    ...project,
    media: [
      {
        id: 'asset-1',
        type: 'video',
        name: 'sample.mp4',
        path: 'C:\\Videos\\sample.mp4',
        duration: 20,
        width: 1920,
        height: 1080,
        size: 4096,
        mtimeMs: 1000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 48000,
        audioCodec: 'aac'
      }
    ],
    timeline: makeTimeline([makeVideoClip()])
  };
}
