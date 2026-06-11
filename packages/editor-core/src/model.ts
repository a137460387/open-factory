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
import { migrateProjectFile, serializeProjectFile } from './project/project-migration';
import type { ProjectFile } from './project/project-types';
import { round } from './time';

export type ProjectVersion = '0.2';
export type AssetType = 'video' | 'audio' | 'image';
export type TrackType = 'video' | 'audio' | 'text' | 'subtitle';
export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'nested-sequence';
export type TransitionType = 'fade-black' | 'dissolve';
export type SubtitleMode = 'burn-in' | 'soft-sub';
export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

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
}

export type KeyframeProperty = keyof ClipKeyframes;

export type ChromaKeyColor = [number, number, number];
export type MaskType = 'rect' | 'ellipse';

export interface ChromaKey {
  enabled: boolean;
  color: ChromaKeyColor;
  similarity: number;
  blend: number;
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

export interface ClipMask {
  id: string;
  type: MaskType;
  x: number;
  y: number;
  w: number;
  h: number;
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
  mediaMetadata: Record<string, MediaMetadata>;
  timeline: Timeline;
  sequences: Sequence[];
  activeSequenceId: string;
}

export interface ProjectSettings {
  fps: number;
  width: number;
  height: number;
}

export interface MediaAsset {
  id: string;
  type: AssetType;
  name: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  missing?: boolean;
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

export interface MediaMetadata {
  labelColor?: MediaLabelColor;
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

export type Clip = VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip | NestedSequenceClip;

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
  audioDenoise?: ClipAudioDenoise;
  masks?: ClipMask[];
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
  rotation: number;
  opacity: number;
}

export interface VideoClip extends BaseClip {
  type: 'video';
  mediaId: string;
  volume: number;
  muted?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  mediaId: string;
  volume: number;
  muted?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
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
  fadeInDuration?: number;
  fadeOutDuration?: number;
  multicam?: MulticamSequence;
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

export interface SubtitleStyle extends TextStyle {
  yOffset: number;
}

export type CutProjectFile = ProjectFile;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  fps: 30,
  width: 1280,
  height: 720
};

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
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
  color: [0, 255, 0],
  similarity: 0.1,
  blend: 0.05
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

export const DEFAULT_AUDIO_DENOISE: ClipAudioDenoise = {
  enabled: false,
  strength: 0.5
};

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

export function createTrack(
  track: Omit<Track, 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'> &
    Partial<Pick<Track, 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>
): Track {
  return {
    ...track,
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
    mediaMetadata: {},
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
    trimStart: round(Math.max(0, input.trimStart)),
    trimEnd: round(Math.max(0, input.trimEnd)),
    speed: clampClipSpeed(input.speed),
    colorCorrection: normalizeColorCorrection(input.colorCorrection),
    transform: { ...DEFAULT_TRANSFORM, ...input.transform },
    chromaKey: normalizeChromaKey(input.chromaKey),
    stabilization: normalizeStabilization(input.stabilization),
    frameInterpolation: normalizeFrameInterpolation(input.frameInterpolation),
    audioDenoise: normalizeAudioDenoise(input.audioDenoise),
    masks: normalizeMasks(input.masks),
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
    fadeInDuration: input.fadeInDuration,
    fadeOutDuration: input.fadeOutDuration,
    multicam: normalizeMulticamSequence(input.multicam, input.duration)
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
  return {
    enabled: chromaKey?.enabled === true,
    color: normalizeRgbColor(chromaKey?.color),
    similarity: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.similarity, DEFAULT_CHROMA_KEY.similarity)))),
    blend: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.blend, DEFAULT_CHROMA_KEY.blend))))
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

export function normalizeAudioDenoise(audioDenoise: Partial<ClipAudioDenoise> | undefined): ClipAudioDenoise {
  return {
    enabled: audioDenoise?.enabled === true,
    strength: round(Math.min(1, Math.max(0, finiteOrDefault(audioDenoise?.strength, DEFAULT_AUDIO_DENOISE.strength))))
  };
}

export function createMask(mask: Partial<ClipMask> = {}): ClipMask {
  return normalizeMask({ ...mask, id: mask.id ?? createId('mask') });
}

export function normalizeMask(mask: Partial<ClipMask> | undefined): ClipMask {
  const w = normalizePositiveUnit(mask?.w, DEFAULT_MASK.w);
  const h = normalizePositiveUnit(mask?.h, DEFAULT_MASK.h);
  return {
    id: typeof mask?.id === 'string' && mask.id.trim() ? mask.id : createId('mask'),
    type: mask?.type === 'ellipse' ? 'ellipse' : 'rect',
    x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(mask?.x, DEFAULT_MASK.x)))),
    y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(mask?.y, DEFAULT_MASK.y)))),
    w,
    h,
    inverted: mask?.inverted === true,
    feather: normalizeUnit(mask?.feather, DEFAULT_MASK.feather),
    enabled: mask?.enabled !== false
  };
}

export function normalizeMasks(masks: ClipMask[] | undefined): ClipMask[] {
  return Array.isArray(masks) ? masks.map((mask) => normalizeMask(mask)) : [];
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

export function normalizeTimelineMarkers(markers: TimelineMarker[] | undefined, maxTime?: number): TimelineMarker[] {
  return [...(markers ?? [])]
    .map((marker) => normalizeTimelineMarker(marker, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
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

function normalizeRgbChannel(value: number | undefined): number {
  return Math.round(Math.min(255, Math.max(0, finiteOrDefault(value, 0))));
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
          masks: normalizeMasks(clip.masks),
          multicam: clip.type === 'nested-sequence' ? normalizeMulticamSequence(clip.multicam, clip.duration) : undefined,
          sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
          keyframes: cloneClipKeyframesLocal(clip.keyframes)
        }))
      }))
    }
  };
}

function normalizeTimelineMarkerTime(time: number, maxTime?: number): number {
  const finiteTime = typeof time === 'number' && Number.isFinite(time) ? time : 0;
  const upperBound = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : undefined;
  return round(Math.min(upperBound ?? finiteTime, Math.max(0, finiteTime)));
}

function normalizeTimelineMarkerLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Marker';
}

function normalizeTimelineMarkerColor(color: string | undefined): string {
  const trimmed = color?.trim();
  return trimmed && /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_TIMELINE_MARKER_COLOR;
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
