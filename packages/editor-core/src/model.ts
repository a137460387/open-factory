import { migrateProjectFile, serializeProjectFile } from './project/project-migration';
import type { ProjectFile } from './project/project-types';
import { round } from './time';

export type ProjectVersion = '0.2';
export type AssetType = 'video' | 'audio' | 'image';
export type TrackType = 'video' | 'audio' | 'text' | 'subtitle';
export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle';
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
}

export type KeyframeProperty = keyof ClipKeyframes;

export interface Project {
  version: ProjectVersion;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  masterVolume: number;
  settings: ProjectSettings;
  media: MediaAsset[];
  timeline: Timeline;
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
}

export interface Timeline {
  tracks: Track[];
  transitions?: Transition[];
  markers?: TimelineMarker[];
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
  clips: Clip[];
}

export type Clip = VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip;

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
  keyframes?: ClipKeyframes;
}

export interface ColorCorrection {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  lutPath?: string | null;
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
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  lutPath: null
};

export const DEFAULT_TRACK_VOLUME = 1;
export const DEFAULT_TRACK_PAN = 0;
export const DEFAULT_MASTER_VOLUME = 1;
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
  track: Omit<Track, 'muted' | 'solo' | 'locked' | 'volume' | 'pan'> & Partial<Pick<Track, 'muted' | 'solo' | 'locked' | 'volume' | 'pan'>>
): Track {
  return {
    ...track,
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    locked: Boolean(track.locked),
    volume: normalizeTrackVolume(track.volume),
    pan: normalizeTrackPan(track.pan)
  };
}

export function createProject(name = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  return {
    version: '0.2',
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    masterVolume: DEFAULT_MASTER_VOLUME,
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    media: [],
    timeline: createDefaultTimeline()
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
    keyframes: cloneClipKeyframesLocal(input.keyframes)
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
    brightness: round(Math.min(1, Math.max(-1, colorCorrection?.brightness ?? DEFAULT_COLOR_CORRECTION.brightness))),
    contrast: round(Math.min(2, Math.max(0, colorCorrection?.contrast ?? DEFAULT_COLOR_CORRECTION.contrast))),
    saturation: round(Math.min(2, Math.max(0, colorCorrection?.saturation ?? DEFAULT_COLOR_CORRECTION.saturation))),
    hue: round(Math.min(180, Math.max(-180, colorCorrection?.hue ?? DEFAULT_COLOR_CORRECTION.hue))),
    lutPath: normalizeLutPath(colorCorrection?.lutPath)
  };
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

export function normalizeMasterVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) {
    return DEFAULT_MASTER_VOLUME;
  }
  return round(Math.min(2, Math.max(0, volume)));
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
    normalized.contrast === DEFAULT_COLOR_CORRECTION.contrast &&
    normalized.saturation === DEFAULT_COLOR_CORRECTION.saturation &&
    normalized.hue === DEFAULT_COLOR_CORRECTION.hue &&
    normalized.lutPath === DEFAULT_COLOR_CORRECTION.lutPath
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
        clips: track.clips.map((clip) => ({ ...clip, transform: { ...clip.transform }, keyframes: cloneClipKeyframesLocal(clip.keyframes) }))
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
