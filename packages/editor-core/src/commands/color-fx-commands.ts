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

export class ApplyShakeStabilizationCommand implements Command {
  readonly description = 'Apply shake stabilization';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly stabilizationUpdate: Partial<ClipStabilization>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const timeline = this.before.timeline;
      const clip = findClip(timeline, this.clipId);
      const prev = clip.stabilization ?? normalizeStabilization({});
      const updated: ClipStabilization = normalizeStabilization({
        ...prev,
        ...this.stabilizationUpdate,
        enabled: true,
        analyzed: true,
      });
      const updatedClip = { ...clip, stabilization: updated };
      this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class ApplyPipPlacementCommand implements Command {
  readonly description = 'Apply PiP placement suggestion';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly suggestedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const timeline = this.before.timeline;
      const clip = findClip(timeline, this.clipId);
      const currentTransform = clip.transform ?? normalizeTransform({});
      const updatedTransform = { ...currentTransform };
      switch (this.suggestedCorner) {
        case 'top-left':
          updatedTransform.x = -0.5;
          updatedTransform.y = 0.5;
          break;
        case 'top-right':
          updatedTransform.x = 0.5;
          updatedTransform.y = 0.5;
          break;
        case 'bottom-left':
          updatedTransform.x = -0.5;
          updatedTransform.y = -0.5;
          break;
        case 'bottom-right':
        default:
          updatedTransform.x = 0.5;
          updatedTransform.y = -0.5;
          break;
      }
      const updatedClip = { ...clip, transform: updatedTransform };
      this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class ApplyPlatformFitCommand implements Command {
  readonly description = 'Apply platform fit suggestion';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly suggestion: ProjectPlatformFitSuggestion,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removedIds = new Set(this.suggestion.removedSegments.map((s) => s.clipId));
      let project: Project = { ...this.before, platformFitSuggestion: this.suggestion };
      const timeline = project.timeline;
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (removedIds.has(clip.id)) {
            return { ...clip, platformFitRemoved: true };
          }
          const { platformFitRemoved, ...rest } = clip as typeof clip & { platformFitRemoved?: boolean };
          return rest;
        }),
      }));
      project = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
      this.after = project;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class RestorePlatformFitClipCommand implements Command {
  readonly description = 'Restore a platform-fit removed clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      let project = this.before;
      if (project.platformFitSuggestion) {
        const kept = project.platformFitSuggestion.removedSegments.find((s) => s.clipId === this.clipId);
        if (kept) {
          const newSuggestion = {
            ...project.platformFitSuggestion,
            removedSegments: project.platformFitSuggestion.removedSegments.filter((s) => s.clipId !== this.clipId),
            keptSegments: [...project.platformFitSuggestion.keptSegments, kept].sort((a, b) => a.start - b.start),
          };
          project = { ...project, platformFitSuggestion: newSuggestion };
        }
      }
      const timeline = project.timeline;
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === this.clipId) {
            const { platformFitRemoved, ...rest } = clip as typeof clip & { platformFitRemoved?: boolean };
            return rest;
          }
          return clip;
        }),
      }));
      this.after = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

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
