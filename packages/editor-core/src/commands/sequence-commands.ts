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

function cloneClipForNestedSequence<TClip extends Clip>(clip: TClip): TClip {
  const cloned = {
    ...clip,
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    transform: { ...clip.transform },
    chromaKey: normalizeChromaKey(clip.chromaKey),
    stabilization: normalizeStabilization(clip.stabilization),
    frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
    videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
    projection: normalizeClipProjection(clip.projection),
    panorama: normalizeClipPanoramaView(clip.panorama),
    masks: normalizeMasks(clip.masks),
    motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
    sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration),
    effects: cloneEffects(clip.effects),
  };
  if (clip.type === 'credits') {
    return {
      ...cloned,
      rows: normalizeCreditsRows(clip.rows, clip.text),
      rollSpeed: normalizeCreditsRollSpeed(clip.rollSpeed),
      style: normalizeCreditsStyle(clip.style),
    } as TClip;
  }
  if (clip.type === 'motion-graphic') {
    return {
      ...cloned,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration),
    } as TClip;
  }
  if (clip.type === 'text' || clip.type === 'subtitle') {
    if (clip.type === 'text') {
      return {
        ...cloned,
        text: clip.text,
        style: { ...clip.style },
        richText: normalizeRichTextDocument(clip.richText, clip.text),
        textLayout: normalizeTextLayout(clip.textLayout),
        openTypeFeatures: normalizeTextOpenTypeFeatures(clip.openTypeFeatures),
        arcText: normalizeTextArc(clip.arcText),
        pathText: normalizeTextPath(clip.pathText),
      } as TClip;
    }
    return { ...cloned, style: { ...clip.style } } as TClip;
  }
  return cloned as TClip;
}

function packNestedSequence(project: Project, clipIds: string[], sequenceName: string): Project {
  const uniqueIds = Array.from(new Set(clipIds));
  if (uniqueIds.length === 0) {
    throw new Error('No clips selected for nested sequence');
  }
  const timeline = project.timeline;
  const selectedIds = new Set(uniqueIds);
  const trackIndexById = new Map(timeline.tracks.map((track, index) => [track.id, index]));
  const locations = uniqueIds
    .map((id) => findClipLocation(timeline, id))
    .sort((left, right) => {
      return (
        (trackIndexById.get(left.trackId) ?? 0) - (trackIndexById.get(right.trackId) ?? 0) ||
        left.clip.start - right.clip.start
      );
    });
  const start = round(Math.min(...locations.map((location) => location.clip.start)));
  const end = round(Math.max(...locations.map((location) => location.clip.start + location.clip.duration)));
  const duration = round(Math.max(0.001, end - start));
  const sequenceId = createId('sequence');
  const name = sequenceName.trim() || DEFAULT_NESTED_SEQUENCE_NAME;
  const target = locations[0];
  const targetTrack = timeline.tracks.find((track) => track.id === target.trackId);
  if (!targetTrack) {
    throw new Error(`Track ${target.trackId} not found`);
  }
  const blocked = targetTrack.clips.some(
    (clip) => !selectedIds.has(clip.id) && clip.start < end && clip.start + clip.duration > start,
  );
  if (blocked) {
    throw new Error('Nested sequence would overlap an unselected clip');
  }

  const nestedTimeline = {
    tracks: timeline.tracks
      .map((track) =>
        createTrack({
          ...track,
          clips: track.clips
            .filter((clip) => selectedIds.has(clip.id))
            .map((clip) => ({
              ...cloneClipForNestedSequence(clip),
              start: round(clip.start - start),
              trackId: track.id,
            })),
        }),
      )
      .filter((track) => track.clips.length > 0),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => selectedIds.has(transition.fromClipId) && selectedIds.has(transition.toClipId),
    ),
    markers: (timeline.markers ?? [])
      .filter((marker) => marker.time >= start && marker.time <= end)
      .map((marker) => ({ ...marker, time: round(marker.time - start) })),
  };

  const nestedClip = createNestedSequenceClip({
    id: createId('clip'),
    type: 'nested-sequence',
    name,
    trackId: target.trackId,
    sequenceId,
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
  });
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const kept = track.clips.filter((clip) => !selectedIds.has(clip.id));
      if (track.id !== target.trackId) {
        return { ...track, clips: kept };
      }
      const insertIndex = kept.findIndex((clip) => clip.start > nestedClip.start);
      const clips =
        insertIndex === -1
          ? [...kept, nestedClip]
          : [...kept.slice(0, insertIndex), nestedClip, ...kept.slice(insertIndex)];
      return { ...track, clips };
    }),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => !selectedIds.has(transition.fromClipId) && !selectedIds.has(transition.toClipId),
    ),
  };
  if (timelineHasOverlaps(nextTimeline)) {
    throw new Error('Nested sequence would overlap another clip');
  }

  const syncedProject = replaceProjectActiveTimeline(project, nextTimeline);
  return {
    ...syncedProject,
    sequences: [
      ...syncedProject.sequences,
      createSequence({
        id: sequenceId,
        name,
        timeline: nestedTimeline,
      }),
    ],
  };
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
