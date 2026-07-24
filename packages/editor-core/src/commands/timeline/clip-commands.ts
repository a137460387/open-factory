import {
  createId,
  createMulticamClip,
  createMask,
  createCollaborationNote,
  createNestedSequenceClip,
  createProjectAnnotation,
  createReviewAnnotation,
  createSequence,
  createSubclip,
  createTimelineNote,
  createTimelineBookmark,
  createTransition,
  createTimelineMarker,
  createTrack,
  type MediaFolder,
  DEFAULT_CLIP_SPEED,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_NESTED_SEQUENCE_NAME,
  getProjectSequences,
  normalizeMasterVolume,
  normalizeMulticamSequence,
  type AudioFadeCurve,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeHandle,
  type KeyframeHandleMode,
  type KeyframeProperty,
  normalizeColorCorrection,
  normalizeChromaKey,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
  normalizeAudioPitchSemitones,
  normalizeClipBorder,
  normalizeClipBeatMarkers,
  normalizeCollaborationNote,
  normalizeCollaborationNotes,
  normalizeDetectedBpm,
  normalizeClipSceneCuts,
  normalizeFrameInterpolation,
  normalizeMask,
  normalizeMasks,
  normalizeMotionTrack,
  normalizeProjectAnnotation,
  normalizeReviewAnnotation,
  normalizeTimelineNote,
  normalizeTimelineNotes,
  normalizeExportRanges,
  normalizeProtectedRanges,
  normalizeProjectSettings,
  normalizeProjectSpeakers,
  normalizeMediaMetadataEntry,
  normalizeQualityEnhancement,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeSubtitleSoundDesc,
  normalizeSubtitleSpeaker,
  normalizeSubtitleTrackType,
  normalizeTextPath,
  normalizeTimelineBookmark,
  normalizeTimelineBookmarks,
  normalizeTimelineMarker,
  normalizeTransform,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeTrackPan,
  normalizeTrackVolume,
  normalizeVideoRestoration,
  replaceProjectActiveTimeline,
  type Clip,
  type ClipGroup,
  type ClipGroupColor,
  type MediaAsset,
  type ClipAudioDenoise,
  type ClipBorder,
  type ClipKeyframes,
  type ClipPanoramaView,
  type ClipProjection,
  type ClipQualityEnhancement,
  type ChromaKey,
  type ClipFrameInterpolation,
  type ClipStabilization,
  type ClipMask,
  type ClipVideoRestoration,
  type CollaborationNote,
  type ColorCorrection,
  type MediaMetadata,
  type MotionTrackPoint,
  type Project,
  type Subclip,
  type ProjectAnnotation,
  type ProjectDocumentation,
  type ProjectSpeaker,
  type ReviewAnnotation,
  type TimelineNote,
  type ExportRange,
  type ProtectedRange,
  type ProjectSettings,
  type SubtitleMode,
  type SubtitleTrackType,
  type SubtitleStyle,
  type TextPathOptions,
  type TextStyle,
  type Timeline,
  type TimelineBookmark,
  type TimelineMarker,
  type Track,
  type Transition,
  type TransitionType,
  type Transform,
} from '../../../model';
import type {
  BeatSnapSuggestion,
  MediaCollection,
  MulticamClip,
  MulticamClipAngle,
  MulticamSyncMode,
  ProjectPlatformFitSuggestion,
  SequenceSettings,
  SwitchPoint,
  SwitchTransition,
} from '../../../model-types';
import { recalculateClipStartsForFrameRate } from '../../sequence-settings';
import { clampTrackHeight } from '../../track-height';
import {
  type ClipGroupBatchPatch,
  createClipGroup,
  normalizeClipGroups,
  removeClipIdsFromGroups,
} from '../../clip-groups';
import { calculatePiPTransform, createFullFrameTransform, type PiPLayoutPosition } from '../../pip-layout';
import {
  calculateSplitLayoutTransforms,
  type SplitLayoutDefinition,
  type SplitLayoutClipSource,
} from '../../split-layout';
import type { SubtitleDataImportMode } from '../../subtitles/data-import';
import type { SubtitleProofreadingFix } from '../../subtitles/proofreading';
import {
  calculateSubtitleAlignmentUpdates,
  calculateSubtitleShiftUpdates,
  type SubtitleAlignmentOptions,
  type SubtitleAlignmentReport,
  type SubtitleTimingUpdate,
} from '../../subtitles/retiming';
import { normalizeSubtitleStyleTemplateStyle } from '../../subtitles/style-templates';
import {
  normalizeCreditsRollSpeed,
  normalizeCreditsRows,
  normalizeCreditsStyle,
  type CreditsRow,
  type CreditsStyle,
} from '../../credits-roll';
import { normalizeClipBlendMode } from '../../blend-modes';
import { normalizeClipContentAnalysis } from '../../content-analysis';
import { normalizeClipPitchData } from '../../audio-pitch';
import { normalizeDataSubtitleSource } from '../../data-subtitle';
import { normalizeSpatialAudio, type ClipSpatialAudio } from '../../spatial-audio';
import { filterShortSceneCuts } from '../../scene-cuts';
import {
  addMediaFolderToProject,
  deleteMediaFolder,
  moveMediaAssetsToFolder,
  renameMediaFolder,
  setMediaFolderCollapsed,
  type MediaFolderInput,
} from '../../media-folders';
import type { BatchEditableMediaMetadata } from '../../media-batch';
import {
  alignKeyframeValues,
  applyBatchKeyframeEasing,
  createKeyframe,
  distributeKeyframeTimes,
  removeKeyframeForProperty,
  setKeyframeForProperty,
} from '../../keyframes';
import {
  cloneClipKeyframes,
  normalizeClipKeyframes,
  type ClipboardKeyframeGroup,
  type PasteMode,
  normalizePastedKeyframes,
} from '../../keyframes';
import { normalizeProjectDocumentation } from '../../project/documentation';
import { applyConformMedia, type ConformMediaReplacement } from '../../project/conform-media';
import {
  applyProjectHealthAutoRepair,
  type ProjectHealthAutoRepairInput,
  type ProjectHealthRepairReport,
} from '../../project/project-health-repair';
import { normalizeProjectReleaseVersion } from '../../project/release-workflow';
import { applyProxyMigration, type ProxyMigrationUpdate } from '../../proxy/proxy-management';
import {
  buildTextAnimationKeyframes,
  mergeTextAnimationKeyframes,
  normalizeTextAnimationDirection,
  normalizeTextAnimationDuration,
  normalizeTextAnimationPreset,
  type TextAnimationDirection,
  type TextAnimationPreset,
} from '../../text-animation';
import {
  normalizeRichTextDocument,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
} from '../../text-layout';
import {
  cloneEffects,
  normalizeEffect,
  normalizeEffects,
  type Effect,
  type EffectParams,
  type EffectType,
} from '../../effects';
import { buildEffectPresetClipPatch, type EffectPreset } from '../../effect-presets';
import { applyStyleToClip, type ApplyStyleTransferOptions, type StyleSummary } from '../../style-transfer';
import {
  buildBeatSyncSpeedKeyframes,
  calculateBeatAlignmentUpdates,
  calculateBeatSnapUpdates,
  normalizeBeatMarkers,
  type BeatAlignmentUpdate,
  type BeatMarker,
  type BeatSnapUpdate,
} from '../../beats';
import {
  buildDialogueRoughCutClips,
  buildRhythmAssembleClips,
  buildSmartMontageClips,
  type SmartDialogueInterval,
  type SmartMontageConfig,
  type SmartRoughCutVisualClip,
} from '../../smart-rough-cut-v2';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../../timeline-color-labels';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges } from '../../timeline-protection';
import {
  buildCrossfadeGapFillTransition,
  buildRepeatedGapFillClip,
  findTimelineGapAtTime,
  type FillGapOperation,
} from '../../timeline-gap-fill';
import {
  createMulticamSequenceProject,
  setMulticamSwitch,
  trimMulticamSwitch,
  addSwitchPoint,
  deleteSwitchPoint,
  updateSwitchPoint,
} from '../../multicam';
import { normalizeMotionGraphic } from '../../motion-graphics';
import type { ColorGradingGraph, ColorGradingNode, ColorGradingConnection } from '../../color-grading/types';
import { createEmptyColorGradingGraph } from '../../color-grading/types';
import {
  applyCmx3600EdlImport,
  buildCmx3600EdlImport,
  type Cmx3600EdlImportOptions,
  type Cmx3600EdlImportResult,
} from '../../export/timeline-import';
import {
  applyFcpXmlImport,
  buildFcpXmlImport,
  type FcpXmlImportOptions,
  type FcpXmlImportResult,
} from '../../export/fcpxml-import';
import {
  calculateSpeedCurveSourceDuration,
  clampTransitionDuration,
  areClipsAdjacent,
  detectOverlap,
  findAdjacentTransitionClips,
  getClipDisplayDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
  getTimelineDuration,
  moveClip,
  removeClip,
  replaceClip,
  splitClip,
  trimClip,
} from '../../timeline';
import { round } from '../../time';
import type { Command } from '../../command';
import {
  TimelineAccessor,
  ProjectAccessor,
  findClip,
  findTrack,
  findClipLocation,
  insertClip,
  assertClipsNotOnLockedTrack,
  timelineHasOverlaps,
  getProjectActiveClipIds,
  removeClipsFromTimeline,
  cloneCommandValue,
  touchProject,
  sortMarkers,
  sortAnnotations,
  sortReviewAnnotations,
  sortCollaborationNotes,
  sortTimelineNotes,
  sortBookmarks,
  applyClipGroupBatchPatch,
  buildSplitRanges,
  buildKeptRanges,
  replaceClipWithSlices,
  rippleDeleteTrackClips,
  mergeTimelineIntervals,
  findTrackGapAtTime,
  closeTrackGap,
  buildRollingTrimClips,
  buildSlipClip,
  buildSlideClipEdit,
  getClipTotalSourceDuration,
  normalizeLocalTimeRanges,
  insertGeneratedClips,
  replaceClipWithGeneratedClips,
  sortTimelineClips,
  cloneClipForNestedSequence,
  cutMulticamClip,
  trimMulticamClip,
  packNestedSequence,
  clampTrimValues,
  applySpeedKeyframeDuration,
  resolveSubtitleImportTarget,
  asReplaceableMediaClip,
  isReplaceableMediaClip,
  isPiPVisualClip,
  mergeChromaKeyPatch,
  normalizeAssetIdSet,
  assertMediaAssetsExist,
  collectProjectMediaIds,
  removeMediaAssets,
  mergeMediaReferences,
  updateClipColorGradingGraph,
  type LocalTimeRange,
  type SlideClipEditResult,
} from './timeline-operations';

export interface AddTimelineMarkerInput {
  id?: string;
  time: number;
  label?: string;
  color?: string;
}

export class AddTimelineMarkerCommand implements Command {
  readonly description = 'Add timeline marker';

export class AddClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Clip,
  ) {
    this.description = `Add clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

export class AddAdjustmentLayerCommand implements Command {
  readonly description: string;
  private insertedTrack = false;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly clip: Extract<Clip, { type: 'adjustment' }>,
  ) {
    this.description = `Add adjustment layer ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const existingTrack = timeline.tracks.find((item) => item.id === this.track.id);
    if (existingTrack) {
      if (detectOverlap(existingTrack, this.clip)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.accessor.setTimeline(insertClip(timeline, this.clip));
      return;
    }

    this.insertedTrack = true;
    this.accessor.setTimeline({
      ...timeline,
      tracks: [
        ...timeline.tracks,
        {
          ...this.track,
          clips: [this.clip],
        },
      ],
    });
  }

  undo(): void {
    const timeline = removeClip(this.accessor.getTimeline(), this.clip.id).timeline;
    if (!this.insertedTrack) {
      this.accessor.setTimeline(timeline);
      return;
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id),
    });
  }
}

export class AddMotionGraphicCommand implements Command {
  readonly description: string;
  private insertedTrack = false;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly clip: Extract<Clip, { type: 'motion-graphic' }>,
  ) {
    this.description = `Add motion graphic ${clip.name}`;
  }

  execute(): void {
    if (this.track.type !== 'video') {
      throw new Error('Motion graphics must be added to a video track');
    }
    const timeline = this.accessor.getTimeline();
    const existingTrack = timeline.tracks.find((item) => item.id === this.track.id);
    if (existingTrack) {
      if (existingTrack.type !== 'video') {
        throw new Error('Motion graphics must be added to a video track');
      }
      if (detectOverlap(existingTrack, this.clip)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.accessor.setTimeline(insertClip(timeline, this.clip));
      return;
    }

    this.insertedTrack = true;
    this.accessor.setTimeline({
      ...timeline,
      tracks: [
        ...timeline.tracks,
        {
          ...this.track,
          clips: [this.clip],
        },
      ],
    });
  }

  undo(): void {
    const timeline = removeClip(this.accessor.getTimeline(), this.clip.id).timeline;
    if (!this.insertedTrack) {
      this.accessor.setTimeline(timeline);
      return;
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id),
    });
  }
}

export class AddSubtitleClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Extract<Clip, { type: 'subtitle' }>,
  ) {
    this.description = `Add subtitle clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (track.type !== 'subtitle') {
      throw new Error('Subtitle clips can only be added to subtitle tracks');
    }
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

export class AddCreditsClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Extract<Clip, { type: 'credits' }>,
  ) {
    this.description = `Add credits clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (track.type !== 'text') {
      throw new Error('Credits clips can only be added to text tracks');
    }
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

function resolveSubtitleImportTarget(timeline: Timeline, targetTrackId: string | undefined): Track | undefined {
  const track = targetTrackId
    ? timeline.tracks.find((item) => item.id === targetTrackId)
    : timeline.tracks.find((item) => item.type === 'subtitle');
  if (track && track.type !== 'subtitle') {
    throw new Error('Subtitle import target must be a subtitle track');
  }
  return track;
}

export interface BatchImportSubtitleCommandOptions {
  mode: SubtitleDataImportMode;
  targetTrackId?: string;
}

export class BatchImportSubtitleCommand implements Command {
  readonly description = 'Import subtitle clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly options: BatchImportSubtitleCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      if (this.track.type !== 'subtitle') {
        throw new Error('Batch subtitle import requires a subtitle track');
      }
      const clips = this.track.clips.map((clip) => {
        if (clip.type !== 'subtitle') {
          throw new Error('Batch subtitle import can only contain subtitle clips');
        }
        return clip;
      });
      if (clips.length === 0) {
        throw new Error('No subtitle clips to import');
      }
      const targetTrack = resolveSubtitleImportTarget(timeline, this.options.targetTrackId);
      const shouldUseExistingTrack = this.options.mode !== 'new-track' && targetTrack;
      const targetTrackId = shouldUseExistingTrack ? targetTrack.id : this.track.id;
      const importedClips = clips.map((clip) => ({ ...clip, trackId: targetTrackId }));
      if (!shouldUseExistingTrack) {
        this.after = {
          ...timeline,
          tracks: [...timeline.tracks, createTrack({ ...this.track, clips: importedClips })],
        };
      } else if (this.options.mode === 'replace-current-track') {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id
              ? createTrack({ ...track, name: this.track.name, clips: importedClips })
              : track,
          ),
        };
      } else {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id ? createTrack({ ...track, clips: [...track.clips, ...importedClips] }) : track,
          ),
        };
      }
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BatchAddClipsCommand implements Command {
  readonly description = 'Batch add clips (AI rough cut)';
  private before?: Timeline;
  private after?: Timeline;
  private insertedTrackIds: string[] = [];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clips: Clip[],
    private readonly newTracks: Array<{ id: string; name: string; type: 'video' | 'audio' }>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const trackMap = new Map<string, Track>();
      for (const nt of this.newTracks) {
        if (!timeline.tracks.some((t) => t.id === nt.id)) {
          trackMap.set(nt.id, createTrack({ id: nt.id, type: nt.type, name: nt.name, clips: [] }));
          this.insertedTrackIds.push(nt.id);
        }
      }
      const newTracks = Array.from(trackMap.values());
      let updatedTimeline: Timeline =
        newTracks.length > 0 ? { ...timeline, tracks: [...timeline.tracks, ...newTracks] } : timeline;
      for (const clip of this.clips) {
        updatedTimeline = insertClip(updatedTimeline, clip);
      }
      this.after = updatedTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class DeleteClipCommand implements Command {
  readonly description = 'Delete clip';
  private removed?: Clip;
  private removedIndex = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
  ) {}

  execute(): void {
    const result = removeClip(this.accessor.getTimeline(), this.clipId);
    this.removed = result.clip;
    this.removedIndex = result.index;
    this.accessor.setTimeline(result.timeline);
  }

  undo(): void {
    if (this.removed) {
      this.accessor.setTimeline(insertClip(this.accessor.getTimeline(), this.removed, this.removedIndex));
    }
  }
}


export type ClipPatch = Partial<
  Omit<
    Clip,
    'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation' | 'border'
  >
> & {
  keyframes?: ClipKeyframes;
  kenBurns?: boolean;
  volume?: number;
  text?: string;
  richText?: Extract<Clip, { type: 'text' }>['richText'];
  textLayout?: Extract<Clip, { type: 'text' }>['textLayout'];
  openTypeFeatures?: Extract<Clip, { type: 'text' }>['openTypeFeatures'];
  arcText?: Extract<Clip, { type: 'text' }>['arcText'];
  colorLabel?: TimelineLabelColor | null;
  mediaId?: string;
  subtitleType?: SubtitleTrackType;
  speaker?: string;
  speakerId?: number;
  soundDesc?: string;
  subtitleMode?: SubtitleMode;
  dataSubtitle?: Extract<Clip, { type: 'subtitle' }>['dataSubtitle'];
  speed?: number;
  pitchSemitones?: number;
  audioChannelRouting?: Clip['audioChannelRouting'];
  pitchData?: Clip['pitchData'];
  muted?: boolean;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
  chromaKey?: Partial<ChromaKey>;
  stabilization?: Partial<ClipStabilization>;
  frameInterpolation?: Partial<ClipFrameInterpolation>;
  audioDenoise?: Partial<ClipAudioDenoise>;
  spatialAudio?: Partial<ClipSpatialAudio>;
  videoRestoration?: Partial<ClipVideoRestoration>;
  qualityEnhancement?: Partial<ClipQualityEnhancement>;
  projection?: ClipProjection;
  panorama?: Partial<ClipPanoramaView>;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: Partial<ClipBorder>;
  sequenceFrameRate?: number;
  colorCorrection?: Partial<ColorCorrection>;
  transform?: Partial<Transform>;
  rows?: CreditsRow[];
  rollSpeed?: number;
  style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
  pathText?: Partial<TextPathOptions>;
  motionGraphic?: Partial<Extract<Clip, { type: 'motion-graphic' }>['motionGraphic']>;
};

export class UpdateSubtitleStyleCommand implements Command {
  readonly description = 'Update subtitle style';
  private before?: Extract<Clip, { type: 'subtitle' }>;
  private after?: Extract<Clip, { type: 'subtitle' }>;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly style: Partial<SubtitleStyle>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const clip = findClip(timeline, this.clipId);
    if (clip.type !== 'subtitle') {
      throw new Error(`Clip ${this.clipId} is not a subtitle clip`);
    }
    this.before ??= cloneCommandValue(clip);
    const nextStyle = normalizeSubtitleStyleTemplateStyle({ ...DEFAULT_SUBTITLE_STYLE, ...clip.style, ...this.style });
    this.after = {
      ...clip,
      style: nextStyle,
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type ReplaceMediaDurationMode = 'trim-to-original' | 'stretch-to-fit' | 'use-new-duration';
export type ReplaceMediaCompatibilityWarning = 'media-type-mismatch' | 'missing-audio-for-audio-properties';
type ReplaceableMediaClip = Extract<Clip, { mediaId: string }>;

export function calculateReplaceMediaPatch(
  clip: ReplaceableMediaClip,
  media: Pick<MediaAsset, 'id' | 'duration'>,
  durationMode: ReplaceMediaDurationMode,
): Pick<ReplaceableMediaClip, 'mediaId' | 'duration' | 'trimStart' | 'trimEnd' | 'speed'> {
  const minDuration = 1 / 30;
  const originalDuration = Math.max(minDuration, clip.duration);
  const mediaDuration = Math.max(minDuration, Number.isFinite(media.duration) ? media.duration : originalDuration);
  if (durationMode === 'stretch-to-fit') {
    return {
      mediaId: media.id,
      duration: round(originalDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: getClipSpeed({ speed: mediaDuration / originalDuration }),
    };
  }
  if (durationMode === 'use-new-duration') {
    return {
      mediaId: media.id,
      duration: round(mediaDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
    };
  }
  const duration = Math.min(originalDuration, mediaDuration);
  return {
    mediaId: media.id,
    duration: round(duration),
    trimStart: 0,
    trimEnd: round(Math.max(0, mediaDuration - duration)),
    speed: DEFAULT_CLIP_SPEED,
  };
}

export function getReplaceMediaCompatibilityWarnings(
  clip: Clip,
  media: Pick<MediaAsset, 'type' | 'hasAudio'>,
): ReplaceMediaCompatibilityWarning[] {
  if (!isReplaceableMediaClip(clip)) {
    return ['media-type-mismatch'];
  }
  const warnings = new Set<ReplaceMediaCompatibilityWarning>();
  if (clip.type !== media.type) {
    warnings.add('media-type-mismatch');
  }
  const newMediaHasAudio = media.type === 'audio' || (media.type === 'video' && media.hasAudio !== false);
  const clipHasAudioProperties =
    clip.type === 'audio' ||
    ('volume' in clip && clip.volume !== undefined) ||
    Boolean(clip.keyframes?.volume?.length) ||
    ('fadeInDuration' in clip && ((clip.fadeInDuration ?? 0) > 0 || (clip.fadeOutDuration ?? 0) > 0));
  if (clipHasAudioProperties && !newMediaHasAudio) {
    warnings.add('missing-audio-for-audio-properties');
  }
  return Array.from(warnings);
}

export class ReplaceMediaCommand implements Command {
  readonly description = 'Replace media';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
    private readonly durationMode: ReplaceMediaDurationMode,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, this.durationMode);
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class SwitchMediaVersionCommand implements Command {
  readonly description = 'Switch media version';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, 'trim-to-original');
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

function asReplaceableMediaClip(clip: Clip): ReplaceableMediaClip {
  if (!isReplaceableMediaClip(clip)) {
    throw new Error('Media replacement requires a media clip');
  }
  return clip;
}

function isReplaceableMediaClip(clip: Clip): clip is ReplaceableMediaClip {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';

export interface PiPLayoutCommandOptions {
  position?: PiPLayoutPosition;
  canvasWidth: number;
  canvasHeight: number;
  pipSourceWidth: number;
  pipSourceHeight: number;
  scale?: number;
  margin?: number;
  border?: Partial<ClipBorder>;
}

function mergeChromaKeyPatch(before: ChromaKey | undefined, patch: Partial<ChromaKey> | undefined): ChromaKey {
  if (!patch) {
    return normalizeChromaKey(before);
  }
  if (patch.color && !patch.colors) {
    const current = normalizeChromaKey(before);
    return normalizeChromaKey({
      ...current,
      ...patch,
      colors: [patch.color, ...current.colors.slice(1)],
    });
  }
  return normalizeChromaKey({ ...before, ...patch });
}

export class PiPLayoutCommand implements Command {
  readonly description = 'Apply PiP layout';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly mainClipId: string,
    private readonly pipClipId: string,
    private readonly options: PiPLayoutCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    if (this.mainClipId === this.pipClipId) {
      throw new Error('PiP layout requires two different clips');
    }
    const mainClip = findClip(timeline, this.mainClipId);
    const pipClip = findClip(timeline, this.pipClipId);
    if (!isPiPVisualClip(mainClip) || !isPiPVisualClip(pipClip)) {
      throw new Error('PiP layout requires two visual clips');
    }
    this.before ??= timeline;
    const pipTransform = calculatePiPTransform({
      position: this.options.position ?? 'bottom-right',
      canvasWidth: this.options.canvasWidth,
      canvasHeight: this.options.canvasHeight,
      sourceWidth: this.options.pipSourceWidth,
      sourceHeight: this.options.pipSourceHeight,
      scale: this.options.scale,
      margin: this.options.margin,
    });
    const nextById = new Map<string, Clip>([
      [
        mainClip.id,
        {
          ...mainClip,
          transform: normalizeTransform(createFullFrameTransform()),
          border: normalizeClipBorder({ enabled: false }),
        } as Clip,
      ],
      [
        pipClip.id,
        {
          ...pipClip,
          transform: normalizeTransform(pipTransform),
          border: normalizeClipBorder({
            enabled: true,
            color: '#ffffff',
            width: 6,
            ...this.options.border,
          }),
        } as Clip,
      ],
    ]);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => nextById.get(clip.id) ?? clip),
      })),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

function isPiPVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

export interface ApplySplitLayoutCommandOptions {
  layout: SplitLayoutDefinition;
  canvasWidth: number;
  canvasHeight: number;
  sources?: Record<string, { width?: number; height?: number }>;
}

export class ApplySplitLayoutCommand implements Command {
  readonly description = 'Apply split-screen layout';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly options: ApplySplitLayoutCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const uniqueIds = Array.from(new Set(this.clipIds));
    if (uniqueIds.length < 2 || uniqueIds.length > 4) {
      throw new Error('Split layout requires 2 to 4 clips');
    }
    const clips = uniqueIds.map((clipId) => findClip(timeline, clipId));
    if (!clips.every(isPiPVisualClip)) {
      throw new Error('Split layout requires visual clips');
    }
    this.before ??= timeline;
    const sources: SplitLayoutClipSource[] = clips.map((clip) => {
      const source = this.options.sources?.[clip.id];
      return {
        clipId: clip.id,
        sourceWidth: source?.width,
        sourceHeight: source?.height,
      };
    });
    const transforms = new Map(
      calculateSplitLayoutTransforms({
        layout: this.options.layout,
        clips: sources,
        canvasWidth: this.options.canvasWidth,
        canvasHeight: this.options.canvasHeight,
      }).map((item) => [item.clipId, item.transform]),
    );
    if (transforms.size === 0) {
      throw new Error('Split layout has no usable cells');
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          const transform = transforms.get(clip.id);
          return transform ? ({ ...clip, transform: normalizeTransform(transform) } as Clip) : clip;
        }),
      })),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class UpdateClipCommand implements Command {
  readonly description = 'Update clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly patch: ClipPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
    this.before ??= findClip(timeline, this.clipId);
    const nextSpeed = typeof this.patch.speed === 'number' ? getClipSpeed({ speed: this.patch.speed }) : undefined;
    const nextColorLabel =
      this.patch.colorLabel === undefined ? this.before.colorLabel : normalizeTimelineLabelColor(this.patch.colorLabel);
    this.after = {
      ...this.before,
      ...this.patch,
      speed: nextSpeed ?? this.before.speed,
      ...(nextColorLabel === undefined ? {} : { colorLabel: nextColorLabel }),
      colorCorrection: normalizeColorCorrection({ ...this.before.colorCorrection, ...this.patch.colorCorrection }),
      chromaKey: mergeChromaKeyPatch(this.before.chromaKey, this.patch.chromaKey),
      stabilization: normalizeStabilization({ ...this.before.stabilization, ...this.patch.stabilization }),
      frameInterpolation: normalizeFrameInterpolation({
        ...this.before.frameInterpolation,
        ...this.patch.frameInterpolation,
      }),
      slowMotionMode: normalizeSlowMotionMode(this.patch.slowMotionMode ?? this.before.slowMotionMode),
      audioDenoise: normalizeAudioDenoise({ ...this.before.audioDenoise, ...this.patch.audioDenoise }),
      audioChannelRouting: normalizeAudioChannelRouting(
        this.patch.audioChannelRouting ?? this.before.audioChannelRouting,
      ),
      videoRestoration: normalizeVideoRestoration({ ...this.before.videoRestoration, ...this.patch.videoRestoration }),
      qualityEnhancement: normalizeQualityEnhancement({
        ...this.before.qualityEnhancement,
        ...this.patch.qualityEnhancement,
      }),
      projection: normalizeClipProjection(this.patch.projection ?? this.before.projection),
      panorama: normalizeClipPanoramaView({ ...this.before.panorama, ...this.patch.panorama }),
      masks: this.patch.masks === undefined ? normalizeMasks(this.before.masks) : normalizeMasks(this.patch.masks),
      motionTrack:
        this.patch.motionTrack === undefined
          ? normalizeMotionTrack(this.before.motionTrack, this.before.duration)
          : normalizeMotionTrack(this.patch.motionTrack, this.before.duration),
      border:
        this.patch.border === undefined
          ? normalizeClipBorder(this.before.border)
          : normalizeClipBorder({ ...(this.before.border ?? {}), ...this.patch.border }),
      sequenceFrameRate: normalizeSequenceFrameRate(this.patch.sequenceFrameRate ?? this.before.sequenceFrameRate),
      blendMode: normalizeClipBlendMode(this.patch.blendMode ?? this.before.blendMode),
      contentAnalysis:
        this.patch.contentAnalysis === undefined
          ? normalizeClipContentAnalysis(this.before.contentAnalysis)
          : normalizeClipContentAnalysis(this.patch.contentAnalysis),
      pitchData:
        this.patch.pitchData === undefined
          ? normalizeClipPitchData(this.before.pitchData)
          : normalizeClipPitchData(this.patch.pitchData),
      transform: normalizeTransform(
        this.patch.transform?.scale !== undefined &&
          this.patch.transform.scaleX === undefined &&
          this.patch.transform.scaleY === undefined
          ? {
              ...this.before.transform,
              ...this.patch.transform,
              scaleX: this.patch.transform.scale,
              scaleY: this.patch.transform.scale,
            }
          : { ...this.before.transform, ...this.patch.transform },
      ),
    } as Clip;
    if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
      this.after = {
        ...this.after,
        pitchSemitones: normalizeAudioPitchSemitones(this.patch.pitchSemitones ?? this.after.pitchSemitones),
        reverseAudio: (this.patch.reverseAudio ?? this.after.reverseAudio) === true,
        fadeInDuration: normalizeAudioFadeDuration(
          this.patch.fadeInDuration ?? this.after.fadeInDuration,
          this.after.duration,
        ),
        fadeOutDuration: normalizeAudioFadeDuration(
          this.patch.fadeOutDuration ?? this.after.fadeOutDuration,
          this.after.duration,
        ),
        fadeInCurve: normalizeAudioFadeCurve(this.patch.fadeInCurve ?? this.after.fadeInCurve),
        fadeOutCurve: normalizeAudioFadeCurve(this.patch.fadeOutCurve ?? this.after.fadeOutCurve),
        spatialAudio: normalizeSpatialAudio({ ...this.after.spatialAudio, ...this.patch.spatialAudio }),
      } as Clip;
    }
    const speedKeyframesChanged =
      this.patch.keyframes !== undefined &&
      (Boolean(this.before.keyframes?.speed?.length) || Boolean(this.patch.keyframes?.speed?.length));
    if (typeof nextSpeed === 'number' || speedKeyframesChanged) {
      this.after = {
        ...this.after,
        duration: getClipDisplayDuration(
          getClipSourceVisibleDuration(this.before),
          nextSpeed ?? this.after.speed,
          this.after.keyframes,
        ),
      } as Clip;
      if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
        this.after = {
          ...this.after,
          fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
          fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
        } as Clip;
      }
    }
    const beatMarkers =
      this.patch.beatMarkers === undefined
        ? normalizeClipBeatMarkers(this.after.beatMarkers, this.after.duration)
        : normalizeClipBeatMarkers(this.patch.beatMarkers, this.after.duration);
    const detectedBpm =
      this.patch.detectedBpm === undefined
        ? normalizeDetectedBpm(this.after.detectedBpm)
        : normalizeDetectedBpm(this.patch.detectedBpm);
    const scenecuts =
      this.patch.scenecuts === undefined
        ? normalizeClipSceneCuts(this.after.scenecuts, this.after.duration)
        : normalizeClipSceneCuts(this.patch.scenecuts, this.after.duration);
    this.after = {
      ...this.after,
      beatMarkers,
      detectedBpm,
      scenecuts,
    } as Clip;
    if ('style' in this.before || this.patch.style) {
      this.after = {
        ...this.after,
        style: { ...('style' in this.before ? this.before.style : {}), ...this.patch.style },
      } as Clip;
    }
    if (this.after.type === 'text') {
      this.after = {
        ...this.after,
        richText: normalizeRichTextDocument(this.after.richText, this.after.text),
        textLayout: normalizeTextLayout(this.after.textLayout),
        openTypeFeatures: normalizeTextOpenTypeFeatures(this.after.openTypeFeatures),
        arcText: normalizeTextArc(this.after.arcText),
        pathText: normalizeTextPath(this.after.pathText),
      };
    }
    if (this.after.type === 'subtitle') {
      const subtitleType = normalizeSubtitleTrackType(this.after.subtitleType);
      this.after = {
        ...this.after,
        subtitleType,
        speaker: subtitleType === 'cc' ? normalizeSubtitleSpeaker(this.after.speaker) : undefined,
        soundDesc: subtitleType === 'cc' ? normalizeSubtitleSoundDesc(this.after.soundDesc) : undefined,
        dataSubtitle: normalizeDataSubtitleSource(this.after.dataSubtitle),
      };
    }
    if (this.after.type === 'credits') {
      this.after = {
        ...this.after,
        rows: normalizeCreditsRows(
          this.patch.rows ?? (this.patch.text !== undefined ? undefined : this.after.rows),
          this.after.text,
        ),
        rollSpeed: normalizeCreditsRollSpeed(this.patch.rollSpeed ?? this.after.rollSpeed),
        style: normalizeCreditsStyle(this.after.style),
      };
    }
    if (this.after.type === 'motion-graphic') {
      this.after = {
        ...this.after,
        motionGraphic: normalizeMotionGraphic(
          this.patch.motionGraphic ?? this.after.motionGraphic,
          this.after.duration,
        ),
      };
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class ApplyEffectPresetCommand implements Command {
  readonly description = 'Apply effect preset';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly preset: EffectPreset,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    if (!this.after) {
      let timeline = this.before;
      const clip = findClip(timeline, this.clipId);
      const patch = buildEffectPresetClipPatch(this.preset, clip.duration);
      const commandAccessor: TimelineAccessor = {
        getTimeline: () => timeline,
        setTimeline: (nextTimeline) => {
          timeline = nextTimeline;
        },
      };
      new UpdateClipCommand(commandAccessor, this.clipId, patch).execute();
      this.after = timeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface BatchUpdateClipCommandItem {
  clipId: string;
  patch: ClipPatch;
}

export class BatchUpdateClipCommand implements Command {
  readonly description = 'Batch update clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: BatchUpdateClipCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(
      this.before,
      this.updates.map((u) => u.clipId),
    );
    if (!this.after) {
      let timeline = this.before;
      const batchAccessor: TimelineAccessor = {
        getTimeline: () => timeline,
        setTimeline: (nextTimeline) => {
          timeline = nextTimeline;
        },
      };
      for (const update of this.updates) {
        new UpdateClipCommand(batchAccessor, update.clipId, update.patch).execute();
      }
      this.after = timeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class AddSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclip: Subclip,
  ) {
    this.description = `Add subclip "${subclip.name}"`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: [...(project.subclips ?? []), this.subclip],
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface SubclipPatch {
  name?: string;
  inPoint?: number;
  outPoint?: number;
  color?: TimelineLabelColor | null;
  description?: string;
}

export class UpdateSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
    private readonly patch: SubclipPatch,
  ) {
    this.description = `Update subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const subclips = (project.subclips ?? []).map((s) => {
      if (s.id !== this.subclipId) return s;
      return {
        ...s,
        ...(this.patch.name !== undefined ? { name: this.patch.name } : {}),
        ...(this.patch.inPoint !== undefined ? { inPoint: Math.max(0, this.patch.inPoint) } : {}),
        ...(this.patch.outPoint !== undefined ? { outPoint: Math.max(s.inPoint, this.patch.outPoint) } : {}),
        ...(this.patch.color !== undefined ? { color: this.patch.color } : {}),
        ...(this.patch.description !== undefined ? { description: this.patch.description } : {}),
      };
    });
    this.accessor.setProject({ ...project, subclips, updatedAt: new Date().toISOString() });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
  ) {
    this.description = `Delete subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: (project.subclips ?? []).filter((s) => s.id !== this.subclipId),
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}