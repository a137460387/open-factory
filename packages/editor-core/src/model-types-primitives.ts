/**
 * 模型原始类型定义（零外部依赖）
 *
 * 本文件仅包含自包含的基础类型，不导入任何 feature 模块。
 * 所有需要在 model-types.ts 和 feature 模块之间共享的叶子类型都应定义在此处，
 * 以切断循环依赖链。
 *
 * 规则：
 * - 本文件不得 import 任何 ./ 开头的本地模块
 * - 只放纯数据接口/类型别名，不放业务逻辑
 */

// ─── Keyframe 系列 ───────────────────────────────────────────────────────────

export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'elastic' | 'bounce';

export type KeyframeHandleMode = 'unified' | 'independent' | 'broken';

export interface KeyframeHandle {
  dx: number;
  dy: number;
}

export interface Keyframe<T> {
  id: string;
  time: number;
  value: T;
  easing: KeyframeEasing;
  inHandle?: KeyframeHandle;
  outHandle?: KeyframeHandle;
  handleMode?: KeyframeHandleMode;
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
  spatialX?: Keyframe<number>[];
  spatialY?: Keyframe<number>[];
  spatialAzimuth?: Keyframe<number>[];
  spatialElevation?: Keyframe<number>[];
  spatialDistanceMeters?: Keyframe<number>[];
  pathStartOffset?: Keyframe<number>[];
}

export type KeyframeProperty = keyof ClipKeyframes;

// ─── LUT ─────────────────────────────────────────────────────────────────────

export interface LUTLayer {
  path: string;
  intensity: number; // 0~1, default 1.0
}

// ─── Path / Mask 基础类型 ────────────────────────────────────────────────────

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

export type MaskType = 'rect' | 'ellipse' | 'path';

export type PrivacyBlurEffect = 'pixelize' | 'gblur' | 'solid';

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

/** Mask 类型别名 */
export type Mask = ClipMask;

export type PrivacyRedactionType = 'face' | 'license_plate' | 'screen';

export interface RedactionKeyframe {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClipPrivacyRedaction {
  id: string;
  type: PrivacyRedactionType;
  keyframes: RedactionKeyframe[];
  blurStrength: number;
  enabled: boolean;
}

// ─── Timeline 标记 ───────────────────────────────────────────────────────────

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface TimelineBookmark {
  id: string;
  time: number;
  note: string;
  groupId?: string;
  thumbnailPath?: string;
  annotation?: string;
  createdAt?: string;
}

export interface BeatMarker {
  id: string;
  time: number;
}

export interface BookmarkGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  sortOrder: number;
}

export type BookmarkSortMode = 'time' | 'group' | 'created';

// ─── Export / Protected Range ────────────────────────────────────────────────

export interface ExportRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface ProtectedRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

// ─── Clip Group ──────────────────────────────────────────────────────────────

export type ClipGroupColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'cyan';

export interface ClipGroup {
  id: string;
  name: string;
  clipIds: string[];
  color: ClipGroupColor;
}

// ─── Track 基础类型 ──────────────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'text' | 'subtitle' | 'multicam';

export type TimelineLabelColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink';

// ─── Chroma Key ──────────────────────────────────────────────────────────────

export type ChromaKeyColor = [number, number, number];

export type ChromaKeyMode = 'chroma-key' | 'luma-key' | 'difference-matte';

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

// ─── Stabilization ───────────────────────────────────────────────────────────

export interface ClipStabilization {
  enabled: boolean;
  smoothing: number;
  zoom: number;
  analyzed: boolean;
  trfPath?: string | null;
  shakeScore?: number;
  severity?: 'low' | 'medium' | 'high';
  suggestedFilter?: 'vidstab' | 'none';
  sampledAt?: number;
}

// ─── Frame Interpolation ─────────────────────────────────────────────────────

export type FrameInterpolationTargetFps = 24 | 30 | 48 | 60 | 120;

export type FrameInterpolationMode = 'adaptive' | 'blend' | 'mci' | 'copy';

export type FrameInterpolationQualityGrade = 'excellent' | 'good' | 'poor';

export interface FrameInterpolationQuality {
  ssim: number;
  grade: FrameInterpolationQualityGrade;
  sampleCount: number;
  evaluatedAt?: string;
}

export interface ClipFrameInterpolation {
  enabled: boolean;
  targetFps: FrameInterpolationTargetFps;
  mode: FrameInterpolationMode;
  protectionFrames: number;
  quality?: FrameInterpolationQuality;
}

// ─── Slow Motion / Projection / Panorama ─────────────────────────────────────

export type ClipSlowMotionMode = 'none' | 'blend' | 'mci' | 'optical-flow';

export type ClipProjection = 'flat' | 'equirectangular' | 'cubemap';

export type ClipPanoramaOutputProjection = 'flat' | 'equirectangular';

export interface ClipPanoramaView {
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  outputProjection: ClipPanoramaOutputProjection;
}

// ─── Video Restoration ───────────────────────────────────────────────────────

export type VideoDenoisePreset = 'off' | 'low' | 'medium' | 'high' | 'custom';

export type VideoDeinterlaceMode = 0 | 1;

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

// ─── Quality Enhancement ─────────────────────────────────────────────────────

export interface ClipQualityEnhancement {
  superResolution: boolean;
  deblock: boolean;
  colorBoost: boolean;
  frameCompensation: boolean;
}

// ─── Motion Track ────────────────────────────────────────────────────────────

export interface MotionTrackPoint {
  time: number;
  dx: number;
  dy: number;
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export type AudioFadeCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type AudioChannelRoutingMode =
  | 'normal'
  | 'mono-left'
  | 'mono-right'
  | 'mono-both'
  | 'swap-stereo'
  | 'stereo-left-mono'
  | 'stereo-right-mono'
  | 'stereo-to-mono';

export interface ClipAudioDenoise {
  enabled: boolean;
  strength: number;
}

export interface ClipAILocalDenoise {
  enabled: boolean;
  strength: number;
  outputPath?: string;
  originalPath?: string;
  processedAt?: number;
}

interface ClipAudioRestorationToggle {
  enabled: boolean;
}

interface ClipAudioDereverbSettings {
  enabled: boolean;
  strength: number;
}

export interface ClipAudioRestoration {
  declip: ClipAudioRestorationToggle;
  dereverb: ClipAudioDereverbSettings;
  dewind: ClipAudioRestorationToggle;
  fill: ClipAudioRestorationToggle;
}

export interface ClipAudioRestorationGap {
  start: number;
  duration: number;
}

// ─── Text / Subtitle 基础类型 ────────────────────────────────────────────────

export interface TextStyle {
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export type TextBoxFitMode = 'fixed' | 'auto-height' | 'auto-scale';

export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
}

export interface RichTextParagraph {
  runs: RichTextRun[];
}

export interface RichTextDocument {
  paragraphs: RichTextParagraph[];
}

export interface TextLayoutOptions {
  fitMode: TextBoxFitMode;
  boxWidth: number;
  boxHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
}

export interface TextOpenTypeFeatures {
  liga: boolean;
  smcp: boolean;
  tnum: boolean;
  swsh: boolean;
}

export interface TextPathOptions {
  enabled: boolean;
  path: PathPoint[];
  startOffset: number;
  letterSpacing: number;
  rotateCharacters: boolean;
}

export interface TextArcOptions {
  enabled: boolean;
  radius: number;
  startAngle: number;
  clockwise: boolean;
  rotateCharacters: boolean;
}

export type SubtitleMode = 'burn-in' | 'soft-sub';

export type SubtitleLanguage = string;

export type SubtitleTrackType = 'subtitle' | 'cc';

export interface SubtitleStyle extends TextStyle {
  yOffset: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowOffset: number;
}

export type DataSubtitleSourceType = 'csv' | 'json' | 'template';

export interface DataSubtitleRow {
  time: number;
  text?: string;
  values: Record<string, string>;
}

export interface DataSubtitleSource {
  sourceType: DataSubtitleSourceType;
  template: string;
  rows: DataSubtitleRow[];
  filePath?: string;
}

// ─── Transition ──────────────────────────────────────────────────────────────

export type TransitionType =
  | 'fade-black'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'zoom-dissolve'
  | 'flash-white'
  | 'flash-black'
  | 'block'
  | 'rotate'
  | 'film-roll-open'
  | 'film-roll-close'
  | 'shape-heart'
  | 'shape-star'
  | 'motion-blur-wipe'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'light-leak'
  | 'glitch'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'cube-rotate'
  | 'portal';

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

// ─── Transform / Border ──────────────────────────────────────────────────────

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

// ─── Media 基础类型 ──────────────────────────────────────────────────────────

export type AssetType = 'video' | 'audio' | 'image';

export type MediaLabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export type MediaFlag = 'green' | 'red';

export interface MediaVersion {
  id: string;
  label: string;
  assetId: string;
  path: string;
  name: string;
  createdAt: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
}

export type MediaFingerprintKind = 'video' | 'audio' | 'image';
export type MediaFingerprintAlgorithm = 'phash' | 'rms' | 'bytes';

export interface MediaFingerprint {
  version: 1;
  kind: MediaFingerprintKind;
  hash: string;
  algorithm: MediaFingerprintAlgorithm;
  frameHashes?: string[];
  rmsVector?: number[];
}

export interface MediaMetadata {
  labelColor?: MediaLabelColor;
  rating?: number;
  flag?: MediaFlag;
  versions?: MediaVersion[];
  fingerprint?: MediaFingerprint;
  title?: string;
  author?: string;
  description?: string;
  copyright?: string;
  date?: string;
  customTags?: string[];
}

export interface MediaCollection {
  id: string;
  name: string;
  mediaIds: string[];
  source: 'ai' | 'manual';
  createdAt: string;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt: string;
}

export interface ImageSequenceInfo {
  pattern: string;
  startNumber: number;
  frameCount: number;
  frameRate: number;
  paths: string[];
}

// ─── Project 基础类型 ────────────────────────────────────────────────────────

export type ProjectVersion = '0.2';

export type ZoomEditMode = 'editing' | 'browsing' | 'audio';

export type VfrHandlingStrategy = 'ignore' | 'auto-cfr' | 'ask';

export type ProjectDocumentation = Record<string, string>;

export interface ProjectSpeaker {
  id: string;
  name: string;
  color?: string;
}

export interface ProjectAnnotation {
  id: string;
  time: number;
  text: string;
  color: string;
}

export type ReviewAnnotationType = 'rectangle' | 'arrow' | 'text';

export interface ReviewAnnotation {
  id: string;
  time: number;
  type: ReviewAnnotationType;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CollaborationNoteType = 'comment' | 'highlight' | 'replacement';

export interface CollaborationNote {
  id: string;
  type: CollaborationNoteType;
  authorName: string;
  authorColor: string;
  start: number;
  end?: number;
  text: string;
  mediaPath?: string;
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TimelineNote {
  id: string;
  start: number;
  end: number;
  text: string;
  color: string;
  createdAt: string;
}

// ─── Multicam 基础类型 ───────────────────────────────────────────────────────

export type MulticamSyncMode = 'audio' | 'timecode' | 'manual';

export type SwitchTransition = 'cut' | 'dissolve' | 'wipe';

export interface SwitchPoint {
  time: number;
  targetAngle: number;
  transition: SwitchTransition;
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

export interface MulticamAiCutSuggestion {
  time: number;
  angleId: string;
  confidence: number;
  reason: string;
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export interface CreditsRow {
  role: string;
  name: string;
}

export interface CreditsStyle extends TextStyle {
  lineSpacing: number;
  horizontalMargin: number;
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export interface WheelAdjustments {
  lift: { r: number; g: number; b: number };
  gamma: { r: number; g: number; b: number };
  gain: { r: number; g: number; b: number };
}

export interface ClipAILookMatch {
  sourceImageHash: string;
  wheelAdjustments: WheelAdjustments;
  curveControlPoints: {
    master: Array<{ x: number; y: number }>;
    r: Array<{ x: number; y: number }>;
    g: Array<{ x: number; y: number }>;
    b: Array<{ x: number; y: number }>;
  };
  confidence: number;
  generatedAt: string;
  blendStrength: number;
}

export interface BeatSnapSuggestion {
  clipId: string;
  edge: 'in' | 'out';
  suggestedTime: number;
  originalTime: number;
}

export interface AiPipPlacementSuggestion {
  recommendedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  overlapReduction: number;
  confidence: number;
}

export interface PlatformFitSegment {
  clipId: string;
  start: number;
  end: number;
  score: number;
}

export interface ProjectPlatformFitSuggestion {
  targetPlatform: 'tiktok' | 'reels' | 'shorts' | 'custom';
  limitSeconds: number;
  keptSegments: PlatformFitSegment[];
  removedSegments: PlatformFitSegment[];
}

export interface ClipPitchDataPoint {
  time: number;
  hz: number;
  note: string;
}

export interface Subclip {
  id: string;
  name: string;
  sourceMediaId: string;
  inPoint: number;
  outPoint: number;
  color?: TimelineLabelColor | null;
  description?: string;
  createdAt?: string;
}

export type ClipType =
  | 'video'
  | 'audio'
  | 'image'
  | 'text'
  | 'subtitle'
  | 'credits'
  | 'nested-sequence'
  | 'adjustment'
  | 'motion-graphic'
  | 'multicam';

// ─── Multicam Clip 基础类型 ──────────────────────────────────────────────────

/** 多机位机位定义基础版 - 完整版（含 ColorCorrection）在 model-types.ts */
export interface MulticamClipAngleBase {
  id: string;
  mediaId: string;
  name: string;
  offset: number;
  volume: number;
  muted: boolean;
}

export interface MulticamSequence {
  angles: MulticamAngle[];
  switches: MulticamSwitch[];
  aiCutSuggestions?: MulticamAiCutSuggestion[];
}

// ─── Track EQ / Compressor ───────────────────────────────────────────────────

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

// ─── Sequence Settings ───────────────────────────────────────────────────────

export interface SequenceSettings {
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
}

// ─── Dubbing / TTS ──────────────────────────────────────────────────────────

export type DubbingAdaptationType = 'compress' | 'pad' | 'trim' | 'none';

export interface TimingAdaptation {
  durationDelta: number;
  adaptationType: DubbingAdaptationType;
  atempoRatio: number | null;
  suggestedOutPoint: number | null;
}

export interface TtsSegment {
  id: string;
  subtitleClipId: string;
  originalDuration: number;
  dubbedDuration: number;
  audioPath?: string;
  language?: string;
  timingAdaptation?: TimingAdaptation;
}

// ─── Pacing ──────────────────────────────────────────────────────────────────

export interface CpmCurvePoint {
  time: number;
  cpm: number;
}
export interface PacingSegment {
  start: number;
  end: number;
}
export interface PacingAnalysis {
  cpmCurve: CpmCurvePoint[];
  slowSegments: PacingSegment[];
  fastSegments: PacingSegment[];
  overallAvgCPM: number;
}
