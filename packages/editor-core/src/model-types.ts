import type { AIDenoiseRecommendation } from './ai-denoise-recommendation';
import type { BrollSuggestion } from './ai-broll-suggestion';
import type { VersionDiffSummary } from './ai-version-diff';
import type { LoudnessSuggestion } from './ai-loudness-suggestion';
import type { MediaAIAnalysis, AIColorGradingSuggestionItem } from './ai-service';
import type { ColorCurves, ThreeWayColor } from './color-grading';
import type { ColorGradingGraph } from './color-grading';
import type { InputColorSpace } from './color-log-luts';
import type { ClipBlendMode } from './blend-modes';
import type { ClipContentAnalysis } from './content-analysis';
import type { ColorNodeGraph } from './color-node-graph';
import type { ProjectColorPipeline } from './color-pipeline';
import type { MediaColorProfile, ProjectWorkingColorSpace } from './color-management';
import type { ClipSpatialAudio } from './spatial-audio';
import type { Effect } from './effects';
import type { TimecodeFormat } from './time';
import type { MotionGraphic } from './motion-graphics';
import type { CharacterTimeline } from './ai-character-timeline';

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

/** 缩放编辑模式：剪辑模式(帧精度高zoom) / 浏览模式(全局低zoom) / 音频编辑模式(波形查看zoom) */
export type ZoomEditMode = 'editing' | 'browsing' | 'audio';

export type AssetType = 'video' | 'audio' | 'image';

export type TrackType = 'video' | 'audio' | 'text' | 'subtitle';

export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'subtitle' | 'credits' | 'nested-sequence' | 'adjustment' | 'motion-graphic' | 'multicam';

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
  | 'motion-blur-wipe';

export type TimelineLabelColor = 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'purple' | 'pink';

export type SubtitleMode = 'burn-in' | 'soft-sub';

export type SubtitleLanguage = string;

export type SubtitleTrackType = 'subtitle' | 'cc';

export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'elastic' | 'bounce';

export type KeyframeHandleMode = 'unified' | 'independent' | 'broken';

export interface KeyframeHandle {
  dx: number;
  dy: number;
}

export type AudioFadeCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

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
  shakeScore?: number;
  severity?: 'low' | 'medium' | 'high';
  suggestedFilter?: 'vidstab' | 'none';
  sampledAt?: number;
}

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
import type { FlashWarning } from './flash-warning';
import type { ContinuityWarning } from './continuity-check';
import type { MusicStructurePoint } from './music-structure';
import type { ReadingSpeedWarning } from './subtitle-reading-speed';

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

export interface WheelAdjustments {
  lift: { r: number; g: number; b: number };
  gamma: { r: number; g: number; b: number };
  gain: { r: number; g: number; b: number };
}

export interface ClipAILookMatch {
  sourceImageHash: string;
  wheelAdjustments: WheelAdjustments;
  curveControlPoints: { master: Array<{ x: number; y: number }>; r: Array<{ x: number; y: number }>; g: Array<{ x: number; y: number }>; b: Array<{ x: number; y: number }> };
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

export interface MediaCollection {
  id: string;
  name: string;
  mediaIds: string[];
  source: 'ai' | 'manual';
  createdAt: string;
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
  releaseVersion: string;
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
  /** 缩放层级记忆：key 为 "序列id:编辑模式"，value 为缩放级别 */
  zoomMemory?: Record<string, number>;
  /** 虚拟子剪辑列表 */
  subclips?: Subclip[];
  /** 说话人标签映射（说话人ID→名称） */
  speakerLabels?: Record<number, string>;
  /** AI 卡点建议列表 */
  beatSnapSuggestions?: BeatSnapSuggestion[];
  /** 媒体库分组/收藏 */
  mediaCollections?: MediaCollection[];
  /** AI 平台时长适配裁剪建议 */
  platformFitSuggestion?: ProjectPlatformFitSuggestion;
  /** AI版本对比摘要 */
  versionDiffs?: Record<string, VersionDiffSummary>;
  /** AI智能响度适配建议 */
  loudnessSuggestion?: LoudnessSuggestion;
  /** AI剪辑节奏分析 */
  pacingAnalysis?: PacingAnalysis;
  /** AI人物出镜时间轴 */
  characterTimeline?: import('./ai-character-timeline').CharacterTimeline;
  /** AI导出前置检查清单 */
  preflightReport?: import('./ai-preflight-checklist').PreflightReport;
  /** AI配音时长适配建议 */
  ttsSegments?: TtsSegment[];
}

/** 虚拟子剪辑：对源媒体特定区间的命名引用，不生成实际文件 */
export interface Subclip {
  id: string;
  /** 子剪辑名称 */
  name: string;
  /** 关联的源媒体 assetId */
  sourceMediaId: string;
  /** 入点（秒），相对于源媒体 */
  inPoint: number;
  /** 出点（秒），相对于源媒体 */
  outPoint: number;
  /** 颜色标签 */
  color?: TimelineLabelColor | null;
  /** 描述 */
  description?: string;
  /** 创建时间 */
  createdAt?: string;
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
  aiAnalysis?: MediaAIAnalysis;
  qualityAssessment?: import('./ai-quality-assessment').QualityAssessmentResult;
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
  title?: string;
  author?: string;
  description?: string;
  copyright?: string;
  date?: string;
  customTags?: string[];
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
  /** AI B-roll素材建议 */
  brollSuggestions?: BrollSuggestion[];
  /** 连续性警告（跳轴/跳切） */
  continuityWarnings?: ContinuityWarning[];
  /** AI跨Clip色彩一致性警告 */
  colorConsistencyWarnings?: ColorConsistencyWarning[];
  /** AI音效匹配建议 */
  sfxSuggestions?: SfxSuggestion[];
}

export interface Sequence {
  id: string;
  name: string;
  timeline: Timeline;
  /** 序列独立设置，未设置时继承项目级设置 */
  settings?: SequenceSettings;
}

/** 序列独立设置（帧率/分辨率/时长），字段均为可选，未设置时继承项目级 */
export interface SequenceSettings {
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  /** 轨道独立显示高度（px），未设置时使用默认值48 */
  displayHeight?: number;
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
  /** 音乐结构标记点 */
  musicStructure?: MusicStructurePoint[];
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

export type Clip = VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip | CreditsClip | NestedSequenceClip | AdjustmentClip | MotionGraphicClip | MulticamClip;

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
  groupId?: string;
  thumbnailPath?: string;
  annotation?: string;
  createdAt?: string;
}

export interface BookmarkGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  sortOrder: number;
}

export type BookmarkSortMode = 'time' | 'group' | 'created';

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
  colorNodeGraph?: ColorNodeGraph;
  colorGradingGraph?: ColorGradingGraph;
  transform: Transform;
  chromaKey?: ChromaKey;
  stabilization?: ClipStabilization;
  frameInterpolation?: ClipFrameInterpolation;
  slowMotionMode?: ClipSlowMotionMode;
  audioDenoise?: ClipAudioDenoise;
  audioRestoration?: ClipAudioRestoration;
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
  /** 若此 clip 来源于虚拟子剪辑，记录其 subclipId */
  subclipId?: string;
  /** AI 调色建议历史（LRU 最多 3 条） */
  aiColorHistory?: AIColorHistoryEntry[];
  /** AI 智能裁切构图数据 */
  aiReframe?: ClipAIReframe;
  /** 异常片段检测结果（黑场/静态长镜头） */
  anomalies?: AnomalyInterval[];
  /** AI 隐私打码区域列表 */
  privacyRedactions?: ClipPrivacyRedaction[];
  /** 是否已卡点吸附到节拍 */
  beatSnapped?: boolean;
  /** AI 参考图调色匹配数据 */
  aiLookMatch?: ClipAILookMatch;
  /** AI 画中画避让建议 */
  aiPipSuggestion?: AiPipPlacementSuggestion;
  /** AI 平台适配裁剪标记 */
  platformFitRemoved?: boolean;
  /** AI智能降噪推荐 */
  aiDenoiseRecommendation?: AIDenoiseRecommendation;
  /** 闪烁光敏警告 */
  flashWarnings?: FlashWarning[];
  /** 镜头运动类型分析结果 */
  motionType?: ClipMotionType;
  /** AI情感基调分析结果 */
  emotionAnalysis?: import('./ai-emotion-tone').EmotionAnalysis;
}

export interface AIColorHistoryEntry {
  timestamp: number;
  style: string;
  issues: string[];
  suggestions: AIColorGradingSuggestionItem[];
}

export interface ClipAudioDenoise {
  enabled: boolean;
  strength: number;
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

export interface LUTLayer {
  path: string;
  intensity: number; // 0~1, default 1.0
}

export interface ColorCorrection {
  inputColorSpace?: InputColorSpace;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  lutPath?: string | null;
  luts?: LUTLayer[];
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
  richText?: RichTextDocument;
  textLayout?: TextLayoutOptions;
  openTypeFeatures?: TextOpenTypeFeatures;
  arcText?: TextArcOptions;
  pathText?: TextPathOptions;
}

export interface SubtitleClip extends BaseClip {
  type: 'subtitle';
  subtitleType?: SubtitleTrackType;
  text: string;
  speaker?: string;
  /** AI说话人分离分配的说话人ID */
  speakerId?: number;
  soundDesc?: string;
  style: SubtitleStyle;
  subtitleMode: SubtitleMode;
  dataSubtitle?: DataSubtitleSource;
  /** 阅读速度警告 */
  readingSpeedWarning?: ReadingSpeedWarning | null;
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

export interface MotionGraphicClip extends BaseClip {
  type: 'motion-graphic';
  motionGraphic: MotionGraphic;
}

/** 多机位同步模式 */
export type MulticamSyncMode = 'audio' | 'timecode' | 'manual';

/** 多机位切换过渡类型 */
export type SwitchTransition = 'cut' | 'dissolve' | 'wipe';

/** 多机位切换点 */
export interface SwitchPoint {
  /** 切换时间点（相对于MulticamClip起始位置，秒） */
  time: number;
  /** 目标机位索引 */
  targetAngle: number;
  /** 过渡类型 */
  transition: SwitchTransition;
}

/** 多机位机位定义（独立MulticamClip使用） */
export interface MulticamClipAngle {
  id: string;
  mediaId: string;
  name: string;
  /** 相对于同步点的时间偏移（秒） */
  offset: number;
  volume: number;
  muted: boolean;
  colorCorrection?: ColorCorrection;
  transform?: Transform;
}

/** 独立多机位片段 */
export interface MulticamClip extends BaseClip {
  type: 'multicam';
  angles: MulticamClipAngle[];
  /** 当前激活的机位索引 */
  activeAngle: number;
  /** 切换点关键帧 */
  switchPoints: SwitchPoint[];
  /** 同步方式 */
  syncMode: MulticamSyncMode;
  /** 同步参考机位索引 */
  syncReferenceAngle: number;
}

export interface MulticamSequence {
  angles: MulticamAngle[];
  switches: MulticamSwitch[];
  aiCutSuggestions?: MulticamAiCutSuggestion[];
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

/** AI 画中画智能避让建议 */
export interface AiPipPlacementSuggestion {
  recommendedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  overlapReduction: number;
  confidence: number;
}

/** AI 平台时长适配裁剪片段 */
export interface PlatformFitSegment {
  clipId: string;
  start: number;
  end: number;
  score: number;
}

/** AI 平台时长适配裁剪建议 */
export interface ProjectPlatformFitSuggestion {
  targetPlatform: 'tiktok' | 'reels' | 'shorts' | 'custom';
  limitSeconds: number;
  keptSegments: PlatformFitSegment[];
  removedSegments: PlatformFitSegment[];
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

/** 配音时长适配类型 */
export type DubbingAdaptationType = 'compress' | 'pad' | 'trim' | 'none';

/** 配音时长适配建议 */
export interface TimingAdaptation {
  /** 配音时长与原始字幕时长的差值（秒） */
  durationDelta: number;
  /** 适配类型 */
  adaptationType: DubbingAdaptationType;
  /** atempo 压缩比（compress 时有效），范围 0.75~1.0 */
  atempoRatio: number | null;
  /** 建议出点时间（秒），trim/extend 时有效 */
  suggestedOutPoint: number | null;
}

/** TTS 配音片段 */
export interface TtsSegment {
  id: string;
  /** 关联字幕 clip ID */
  subtitleClipId: string;
  /** 原始字幕时长（秒） */
  originalDuration: number;
  /** TTS 配音音频时长（秒） */
  dubbedDuration: number;
  /** 音频文件路径 */
  audioPath?: string;
  /** 语言 */
  language?: string;
  /** 配音时长适配建议（由算法自动生成） */
  timingAdaptation?: TimingAdaptation;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt: string;
}
import type { ClipAIReframe } from './ai-reframe';
import type { AnomalyInterval } from './anomaly-detection';
import type { ClipMotionType } from './ai-motion-type';

type ColorConsistencyWarningType = 'skin_tone' | 'white_balance' | 'both';
interface ColorConsistencyWarning {
  clipAId: string;
  clipBId: string;
  type: ColorConsistencyWarningType;
  deltaRGB: number | null;
  reason: string;
}

type SfxSuggestionStatus = 'pending' | 'accepted' | 'rejected';
interface SfxSuggestion {
  time: number;
  category: string;
  confidence: number;
  matchedAssetId: string | null;
  status: SfxSuggestionStatus;
}

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
