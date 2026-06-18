import {
  DEFAULT_TRANSFORM,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  DEFAULT_CREDITS_ROLL_SPEED,
  DEFAULT_CREDITS_STYLE,
  DEFAULT_TEXT_ARC,
  DEFAULT_TEXT_LAYOUT,
  DEFAULT_TEXT_OPEN_TYPE_FEATURES,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_SPATIAL_AUDIO,
  createTrack,
  createAdjustmentClip,
  createMotionGraphicClip,
  createDefaultMotionGraphic,
  normalizeChromaKey,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeCreditsRollSpeed,
  normalizeCreditsRows,
  normalizeCreditsStyle,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
  normalizeAudioRestoration,
  normalizeClipBlendMode,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMotionTrack,
  normalizeQualityEnhancement,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeRichTextDocument,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
  normalizeTextPath,
  normalizeVideoRestoration,
  normalizeColorNodeGraph,
  type Clip,
  type Project,
  type SubtitleStyle,
  type TextStyle,
  type Timeline,
  type TimelineAccessor,
  type Transform,
  type ColorCorrection,
  type CreditsStyle,
  type ColorNodeGraph,
  createProject
} from '../src';

type ClipOverrides<TClip extends Clip> = Partial<Omit<TClip, 'transform' | 'style' | 'colorCorrection'>> & {
  transform?: Partial<Transform>;
  style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
  colorCorrection?: Partial<ColorCorrection>;
};

function buildColorNodeGraphPatch(colorNodeGraph: unknown): { colorNodeGraph?: ColorNodeGraph } {
  if (!colorNodeGraph || typeof colorNodeGraph !== 'object') {
    return {};
  }
  return { colorNodeGraph: normalizeColorNodeGraph(colorNodeGraph as Partial<ColorNodeGraph>) };
}

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
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    projection: normalizeClipProjection(overrides.projection),
    panorama: normalizeClipPanoramaView(overrides.panorama),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    pitchData: overrides.pitchData,
    beatMarkers: overrides.beatMarkers,
    detectedBpm: overrides.detectedBpm,
    scenecuts: overrides.scenecuts,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    volume: overrides.volume ?? 1,
    muted: overrides.muted,
    pitchSemitones: overrides.pitchSemitones ?? DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: overrides.reverseAudio ?? DEFAULT_AUDIO_REVERSE,
    fadeInDuration: overrides.fadeInDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: overrides.fadeOutDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: overrides.fadeInCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: overrides.fadeOutCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    spatialAudio: overrides.spatialAudio ?? { ...DEFAULT_SPATIAL_AUDIO }
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
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    pitchData: overrides.pitchData,
    beatMarkers: overrides.beatMarkers,
    detectedBpm: overrides.detectedBpm,
    scenecuts: overrides.scenecuts,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    volume: overrides.volume ?? 1,
    muted: overrides.muted,
    pitchSemitones: overrides.pitchSemitones ?? DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: overrides.reverseAudio ?? DEFAULT_AUDIO_REVERSE,
    fadeInDuration: overrides.fadeInDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: overrides.fadeOutDuration ?? DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: overrides.fadeInCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: overrides.fadeOutCurve ?? DEFAULT_AUDIO_FADE_CURVE,
    spatialAudio: overrides.spatialAudio ?? { ...DEFAULT_SPATIAL_AUDIO }
  };
}

export function makeImageClip(overrides: ClipOverrides<Extract<Clip, { type: 'image' }>> = {}): Extract<Clip, { type: 'image' }> {
  return {
    id: overrides.id ?? 'image-1',
    type: 'image',
    name: overrides.name ?? 'Image',
    mediaId: overrides.mediaId ?? 'asset-image',
    trackId: overrides.trackId ?? 'track-video',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 5,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 5),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    scenecuts: overrides.scenecuts,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    kenBurns: overrides.kenBurns
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
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 10),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    keyframes: overrides.keyframes,
    effects: overrides.effects
  });
}

export function makeMotionGraphicClip(overrides: ClipOverrides<Extract<Clip, { type: 'motion-graphic' }>> = {}): Extract<Clip, { type: 'motion-graphic' }> {
  return createMotionGraphicClip({
    id: overrides.id ?? 'motion-graphic-1',
    name: overrides.name ?? 'Motion Graphic',
    trackId: overrides.trackId ?? 'track-motion-graphic',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 5,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 5),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    motionGraphic: overrides.motionGraphic ?? createDefaultMotionGraphic('countdown')
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
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 5),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
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
    },
    richText: normalizeRichTextDocument(overrides.richText, overrides.text ?? 'Hello'),
    textLayout: normalizeTextLayout(overrides.textLayout ?? DEFAULT_TEXT_LAYOUT),
    openTypeFeatures: normalizeTextOpenTypeFeatures(overrides.openTypeFeatures ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES),
    arcText: normalizeTextArc(overrides.arcText ?? DEFAULT_TEXT_ARC),
    pathText: normalizeTextPath(overrides.pathText)
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
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 2),
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    subtitleType: overrides.subtitleType ?? 'subtitle',
    speaker: overrides.speaker,
    soundDesc: overrides.soundDesc,
    dataSubtitle: overrides.dataSubtitle,
    text: overrides.text ?? 'Subtitle line',
    subtitleMode: overrides.subtitleMode ?? DEFAULT_SUBTITLE_MODE,
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      ...overrides.style
    }
  };
}

export function makeCreditsClip(overrides: ClipOverrides<Extract<Clip, { type: 'credits' }>> = {}): Extract<Clip, { type: 'credits' }> {
  const text = overrides.text ?? 'Director | Ada\nCast | Lin';
  return {
    id: overrides.id ?? 'credits-1',
    type: 'credits',
    name: overrides.name ?? 'Credits',
    trackId: overrides.trackId ?? 'track-text',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 5,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...overrides.colorCorrection },
    ...buildColorNodeGraphPatch(overrides.colorNodeGraph),
    transform: { ...DEFAULT_TRANSFORM, ...overrides.transform },
    chromaKey: normalizeChromaKey(overrides.chromaKey),
    stabilization: normalizeStabilization(overrides.stabilization),
    frameInterpolation: normalizeFrameInterpolation(overrides.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(overrides.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(overrides.audioDenoise),
    audioRestoration: normalizeAudioRestoration(overrides.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(overrides.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(overrides.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(overrides.qualityEnhancement),
    masks: normalizeMasks(overrides.masks),
    motionTrack: normalizeMotionTrack(overrides.motionTrack, overrides.duration ?? 5),
    border: overrides.border,
    sequenceFrameRate: normalizeSequenceFrameRate(overrides.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(overrides.blendMode),
    contentAnalysis: overrides.contentAnalysis,
    keyframes: overrides.keyframes,
    effects: overrides.effects,
    text,
    rows: normalizeCreditsRows(overrides.rows, text),
    rollSpeed: normalizeCreditsRollSpeed(overrides.rollSpeed ?? DEFAULT_CREDITS_ROLL_SPEED),
    style: normalizeCreditsStyle({ ...DEFAULT_CREDITS_STYLE, ...(overrides.style as Partial<CreditsStyle> | undefined) })
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
