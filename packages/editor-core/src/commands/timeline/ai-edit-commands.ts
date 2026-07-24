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

export interface ApplyStyleCommandOptions extends ApplyStyleTransferOptions {
  clipIds?: string[];
}

export class ApplyStyleCommand implements Command {
  readonly description = 'Apply style transfer';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly summary: StyleSummary,
    private readonly options: ApplyStyleCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const targetIds = this.options.clipIds?.length ? new Set(this.options.clipIds) : undefined;
    let applied = 0;
    const nextTimeline: Timeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (targetIds && !targetIds.has(clip.id)) {
            return clip;
          }
          applied += 1;
          return applyStyleToClip(clip, this.summary, this.options);
        }),
      })),
    };
    if (targetIds && applied === 0) {
      throw new Error('No clips match style transfer target');
    }
    this.accessor.setTimeline(nextTimeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

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

export interface BatchSplitAtSceneCutItem {
  clipId: string;
  cuts?: number[];
  minSceneSeconds?: number;
}

export class BatchSplitAtSceneCutsCommand implements Command {
  readonly description = 'Split clips at scene cuts';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly items: BatchSplitAtSceneCutItem[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      let next = timeline;
      let splitCount = 0;
      for (const item of this.items) {
        const clip = findClip(next, item.clipId);
        const cuts = item.cuts ?? clip.scenecuts ?? [];
        const splitTimes = filterShortSceneCuts(cuts, clip.duration, item.minSceneSeconds ?? 0);
        if (splitTimes.length === 0) {
          continue;
        }
        const ranges = buildSplitRanges(clip.duration, splitTimes);
        if (ranges.length <= 1) {
          continue;
        }
        next = replaceClip(next, { ...clip, scenecuts: splitTimes } as Clip);
        next = replaceClipWithSlices(next, item.clipId, ranges, false);
        splitCount += splitTimes.length;
      }
      if (splitCount === 0) {
        throw new Error('No valid scene cuts inside clip bounds');
      }
      this.after = next;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class BatchAddMarkersCommand implements Command {
  readonly description = 'Add timeline markers';
  private before?: Timeline;
  private markers?: TimelineMarker[];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly inputs: AddTimelineMarkerInput[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    this.markers ??= this.inputs.map((input) => createTimelineMarker(input, getTimelineDuration(timeline)));
    if (this.markers.length === 0) {
      throw new Error('No timeline markers to add');
    }
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers([...(timeline.markers ?? []), ...this.markers]),
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class RemoveSilenceCommand implements Command {
  readonly description = 'Remove silence';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly ranges: LocalTimeRange[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      const keptRanges = buildKeptRanges(clip.duration, this.ranges);
      if (keptRanges.length === 0) {
        throw new Error('Silence removal would remove the entire clip');
      }
      if (keptRanges.length === 1 && keptRanges[0].start <= 0.000001 && keptRanges[0].end >= clip.duration - 0.000001) {
        throw new Error('No silence ranges inside clip bounds');
      }
      this.after = replaceClipWithSlices(timeline, this.clipId, keptRanges, true);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class DialogueRoughCutCommand implements Command {
  readonly description = 'Dialogue rough cut';
  private before?: Timeline;
  private after?: Timeline;
  private generatedCount = 0;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly intervals: SmartDialogueInterval[],
  ) {}

  get clipCount(): number {
    return this.generatedCount;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error('Dialogue rough cut requires an audio or video clip');
      }
      const clips = buildDialogueRoughCutClips(clip, this.intervals);
      if (clips.length === 0) {
        throw new Error('No dialogue intervals inside clip bounds');
      }
      this.generatedCount = clips.length;
      this.after = replaceClipWithGeneratedClips(timeline, clip.id, clips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BrollInsertCommand implements Command {
  readonly description = 'Insert B-roll clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clips: SmartRoughCutVisualClip[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      if (this.clips.length === 0) {
        throw new Error('No B-roll clips to insert');
      }
      this.after = insertGeneratedClips(timeline, this.clips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class RhythmAssembleCommand implements Command {
  readonly description = 'Rhythm assemble clips';
  private before?: Timeline;
  private after?: Timeline;
  private generatedCount = 0;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly beatTimes: number[],
    private readonly targetTrackId?: string,
  ) {}

  get clipCount(): number {
    return this.generatedCount;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const selected = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter(
          (clip): clip is SmartRoughCutVisualClip =>
            selected.has(clip.id) && (clip.type === 'video' || clip.type === 'image'),
        );
      const assembled = buildRhythmAssembleClips(clips, this.beatTimes, this.targetTrackId);
      if (assembled.length === 0) {
        throw new Error('No rhythm clips to assemble');
      }
      this.generatedCount = assembled.length;
      const withoutSources = removeClipsFromTimeline(timeline, new Set(clips.map((clip) => clip.id)));
      this.after = insertGeneratedClips(withoutSources, assembled);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class SmartMontageCommand implements Command {
  readonly description = 'AI smart montage';
  private before?: Timeline;
  private after?: Timeline;
  private result: { clipCount: number; estimatedBpm: number } = { clipCount: 0, estimatedBpm: 0 };

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly config: SmartMontageConfig,
  ) {}

  get montageResult(): { clipCount: number; estimatedBpm: number } {
    return this.result;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const montage = buildSmartMontageClips(this.config);
      if (!montage) {
        throw new Error('Smart montage: unable to build clips from the provided assets and beat data');
      }
      const allClips: Clip[] = [...montage.visualClips, montage.audioClip];
      this.result = { clipCount: montage.visualClips.length, estimatedBpm: montage.estimatedBpm };
      this.after = insertGeneratedClips(timeline, allClips);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

function replaceClipWithGeneratedClips(timeline: Timeline, sourceClipId: string, clips: Clip[]): Timeline {
  const withoutSource = removeClip(timeline, sourceClipId).timeline;
  return insertGeneratedClips(withoutSource, clips);
}

function insertGeneratedClips(timeline: Timeline, clips: Clip[]): Timeline {
  let next = timeline;
  for (const clip of clips) {
    const track = findTrack(next, clip.trackId);
    if (track.clips.some((item) => item.id === clip.id)) {
      throw new Error(`Clip ${clip.id} already exists`);
    }
    if (detectOverlap(track, clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    next = insertClip(next, clip);
  }
  return sortTimelineClips(next);
}

function sortTimelineClips(timeline: Timeline): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
    })),
  };
}
