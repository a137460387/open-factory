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

export class CreateMulticamSequenceCommand implements Command {
  readonly description = 'Create multicam sequence';
  private before?: Project;
  private after?: Project;
  private resultClipId?: string;
  private resultSequenceId?: string;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME,
  ) {}

  get multicamClipId(): string | undefined {
    return this.resultClipId;
  }

  get sequenceId(): string | undefined {
    return this.resultSequenceId;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = createMulticamSequenceProject(this.before, this.clipIds, { sequenceName: this.sequenceName });
      this.after = result.project;
      this.resultClipId = result.multicamClipId;
      this.resultSequenceId = result.sequenceId;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class CutMulticamClipCommand implements Command {
  readonly description = 'Cut multicam clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly sceneTime: number,
    private readonly angleId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= cutMulticamClip(this.before, this.clipId, this.sceneTime, this.angleId);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface MulticamAngleCut {
  sceneTime: number;
  angleId: string;
}

export class RecordAngleCutCommand implements Command {
  readonly description = 'Record multicam angle cuts';
  private before?: Project;
  private after?: Project;
  private readonly cuts: MulticamAngleCut[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    cuts: MulticamAngleCut[] = [],
  ) {
    this.cuts = cuts.map((cut) => ({ sceneTime: cut.sceneTime, angleId: cut.angleId }));
  }

  get cutCount(): number {
    return this.cuts.length;
  }

  record(sceneTime: number, angleId: string): void {
    this.cuts.push({ sceneTime, angleId });
    this.applyCuts();
  }

  execute(): void {
    this.applyCuts();
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }

  private applyCuts(): void {
    this.before ??= this.accessor.getProject();
    this.after = this.cuts.reduce(
      (project, cut) => cutMulticamClip(project, this.clipId, cut.sceneTime, cut.angleId),
      this.before,
    );
    this.accessor.setProject(this.after);
  }
}

export class TrimMulticamSwitchCommand implements Command {
  readonly description = 'Trim multicam switch';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchId: string,
    private readonly frameDelta: number,
    private readonly fps: number,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= trimMulticamClip(this.before, this.clipId, this.switchId, this.frameDelta, this.fps);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ApplyMulticamAiCutSuggestionsCommand implements Command {
  readonly description = 'Apply AI multicam cut suggestions';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly suggestions: Array<{ time: number; angleId: string; confidence: number; reason: string }>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.before;
      const clip = findClip(project.timeline, this.clipId);
      if (clip.type !== 'nested-sequence' || !clip.multicam) {
        throw new Error('Clip is not a multicam sequence');
      }
      const normalized = normalizeMulticamSequence(clip.multicam, clip.duration);
      if (!normalized) {
        throw new Error('Invalid multicam sequence');
      }
      const switchMap = new Map<number, { time: number; angleId: string }>();
      for (const sw of normalized.switches) {
        switchMap.set(sw.time, { time: sw.time, angleId: sw.angleId });
      }
      for (const suggestion of this.suggestions) {
        const localTime = round(Math.min(clip.duration, Math.max(0, suggestion.time - clip.start + clip.trimStart)));
        switchMap.set(localTime, { time: localTime, angleId: suggestion.angleId });
      }
      const newSwitches = [...switchMap.values()]
        .sort((a, b) => a.time - b.time)
        .map((sw) => ({ id: createId('multicam-switch'), time: sw.time, angleId: sw.angleId }));
      const finalMc = normalizeMulticamSequence({ ...normalized, switches: newSwitches }, clip.duration);
      if (!finalMc) {
        throw new Error('Invalid multicam after merge');
      }
      const multicam = { ...clip.multicam, switches: finalMc.switches, aiCutSuggestions: this.suggestions };
      const updatedClip = { ...clip, multicam };
      this.after = replaceProjectActiveTimeline(project, replaceClip(project.timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class CreateMulticamClipCommand implements Command {
  readonly description = 'Create multicam clip';
  private before?: Project;
  private _result?: MulticamClip;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly trackId: string,
    private readonly angles: MulticamClipAngle[],
    private readonly syncMode: MulticamSyncMode,
    private readonly syncReferenceAngle: number,
    private readonly start = 0,
    private readonly duration = 10,
  ) {}

  get result(): MulticamClip {
    if (!this._result) {
      throw new Error('Command not executed');
    }
    return this._result;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this._result) {
      const clip = createMulticamClip(this.angles, this.syncMode, this.syncReferenceAngle);
      this._result = { ...clip, trackId: this.trackId, start: this.start, duration: this.duration };
    }
    const project = this.accessor.getProject();
    const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
    const timeline = syncedProject.timeline;
    const nextTimeline = insertClip(timeline, this._result as unknown as Clip);
    this.accessor.setProject(touchProject(replaceProjectActiveTimeline(syncedProject, nextTimeline)));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 切换多机位角度命令（添加切换点）
 */
export class SwitchMulticamAngleCommand implements Command {
  readonly description = 'Switch multicam angle';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly time: number,
    private readonly targetAngle: number,
    private readonly transition: SwitchTransition = 'cut',
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      const newSwitchPoint: SwitchPoint = {
        time: this.time,
        targetAngle: this.targetAngle,
        transition: this.transition,
      };
      const updatedClip: MulticamClip = { ...clip, switchPoints: addSwitchPoint(clip.switchPoints, newSwitchPoint) };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 删除切换点命令
 */
export class DeleteSwitchPointCommand implements Command {
  readonly description = 'Delete switch point';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchPointIndex: number,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      const updatedClip: MulticamClip = {
        ...clip,
        switchPoints: deleteSwitchPoint(clip.switchPoints, this.switchPointIndex),
      };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 更新切换点命令
 */
export class UpdateSwitchPointCommand implements Command {
  readonly description = 'Update switch point';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchPointIndex: number,
    private readonly updates: Partial<SwitchPoint>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      const updatedClip: MulticamClip = {
        ...clip,
        switchPoints: updateSwitchPoint(clip.switchPoints, this.switchPointIndex, this.updates),
      };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 同步多机位片段命令（更新同步模式和机位偏移量）
 */
export class SyncMulticamClipCommand implements Command {
  readonly description = 'Sync multicam clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly syncMode: MulticamSyncMode,
    private readonly offsets: Map<string, number>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      const updatedAngles = clip.angles.map((angle) => {
        const newOffset = this.offsets.get(angle.id);
        return newOffset !== undefined ? { ...angle, offset: newOffset } : angle;
      });
      const updatedClip: MulticamClip = { ...clip, angles: updatedAngles, syncMode: this.syncMode };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 更新多机位角度属性命令
 */
export class UpdateMulticamAngleCommand implements Command {
  readonly description = 'Update multicam angle';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly angleIndex: number,
    private readonly updates: Partial<MulticamClipAngle>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      if (this.angleIndex < 0 || this.angleIndex >= clip.angles.length) {
        throw new Error('Angle index out of range');
      }
      const updatedAngles = clip.angles.map((angle, index) =>
        index === this.angleIndex ? { ...angle, ...this.updates } : angle,
      );
      const updatedClip: MulticamClip = { ...clip, angles: updatedAngles };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }