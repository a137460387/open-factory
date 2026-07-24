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

export class MoveClipCommand implements Command {
  readonly description = 'Move clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly newStart: number,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
    this.before ??= findClip(timeline, this.clipId);
    if (!canMoveClipWithProtectedRanges(this.before, this.newStart, this.protectedRanges)) {
      throw new Error('Clip move is blocked by a protected range');
    }
    this.after = moveClip(this.before, this.newStart);
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

export class MoveClipsCommand implements Command {
  readonly description = 'Move clips';
  private before?: Clip[];
  private after?: Clip[];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly newStartsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const ids = Object.keys(this.newStartsByClipId);
    assertClipsNotOnLockedTrack(timeline, ids);
    this.before ??= ids.map((id) => findClip(timeline, id));
    const blocked = this.before.find(
      (clip) =>
        !canMoveClipWithProtectedRanges(clip, this.newStartsByClipId[clip.id] ?? clip.start, this.protectedRanges),
    );
    if (blocked) {
      throw new Error('Clip move is blocked by a protected range');
    }
    this.after = this.before.map((clip) => moveClip(clip, this.newStartsByClipId[clip.id] ?? clip.start));
    const movedById = new Map(this.after.map((clip) => [clip.id, clip]));
    const nextTimeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip),
      })),
    };
    if (timelineHasOverlaps(nextTimeline)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(nextTimeline);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const beforeById = new Map(this.before.map((clip) => [clip.id, clip]));
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => beforeById.get(clip.id) ?? clip),
      })),
    });
  }
}

export class BatchShiftClipsCommand implements Command {
  readonly description = 'Shift clips';
  private delegate?: MoveClipsCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly offsetsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const startsByClipId = Object.fromEntries(
        Object.entries(this.offsetsByClipId).map(([clipId, offset]) => {
          const clip = findClip(timeline, clipId);
          return [clipId, round(clip.start + offset)];
        }),
      );
      if (Object.keys(startsByClipId).length === 0) {
        throw new Error('No clips to shift');
      }
      this.delegate = new MoveClipsCommand(this.accessor, startsByClipId, this.protectedRanges);
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchReorderClipsCommand implements Command {
  readonly description = 'Batch reorder clips';
  private delegate?: MoveClipsCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly startsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    this.delegate ??= new MoveClipsCommand(this.accessor, this.startsByClipId, this.protectedRanges);
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}