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

export interface PasteKeyframesInput {
  groups: ClipboardKeyframeGroup[];
  targetClipId: string;
  mode: PasteMode;
  targetProperty?: KeyframeProperty;
}

export class PasteKeyframesCommand implements Command {
  readonly description = 'Paste keyframes';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: PasteKeyframesInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.input.targetClipId);
    const result = normalizePastedKeyframes(
      this.input.groups,
      this.before.start,
      this.before.duration,
      this.input.mode,
      this.input.targetProperty,
    );
    let keyframes = cloneClipKeyframes(this.before.keyframes);
    for (const { property, keyframes: pasted } of result) {
      for (const kf of pasted) {
        keyframes = setKeyframeForProperty(keyframes, property, kf, this.before.duration);
      }
    }
    this.after = {
      ...this.before,
      keyframes: normalizeClipKeyframes(keyframes, this.before.duration),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export interface AddKeyframeInput {
  id?: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
  inHandle?: KeyframeHandle;
  outHandle?: KeyframeHandle;
  handleMode?: KeyframeHandleMode;
}

export class AddKeyframeCommand implements Command {
  readonly description = 'Add keyframe';
  private before?: Clip;
  private after?: Clip;
  private keyframe?: Keyframe<number>;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly input: AddKeyframeInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.keyframe ??= createKeyframe(this.property, this.input, this.before.duration);
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, this.keyframe, this.before.duration),
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (
      this.property === 'speed' &&
      detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)
    ) {
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

export interface BatchUpdateKeyframeItem {
  clipId: string;
  property: KeyframeProperty;
  keyframes: AddKeyframeInput[];
  replace?: boolean;
}

export class BatchUpdateKeyframeCommand implements Command {
  readonly description: string;
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: BatchUpdateKeyframeItem[],
    description = 'Batch update keyframes',
  ) {
    this.description = description;
  }

  execute(): void {
    let timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    for (const update of this.updates) {
      const beforeClip = findClip(timeline, update.clipId);
      let keyframes = update.replace
        ? { ...(beforeClip.keyframes ?? {}), [update.property]: [] }
        : beforeClip.keyframes;
      for (const input of update.keyframes) {
        keyframes = setKeyframeForProperty(
          keyframes,
          update.property,
          createKeyframe(update.property, input, beforeClip.duration),
          beforeClip.duration,
        );
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
      } as Clip;
      after = applySpeedKeyframeDuration(beforeClip, after, update.property);
      if (update.property === 'speed' && detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      timeline = replaceClip(timeline, after);
    }
    this.accessor.setTimeline(timeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export type KeyframePatch = Partial<
  Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>
>;

export interface KeyframeSelectionRef {
  clipId: string;
  property: KeyframeProperty;
  keyframeId: string;
}

export type BatchKeyframeEditOperation =
  | { type: 'shift'; delta: number }
  | { type: 'scale-time'; factor: number; center?: number }
  | { type: 'delete' }
  | { type: 'easing'; easing: KeyframeEasing }
  | { type: 'distribute-time' }
  | { type: 'align-value'; value?: number };

export class UpdateKeyframeCommand implements Command {
  readonly description = 'Update keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly keyframeId: string,
    private readonly patch: KeyframePatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const existing = this.before.keyframes?.[this.property]?.find((frame) => frame.id === this.keyframeId);
    if (!existing) {
      throw new Error(`Keyframe ${this.keyframeId} not found`);
    }
    const nextKeyframe = createKeyframe(
      this.property,
      {
        id: existing.id,
        time: this.patch.time ?? existing.time,
        value: this.patch.value ?? existing.value,
        easing: this.patch.easing ?? existing.easing,
        inHandle: this.patch.inHandle ?? existing.inHandle,
        outHandle: this.patch.outHandle ?? existing.outHandle,
        handleMode: this.patch.handleMode ?? existing.handleMode,
      },
      this.before.duration,
    );
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, nextKeyframe, this.before.duration),
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (
      this.property === 'speed' &&
      detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)
    ) {
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

export class BatchKeyframeEditCommand implements Command {
  readonly description: string;
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly refs: KeyframeSelectionRef[],
    private readonly operation: BatchKeyframeEditOperation,
    description = 'Batch edit keyframes',
  ) {
    this.description = description;
  }

  execute(): void {
    let timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const refs = uniqueKeyframeRefs(this.refs);
    if (refs.length === 0) {
      return;
    }
    const center =
      this.operation.type === 'scale-time'
        ? (this.operation.center ?? calculateKeyframeSelectionCenter(timeline, refs))
        : 0;
    const distributedTimes =
      this.operation.type === 'distribute-time'
        ? calculateDistributedKeyframeTimeMap(timeline, refs)
        : new Map<string, number>();
    const alignValue =
      this.operation.type === 'align-value' ? getBatchAlignValue(timeline, refs, this.operation.value) : undefined;
    const refsByClipId = groupKeyframeRefsByClip(refs);
    for (const [clipId, clipRefs] of refsByClipId) {
      const beforeClip = findClip(timeline, clipId);
      let keyframes = cloneClipKeyframes(beforeClip.keyframes);
      const touchedProperties = new Set<KeyframeProperty>();
      for (const ref of clipRefs) {
        const existing = keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId);
        if (!existing) {
          throw new Error(`Keyframe ${ref.keyframeId} not found`);
        }
        touchedProperties.add(ref.property);
        if (this.operation.type === 'delete') {
          keyframes = removeKeyframeForProperty(keyframes, ref.property, ref.keyframeId);
          continue;
        }
        const nextTime =
          this.operation.type === 'distribute-time'
            ? (distributedTimes.get(keyframeRefKey(ref)) ?? existing.time)
            : getBatchEditedKeyframeTime(beforeClip, existing, this.operation, center);
        const nextValue =
          this.operation.type === 'align-value' ? alignKeyframeValues([existing], alignValue)[0].value : existing.value;
        const nextEasing =
          this.operation.type === 'easing'
            ? applyBatchKeyframeEasing([existing], this.operation.easing)[0].easing
            : existing.easing;
        keyframes = setKeyframeForProperty(
          keyframes,
          ref.property,
          createKeyframe(
            ref.property,
            {
              id: existing.id,
              time: nextTime,
              value: nextValue,
              easing: nextEasing,
              inHandle: existing.inHandle,
              outHandle: existing.outHandle,
              handleMode: existing.handleMode,
            },
            beforeClip.duration,
          ),
          beforeClip.duration,
        );
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
      } as Clip;
      if (touchedProperties.has('speed')) {
        after = applySpeedKeyframeDuration(beforeClip, after, 'speed');
        if (detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
          throw new Error('Clip overlaps another clip on this track');
        }
      }
      timeline = replaceClip(timeline, after);
    }
    this.accessor.setTimeline(timeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class RemoveKeyframeCommand implements Command {
  readonly description = 'Remove keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly keyframeId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    if (!this.before.keyframes?.[this.property]?.some((frame) => frame.id === this.keyframeId)) {
      throw new Error(`Keyframe ${this.keyframeId} not found`);
    }
    this.after = {
      ...this.before,
      keyframes: removeKeyframeForProperty(this.before.keyframes, this.property, this.keyframeId),
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (
      this.property === 'speed' &&
      detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)
    ) {
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

export interface ApplyTextAnimationInput {
  preset: TextAnimationPreset;
  duration: number;
  direction: TextAnimationDirection;
}

export class ApplyTextAnimationCommand implements Command {
  readonly description = 'Apply text animation';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: ApplyTextAnimationInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    if (this.before.type !== 'text') {
      throw new Error('Text animation can only be applied to text clips');
    }
    const preset = normalizeTextAnimationPreset(this.input.preset);
    const direction = normalizeTextAnimationDirection(this.input.direction);
    const duration = normalizeTextAnimationDuration(this.input.duration);
    const generated = buildTextAnimationKeyframes({
      preset,
      direction,
      duration,
      clipDuration: this.before.duration,
      transform: this.before.transform,
      text: this.before.text,
    });
    this.after = {
      ...this.before,
      keyframes: mergeTextAnimationKeyframes(this.before.keyframes, generated, this.before.duration),
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

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
