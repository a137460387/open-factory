import type { ColorCurves, ThreeWayColor } from '../color-grading';
import type { InputColorSpace } from '../color-log-luts';
import type { Effect } from '../effects';
import type { AudioFadeCurve, PathPoint, TrackCompressor, TrackEQ } from '../model';
import type { TargetAspectRatio } from '../reframe';

export type ExportLoudnessNormalization = 'off' | 'youtube' | 'ebu-r128';
export type ExportPlatformPreset = 'youtube-1080p' | 'youtube-shorts' | 'tiktok' | 'instagram-reels' | 'twitter-x' | 'bilibili';
export type ExportVideoProfile = 'baseline' | 'main' | 'high';
export type ExportWatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ExportImageWatermark {
  enabled: boolean;
  type: 'image';
  path: string;
  position: ExportWatermarkPosition;
  scalePercent: number;
  opacity: number;
}

export interface ExportTextWatermark {
  enabled: boolean;
  type: 'text';
  text: string;
  fontFamily: string;
  color: string;
  fontSize: number;
  position: ExportWatermarkPosition;
}

export type ExportWatermark = ExportImageWatermark | ExportTextWatermark;

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  videoCodec: string;
  audioCodec: string;
  outputPath: string;
  format: string;
  videoBitrate?: string | null;
  audioBitrate?: string | null;
  outputMode?: 'video' | 'audio';
  scaleMode?: 'none' | 'fit';
  targetAspectRatio?: TargetAspectRatio;
  reframeOffsetX?: number;
  reframeOffsetY?: number;
  subtitleMode?: ExportSubtitleMode;
  hardwareEncoding?: boolean;
  loudnessNormalization?: ExportLoudnessNormalization;
  platformPreset?: ExportPlatformPreset;
  videoProfile?: ExportVideoProfile;
  watermark?: ExportWatermark | null;
}

export interface ExportTransform {
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  opacity: number;
}

export interface ExportColorCorrection {
  inputColorSpace?: InputColorSpace;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  lutPath?: string | null;
  colorCurves?: ColorCurves;
  threeWayColor?: ThreeWayColor;
}

export interface ExportChromaKey {
  enabled: boolean;
  color: [number, number, number];
  colors: [number, number, number][];
  similarity: number;
  blend: number;
  spillSuppression: boolean;
  erosion: number;
}

export interface ExportMask {
  id: string;
  type: 'rect' | 'ellipse' | 'path';
  x: number;
  y: number;
  w: number;
  h: number;
  path?: PathPoint[];
  inverted: boolean;
  feather: number;
  enabled: boolean;
}

export interface ExportStabilization {
  enabled: boolean;
  smoothing: number;
  zoom: number;
  analyzed: boolean;
  trfPath?: string | null;
}

export interface ExportFrameInterpolation {
  enabled: boolean;
  targetFps: 24 | 30 | 48 | 60 | 120;
}

export interface ExportAudioDenoise {
  enabled: boolean;
  strength: number;
}

export interface ExportImageSequence {
  frameRate: number;
  frameCount: number;
  paths: string[];
}

export type ExportKeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface ExportKeyframe {
  id: string;
  time: number;
  value: number;
  easing: ExportKeyframeEasing;
}

export interface ExportClipKeyframes {
  opacity?: ExportKeyframe[];
  volume?: ExportKeyframe[];
  x?: ExportKeyframe[];
  y?: ExportKeyframe[];
  scaleX?: ExportKeyframe[];
  scaleY?: ExportKeyframe[];
  speed?: ExportKeyframe[];
}

export interface ExportTextStyle {
  text: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: string;
  fontPath: string | null;
  x: number;
  y: number;
  opacity: number;
  bold: boolean;
  italic: boolean;
}

export type ExportSubtitleMode = 'burn-in' | 'soft-sub';
export type TextArtifactPathMode = 'filter' | 'argument' | 'shader-sequence';

export interface ExportSubtitleStyle extends ExportTextStyle {
  yOffset: number;
}

export type ExportClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'nested-sequence' | 'adjustment';
export type ExportTrackType = 'video' | 'audio' | 'text' | 'subtitle';
export type ExportTransitionType = 'fade-black' | 'dissolve';

export interface ExportClip {
  id: string;
  type: ExportClipType;
  mediaPath: string | null;
  nestedSequenceId: string | null;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  sourceDuration: number;
  trackIndex: number;
  transform: ExportTransform;
  colorCorrection: ExportColorCorrection;
  chromaKey: ExportChromaKey;
  stabilization: ExportStabilization;
  frameInterpolation: ExportFrameInterpolation;
  audioDenoise: ExportAudioDenoise;
  masks: ExportMask[];
  imageSequence: ExportImageSequence | null;
  sequenceFrameRate?: number;
  effects: Effect[];
  keyframes: ExportClipKeyframes | null;
  kenBurns: boolean;
  volume: number;
  pan: number;
  eq: TrackEQ;
  compressor: TrackCompressor;
  muted: boolean;
  pitchSemitones: number;
  reverseAudio: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  fadeInCurve: AudioFadeCurve;
  fadeOutCurve: AudioFadeCurve;
  hasEmbeddedAudio: boolean;
  audioChannels: number;
  audioSampleRate: number;
  textStyle: ExportTextStyle | null;
  subtitleStyle: ExportSubtitleStyle | null;
  subtitleMode: ExportSubtitleMode | null;
}

export interface ExportTrack {
  index: number;
  type: ExportTrackType;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  pan: number;
  clips: ExportClip[];
}

export interface ExportTransition {
  id: string;
  type: ExportTransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export interface ExportTimeline {
  duration: number;
  tracks: ExportTrack[];
  transitions: ExportTransition[];
}

export interface ExportSequence {
  id: string;
  name: string;
  timeline: ExportTimeline;
}

export interface ExportProject {
  settings: ExportSettings;
  masterVolume: number;
  timeline: ExportTimeline;
  sequences: ExportSequence[];
}

export interface FfmpegInput {
  index: number;
  path: string;
  args: string[];
}

export interface TextArtifact {
  clipId: string;
  text: string;
  fileName: string;
  placeholder: string;
  pathMode?: TextArtifactPathMode;
}

export interface FfmpegExportPlan {
  inputs: FfmpegInput[];
  filterComplex: string;
  maps: string[];
  outputArgs: string[];
  fullArgs: string[];
  passes?: FfmpegExportPass[];
  warnings: string[];
  textArtifacts: TextArtifact[];
  nestedPlans: NestedFfmpegExportPlan[];
  displayCommand?: string;
  duration: number;
}

export type FfmpegExportPassKind = 'loudness-analysis' | 'render';

export interface FfmpegExportPass {
  name: string;
  fullArgs: string[];
  duration: number;
  kind?: FfmpegExportPassKind;
}

export interface NestedFfmpegExportPlan {
  sequenceId: string;
  placeholder: string;
  plan: FfmpegExportPlan;
}

export interface FfmpegCapabilities {
  available: boolean;
  version: string | null;
  hasLibx264: boolean;
  hasAac: boolean;
  hasDrawtext: boolean;
  hasLibfreetype: boolean;
  hasMinterpolate?: boolean;
  hasArnndn?: boolean;
  hardwareEncoderAvailable: boolean;
  hardwareEncoder: string | null;
  drawtextWarning: string | null;
}

export interface ExportLoudnessReport {
  integratedLoudness: number;
}

export interface ExportReport {
  loudness?: ExportLoudnessReport;
}
