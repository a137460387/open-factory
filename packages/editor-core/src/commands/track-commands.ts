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
} from '../model';
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
} from '../model-types';
import { recalculateClipStartsForFrameRate } from '../sequence-settings';
import { clampTrackHeight } from '../track-height';
import {
  type ClipGroupBatchPatch,
  createClipGroup,
  normalizeClipGroups,
  removeClipIdsFromGroups,
} from '../clip-groups';
import { calculatePiPTransform, createFullFrameTransform, type PiPLayoutPosition } from '../pip-layout';
import {
  calculateSplitLayoutTransforms,
  type SplitLayoutDefinition,
  type SplitLayoutClipSource,
} from '../split-layout';
import type { SubtitleDataImportMode } from '../subtitles/data-import';
import type { SubtitleProofreadingFix } from '../subtitles/proofreading';
import {
  calculateSubtitleAlignmentUpdates,
  calculateSubtitleShiftUpdates,
  type SubtitleAlignmentOptions,
  type SubtitleAlignmentReport,
  type SubtitleTimingUpdate,
} from '../subtitles/retiming';
import { normalizeSubtitleStyleTemplateStyle } from '../subtitles/style-templates';
import {
  normalizeCreditsRollSpeed,
  normalizeCreditsRows,
  normalizeCreditsStyle,
  type CreditsRow,
  type CreditsStyle,
} from '../credits-roll';
import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeDataSubtitleSource } from '../data-subtitle';
import { normalizeSpatialAudio, type ClipSpatialAudio } from '../spatial-audio';
import { filterShortSceneCuts } from '../scene-cuts';
import {
  addMediaFolderToProject,
  deleteMediaFolder,
  moveMediaAssetsToFolder,
  renameMediaFolder,
  setMediaFolderCollapsed,
  type MediaFolderInput,
} from '../media-folders';
import type { BatchEditableMediaMetadata } from '../media-batch';
import {
  alignKeyframeValues,
  applyBatchKeyframeEasing,
  createKeyframe,
  distributeKeyframeTimes,
  removeKeyframeForProperty,
  setKeyframeForProperty,
} from '../keyframes';
import {
  cloneClipKeyframes,
  normalizeClipKeyframes,
  type ClipboardKeyframeGroup,
  type PasteMode,
  normalizePastedKeyframes,
} from '../keyframes';
import { normalizeProjectDocumentation } from '../project/documentation';
import { applyConformMedia, type ConformMediaReplacement } from '../project/conform-media';
import {
  applyProjectHealthAutoRepair,
  type ProjectHealthAutoRepairInput,
  type ProjectHealthRepairReport,
} from '../project/project-health-repair';
import { normalizeProjectReleaseVersion } from '../project/release-workflow';
import { applyProxyMigration, type ProxyMigrationUpdate } from '../proxy/proxy-management';
import {
  buildTextAnimationKeyframes,
  mergeTextAnimationKeyframes,
  normalizeTextAnimationDirection,
  normalizeTextAnimationDuration,
  normalizeTextAnimationPreset,
  type TextAnimationDirection,
  type TextAnimationPreset,
} from '../text-animation';
import {
  normalizeRichTextDocument,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
} from '../text-layout';
import {
  cloneEffects,
  normalizeEffect,
  normalizeEffects,
  type Effect,
  type EffectParams,
  type EffectType,
} from '../effects';
import { buildEffectPresetClipPatch, type EffectPreset } from '../effect-presets';
import { applyStyleToClip, type ApplyStyleTransferOptions, type StyleSummary } from '../style-transfer';
import {
  buildBeatSyncSpeedKeyframes,
  calculateBeatAlignmentUpdates,
  calculateBeatSnapUpdates,
  normalizeBeatMarkers,
  type BeatAlignmentUpdate,
  type BeatMarker,
  type BeatSnapUpdate,
} from '../beats';
import {
  buildDialogueRoughCutClips,
  buildRhythmAssembleClips,
  buildSmartMontageClips,
  type SmartDialogueInterval,
  type SmartMontageConfig,
  type SmartRoughCutVisualClip,
} from '../smart-rough-cut-v2';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../timeline-color-labels';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges } from '../timeline-protection';
import {
  buildCrossfadeGapFillTransition,
  buildRepeatedGapFillClip,
  findTimelineGapAtTime,
  type FillGapOperation,
} from '../timeline-gap-fill';
import {
  createMulticamSequenceProject,
  setMulticamSwitch,
  trimMulticamSwitch,
  addSwitchPoint,
  deleteSwitchPoint,
  updateSwitchPoint,
} from '../multicam';
import { normalizeMotionGraphic } from '../motion-graphics';
import type { ColorGradingGraph, ColorGradingNode, ColorGradingConnection } from '../color-grading/types';
import { createEmptyColorGradingGraph } from '../color-grading/types';
import {
  applyCmx3600EdlImport,
  buildCmx3600EdlImport,
  type Cmx3600EdlImportOptions,
  type Cmx3600EdlImportResult,
} from '../export/timeline-import';
import {
  applyFcpXmlImport,
  buildFcpXmlImport,
  type FcpXmlImportOptions,
  type FcpXmlImportResult,
} from '../export/fcpxml-import';
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
} from '../timeline';
import { round } from '../time';
import type { Command } from './command';
import type { Command } from './command';
import {
  type TimelineAccessor,
  type ProjectAccessor,
  type LocalTimeRange,
  assertClipsNotOnLockedTrack,
  findTrack,
  findClip,
  findClipLocation,
  timelineHasOverlaps,
  getProjectActiveClipIds,
  removeClipsFromTimeline,
  applyClipGroupBatchPatch,
  buildKeptRanges,
  buildSplitRanges,
  replaceClipWithSlices,
  rippleDeleteTrackClips,
  buildRollingTrimClips,
  getClipTotalSourceDuration,
  insertClip,
  touchProject,
  cloneCommandValue,
  clampTrimValues,
  applySpeedKeyframeDuration,
  mergeChromaKeyPatch,
  isPiPVisualClip,
  sortTimelineClips,
  insertGeneratedClips,
  replaceClipWithGeneratedClips,
  sortMarkers,
  sortAnnotations,
  sortReviewAnnotations,
  sortCollaborationNotes,
  sortTimelineNotes,
  sortBookmarks,
  uniqueKeyframeRefs,
  groupKeyframeRefsByClip,
  calculateKeyframeSelectionCenter,
  keyframeRefKey,
  calculateDistributedKeyframeTimeMap,
  getBatchAlignValue,
  getBatchEditedKeyframeTime,
  normalizeAssetIdSet,
  assertMediaAssetsExist,
  collectProjectMediaIds,
  removeMediaAssets,
  mergeMediaReferences,
  replaceTimelineMediaReferences,
  filterMediaMetadata,
  cloneClipForNestedSequence,
  updateClipColorGradingGraph,
  resolveSubtitleImportTarget,
  packNestedSequence,
  cutMulticamClip,
  trimMulticamClip,
  findTrackGapAtTime,
  closeTrackGap,
} from './helpers';

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
} from '../model';
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
} from '../model-types';
import { recalculateClipStartsForFrameRate } from '../sequence-settings';
import { clampTrackHeight } from '../track-height';
import {
  type ClipGroupBatchPatch,
  createClipGroup,
  normalizeClipGroups,
  removeClipIdsFromGroups,
} from '../clip-groups';
import { calculatePiPTransform, createFullFrameTransform, type PiPLayoutPosition } from '../pip-layout';
import {
  calculateSplitLayoutTransforms,
  type SplitLayoutDefinition,
  type SplitLayoutClipSource,
} from '../split-layout';
import type { SubtitleDataImportMode } from '../subtitles/data-import';
import type { SubtitleProofreadingFix } from '../subtitles/proofreading';
import {
  calculateSubtitleAlignmentUpdates,
  calculateSubtitleShiftUpdates,
  type SubtitleAlignmentOptions,
  type SubtitleAlignmentReport,
  type SubtitleTimingUpdate,
} from '../subtitles/retiming';
import { normalizeSubtitleStyleTemplateStyle } from '../subtitles/style-templates';
import {
  normalizeCreditsRollSpeed,
  normalizeCreditsRows,
  normalizeCreditsStyle,
  type CreditsRow,
  type CreditsStyle,
} from '../credits-roll';
import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeDataSubtitleSource } from '../data-subtitle';
import { normalizeSpatialAudio, type ClipSpatialAudio } from '../spatial-audio';
import { filterShortSceneCuts } from '../scene-cuts';
import {
  addMediaFolderToProject,
  deleteMediaFolder,
  moveMediaAssetsToFolder,
  renameMediaFolder,
  setMediaFolderCollapsed,
  type MediaFolderInput,
} from '../media-folders';
import type { BatchEditableMediaMetadata } from '../media-batch';
import {
  alignKeyframeValues,
  applyBatchKeyframeEasing,
  createKeyframe,
  distributeKeyframeTimes,
  removeKeyframeForProperty,
  setKeyframeForProperty,
} from '../keyframes';
import {
  cloneClipKeyframes,
  normalizeClipKeyframes,
  type ClipboardKeyframeGroup,
  type PasteMode,
  normalizePastedKeyframes,
} from '../keyframes';
import { normalizeProjectDocumentation } from '../project/documentation';
import { applyConformMedia, type ConformMediaReplacement } from '../project/conform-media';
import {
  applyProjectHealthAutoRepair,
  type ProjectHealthAutoRepairInput,
  type ProjectHealthRepairReport,
} from '../project/project-health-repair';
import { normalizeProjectReleaseVersion } from '../project/release-workflow';
import { applyProxyMigration, type ProxyMigrationUpdate } from '../proxy/proxy-management';
import {
  buildTextAnimationKeyframes,
  mergeTextAnimationKeyframes,
  normalizeTextAnimationDirection,
  normalizeTextAnimationDuration,
  normalizeTextAnimationPreset,
  type TextAnimationDirection,
  type TextAnimationPreset,
} from '../text-animation';
import {
  normalizeRichTextDocument,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
} from '../text-layout';
import {
  cloneEffects,
  normalizeEffect,
  normalizeEffects,
  type Effect,
  type EffectParams,
  type EffectType,
} from '../effects';
import { buildEffectPresetClipPatch, type EffectPreset } from '../effect-presets';
import { applyStyleToClip, type ApplyStyleTransferOptions, type StyleSummary } from '../style-transfer';
import {
  buildBeatSyncSpeedKeyframes,
  calculateBeatAlignmentUpdates,
  calculateBeatSnapUpdates,
  normalizeBeatMarkers,
  type BeatAlignmentUpdate,
  type BeatMarker,
  type BeatSnapUpdate,
} from '../beats';
import {
  buildDialogueRoughCutClips,
  buildRhythmAssembleClips,
  buildSmartMontageClips,
  type SmartDialogueInterval,
  type SmartMontageConfig,
  type SmartRoughCutVisualClip,
} from '../smart-rough-cut-v2';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../timeline-color-labels';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges } from '../timeline-protection';
import {
  buildCrossfadeGapFillTransition,
  buildRepeatedGapFillClip,
  findTimelineGapAtTime,
  type FillGapOperation,
} from '../timeline-gap-fill';
import {
  createMulticamSequenceProject,
  setMulticamSwitch,
  trimMulticamSwitch,
  addSwitchPoint,
  deleteSwitchPoint,
  updateSwitchPoint,
} from '../multicam';
import { normalizeMotionGraphic } from '../motion-graphics';
import type { ColorGradingGraph, ColorGradingNode, ColorGradingConnection } from '../color-grading/types';
import { createEmptyColorGradingGraph } from '../color-grading/types';
import {
  applyCmx3600EdlImport,
  buildCmx3600EdlImport,
  type Cmx3600EdlImportOptions,
  type Cmx3600EdlImportResult,
} from '../export/timeline-import';
import {
  applyFcpXmlImport,
  buildFcpXmlImport,
  type FcpXmlImportOptions,
  type FcpXmlImportResult,
} from '../export/fcpxml-import';
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
} from '../timeline';
import { round } from '../time';
import type { Command } from './command';
import type { Command } from './command';
import {
  type TimelineAccessor,
  type ProjectAccessor,
  type LocalTimeRange,
  assertClipsNotOnLockedTrack,
  findTrack,
  findClip,
  findClipLocation,
  timelineHasOverlaps,
  getProjectActiveClipIds,
  removeClipsFromTimeline,
  applyClipGroupBatchPatch,
  buildKeptRanges,
  buildSplitRanges,
  replaceClipWithSlices,
  rippleDeleteTrackClips,
  buildRollingTrimClips,
  getClipTotalSourceDuration,
  insertClip,
  touchProject,
  cloneCommandValue,
  clampTrimValues,
  applySpeedKeyframeDuration,
  mergeChromaKeyPatch,
  isPiPVisualClip,
  sortTimelineClips,
  insertGeneratedClips,
  replaceClipWithGeneratedClips,
  sortMarkers,
  sortAnnotations,
  sortReviewAnnotations,
  sortCollaborationNotes,
  sortTimelineNotes,
  sortBookmarks,
  uniqueKeyframeRefs,
  groupKeyframeRefsByClip,
  calculateKeyframeSelectionCenter,
  keyframeRefKey,
  calculateDistributedKeyframeTimeMap,
  getBatchAlignValue,
  getBatchEditedKeyframeTime,
  normalizeAssetIdSet,
  assertMediaAssetsExist,
  collectProjectMediaIds,
  removeMediaAssets,
  mergeMediaReferences,
  replaceTimelineMediaReferences,
  filterMediaMetadata,
  cloneClipForNestedSequence,
  updateClipColorGradingGraph,
  resolveSubtitleImportTarget,
  packNestedSequence,
  cutMulticamClip,
  trimMulticamClip,
  findTrackGapAtTime,
  closeTrackGap,
} from './helpers';
import { normalizeClipKeyframes, normalizePastedKeyframes, cloneClipKeyframes, type ClipboardKeyframeGroup, type PasteMode } from '../keyframes';

export class AddTrackCommand implements Command {
  readonly description: string;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
  ) {
    this.description = `Add ${track.type} track`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = timeline.tracks.length;
    this.accessor.setTimeline({ ...timeline, tracks: [...timeline.tracks, this.track] });
  }

  undo(): void {
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({ ...timeline, tracks: timeline.tracks.filter((track) => track.id !== this.track.id) });
  }
}

export class AddSpeakerDiarizationTracksCommand implements Command {
  readonly description = 'Add speaker diarization tracks';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly tracks: Track[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const existingIds = new Set(timeline.tracks.map((track) => track.id));
    const nextTracks = this.tracks.filter((track) => !existingIds.has(track.id));
    this.accessor.setTimeline({ ...timeline, tracks: [...timeline.tracks, ...nextTracks] });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export type TrackPatch = Partial<
  Pick<
    Track,
    | 'name'
    | 'language'
    | 'subtitleType'
    | 'color'
    | 'muted'
    | 'solo'
    | 'locked'
    | 'volume'
    | 'pan'
    | 'eq'
    | 'compressor'
  >
>;

export interface BatchUpdateTrackCommandOptions {
  patches?: Record<string, TrackPatch>;
  order?: string[];
  deleteEmptyTrackIds?: string[];
}

export class UpdateTrackCommand implements Command {
  readonly description = 'Update track';
  private before?: Track;
  private after?: Track;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly patch: TrackPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findTrack(timeline, this.trackId);
    this.after = applyTrackPatch(this.before, this.patch);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.after! : track)),
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.before! : track)),
    });
  }
}

export class BatchUpdateTrackCommand implements Command {
  readonly description = 'Batch update tracks';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly options: BatchUpdateTrackCommandOptions,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    const patchByTrackId = this.options.patches ?? {};
    const deleteEmptyIds = new Set(this.options.deleteEmptyTrackIds ?? []);
    let tracks = this.before.tracks
      .map((track) => applyTrackPatch(track, patchByTrackId[track.id]))
      .filter((track) => !(deleteEmptyIds.has(track.id) && track.clips.length === 0));

    if (this.options.order) {
      const byId = new Map(tracks.map((track) => [track.id, track]));
      const ordered = this.options.order.flatMap((trackId) => {
        const track = byId.get(trackId);
        if (!track) {
          return [];
        }
        byId.delete(trackId);
        return [track];
      });
      tracks = [...ordered, ...tracks.filter((track) => byId.has(track.id))];
    }

    this.after = { ...this.before, tracks };
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export type ProjectAudioPatch = Partial<Pick<Project, 'masterVolume'>>;

export class UpdateProjectAudioCommand implements Command {
  readonly description = 'Update project audio';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly patch: ProjectAudioPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...this.before,
      ...this.patch,
      masterVolume:
        this.patch.masterVolume === undefined
          ? this.before.masterVolume
          : normalizeMasterVolume(this.patch.masterVolume),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setProject(this.before);
  }
}

export class BatchUpdateTrackHeightCommand implements Command {
  readonly description: string;
  private before?: Project;
  private readonly height: number;

  constructor(
    private readonly accessor: ProjectAccessor,
    height: number,
  ) {
    this.description = 'Batch update track height';
    this.height = clampTrackHeight(height);
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const tracks = project.timeline.tracks.map((track) => ({
      ...track,
      displayHeight: this.height,
    }));
    this.accessor.setProject({
      ...project,
      timeline: { ...project.timeline, tracks },
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
