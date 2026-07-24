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

export class SlipClipCommand implements Command {
  readonly description = 'Slip clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly delta: number,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.after = buildSlipClip(this.before, this.delta);
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class SlideClipCommand implements Command {
  readonly description = 'Slide clip';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly delta: number,
    private readonly minDuration = 1 / 30,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    this.after ??= buildSlideClipEdit(timeline, this.clipId, this.delta, this.minDuration).timeline;
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class TrimClipCommand implements Command {
  readonly description = 'Trim clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly newTrimStart: number,
    private readonly newTrimEnd: number,
    private readonly newStart?: number,
    private readonly minDuration = 1 / 30,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
    this.before ??= findClip(timeline, this.clipId);
    const { trimStart, trimEnd } = clampTrimValues(this.before, this.newTrimStart, this.newTrimEnd, this.minDuration);
    const trimmed = trimClip(this.before, trimStart, trimEnd);
    this.after = typeof this.newStart === 'number' ? { ...trimmed, start: Math.max(0, this.newStart) } : trimmed;
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

export class DeleteClipsCommand implements Command {
  readonly description = 'Delete clips';
  private removed: Array<{ clip: Clip; index: number; trackId: string }> = [];
  private removedTransitions: Transition[] = [];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
  ) {}

  execute(): void {
    const uniqueIds = Array.from(new Set(this.clipIds));
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, uniqueIds);
    this.removed = uniqueIds.map((id) => findClipLocation(timeline, id));
    const ids = new Set(uniqueIds);
    // Save and remove transitions referencing deleted clips
    this.removedTransitions = (timeline.transitions ?? []).filter(
      (transition) => ids.has(transition.fromClipId) || ids.has(transition.toClipId),
    );
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) })),
      transitions: (timeline.transitions ?? []).filter(
        (transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId),
      ),
    });
  }

  undo(): void {
    if (this.removed.length === 0) {
      return;
    }
    let timeline = this.accessor.getTimeline();
    for (const item of [...this.removed].sort((left, right) => left.index - right.index)) {
      timeline = insertClip(timeline, item.clip, item.index);
    }
    // Restore removed transitions
    if (this.removedTransitions.length > 0) {
      timeline = {
        ...timeline,
        transitions: [...(timeline.transitions ?? []), ...this.removedTransitions],
      };
    }
    this.accessor.setTimeline(timeline);
  }
}

export class RippleDeleteCommand implements Command {
  readonly description = 'Ripple delete clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const uniqueIds = Array.from(new Set(this.clipIds));
      if (uniqueIds.length === 0) {
        throw new Error('No clips selected for ripple delete');
      }
      assertClipsNotOnLockedTrack(timeline, uniqueIds);
      const ids = new Set(uniqueIds);
      const missingIds = uniqueIds.filter(
        (clipId) => !timeline.tracks.some((track) => track.clips.some((clip) => clip.id === clipId)),
      );
      if (missingIds.length > 0) {
        throw new Error(`Clip ${missingIds[0]} not found`);
      }
      this.after = {
        ...timeline,
        tracks: timeline.tracks.map((track) => rippleDeleteTrackClips(track, ids, this.protectedRanges)),
        transitions: (timeline.transitions ?? []).filter(
          (transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId),
        ),
      };
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class CloseGapCommand implements Command {
  readonly description = 'Close timeline gap';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly time: number,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const track = findTrack(timeline, this.trackId);
      const gap = findTrackGapAtTime(track, this.time);
      if (!gap) {
        throw new Error('No closeable gap at this time');
      }
      this.after = {
        ...timeline,
        tracks: timeline.tracks.map((item) =>
          item.id === this.trackId ? closeTrackGap(item, gap.start, gap.end) : item,
        ),
        transitions: timeline.transitions ?? [],
      };
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class FillGapCommand implements Command {
  readonly description = 'Fill timeline gap';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly time: number,
    private readonly operation: FillGapOperation,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const track = findTrack(timeline, this.trackId);
      const gap = findTimelineGapAtTime(timeline, this.trackId, this.time);
      if (!gap) {
        throw new Error('No fillable gap at this time');
      }
      if (this.operation.type === 'insert-clip') {
        const clip = {
          ...this.operation.clip,
          trackId: this.trackId,
          start: gap.start,
          duration: gap.duration,
        } as Clip;
        if (detectOverlap(track, clip)) {
          throw new Error('Gap fill clip overlaps another clip on this track');
        }
        this.after = insertClip(timeline, clip);
      } else if (this.operation.type === 'repeat-previous') {
        const clip = buildRepeatedGapFillClip(gap, { clipId: this.operation.clipId, name: this.operation.name });
        if (detectOverlap(track, clip)) {
          throw new Error('Gap fill clip overlaps another clip on this track');
        }
        this.after = insertClip(timeline, clip);
      } else {
        const transition = buildCrossfadeGapFillTransition(gap, this.operation);
        const closedTrack = closeTrackGap(track, gap.start, gap.end);
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((item) => (item.id === this.trackId ? closedTrack : item)),
          transitions: [
            ...(timeline.transitions ?? []).filter(
              (item) => item.fromClipId !== transition.fromClipId || item.toClipId !== transition.toClipId,
            ),
            transition,
          ],
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

export class RollingTrimCommand implements Command {
  readonly description = 'Rolling trim';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly leftClipId: string,
    private readonly rightClipId: string,
    private readonly delta: number,
    private readonly minDuration = 1 / 30,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const pair = findAdjacentTransitionClips(timeline, this.leftClipId, this.rightClipId);
      if (!pair) {
        throw new Error('Rolling trim requires adjacent clips on the same track');
      }
      const { left, right } = buildRollingTrimClips(pair.fromClip, pair.toClip, this.delta, this.minDuration);
      this.after = {
        ...timeline,
        tracks: timeline.tracks.map((track) =>
          track.id === pair.track.id
            ? {
                ...track,
                clips: track.clips.map((clip) => (clip.id === left.id ? left : clip.id === right.id ? right : clip)),
              }
            : track,
        ),
        transitions: timeline.transitions ?? [],
      };
      if (timelineHasOverlaps(this.after)) {
        throw new Error('Clip overlaps another clip on this track');
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

export class PackNestedSequenceCommand implements Command {
  readonly description = 'Pack nested sequence';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= packNestedSequence(this.before, this.clipIds, this.sequenceName);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}