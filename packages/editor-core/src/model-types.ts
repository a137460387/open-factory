import type { ColorCurves, ThreeWayColor } from './color-grading';
import type { InputColorSpace } from './color-log-luts';
import type { ClipBlendMode } from './blend-modes';
import type { ClipContentAnalysis } from './content-analysis';
import type { ProjectColorPipeline } from './color-pipeline';
import type { MediaColorProfile, ProjectWorkingColorSpace } from './export/color-management';
import type { ClipSpatialAudio } from './spatial-audio';
import type { Effect } from './effects';
import type { TimecodeFormat } from './time';

export interface BeatMarker {
  id: string;
  time: number;
}

export interface CreditsRow {
  role: string;
  name: string;
}

export interface CreditsStyle extends TextStyle {
  lineSpacing: number;
  horizontalMargin: number;
}
export type ProjectVersion = '0.2';

export type AssetType = 'video' | 'audio' | 'image';

export type TrackType = 'video' | 'audio' | 'text' | 'subtitle';

export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'credits' | 'nested-sequence' | 'adjustment';

export type TransitionType = 'fade-black' | 'dissolve';

export type TimelineLabelColor = 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'purple' | 'pink';

export type SubtitleMode = 'burn-in' | 'soft-sub';

export type SubtitleLanguage = string;

export type SubtitleTrackType = 'subtitle' | 'cc';

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
  spatialX?: Keyframe<number>[];
  spatialY?: Keyframe<number>[];
  pathStartOffset?: Keyframe<number>[];
}

export type KeyframeProperty = keyof ClipKeyframes;

export type ChromaKeyColor = [number, number, number];

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

export type ClipSlowMotionMode = 'none' | 'blend' | 'mci' | 'optical-flow';

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

export interface ClipQualityEnhancement {
  superResolution: boolean;
  deblock: boolean;
  colorBoost: boolean;
  frameCompensation: boolean;
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
  reviewAnnotations: ReviewAnnotation[];
  collaborationNotes: CollaborationNote[];
  timelineNotes: TimelineNote[];
  bookmarks: TimelineBookmark[];
  beatMarkers: BeatMarker[];
  exportRanges: ExportRange[];
  protectedRanges: ProtectedRange[];
  clipGroups: ClipGroup[];
  coverPath?: string;
  speakers: ProjectSpeaker[];
  documentation: ProjectDocumentation;
  timeline: Timeline;
  sequences: Sequence[];
  activeSequenceId: string;
}

export type ProjectDocumentation = Record<string, string>;

export interface ProjectSpeaker {
  id: string;
  name: string;
  color?: string;
}

export interface ProjectSettings {
  fps: number;
  timecodeFormat: TimecodeFormat;
  width: number;
  height: number;
  vfrHandling?: VfrHandlingStrategy;
  colorPipeline?: ProjectColorPipeline;
  workingColorSpace?: ProjectWorkingColorSpace;
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
  colorProfile?: MediaColorProfile;
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
  language?: SubtitleLanguage;
  subtitleType?: SubtitleTrackType;
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

export type Clip = VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip | CreditsClip | NestedSequenceClip | AdjustmentClip;

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

export interface TimelineBookmark {
  id: string;
  time: number;
  note: string;
}

export interface ClipPitchDataPoint {
  time: number;
  hz: number;
  note: string;
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
  qualityEnhancement?: ClipQualityEnhancement;
  projection?: ClipProjection;
  panorama?: ClipPanoramaView;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: ClipBorder;
  keyframes?: ClipKeyframes;
  effects?: Effect[];
  sequenceFrameRate?: number;
  blendMode?: ClipBlendMode;
  contentAnalysis?: ClipContentAnalysis;
  spatialAudio?: ClipSpatialAudio;
  pitchData?: ClipPitchDataPoint[];
  beatMarkers?: BeatMarker[];
  detectedBpm?: number;
  scenecuts?: number[];
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
  subtitleType?: SubtitleTrackType;
  text: string;
  speaker?: string;
  soundDesc?: string;
  style: SubtitleStyle;
  subtitleMode: SubtitleMode;
  dataSubtitle?: DataSubtitleSource;
}

export interface CreditsClip extends BaseClip {
  type: 'credits';
  text: string;
  rows: CreditsRow[];
  rollSpeed: number;
  style: CreditsStyle;
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

export type DataSubtitleClip = SubtitleClip & { dataSubtitle: DataSubtitleSource };

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt: string;
}
