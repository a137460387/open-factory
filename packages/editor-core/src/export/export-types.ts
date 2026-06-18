import type { ColorCurves, ThreeWayColor } from '../color-grading';
import type { ColorNodeGraph } from '../color-node-graph';
import type { InputColorSpace } from '../color-log-luts';
import type { ClipBlendMode } from '../blend-modes';
import type { ProjectColorPipeline } from '../color-pipeline';
import type { Effect } from '../effects';
import type { AudioVisualizationThemeDefinition } from '../audio-visualization-themes';
import type { ExportColorManagementSettings, MediaColorProfile, ProjectWorkingColorSpace } from './color-management';
import type { PostExportQualityAssuranceResult } from './post-export-quality';
import type {
  AudioFadeCurve,
  AudioChannelRoutingMode,
  ClipBorder,
  ClipAudioRestoration,
  DataSubtitleSource,
  ClipMaskKeyframe,
  ClipPanoramaOutputProjection,
  ClipPrivacyBlur,
  ClipProjection,
  ClipQualityEnhancement,
  ClipSlowMotionMode,
  ClipVideoRestoration,
  PathPoint,
  RichTextDocument,
  SubtitleTrackType,
  TextArcOptions,
  TextLayoutOptions,
  TextOpenTypeFeatures,
  TransitionType,
  TrackCompressor,
  TrackEQ,
  TrackEQBandType
} from '../model';
import type { CreditsRow } from '../credits-roll';
import type { TargetAspectRatio } from '../reframe';
import type { ClipSpatialAudio } from '../spatial-audio';
import type { MotionGraphic } from '../motion-graphics';

export type ExportLoudnessNormalization = 'off' | 'youtube' | 'ebu-r128';
export type ExportPlatformPreset = 'youtube-1080p' | 'youtube-shorts' | 'tiktok' | 'instagram-reels' | 'twitter-x' | 'bilibili';
export type ExportVideoProfile = 'baseline' | 'main' | 'high';
export type ExportAudioVisualizationStyle = 'waveform-line' | 'spectrum-bars' | 'circular-spectrum';
export type ExportAudioVisualizationBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; color: string; color2: string }
  | { type: 'image'; path: string };
export interface ExportAudioVisualizationSettings {
  style: ExportAudioVisualizationStyle;
  color: string;
  background: ExportAudioVisualizationBackground;
  themeId?: string;
  theme?: AudioVisualizationThemeDefinition;
}
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

export interface ExportTimecodeBurnIn {
  enabled: boolean;
  position: ExportWatermarkPosition;
  fontSize: number;
  color: string;
  backgroundColor: string;
  includeFrameNumber: boolean;
}

export interface ExportSlate {
  enabled: boolean;
}

export interface ExportPostExportScriptSettings {
  command: string;
}

export interface ExportPostExportScriptResult {
  command: string;
  resolvedCommand: string;
  program: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

export interface ExportMasterEqBand {
  id: string;
  type: TrackEQBandType;
  frequency: number;
  gain: number;
  q: number;
}

export interface ExportMasterEq {
  enabled: boolean;
  bands: ExportMasterEqBand[];
}

export interface ExportMasterStereoEnhancer {
  enabled: boolean;
  amount: number;
}

export interface ExportMasterLimiter {
  enabled: boolean;
  levelOutDb: number;
}

export interface ExportMasterProcessingSettings {
  eq: ExportMasterEq;
  stereoEnhancer: ExportMasterStereoEnhancer;
  limiter: ExportMasterLimiter;
}

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
  outputMode?: 'video' | 'audio' | 'audio-visualization';
  audioVisualization?: ExportAudioVisualizationSettings;
  scaleMode?: 'none' | 'fit';
  targetAspectRatio?: TargetAspectRatio;
  reframeOffsetX?: number;
  reframeOffsetY?: number;
  subtitleMode?: ExportSubtitleMode;
  subtitleFormat?: ExportSubtitleFormat;
  exportSidecarSubtitle?: boolean;
  subtitleLanguages?: string[];
  subtitleBurnInLanguage?: string | null;
  hardwareEncoding?: boolean;
  loudnessNormalization?: ExportLoudnessNormalization;
  platformPreset?: ExportPlatformPreset;
  videoProfile?: ExportVideoProfile;
  watermark?: ExportWatermark | null;
  timecodeBurnIn?: ExportTimecodeBurnIn | null;
  slate?: ExportSlate | null;
  colorPipeline?: ProjectColorPipeline;
  workingColorSpace?: ProjectWorkingColorSpace;
  colorManagement?: ExportColorManagementSettings;
  postExportScript?: ExportPostExportScriptSettings | null;
  masterProcessing?: ExportMasterProcessingSettings | null;
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
  keyframes?: ClipMaskKeyframe[];
  privacyBlur?: ClipPrivacyBlur;
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

export type ExportVideoRestoration = ClipVideoRestoration;
export type ExportQualityEnhancement = ClipQualityEnhancement;
export type ExportAudioRestoration = ClipAudioRestoration;

export interface ExportPanoramaView {
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  outputProjection: ClipPanoramaOutputProjection;
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
  yaw?: ExportKeyframe[];
  pitch?: ExportKeyframe[];
  roll?: ExportKeyframe[];
  spatialX?: ExportKeyframe[];
  spatialY?: ExportKeyframe[];
  pathStartOffset?: ExportKeyframe[];
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
  richText: RichTextDocument | null;
  textLayout: TextLayoutOptions | null;
  openTypeFeatures: TextOpenTypeFeatures | null;
  arcText: TextArcOptions | null;
}

export interface ExportTextPathOptions {
  enabled: boolean;
  path: PathPoint[];
  startOffset: number;
  letterSpacing: number;
  rotateCharacters: boolean;
}

export type ExportSubtitleMode = 'burn-in' | 'soft-sub';
export type ExportSubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa';
export type TextArtifactPathMode = 'filter' | 'argument' | 'shader-sequence' | 'path-text-sequence' | 'motion-graphic-sequence' | 'sidecar';

export interface ExportSubtitleStyle extends ExportTextStyle {
  yOffset: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowOffset: number;
}

export interface ExportCreditsStyle extends ExportTextStyle {
  rows: CreditsRow[];
  rollSpeed: number;
  lineSpacing: number;
  horizontalMargin: number;
}

export type ExportClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'credits' | 'nested-sequence' | 'adjustment' | 'motion-graphic';
export type ExportTrackType = 'video' | 'audio' | 'text' | 'subtitle';
export type ExportTransitionType = TransitionType;

export interface ExportClip {
  id: string;
  type: ExportClipType;
  mediaPath: string | null;
  sourceColorProfile: MediaColorProfile | null;
  nestedSequenceId: string | null;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  slowMotionMode: ClipSlowMotionMode;
  sourceDuration: number;
  trackIndex: number;
  transform: ExportTransform;
  border: ClipBorder;
  colorCorrection: ExportColorCorrection;
  colorNodeGraph?: ColorNodeGraph;
  chromaKey: ExportChromaKey;
  stabilization: ExportStabilization;
  frameInterpolation: ExportFrameInterpolation;
  audioDenoise: ExportAudioDenoise;
  audioRestoration: ExportAudioRestoration;
  spatialAudio: ClipSpatialAudio;
  videoRestoration: ExportVideoRestoration;
  qualityEnhancement: ExportQualityEnhancement;
  projection: ClipProjection;
  panorama: ExportPanoramaView;
  masks: ExportMask[];
  imageSequence: ExportImageSequence | null;
  sequenceFrameRate?: number;
  effects: Effect[];
  blendMode: ClipBlendMode;
  keyframes: ExportClipKeyframes | null;
  kenBurns: boolean;
  volume: number;
  audioChannelRouting: AudioChannelRoutingMode;
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
  textPath: ExportTextPathOptions | null;
  subtitleStyle: ExportSubtitleStyle | null;
  subtitleType: SubtitleTrackType | null;
  speaker: string | null;
  soundDesc: string | null;
  subtitleMode: ExportSubtitleMode | null;
  dataSubtitle: DataSubtitleSource | null;
  creditsStyle: ExportCreditsStyle | null;
  motionGraphic: MotionGraphic | null;
}

export interface ExportTrack {
  index: number;
  type: ExportTrackType;
  language?: string;
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
  name: string;
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
  projectName?: string;
  settings?: ExportSettings;
  inputs: FfmpegInput[];
  filterComplex: string;
  maps: string[];
  outputArgs: string[];
  fullArgs: string[];
  passes?: FfmpegExportPass[];
  warnings: string[];
  textArtifacts: TextArtifact[];
  nestedPlans: NestedFfmpegExportPlan[];
  postExportScript?: ExportPostExportScriptSettings | null;
  displayCommand?: string;
  duration: number;
}

export type ExportPreviewSampleKind = 'start' | 'middle' | 'end';

export interface ExportPreviewSamplePlan {
  id: string;
  kind: ExportPreviewSampleKind;
  label: string;
  time: number;
  outputPath: string;
  plan: FfmpegExportPlan;
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
  hasLibvmaf?: boolean;
  hardwareEncoderAvailable: boolean;
  hardwareEncoder: string | null;
  drawtextWarning: string | null;
}

export interface ExportLoudnessReport {
  integratedLoudness: number;
}

export type ExportRecoveryErrorKind = 'ffmpeg-crash' | 'unsupported-codec' | 'out-of-memory' | 'disk-space' | 'missing-font' | 'unknown';
export type ExportRecoveryAction = 'retry-same' | 'fallback-codec' | 'reduce-concurrency' | 'prompt-disk-cleanup' | 'skip-drawtext' | 'none';

export interface ExportRecoveryLogEntry {
  attempt: number;
  errorKind: ExportRecoveryErrorKind;
  action: ExportRecoveryAction;
  originalError: string;
  result: 'pending' | 'success' | 'failed';
  message: string;
}

export interface ExportRecoveryReport {
  healed: boolean;
  attempts: number;
  entries: ExportRecoveryLogEntry[];
}

export interface ExportReport {
  loudness?: ExportLoudnessReport;
  postExportScript?: ExportPostExportScriptResult;
  qualityAssurance?: PostExportQualityAssuranceResult;
  recovery?: ExportRecoveryReport;
}
