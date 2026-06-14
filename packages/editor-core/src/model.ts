import {
  DEFAULT_COLOR_CURVES,
  DEFAULT_THREE_WAY_COLOR,
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeColorCurves,
  normalizeThreeWayColor,
  type ColorCurves,
  type ThreeWayColor
} from './color-grading';
import { REC709_INPUT_COLOR_SPACE, normalizeInputColorSpace, type InputColorSpace } from './color-log-luts';
import { cloneEffects, type Effect } from './effects';
import type { BeatMarker } from './beats';
import { normalizePathPoints } from './masks/path-mask';
import { migrateProjectFile, serializeProjectFile } from './project/project-migration';
import type { ProjectFile } from './project/project-types';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from './timeline-color-labels';
import { normalizeProjectFps, normalizeTimecodeFormat, round, type TimecodeFormat } from './time';

export type ProjectVersion = '0.2';
export type AssetType = 'video' | 'audio' | 'image';
export type TrackType = 'video' | 'audio' | 'text' | 'subtitle';
export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'nested-sequence' | 'adjustment';
export type TransitionType = 'fade-black' | 'dissolve';
export type SubtitleMode = 'burn-in' | 'soft-sub';
export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type AudioFadeCurve = Extract<KeyframeEasing, 'linear' | 'ease-in' | 'ease-out'>;

export interface Keyframe<T> {
  id: string;
  time: number;
  value: T;
  easing: KeyframeEasing;
}

export interface ClipKeyframes {
  opacity?: Keyframe<number>[];
  volume?: Keyframe<number>[];
  x?: Keyframe<number>[];
  y?: Keyframe<number>[];
  scaleX?: Keyframe<number>[];
  scaleY?: Keyframe<number>[];
  speed?: Keyframe<number>[];
  yaw?: Keyframe<number>[];
  pitch?: Keyframe<number>[];
  roll?: Keyframe<number>[];
  pathStartOffset?: Keyframe<number>[];
}

export type KeyframeProperty = keyof ClipKeyframes;

export type ChromaKeyColor = [number, number, number];
export const MAX_CHROMA_KEY_COLORS = 3;
export type ChromaKeyMode = 'chroma-key' | 'luma-key' | 'difference-matte';
export type MaskType = 'rect' | 'ellipse' | 'path';
export type PrivacyBlurEffect = 'pixelize' | 'gblur' | 'solid';

export interface ChromaKey {
  enabled: boolean;
  mode: ChromaKeyMode;
  color: ChromaKeyColor;
  colors: ChromaKeyColor[];
  similarity: number;
  blend: number;
  spillSuppression: boolean;
  erosion: number;
  lumaThreshold: number;
  lumaTolerance: number;
  lumaSoftness: number;
  differenceReferenceTime: number;
  differenceThreshold: number;
}

export interface ClipStabilization {
  enabled: boolean;
  smoothing: number;
  zoom: number;
  analyzed: boolean;
  trfPath?: string | null;
}

export type FrameInterpolationTargetFps = 24 | 30 | 48 | 60 | 120;

export interface ClipFrameInterpolation {
  enabled: boolean;
  targetFps: FrameInterpolationTargetFps;
}

export type ClipSlowMotionMode = 'none' | 'blend' | 'optical-flow';
export type ClipProjection = 'flat' | 'equirectangular' | 'cubemap';
export type ClipPanoramaOutputProjection = 'flat' | 'equirectangular';
export type VideoDenoisePreset = 'off' | 'low' | 'medium' | 'high' | 'custom';
export type VideoDeinterlaceMode = 0 | 1;

export interface ClipPanoramaView {
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  outputProjection: ClipPanoramaOutputProjection;
}

export interface ClipVideoDeinterlace {
  enabled: boolean;
  mode: VideoDeinterlaceMode;
}

export interface ClipVideoTemporalDenoise {
  preset: VideoDenoisePreset;
  lumaSpatial: number;
  chromaSpatial: number;
  lumaTmp: number;
}

export interface ClipVideoSpatialDenoise {
  enabled: boolean;
  strength: number;
  patchSize: number;
  researchSize: number;
}

export interface ClipVideoRestoration {
  deinterlace: ClipVideoDeinterlace;
  temporalDenoise: ClipVideoTemporalDenoise;
  spatialDenoise: ClipVideoSpatialDenoise;
}

export interface MotionTrackPoint {
  time: number;
  dx: number;
  dy: number;
}

export interface PathPointHandle {
  x: number;
  y: number;
}

export interface PathPoint {
  x: number;
  y: number;
  handleIn?: PathPointHandle;
  handleOut?: PathPointHandle;
}

export interface ClipMaskKeyframe {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClipPrivacyBlur {
  enabled: boolean;
  effect: PrivacyBlurEffect;
  color?: string;
}

export interface ClipMask {
  id: string;
  type: MaskType;
  x: number;
  y: number;
  w: number;
  h: number;
  path?: PathPoint[];
  keyframes?: ClipMaskKeyframe[];
  privacyBlur?: ClipPrivacyBlur;
  inverted: boolean;
  feather: number;
  enabled: boolean;
}

export type Mask = ClipMask;

export interface Project {
  version: ProjectVersion;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  masterVolume: number;
  settings: ProjectSettings;
  media: MediaAsset[];
  mediaFolders: MediaFolder[];
  mediaMetadata: Record<string, MediaMetadata>;
  annotations: ProjectAnnotation[];
  beatMarkers: BeatMarker[];
  exportRanges: ExportRange[];
  clipGroups: ClipGroup[];
  timeline: Timeline;
  sequences: Sequence[];
  activeSequenceId: string;
}

export interface ProjectSettings {
  fps: number;
  timecodeFormat: TimecodeFormat;
  width: number;
  height: number;
  vfrHandling?: VfrHandlingStrategy;
}

export type VfrHandlingStrategy = 'ignore' | 'auto-cfr' | 'ask';

export interface MediaAsset {
  id: string;
  type: AssetType;
  name: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  missing?: boolean;
  folderId?: string | null;
  importedAt?: string;
  thumbnail?: string;
  relativePath?: string | null;
  originalAbsolutePath?: string;
  size?: number;
  mtimeMs?: number;
  cacheKey?: string;
  thumbnailCachePath?: string;
  waveformCachePath?: string;
  hasAudio?: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  audioCodec?: string;
  videoCodec?: string;
  frameRate?: number;
  avgFrameRate?: string;
  realFrameRate?: string;
  variableFrameRate?: boolean;
  fieldOrder?: string;
  proxyPath?: string;
  proxyStatus?: 'none' | 'pending' | 'ready' | 'error';
  proxyError?: string;
  imageSequence?: ImageSequenceInfo;
}

export interface ImageSequenceInfo {
  pattern: string;
  startNumber: number;
  frameCount: number;
  frameRate: number;
  paths: string[];
}

export type MediaLabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type MediaFlag = 'green' | 'red';

export interface MediaMetadata {
  labelColor?: MediaLabelColor;
  rating?: number;
  flag?: MediaFlag;
}

export function isMediaLabelColor(value: unknown): value is MediaLabelColor {
  return value === 'red' || value === 'orange' || value === 'yellow' || value === 'green' || value === 'blue' || value === 'purple';
}

export function normalizeMediaRating(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(5, Math.max(0, Math.round(numeric)));
}

export function normalizeMediaFlag(value: unknown): MediaFlag | undefined {
  return value === 'green' || value === 'red' ? value : undefined;
}

export function normalizeMediaMetadataEntry(metadata: MediaMetadata | undefined): MediaMetadata | undefined {
  const labelColor = isMediaLabelColor(metadata?.labelColor) ? metadata.labelColor : undefined;
  const rating = normalizeMediaRating(metadata?.rating);
  const flag = normalizeMediaFlag(metadata?.flag);
  const normalized: MediaMetadata = {};
  if (labelColor) {
    normalized.labelColor = labelColor;
  }
  if (rating > 0) {
    normalized.rating = rating;
  }
  if (flag) {
    normalized.flag = flag;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export interface ProjectAnnotation {
  id: string;
  time: number;
  text: string;
  color: string;
}

export interface ExportRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

export type ClipGroupColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'cyan';

export interface ClipGroup {
  id: string;
  name: string;
  clipIds: string[];
  color: ClipGroupColor;
}

export interface Timeline {
  tracks: Track[];
  transitions?: Transition[];
  markers?: TimelineMarker[];
}

export interface Sequence {
  id: string;
  name: string;
  timeline: Timeline;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  color?: TimelineLabelColor | null;
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  volume?: number;
  pan?: number;
  eq?: TrackEQ;
  compressor?: TrackCompressor;
  clips: Clip[];
}

export type TrackEQBandType = 'lowshelf' | 'peaking' | 'highshelf';

export interface TrackEQBand {
  id: string;
  type: TrackEQBandType;
  frequency: number;
  gain: number;
  q: number;
}

export interface TrackEQ {
  enabled: boolean;
  bands: TrackEQBand[];
}

export interface TrackCompressor {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
}

export type Clip = VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip | NestedSequenceClip | AdjustmentClip;
export type AudioChannelRoutingMode =
  | 'normal'
  | 'mono-left'
  | 'mono-right'
  | 'mono-both'
  | 'swap-stereo'
  | 'stereo-left-mono'
  | 'stereo-right-mono'
  | 'stereo-to-mono';

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface BaseClip {
  id: string;
  name: string;
  trackId: string;
  colorLabel?: TimelineLabelColor | null;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  colorCorrection: ColorCorrection;
  transform: Transform;
  chromaKey?: ChromaKey;
  stabilization?: ClipStabilization;
  frameInterpolation?: ClipFrameInterpolation;
  slowMotionMode?: ClipSlowMotionMode;
  audioDenoise?: ClipAudioDenoise;
  audioChannelRouting?: AudioChannelRoutingMode;
  videoRestoration?: ClipVideoRestoration;
  projection?: ClipProjection;
  panorama?: ClipPanoramaView;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: ClipBorder;
  keyframes?: ClipKeyframes;
  effects?: Effect[];
  sequenceFrameRate?: number;
}

export interface ClipAudioDenoise {
  enabled: boolean;
  strength: number;
}

export interface ColorCorrection {
  inputColorSpace?: InputColorSpace;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  lutPath?: string | null;
  colorCurves?: ColorCurves;
  threeWayColor?: ThreeWayColor;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  opacity: number;
}

export interface ClipBorder {
  enabled: boolean;
  color: string;
  width: number;
}

export interface VideoClip extends BaseClip {
  type: 'video';
  mediaId: string;
  volume: number;
  muted?: boolean;
  pitchSemitones?: number;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  mediaId: string;
  volume: number;
  muted?: boolean;
  pitchSemitones?: number;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
}

export interface ImageClip extends BaseClip {
  type: 'image';
  mediaId: string;
  kenBurns?: boolean;
}

export interface TextClip extends BaseClip {
  type: 'text';
  text: string;
  style: TextStyle;
  pathText?: TextPathOptions;
}

export interface SubtitleClip extends BaseClip {
  type: 'subtitle';
  text: string;
  style: SubtitleStyle;
  subtitleMode: SubtitleMode;
}

export interface NestedSequenceClip extends BaseClip {
  type: 'nested-sequence';
  sequenceId: string;
  volume: number;
  muted?: boolean;
  pitchSemitones?: number;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
  multicam?: MulticamSequence;
}

export interface AdjustmentClip extends BaseClip {
  type: 'adjustment';
}

export interface MulticamSequence {
  angles: MulticamAngle[];
  switches: MulticamSwitch[];
}

export interface MulticamAngle {
  id: string;
  clipId: string;
  trackId: string;
  name: string;
  offset: number;
}

export interface MulticamSwitch {
  id: string;
  time: number;
  angleId: string;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export interface TextPathOptions {
  enabled: boolean;
  path: PathPoint[];
  startOffset: number;
  letterSpacing: number;
  rotateCharacters: boolean;
}

export interface SubtitleStyle extends TextStyle {
  yOffset: number;
}

export type CutProjectFile = ProjectFile;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  fps: 30,
  timecodeFormat: 'ndf',
  width: 1280,
  height: 720,
  vfrHandling: 'ignore'
};

export function normalizeProjectSettings(settings: Partial<ProjectSettings> | undefined): ProjectSettings {
  const fps = normalizeProjectFps(settings?.fps);
  const width = Number.isFinite(settings?.width) ? Math.max(1, Math.round(settings!.width!)) : DEFAULT_PROJECT_SETTINGS.width;
  const height = Number.isFinite(settings?.height) ? Math.max(1, Math.round(settings!.height!)) : DEFAULT_PROJECT_SETTINGS.height;
  return {
    fps,
    timecodeFormat: normalizeTimecodeFormat(settings?.timecodeFormat, fps),
    width,
    height,
    vfrHandling: normalizeVfrHandlingStrategy(settings?.vfrHandling)
  };
}

export function normalizeVfrHandlingStrategy(value: unknown): VfrHandlingStrategy {
  return value === 'auto-cfr' || value === 'ask' ? value : 'ignore';
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt: string;
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1
};

export const DEFAULT_COLOR_CORRECTION: ColorCorrection = {
  inputColorSpace: REC709_INPUT_COLOR_SPACE,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  lutPath: null,
  colorCurves: DEFAULT_COLOR_CURVES,
  threeWayColor: DEFAULT_THREE_WAY_COLOR
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
  differenceThreshold: 0.2
};

export const DEFAULT_STABILIZATION: ClipStabilization = {
  enabled: false,
  smoothing: 30,
  zoom: 0,
  analyzed: false,
  trfPath: null
};

export const FRAME_INTERPOLATION_TARGET_FPS: readonly FrameInterpolationTargetFps[] = [24, 30, 48, 60, 120];

export const DEFAULT_FRAME_INTERPOLATION: ClipFrameInterpolation = {
  enabled: false,
  targetFps: 60
};

export const CLIP_SLOW_MOTION_MODES: readonly ClipSlowMotionMode[] = ['none', 'blend', 'optical-flow'];
export const DEFAULT_SLOW_MOTION_MODE: ClipSlowMotionMode = 'none';
export const DEFAULT_CLIP_PROJECTION: ClipProjection = 'flat';
export const DEFAULT_CLIP_PANORAMA_VIEW: ClipPanoramaView = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 90,
  outputProjection: 'flat'
};
export const VIDEO_TEMPORAL_DENOISE_PRESETS: Record<Exclude<VideoDenoisePreset, 'off' | 'custom'>, ClipVideoTemporalDenoise> = {
  low: { preset: 'low', lumaSpatial: 2, chromaSpatial: 1.5, lumaTmp: 3 },
  medium: { preset: 'medium', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
  high: { preset: 'high', lumaSpatial: 6, chromaSpatial: 4.5, lumaTmp: 9 }
};
export const DEFAULT_VIDEO_RESTORATION: ClipVideoRestoration = {
  deinterlace: { enabled: false, mode: 0 },
  temporalDenoise: { preset: 'off', lumaSpatial: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.lumaSpatial, chromaSpatial: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.chromaSpatial, lumaTmp: VIDEO_TEMPORAL_DENOISE_PRESETS.medium.lumaTmp },
  spatialDenoise: { enabled: false, strength: 1.5, patchSize: 7, researchSize: 15 }
};

export const DEFAULT_AUDIO_DENOISE: ClipAudioDenoise = {
  enabled: false,
  strength: 0.5
};
export const DEFAULT_AUDIO_PITCH_SEMITONES = 0;
export const DEFAULT_AUDIO_REVERSE = false;
export const DEFAULT_AUDIO_FADE_CURVE: AudioFadeCurve = 'linear';
export const DEFAULT_AUDIO_FADE_DURATION = 0;

export const DEFAULT_MASK: Omit<ClipMask, 'id'> = {
  type: 'rect',
  x: 0.25,
  y: 0.25,
  w: 0.5,
  h: 0.5,
  inverted: false,
  feather: 0,
  enabled: true
};
export const DEFAULT_PRIVACY_BLUR: ClipPrivacyBlur = {
  enabled: false,
  effect: 'pixelize',
  color: '#000000'
};

export const DEFAULT_CLIP_BORDER: ClipBorder = {
  enabled: false,
  color: '#ffffff',
  width: 6
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
    { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 0, q: 0.7 }
  ]
};
export const DEFAULT_TRACK_COMPRESSOR: TrackCompressor = {
  enabled: false,
  threshold: -18,
  ratio: 3,
  attack: 10,
  release: 120,
  makeupGain: 0
};
export const PRIMARY_SEQUENCE_ID = 'sequence-main';
export const DEFAULT_PRIMARY_SEQUENCE_NAME = 'Main Sequence';
export const DEFAULT_NESTED_SEQUENCE_NAME = 'Nested Sequence';
export const MAX_NESTED_SEQUENCE_DEPTH = 3;
export const DEFAULT_TRANSITION_TYPE: TransitionType = 'dissolve';
export const DEFAULT_TRANSITION_DURATION = 0.5;
export const DEFAULT_TIMELINE_MARKER_COLOR = '#f97316';
export const DEFAULT_PROJECT_ANNOTATION_COLOR = '#facc15';
export const PROJECT_ANNOTATION_COLORS = ['#facc15', '#38bdf8', '#34d399', '#fb7185', '#a78bfa'] as const;

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
  italic: false
};

export const DEFAULT_TEXT_PATH_POINTS: PathPoint[] = [
  { x: 0.14, y: 0.58, handleOut: { x: 0.28, y: 0.28 } },
  { x: 0.5, y: 0.36, handleIn: { x: 0.36, y: 0.22 }, handleOut: { x: 0.64, y: 0.22 } },
  { x: 0.86, y: 0.58, handleIn: { x: 0.72, y: 0.28 } }
];

export const DEFAULT_TEXT_PATH: TextPathOptions = {
  enabled: false,
  path: DEFAULT_TEXT_PATH_POINTS,
  startOffset: 0,
  letterSpacing: 4,
  rotateCharacters: true
};

export const DEFAULT_SUBTITLE_MODE: SubtitleMode = 'burn-in';

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 42,
  backgroundOpacity: 0.55,
  yOffset: 72
};

export function createId(prefix = 'id'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createDefaultTimeline(): Timeline {
  return {
    markers: [],
    transitions: [],
    tracks: [
      createTrack({ id: createId('track'), type: 'video', name: 'Video 1', clips: [] }),
      createTrack({ id: createId('track'), type: 'audio', name: 'Audio 1', clips: [] }),
      createTrack({ id: createId('track'), type: 'text', name: 'Text 1', clips: [] })
    ]
  };
}

export function createTransition(
  transition: Omit<Transition, 'id' | 'type' | 'duration'> & Partial<Pick<Transition, 'id' | 'type' | 'duration'>>
): Transition {
  return {
    id: transition.id ?? createId('transition'),
    type: normalizeTransitionType(transition.type),
    duration: normalizeTransitionDuration(transition.duration),
    fromClipId: transition.fromClipId,
    toClipId: transition.toClipId
  };
}

export function createTimelineMarker(
  marker: Omit<TimelineMarker, 'id' | 'label' | 'color'> & Partial<Pick<TimelineMarker, 'id' | 'label' | 'color'>>,
  maxTime?: number
): TimelineMarker {
  return {
    id: marker.id ?? createId('marker'),
    time: normalizeTimelineMarkerTime(marker.time, maxTime),
    label: normalizeTimelineMarkerLabel(marker.label),
    color: normalizeTimelineMarkerColor(marker.color)
  };
}

export function createProjectAnnotation(
  annotation: Omit<ProjectAnnotation, 'id' | 'text' | 'color'> & Partial<Pick<ProjectAnnotation, 'id' | 'text' | 'color'>>,
  maxTime?: number
): ProjectAnnotation {
  return {
    id: annotation.id ?? createId('annotation'),
    time: normalizeTimelinePointTime(annotation.time, maxTime),
    text: normalizeProjectAnnotationText(annotation.text),
    color: normalizeHexColor(annotation.color, DEFAULT_PROJECT_ANNOTATION_COLOR)
  };
}

export function createExportRange(
  range: Omit<ExportRange, 'id' | 'label'> & Partial<Pick<ExportRange, 'id' | 'label'>>,
  maxTime?: number
): ExportRange {
  const start = normalizeTimelinePointTime(range.start, maxTime);
  const end = normalizeTimelinePointTime(range.end, maxTime);
  return {
    id: range.id ?? createId('export-range'),
    label: normalizeExportRangeLabel(range.label),
    start: round(Math.min(start, end)),
    end: round(Math.max(start, end))
  };
}

export function createTrack(
  track: Omit<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'> &
    Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>
): Track {
  return {
    ...track,
    color: normalizeTimelineLabelColor(track.color),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    locked: Boolean(track.locked),
    volume: normalizeTrackVolume(track.volume),
    pan: normalizeTrackPan(track.pan),
    eq: normalizeTrackEQ(track.eq),
    compressor: normalizeTrackCompressor(track.compressor)
  };
}

export function createProject(name = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  const timeline = createDefaultTimeline();
  return {
    version: '0.2',
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    masterVolume: DEFAULT_MASTER_VOLUME,
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    media: [],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    beatMarkers: [],
    exportRanges: [],
    clipGroups: [],
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID
  };
}

export function createSequence(sequence: Omit<Sequence, 'id' | 'name'> & Partial<Pick<Sequence, 'id' | 'name'>>): Sequence {
  return {
    id: sequence.id ?? createId('sequence'),
    name: normalizeSequenceName(sequence.name),
    timeline: sequence.timeline
  };
}

export function createBaseClip(
  input: Omit<BaseClip, 'id' | 'transform' | 'speed' | 'colorCorrection'> &
    Partial<Pick<BaseClip, 'id' | 'transform' | 'speed' | 'colorCorrection'>>
): BaseClip {
  return {
    id: input.id ?? createId('clip'),
    name: input.name,
    trackId: input.trackId,
    start: round(Math.max(0, input.start)),
    duration: round(Math.max(0, input.duration)),
    colorLabel: normalizeTimelineLabelColor(input.colorLabel),
    trimStart: round(Math.max(0, input.trimStart)),
    trimEnd: round(Math.max(0, input.trimEnd)),
    speed: clampClipSpeed(input.speed),
    colorCorrection: normalizeColorCorrection(input.colorCorrection),
    transform: normalizeTransform(input.transform),
    chromaKey: normalizeChromaKey(input.chromaKey),
    stabilization: normalizeStabilization(input.stabilization),
    frameInterpolation: normalizeFrameInterpolation(input.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(input.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(input.audioDenoise),
    audioChannelRouting: normalizeAudioChannelRouting(input.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(input.videoRestoration),
    projection: normalizeClipProjection(input.projection),
    panorama: normalizeClipPanoramaView(input.panorama),
    masks: normalizeMasks(input.masks),
    motionTrack: normalizeMotionTrack(input.motionTrack, input.duration),
    border: normalizeClipBorder(input.border),
    keyframes: cloneClipKeyframesLocal(input.keyframes),
    effects: cloneEffects(input.effects),
    sequenceFrameRate: normalizeSequenceFrameRate(input.sequenceFrameRate)
  };
}

export function createNestedSequenceClip(
  input: Omit<NestedSequenceClip, 'id' | 'transform' | 'speed' | 'colorCorrection' | 'volume'> &
    Partial<Pick<NestedSequenceClip, 'id' | 'transform' | 'speed' | 'colorCorrection' | 'volume'>>
): NestedSequenceClip {
  return {
    ...createBaseClip(input),
    type: 'nested-sequence',
    sequenceId: input.sequenceId,
    volume: normalizeTrackVolume(input.volume),
    muted: input.muted,
    pitchSemitones: normalizeAudioPitchSemitones(input.pitchSemitones),
    reverseAudio: input.reverseAudio === true,
    fadeInDuration: normalizeAudioFadeDuration(input.fadeInDuration, input.duration),
    fadeOutDuration: normalizeAudioFadeDuration(input.fadeOutDuration, input.duration),
    fadeInCurve: normalizeAudioFadeCurve(input.fadeInCurve),
    fadeOutCurve: normalizeAudioFadeCurve(input.fadeOutCurve),
    multicam: normalizeMulticamSequence(input.multicam, input.duration)
  };
}

export function createAdjustmentClip(
  input: Omit<AdjustmentClip, 'id' | 'type' | 'transform' | 'speed' | 'colorCorrection'> &
    Partial<Pick<AdjustmentClip, 'id' | 'transform' | 'speed' | 'colorCorrection'>>
): AdjustmentClip {
  return {
    ...createBaseClip(input),
    type: 'adjustment'
  };
}

export function clampClipSpeed(speed: number | undefined): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) {
    return DEFAULT_CLIP_SPEED;
  }
  return round(Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, speed ?? DEFAULT_CLIP_SPEED)));
}

export function normalizeColorCorrection(colorCorrection: Partial<ColorCorrection> | undefined): ColorCorrection {
  return {
    inputColorSpace: normalizeInputColorSpace(colorCorrection?.inputColorSpace),
    brightness: round(Math.min(1, Math.max(-1, colorCorrection?.brightness ?? DEFAULT_COLOR_CORRECTION.brightness))),
    contrast: round(Math.min(2, Math.max(0, colorCorrection?.contrast ?? DEFAULT_COLOR_CORRECTION.contrast))),
    saturation: round(Math.min(2, Math.max(0, colorCorrection?.saturation ?? DEFAULT_COLOR_CORRECTION.saturation))),
    hue: round(Math.min(180, Math.max(-180, colorCorrection?.hue ?? DEFAULT_COLOR_CORRECTION.hue))),
    lutPath: normalizeLutPath(colorCorrection?.lutPath),
    colorCurves: normalizeColorCurves(colorCorrection?.colorCurves),
    threeWayColor: normalizeThreeWayColor(colorCorrection?.threeWayColor)
  };
}

export function normalizeChromaKey(chromaKey: Partial<ChromaKey> | undefined): ChromaKey {
  const colors = normalizeChromaKeyColors(chromaKey);
  const mode = normalizeChromaKeyMode(chromaKey?.mode);
  return {
    enabled: chromaKey?.enabled === true,
    mode,
    color: colors[0] ?? [...DEFAULT_CHROMA_KEY.color],
    colors,
    similarity: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.similarity, DEFAULT_CHROMA_KEY.similarity)))),
    blend: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.blend, DEFAULT_CHROMA_KEY.blend)))),
    spillSuppression: chromaKey?.spillSuppression === true,
    erosion: round(Math.min(5, Math.max(-5, finiteOrDefault(chromaKey?.erosion, DEFAULT_CHROMA_KEY.erosion)))),
    lumaThreshold: normalizeUnit(chromaKey?.lumaThreshold, DEFAULT_CHROMA_KEY.lumaThreshold),
    lumaTolerance: normalizeUnit(chromaKey?.lumaTolerance, DEFAULT_CHROMA_KEY.lumaTolerance),
    lumaSoftness: normalizeUnit(chromaKey?.lumaSoftness, DEFAULT_CHROMA_KEY.lumaSoftness),
    differenceReferenceTime: round(Math.max(0, finiteOrDefault(chromaKey?.differenceReferenceTime, DEFAULT_CHROMA_KEY.differenceReferenceTime))),
    differenceThreshold: normalizeUnit(chromaKey?.differenceThreshold, DEFAULT_CHROMA_KEY.differenceThreshold)
  };
}

export function isChromaKeyEnabled(chromaKey: Partial<ChromaKey> | undefined): boolean {
  return normalizeChromaKey(chromaKey).enabled;
}

export function normalizeStabilization(stabilization: Partial<ClipStabilization> | undefined): ClipStabilization {
  const trfPath = typeof stabilization?.trfPath === 'string' && stabilization.trfPath.trim() ? stabilization.trfPath.trim() : null;
  return {
    enabled: stabilization?.enabled === true,
    smoothing: Math.round(Math.min(100, Math.max(1, finiteOrDefault(stabilization?.smoothing, DEFAULT_STABILIZATION.smoothing)))),
    zoom: round(Math.min(5, Math.max(0, finiteOrDefault(stabilization?.zoom, DEFAULT_STABILIZATION.zoom)))),
    analyzed: stabilization?.analyzed === true,
    trfPath
  };
}

export function isStabilizationExportable(stabilization: Partial<ClipStabilization> | undefined): boolean {
  const normalized = normalizeStabilization(stabilization);
  return normalized.enabled && normalized.analyzed && Boolean(normalized.trfPath);
}

export function normalizeFrameInterpolation(frameInterpolation: Partial<ClipFrameInterpolation> | undefined): ClipFrameInterpolation {
  const targetFps = FRAME_INTERPOLATION_TARGET_FPS.includes(frameInterpolation?.targetFps as FrameInterpolationTargetFps)
    ? (frameInterpolation?.targetFps as FrameInterpolationTargetFps)
    : DEFAULT_FRAME_INTERPOLATION.targetFps;
  return {
    enabled: frameInterpolation?.enabled === true,
    targetFps
  };
}

export function normalizeSlowMotionMode(mode: ClipSlowMotionMode | string | undefined): ClipSlowMotionMode {
  return CLIP_SLOW_MOTION_MODES.includes(mode as ClipSlowMotionMode) ? (mode as ClipSlowMotionMode) : DEFAULT_SLOW_MOTION_MODE;
}

export function normalizeClipProjection(projection: ClipProjection | string | undefined): ClipProjection {
  return projection === 'equirectangular' || projection === 'cubemap' || projection === 'flat' ? projection : DEFAULT_CLIP_PROJECTION;
}

export function normalizeClipPanoramaView(panorama: Partial<ClipPanoramaView> | undefined): ClipPanoramaView {
  return {
    yaw: normalizePanoramaDegrees(panorama?.yaw, DEFAULT_CLIP_PANORAMA_VIEW.yaw),
    pitch: round(Math.min(90, Math.max(-90, finiteOrDefault(panorama?.pitch, DEFAULT_CLIP_PANORAMA_VIEW.pitch)))),
    roll: normalizePanoramaDegrees(panorama?.roll, DEFAULT_CLIP_PANORAMA_VIEW.roll),
    fov: round(Math.min(120, Math.max(60, finiteOrDefault(panorama?.fov, DEFAULT_CLIP_PANORAMA_VIEW.fov)))),
    outputProjection: panorama?.outputProjection === 'equirectangular' || panorama?.outputProjection === 'flat' ? panorama.outputProjection : DEFAULT_CLIP_PANORAMA_VIEW.outputProjection
  };
}

function normalizePanoramaDegrees(value: number | undefined, fallback: number): number {
  return round(Math.min(180, Math.max(-180, finiteOrDefault(value, fallback))));
}

export function normalizeVideoDenoisePreset(preset: VideoDenoisePreset | string | undefined): VideoDenoisePreset {
  return preset === 'low' || preset === 'medium' || preset === 'high' || preset === 'custom' || preset === 'off' ? preset : 'off';
}

export function normalizeVideoRestoration(restoration: Partial<ClipVideoRestoration> | undefined): ClipVideoRestoration {
  const preset = normalizeVideoDenoisePreset(restoration?.temporalDenoise?.preset);
  const presetValues = preset === 'low' || preset === 'medium' || preset === 'high' ? VIDEO_TEMPORAL_DENOISE_PRESETS[preset] : DEFAULT_VIDEO_RESTORATION.temporalDenoise;
  const temporalSource = preset === 'custom' ? restoration?.temporalDenoise : presetValues;
  return {
    deinterlace: {
      enabled: restoration?.deinterlace?.enabled === true,
      mode: restoration?.deinterlace?.mode === 1 ? 1 : 0
    },
    temporalDenoise: {
      preset,
      lumaSpatial: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.lumaSpatial, DEFAULT_VIDEO_RESTORATION.temporalDenoise.lumaSpatial)))),
      chromaSpatial: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.chromaSpatial, DEFAULT_VIDEO_RESTORATION.temporalDenoise.chromaSpatial)))),
      lumaTmp: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.lumaTmp, DEFAULT_VIDEO_RESTORATION.temporalDenoise.lumaTmp))))
    },
    spatialDenoise: {
      enabled: restoration?.spatialDenoise?.enabled === true,
      strength: round(Math.min(30, Math.max(0, finiteOrDefault(restoration?.spatialDenoise?.strength, DEFAULT_VIDEO_RESTORATION.spatialDenoise.strength)))),
      patchSize: normalizeOddKernel(restoration?.spatialDenoise?.patchSize, DEFAULT_VIDEO_RESTORATION.spatialDenoise.patchSize, 1, 99),
      researchSize: normalizeOddKernel(restoration?.spatialDenoise?.researchSize, DEFAULT_VIDEO_RESTORATION.spatialDenoise.researchSize, 1, 99)
    }
  };
}

export function suggestDeinterlaceMode(fieldOrder: string | null | undefined): VideoDeinterlaceMode | null {
  const normalized = fieldOrder?.trim().toLowerCase();
  if (!normalized || normalized === 'unknown' || normalized === 'progressive') {
    return null;
  }
  return normalized === 'tt' || normalized === 'bb' || normalized === 'tb' || normalized === 'bt' || normalized.includes('field') ? 0 : null;
}

function normalizeOddKernel(value: number | undefined, fallback: number, min: number, max: number): number {
  const rounded = Math.round(Math.min(max, Math.max(min, finiteOrDefault(value, fallback))));
  return rounded % 2 === 1 ? rounded : Math.min(max, rounded + 1);
}

export function normalizeMotionTrack(points: readonly Partial<MotionTrackPoint>[] | undefined, duration = Number.POSITIVE_INFINITY): MotionTrackPoint[] | undefined {
  if (!Array.isArray(points)) {
    return undefined;
  }
  const maxTime = typeof duration === 'number' && Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
  const normalized = points.flatMap((point) => {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.dx) || !Number.isFinite(point.dy)) {
      return [];
    }
    return [
      {
        time: round(Math.min(maxTime, Math.max(0, point.time!))),
        dx: round(Math.min(100_000, Math.max(-100_000, point.dx!))),
        dy: round(Math.min(100_000, Math.max(-100_000, point.dy!)))
      }
    ];
  });
  normalized.sort((left, right) => left.time - right.time || left.dx - right.dx || left.dy - right.dy);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeAudioDenoise(audioDenoise: Partial<ClipAudioDenoise> | undefined): ClipAudioDenoise {
  return {
    enabled: audioDenoise?.enabled === true,
    strength: round(Math.min(1, Math.max(0, finiteOrDefault(audioDenoise?.strength, DEFAULT_AUDIO_DENOISE.strength))))
  };
}

export function normalizeAudioChannelRouting(mode: AudioChannelRoutingMode | undefined): AudioChannelRoutingMode {
  return mode === 'mono-left' ||
    mode === 'mono-right' ||
    mode === 'mono-both' ||
    mode === 'swap-stereo' ||
    mode === 'stereo-left-mono' ||
    mode === 'stereo-right-mono' ||
    mode === 'stereo-to-mono'
    ? mode
    : 'normal';
}

export function normalizeAudioPitchSemitones(semitones: number | undefined): number {
  return round(Math.min(12, Math.max(-12, finiteOrDefault(semitones, DEFAULT_AUDIO_PITCH_SEMITONES))));
}

export function normalizeAudioFadeCurve(curve: AudioFadeCurve | undefined): AudioFadeCurve {
  return curve === 'ease-in' || curve === 'ease-out' || curve === 'linear' ? curve : DEFAULT_AUDIO_FADE_CURVE;
}

export function normalizeAudioFadeDuration(duration: number | undefined, clipDuration = Number.POSITIVE_INFINITY): number {
  const maxDuration = typeof clipDuration === 'number' && Number.isFinite(clipDuration) ? Math.max(0, clipDuration) : Number.POSITIVE_INFINITY;
  return round(Math.min(maxDuration, Math.max(0, finiteOrDefault(duration, DEFAULT_AUDIO_FADE_DURATION))));
}

export function createMask(mask: Partial<ClipMask> = {}): ClipMask {
  return normalizeMask({ ...mask, id: mask.id ?? createId('mask') });
}

export function normalizeMask(mask: Partial<ClipMask> | undefined): ClipMask {
  const w = normalizePositiveUnit(mask?.w, DEFAULT_MASK.w);
  const h = normalizePositiveUnit(mask?.h, DEFAULT_MASK.h);
  const type = mask?.type === 'ellipse' || mask?.type === 'path' ? mask.type : 'rect';
  const path = type === 'path' ? normalizePathPoints(mask?.path) : undefined;
  const keyframes = normalizeMaskKeyframes(mask?.keyframes);
  const privacyBlur = normalizePrivacyBlur(mask?.privacyBlur);
  return {
    id: typeof mask?.id === 'string' && mask.id.trim() ? mask.id : createId('mask'),
    type,
    x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(mask?.x, DEFAULT_MASK.x)))),
    y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(mask?.y, DEFAULT_MASK.y)))),
    w,
    h,
    ...(path ? { path } : {}),
    ...(keyframes ? { keyframes } : {}),
    ...(privacyBlur ? { privacyBlur } : {}),
    inverted: mask?.inverted === true,
    feather: normalizeUnit(mask?.feather, DEFAULT_MASK.feather),
    enabled: mask?.enabled !== false
  };
}

export function normalizeMasks(masks: ClipMask[] | undefined): ClipMask[] {
  return Array.isArray(masks) ? masks.map((mask) => normalizeMask(mask)) : [];
}

export function normalizeMaskKeyframes(keyframes: readonly Partial<ClipMaskKeyframe>[] | undefined): ClipMaskKeyframe[] | undefined {
  if (!Array.isArray(keyframes)) {
    return undefined;
  }
  const normalized = keyframes.flatMap((keyframe) => {
    if (!Number.isFinite(keyframe.time)) {
      return [];
    }
    const w = normalizePositiveUnit(keyframe.w, DEFAULT_MASK.w);
    const h = normalizePositiveUnit(keyframe.h, DEFAULT_MASK.h);
    return [
      {
        time: round(Math.max(0, keyframe.time!)),
        x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(keyframe.x, DEFAULT_MASK.x)))),
        y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(keyframe.y, DEFAULT_MASK.y)))),
        w,
        h
      }
    ];
  });
  normalized.sort((left, right) => left.time - right.time || left.x - right.x || left.y - right.y);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizePrivacyBlur(privacyBlur: Partial<ClipPrivacyBlur> | undefined): ClipPrivacyBlur | undefined {
  if (privacyBlur?.enabled !== true) {
    return undefined;
  }
  return {
    enabled: true,
    effect: normalizePrivacyBlurEffect(privacyBlur.effect),
    color: typeof privacyBlur.color === 'string' && privacyBlur.color.trim() ? privacyBlur.color.trim() : DEFAULT_PRIVACY_BLUR.color
  };
}

export function normalizePrivacyBlurEffect(effect: PrivacyBlurEffect | undefined): PrivacyBlurEffect {
  return effect === 'gblur' || effect === 'solid' || effect === 'pixelize' ? effect : DEFAULT_PRIVACY_BLUR.effect;
}

export function normalizeClipBorder(border: Partial<ClipBorder> | undefined): ClipBorder {
  return {
    enabled: border?.enabled === true,
    color: normalizeHexColor(border?.color, DEFAULT_CLIP_BORDER.color),
    width: Math.round(Math.min(80, Math.max(1, finiteOrDefault(border?.width, DEFAULT_CLIP_BORDER.width))))
  };
}

export function normalizeTextPath(pathText: Partial<TextPathOptions> | undefined): TextPathOptions {
  const path = normalizePathPoints(pathText?.path);
  return {
    enabled: pathText?.enabled === true,
    path: path.length >= 2 ? path : DEFAULT_TEXT_PATH_POINTS.map((point) => clonePathPoint(point)),
    startOffset: normalizeUnit(pathText?.startOffset, DEFAULT_TEXT_PATH.startOffset),
    letterSpacing: round(Math.min(200, Math.max(0, finiteOrDefault(pathText?.letterSpacing, DEFAULT_TEXT_PATH.letterSpacing)))),
    rotateCharacters: pathText?.rotateCharacters !== false
  };
}

export function normalizeMulticamSequence(multicam: Partial<MulticamSequence> | undefined, duration = Number.POSITIVE_INFINITY): MulticamSequence | undefined {
  if (!multicam || !Array.isArray(multicam.angles) || multicam.angles.length < 2) {
    return undefined;
  }
  const angles = multicam.angles
    .map((angle, index) => ({
      id: typeof angle.id === 'string' && angle.id.trim() ? angle.id.trim() : `angle-${index + 1}`,
      clipId: typeof angle.clipId === 'string' ? angle.clipId : '',
      trackId: typeof angle.trackId === 'string' ? angle.trackId : '',
      name: typeof angle.name === 'string' && angle.name.trim() ? angle.name.trim() : `Camera ${index + 1}`,
      offset: round(finiteOrDefault(angle.offset, 0))
    }))
    .filter((angle) => angle.clipId && angle.trackId)
    .slice(0, 8);
  if (angles.length < 2) {
    return undefined;
  }
  const angleIds = new Set(angles.map((angle) => angle.id));
  const maxTime = Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
  const switches = (Array.isArray(multicam.switches) ? multicam.switches : [])
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createId('multicam-switch'),
      time: round(Math.min(maxTime, Math.max(0, finiteOrDefault(item.time, index === 0 ? 0 : maxTime)))),
      angleId: typeof item.angleId === 'string' && angleIds.has(item.angleId) ? item.angleId : angles[0].id
    }))
    .filter((item) => item.time <= maxTime)
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
  const byTime = new Map<number, MulticamSwitch>();
  for (const item of switches) {
    byTime.set(item.time, item);
  }
  if (!byTime.has(0)) {
    byTime.set(0, { id: createId('multicam-switch'), time: 0, angleId: angles[0].id });
  }
  return {
    angles,
    switches: Array.from(byTime.values()).sort((left, right) => left.time - right.time || left.id.localeCompare(right.id))
  };
}

export function normalizeSequenceFrameRate(frameRate: number | undefined): number | undefined {
  if (typeof frameRate !== 'number' || !Number.isFinite(frameRate)) {
    return undefined;
  }
  return round(Math.min(120, Math.max(1, frameRate)));
}

export function normalizeTimelineMarker(marker: TimelineMarker, maxTime?: number): TimelineMarker {
  return createTimelineMarker(marker, maxTime);
}

export function normalizeTransform(transform: Partial<Transform> | undefined): Transform {
  const legacyScale = clampTransformScale(transform?.scale, DEFAULT_TRANSFORM.scale);
  const rawScaleX = typeof transform?.scaleX === 'number' && Number.isFinite(transform.scaleX) ? transform.scaleX : undefined;
  const rawScaleY = typeof transform?.scaleY === 'number' && Number.isFinite(transform.scaleY) ? transform.scaleY : undefined;
  const clampedScaleX = clampTransformScale(rawScaleX, legacyScale);
  const clampedScaleY = clampTransformScale(rawScaleY, legacyScale);
  const staleUniformAxes =
    rawScaleX !== undefined &&
    rawScaleY !== undefined &&
    Math.abs(clampedScaleX - clampedScaleY) <= 0.000001 &&
    Math.abs(clampedScaleX - legacyScale) > 0.000001;
  const scaleX = staleUniformAxes ? legacyScale : clampedScaleX;
  const scaleY = staleUniformAxes ? legacyScale : clampedScaleY;
  return {
    x: round(finiteOrDefault(transform?.x, DEFAULT_TRANSFORM.x)),
    y: round(finiteOrDefault(transform?.y, DEFAULT_TRANSFORM.y)),
    scale: round((scaleX + scaleY) / 2),
    scaleX,
    scaleY,
    rotation: normalizeRotation(transform?.rotation),
    opacity: round(Math.min(1, Math.max(0, finiteOrDefault(transform?.opacity, DEFAULT_TRANSFORM.opacity))))
  };
}

export function normalizeRotation(rotation: number | undefined): number {
  return round(Math.min(180, Math.max(-180, finiteOrDefault(rotation, DEFAULT_TRANSFORM.rotation))));
}

export function getTransformScaleX(transform: Partial<Transform> | undefined): number {
  return normalizeTransform(transform).scaleX ?? DEFAULT_TRANSFORM.scaleX ?? DEFAULT_TRANSFORM.scale;
}

export function getTransformScaleY(transform: Partial<Transform> | undefined): number {
  return normalizeTransform(transform).scaleY ?? DEFAULT_TRANSFORM.scaleY ?? DEFAULT_TRANSFORM.scale;
}

function clampTransformScale(scale: number | undefined, fallback: number): number {
  return round(Math.min(4, Math.max(0.01, finiteOrDefault(scale, fallback))));
}

export function normalizeTimelineMarkers(markers: TimelineMarker[] | undefined, maxTime?: number): TimelineMarker[] {
  return [...(markers ?? [])]
    .map((marker) => normalizeTimelineMarker(marker, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeProjectAnnotation(annotation: ProjectAnnotation, maxTime?: number): ProjectAnnotation {
  return createProjectAnnotation(annotation, maxTime);
}

export function normalizeProjectAnnotations(annotations: ProjectAnnotation[] | undefined, maxTime?: number): ProjectAnnotation[] {
  return [...(annotations ?? [])]
    .map((annotation) => normalizeProjectAnnotation(annotation, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeExportRange(range: ExportRange, maxTime?: number): ExportRange | undefined {
  const normalized = createExportRange(range, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeExportRanges(ranges: ExportRange[] | undefined, maxTime?: number): ExportRange[] {
  return [...(ranges ?? [])]
    .flatMap((range) => {
      const normalized = normalizeExportRange(range, maxTime);
      return normalized ? [normalized] : [];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}

export function normalizeTrackVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) {
    return DEFAULT_TRACK_VOLUME;
  }
  return round(Math.min(2, Math.max(0, volume)));
}

export function normalizeTrackPan(pan: number | undefined): number {
  if (typeof pan !== 'number' || !Number.isFinite(pan)) {
    return DEFAULT_TRACK_PAN;
  }
  return round(Math.min(1, Math.max(-1, pan)));
}

export function normalizeTrackEQ(eq: Partial<TrackEQ> | undefined): TrackEQ {
  const inputBands = Array.isArray(eq?.bands) ? eq.bands : [];
  return {
    enabled: eq?.enabled !== false,
    bands: DEFAULT_TRACK_EQ.bands.map((fallback, index) => normalizeTrackEQBand(inputBands[index], fallback))
  };
}

export function normalizeTrackEQBand(band: Partial<TrackEQBand> | undefined, fallback: TrackEQBand = DEFAULT_TRACK_EQ.bands[1]): TrackEQBand {
  return {
    id: typeof band?.id === 'string' && band.id.trim() ? band.id : fallback.id,
    type: normalizeTrackEQBandType(band?.type, fallback.type),
    frequency: round(Math.min(20_000, Math.max(20, finiteOrDefault(band?.frequency, fallback.frequency)))),
    gain: round(Math.min(24, Math.max(-24, finiteOrDefault(band?.gain, fallback.gain)))),
    q: round(Math.min(4, Math.max(0.1, finiteOrDefault(band?.q, fallback.q))))
  };
}

export function normalizeTrackCompressor(compressor: Partial<TrackCompressor> | undefined): TrackCompressor {
  return {
    enabled: compressor?.enabled === true,
    threshold: round(Math.min(0, Math.max(-60, finiteOrDefault(compressor?.threshold, DEFAULT_TRACK_COMPRESSOR.threshold)))),
    ratio: round(Math.min(20, Math.max(1, finiteOrDefault(compressor?.ratio, DEFAULT_TRACK_COMPRESSOR.ratio)))),
    attack: round(Math.min(2000, Math.max(0.01, finiteOrDefault(compressor?.attack, DEFAULT_TRACK_COMPRESSOR.attack)))),
    release: round(Math.min(9000, Math.max(0.01, finiteOrDefault(compressor?.release, DEFAULT_TRACK_COMPRESSOR.release)))),
    makeupGain: round(Math.min(24, Math.max(0, finiteOrDefault(compressor?.makeupGain, DEFAULT_TRACK_COMPRESSOR.makeupGain))))
  };
}

export function normalizeMasterVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) {
    return DEFAULT_MASTER_VOLUME;
  }
  return round(Math.min(2, Math.max(0, volume)));
}

export function normalizeSequenceName(name: string | undefined): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || DEFAULT_NESTED_SEQUENCE_NAME;
}

export function getProjectSequences(project: Pick<Project, 'timeline' | 'sequences'>): Sequence[] {
  const sequences = project.sequences && project.sequences.length > 0 ? project.sequences : [];
  if (sequences.some((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)) {
    return sequences;
  }
  return [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline: project.timeline }, ...sequences];
}

export function getProjectActiveSequenceId(project: Pick<Project, 'activeSequenceId' | 'sequences' | 'timeline'>): string {
  const sequences = getProjectSequences(project);
  return sequences.some((sequence) => sequence.id === project.activeSequenceId) ? project.activeSequenceId : PRIMARY_SEQUENCE_ID;
}

export function getProjectPrimaryTimeline(project: Pick<Project, 'activeSequenceId' | 'timeline' | 'sequences'>): Timeline {
  const synced = replaceProjectActiveTimeline(project as Project, project.timeline);
  return getProjectSequences(synced).find((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)?.timeline ?? synced.timeline;
}

export function replaceProjectActiveTimeline(project: Project, timeline: Timeline): Project {
  const activeSequenceId = getProjectActiveSequenceId(project);
  const sequences = getProjectSequences(project).map((sequence) => (sequence.id === activeSequenceId ? { ...sequence, timeline } : sequence));
  return { ...project, timeline, sequences, activeSequenceId };
}

export function switchProjectActiveSequence(project: Project, sequenceId: string): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const target = getProjectSequences(synced).find((sequence) => sequence.id === sequenceId);
  if (!target) {
    return synced;
  }
  return { ...synced, timeline: target.timeline, activeSequenceId: target.id };
}

export function getNestedSequenceDepth(project: Project, sequenceId = PRIMARY_SEQUENCE_ID): number {
  const sequences = getProjectSequences(project);
  const sequence = sequences.find((item) => item.id === sequenceId);
  if (!sequence) {
    return 0;
  }
  return getNestedSequenceDepthForTimeline(project, sequence.timeline, new Set([sequenceId]));
}

export function isNestedSequenceDepthExceeded(project: Project, sequenceId = PRIMARY_SEQUENCE_ID, maxDepth = MAX_NESTED_SEQUENCE_DEPTH): boolean {
  return getNestedSequenceDepth(project, sequenceId) > maxDepth;
}

function normalizeTrackEQBandType(type: TrackEQBandType | undefined, fallback: TrackEQBandType): TrackEQBandType {
  return type === 'lowshelf' || type === 'peaking' || type === 'highshelf' ? type : fallback;
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRgbColor(color: ChromaKeyColor | readonly number[] | undefined): ChromaKeyColor {
  const input = Array.isArray(color) ? color : DEFAULT_CHROMA_KEY.color;
  return [normalizeRgbChannel(input[0]), normalizeRgbChannel(input[1]), normalizeRgbChannel(input[2])];
}

function normalizeChromaKeyColors(chromaKey: Partial<ChromaKey> | undefined): ChromaKeyColor[] {
  const candidates = Array.isArray(chromaKey?.colors) && chromaKey.colors.length > 0 ? chromaKey.colors : [chromaKey?.color ?? DEFAULT_CHROMA_KEY.color];
  const colors = candidates.slice(0, MAX_CHROMA_KEY_COLORS).map((color) => normalizeRgbColor(color));
  return colors.length > 0 ? colors : [[...DEFAULT_CHROMA_KEY.color]];
}

function normalizeChromaKeyMode(mode: ChromaKeyMode | undefined): ChromaKeyMode {
  return mode === 'luma-key' || mode === 'difference-matte' || mode === 'chroma-key' ? mode : DEFAULT_CHROMA_KEY.mode;
}

function normalizeRgbChannel(value: number | undefined): number {
  return Math.round(Math.min(255, Math.max(0, finiteOrDefault(value, 0))));
}

function clonePathPoint(point: PathPoint): PathPoint {
  return {
    x: point.x,
    y: point.y,
    handleIn: point.handleIn ? { ...point.handleIn } : undefined,
    handleOut: point.handleOut ? { ...point.handleOut } : undefined
  };
}

function normalizeUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}

function normalizePositiveUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}

function getNestedSequenceDepthForTimeline(project: Project, timeline: Timeline, visited: Set<string>): number {
  let depth = 0;
  for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
    if (clip.type !== 'nested-sequence') {
      continue;
    }
    if (visited.has(clip.sequenceId)) {
      return MAX_NESTED_SEQUENCE_DEPTH + 1;
    }
    const sequence = getProjectSequences(project).find((item) => item.id === clip.sequenceId);
    if (!sequence) {
      continue;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(clip.sequenceId);
    depth = Math.max(depth, 1 + getNestedSequenceDepthForTimeline(project, sequence.timeline, nextVisited));
  }
  return depth;
}

export function normalizeTransitionType(type: TransitionType | undefined): TransitionType {
  return type === 'fade-black' || type === 'dissolve' ? type : DEFAULT_TRANSITION_TYPE;
}

export function normalizeTransitionDuration(duration: number | undefined): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return DEFAULT_TRANSITION_DURATION;
  }
  return round(Math.max(0.001, duration));
}

export function isDefaultColorCorrection(colorCorrection: Partial<ColorCorrection> | undefined): boolean {
  const normalized = normalizeColorCorrection(colorCorrection);
  return (
    normalized.brightness === DEFAULT_COLOR_CORRECTION.brightness &&
    normalized.inputColorSpace === DEFAULT_COLOR_CORRECTION.inputColorSpace &&
    normalized.contrast === DEFAULT_COLOR_CORRECTION.contrast &&
    normalized.saturation === DEFAULT_COLOR_CORRECTION.saturation &&
    normalized.hue === DEFAULT_COLOR_CORRECTION.hue &&
    normalized.lutPath === DEFAULT_COLOR_CORRECTION.lutPath &&
    isDefaultColorCurves(normalized.colorCurves) &&
    isNeutralThreeWayColor(normalized.threeWayColor)
  );
}

export function serializeProject(project: Project, projectPath?: string): CutProjectFile {
  return serializeProjectFile(project, projectPath);
}

export function serializeLegacyProject(project: Project): {
  version: '0.1';
  project: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    settings: ProjectSettings;
  };
  assets: MediaAsset[];
  timeline: Timeline;
} {
  return {
    version: '0.1',
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
      settings: { ...project.settings }
    },
    assets: project.media.map((asset) => ({ ...asset })),
    timeline: {
      markers: project.timeline.markers?.map((marker) => ({ ...marker })) ?? [],
      transitions: project.timeline.transitions?.map((transition) => ({ ...transition })) ?? [],
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({
          ...clip,
          transform: { ...clip.transform },
          chromaKey: normalizeChromaKey(clip.chromaKey),
          stabilization: normalizeStabilization(clip.stabilization),
          audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
          videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
          projection: normalizeClipProjection(clip.projection),
          panorama: normalizeClipPanoramaView(clip.panorama),
          masks: normalizeMasks(clip.masks),
          motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
          border: normalizeClipBorder(clip.border),
          multicam: clip.type === 'nested-sequence' ? normalizeMulticamSequence(clip.multicam, clip.duration) : undefined,
          sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
          keyframes: cloneClipKeyframesLocal(clip.keyframes)
        }))
      }))
    }
  };
}

function normalizeTimelineMarkerTime(time: number, maxTime?: number): number {
  return normalizeTimelinePointTime(time, maxTime);
}

function normalizeTimelinePointTime(time: number, maxTime?: number): number {
  const finiteTime = typeof time === 'number' && Number.isFinite(time) ? time : 0;
  const upperBound = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : undefined;
  return round(Math.min(upperBound ?? finiteTime, Math.max(0, finiteTime)));
}

function normalizeTimelineMarkerLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Marker';
}

function normalizeTimelineMarkerColor(color: string | undefined): string {
  return normalizeHexColor(color, DEFAULT_TIMELINE_MARKER_COLOR);
}

function normalizeProjectAnnotationText(text: string | undefined): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 240) : 'Annotation';
}

function normalizeExportRangeLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Export Range';
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
  const trimmed = color?.trim();
  return trimmed && /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function normalizeLutPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  return trimmed ? trimmed : null;
}

function cloneClipKeyframesLocal(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const output: ClipKeyframes = {};
  for (const property of Object.keys(keyframes) as KeyframeProperty[]) {
    const frames = keyframes[property];
    if (frames?.length) {
      output[property] = frames.map((frame) => ({ ...frame }));
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function deserializeProject(file: CutProjectFile, projectPath?: string): Project {
  return migrateProjectFile(file, projectPath).project;
}
