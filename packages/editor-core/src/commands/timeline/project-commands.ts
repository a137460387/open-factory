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

export class NewProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'New project',
  ) {
    this.description = description;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(this.nextProject);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSpeakerLabelsCommand implements Command {
  readonly description = 'Update project speaker labels';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly speakerLabels: Record<number, string>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      speakerLabels: { ...this.speakerLabels },
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateSequenceSettingsCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly sequenceId: string,
    private readonly newSettings: SequenceSettings | undefined,
  ) {
    this.description = 'Update sequence settings';
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const oldSequence = project.sequences.find((s) => s.id === this.sequenceId);
    if (!oldSequence) return;

    const oldSettings = oldSequence.settings;
    const oldFps = oldSettings?.frameRate ?? project.settings.fps;
    const newFps = this.newSettings?.frameRate ?? project.settings.fps;

    const sequences = project.sequences.map((seq) => {
      if (seq.id !== this.sequenceId) return seq;
      return { ...seq, settings: this.newSettings };
    });

    // 帧率变更时重新对齐 clip 位置
    if (oldFps !== newFps) {
      for (const seq of sequences) {
        if (seq.id !== this.sequenceId) continue;
        recalculateClipStartsForFrameRate(seq.timeline, oldFps, newFps);
      }
    }

    // 如果当前活跃序列就是被修改的序列，同步 timeline
    let timeline = project.timeline;
    if (project.activeSequenceId === this.sequenceId) {
      const activeSeq = sequences.find((s) => s.id === this.sequenceId);
      if (activeSeq) timeline = activeSeq.timeline;
    }

    this.accessor.setProject({
      ...project,
      timeline,
      sequences,
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
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

export class LoadProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'Load project',
  ) {
    this.description = description;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(this.nextProject);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSettingsCommand implements Command {
  readonly description = 'Update project settings';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly patch: Partial<ProjectSettings>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      settings: normalizeProjectSettings({ ...project.settings, ...this.patch }),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ConformMediaCommand implements Command {
  description: string;
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly replacements: ConformMediaReplacement[],
    description = 'Conform media',
  ) {
    this.description = description;
  }

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = {
      ...applyConformMedia(this.accessor.getProject(), this.replacements),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectReleaseVersionCommand implements Command {
  readonly description = 'Update project release version';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly releaseVersion: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      releaseVersion: normalizeProjectReleaseVersion(this.releaseVersion),
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectCoverCommand implements Command {
  readonly description = 'Update project cover';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly coverPath?: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const normalized =
      typeof this.coverPath === 'string' && this.coverPath.trim()
        ? this.coverPath.trim().replace(/\\/g, '/')
        : undefined;
    this.after = {
      ...this.before,
      coverPath: normalized,
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSpeakersCommand implements Command {
  readonly description = 'Update project speakers';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly speakers: ProjectSpeaker[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      speakers: normalizeProjectSpeakers(this.speakers),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectDocumentationCommand implements Command {
  readonly description = 'Update project documentation';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly documentation: ProjectDocumentation,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      documentation: normalizeProjectDocumentation(this.documentation),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ImportEDLCommand implements Command {
  readonly description = 'Import EDL';
  private before?: Project;
  private after?: Project;
  private importResult?: Cmx3600EdlImportResult;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly contents: string,
    private readonly options: Cmx3600EdlImportOptions = {},
  ) {}

  get result(): Cmx3600EdlImportResult | undefined {
    return this.importResult;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.importResult = buildCmx3600EdlImport(this.before, this.contents, this.options);
      this.after = applyCmx3600EdlImport(this.before, this.importResult);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ImportFCPXMLCommand implements Command {
  readonly description = 'Import FCPXML';
  private before?: Project;
  private after?: Project;
  private importResult?: FcpXmlImportResult;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly contents: string,
    private readonly options: FcpXmlImportOptions = {},
  ) {}

  get result(): FcpXmlImportResult | undefined {
    return this.importResult;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.importResult = buildFcpXmlImport(this.before, this.contents, this.options);
      this.after = applyFcpXmlImport(this.before, this.importResult);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
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

export class UpdateProjectBeatMarkersCommand implements Command {
  readonly description = 'Update beat markers';
  private before?: BeatMarker[];
  private after?: BeatMarker[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly markers: BeatMarker[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeBeatMarkers(project.beatMarkers, duration);
    this.after ??= normalizeBeatMarkers(this.markers, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.before,
      }),
    );
  }
}

export class UpdateProjectExportRangesCommand implements Command {
  readonly description = 'Update export ranges';
  private before?: ExportRange[];
  private after?: ExportRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ExportRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeExportRanges(project.exportRanges, duration);
    this.after ??= normalizeExportRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.before,
      }),
    );
  }
}

export class UpdateProjectProtectedRangesCommand implements Command {
  readonly description = 'Update protected ranges';
  private before?: ProtectedRange[];
  private after?: ProtectedRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ProtectedRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeProtectedRanges(project.protectedRanges, duration);
    this.after ??= normalizeProtectedRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.before,
      }),
    );
  }
}

export class UpdateProjectBeatSnapSuggestionsCommand implements Command {
  readonly description = 'Update beat snap suggestions';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly suggestions: BeatSnapSuggestion[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, beatSnapSuggestions: [...this.suggestions] }));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectMediaCollectionsCommand implements Command {
  readonly description = 'Update media collections';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly collections: MediaCollection[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, mediaCollections: [...this.collections] }));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

// ── Independent MulticamClip commands ──

/**
 * 创建独立多机位片段命令