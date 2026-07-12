import {
  DEFAULT_COLOR_CURVES,
  DEFAULT_THREE_WAY_COLOR,
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeColorCurves,
  normalizeColorGradingGraph,
  normalizeThreeWayColor
} from './color-grading';
import { normalizeClipBlendMode } from './blend-modes';
import { normalizeColorNodeGraph } from './color-node-graph';
import { REC709_INPUT_COLOR_SPACE, normalizeInputColorSpace } from './color-log-luts';
import { normalizeClipContentAnalysis } from './content-analysis';
import { DEFAULT_PROJECT_COLOR_PIPELINE, normalizeProjectColorPipeline } from './color-pipeline';
import { getColorSpaceDisplayName, normalizeExportColorSpace, normalizeProjectWorkingColorSpace, type MediaColorProfile } from './color-management';
import { normalizeMotionGraphic } from './motion-graphics';
import { normalizeSpatialAudio } from './spatial-audio';
import { normalizeClipPitchData } from './audio-pitch';
import { normalizeAudioRestoration } from './audio-restoration';
import { normalizeDataSubtitleSource } from './data-subtitle';
import type { MixerState, MixerChannel, AudioBus } from './audio/mixer-types';
import { createDefaultMixerState, createMixerChannel, createBus } from './audio/mixer-types';
import { cloneEffects } from './effects';
import { normalizePathPoints } from './masks/path-mask';
import type { ProjectFile } from './project/project-types';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from './credits-roll';
import { normalizeTimelineLabelColor } from './timeline-color-labels';
import { normalizeProjectFps, normalizeTimecodeFormat, round, clamp } from './time';
import { normalizeMediaVersions } from './media-versions';
import { normalizeSceneCutTimes } from './scene-cuts';
import type {
  AdjustmentClip,
  AiPipPlacementSuggestion,
  AssetType,
  AudioChannelRoutingMode,
  AudioClip,
  AudioFadeCurve,
  BaseClip,
  BeatMarker,
  ChromaKey,
  ChromaKeyColor,
  ChromaKeyMode,
  Clip,
  ClipAILookMatch,
  ClipAudioDenoise,
  ClipAudioRestoration,
  ClipAudioRestorationGap,
  ClipBorder,
  ClipFrameInterpolation,
  ClipGroup,
  ClipGroupColor,
  ClipKeyframes,
  ClipMask,
  ClipMaskKeyframe,
  ClipPanoramaOutputProjection,
  ClipPitchDataPoint,
  ClipPanoramaView,
  ClipPrivacyBlur,
  ClipPrivacyRedaction,
  ClipProjection,
  ClipQualityEnhancement,
  ClipSlowMotionMode,
  ClipStabilization,
  ClipType,
  ClipVideoDeinterlace,
  ClipVideoRestoration,
  ClipVideoSpatialDenoise,
  ClipVideoTemporalDenoise,
  CollaborationNote,
  CollaborationNoteType,
  ColorCorrection,
  CreditsClip,
  DataSubtitleClip,
  DataSubtitleRow,
  DataSubtitleSource,
  DataSubtitleSourceType,
  ExportRange,
  FrameInterpolationMode,
  FrameInterpolationQuality,
  FrameInterpolationQualityGrade,
  FrameInterpolationTargetFps,
  ImageClip,
  ImageSequenceInfo,
  Keyframe,
  KeyframeEasing,
  KeyframeHandle,
  KeyframeHandleMode,
  KeyframeProperty,
  LUTLayer,
  Mask,
  MaskType,
  MediaAsset,
  MediaFingerprint,
  MediaFlag,
  MediaFolder,
  MediaLabelColor,
  MediaMetadata,
  MotionTrackPoint,
  MotionGraphicClip,
  MulticamAngle,
  MulticamAiCutSuggestion,
  MulticamClip,
  MulticamClipAngle,
  MulticamSequence,
  MulticamSwitch,
  MulticamSyncMode,
  NestedSequenceClip,
  PathPoint,
  PathPointHandle,
  PlatformFitSegment,
  PrivacyBlurEffect,
  PrivacyRedactionType,
  Project,
  ProjectAnnotation,
  ProjectDocumentation,
  ProjectPlatformFitSuggestion,
  ProjectSettings,
  ProjectSpeaker,
  ProjectVersion,
  ProtectedRange,
  ReviewAnnotation,
  ReviewAnnotationType,
  RichTextDocument,
  RichTextParagraph,
  RichTextRun,
  Sequence,
  SequenceSettings,
  Subclip,
  SubtitleClip,
  SubtitleLanguage,
  SubtitleMode,
  SubtitleStyle,
  SubtitleTrackType,
  SwitchPoint,
  SwitchTransition,
  TextArcOptions,
  TextBoxFitMode,
  TextClip,
  TextLayoutOptions,
  TextOpenTypeFeatures,
  TextPathOptions,
  TextStyle,
  Timeline,
  TimelineBookmark,
  TimelineLabelColor,
  TimelineMarker,
  TimelineNote,
  Track,
  TrackCompressor,
  TrackEQ,
  TrackEQBand,
  TrackEQBandType,
  TrackType,
  Transform,
  Transition,
  TransitionType,
  VfrHandlingStrategy,
  VideoClip,
  VideoDeinterlaceMode,
  VideoDenoisePreset,
  ZoomEditMode
} from './model-types';

export type { AIColorHistoryEntry } from './model-types';
export type { ClipPrivacyRedaction, PrivacyRedactionType, RedactionKeyframe, ClipAILookMatch, WheelAdjustments, BeatSnapSuggestion, MediaCollection } from './model-types';
export type {
  AdjustmentClip,
  AssetType,
  AudioChannelRoutingMode,
  AudioClip,
  AudioFadeCurve,
  BaseClip,
  ChromaKey,
  ChromaKeyColor,
  ChromaKeyMode,
  Clip,
  ClipAudioDenoise,
  ClipAudioRestoration,
  ClipAudioRestorationGap,
  ClipBorder,
  ClipFrameInterpolation,
  ClipGroup,
  ClipGroupColor,
  ClipKeyframes,
  ClipMask,
  ClipMaskKeyframe,
  ClipPanoramaOutputProjection,
  ClipPitchDataPoint,
  ClipPanoramaView,
  ClipPrivacyBlur,
  ClipProjection,
  ClipQualityEnhancement,
  ClipSlowMotionMode,
  ClipStabilization,
  ClipType,
  ClipVideoDeinterlace,
  ClipVideoRestoration,
  ClipVideoSpatialDenoise,
  ClipVideoTemporalDenoise,
  CollaborationNote,
  CollaborationNoteType,
  ColorCorrection,
  CreditsClip,
  DataSubtitleClip,
  DataSubtitleRow,
  DataSubtitleSource,
  DataSubtitleSourceType,
  ExportRange,
  FrameInterpolationMode,
  FrameInterpolationQuality,
  FrameInterpolationQualityGrade,
  FrameInterpolationTargetFps,
  ImageClip,
  ImageSequenceInfo,
  Keyframe,
  KeyframeEasing,
  KeyframeHandle,
  KeyframeHandleMode,
  KeyframeProperty,
  LUTLayer,
  Mask,
  MaskType,
  MediaAsset,
  MediaFingerprint,
  MediaFingerprintAlgorithm,
  MediaFingerprintKind,
  MediaFlag,
  MediaFolder,
  MediaLabelColor,
  MediaMetadata,
  MotionTrackPoint,
  MotionGraphicClip,
  MulticamAngle,
  MulticamClip,
  MulticamClipAngle,
  MulticamSequence,
  MulticamSwitch,
  MulticamSyncMode,
  NestedSequenceClip,
  PathPoint,
  PathPointHandle,
  PrivacyBlurEffect,
  Project,
  ProjectAnnotation,
  ProjectDocumentation,
  ProjectSettings,
  ProjectSpeaker,
  ProjectVersion,
  ProtectedRange,
  ReviewAnnotation,
  ReviewAnnotationType,
  RichTextDocument,
  RichTextParagraph,
  RichTextRun,
  Sequence,
  SequenceSettings,
  Subclip,
  SubtitleClip,
  SubtitleLanguage,
  SubtitleMode,
  SubtitleStyle,
  SubtitleTrackType,
  SwitchPoint,
  SwitchTransition,
  TextArcOptions,
  TextBoxFitMode,
  TextClip,
  TextLayoutOptions,
  TextOpenTypeFeatures,
  TextPathOptions,
  TextStyle,
  Timeline,
  TimelineBookmark,
  TimelineMarker,
  TimelineNote,
  Track,
  TrackCompressor,
  TrackEQ,
  TrackEQBand,
  TrackEQBandType,
  TrackType,
  Transform,
  Transition,
  TransitionType,
  VfrHandlingStrategy,
  VideoClip,
  VideoDeinterlaceMode,
  VideoDenoisePreset,
  ZoomEditMode
} from './model-types';
export type { TtsSegment, TimingAdaptation, DubbingAdaptationType } from './model-types';
export const MAX_CHROMA_KEY_COLORS = 3;

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

export function normalizeMediaFingerprint(value: unknown): MediaFingerprint | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Partial<MediaFingerprint>;
  const kind = input.kind === 'video' || input.kind === 'audio' || input.kind === 'image' ? input.kind : undefined;
  const algorithm = input.algorithm === 'phash' || input.algorithm === 'rms' || input.algorithm === 'bytes' ? input.algorithm : undefined;
  const hash = typeof input.hash === 'string' ? input.hash.trim() : '';
  if (!kind || !algorithm || !hash) {
    return undefined;
  }
  const fingerprint: MediaFingerprint = {
    version: 1,
    kind,
    algorithm,
    hash
  };
  if (Array.isArray(input.frameHashes)) {
    const frameHashes = input.frameHashes.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    if (frameHashes.length > 0) {
      fingerprint.frameHashes = frameHashes;
    }
  }
  if (Array.isArray(input.rmsVector)) {
    const rmsVector = input.rmsVector.map((item) => Number(item)).filter((item) => Number.isFinite(item)).map((item) => Math.max(0, Math.min(1, item)));
    if (rmsVector.length > 0) {
      fingerprint.rmsVector = rmsVector;
    }
  }
  return fingerprint;
}

export function normalizeMediaMetadataEntry(metadata: MediaMetadata | undefined): MediaMetadata | undefined {
  const labelColor = isMediaLabelColor(metadata?.labelColor) ? metadata.labelColor : undefined;
  const rating = normalizeMediaRating(metadata?.rating);
  const flag = normalizeMediaFlag(metadata?.flag);
  const versions = normalizeMediaVersions(metadata?.versions);
  const fingerprint = normalizeMediaFingerprint(metadata?.fingerprint);
  const title = normalizeMediaMetadataText(metadata?.title, 160);
  const author = normalizeMediaMetadataText(metadata?.author, 160);
  const description = normalizeMediaMetadataText(metadata?.description, 2000);
  const copyright = normalizeMediaMetadataText(metadata?.copyright, 240);
  const date = normalizeMediaMetadataText(metadata?.date, 40);
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
  if (versions) {
    normalized.versions = versions;
  }
  if (fingerprint) {
    normalized.fingerprint = fingerprint;
  }
  if (title) {
    normalized.title = title;
  }
  if (author) {
    normalized.author = author;
  }
  if (description) {
    normalized.description = description;
  }
  if (copyright) {
    normalized.copyright = copyright;
  }
  if (date) {
    normalized.date = date;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMediaMetadataText(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function normalizeMediaColorProfile(profile: Partial<MediaColorProfile> | undefined): MediaColorProfile | undefined {
  if (!profile || typeof profile !== 'object') {
    return undefined;
  }
  const sourceColorSpace = normalizeExportColorSpace(profile.sourceColorSpace);
  const label = typeof profile.label === 'string' && profile.label.trim() ? profile.label.trim().slice(0, 40) : getColorSpaceDisplayName(sourceColorSpace);
  const normalized: MediaColorProfile = {
    sourceColorSpace,
    label
  };
  if (typeof profile.colorSpace === 'string' && profile.colorSpace.trim()) {
    normalized.colorSpace = profile.colorSpace.trim().toLowerCase();
  }
  if (typeof profile.colorPrimaries === 'string' && profile.colorPrimaries.trim()) {
    normalized.colorPrimaries = profile.colorPrimaries.trim().toLowerCase();
  }
  if (typeof profile.colorTransfer === 'string' && profile.colorTransfer.trim()) {
    normalized.colorTransfer = profile.colorTransfer.trim().toLowerCase();
  }
  if (profile.autoConvertToWorkingSpace === true) {
    normalized.autoConvertToWorkingSpace = true;
  }
  return normalized;
}

export type CutProjectFile = ProjectFile;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  fps: 30,
  timecodeFormat: 'ndf',
  width: 1280,
  height: 720,
  vfrHandling: 'ignore',
  colorPipeline: DEFAULT_PROJECT_COLOR_PIPELINE,
  workingColorSpace: 'srgb'
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
    vfrHandling: normalizeVfrHandlingStrategy(settings?.vfrHandling),
    colorPipeline: normalizeProjectColorPipeline(settings?.colorPipeline),
    workingColorSpace: normalizeProjectWorkingColorSpace(settings?.workingColorSpace)
  };
}

export function normalizeVfrHandlingStrategy(value: unknown): VfrHandlingStrategy {
  return value === 'auto-cfr' || value === 'ask' ? value : 'ignore';
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
  luts: [],
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
export const FRAME_INTERPOLATION_MODES: readonly FrameInterpolationMode[] = ['adaptive', 'blend', 'mci', 'copy'];

export const DEFAULT_FRAME_INTERPOLATION: ClipFrameInterpolation = {
  enabled: false,
  targetFps: 60,
  mode: 'adaptive',
  protectionFrames: 2
};

export const CLIP_SLOW_MOTION_MODES: readonly ClipSlowMotionMode[] = ['none', 'blend', 'mci', 'optical-flow'];
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

export const DEFAULT_QUALITY_ENHANCEMENT: ClipQualityEnhancement = {
  superResolution: false,
  deblock: false,
  colorBoost: false,
  frameCompensation: false
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
  'motion-blur-wipe'
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
  shadowOffset: 0
};

export function createId(prefix = 'id'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function normalizeClipBeatMarkers(markers: BeatMarker[] | undefined, maxTime?: number): BeatMarker[] | undefined {
  if (!Array.isArray(markers)) {
    return undefined;
  }
  const limit = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : Number.POSITIVE_INFINITY;
  const normalized = markers
    .filter((marker) => marker && typeof marker.time === 'number' && Number.isFinite(marker.time))
    .map((marker) => ({
      id: typeof marker.id === 'string' && marker.id ? marker.id : createId('beat'),
      time: round(Math.min(limit, Math.max(0, marker.time)))
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeDetectedBpm(bpm: number | undefined): number | undefined {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    return undefined;
  }
  return round(Math.min(400, Math.max(1, bpm)));
}

export function normalizeClipSceneCuts(cuts: number[] | undefined, maxTime?: number): number[] | undefined {
  return normalizeSceneCutTimes(cuts, maxTime);
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

export function createTimelineBookmark(
  bookmark: Omit<TimelineBookmark, 'id' | 'note'> & Partial<Pick<TimelineBookmark, 'id' | 'note' | 'groupId' | 'thumbnailPath' | 'annotation' | 'createdAt'>>,
  maxTime?: number
): TimelineBookmark {
  return {
    id: bookmark.id ?? createId('bookmark'),
    time: normalizeTimelinePointTime(bookmark.time, maxTime),
    note: normalizeTimelineBookmarkNote(bookmark.note),
    ...(bookmark.groupId ? { groupId: bookmark.groupId.trim() } : {}),
    ...(bookmark.thumbnailPath ? { thumbnailPath: bookmark.thumbnailPath } : {}),
    ...(bookmark.annotation !== undefined ? { annotation: normalizeBookmarkAnnotation(bookmark.annotation) } : {}),
    ...(bookmark.createdAt ? { createdAt: bookmark.createdAt } : {})
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

export function createReviewAnnotation(
  annotation: Omit<ReviewAnnotation, 'id' | 'type' | 'text' | 'color' | 'x' | 'y' | 'width' | 'height'> &
    Partial<Pick<ReviewAnnotation, 'id' | 'type' | 'text' | 'color' | 'x' | 'y' | 'width' | 'height'>>,
  maxTime?: number
): ReviewAnnotation {
  const type = normalizeReviewAnnotationType(annotation.type);
  return {
    id: annotation.id ?? createId('review-annotation'),
    time: normalizeTimelinePointTime(annotation.time, maxTime),
    type,
    text: normalizeReviewAnnotationText(annotation.text),
    color: normalizeHexColor(annotation.color, DEFAULT_REVIEW_ANNOTATION_COLOR),
    x: normalizeReviewAnnotationUnit(annotation.x, 0.5),
    y: normalizeReviewAnnotationUnit(annotation.y, 0.5),
    width: normalizeReviewAnnotationDimension(annotation.width, type, 'width'),
    height: normalizeReviewAnnotationDimension(annotation.height, type, 'height')
  };
}

export function createCollaborationNote(
  note: Omit<CollaborationNote, 'id' | 'type' | 'authorName' | 'authorColor' | 'text' | 'resolved' | 'createdAt'> &
    Partial<Pick<CollaborationNote, 'id' | 'type' | 'authorName' | 'authorColor' | 'text' | 'mediaPath' | 'resolved' | 'createdAt' | 'updatedAt'>>,
  maxTime?: number
): CollaborationNote {
  const type = normalizeCollaborationNoteType(note.type);
  const start = normalizeTimelinePointTime(note.start, maxTime);
  const rawEnd = normalizeTimelinePointTime(note.end ?? start, maxTime);
  const end = type === 'comment' ? undefined : round(Math.max(start, rawEnd));
  return {
    id: note.id ?? createId('collaboration-note'),
    type,
    authorName: normalizeCollaborationAuthorName(note.authorName),
    authorColor: normalizeHexColor(note.authorColor, DEFAULT_COLLABORATION_NOTE_COLOR),
    start,
    ...(end !== undefined ? { end } : {}),
    text: normalizeCollaborationNoteText(note.text),
    ...(typeof note.mediaPath === 'string' && note.mediaPath.trim() ? { mediaPath: note.mediaPath.trim() } : {}),
    resolved: note.resolved === true,
    createdAt: normalizeIsoDate(note.createdAt),
    ...(note.updatedAt ? { updatedAt: normalizeIsoDate(note.updatedAt) } : {})
  };
}

export function createTimelineNote(
  note: Omit<TimelineNote, 'id' | 'text' | 'color' | 'createdAt'> & Partial<Pick<TimelineNote, 'id' | 'text' | 'color' | 'createdAt'>>,
  maxTime?: number
): TimelineNote {
  const start = normalizeTimelinePointTime(note.start, maxTime);
  const end = normalizeTimelinePointTime(note.end, maxTime);
  return {
    id: note.id ?? createId('timeline-note'),
    start: round(Math.min(start, end)),
    end: round(Math.max(start, end)),
    text: normalizeTimelineNoteText(note.text),
    color: normalizeTimelineNoteColor(note.color),
    createdAt: normalizeIsoDate(note.createdAt)
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

export function createProtectedRange(
  range: Omit<ProtectedRange, 'id' | 'label'> & Partial<Pick<ProtectedRange, 'id' | 'label'>>,
  maxTime?: number
): ProtectedRange {
  const start = normalizeTimelinePointTime(range.start, maxTime);
  const end = normalizeTimelinePointTime(range.end, maxTime);
  return {
    id: range.id ?? createId('protected-range'),
    label: normalizeProtectedRangeLabel(range.label),
    start: round(Math.min(start, end)),
    end: round(Math.max(start, end))
  };
}

export function createTrack(
  track: Omit<Track, 'language' | 'subtitleType' | 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'> &
    Partial<Pick<Track, 'language' | 'subtitleType' | 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>
): Track {
  const next: Track = {
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
  if (track.type === 'subtitle') {
    next.language = normalizeSubtitleLanguage(track.language);
    next.subtitleType = normalizeSubtitleTrackType(track.subtitleType);
  } else {
    delete next.language;
    delete next.subtitleType;
  }
  return next;
}

export function createProject(name = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  const timeline = createDefaultTimeline();
  return {
    version: '0.2',
    id: createId('project'),
    name,
    releaseVersion: '0.1.0',
    createdAt: now,
    updatedAt: now,
    masterVolume: DEFAULT_MASTER_VOLUME,
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    media: [],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    collaborationNotes: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    coverPath: undefined,
    speakers: [],
    documentation: {},
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID,
    subclips: [],
    beatSnapSuggestions: [],
    mediaCollections: [],
    characterTimeline: undefined,
    preflightReport: undefined
  };
}

export function createSubclip(
  input: Omit<Subclip, "id" | "createdAt"> & Partial<Pick<Subclip, "id" | "createdAt">>
): Subclip {
  return {
    id: input.id ?? createId("subclip"),
    name: input.name,
    sourceMediaId: input.sourceMediaId,
    inPoint: round(Math.max(0, input.inPoint)),
    outPoint: round(Math.max(input.inPoint, input.outPoint)),
    color: normalizeTimelineLabelColor(input.color),
    description: input.description,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function createSequence(sequence: Omit<Sequence, 'id' | 'name'> & Partial<Pick<Sequence, 'id' | 'name'>>): Sequence {
    return {
      id: sequence.id ?? createId('sequence'),
      name: normalizeSequenceName(sequence.name),
      timeline: sequence.timeline,
      ...(sequence.settings ? { settings: sequence.settings } : {})
    };
  }

export function createBaseClip(
  input: Omit<BaseClip, 'id' | 'transform' | 'speed' | 'colorCorrection'> &
    Partial<Pick<BaseClip, 'id' | 'transform' | 'speed' | 'colorCorrection'>>
): BaseClip {
  const beatMarkers = normalizeClipBeatMarkers(input.beatMarkers, input.duration);
  const detectedBpm = normalizeDetectedBpm(input.detectedBpm);
  const scenecuts = normalizeClipSceneCuts(input.scenecuts, input.duration);
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
    ...(input.colorNodeGraph ? { colorNodeGraph: normalizeColorNodeGraph(input.colorNodeGraph, input.colorCorrection) } : {}),
    ...(input.colorGradingGraph ? { colorGradingGraph: normalizeColorGradingGraph(input.colorGradingGraph) } : {}),
    transform: normalizeTransform(input.transform),
    chromaKey: normalizeChromaKey(input.chromaKey),
    stabilization: normalizeStabilization(input.stabilization),
    frameInterpolation: normalizeFrameInterpolation(input.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(input.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(input.audioDenoise),
    audioRestoration: normalizeAudioRestoration(input.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(input.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(input.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(input.qualityEnhancement),
    projection: normalizeClipProjection(input.projection),
    panorama: normalizeClipPanoramaView(input.panorama),
    masks: normalizeMasks(input.masks),
    motionTrack: normalizeMotionTrack(input.motionTrack, input.duration),
    border: normalizeClipBorder(input.border),
    keyframes: cloneClipKeyframesLocal(input.keyframes),
    effects: cloneEffects(input.effects),
    sequenceFrameRate: normalizeSequenceFrameRate(input.sequenceFrameRate),
    blendMode: normalizeClipBlendMode(input.blendMode),
    contentAnalysis: normalizeClipContentAnalysis(input.contentAnalysis),
    pitchData: normalizeClipPitchData(input.pitchData),
    ...(beatMarkers ? { beatMarkers } : {}),
    ...(detectedBpm !== undefined ? { detectedBpm } : {}),
    ...(scenecuts ? { scenecuts } : {}),
    ...(Array.isArray(input.aiColorHistory) ? { aiColorHistory: input.aiColorHistory.slice(0, 3) } : {}),
    ...(Array.isArray(input.privacyRedactions) ? { privacyRedactions: normalizePrivacyRedactions(input.privacyRedactions) } : {}),
    ...(input.beatSnapped === true ? { beatSnapped: true } : {}),
    ...(input.aiLookMatch && typeof input.aiLookMatch === 'object' ? { aiLookMatch: normalizeAILookMatch(input.aiLookMatch) } : {}),
    ...(input.aiPipSuggestion && typeof input.aiPipSuggestion === 'object' ? { aiPipSuggestion: normalizeAiPipSuggestion(input.aiPipSuggestion) } : {}),
    ...(Array.isArray(input.flashWarnings) ? { flashWarnings: normalizeFlashWarnings(input.flashWarnings) } : {})
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
    spatialAudio: normalizeSpatialAudio(input.spatialAudio),
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

export function createMotionGraphicClip(
  input: Omit<MotionGraphicClip, 'id' | 'type' | 'transform' | 'speed' | 'colorCorrection' | 'motionGraphic'> &
    Partial<Pick<MotionGraphicClip, 'id' | 'transform' | 'speed' | 'colorCorrection' | 'motionGraphic'>>
): MotionGraphicClip {
  return {
    ...createBaseClip(input),
    type: 'motion-graphic',
    motionGraphic: normalizeMotionGraphic(input.motionGraphic, input.duration)
  };
}

export function createCreditsClip(
  input: Omit<CreditsClip, 'id' | 'type' | 'transform' | 'speed' | 'colorCorrection' | 'rows' | 'rollSpeed' | 'style'> &
    Partial<Pick<CreditsClip, 'id' | 'transform' | 'speed' | 'colorCorrection' | 'rows' | 'rollSpeed' | 'style'>>
): CreditsClip {
  const text = typeof input.text === 'string' ? input.text : '';
  return {
    ...createBaseClip(input),
    type: 'credits',
    text,
    rows: normalizeCreditsRows(input.rows, text),
    rollSpeed: normalizeCreditsRollSpeed(input.rollSpeed),
    style: normalizeCreditsStyle(input.style)
  };
}

export function createMulticamClip(
  angles: MulticamClipAngle[],
  syncMode: MulticamSyncMode,
  syncReferenceAngle: number
): MulticamClip {
  if (syncReferenceAngle < 0 || syncReferenceAngle >= angles.length) {
    throw new Error('syncReferenceAngle out of range');
  }

  const baseClip = createBaseClip({
    name: 'Multicam Clip',
    trackId: '',
    start: 0,
    duration: 0,
    trimStart: 0,
    trimEnd: 0
  });
  return {
    ...baseClip,
    type: 'multicam',
    angles: angles.map(a => ({
      ...a,
      ...(a.colorCorrection ? { colorCorrection: { ...a.colorCorrection } } : {}),
      ...(a.transform ? { transform: { ...a.transform } } : {})
    })),
    activeAngle: 0,
    switchPoints: [],
    syncMode,
    syncReferenceAngle
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
    luts: normalizeLutLayers(colorCorrection?.luts, colorCorrection?.lutPath),
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
    trfPath,
    ...normalizeShakeAnalysisFields(stabilization)
  };
}

function normalizeShakeAnalysisFields(stabilization: Partial<ClipStabilization> | undefined): {
  shakeScore?: number;
  severity?: 'low' | 'medium' | 'high';
  suggestedFilter?: 'vidstab' | 'none';
  sampledAt?: number;
} {
  if (!stabilization?.shakeScore && stabilization?.shakeScore !== 0) return {};
  const score = round(Math.max(0, Math.min(100, stabilization.shakeScore)));
  const validSeverities = ['low', 'medium', 'high'] as const;
  const severity = validSeverities.includes(stabilization.severity as typeof validSeverities[number])
    ? stabilization.severity as typeof validSeverities[number]
    : score < 20 ? 'low' : score <= 50 ? 'medium' : 'high';
  return {
    shakeScore: score,
    severity,
    suggestedFilter: stabilization.suggestedFilter === 'vidstab' ? 'vidstab' : 'none',
    sampledAt: typeof stabilization.sampledAt === 'number' && Number.isFinite(stabilization.sampledAt) ? stabilization.sampledAt : undefined
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
  const normalized: ClipFrameInterpolation = {
    enabled: frameInterpolation?.enabled === true,
    targetFps,
    mode: FRAME_INTERPOLATION_MODES.includes(frameInterpolation?.mode as FrameInterpolationMode) ? (frameInterpolation?.mode as FrameInterpolationMode) : DEFAULT_FRAME_INTERPOLATION.mode,
    protectionFrames: Math.min(5, Math.max(0, Math.round(Number.isFinite(frameInterpolation?.protectionFrames) ? frameInterpolation!.protectionFrames! : DEFAULT_FRAME_INTERPOLATION.protectionFrames)))
  };
  if (frameInterpolation?.quality && Number.isFinite(frameInterpolation.quality.ssim)) {
    normalized.quality = {
      ssim: Math.max(0, Math.min(1, frameInterpolation.quality.ssim)),
      grade:
        frameInterpolation.quality.grade === 'excellent' || frameInterpolation.quality.grade === 'good' || frameInterpolation.quality.grade === 'poor'
          ? frameInterpolation.quality.grade
          : 'poor',
      sampleCount: Math.max(0, Math.round(Number.isFinite(frameInterpolation.quality.sampleCount) ? frameInterpolation.quality.sampleCount : 0)),
      ...(typeof frameInterpolation.quality.evaluatedAt === 'string' ? { evaluatedAt: frameInterpolation.quality.evaluatedAt } : {})
    };
  }
  return normalized;
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
  return curve === 'ease-in' || curve === 'ease-out' || curve === 'ease-in-out' || curve === 'linear' ? curve : DEFAULT_AUDIO_FADE_CURVE;
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
    switches: Array.from(byTime.values()).sort((left, right) => left.time - right.time || left.id.localeCompare(right.id)),
    aiCutSuggestions: normalizeAiCutSuggestions(multicam.aiCutSuggestions, angleIds)
  };
}

function normalizeAiCutSuggestions(
  suggestions: unknown,
  validAngleIds: Set<string>
): MulticamAiCutSuggestion[] | undefined {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return undefined;
  const normalized = suggestions
    .filter(
      (s): s is Record<string, unknown> =>
        s != null &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).time === 'number' &&
        typeof (s as Record<string, unknown>).angleId === 'string'
    )
    .map((s) => ({
      time: round(Math.max(0, (s as { time: number }).time)),
      angleId: ((s as { angleId: string }).angleId || '').trim(),
      confidence: typeof (s as { confidence?: unknown }).confidence === 'number' &&
        Number.isFinite((s as { confidence: number }).confidence)
        ? round(Math.min(1, Math.max(0, (s as { confidence: number }).confidence)))
        : 0.5,
      reason: typeof (s as { reason?: unknown }).reason === 'string'
        ? ((s as { reason: string }).reason || '').trim().slice(0, 200)
        : ''
    }))
    .filter((s) => s.angleId.length > 0 && validAngleIds.has(s.angleId))
    .sort((a, b) => a.time - b.time);
  return normalized.length > 0 ? normalized : undefined;
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

export function normalizeQualityEnhancement(enhancement: Partial<ClipQualityEnhancement> | undefined): ClipQualityEnhancement {
  return {
    superResolution: enhancement?.superResolution === true,
    deblock: enhancement?.deblock === true,
    colorBoost: enhancement?.colorBoost === true,
    frameCompensation: enhancement?.frameCompensation === true
  };
}

export function normalizeTimelineBookmark(bookmark: TimelineBookmark, maxTime?: number): TimelineBookmark {
  return createTimelineBookmark(bookmark, maxTime);
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

export function normalizeTimelineBookmarks(bookmarks: TimelineBookmark[] | undefined, maxTime?: number): TimelineBookmark[] {
  return [...(bookmarks ?? [])]
    .map((bookmark) => normalizeTimelineBookmark(bookmark, maxTime))
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

export function normalizeReviewAnnotation(annotation: ReviewAnnotation, maxTime?: number): ReviewAnnotation {
  return createReviewAnnotation(annotation, maxTime);
}

export function normalizeReviewAnnotations(annotations: ReviewAnnotation[] | undefined, maxTime?: number): ReviewAnnotation[] {
  return [...(annotations ?? [])]
    .map((annotation) => normalizeReviewAnnotation(annotation, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeCollaborationNote(note: CollaborationNote, maxTime?: number): CollaborationNote {
  return createCollaborationNote(note, maxTime);
}

export function normalizeCollaborationNotes(notes: CollaborationNote[] | undefined, maxTime?: number): CollaborationNote[] {
  return [...(notes ?? [])]
    .map((note) => normalizeCollaborationNote(note, maxTime))
    .sort((left, right) => left.start - right.start || (left.end ?? left.start) - (right.end ?? right.start) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

export function normalizeTimelineNote(note: TimelineNote, maxTime?: number): TimelineNote | undefined {
  const normalized = createTimelineNote(note, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeTimelineNotes(notes: TimelineNote[] | undefined, maxTime?: number): TimelineNote[] {
  return [...(notes ?? [])]
    .flatMap((note) => {
      const normalized = normalizeTimelineNote(note, maxTime);
      return normalized ? [normalized] : [];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
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

export function normalizeProtectedRange(range: ProtectedRange, maxTime?: number): ProtectedRange | undefined {
  const normalized = createProtectedRange(range, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeProtectedRanges(ranges: ProtectedRange[] | undefined, maxTime?: number): ProtectedRange[] {
  return [...(ranges ?? [])]
    .flatMap((range) => {
      const normalized = normalizeProtectedRange(range, maxTime);
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

export function normalizeSubtitleLanguage(language: unknown): SubtitleLanguage {
  if (typeof language !== 'string') {
    return DEFAULT_SUBTITLE_LANGUAGE;
  }
  const primary = language.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return /^[a-z]{2}$/.test(primary) ? primary : DEFAULT_SUBTITLE_LANGUAGE;
}

export function normalizeSubtitleTrackType(value: unknown): SubtitleTrackType {
  return value === 'cc' ? 'cc' : DEFAULT_SUBTITLE_TRACK_TYPE;
}

export function normalizeSubtitleSpeaker(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeSubtitleSoundDesc(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^\[[^\]]+\]$/.test(trimmed) ? trimmed : `[${trimmed.replace(/^\[|\]$/g, '').trim()}]`;
}

export function normalizeProjectSpeakers(speakers: unknown): ProjectSpeaker[] {
  if (!Array.isArray(speakers)) {
    return [];
  }
  const output: ProjectSpeaker[] = [];
  const seen = new Set<string>();
  for (const speaker of speakers) {
    if (!speaker || typeof speaker !== 'object') {
      continue;
    }
    const name = normalizeSubtitleSpeaker((speaker as ProjectSpeaker).name);
    if (!name) {
      continue;
    }
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const id = normalizeSubtitleSpeaker((speaker as ProjectSpeaker).id) ?? createId('speaker');
    const color = normalizeOptionalHexColor((speaker as ProjectSpeaker).color);
    output.push(color ? { id, name, color } : { id, name });
  }
  return output;
}

export function normalizeSubtitleLanguageList(languages: unknown): SubtitleLanguage[] | undefined {
  if (!Array.isArray(languages)) {
    return undefined;
  }
  const output: SubtitleLanguage[] = [];
  const seen = new Set<string>();
  for (const language of languages) {
    const normalized = normalizeSubtitleLanguage(language);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
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
  return type && TRANSITION_TYPES.includes(type) ? type : DEFAULT_TRANSITION_TYPE;
}

export function normalizeTransitionDuration(duration: number | undefined): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return DEFAULT_TRANSITION_DURATION;
  }
  return round(Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, duration)));
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
    (normalized.luts?.length ?? 0) === 0 &&
    isDefaultColorCurves(normalized.colorCurves) &&
    isNeutralThreeWayColor(normalized.threeWayColor)
  );
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
          audioRestoration: normalizeAudioRestoration(clip.audioRestoration),
          videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
          qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
          projection: normalizeClipProjection(clip.projection),
          panorama: normalizeClipPanoramaView(clip.panorama),
          masks: normalizeMasks(clip.masks),
          motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
          border: normalizeClipBorder(clip.border),
          multicam: clip.type === 'nested-sequence' ? normalizeMulticamSequence(clip.multicam, clip.duration) : undefined,
          ...(clip.type === 'motion-graphic' ? { motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration) } : {}),
          sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
          keyframes: cloneClipKeyframesLocal(clip.keyframes),
          pitchData: normalizeClipPitchData(clip.pitchData),
          dataSubtitle: clip.type === 'subtitle' ? normalizeDataSubtitleSource(clip.dataSubtitle) : undefined,
          readingSpeedWarning: clip.type === 'subtitle' ? normalizeReadingSpeedWarning((clip as { readingSpeedWarning?: unknown }).readingSpeedWarning) : undefined
        })),
        musicStructure: normalizeMusicStructurePoints((track as { musicStructure?: unknown }).musicStructure)
      })),
      continuityWarnings: normalizeContinuityWarnings((project.timeline as { continuityWarnings?: unknown }).continuityWarnings)
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

function normalizeTimelineBookmarkNote(note: string | undefined): string {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, 120) : 'Bookmark';
}

function normalizeBookmarkAnnotation(annotation: string | undefined): string | undefined {
  const trimmed = annotation?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 50);
}

function normalizeTimelineMarkerColor(color: string | undefined): string {
  return normalizeHexColor(color, DEFAULT_TIMELINE_MARKER_COLOR);
}

function normalizeProjectAnnotationText(text: string | undefined): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 240) : 'Annotation';
}

function normalizeReviewAnnotationText(text: string | undefined): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 240) : 'Review annotation';
}

function normalizeCollaborationNoteText(text: string | undefined): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 2000) : 'Collaboration note';
}

function normalizeCollaborationAuthorName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 80) : DEFAULT_COLLABORATION_NOTE_AUTHOR;
}

function normalizeTimelineNoteText(text: string | undefined): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 240) : 'Timeline note';
}

function normalizeCollaborationNoteType(type: CollaborationNoteType | undefined): CollaborationNoteType {
  return type === 'highlight' || type === 'replacement' || type === 'comment' ? type : 'comment';
}

function normalizeReviewAnnotationType(type: ReviewAnnotationType | undefined): ReviewAnnotationType {
  return type === 'rectangle' || type === 'arrow' || type === 'text' ? type : 'text';
}

function normalizeReviewAnnotationUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}

function normalizeReviewAnnotationDimension(value: number | undefined, type: ReviewAnnotationType, axis: 'width' | 'height'): number {
  const fallback = type === 'text' ? (axis === 'width' ? 0.22 : 0.08) : type === 'arrow' ? 0.12 : 0.18;
  const finite = finiteOrDefault(value, fallback);
  if (type === 'arrow') {
    return round(Math.min(1, Math.max(-1, finite || fallback)));
  }
  return round(Math.min(1, Math.max(0.01, Math.abs(finite || fallback))));
}

function normalizeTimelineNoteColor(color: string | undefined): string {
  const normalized = normalizeHexColor(color, DEFAULT_TIMELINE_NOTE_COLOR);
  return (TIMELINE_NOTE_COLORS as readonly string[]).includes(normalized) ? normalized : DEFAULT_TIMELINE_NOTE_COLOR;
}

function normalizeIsoDate(value: string | undefined): string {
  if (value && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function normalizeExportRangeLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Export Range';
}

function normalizeProtectedRangeLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Protected Range';
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
  const trimmed = color?.trim();
  if (!trimmed) return fallback;
  const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (three) {
    const [r, g, b] = three[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function normalizeOptionalHexColor(color: string | undefined): string | undefined {
  const trimmed = color?.trim();
  if (!trimmed) return undefined;
  const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (three) {
    const [r, g, b] = three[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return undefined;
}

function normalizeLutPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeLutLayers(luts: LUTLayer[] | undefined, lutPath?: string | null): LUTLayer[] {
  // If luts array is explicitly provided, normalize it (max 3, filter intensity=0)
  if (luts && luts.length > 0) {
    return luts
      .slice(0, 3)
      .map((l) => ({
        path: (typeof l.path === 'string' ? l.path.trim() : '') || '',
        intensity: round(Math.min(1, Math.max(0, typeof l.intensity === 'number' ? l.intensity : 1)))
      }))
      .filter((l) => l.path.length > 0);
  }
  // Backward compat: upgrade legacy lutPath string to single LUTLayer
  const normalizedPath = normalizeLutPath(lutPath);
  if (normalizedPath) {
    return [{ path: normalizedPath, intensity: 1 }];
  }
  return [];
}

export function normalizeClipAIReframe(value: unknown): import('./ai-reframe').ClipAIReframe | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  const targetAspect = typeof obj.targetAspect === 'string' ? obj.targetAspect : undefined;
  const confidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? obj.confidence : undefined;
  const generatedAt = typeof obj.generatedAt === 'number' && Number.isFinite(obj.generatedAt) ? obj.generatedAt : undefined;
  if (!targetAspect || confidence === undefined || generatedAt === undefined) {
    return undefined;
  }
  if (!Array.isArray(obj.keyframes)) {
    return undefined;
  }
  const keyframes: import('./ai-reframe').ReframeKeyframe[] = [];
  for (const kf of obj.keyframes) {
    if (!kf || typeof kf !== 'object') continue;
    const k = kf as Record<string, unknown>;
    const time = typeof k.time === 'number' ? k.time : undefined;
    const cropX = typeof k.cropX === 'number' ? k.cropX : undefined;
    const cropY = typeof k.cropY === 'number' ? k.cropY : undefined;
    const cropW = typeof k.cropW === 'number' ? k.cropW : undefined;
    const cropH = typeof k.cropH === 'number' ? k.cropH : undefined;
    if (time !== undefined && cropX !== undefined && cropY !== undefined && cropW !== undefined && cropH !== undefined) {
      keyframes.push({ time, cropX, cropY, cropW, cropH });
    }
  }
  if (keyframes.length === 0) {
    return undefined;
  }
  return { targetAspect, keyframes, confidence: Math.min(1, Math.max(0, confidence)), generatedAt };
}

export function normalizeAnomalyIntervals(value: unknown): import('./anomaly-detection').AnomalyInterval[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const validTypes = new Set(['black', 'static']);
  const validSeverities = new Set(['low', 'medium', 'high']);
  const result: import('./anomaly-detection').AnomalyInterval[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const typ = validTypes.has(r.type as string) ? (r.type as import('./anomaly-detection').AnomalyType) : undefined;
    const startTime = typeof r.startTime === 'number' ? r.startTime : undefined;
    const endTime = typeof r.endTime === 'number' ? r.endTime : undefined;
    const severity = validSeverities.has(r.severity as string) ? (r.severity as import('./anomaly-detection').AnomalySeverity) : undefined;
    if (typ !== undefined && startTime !== undefined && endTime !== undefined && severity !== undefined && endTime > startTime) {
      result.push({ type: typ, startTime, endTime, severity });
    }
  }
  return result;
}

export function normalizeSubtitleSpeakerId(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value !== Math.floor(value)) {
    return undefined;
  }
  return value;
}

export function normalizeSpeakerLabels(value: unknown): Record<number, string> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const result: Record<number, string> = {};
  let hasEntries = false;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const numKey = Number(key);
    if (!Number.isFinite(numKey) || numKey < 0 || numKey !== Math.floor(numKey)) continue;
    if (typeof val !== 'string') continue;
    result[numKey] = val;
    hasEntries = true;
  }
  return hasEntries ? result : undefined;
}

function cloneClipKeyframesLocal(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const output: ClipKeyframes = {};
  for (const property of Object.keys(keyframes) as KeyframeProperty[]) {
    const frames = keyframes[property];
    if (frames?.length) {
      output[property] = frames.map((frame) => ({
        ...frame,
        ...(frame.inHandle ? { inHandle: { ...frame.inHandle } } : {}),
        ...(frame.outHandle ? { outHandle: { ...frame.outHandle } } : {})
      }));
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function normalizePrivacyRedactions(input: unknown): ClipPrivacyRedaction[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .filter((r) => typeof r.id === 'string' && (r.type === 'face' || r.type === 'license_plate' || r.type === 'screen'))
    .map((r) => ({
      id: r.id as string,
      type: r.type as PrivacyRedactionType,
      keyframes: Array.isArray(r.keyframes)
        ? r.keyframes
            .filter((k): k is Record<string, unknown> => k != null && typeof k === 'object' && typeof k.time === 'number')
            .map((k) => ({
              time: round(Math.max(0, k.time as number)),
              x: round(Math.min(1, Math.max(0, typeof k.x === 'number' ? k.x : 0))),
              y: round(Math.min(1, Math.max(0, typeof k.y === 'number' ? k.y : 0))),
              w: round(Math.min(1, Math.max(0.001, typeof k.w === 'number' ? k.w : 0.1))),
              h: round(Math.min(1, Math.max(0.001, typeof k.h === 'number' ? k.h : 0.1)))
            }))
            .sort((a, b) => a.time - b.time)
        : [],
      blurStrength: typeof r.blurStrength === 'number' && Number.isFinite(r.blurStrength) ? Math.min(1, Math.max(0, r.blurStrength)) : 1,
      enabled: r.enabled !== false
    }));
}

export function normalizeAILookMatch(input: unknown): ClipAILookMatch | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  if (typeof obj.sourceImageHash !== 'string' || !obj.sourceImageHash) return undefined;
  if (!obj.wheelAdjustments || typeof obj.wheelAdjustments !== 'object') return undefined;
  const wa = obj.wheelAdjustments as Record<string, unknown>;
  const parseRgb = (v: unknown): { r: number; g: number; b: number } => {
    if (!v || typeof v !== 'object') return { r: 0, g: 0, b: 0 };
    const o = v as Record<string, unknown>;
    return { r: typeof o.r === 'number' ? o.r : 0, g: typeof o.g === 'number' ? o.g : 0, b: typeof o.b === 'number' ? o.b : 0 };
  };
  const clampWheel = (v: { r: number; g: number; b: number }) => ({
    r: round(Math.min(1, Math.max(-1, v.r))),
    g: round(Math.min(1, Math.max(-1, v.g))),
    b: round(Math.min(1, Math.max(-1, v.b)))
  });
  return {
    sourceImageHash: obj.sourceImageHash as string,
    wheelAdjustments: { lift: clampWheel(parseRgb(wa.lift)), gamma: clampWheel(parseRgb(wa.gamma)), gain: clampWheel(parseRgb(wa.gain)) },
    curveControlPoints: typeof obj.curveControlPoints === 'object' && obj.curveControlPoints
      ? obj.curveControlPoints as ClipAILookMatch['curveControlPoints']
      : { master: [{ x: 0, y: 0 }, { x: 1, y: 1 }], r: [{ x: 0, y: 0 }, { x: 1, y: 1 }], g: [{ x: 0, y: 0 }, { x: 1, y: 1 }], b: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? Math.min(1, Math.max(0, obj.confidence)) : 0,
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
    blendStrength: typeof obj.blendStrength === 'number' && Number.isFinite(obj.blendStrength) ? Math.min(100, Math.max(0, obj.blendStrength)) : 100
  };
}

export function normalizeAiPipSuggestion(input: unknown): AiPipPlacementSuggestion | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  const validCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  const corner = validCorners.includes(obj.recommendedCorner as typeof validCorners[number])
    ? (obj.recommendedCorner as typeof validCorners[number])
    : 'bottom-right';
  return {
    recommendedCorner: corner,
    overlapReduction: typeof obj.overlapReduction === 'number' && Number.isFinite(obj.overlapReduction)
      ? round(Math.min(100, Math.max(0, obj.overlapReduction)))
      : 0,
    confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
      ? round(Math.min(1, Math.max(0, obj.confidence)))
      : 0.5
  };
}

export function normalizePlatformFitSuggestion(input: unknown): ProjectPlatformFitSuggestion | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  const validPlatforms = ['tiktok', 'reels', 'shorts', 'custom'] as const;
  const platform = validPlatforms.includes(obj.targetPlatform as typeof validPlatforms[number])
    ? (obj.targetPlatform as typeof validPlatforms[number])
    : 'custom';
  const limitSeconds = typeof obj.limitSeconds === 'number' && Number.isFinite(obj.limitSeconds) && obj.limitSeconds > 0
    ? round(obj.limitSeconds)
    : 60;
  const normalizeSegments = (segs: unknown): PlatformFitSegment[] => {
    if (!Array.isArray(segs)) return [];
    return segs
      .filter((s): s is Record<string, unknown> =>
        s != null && typeof s === 'object' &&
        typeof (s as Record<string, unknown>).clipId === 'string' &&
        typeof (s as Record<string, unknown>).start === 'number' &&
        typeof (s as Record<string, unknown>).end === 'number'
      )
      .map((s) => ({
        clipId: (s.clipId as string).trim(),
        start: round(Math.max(0, s.start as number)),
        end: round(Math.max(0, s.end as number)),
        score: typeof s.score === 'number' && Number.isFinite(s.score)
          ? round(Math.min(1, Math.max(0, s.score as number)))
          : 0.5
      }))
      .filter((s) => s.clipId.length > 0 && s.end > s.start);
  };
  return {
    targetPlatform: platform,
    limitSeconds,
    keptSegments: normalizeSegments(obj.keptSegments),
    removedSegments: normalizeSegments(obj.removedSegments)
  };
}
/** Normalize flash warnings array */
function normalizeFlashWarnings(input: unknown): import('./flash-warning').FlashWarning[] {
  if (!Array.isArray(input)) return [];
  return input.filter((w): w is import('./flash-warning').FlashWarning =>
    w != null && typeof w === 'object' &&
    typeof (w as Record<string, unknown>).startTime === 'number' &&
    typeof (w as Record<string, unknown>).endTime === 'number' &&
    typeof (w as Record<string, unknown>).flashRate === 'number' &&
    typeof (w as Record<string, unknown>).severity === 'string' &&
    typeof (w as Record<string, unknown>).isRedFlash === 'boolean'
  );
}

/** Normalize reading speed warning */
function normalizeReadingSpeedWarning(input: unknown): import('./subtitle-reading-speed').ReadingSpeedWarning | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.charsPerSecond !== 'number' || typeof obj.recommendedMax !== 'number' || typeof obj.severity !== 'string') return null;
  const validSeverities = ['ok', 'warning', 'critical'];
  if (!validSeverities.includes(obj.severity as string)) return null;
  return { charsPerSecond: obj.charsPerSecond, recommendedMax: obj.recommendedMax, severity: obj.severity as import('./subtitle-reading-speed').ReadingSpeedSeverity };
}

/** Normalize music structure points */
function normalizeMusicStructurePoints(input: unknown): import('./music-structure').MusicStructurePoint[] {
  if (!Array.isArray(input)) return [];
  return input.filter((p): p is import('./music-structure').MusicStructurePoint =>
    p != null && typeof p === 'object' &&
    typeof (p as Record<string, unknown>).time === 'number' &&
    typeof (p as Record<string, unknown>).type === 'string' &&
    typeof (p as Record<string, unknown>).confidence === 'number'
  );
}

/** Normalize continuity warnings */
function normalizeContinuityWarnings(input: unknown): import('./continuity-check').ContinuityWarning[] {
  if (!Array.isArray(input)) return [];
  return input.filter((w): w is import('./continuity-check').ContinuityWarning =>
    w != null && typeof w === 'object' &&
    typeof (w as Record<string, unknown>).clipAId === 'string' &&
    typeof (w as Record<string, unknown>).clipBId === 'string' &&
    typeof (w as Record<string, unknown>).type === 'string' &&
    typeof (w as Record<string, unknown>).confidence === 'number' &&
    typeof (w as Record<string, unknown>).reason === 'string'
  );
}

/** 规范化混音器总线 */
function normalizeBus(raw: any): AudioBus {
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : createId('bus'),
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Bus',
    type: raw?.type === 'submix' || raw?.type === 'send' || raw?.type === 'aux' || raw?.type === 'master' ? raw.type : 'submix',
    effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
    volume: typeof raw?.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 0,
    pan: typeof raw?.pan === 'number' && Number.isFinite(raw.pan) ? clamp(raw.pan, -100, 100) : 0,
    muted: !!raw?.muted,
    outputBusId: raw?.outputBusId ?? null,
  };
}

/** 规范化混音器通道 */
function normalizeMixerChannel(raw: any): MixerChannel {
  return {
    trackId: typeof raw?.trackId === 'string' ? raw.trackId : '',
    name: typeof raw?.name === 'string' ? raw.name : '',
    volume: typeof raw?.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 0,
    pan: typeof raw?.pan === 'number' && Number.isFinite(raw.pan) ? clamp(raw.pan, -100, 100) : 0,
    muted: !!raw?.muted,
    solo: !!raw?.solo,
    busAssignments: Array.isArray(raw?.busAssignments) ? raw.busAssignments : [],
    inputBus: typeof raw?.inputBus === 'string' ? raw.inputBus : null,
    effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
    automation: raw?.automation ?? {},
    metering: raw?.metering ?? { peakLevel: -60, rmsLevel: -60, clipCount: 0 },
  };
}

/** 规范化混音器状态 */
export function normalizeMixerState(raw: any): MixerState | undefined {
  if (!raw) return undefined;
  return {
    channels: Array.isArray(raw.channels)
      ? raw.channels.map(normalizeMixerChannel)
      : [],
    buses: Array.isArray(raw.buses)
      ? raw.buses.map(normalizeBus)
      : [],
    masterBus: raw.masterBus ? normalizeBus(raw.masterBus) : createBus('Master', 'master'),
  };
}
