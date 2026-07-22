/**
 * 模型核心类型定义（组合层）
 *
 * 从 primitives 导入基础类型，从 feature 模块导入高级类型，
 * 组合成 BaseClip、Project 等复合类型。
 */

// ─── 从 primitives 重新导出所有基础类型（保持向后兼容）────────────────────────
export type {
  KeyframeEasing, KeyframeHandleMode, KeyframeHandle, Keyframe,
  ClipKeyframes, KeyframeProperty, LUTLayer, PathPointHandle, PathPoint,
  MaskType, PrivacyBlurEffect, ClipMaskKeyframe, ClipPrivacyBlur,
  PrivacyRedactionType, RedactionKeyframe, ClipPrivacyRedaction,
  TimelineMarker, TimelineBookmark, BeatMarker, BookmarkGroup, BookmarkSortMode,
  ExportRange, ProtectedRange, ClipGroupColor, ClipGroup,
  TrackType, TimelineLabelColor, ChromaKeyColor, ChromaKeyMode, ChromaKey,
  ClipStabilization, FrameInterpolationTargetFps, FrameInterpolationMode,
  FrameInterpolationQualityGrade, FrameInterpolationQuality, ClipFrameInterpolation,
  ClipSlowMotionMode, ClipProjection, ClipPanoramaOutputProjection, ClipPanoramaView,
  VideoDenoisePreset, VideoDeinterlaceMode, ClipVideoDeinterlace,
  ClipVideoTemporalDenoise, ClipVideoSpatialDenoise, ClipVideoRestoration,
  ClipQualityEnhancement, MotionTrackPoint, AudioFadeCurve, AudioChannelRoutingMode,
  ClipAudioDenoise, ClipAILocalDenoise, ClipAudioRestoration, ClipAudioRestorationGap,
  TextStyle, TextBoxFitMode, RichTextRun, RichTextParagraph, RichTextDocument,
  TextLayoutOptions, TextOpenTypeFeatures, TextPathOptions, TextArcOptions,
  SubtitleMode, SubtitleLanguage, SubtitleTrackType, SubtitleStyle,
  DataSubtitleSourceType, DataSubtitleRow, DataSubtitleSource,
  TransitionType, Transition, Transform, ClipBorder, AssetType,
  MediaLabelColor, MediaFlag, MediaVersion, MediaFingerprintKind,
  MediaFingerprintAlgorithm, MediaFingerprint, MediaMetadata, MediaCollection,
  MediaFolder, ImageSequenceInfo, ProjectVersion, ZoomEditMode, VfrHandlingStrategy,
  ProjectDocumentation, ProjectSpeaker, ProjectAnnotation, ReviewAnnotationType,
  ReviewAnnotation, CollaborationNoteType, CollaborationNote, TimelineNote,
  MulticamSyncMode, SwitchTransition, SwitchPoint, MulticamAngle,
  MulticamSwitch, MulticamAiCutSuggestion, CreditsRow, CreditsStyle,
  WheelAdjustments, ClipAILookMatch, BeatSnapSuggestion, AiPipPlacementSuggestion,
  PlatformFitSegment, ProjectPlatformFitSuggestion, ClipPitchDataPoint,
  Subclip, ClipType, MulticamSequence, MulticamClipAngleBase,
  TrackEQBandType, TrackEQBand, TrackEQ, TrackCompressor, SequenceSettings,
  DubbingAdaptationType, TimingAdaptation, TtsSegment,
  CpmCurvePoint, PacingSegment, PacingAnalysis,
  ClipMask, Mask,
} from './model-types-primitives';

// ─── 从 feature 模块导入高级类型 ─────────────────────────────────────────────
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
import type { MixerState } from './audio/mixer-types';
import type { TimecodeFormat } from './time';
import type { MotionGraphic } from './motion-graphics';
import type { CharacterTimeline } from './ai-character-timeline';

// ─── 从 primitives 导入用于复合类型定义 ──────────────────────────────────────
import type {
  LUTLayer, PathPoint, ClipMaskKeyframe, ClipPrivacyBlur, ClipPrivacyRedaction,
  ClipMask, TimelineMarker, TimelineBookmark, BeatMarker, ExportRange, ProtectedRange,
  ClipGroup, TrackType, TimelineLabelColor, ChromaKey, ClipStabilization,
  ClipFrameInterpolation, ClipSlowMotionMode, ClipPanoramaView, ClipVideoRestoration,
  ClipQualityEnhancement, MotionTrackPoint, ClipBorder, ClipAudioDenoise,
  ClipAILocalDenoise, ClipAudioRestoration, AudioFadeCurve, AudioChannelRoutingMode,
  TextStyle, RichTextDocument, TextLayoutOptions, TextOpenTypeFeatures, TextArcOptions,
  TextPathOptions, SubtitleMode, SubtitleLanguage, SubtitleTrackType, SubtitleStyle,
  DataSubtitleSource, Transition, TrackEQ, TrackCompressor, SequenceSettings, Subclip,
  ClipType, MulticamClipAngleBase, MulticamSequence, MulticamSyncMode, SwitchPoint,
  ProjectVersion, ProjectSpeaker, ProjectDocumentation, MediaFolder, MediaMetadata,
  ProjectAnnotation, ReviewAnnotation, CollaborationNote, TimelineNote,
  ClipPitchDataPoint, BeatSnapSuggestion, MediaCollection, AiPipPlacementSuggestion,
  TtsSegment, PacingAnalysis, MaskType, AssetType, ImageSequenceInfo,
  VfrHandlingStrategy, Transform, ClipProjection, ClipAILookMatch, CreditsRow,
  CreditsStyle, ProjectPlatformFitSuggestion, Keyframe, ClipKeyframes,
} from './model-types-primitives';

// ─── 复合类型定义（依赖 feature 模块）──────────────────────────────────────

/** 色彩校正 */
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

// ─── Media Asset ──────────────────────────────────────────────────────────────

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

// ─── Project Settings ─────────────────────────────────────────────────────────

export interface ProjectSettings {
  fps: number;
  timecodeFormat: TimecodeFormat;
  width: number;
  height: number;
  vfrHandling?: VfrHandlingStrategy;
  colorPipeline?: ProjectColorPipeline;
  workingColorSpace?: ProjectWorkingColorSpace;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

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

export interface Timeline {
  tracks: Track[];
  transitions?: Transition[];
  markers?: TimelineMarker[];
  brollSuggestions?: BrollSuggestion[];
  continuityWarnings?: import('./continuity-check').ContinuityWarning[];
  colorConsistencyWarnings?: ColorConsistencyWarning[];
  sfxSuggestions?: SfxSuggestion[];
}

// ─── Track ────────────────────────────────────────────────────────────────────

export interface Track {
  id: string;
  type: TrackType;
  name: string;
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
  musicStructure?: import('./music-structure').MusicStructurePoint[];
  clips: Clip[];
}

// ─── MulticamClipAngle（完整版，含 ColorCorrection）──────────────────────────

export interface MulticamClipAngle extends MulticamClipAngleBase {
  colorCorrection?: ColorCorrection;
  transform?: Transform;
}

// ─── BaseClip ─────────────────────────────────────────────────────────────────

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
  aiLocalDenoise?: ClipAILocalDenoise;
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
  subclipId?: string;
  aiColorHistory?: AIColorHistoryEntry[];
  aiReframe?: import('./ai-reframe').ClipAIReframe;
  anomalies?: import('./anomaly-detection').AnomalyInterval[];
  privacyRedactions?: ClipPrivacyRedaction[];
  beatSnapped?: boolean;
  aiLookMatch?: ClipAILookMatch;
  aiPipSuggestion?: AiPipPlacementSuggestion;
  platformFitRemoved?: boolean;
  aiDenoiseRecommendation?: AIDenoiseRecommendation;
  flashWarnings?: import('./flash-warning').FlashWarning[];
  motionType?: import('./ai-motion-type').ClipMotionType;
  emotionAnalysis?: import('./ai-emotion-tone').EmotionAnalysis;
}

export interface AIColorHistoryEntry {
  timestamp: number;
  style: string;
  issues: string[];
  suggestions: AIColorGradingSuggestionItem[];
}

// ─── Clip 子类型 ──────────────────────────────────────────────────────────────

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
  speakerId?: number;
  soundDesc?: string;
  style: SubtitleStyle;
  subtitleMode: SubtitleMode;
  dataSubtitle?: DataSubtitleSource;
  readingSpeedWarning?: import('./subtitle-reading-speed').ReadingSpeedWarning | null;
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

export interface MulticamClip extends BaseClip {
  type: 'multicam';
  angles: MulticamClipAngle[];
  activeAngle: number;
  switchPoints: SwitchPoint[];
  syncMode: MulticamSyncMode;
  syncReferenceAngle: number;
}

// ─── Clip 联合类型 ────────────────────────────────────────────────────────────

export type Clip =
  | VideoClip | AudioClip | ImageClip | TextClip | SubtitleClip
  | CreditsClip | NestedSequenceClip | AdjustmentClip | MotionGraphicClip | MulticamClip;

// ─── Sequence ────────────────────────────────────────────────────────────────

export interface Sequence {
  id: string;
  name: string;
  timeline: Timeline;
  settings?: SequenceSettings;
}

// ─── Project ─────────────────────────────────────────────────────────────────

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
  zoomMemory?: Record<string, number>;
  subclips?: Subclip[];
  speakerLabels?: Record<number, string>;
  beatSnapSuggestions?: BeatSnapSuggestion[];
  mediaCollections?: MediaCollection[];
  platformFitSuggestion?: ProjectPlatformFitSuggestion;
  versionDiffs?: Record<string, VersionDiffSummary>;
  loudnessSuggestion?: LoudnessSuggestion;
  pacingAnalysis?: PacingAnalysis;
  characterTimeline?: CharacterTimeline;
  preflightReport?: import('./ai-preflight-checklist').PreflightReport;
  ttsSegments?: TtsSegment[];
  mixerState?: MixerState;
}

// ─── DataSubtitleClip ────────────────────────────────────────────────────────

export type DataSubtitleClip = SubtitleClip & { dataSubtitle: DataSubtitleSource };
