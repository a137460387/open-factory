import {
  DEFAULT_COLOR_CURVES,
  DEFAULT_THREE_WAY_COLOR,
} from '../color-grading';
import { REC709_INPUT_COLOR_SPACE } from '../color-log-luts';
import { DEFAULT_PROJECT_COLOR_PIPELINE, normalizeProjectColorPipeline } from '../color-pipeline';
import { normalizeProjectWorkingColorSpace } from '../color-management';
import { normalizeProjectFps, normalizeTimecodeFormat } from '../time';
import type {
  AudioFadeCurve,
  ChromaKey,
  ClipAudioDenoise,
  ClipAILocalDenoise,
  ClipBorder,
  ClipFrameInterpolation,
  ClipPanoramaView,
  ClipPrivacyBlur,
  ClipProjection,
  ClipQualityEnhancement,
  ClipSlowMotionMode,
  ClipStabilization,
  ClipVideoTemporalDenoise,
  ClipVideoRestoration,
  FrameInterpolationMode,
  FrameInterpolationTargetFps,
  PathPoint,
  ProjectSettings,
  SubtitleLanguage,
  SubtitleMode,
  SubtitleStyle,
  SubtitleTrackType,
  TextStyle,
  TextPathOptions,
  TrackCompressor,
  TrackEQ,
  TransitionType,
  VfrHandlingStrategy,
  VideoDenoisePreset,
} from '../model-types';

export const MAX_CHROMA_KEY_COLORS = 3;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  fps: 30,
  timecodeFormat: 'ndf',
  width: 1280,
  height: 720,
  vfrHandling: 'ignore',
  colorPipeline: DEFAULT_PROJECT_COLOR_PIPELINE,
  workingColorSpace: 'srgb',
};

export function normalizeProjectSettings(settings: Partial<ProjectSettings> | undefined): ProjectSettings {
  const fps = normalizeProjectFps(settings?.fps);
  const width = Number.isFinite(settings?.width)
    ? Math.max(1, Math.round(settings!.width!))
    : DEFAULT_PROJECT_SETTINGS.width;
  const height = Number.isFinite(settings?.height)
    ? Math.max(1, Math.round(settings!.height!))
    : DEFAULT_PROJECT_SETTINGS.height;
  return {
    fps,
    timecodeFormat: normalizeTimecodeFormat(settings?.timecodeFormat, fps),
    width,
    height,
    vfrHandling: normalizeVfrHandlingStrategy(settings?.vfrHandling),
    colorPipeline: normalizeProjectColorPipeline(settings?.colorPipeline),
    workingColorSpace: normalizeProjectWorkingColorSpace(settings?.workingColorSpace),
  };
}

export function normalizeVfrHandlingStrategy(value: unknown): VfrHandlingStrategy {
  return value === 'auto-cfr' || value === 'ask' ? value : 'ignore';
}

export const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
};

export const DEFAULT_COLOR_CORRECTION = {
  inputColorSpace: REC709_INPUT_COLOR_SPACE,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  lutPath: null,
  luts: [],
  colorCurves: DEFAULT_COLOR_CURVES,
  threeWayColor: DEFAULT_THREE_WAY_COLOR,
};

export const DEFAULT_CHROMA_KEY: ChromaKey = {
  enabled: false,
  mode: 'chroma-key',
  color: [0, 255, 0],
  colors: [[0, 255, 0]],
  similarity: 0.1,
  blend: 0.05,
  spillSuppression: false,
  erosion: 0,
  lumaThreshold: 0.4,
  lumaTolerance: 0.1,
  lumaSoftness: 0.05,
  differenceReferenceTime: 0,
  differenceThreshold: 0.2,
};

export const DEFAULT_STABILIZATION: ClipStabilization = {
  enabled: false,
  smoothing: 30,
  zoom: 0,
  analyzed: false,
  trfPath: null,
};

export const FRAME_INTERPOLATION_TARGET_FPS: readonly FrameInterpolationTargetFps[] = [24, 30, 48, 60, 120];
export const FRAME_INTERPOLATION_MODES: readonly FrameInterpolationMode[] = ['adaptive', 'blend', 'mci', 'copy'];

export const DEFAULT_FRAME_INTERPOLATION: ClipFrameInterpolation = {
  enabled: false,
  targetFps: 60,
  mode: 'adaptive',
  protectionFrames: 2,
};

export const CLIP_SLOW_MOTION_MODES: readonly ClipSlowMotionMode[] = ['none', 'blend', 'mci', 'optical-flow'];
export const DEFAULT_SLOW_MOTION_MODE: ClipSlowMotionMode = 'none';
export const DEFAULT_CLIP_PROJECTION: ClipProjection = 'flat';
export const DEFAULT_CLIP_PANORAMA_VIEW: ClipPanoramaView = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 90,
  outputProjection: 'flat',
};
export const VIDEO_TEMPORAL_DENOISE_PRESETS: Record<
  Exclude<VideoDenoisePreset, 'off' | 'custom'>,
  ClipVideoTemporalDenoise
> = {
  low: { preset: 'low', lumaSpatial: 2, chromaSpatial: 1.5, lumaTmp: 3 },
  medium: { preset: 'medium', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
  high: { preset: 'high', lumaSpatial: 6, chromaSpatial: 4.5, lumaTmp: 9 },
};
export const DEFAULT_VIDEO_RESTORATION: ClipVideoRestoration = {
  deinterlace: { enabled: false, mode: 0 },
  temporalDenoise: {
    preset: 'off',
    lumaSpatial: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.lumaSpatial,
    chromaSpatial: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.chromaSpatial,
    lumaTmp: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.lumaTmp,
  },
  spatialDenoise: { enabled: false, strength: 1.5, patchSize: 7, researchSize: 15 },
};

export const DEFAULT_QUALITY_ENHANCEMENT: ClipQualityEnhancement = {
  superResolution: false,
  deblock: false,
  colorBoost: false,
  frameCompensation: false,
};

export const DEFAULT_AUDIO_DENOISE: ClipAudioDenoise = {
  enabled: false,
  strength: 0.5,
};

export const DEFAULT_AI_LOCAL_DENOISE: ClipAILocalDenoise = {
  enabled: false,
  strength: 0.5,
};

export const DEFAULT_AUDIO_PITCH_SEMITONES = 0;
export const DEFAULT_AUDIO_REVERSE = false;
export const DEFAULT_AUDIO_FADE_CURVE: AudioFadeCurve = 'linear';
export const DEFAULT_AUDIO_FADE_DURATION = 0;

export const DEFAULT_MASK = {
  type: 'rect' as const,
  x: 0.25,
  y: 0.25,
  w: 0.5,
  h: 0.5,
  inverted: false,
  feather: 0,
  enabled: true,
};
export const DEFAULT_PRIVACY_BLUR: ClipPrivacyBlur = {
  enabled: false,
  effect: 'pixelize',
  color: '#000000',
};

export const DEFAULT_CLIP_BORDER: ClipBorder = {
  enabled: false,
  color: '#ffffff',
  width: 6,
};

export const DEFAULT_TRACK_VOLUME = 1;
export const DEFAULT_TRACK_PAN = 0;
export const DEFAULT_MASTER_VOLUME = 1;
export const DEFAULT_TRACK_EQ: TrackEQ = {
  enabled: true,
  bands: [
    { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: 0, q: 0.7 },
    { id: 'eq-low-mid', type: 'peaking', frequency: 400, gain: 0, q: 1 },
    { id: 'eq-high-mid', type: 'peaking', frequency: 2500, gain: 0, q: 1 },
    { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 0, q: 0.7 },
  ],
};
export const DEFAULT_TRACK_COMPRESSOR: TrackCompressor = {
  enabled: false,
  threshold: -18,
  ratio: 3,
  attack: 10,
  release: 120,
  makeupGain: 0,
};
export const PRIMARY_SEQUENCE_ID = 'sequence-main';
export const DEFAULT_PRIMARY_SEQUENCE_NAME = 'Main Sequence';
export const DEFAULT_NESTED_SEQUENCE_NAME = 'Nested Sequence';
export const MAX_NESTED_SEQUENCE_DEPTH = 3;
export const DEFAULT_TRANSITION_TYPE: TransitionType = 'dissolve';
export const DEFAULT_TRANSITION_DURATION = 0.5;
export const MIN_TRANSITION_DURATION = 0.1;
export const MAX_TRANSITION_DURATION = 5;
export const TRANSITION_TYPES: TransitionType[] = [
  'dissolve',
  'fade-black',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
  'zoom-dissolve',
  'flash-white',
  'flash-black',
  'block',
  'rotate',
  'film-roll-open',
  'film-roll-close',
  'shape-heart',
  'shape-star',
  'motion-blur-wipe',
  'push-left',
  'push-right',
  'push-up',
  'push-down',
  'light-leak',
  'glitch',
  'flip-horizontal',
  'flip-vertical',
  'cube-rotate',
  'portal',
];
export const DEFAULT_TIMELINE_MARKER_COLOR = '#f97316';
export const DEFAULT_PROJECT_ANNOTATION_COLOR = '#facc15';
export const DEFAULT_REVIEW_ANNOTATION_COLOR = '#facc15';
export const DEFAULT_COLLABORATION_NOTE_AUTHOR = 'Collaborator';
export const DEFAULT_COLLABORATION_NOTE_COLOR = '#38bdf8';
export const PROJECT_ANNOTATION_COLORS = ['#facc15', '#38bdf8', '#34d399', '#fb7185', '#a78bfa'] as const;
export const TIMELINE_NOTE_COLORS = ['#facc15', '#38bdf8', '#34d399', '#fb7185', '#a78bfa', '#fb923c'] as const;
export const DEFAULT_TIMELINE_NOTE_COLOR = TIMELINE_NOTE_COLORS[0];

export const MIN_CLIP_SPEED = 0.25;
export const MAX_CLIP_SPEED = 4;
export const DEFAULT_CLIP_SPEED = 1;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 48,
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  fontFamily: 'Inter, Arial, sans-serif',
  bold: false,
  italic: false,
};

export const DEFAULT_TEXT_PATH_POINTS: PathPoint[] = [
  { x: 0.14, y: 0.58, handleOut: { x: 0.28, y: 0.28 } },
  { x: 0.5, y: 0.36, handleIn: { x: 0.36, y: 0.22 }, handleOut: { x: 0.64, y: 0.22 } },
  { x: 0.86, y: 0.58, handleIn: { x: 0.72, y: 0.28 } },
];

export const DEFAULT_TEXT_PATH: TextPathOptions = {
  enabled: false,
  path: DEFAULT_TEXT_PATH_POINTS,
  startOffset: 0,
  letterSpacing: 4,
  rotateCharacters: true,
};

export const DEFAULT_SUBTITLE_MODE: SubtitleMode = 'burn-in';
export const DEFAULT_SUBTITLE_LANGUAGE = 'zh';
export const DEFAULT_SUBTITLE_TRACK_TYPE: SubtitleTrackType = 'subtitle';

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 42,
  backgroundOpacity: 0.55,
  yOffset: 72,
  outlineColor: '#000000',
  outlineWidth: 0,
  shadowColor: '#000000',
  shadowOffset: 0,
};
