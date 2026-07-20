export type { AIColorHistoryEntry } from '../model-types';
export type {
  ClipPrivacyRedaction,
  PrivacyRedactionType,
  RedactionKeyframe,
  ClipAILookMatch,
  WheelAdjustments,
  BeatSnapSuggestion,
  MediaCollection,
} from '../model-types';
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
  ZoomEditMode,
} from '../model-types';
export type { TtsSegment, TimingAdaptation, DubbingAdaptationType } from '../model-types';

import { getColorSpaceDisplayName, normalizeExportColorSpace, type MediaColorProfile } from '../color-management';
import { normalizeMediaVersions } from '../media-versions';
import type { MediaFingerprint, MediaFlag, MediaLabelColor, MediaMetadata } from '../model-types';
import type { ProjectFile } from '../project/project-types';

export function isMediaLabelColor(value: unknown): value is MediaLabelColor {
  return (
    value === 'red' ||
    value === 'orange' ||
    value === 'yellow' ||
    value === 'green' ||
    value === 'blue' ||
    value === 'purple'
  );
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
  const algorithm =
    input.algorithm === 'phash' || input.algorithm === 'rms' || input.algorithm === 'bytes'
      ? input.algorithm
      : undefined;
  const hash = typeof input.hash === 'string' ? input.hash.trim() : '';
  if (!kind || !algorithm || !hash) {
    return undefined;
  }
  const fingerprint: MediaFingerprint = {
    version: 1,
    kind,
    algorithm,
    hash,
  };
  if (Array.isArray(input.frameHashes)) {
    const frameHashes = input.frameHashes.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    if (frameHashes.length > 0) {
      fingerprint.frameHashes = frameHashes;
    }
  }
  if (Array.isArray(input.rmsVector)) {
    const rmsVector = input.rmsVector
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .map((item) => Math.max(0, Math.min(1, item)));
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

export function normalizeMediaColorProfile(
  profile: Partial<MediaColorProfile> | undefined,
): MediaColorProfile | undefined {
  if (!profile || typeof profile !== 'object') {
    return undefined;
  }
  const sourceColorSpace = normalizeExportColorSpace(profile.sourceColorSpace);
  const label =
    typeof profile.label === 'string' && profile.label.trim()
      ? profile.label.trim().slice(0, 40)
      : getColorSpaceDisplayName(sourceColorSpace);
  const normalized: MediaColorProfile = {
    sourceColorSpace,
    label,
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
