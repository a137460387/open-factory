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

export class AddMediaFolderCommand implements Command {
  readonly description = 'Add media folder';
  private before?: Project;
  private after?: Project;
  private createdFolder?: MediaFolder;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: MediaFolderInput = {},
  ) {}

  get folder(): MediaFolder | undefined {
    return this.createdFolder;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = addMediaFolderToProject(this.before, this.input);
      this.after = result.project;
      this.createdFolder = result.folder;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class RenameMediaFolderCommand implements Command {
  readonly description = 'Rename media folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
    private readonly name: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(renameMediaFolder(this.accessor.getProject(), this.folderId, this.name));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class SetMediaFolderCollapsedCommand implements Command {
  readonly description = 'Set media folder collapsed';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
    private readonly collapsed: boolean,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(setMediaFolderCollapsed(this.accessor.getProject(), this.folderId, this.collapsed));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteMediaFolderCommand implements Command {
  readonly description = 'Delete media folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(deleteMediaFolder(this.accessor.getProject(), this.folderId));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MoveMediaToFolderCommand implements Command {
  readonly description = 'Move media to folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly assetIds: string[],
    private readonly folderId?: string | null,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(moveMediaAssetsToFolder(this.accessor.getProject(), this.assetIds, this.folderId));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

function insertClip(timeline: Timeline, clip: Clip, index?: number): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== clip.trackId) {
        return track;
      }
      const clips = [...track.clips];
      clips.splice(index ?? clips.length, 0, clip);
      return { ...track, clips };
    }),
  };

export class RemoveMediaCommand implements Command {
  readonly description = 'Remove media';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly assetIds: string | string[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removeIds = normalizeAssetIdSet(this.assetIds);
      assertMediaAssetsExist(this.before, removeIds);
      const referencedIds = collectProjectMediaIds(this.before);
      const referenced = Array.from(removeIds).filter((assetId) => referencedIds.has(assetId));
      if (referenced.length > 0) {
        throw new Error(`Media asset is still used by timeline clips: ${referenced.join(', ')}`);
      }
      this.after = removeMediaAssets(this.before, removeIds);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MergeMediaCommand implements Command {
  readonly description = 'Merge media references';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly keepAssetId: string,
    private readonly mergedAssetIds: string[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removeIds = normalizeAssetIdSet(this.mergedAssetIds.filter((assetId) => assetId !== this.keepAssetId));
      if (removeIds.size === 0) {
        throw new Error('No duplicate media assets selected');
      }
      assertMediaAssetsExist(this.before, new Set([this.keepAssetId, ...removeIds]));
      this.after = mergeMediaReferences(this.before, this.keepAssetId, removeIds);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface BatchUpdateMetadataCommandItem {
  assetId: string;
  metadata: BatchEditableMediaMetadata;
}

export class BatchUpdateMetadataCommand implements Command {
  readonly description = 'Batch update media metadata';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly updates: BatchUpdateMetadataCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const assetIds = normalizeAssetIdSet(this.updates.map((update) => update.assetId));
      assertMediaAssetsExist(this.before, assetIds);
      const mediaMetadata = { ...this.before.mediaMetadata };
      for (const update of this.updates) {
        const current = mediaMetadata[update.assetId] ?? {};
        const normalized = normalizeMediaMetadataEntry({
          ...current,
          ...update.metadata,
        });
        if (normalized) {
          mediaMetadata[update.assetId] = normalized;
        } else {
          delete mediaMetadata[update.assetId];
        }
      }
      this.after = touchProject({
        ...this.before,
        mediaMetadata,
      });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface BatchRenameMediaCommandItem {
  assetId: string;
  name: string;
  path?: string;
}

export class BatchRenameMediaCommand implements Command {
  readonly description = 'Batch rename media';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly renames: BatchRenameMediaCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const assetIds = normalizeAssetIdSet(this.renames.map((rename) => rename.assetId));
      assertMediaAssetsExist(this.before, assetIds);
      const renameByAssetId = new Map(this.renames.map((rename) => [rename.assetId, rename]));
      this.after = touchProject({
        ...this.before,
        media: this.before.media.map((asset) => {
          const rename = renameByAssetId.get(asset.id);
          if (!rename) {
            return asset;
          }
          return {
            ...asset,
            name: rename.name.trim() || asset.name,
            path: rename.path?.trim() || asset.path,
          };
        }),
      });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MigrateProxiesCommand implements Command {
  readonly description = 'Migrate proxy paths';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly updates: ProxyMigrationUpdate[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.after = {
        ...this.before,
        media: applyProxyMigration(this.before.media, this.updates),
        updatedAt: new Date().toISOString(),
      };
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class AutoRepairProjectHealthCommand implements Command {
  readonly description = 'Auto repair project health';
  private before?: Project;
  private after?: Project;
  private repairReport?: ProjectHealthRepairReport;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: ProjectHealthAutoRepairInput,
  ) {}

  get report(): ProjectHealthRepairReport | undefined {
    return this.repairReport;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = applyProjectHealthAutoRepair(this.before, this.input);
      this.after = result.project;
      this.repairReport = result.report;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}