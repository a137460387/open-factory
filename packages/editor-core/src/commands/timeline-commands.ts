import {
  createId,
  createMask,
  createCollaborationNote,
  createNestedSequenceClip,
  createProjectAnnotation,
  createReviewAnnotation,
  createSequence,
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
  type AudioFadeCurve,
  type Keyframe,
  type KeyframeEasing,
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
  type Transform
} from '../model';
import {
  type ClipGroupBatchPatch,
  createClipGroup,
  normalizeClipGroups,
  removeClipIdsFromGroups
} from '../clip-groups';
import { calculatePiPTransform, createFullFrameTransform, type PiPLayoutPosition } from '../pip-layout';
import { calculateSplitLayoutTransforms, type SplitLayoutDefinition, type SplitLayoutClipSource } from '../split-layout';
import type { SubtitleDataImportMode } from '../subtitles/data-import';
import type { SubtitleProofreadingFix } from '../subtitles/proofreading';
import { calculateSubtitleAlignmentUpdates, calculateSubtitleShiftUpdates, type SubtitleAlignmentOptions, type SubtitleAlignmentReport, type SubtitleTimingUpdate } from '../subtitles/retiming';
import { normalizeSubtitleStyleTemplateStyle } from '../subtitles/style-templates';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle, type CreditsRow, type CreditsStyle } from '../credits-roll';
import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeDataSubtitleSource } from '../subtitles/data-subtitle';
import { normalizeSpatialAudio, type ClipSpatialAudio } from '../spatial-audio';
import { filterShortSceneCuts } from '../scene-cuts';
import {
  addMediaFolderToProject,
  deleteMediaFolder,
  moveMediaAssetsToFolder,
  renameMediaFolder,
  setMediaFolderCollapsed,
  type MediaFolderInput
} from '../media-folders';
import { createKeyframe, removeKeyframeForProperty, setKeyframeForProperty } from '../keyframes';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { normalizeProjectDocumentation } from '../project/documentation';
import { applyProjectHealthAutoRepair, type ProjectHealthAutoRepairInput, type ProjectHealthRepairReport } from '../project/project-health-repair';
import { normalizeProjectReleaseVersion } from '../project/release-workflow';
import { applyProxyMigration, type ProxyMigrationUpdate } from '../proxy/proxy-management';
import {
  buildTextAnimationKeyframes,
  mergeTextAnimationKeyframes,
  normalizeTextAnimationDirection,
  normalizeTextAnimationDuration,
  normalizeTextAnimationPreset,
  type TextAnimationDirection,
  type TextAnimationPreset
} from '../text-animation';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';
import { cloneEffects, normalizeEffect, normalizeEffects, type Effect, type EffectParams, type EffectType } from '../effects';
import { applyStyleToClip, type ApplyStyleTransferOptions, type StyleSummary } from '../style-transfer';
import {
  buildBeatSyncSpeedKeyframes,
  calculateBeatAlignmentUpdates,
  calculateBeatSnapUpdates,
  normalizeBeatMarkers,
  type BeatAlignmentUpdate,
  type BeatMarker,
  type BeatSnapUpdate
} from '../beats';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../timeline-color-labels';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges } from '../timeline-protection';
import { buildCrossfadeGapFillTransition, buildRepeatedGapFillClip, findTimelineGapAtTime, type FillGapOperation } from '../timeline-gap-fill';
import { createMulticamSequenceProject, setMulticamSwitch, trimMulticamSwitch } from '../multicam';
import { normalizeMotionGraphic } from '../motion-graphics';
import { applyCmx3600EdlImport, buildCmx3600EdlImport, type Cmx3600EdlImportOptions, type Cmx3600EdlImportResult } from '../export/timeline-import';
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
  trimClip
} from '../timeline';
import { round } from '../time';
import type { Command } from './command';

export interface TimelineAccessor {
  getTimeline(): Timeline;
  setTimeline(timeline: Timeline): void;
}

export interface ProjectAccessor {
  getProject(): Project;
  setProject(project: Project): void;
}

export class NewProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'New project'
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

export class LoadProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'Load project'
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
    private readonly patch: Partial<ProjectSettings>
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      settings: normalizeProjectSettings({ ...project.settings, ...this.patch })
    });
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
    private readonly releaseVersion: string
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      releaseVersion: normalizeProjectReleaseVersion(this.releaseVersion),
      updatedAt: new Date().toISOString()
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
    private readonly coverPath?: string
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const normalized = typeof this.coverPath === 'string' && this.coverPath.trim() ? this.coverPath.trim().replace(/\\/g, '/') : undefined;
    this.after = {
      ...this.before,
      coverPath: normalized,
      updatedAt: new Date().toISOString()
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
    private readonly speakers: ProjectSpeaker[]
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      speakers: normalizeProjectSpeakers(this.speakers),
      updatedAt: new Date().toISOString()
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
    private readonly documentation: ProjectDocumentation
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      documentation: normalizeProjectDocumentation(this.documentation),
      updatedAt: new Date().toISOString()
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
    private readonly options: Cmx3600EdlImportOptions = {}
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

export class AddMediaFolderCommand implements Command {
  readonly description = 'Add media folder';
  private before?: Project;
  private after?: Project;
  private createdFolder?: MediaFolder;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: MediaFolderInput = {}
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
    private readonly name: string
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
    private readonly collapsed: boolean
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
    private readonly folderId: string
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
    private readonly folderId?: string | null
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
    })
  };
}

function findTrack(timeline: Timeline, trackId: string): Track {
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw new Error(`Track ${trackId} not found`);
  }
  return track;
}

function findClip(timeline: Timeline, clipId: string): Clip {
  const clip = timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
  if (!clip) {
    throw new Error(`Clip ${clipId} not found`);
  }
  return clip;
}

function findClipLocation(timeline: Timeline, clipId: string): { clip: Clip; trackId: string; index: number } {
  for (const track of timeline.tracks) {
    const index = track.clips.findIndex((clip) => clip.id === clipId);
    if (index !== -1) {
      return { clip: track.clips[index], trackId: track.id, index };
    }
  }
  throw new Error(`Clip ${clipId} not found`);
}

function timelineHasOverlaps(timeline: Timeline): boolean {
  return timeline.tracks.some((track) =>
    track.clips.some((clip, index) => track.clips.slice(index + 1).some((other) => clip.start < other.start + other.duration && other.start < clip.start + clip.duration))
  );
}

function getProjectActiveClipIds(project: Project): string[] {
  return project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
}

function removeClipsFromTimeline(timeline: Timeline, ids: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) })),
    transitions: (timeline.transitions ?? []).filter((transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId))
  };
}

function applyClipGroupBatchPatch(clip: Clip, patch: ClipGroupBatchPatch): Clip {
  let next = {
    ...clip,
    colorCorrection: patch.colorCorrection ? normalizeColorCorrection({ ...clip.colorCorrection, ...patch.colorCorrection }) : normalizeColorCorrection(clip.colorCorrection)
  } as Clip;
  if (typeof patch.volume === 'number' && 'volume' in next) {
    next = { ...next, volume: normalizeTrackVolume(patch.volume) } as Clip;
  }
  if (typeof patch.speed === 'number' && (next.type === 'video' || next.type === 'audio' || next.type === 'nested-sequence')) {
    const speed = getClipSpeed({ speed: patch.speed });
    const duration = getClipDisplayDuration(getClipSourceVisibleDuration(clip), speed, next.keyframes);
    next = {
      ...next,
      speed,
      duration,
      fadeInDuration: normalizeAudioFadeDuration(next.fadeInDuration, duration),
      fadeOutDuration: normalizeAudioFadeDuration(next.fadeOutDuration, duration)
    } as Clip;
  }
  return next;
}

export interface LocalTimeRange {
  start: number;
  end: number;
}

function normalizeLocalTimeRanges(ranges: LocalTimeRange[], maxDuration: number): LocalTimeRange[] {
  const duration = Math.max(0, maxDuration);
  const sorted = ranges
    .map((range) => ({
      start: round(Math.min(duration, Math.max(0, range.start))),
      end: round(Math.min(duration, Math.max(0, range.end)))
    }))
    .map((range) => ({ start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) }))
    .filter((range) => range.end - range.start > 0.000001)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: LocalTimeRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.000001) {
      previous.end = round(Math.max(previous.end, range.end));
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function buildKeptRanges(duration: number, removedRanges: LocalTimeRange[]): LocalTimeRange[] {
  const kept: LocalTimeRange[] = [];
  let cursor = 0;
  for (const range of normalizeLocalTimeRanges(removedRanges, duration)) {
    if (range.start > cursor + 0.000001) {
      kept.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < duration - 0.000001) {
    kept.push({ start: cursor, end: duration });
  }
  return kept;
}

function buildSplitRanges(duration: number, splitTimes: number[]): LocalTimeRange[] {
  const points = Array.from(new Set(splitTimes.map((time) => round(Math.min(duration, Math.max(0, time))))))
    .filter((time) => time > 0.000001 && time < duration - 0.000001)
    .sort((left, right) => left - right);
  const ranges: LocalTimeRange[] = [];
  let cursor = 0;
  for (const point of points) {
    ranges.push({ start: cursor, end: point });
    cursor = point;
  }
  ranges.push({ start: cursor, end: duration });
  return ranges.filter((range) => range.end - range.start > 0.000001);
}

function sliceClipForLocalRange<TClip extends Clip>(clip: TClip, range: LocalTimeRange, nextStart: number): TClip {
  const speed = getClipSpeed(clip);
  const pieceDuration = round(range.end - range.start);
  const sourceDuration = round(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd);
  const sourceRangeStart = calculateSpeedCurveSourceDuration(range.start, clip.keyframes, speed);
  const sourceRangeEnd = calculateSpeedCurveSourceDuration(range.end, clip.keyframes, speed);
  const pieceSourceDuration = round(Math.max(0, sourceRangeEnd - sourceRangeStart));
  const trimStart = round(clip.trimStart + sourceRangeStart);
  const trimEnd = round(Math.max(0, sourceDuration - trimStart - pieceSourceDuration));
  return {
    ...clip,
    id: createId('clip'),
    start: round(nextStart),
    duration: pieceDuration,
    trimStart,
    trimEnd,
    transform: { ...clip.transform },
    scenecuts: sliceClipSceneCuts(clip.scenecuts, range.start, pieceDuration),
    keyframes: sliceClipKeyframes(clip.keyframes, range.start, pieceDuration),
    effects: cloneEffects(clip.effects)
  } as TClip;
}

function sliceClipSceneCuts(cuts: number[] | undefined, offset: number, duration: number): number[] | undefined {
  const localCuts = (cuts ?? [])
    .filter((time) => time > offset + 0.000001 && time < offset + duration - 0.000001)
    .map((time) => round(time - offset));
  return normalizeClipSceneCuts(localCuts, duration);
}

function sliceClipKeyframes(keyframes: ClipKeyframes | undefined, offset: number, duration: number): ClipKeyframes | undefined {
  const cloned = cloneClipKeyframes(keyframes);
  if (!cloned) {
    return undefined;
  }
  const sliced: ClipKeyframes = {};
  for (const property of Object.keys(cloned) as KeyframeProperty[]) {
    const frames = cloned[property]?.flatMap((frame) => {
      if (frame.time < offset - 0.000001 || frame.time > offset + duration + 0.000001) {
        return [];
      }
      return [{ ...frame, time: round(Math.max(0, frame.time - offset)) }];
    });
    if (frames?.length) {
      sliced[property] = frames;
    }
  }
  return normalizeClipKeyframes(sliced, duration);
}

function replaceClipWithSlices(timeline: Timeline, clipId: string, ranges: LocalTimeRange[], rippleRemovedGaps: boolean): Timeline {
  const { clip, trackId, index } = findClipLocation(timeline, clipId);
  const track = findTrack(timeline, trackId);
  let outputCursor = clip.start;
  const pieces = ranges.map((range) => {
    const start = rippleRemovedGaps ? outputCursor : clip.start + range.start;
    const piece = sliceClipForLocalRange(clip, range, start);
    outputCursor = round(outputCursor + piece.duration);
    return piece;
  });
  const clips = [...track.clips];
  clips.splice(index, 1, ...pieces);
  return {
    ...timeline,
    tracks: timeline.tracks.map((item) => (item.id === trackId ? { ...item, clips } : item)),
    transitions: (timeline.transitions ?? []).filter((transition) => transition.fromClipId !== clip.id && transition.toClipId !== clip.id)
  };
}

function rippleDeleteTrackClips(track: Track, selectedIds: Set<string>, protectedRanges: ProtectedRange[] = []): Track {
  if (protectedRanges.length > 0) {
    return applyProtectedRippleDeleteToTrack(track, selectedIds, protectedRanges);
  }
  const removedIntervals = mergeTimelineIntervals(
    track.clips
      .filter((clip) => selectedIds.has(clip.id))
      .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration) }))
  );
  if (removedIntervals.length === 0) {
    return track;
  }
  return {
    ...track,
    clips: track.clips
      .filter((clip) => !selectedIds.has(clip.id))
      .map((clip) => {
        const shift = removedIntervals.reduce((total, interval) => (clip.start >= interval.end - 0.000001 ? total + interval.end - interval.start : total), 0);
        return shift > 0 ? moveClip(clip, round(clip.start - shift)) : clip;
      })
  };
}

function mergeTimelineIntervals(intervals: LocalTimeRange[]): LocalTimeRange[] {
  const sorted = intervals
    .map((interval) => ({ start: round(Math.max(0, Math.min(interval.start, interval.end))), end: round(Math.max(0, Math.max(interval.start, interval.end))) }))
    .filter((interval) => interval.end - interval.start > 0.000001)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: LocalTimeRange[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + 0.000001) {
      previous.end = round(Math.max(previous.end, interval.end));
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function findTrackGapAtTime(track: Track, time: number): LocalTimeRange | undefined {
  const sortedClips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const target = round(Math.max(0, time));
  let cursor = 0;
  for (const clip of sortedClips) {
    if (clip.start - cursor > 0.000001 && target >= cursor - 0.000001 && target <= clip.start + 0.000001) {
      return { start: round(cursor), end: round(clip.start) };
    }
    cursor = Math.max(cursor, clip.start + clip.duration);
  }
  return undefined;
}

function closeTrackGap(track: Track, gapStart: number, gapEnd: number): Track {
  const gapDuration = round(gapEnd - gapStart);
  return {
    ...track,
    clips: track.clips.map((clip) => (clip.start >= gapEnd - 0.000001 ? moveClip(clip, round(clip.start - gapDuration)) : clip))
  };
}

function buildRollingTrimClips(left: Clip, right: Clip, requestedDelta: number, minDuration: number): { left: Clip; right: Clip } {
  const minClipDuration = Math.max(0.000001, minDuration);
  const leftSourceDuration = getClipTotalSourceDuration(left);
  const rightSourceDuration = getClipTotalSourceDuration(right);
  const leftMaxDuration = getClipDisplayDuration(Math.max(0, leftSourceDuration - left.trimStart), getClipSpeed(left), left.keyframes);
  const rightMaxDuration = getClipDisplayDuration(Math.max(0, rightSourceDuration - right.trimEnd), getClipSpeed(right), right.keyframes);
  const maxPositive = Math.max(0, Math.min(leftMaxDuration - left.duration, right.duration - minClipDuration));
  const maxNegative = -Math.max(0, Math.min(left.duration - minClipDuration, rightMaxDuration - right.duration));
  const delta = round(Math.min(maxPositive, Math.max(maxNegative, requestedDelta)));
  if (Math.abs(delta) <= 0.000001) {
    throw new Error('Rolling trim has no available media at this boundary');
  }

  const leftDuration = round(left.duration + delta);
  const rightDuration = round(right.duration - delta);
  const leftVisibleSourceDuration = calculateSpeedCurveSourceDuration(leftDuration, left.keyframes, getClipSpeed(left));
  const rightVisibleSourceDuration = calculateSpeedCurveSourceDuration(rightDuration, right.keyframes, getClipSpeed(right));
  const leftTrimEnd = round(Math.max(0, leftSourceDuration - left.trimStart - leftVisibleSourceDuration));
  const rightTrimStart = round(Math.max(0, rightSourceDuration - right.trimEnd - rightVisibleSourceDuration));
  const leftTrimmed = trimClip(left, left.trimStart, leftTrimEnd);
  const rightTrimmed = {
    ...trimClip(right, rightTrimStart, right.trimEnd),
    start: round(left.start + leftTrimmed.duration)
  } as Clip;
  return { left: leftTrimmed, right: rightTrimmed };
}

export interface SlideClipEditResult {
  timeline: Timeline;
  leftClip: Clip;
  clip: Clip;
  rightClip: Clip;
  delta: number;
}

export function buildSlipClip<TClip extends Clip>(clip: TClip, requestedDelta: number): TClip {
  const speed = getClipSpeed(clip);
  const requestedSourceDelta = requestedDelta >= 0
    ? calculateSpeedCurveSourceDuration(requestedDelta, clip.keyframes, speed)
    : -calculateSpeedCurveSourceDuration(Math.abs(requestedDelta), clip.keyframes, speed);
  const sourceDelta = round(Math.min(clip.trimEnd, Math.max(-clip.trimStart, requestedSourceDelta)));
  const slipped = trimClip(clip, round(clip.trimStart + sourceDelta), round(clip.trimEnd - sourceDelta));
  return { ...slipped, start: clip.start, duration: clip.duration } as TClip;
}

export function buildSlideClipEdit(timeline: Timeline, clipId: string, requestedDelta: number, minDuration = 1 / 30): SlideClipEditResult {
  const location = findClipLocation(timeline, clipId);
  const track = findTrack(timeline, location.trackId);
  const sorted = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const index = sorted.findIndex((clip) => clip.id === clipId);
  const left = sorted[index - 1];
  const clip = sorted[index];
  const right = sorted[index + 1];
  if (!left || !clip || !right || !areClipsAdjacent(left, clip) || !areClipsAdjacent(clip, right)) {
    throw new Error('Slide edit requires adjacent clips on both sides');
  }

  const minClipDuration = Math.max(0.000001, minDuration);
  const leftSourceDuration = getClipTotalSourceDuration(left);
  const rightSourceDuration = getClipTotalSourceDuration(right);
  const leftMaxDuration = getClipDisplayDuration(Math.max(0, leftSourceDuration - left.trimStart), getClipSpeed(left), left.keyframes);
  const rightMaxDuration = getClipDisplayDuration(Math.max(0, rightSourceDuration - right.trimEnd), getClipSpeed(right), right.keyframes);
  const maxPositive = Math.max(0, Math.min(leftMaxDuration - left.duration, right.duration - minClipDuration));
  const maxNegative = -Math.max(0, Math.min(left.duration - minClipDuration, rightMaxDuration - right.duration));
  const delta = round(Math.min(maxPositive, Math.max(maxNegative, requestedDelta)));
  if (Math.abs(delta) <= 0.000001) {
    throw new Error('Slide edit has no available media at this position');
  }

  const nextLeftDuration = round(left.duration + delta);
  const nextRightDuration = round(right.duration - delta);
  const leftVisibleSourceDuration = calculateSpeedCurveSourceDuration(nextLeftDuration, left.keyframes, getClipSpeed(left));
  const rightVisibleSourceDuration = calculateSpeedCurveSourceDuration(nextRightDuration, right.keyframes, getClipSpeed(right));
  const nextLeft = trimClip(left, left.trimStart, round(Math.max(0, leftSourceDuration - left.trimStart - leftVisibleSourceDuration)));
  const nextClip = moveClip(clip, round(clip.start + delta));
  const nextRight = {
    ...trimClip(right, round(Math.max(0, rightSourceDuration - right.trimEnd - rightVisibleSourceDuration)), right.trimEnd),
    start: round(right.start + delta)
  } as Clip;
  const byId = new Map([
    [nextLeft.id, nextLeft],
    [nextClip.id, nextClip],
    [nextRight.id, nextRight]
  ]);
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((item) => (item.id === track.id ? { ...item, clips: item.clips.map((itemClip) => byId.get(itemClip.id) ?? itemClip) } : item)),
    transitions: timeline.transitions ?? []
  };
  if (timelineHasOverlaps(nextTimeline)) {
    throw new Error('Clip overlaps another clip on this track');
  }
  return { timeline: nextTimeline, leftClip: nextLeft, clip: nextClip, rightClip: nextRight, delta };
}

function getClipTotalSourceDuration(clip: Clip): number {
  return round(Math.max(0, clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd));
}

export class AddTrackCommand implements Command {
  readonly description: string;
  private index = -1;

  constructor(private readonly accessor: TimelineAccessor, private readonly track: Track) {
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

  constructor(private readonly accessor: TimelineAccessor, private readonly tracks: Track[]) {}

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

export type TrackPatch = Partial<Pick<Track, 'name' | 'language' | 'subtitleType' | 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>;

function applyTrackPatch(track: Track, patch?: TrackPatch): Track {
  if (!patch) {
    return track;
  }
  return createTrack({
    ...track,
    ...patch,
    volume: patch.volume === undefined ? track.volume : normalizeTrackVolume(patch.volume),
    pan: patch.pan === undefined ? track.pan : normalizeTrackPan(patch.pan),
    eq: patch.eq === undefined ? track.eq : normalizeTrackEQ(patch.eq),
    compressor: patch.compressor === undefined ? track.compressor : normalizeTrackCompressor(patch.compressor)
  });
}

export interface BatchUpdateTrackCommandOptions {
  patches?: Record<string, TrackPatch>;
  order?: string[];
  deleteEmptyTrackIds?: string[];
}

export class UpdateTrackCommand implements Command {
  readonly description = 'Update track';
  private before?: Track;
  private after?: Track;

  constructor(private readonly accessor: TimelineAccessor, private readonly trackId: string, private readonly patch: TrackPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findTrack(timeline, this.trackId);
    this.after = applyTrackPatch(this.before, this.patch);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.after! : track))
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.before! : track))
    });
  }
}

export class BatchUpdateTrackCommand implements Command {
  readonly description = 'Batch update tracks';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly options: BatchUpdateTrackCommandOptions) {}

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

  constructor(private readonly accessor: ProjectAccessor, private readonly patch: ProjectAudioPatch) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...this.before,
      ...this.patch,
      masterVolume: this.patch.masterVolume === undefined ? this.before.masterVolume : normalizeMasterVolume(this.patch.masterVolume),
      updatedAt: new Date().toISOString()
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

export class RemoveMediaCommand implements Command {
  readonly description = 'Remove media';
  private before?: Project;
  private after?: Project;

  constructor(private readonly accessor: ProjectAccessor, private readonly assetIds: string | string[]) {}

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
    private readonly mergedAssetIds: string[]
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

export class MigrateProxiesCommand implements Command {
  readonly description = 'Migrate proxy paths';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly updates: ProxyMigrationUpdate[]
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.after = {
        ...this.before,
        media: applyProxyMigration(this.before.media, this.updates),
        updatedAt: new Date().toISOString()
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
    private readonly input: ProjectHealthAutoRepairInput
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

function normalizeAssetIdSet(assetIds: string | string[]): Set<string> {
  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
  const normalized = new Set(ids.map((assetId) => assetId.trim()).filter(Boolean));
  if (normalized.size === 0) {
    throw new Error('No media assets selected');
  }
  return normalized;
}

function assertMediaAssetsExist(project: Project, assetIds: Set<string>): void {
  const available = new Set(project.media.map((asset) => asset.id));
  const missing = Array.from(assetIds).filter((assetId) => !available.has(assetId));
  if (missing.length > 0) {
    throw new Error(`Media asset not found: ${missing.join(', ')}`);
  }
}

function collectProjectMediaIds(project: Project): Set<string> {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const ids = new Set<string>();
  for (const sequence of getProjectSequences(synced)) {
    for (const clip of sequence.timeline.tracks.flatMap((track) => track.clips)) {
      if ('mediaId' in clip) {
        ids.add(clip.mediaId);
      }
    }
  }
  return ids;
}

function removeMediaAssets(project: Project, removeIds: Set<string>): Project {
  const mediaMetadata = filterMediaMetadata(project.mediaMetadata, removeIds);
  return touchProject({
    ...project,
    media: project.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata
  });
}

function mergeMediaReferences(project: Project, keepAssetId: string, removeIds: Set<string>): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const sequences = getProjectSequences(synced).map((sequence) => ({
    ...sequence,
    timeline: replaceTimelineMediaReferences(sequence.timeline, keepAssetId, removeIds)
  }));
  const activeTimeline = sequences.find((sequence) => sequence.id === synced.activeSequenceId)?.timeline ?? synced.timeline;
  return touchProject({
    ...synced,
    media: synced.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata: filterMediaMetadata(synced.mediaMetadata, removeIds),
    timeline: activeTimeline,
    sequences
  });
}

function replaceTimelineMediaReferences(timeline: Timeline, keepAssetId: string, removeIds: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (!('mediaId' in clip) || !removeIds.has(clip.mediaId)) {
          return clip;
        }
        return { ...clip, mediaId: keepAssetId } as Clip;
      })
    }))
  };
}

function filterMediaMetadata(metadata: Record<string, MediaMetadata>, removeIds: Set<string>): Record<string, MediaMetadata> {
  const next = { ...metadata };
  for (const assetId of removeIds) {
    delete next[assetId];
  }
  return next;
}

function touchProject(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

export class AddProjectAnnotationCommand implements Command {
  readonly description = 'Add project annotation';
  private annotation?: ProjectAnnotation;

  constructor(private readonly accessor: ProjectAccessor, private readonly input: Omit<ProjectAnnotation, 'id'> & Partial<Pick<ProjectAnnotation, 'id'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.annotation ??= createProjectAnnotation(this.input, getTimelineDuration(project.timeline));
    this.annotation = normalizeProjectAnnotation(this.annotation, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: sortAnnotations([...(project.annotations ?? []), this.annotation])
      })
    );
  }

  undo(): void {
    if (!this.annotation) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotation?.id)
      })
    );
  }
}

export class AddReviewAnnotationCommand implements Command {
  readonly description = 'Add review annotation';
  private annotation?: ReviewAnnotation;

  constructor(private readonly accessor: ProjectAccessor, private readonly input: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.annotation ??= createReviewAnnotation(this.input, getTimelineDuration(project.timeline));
    this.annotation = normalizeReviewAnnotation(this.annotation, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: sortReviewAnnotations([...(project.reviewAnnotations ?? []), this.annotation])
      })
    );
  }

  undo(): void {
    if (!this.annotation) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: (project.reviewAnnotations ?? []).filter((annotation) => annotation.id !== this.annotation?.id)
      })
    );
  }
}

export class AddCollaborationNoteCommand implements Command {
  readonly description = 'Add collaboration note';
  private note?: CollaborationNote;

  constructor(private readonly accessor: ProjectAccessor, private readonly input: Omit<CollaborationNote, 'id' | 'createdAt'> & Partial<Pick<CollaborationNote, 'id' | 'createdAt'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.note ??= createCollaborationNote(this.input, getTimelineDuration(project.timeline));
    this.note = normalizeCollaborationNote(this.note, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: sortCollaborationNotes([...(project.collaborationNotes ?? []), this.note])
      })
    );
  }

  undo(): void {
    if (!this.note) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.note?.id)
      })
    );
  }
}

export class AddTimelineNoteCommand implements Command {
  readonly description = 'Add timeline note';
  private note?: TimelineNote;

  constructor(private readonly accessor: ProjectAccessor, private readonly input: Omit<TimelineNote, 'id' | 'createdAt'> & Partial<Pick<TimelineNote, 'id' | 'createdAt'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.note ??= createTimelineNote(this.input, getTimelineDuration(project.timeline));
    const normalized = normalizeTimelineNote(this.note, getTimelineDuration(project.timeline));
    if (!normalized) {
      throw new Error('Timeline note duration must be greater than zero');
    }
    this.note = normalized;
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: sortTimelineNotes([...(project.timelineNotes ?? []), this.note])
      })
    );
  }

  undo(): void {
    if (!this.note) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.note?.id)
      })
    );
  }
}

export interface AddProjectBookmarkInput {
  id?: string;
  time: number;
  note?: string;
}

export class AddProjectBookmarkCommand implements Command {
  readonly description = 'Add timeline bookmark';
  private bookmark?: TimelineBookmark;

  constructor(private readonly accessor: ProjectAccessor, private readonly input: AddProjectBookmarkInput) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.bookmark ??= createTimelineBookmark(this.input, getTimelineDuration(project.timeline));
    this.bookmark = normalizeTimelineBookmark(this.bookmark, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks([...(project.bookmarks ?? []), this.bookmark])
      })
    );
  }

  undo(): void {
    if (!this.bookmark) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmark?.id)
      })
    );
  }
}

export type TimelineBookmarkPatch = Partial<Pick<TimelineBookmark, 'time' | 'note'>>;

export class UpdateProjectBookmarkCommand implements Command {
  readonly description = 'Update timeline bookmark';
  private before?: TimelineBookmark;
  private after?: TimelineBookmark;

  constructor(private readonly accessor: ProjectAccessor, private readonly bookmarkId: string, private readonly patch: TimelineBookmarkPatch) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= (project.bookmarks ?? []).find((bookmark) => bookmark.id === this.bookmarkId);
    if (!this.before) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.after = createTimelineBookmark({ ...this.before, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks((project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.after! : bookmark)))
      })
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
        bookmarks: sortBookmarks((project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.before! : bookmark)))
      })
    );
  }
}

export class RemoveProjectBookmarkCommand implements Command {
  readonly description = 'Remove timeline bookmark';
  private removed?: TimelineBookmark;
  private index = -1;

  constructor(private readonly accessor: ProjectAccessor, private readonly bookmarkId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.bookmarks ?? []).findIndex((bookmark) => bookmark.id === this.bookmarkId);
    if (this.index === -1) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.removed ??= (project.bookmarks ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmarkId)
      })
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const bookmarks = [...(project.bookmarks ?? [])];
    bookmarks.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, bookmarks: sortBookmarks(bookmarks) }));
  }
}

export class UpdateProjectBookmarksCommand implements Command {
  readonly description = 'Update timeline bookmarks';
  private before?: TimelineBookmark[];
  private after?: TimelineBookmark[];

  constructor(private readonly accessor: ProjectAccessor, private readonly bookmarks: TimelineBookmark[]) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeTimelineBookmarks(project.bookmarks, duration);
    this.after ??= normalizeTimelineBookmarks(this.bookmarks, duration);
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.after }));
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.before }));
  }
}

export class UpdateProjectBeatMarkersCommand implements Command {
  readonly description = 'Update beat markers';
  private before?: BeatMarker[];
  private after?: BeatMarker[];

  constructor(private readonly accessor: ProjectAccessor, private readonly markers: BeatMarker[]) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeBeatMarkers(project.beatMarkers, duration);
    this.after ??= normalizeBeatMarkers(this.markers, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.after
      })
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
        beatMarkers: this.before
      })
    );
  }
}

export class UpdateProjectExportRangesCommand implements Command {
  readonly description = 'Update export ranges';
  private before?: ExportRange[];
  private after?: ExportRange[];

  constructor(private readonly accessor: ProjectAccessor, private readonly ranges: ExportRange[]) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeExportRanges(project.exportRanges, duration);
    this.after ??= normalizeExportRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.after
      })
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
        exportRanges: this.before
      })
    );
  }
}

export class UpdateProjectProtectedRangesCommand implements Command {
  readonly description = 'Update protected ranges';
  private before?: ProtectedRange[];
  private after?: ProtectedRange[];

  constructor(private readonly accessor: ProjectAccessor, private readonly ranges: ProtectedRange[]) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeProtectedRanges(project.protectedRanges, duration);
    this.after ??= normalizeProtectedRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.after
      })
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
        protectedRanges: this.before
      })
    );
  }
}

export interface CreateClipGroupOptions {
  id?: string;
  name?: string;
  color?: ClipGroupColor;
}

export class CreateClipGroupCommand implements Command {
  readonly description = 'Create clip group';
  private before?: Project;
  group?: ClipGroup;

  constructor(private readonly accessor: ProjectAccessor, private readonly clipIds: string[], private readonly options: CreateClipGroupOptions = {}) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const uniqueClipIds = Array.from(new Set(this.clipIds)).filter((clipId) => activeClipIds.includes(clipId));
    this.group ??= createClipGroup({ ...this.options, clipIds: uniqueClipIds }, activeClipIds);
    const withoutGroupedClips = removeClipIdsFromGroups(project.clipGroups, this.group.clipIds);
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups([...withoutGroupedClips, this.group], activeClipIds)
      })
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateClipGroupCommand implements Command {
  readonly description = 'Update clip group';
  private before?: Project;

  constructor(private readonly accessor: ProjectAccessor, private readonly groupId: string, private readonly patch: Partial<Pick<ClipGroup, 'name' | 'color'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups(groups.map((group) => (group.id === this.groupId ? { ...group, ...this.patch } : group)), activeClipIds)
      })
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UngroupCommand implements Command {
  readonly description = 'Ungroup clips';
  private before?: Project;

  constructor(private readonly accessor: ProjectAccessor, private readonly groupId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: groups.filter((group) => group.id !== this.groupId)
      })
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteGroupCommand implements Command {
  readonly description = 'Delete clip group';
  private before?: Project;

  constructor(private readonly accessor: ProjectAccessor, private readonly groupId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const timeline = removeClipsFromTimeline(project.timeline, ids);
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, timeline),
        clipGroups: groups.filter((item) => item.id !== group.id)
      })
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class BatchUpdateClipGroupClipsCommand implements Command {
  readonly description = 'Batch update clip group clips';
  private before?: Project;

  constructor(private readonly accessor: ProjectAccessor, private readonly groupId: string, private readonly patch: ClipGroupBatchPatch) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const nextTimeline: Timeline = {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (ids.has(clip.id) ? applyClipGroupBatchPatch(clip, this.patch) : clip))
      }))
    };
    if (timelineHasOverlaps(nextTimeline)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, nextTimeline),
        clipGroups: groups
      })
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface ApplyStyleCommandOptions extends ApplyStyleTransferOptions {
  clipIds?: string[];
}

export class ApplyStyleCommand implements Command {
  readonly description = 'Apply style transfer';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly summary: StyleSummary,
    private readonly options: ApplyStyleCommandOptions
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
        })
      }))
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

export class UpdateProjectAnnotationCommand implements Command {
  readonly description = 'Update project annotation';
  private before?: ProjectAnnotation;
  private after?: ProjectAnnotation;

  constructor(private readonly accessor: ProjectAccessor, private readonly annotationId: string, private readonly patch: Partial<Omit<ProjectAnnotation, 'id'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    const annotation = (project.annotations ?? []).find((item) => item.id === this.annotationId);
    if (!annotation) {
      throw new Error(`Project annotation ${this.annotationId} not found`);
    }
    this.before ??= annotation;
    this.after = normalizeProjectAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: sortAnnotations((project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.after! : item)))
      })
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
        annotations: sortAnnotations((project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.before! : item)))
      })
    );
  }
}

export class RemoveProjectAnnotationCommand implements Command {
  readonly description = 'Remove project annotation';
  private removed?: ProjectAnnotation;
  private index = -1;

  constructor(private readonly accessor: ProjectAccessor, private readonly annotationId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.annotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
    if (this.index === -1) {
      throw new Error(`Project annotation ${this.annotationId} not found`);
    }
    this.removed ??= (project.annotations ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotationId)
      })
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const annotations = [...(project.annotations ?? [])];
    annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, annotations: sortAnnotations(annotations) }));
  }
}

export class UpdateReviewAnnotationCommand implements Command {
  readonly description = 'Update review annotation';
  private before?: ReviewAnnotation;
  private after?: ReviewAnnotation;

  constructor(private readonly accessor: ProjectAccessor, private readonly annotationId: string, private readonly patch: Partial<Omit<ReviewAnnotation, 'id'>>) {}

  execute(): void {
    const project = this.accessor.getProject();
    const annotation = (project.reviewAnnotations ?? []).find((item) => item.id === this.annotationId);
    if (!annotation) {
      throw new Error(`Review annotation ${this.annotationId} not found`);
    }
    this.before ??= annotation;
    this.after = normalizeReviewAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: sortReviewAnnotations((project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.after! : item)))
      })
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
        reviewAnnotations: sortReviewAnnotations((project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.before! : item)))
      })
    );
  }
}

export class RemoveReviewAnnotationCommand implements Command {
  readonly description = 'Remove review annotation';
  private removed?: ReviewAnnotation;
  private index = -1;

  constructor(private readonly accessor: ProjectAccessor, private readonly annotationId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.reviewAnnotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
    if (this.index === -1) {
      throw new Error(`Review annotation ${this.annotationId} not found`);
    }
    this.removed ??= (project.reviewAnnotations ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: (project.reviewAnnotations ?? []).filter((annotation) => annotation.id !== this.annotationId)
      })
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const annotations = [...(project.reviewAnnotations ?? [])];
    annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, reviewAnnotations: sortReviewAnnotations(annotations) }));
  }
}

export type CollaborationNotePatch = Partial<Omit<CollaborationNote, 'id' | 'createdAt'> & Pick<CollaborationNote, 'createdAt'>>;

export class UpdateCollaborationNoteCommand implements Command {
  readonly description = 'Update collaboration note';
  private before?: CollaborationNote;
  private after?: CollaborationNote;

  constructor(private readonly accessor: ProjectAccessor, private readonly noteId: string, private readonly patch: CollaborationNotePatch) {}

  execute(): void {
    const project = this.accessor.getProject();
    const note = (project.collaborationNotes ?? []).find((item) => item.id === this.noteId);
    if (!note) {
      throw new Error(`Collaboration note ${this.noteId} not found`);
    }
    this.before ??= note;
    this.after = normalizeCollaborationNote({ ...note, ...this.patch, updatedAt: this.patch.updatedAt ?? new Date().toISOString() }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: sortCollaborationNotes((project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.after! : item)))
      })
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
        collaborationNotes: sortCollaborationNotes((project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.before! : item)))
      })
    );
  }
}

export class RemoveCollaborationNoteCommand implements Command {
  readonly description = 'Remove collaboration note';
  private removed?: CollaborationNote;
  private index = -1;

  constructor(private readonly accessor: ProjectAccessor, private readonly noteId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.collaborationNotes ?? []).findIndex((note) => note.id === this.noteId);
    if (this.index === -1) {
      throw new Error(`Collaboration note ${this.noteId} not found`);
    }
    this.removed ??= (project.collaborationNotes ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.noteId)
      })
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const notes = [...(project.collaborationNotes ?? [])];
    notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, collaborationNotes: sortCollaborationNotes(notes) }));
  }
}

export type TimelineNotePatch = Partial<Omit<TimelineNote, 'id' | 'createdAt'> & Pick<TimelineNote, 'createdAt'>>;

export class UpdateTimelineNoteCommand implements Command {
  readonly description = 'Update timeline note';
  private before?: TimelineNote;
  private after?: TimelineNote;

  constructor(private readonly accessor: ProjectAccessor, private readonly noteId: string, private readonly patch: TimelineNotePatch) {}

  execute(): void {
    const project = this.accessor.getProject();
    const note = (project.timelineNotes ?? []).find((item) => item.id === this.noteId);
    if (!note) {
      throw new Error(`Timeline note ${this.noteId} not found`);
    }
    this.before ??= note;
    const normalized = normalizeTimelineNote({ ...note, ...this.patch }, getTimelineDuration(project.timeline));
    if (!normalized) {
      throw new Error('Timeline note duration must be greater than zero');
    }
    this.after = normalized;
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: sortTimelineNotes((project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.after! : item)))
      })
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
        timelineNotes: sortTimelineNotes((project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.before! : item)))
      })
    );
  }
}

export class RemoveTimelineNoteCommand implements Command {
  readonly description = 'Remove timeline note';
  private removed?: TimelineNote;
  private index = -1;

  constructor(private readonly accessor: ProjectAccessor, private readonly noteId: string) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.timelineNotes ?? []).findIndex((note) => note.id === this.noteId);
    if (this.index === -1) {
      throw new Error(`Timeline note ${this.noteId} not found`);
    }
    this.removed ??= (project.timelineNotes ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.noteId)
      })
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const notes = [...(project.timelineNotes ?? [])];
    notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, timelineNotes: sortTimelineNotes(notes) }));
  }
}

export interface TransitionInput {
  id?: string;
  type: TransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export class AddTransitionCommand implements Command {
  readonly description = 'Add transition';
  private transition?: Transition;

  constructor(private readonly accessor: TimelineAccessor, private readonly input: TransitionInput) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const pair = findAdjacentTransitionClips(timeline, this.input.fromClipId, this.input.toClipId);
    if (!pair) {
      throw new Error('Transition clips must be adjacent on the same track');
    }
    if ((timeline.transitions ?? []).some((transition) => transition.fromClipId === this.input.fromClipId && transition.toClipId === this.input.toClipId)) {
      throw new Error('Transition already exists for these clips');
    }
    const duration = clampTransitionDuration(this.input.duration, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      throw new Error('Transition duration must be greater than zero');
    }
    this.transition ??= createTransition({ ...this.input, duration });
    this.transition = { ...this.transition, duration };
    this.accessor.setTimeline({
      ...timeline,
      transitions: [...(timeline.transitions ?? []), this.transition]
    });
  }

  undo(): void {
    if (!this.transition) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transition?.id)
    });
  }
}

export class RemoveTransitionCommand implements Command {
  readonly description = 'Remove transition';
  private removed?: Transition;
  private index = -1;

  constructor(private readonly accessor: TimelineAccessor, private readonly transitionId: string) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.transitions ?? []).findIndex((transition) => transition.id === this.transitionId);
    if (this.index === -1) {
      throw new Error(`Transition ${this.transitionId} not found`);
    }
    this.removed ??= (timeline.transitions ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transitionId)
    });
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    const transitions = [...(timeline.transitions ?? [])];
    transitions.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setTimeline({ ...timeline, transitions });
  }
}

export interface AddTimelineMarkerInput {
  id?: string;
  time: number;
  label?: string;
  color?: string;
}

export class AddTimelineMarkerCommand implements Command {
  readonly description = 'Add timeline marker';
  private marker?: TimelineMarker;

  constructor(private readonly accessor: TimelineAccessor, private readonly input: AddTimelineMarkerInput) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.marker ??= createTimelineMarker(this.input, getTimelineDuration(timeline));
    this.marker = normalizeTimelineMarker(this.marker, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers([...(timeline.markers ?? []), this.marker])
    });
  }

  undo(): void {
    if (!this.marker) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.marker?.id)
    });
  }
}

export type TimelineMarkerPatch = Partial<Pick<TimelineMarker, 'time' | 'label' | 'color'>>;

export class UpdateTimelineMarkerCommand implements Command {
  readonly description = 'Update timeline marker';
  private before?: TimelineMarker;
  private after?: TimelineMarker;

  constructor(private readonly accessor: TimelineAccessor, private readonly markerId: string, private readonly patch: TimelineMarkerPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= (timeline.markers ?? []).find((marker) => marker.id === this.markerId);
    if (!this.before) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.after = createTimelineMarker({ ...this.before, ...this.patch }, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers((timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.after! : marker)))
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers((timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.before! : marker)))
    });
  }
}

export class RemoveTimelineMarkerCommand implements Command {
  readonly description = 'Remove timeline marker';
  private removed?: TimelineMarker;
  private index = -1;

  constructor(private readonly accessor: TimelineAccessor, private readonly markerId: string) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.markers ?? []).findIndex((marker) => marker.id === this.markerId);
    if (this.index === -1) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.removed ??= (timeline.markers ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.markerId)
    });
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    const markers = [...(timeline.markers ?? [])];
    markers.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setTimeline({ ...timeline, markers: sortMarkers(markers) });
  }
}

export class AddClipCommand implements Command {
  readonly description: string;

  constructor(private readonly accessor: TimelineAccessor, private readonly clip: Clip) {
    this.description = `Add clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

export class AddAdjustmentLayerCommand implements Command {
  readonly description: string;
  private insertedTrack = false;

  constructor(private readonly accessor: TimelineAccessor, private readonly track: Track, private readonly clip: Extract<Clip, { type: 'adjustment' }>) {
    this.description = `Add adjustment layer ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const existingTrack = timeline.tracks.find((item) => item.id === this.track.id);
    if (existingTrack) {
      if (detectOverlap(existingTrack, this.clip)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.accessor.setTimeline(insertClip(timeline, this.clip));
      return;
    }

    this.insertedTrack = true;
    this.accessor.setTimeline({
      ...timeline,
      tracks: [
        ...timeline.tracks,
        {
          ...this.track,
          clips: [this.clip]
        }
      ]
    });
  }

  undo(): void {
    const timeline = removeClip(this.accessor.getTimeline(), this.clip.id).timeline;
    if (!this.insertedTrack) {
      this.accessor.setTimeline(timeline);
      return;
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id)
    });
  }
}

export class AddMotionGraphicCommand implements Command {
  readonly description: string;
  private insertedTrack = false;

  constructor(private readonly accessor: TimelineAccessor, private readonly track: Track, private readonly clip: Extract<Clip, { type: 'motion-graphic' }>) {
    this.description = `Add motion graphic ${clip.name}`;
  }

  execute(): void {
    if (this.track.type !== 'video') {
      throw new Error('Motion graphics must be added to a video track');
    }
    const timeline = this.accessor.getTimeline();
    const existingTrack = timeline.tracks.find((item) => item.id === this.track.id);
    if (existingTrack) {
      if (existingTrack.type !== 'video') {
        throw new Error('Motion graphics must be added to a video track');
      }
      if (detectOverlap(existingTrack, this.clip)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.accessor.setTimeline(insertClip(timeline, this.clip));
      return;
    }

    this.insertedTrack = true;
    this.accessor.setTimeline({
      ...timeline,
      tracks: [
        ...timeline.tracks,
        {
          ...this.track,
          clips: [this.clip]
        }
      ]
    });
  }

  undo(): void {
    const timeline = removeClip(this.accessor.getTimeline(), this.clip.id).timeline;
    if (!this.insertedTrack) {
      this.accessor.setTimeline(timeline);
      return;
    }
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id)
    });
  }
}

export class AddSubtitleClipCommand implements Command {
  readonly description: string;

  constructor(private readonly accessor: TimelineAccessor, private readonly clip: Extract<Clip, { type: 'subtitle' }>) {
    this.description = `Add subtitle clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (track.type !== 'subtitle') {
      throw new Error('Subtitle clips can only be added to subtitle tracks');
    }
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

export class AddCreditsClipCommand implements Command {
  readonly description: string;

  constructor(private readonly accessor: TimelineAccessor, private readonly clip: Extract<Clip, { type: 'credits' }>) {
    this.description = `Add credits clip ${clip.name}`;
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const track = findTrack(timeline, this.clip.trackId);
    if (track.type !== 'text') {
      throw new Error('Credits clips can only be added to text tracks');
    }
    if (detectOverlap(track, this.clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(insertClip(timeline, this.clip));
  }

  undo(): void {
    this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
  }
}

function resolveSubtitleImportTarget(timeline: Timeline, targetTrackId: string | undefined): Track | undefined {
  const track = targetTrackId ? timeline.tracks.find((item) => item.id === targetTrackId) : timeline.tracks.find((item) => item.type === 'subtitle');
  if (track && track.type !== 'subtitle') {
    throw new Error('Subtitle import target must be a subtitle track');
  }
  return track;
}

export interface BatchImportSubtitleCommandOptions {
  mode: SubtitleDataImportMode;
  targetTrackId?: string;
}

export class BatchImportSubtitleCommand implements Command {
  readonly description = 'Import subtitle clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly track: Track, private readonly options: BatchImportSubtitleCommandOptions) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      if (this.track.type !== 'subtitle') {
        throw new Error('Batch subtitle import requires a subtitle track');
      }
      const clips = this.track.clips.map((clip) => {
        if (clip.type !== 'subtitle') {
          throw new Error('Batch subtitle import can only contain subtitle clips');
        }
        return clip;
      });
      if (clips.length === 0) {
        throw new Error('No subtitle clips to import');
      }
      const targetTrack = resolveSubtitleImportTarget(timeline, this.options.targetTrackId);
      const shouldUseExistingTrack = this.options.mode !== 'new-track' && targetTrack;
      const targetTrackId = shouldUseExistingTrack ? targetTrack.id : this.track.id;
      const importedClips = clips.map((clip) => ({ ...clip, trackId: targetTrackId }));
      if (!shouldUseExistingTrack) {
        this.after = { ...timeline, tracks: [...timeline.tracks, createTrack({ ...this.track, clips: importedClips })] };
      } else if (this.options.mode === 'replace-current-track') {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id ? createTrack({ ...track, name: this.track.name, clips: importedClips }) : track
          )
        };
      } else {
        this.after = {
          ...timeline,
          tracks: timeline.tracks.map((track) =>
            track.id === targetTrack.id ? createTrack({ ...track, clips: [...track.clips, ...importedClips] }) : track
          )
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

export class MoveClipCommand implements Command {
  readonly description = 'Move clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly newStart: number,
    private readonly protectedRanges: ProtectedRange[] = []
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
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
    private readonly protectedRanges: ProtectedRange[] = []
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const ids = Object.keys(this.newStartsByClipId);
    this.before ??= ids.map((id) => findClip(timeline, id));
    const blocked = this.before.find((clip) => !canMoveClipWithProtectedRanges(clip, this.newStartsByClipId[clip.id] ?? clip.start, this.protectedRanges));
    if (blocked) {
      throw new Error('Clip move is blocked by a protected range');
    }
    this.after = this.before.map((clip) => moveClip(clip, this.newStartsByClipId[clip.id] ?? clip.start));
    const movedById = new Map(this.after.map((clip) => [clip.id, clip]));
    const nextTimeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip)
      }))
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
        clips: track.clips.map((clip) => beforeById.get(clip.id) ?? clip)
      }))
    });
  }
}

export class BatchReorderClipsCommand implements Command {
  readonly description = 'Batch reorder clips';
  private delegate?: MoveClipsCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly startsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = []
  ) {}

  execute(): void {
    this.delegate ??= new MoveClipsCommand(this.accessor, this.startsByClipId, this.protectedRanges);
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchSubtitleTimingCommand implements Command {
  readonly description = 'Retiming subtitle clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly updates: SubtitleTimingUpdate[]) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const updatesByClipId = new Map(this.updates.map((update) => [update.clipId, update]));
      if (updatesByClipId.size === 0) {
        throw new Error('No subtitle timing updates');
      }
      let changed = 0;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            const update = updatesByClipId.get(clip.id);
            if (!update) {
              return clip;
            }
            if (clip.type !== 'subtitle') {
              throw new Error('Subtitle timing updates can only target subtitle clips');
            }
            changed += 1;
            return {
              ...clip,
              start: round(Math.max(0, update.start)),
              duration: round(Math.max(1 / 30, update.duration))
            };
          })
        }))
      };
      if (changed === 0) {
        throw new Error('No subtitle clips found for retiming');
      }
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class BatchShiftSubtitleCommand implements Command {
  readonly description = 'Shift subtitle clips';
  private delegate?: BatchSubtitleTimingCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly offsetSeconds: number,
    private readonly projectDuration: number
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const ids = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is Extract<Clip, { type: 'subtitle' }> => clip.type === 'subtitle' && ids.has(clip.id));
      this.delegate = new BatchSubtitleTimingCommand(this.accessor, calculateSubtitleShiftUpdates(clips, this.offsetSeconds, this.projectDuration));
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchAlignSubtitleCommand implements Command {
  readonly description = 'Align subtitle clips to audio peaks';
  private delegate?: BatchSubtitleTimingCommand;
  report: SubtitleAlignmentReport = { correctedCount: 0, averageOffsetMs: 0, updates: [] };

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly peakTimes: number[],
    private readonly projectDuration: number,
    private readonly options: SubtitleAlignmentOptions = {}
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const ids = new Set(this.clipIds);
      const clips = timeline.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is Extract<Clip, { type: 'subtitle' }> => clip.type === 'subtitle' && ids.has(clip.id));
      this.report = calculateSubtitleAlignmentUpdates(clips, this.peakTimes, this.projectDuration, this.options);
      if (this.report.updates.length === 0) {
        throw new Error('No subtitle alignment updates');
      }
      this.delegate = new BatchSubtitleTimingCommand(this.accessor, this.report.updates);
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchProofreadSubtitleCommand implements Command {
  readonly description = 'Fix subtitle proofreading issues';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly fixes: SubtitleProofreadingFix[]) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const fixesByClipId = new Map(this.fixes.map((fix) => [fix.clipId, fix]));
      if (fixesByClipId.size === 0) {
        throw new Error('No subtitle proofreading fixes');
      }
      let changed = 0;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.flatMap((clip) => {
            const fix = fixesByClipId.get(clip.id);
            if (!fix) {
              return [clip];
            }
            if (clip.type !== 'subtitle') {
              throw new Error('Subtitle proofreading fixes can only target subtitle clips');
            }
            if (fix.delete) {
              changed += 1;
              return [];
            }
            const nextDuration = round(Math.max(1 / 30, fix.duration ?? clip.duration));
            if (Math.abs(nextDuration - clip.duration) <= 0.000001) {
              return [clip];
            }
            changed += 1;
            return [{ ...clip, duration: nextDuration }];
          })
        }))
      };
      if (changed === 0) {
        throw new Error('No subtitle clips found for proofreading fixes');
      }
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class SnapToBeatsCommand implements Command {
  readonly description = 'Snap clips to beats';
  private before?: Timeline;
  private after?: Timeline;
  private updates?: BeatSnapUpdate[];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly beatTimes: number[],
    private readonly maxDistance = 0.25
  ) {}

  get appliedUpdates(): BeatSnapUpdate[] {
    return this.updates ?? [];
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      this.updates = calculateBeatSnapUpdates(timeline, this.clipIds, this.beatTimes, this.maxDistance);
      if (this.updates.length === 0) {
        throw new Error('No selected clips are within beat snap range');
      }
      const startsByClipId = new Map(this.updates.map((update) => [update.clipId, update.to]));
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => (startsByClipId.has(clip.id) ? moveClip(clip, startsByClipId.get(clip.id)!) : clip))
        }))
      };
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface BatchAlignToBeatOptions {
  maxDistance?: number;
  syncSpeed?: boolean;
}

export class BatchAlignToBeatCommand implements Command {
  readonly description = 'Batch align clips to beats';
  private before?: Timeline;
  private after?: Timeline;
  private updates?: BeatAlignmentUpdate[];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly beatTimes: number[],
    private readonly options: BatchAlignToBeatOptions = {}
  ) {}

  get appliedUpdates(): BeatAlignmentUpdate[] {
    return this.updates ?? [];
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      this.updates = calculateBeatAlignmentUpdates(timeline, this.clipIds, this.beatTimes, this.options.maxDistance ?? 0.05);
      if (this.updates.length === 0) {
        throw new Error('No selected video clips are within beat alignment range');
      }
      const updatesByClipId = new Map(this.updates.map((update) => [update.clipId, update]));
      const syncSpeed = this.options.syncSpeed === true;
      const nextTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            const update = updatesByClipId.get(clip.id);
            if (!update) {
              return clip;
            }
            const duration = round(update.toEnd - update.toStart);
            let next = {
              ...clip,
              start: update.toStart,
              duration,
              beatMarkers: normalizeClipBeatMarkers(clip.beatMarkers, duration),
              detectedBpm: normalizeDetectedBpm(clip.detectedBpm)
            } as Clip;
            if (syncSpeed && next.type === 'video') {
              const speedFrames = buildBeatSyncSpeedKeyframes(next, this.beatTimes);
              if (speedFrames.length > 0) {
                next = {
                  ...next,
                  keyframes: normalizeClipKeyframes({ ...(next.keyframes ?? {}), speed: speedFrames }, next.duration)
                } as Clip;
              }
            }
            return next;
          })
        }))
      };
      if (timelineHasOverlaps(nextTimeline)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      this.after = nextTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class SlipClipCommand implements Command {
  readonly description = 'Slip clip';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly delta: number) {}

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
    private readonly minDuration = 1 / 30
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
    private readonly minDuration = 1 / 30
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
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

  constructor(private readonly accessor: TimelineAccessor, private readonly clipIds: string[]) {}

  execute(): void {
    const uniqueIds = Array.from(new Set(this.clipIds));
    const timeline = this.accessor.getTimeline();
    this.removed = uniqueIds.map((id) => findClipLocation(timeline, id));
    const ids = new Set(uniqueIds);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) }))
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
    private readonly protectedRanges: ProtectedRange[] = []
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const uniqueIds = Array.from(new Set(this.clipIds));
      if (uniqueIds.length === 0) {
        throw new Error('No clips selected for ripple delete');
      }
      const ids = new Set(uniqueIds);
      const missingIds = uniqueIds.filter((clipId) => !timeline.tracks.some((track) => track.clips.some((clip) => clip.id === clipId)));
      if (missingIds.length > 0) {
        throw new Error(`Clip ${missingIds[0]} not found`);
      }
      this.after = {
        ...timeline,
        tracks: timeline.tracks.map((track) => rippleDeleteTrackClips(track, ids, this.protectedRanges)),
        transitions: (timeline.transitions ?? []).filter((transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId))
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

  constructor(private readonly accessor: TimelineAccessor, private readonly trackId: string, private readonly time: number) {}

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
        tracks: timeline.tracks.map((item) => (item.id === this.trackId ? closeTrackGap(item, gap.start, gap.end) : item)),
        transitions: timeline.transitions ?? []
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

  constructor(private readonly accessor: TimelineAccessor, private readonly trackId: string, private readonly time: number, private readonly operation: FillGapOperation) {}

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
          duration: gap.duration
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
            ...(timeline.transitions ?? []).filter((item) => item.fromClipId !== transition.fromClipId || item.toClipId !== transition.toClipId),
            transition
          ]
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
    private readonly minDuration = 1 / 30
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
                clips: track.clips.map((clip) => (clip.id === left.id ? left : clip.id === right.id ? right : clip))
              }
            : track
        ),
        transitions: timeline.transitions ?? []
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
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME
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

export class CreateMulticamSequenceCommand implements Command {
  readonly description = 'Create multicam sequence';
  private before?: Project;
  private after?: Project;
  private resultClipId?: string;
  private resultSequenceId?: string;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME
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
    private readonly angleId: string
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

export class SplitClipCommand implements Command {
  readonly description = 'Split clip';
  private original?: Clip;
  private left?: Clip;
  private right?: Clip;
  private originalIndex = -1;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly splitTime: number) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.original ??= findClip(timeline, this.clipId);
    const track = findTrack(timeline, this.original.trackId);
    this.originalIndex = track.clips.findIndex((clip) => clip.id === this.clipId);
    [this.left, this.right] = splitClip(this.original, this.splitTime);
    const withoutOriginal = removeClip(timeline, this.original.id).timeline;
    this.accessor.setTimeline(insertClip(insertClip(withoutOriginal, this.left, this.originalIndex), this.right, this.originalIndex + 1));
  }

  undo(): void {
    if (!this.original || !this.left || !this.right) {
      return;
    }
    let timeline = removeClip(this.accessor.getTimeline(), this.left.id).timeline;
    timeline = removeClip(timeline, this.right.id).timeline;
    this.accessor.setTimeline(insertClip(timeline, this.original, this.originalIndex));
  }
}

export class SplitClipAtTimesCommand implements Command {
  readonly description = 'Split clip at times';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly splitTimes: number[]) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      const ranges = buildSplitRanges(clip.duration, this.splitTimes);
      if (ranges.length <= 1) {
        throw new Error('No valid split points inside clip bounds');
      }
      this.after = replaceClipWithSlices(timeline, this.clipId, ranges, false);
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
    cuts: MulticamAngleCut[] = []
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
    this.after = this.cuts.reduce((project, cut) => cutMulticamClip(project, this.clipId, cut.sceneTime, cut.angleId), this.before);
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
    private readonly fps: number
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

export interface BatchSplitAtSceneCutItem {
  clipId: string;
  cuts?: number[];
  minSceneSeconds?: number;
}

export class BatchSplitAtSceneCutsCommand implements Command {
  readonly description = 'Split clips at scene cuts';
  private before?: Timeline;
  private after?: Timeline;

  constructor(private readonly accessor: TimelineAccessor, private readonly items: BatchSplitAtSceneCutItem[]) {}

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

  constructor(private readonly accessor: TimelineAccessor, private readonly inputs: AddTimelineMarkerInput[]) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    this.markers ??= this.inputs.map((input) => createTimelineMarker(input, getTimelineDuration(timeline)));
    if (this.markers.length === 0) {
      throw new Error('No timeline markers to add');
    }
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers([...(timeline.markers ?? []), ...this.markers])
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

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly ranges: LocalTimeRange[]) {}

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

export class DeleteClipCommand implements Command {
  readonly description = 'Delete clip';
  private removed?: Clip;
  private removedIndex = -1;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string) {}

  execute(): void {
    const result = removeClip(this.accessor.getTimeline(), this.clipId);
    this.removed = result.clip;
    this.removedIndex = result.index;
    this.accessor.setTimeline(result.timeline);
  }

  undo(): void {
    if (this.removed) {
      this.accessor.setTimeline(insertClip(this.accessor.getTimeline(), this.removed, this.removedIndex));
    }
  }
}

export interface AddKeyframeInput {
  id?: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
}

export class AddKeyframeCommand implements Command {
  readonly description = 'Add keyframe';
  private before?: Clip;
  private after?: Clip;
  private keyframe?: Keyframe<number>;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly property: KeyframeProperty, private readonly input: AddKeyframeInput) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.keyframe ??= createKeyframe(this.property, this.input, this.before.duration);
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, this.keyframe, this.before.duration)
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (this.property === 'speed' && detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)) {
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

  constructor(private readonly accessor: TimelineAccessor, private readonly updates: BatchUpdateKeyframeItem[], description = 'Batch update keyframes') {
    this.description = description;
  }

  execute(): void {
    let timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    for (const update of this.updates) {
      const beforeClip = findClip(timeline, update.clipId);
      let keyframes = update.replace ? { ...(beforeClip.keyframes ?? {}), [update.property]: [] } : beforeClip.keyframes;
      for (const input of update.keyframes) {
        keyframes = setKeyframeForProperty(keyframes, update.property, createKeyframe(update.property, input, beforeClip.duration), beforeClip.duration);
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration)
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

export type KeyframePatch = Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing'>>;

export interface KeyframeSelectionRef {
  clipId: string;
  property: KeyframeProperty;
  keyframeId: string;
}

export type BatchKeyframeEditOperation =
  | { type: 'shift'; delta: number }
  | { type: 'scale-time'; factor: number; center?: number }
  | { type: 'delete' }
  | { type: 'easing'; easing: KeyframeEasing };

export class UpdateKeyframeCommand implements Command {
  readonly description = 'Update keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly keyframeId: string,
    private readonly patch: KeyframePatch
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
        easing: this.patch.easing ?? existing.easing
      },
      this.before.duration
    );
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, nextKeyframe, this.before.duration)
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (this.property === 'speed' && detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)) {
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
    description = 'Batch edit keyframes'
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
    const center = this.operation.type === 'scale-time' ? this.operation.center ?? calculateKeyframeSelectionCenter(timeline, refs) : 0;
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
        const nextTime = getBatchEditedKeyframeTime(beforeClip, existing, this.operation, center);
        const nextEasing = this.operation.type === 'easing' ? this.operation.easing : existing.easing;
        keyframes = setKeyframeForProperty(
          keyframes,
          ref.property,
          createKeyframe(
            ref.property,
            {
              id: existing.id,
              time: nextTime,
              value: existing.value,
              easing: nextEasing
            },
            beforeClip.duration
          ),
          beforeClip.duration
        );
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration)
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

function uniqueKeyframeRefs(refs: KeyframeSelectionRef[]): KeyframeSelectionRef[] {
  const seen = new Set<string>();
  const output: KeyframeSelectionRef[] = [];
  for (const ref of refs) {
    const key = `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(ref);
  }
  return output;
}

function groupKeyframeRefsByClip(refs: KeyframeSelectionRef[]): Map<string, KeyframeSelectionRef[]> {
  const output = new Map<string, KeyframeSelectionRef[]>();
  for (const ref of refs) {
    const group = output.get(ref.clipId) ?? [];
    group.push(ref);
    output.set(ref.clipId, group);
  }
  return output;
}

function calculateKeyframeSelectionCenter(timeline: Timeline, refs: KeyframeSelectionRef[]): number {
  const absoluteTimes = refs.flatMap((ref) => {
    const clip = findClip(timeline, ref.clipId);
    const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
    return frame ? [clip.start + frame.time] : [];
  });
  if (absoluteTimes.length === 0) {
    return 0;
  }
  return round((Math.min(...absoluteTimes) + Math.max(...absoluteTimes)) / 2);
}

function getBatchEditedKeyframeTime(
  clip: Clip,
  frame: Keyframe<number>,
  operation: BatchKeyframeEditOperation,
  center: number
): number {
  if (operation.type === 'shift') {
    const delta = Number.isFinite(operation.delta) ? operation.delta : 0;
    return clampKeyframeTime(frame.time + delta, clip.duration);
  }
  if (operation.type === 'scale-time') {
    const factor = Math.max(0.01, Number.isFinite(operation.factor) ? operation.factor : 1);
    const absoluteTime = clip.start + frame.time;
    return clampKeyframeTime(center + (absoluteTime - center) * factor - clip.start, clip.duration);
  }
  return frame.time;
}

function clampKeyframeTime(time: number, duration: number): number {
  return round(Math.min(Math.max(0, time), Math.max(0, duration)));
}

export class RemoveKeyframeCommand implements Command {
  readonly description = 'Remove keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly property: KeyframeProperty, private readonly keyframeId: string) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    if (!this.before.keyframes?.[this.property]?.some((frame) => frame.id === this.keyframeId)) {
      throw new Error(`Keyframe ${this.keyframeId} not found`);
    }
    this.after = {
      ...this.before,
      keyframes: removeKeyframeForProperty(this.before.keyframes, this.property, this.keyframeId)
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (this.property === 'speed' && detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)) {
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

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly input: ApplyTextAnimationInput) {}

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
      text: this.before.text
    });
    this.after = {
      ...this.before,
      keyframes: mergeTextAnimationKeyframes(this.before.keyframes, generated, this.before.duration)
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type ClipPatch = Partial<Omit<Clip, 'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation' | 'border'>> & {
  keyframes?: ClipKeyframes;
  kenBurns?: boolean;
  volume?: number;
  text?: string;
  richText?: Extract<Clip, { type: 'text' }>['richText'];
  textLayout?: Extract<Clip, { type: 'text' }>['textLayout'];
  openTypeFeatures?: Extract<Clip, { type: 'text' }>['openTypeFeatures'];
  arcText?: Extract<Clip, { type: 'text' }>['arcText'];
  colorLabel?: TimelineLabelColor | null;
  mediaId?: string;
  subtitleType?: SubtitleTrackType;
  speaker?: string;
  soundDesc?: string;
  subtitleMode?: SubtitleMode;
  dataSubtitle?: Extract<Clip, { type: 'subtitle' }>['dataSubtitle'];
  speed?: number;
  pitchSemitones?: number;
  audioChannelRouting?: Clip['audioChannelRouting'];
  pitchData?: Clip['pitchData'];
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
  chromaKey?: Partial<ChromaKey>;
  stabilization?: Partial<ClipStabilization>;
  frameInterpolation?: Partial<ClipFrameInterpolation>;
  audioDenoise?: Partial<ClipAudioDenoise>;
  spatialAudio?: Partial<ClipSpatialAudio>;
  videoRestoration?: Partial<ClipVideoRestoration>;
  qualityEnhancement?: Partial<ClipQualityEnhancement>;
  projection?: ClipProjection;
  panorama?: Partial<ClipPanoramaView>;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: Partial<ClipBorder>;
  sequenceFrameRate?: number;
  colorCorrection?: Partial<ColorCorrection>;
  transform?: Partial<Transform>;
  rows?: CreditsRow[];
  rollSpeed?: number;
  style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
  pathText?: Partial<TextPathOptions>;
  motionGraphic?: Partial<Extract<Clip, { type: 'motion-graphic' }>['motionGraphic']>;
};

export class UpdateSubtitleStyleCommand implements Command {
  readonly description = 'Update subtitle style';
  private before?: Extract<Clip, { type: 'subtitle' }>;
  private after?: Extract<Clip, { type: 'subtitle' }>;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly style: Partial<SubtitleStyle>) {}

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
      style: nextStyle
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

function cloneCommandValue<T>(value: T): T {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

export type ReplaceMediaDurationMode = 'trim-to-original' | 'stretch-to-fit' | 'use-new-duration';
export type ReplaceMediaCompatibilityWarning = 'media-type-mismatch' | 'missing-audio-for-audio-properties';
type ReplaceableMediaClip = Extract<Clip, { mediaId: string }>;

export function calculateReplaceMediaPatch(
  clip: ReplaceableMediaClip,
  media: Pick<MediaAsset, 'id' | 'duration'>,
  durationMode: ReplaceMediaDurationMode
): Pick<ReplaceableMediaClip, 'mediaId' | 'duration' | 'trimStart' | 'trimEnd' | 'speed'> {
  const minDuration = 1 / 30;
  const originalDuration = Math.max(minDuration, clip.duration);
  const mediaDuration = Math.max(minDuration, Number.isFinite(media.duration) ? media.duration : originalDuration);
  if (durationMode === 'stretch-to-fit') {
    return {
      mediaId: media.id,
      duration: round(originalDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: getClipSpeed({ speed: mediaDuration / originalDuration })
    };
  }
  if (durationMode === 'use-new-duration') {
    return {
      mediaId: media.id,
      duration: round(mediaDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED
    };
  }
  const duration = Math.min(originalDuration, mediaDuration);
  return {
    mediaId: media.id,
    duration: round(duration),
    trimStart: 0,
    trimEnd: round(Math.max(0, mediaDuration - duration)),
    speed: DEFAULT_CLIP_SPEED
  };
}

export function getReplaceMediaCompatibilityWarnings(clip: Clip, media: Pick<MediaAsset, 'type' | 'hasAudio'>): ReplaceMediaCompatibilityWarning[] {
  if (!isReplaceableMediaClip(clip)) {
    return ['media-type-mismatch'];
  }
  const warnings = new Set<ReplaceMediaCompatibilityWarning>();
  if (clip.type !== media.type) {
    warnings.add('media-type-mismatch');
  }
  const newMediaHasAudio = media.type === 'audio' || (media.type === 'video' && media.hasAudio !== false);
  const clipHasAudioProperties =
    clip.type === 'audio' ||
    ('volume' in clip && clip.volume !== undefined) ||
    Boolean(clip.keyframes?.volume?.length) ||
    ('fadeInDuration' in clip && ((clip.fadeInDuration ?? 0) > 0 || (clip.fadeOutDuration ?? 0) > 0));
  if (clipHasAudioProperties && !newMediaHasAudio) {
    warnings.add('missing-audio-for-audio-properties');
  }
  return Array.from(warnings);
}

export class ReplaceMediaCommand implements Command {
  readonly description = 'Replace media';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
    private readonly durationMode: ReplaceMediaDurationMode
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, this.durationMode);
    this.after = {
      ...this.before,
      ...patch
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration)
      } as ReplaceableMediaClip;
    }
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

export class SwitchMediaVersionCommand implements Command {
  readonly description = 'Switch media version';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, 'trim-to-original');
    this.after = {
      ...this.before,
      ...patch
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration)
      } as ReplaceableMediaClip;
    }
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

function asReplaceableMediaClip(clip: Clip): ReplaceableMediaClip {
  if (!isReplaceableMediaClip(clip)) {
    throw new Error('Media replacement requires a media clip');
  }
  return clip;
}

function isReplaceableMediaClip(clip: Clip): clip is ReplaceableMediaClip {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
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

function mergeChromaKeyPatch(before: ChromaKey | undefined, patch: Partial<ChromaKey> | undefined): ChromaKey {
  if (!patch) {
    return normalizeChromaKey(before);
  }
  if (patch.color && !patch.colors) {
    const current = normalizeChromaKey(before);
    return normalizeChromaKey({
      ...current,
      ...patch,
      colors: [patch.color, ...current.colors.slice(1)]
    });
  }
  return normalizeChromaKey({ ...before, ...patch });
}

export class PiPLayoutCommand implements Command {
  readonly description = 'Apply PiP layout';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly mainClipId: string,
    private readonly pipClipId: string,
    private readonly options: PiPLayoutCommandOptions
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
      margin: this.options.margin
    });
    const nextById = new Map<string, Clip>([
      [
        mainClip.id,
        {
          ...mainClip,
          transform: normalizeTransform(createFullFrameTransform()),
          border: normalizeClipBorder({ enabled: false })
        } as Clip
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
            ...this.options.border
          })
        } as Clip
      ]
    ]);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => nextById.get(clip.id) ?? clip)
      }))
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

function isPiPVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
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
    private readonly options: ApplySplitLayoutCommandOptions
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
        sourceHeight: source?.height
      };
    });
    const transforms = new Map(
      calculateSplitLayoutTransforms({
        layout: this.options.layout,
        clips: sources,
        canvasWidth: this.options.canvasWidth,
        canvasHeight: this.options.canvasHeight
      }).map((item) => [item.clipId, item.transform])
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
        })
      }))
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export class UpdateClipCommand implements Command {
  readonly description = 'Update clip';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly patch: ClipPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const nextSpeed = typeof this.patch.speed === 'number' ? getClipSpeed({ speed: this.patch.speed }) : undefined;
    const nextColorLabel = this.patch.colorLabel === undefined ? this.before.colorLabel : normalizeTimelineLabelColor(this.patch.colorLabel);
    this.after = {
      ...this.before,
      ...this.patch,
      speed: nextSpeed ?? this.before.speed,
      ...(nextColorLabel === undefined ? {} : { colorLabel: nextColorLabel }),
      colorCorrection: normalizeColorCorrection({ ...this.before.colorCorrection, ...this.patch.colorCorrection }),
      chromaKey: mergeChromaKeyPatch(this.before.chromaKey, this.patch.chromaKey),
      stabilization: normalizeStabilization({ ...this.before.stabilization, ...this.patch.stabilization }),
      frameInterpolation: normalizeFrameInterpolation({ ...this.before.frameInterpolation, ...this.patch.frameInterpolation }),
      slowMotionMode: normalizeSlowMotionMode(this.patch.slowMotionMode ?? this.before.slowMotionMode),
      audioDenoise: normalizeAudioDenoise({ ...this.before.audioDenoise, ...this.patch.audioDenoise }),
      audioChannelRouting: normalizeAudioChannelRouting(this.patch.audioChannelRouting ?? this.before.audioChannelRouting),
      videoRestoration: normalizeVideoRestoration({ ...this.before.videoRestoration, ...this.patch.videoRestoration }),
      qualityEnhancement: normalizeQualityEnhancement({ ...this.before.qualityEnhancement, ...this.patch.qualityEnhancement }),
      projection: normalizeClipProjection(this.patch.projection ?? this.before.projection),
      panorama: normalizeClipPanoramaView({ ...this.before.panorama, ...this.patch.panorama }),
      masks: this.patch.masks === undefined ? normalizeMasks(this.before.masks) : normalizeMasks(this.patch.masks),
      motionTrack: this.patch.motionTrack === undefined ? normalizeMotionTrack(this.before.motionTrack, this.before.duration) : normalizeMotionTrack(this.patch.motionTrack, this.before.duration),
      border: this.patch.border === undefined ? normalizeClipBorder(this.before.border) : normalizeClipBorder({ ...(this.before.border ?? {}), ...this.patch.border }),
      sequenceFrameRate: normalizeSequenceFrameRate(this.patch.sequenceFrameRate ?? this.before.sequenceFrameRate),
      blendMode: normalizeClipBlendMode(this.patch.blendMode ?? this.before.blendMode),
      contentAnalysis: this.patch.contentAnalysis === undefined ? normalizeClipContentAnalysis(this.before.contentAnalysis) : normalizeClipContentAnalysis(this.patch.contentAnalysis),
      pitchData: this.patch.pitchData === undefined ? normalizeClipPitchData(this.before.pitchData) : normalizeClipPitchData(this.patch.pitchData),
      transform: normalizeTransform(
        this.patch.transform?.scale !== undefined && this.patch.transform.scaleX === undefined && this.patch.transform.scaleY === undefined
          ? { ...this.before.transform, ...this.patch.transform, scaleX: this.patch.transform.scale, scaleY: this.patch.transform.scale }
          : { ...this.before.transform, ...this.patch.transform }
      )
    } as Clip;
    if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
      this.after = {
        ...this.after,
        pitchSemitones: normalizeAudioPitchSemitones(this.patch.pitchSemitones ?? this.after.pitchSemitones),
        reverseAudio: (this.patch.reverseAudio ?? this.after.reverseAudio) === true,
        fadeInDuration: normalizeAudioFadeDuration(this.patch.fadeInDuration ?? this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.patch.fadeOutDuration ?? this.after.fadeOutDuration, this.after.duration),
        fadeInCurve: normalizeAudioFadeCurve(this.patch.fadeInCurve ?? this.after.fadeInCurve),
        fadeOutCurve: normalizeAudioFadeCurve(this.patch.fadeOutCurve ?? this.after.fadeOutCurve),
        spatialAudio: normalizeSpatialAudio({ ...this.after.spatialAudio, ...this.patch.spatialAudio })
      } as Clip;
    }
    const speedKeyframesChanged = this.patch.keyframes !== undefined && (Boolean(this.before.keyframes?.speed?.length) || Boolean(this.patch.keyframes?.speed?.length));
    if (typeof nextSpeed === 'number' || speedKeyframesChanged) {
      this.after = {
        ...this.after,
        duration: getClipDisplayDuration(getClipSourceVisibleDuration(this.before), nextSpeed ?? this.after.speed, this.after.keyframes)
      } as Clip;
      if (this.after.type === 'video' || this.after.type === 'audio' || this.after.type === 'nested-sequence') {
        this.after = {
          ...this.after,
          fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
          fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration)
        } as Clip;
      }
    }
    const beatMarkers = this.patch.beatMarkers === undefined ? normalizeClipBeatMarkers(this.after.beatMarkers, this.after.duration) : normalizeClipBeatMarkers(this.patch.beatMarkers, this.after.duration);
    const detectedBpm = this.patch.detectedBpm === undefined ? normalizeDetectedBpm(this.after.detectedBpm) : normalizeDetectedBpm(this.patch.detectedBpm);
    const scenecuts = this.patch.scenecuts === undefined ? normalizeClipSceneCuts(this.after.scenecuts, this.after.duration) : normalizeClipSceneCuts(this.patch.scenecuts, this.after.duration);
    this.after = {
      ...this.after,
      beatMarkers,
      detectedBpm,
      scenecuts
    } as Clip;
    if ('style' in this.before || this.patch.style) {
      this.after = {
        ...this.after,
        style: { ...('style' in this.before ? this.before.style : {}), ...this.patch.style }
      } as Clip;
    }
    if (this.after.type === 'text') {
      this.after = {
        ...this.after,
        richText: normalizeRichTextDocument(this.after.richText, this.after.text),
        textLayout: normalizeTextLayout(this.after.textLayout),
        openTypeFeatures: normalizeTextOpenTypeFeatures(this.after.openTypeFeatures),
        arcText: normalizeTextArc(this.after.arcText),
        pathText: normalizeTextPath(this.after.pathText)
      };
    }
    if (this.after.type === 'subtitle') {
      const subtitleType = normalizeSubtitleTrackType(this.after.subtitleType);
      this.after = {
        ...this.after,
        subtitleType,
        speaker: subtitleType === 'cc' ? normalizeSubtitleSpeaker(this.after.speaker) : undefined,
        soundDesc: subtitleType === 'cc' ? normalizeSubtitleSoundDesc(this.after.soundDesc) : undefined,
        dataSubtitle: normalizeDataSubtitleSource(this.after.dataSubtitle)
      };
    }
    if (this.after.type === 'credits') {
      this.after = {
        ...this.after,
        rows: normalizeCreditsRows(this.patch.rows ?? (this.patch.text !== undefined ? undefined : this.after.rows), this.after.text),
        rollSpeed: normalizeCreditsRollSpeed(this.patch.rollSpeed ?? this.after.rollSpeed),
        style: normalizeCreditsStyle(this.after.style)
      };
    }
    if (this.after.type === 'motion-graphic') {
      this.after = {
        ...this.after,
        motionGraphic: normalizeMotionGraphic(this.patch.motionGraphic ?? this.after.motionGraphic, this.after.duration)
      };
    }
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

export interface AddEffectInput {
  id?: string;
  type: EffectType;
  enabled?: boolean;
  params?: EffectParams;
}

export class AddEffectCommand implements Command {
  readonly description = 'Add effect';
  private before?: Clip;
  private after?: Clip;
  private effect?: Effect;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly input: AddEffectInput) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.effect ??= normalizeEffect({
      id: this.input.id ?? createId('effect'),
      type: this.input.type,
      enabled: this.input.enabled ?? true,
      params: this.input.params
    });
    if (!this.effect) {
      throw new Error('Invalid effect');
    }
    this.after = {
      ...this.before,
      effects: [...(cloneEffects(this.before.effects) ?? []), this.effect]
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveEffectCommand implements Command {
  readonly description = 'Remove effect';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly effectId: string) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    if (!effects.some((effect) => effect.id === this.effectId)) {
      throw new Error(`Effect ${this.effectId} not found`);
    }
    this.after = {
      ...this.before,
      effects: normalizeEffects(effects.filter((effect) => effect.id !== this.effectId))
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type EffectPatch = Partial<Pick<Effect, 'enabled' | 'params' | 'type'>>;

export class UpdateEffectCommand implements Command {
  readonly description = 'Update effect';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly effectId: string, private readonly patch: EffectPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    const index = effects.findIndex((effect) => effect.id === this.effectId);
    if (index === -1) {
      throw new Error(`Effect ${this.effectId} not found`);
    }
    const existing = effects[index];
    const nextEffect = normalizeEffect({
      ...existing,
      ...this.patch,
      params: { ...existing.params, ...this.patch.params }
    });
    if (!nextEffect) {
      throw new Error('Invalid effect');
    }
    effects[index] = nextEffect;
    this.after = { ...this.before, effects } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class ReorderEffectsCommand implements Command {
  readonly description = 'Reorder effects';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly orderedEffectIds: string[]) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    const byId = new Map(effects.map((effect) => [effect.id, effect]));
    if (this.orderedEffectIds.some((id) => !byId.has(id))) {
      throw new Error('Effect order does not match current effect stack');
    }
    const reordered = this.orderedEffectIds.flatMap((id) => {
      const effect = byId.get(id);
      return effect ? [effect] : [];
    });
    const included = new Set(reordered.map((effect) => effect.id));
    reordered.push(...effects.filter((effect) => !included.has(effect.id)));
    if (reordered.length !== effects.length) {
      throw new Error('Effect order does not match current effect stack');
    }
    this.after = { ...this.before, effects: reordered } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class AddMaskCommand implements Command {
  readonly description = 'Add mask';
  private before?: Clip;
  private after?: Clip;
  private mask?: ClipMask;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly input: Partial<ClipMask> = {}) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.mask ??= createMask(this.input);
    this.after = {
      ...this.before,
      masks: [...normalizeMasks(this.before.masks), this.mask]
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveMaskCommand implements Command {
  readonly description = 'Remove mask';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly maskId: string) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.filter((mask) => mask.id !== this.maskId)
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type MaskPatch = Partial<Omit<ClipMask, 'id'>>;

export class UpdateMaskCommand implements Command {
  readonly description = 'Update mask';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly maskId: string, private readonly patch: MaskPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.map((mask) => (mask.id === this.maskId ? normalizeMask({ ...mask, ...this.patch, id: mask.id }) : mask))
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

function clampTrimValues(clip: Clip, requestedTrimStart: number, requestedTrimEnd: number, minDuration: number): { trimStart: number; trimEnd: number } {
  const sourceDuration = Math.max(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd, 0);
  const minimumDuration = Math.max(0.001, minDuration);
  const maxCombinedTrim = Math.max(0, sourceDuration - minimumDuration);
  let trimStart = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimStart)));
  let trimEnd = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimEnd)));
  if (trimStart + trimEnd <= maxCombinedTrim) {
    return { trimStart, trimEnd };
  }
  const trimStartChanged = Math.abs(trimStart - clip.trimStart) >= Math.abs(trimEnd - clip.trimEnd);
  if (trimStartChanged) {
    trimStart = round(Math.max(0, maxCombinedTrim - trimEnd));
  } else {
    trimEnd = round(Math.max(0, maxCombinedTrim - trimStart));
  }
  return { trimStart, trimEnd };
}

function applySpeedKeyframeDuration(before: Clip, after: Clip, property: KeyframeProperty): Clip {
  if (property !== 'speed') {
    return after;
  }
  const duration = getClipDisplayDuration(getClipSourceVisibleDuration(before), after.speed, after.keyframes);
  return {
    ...after,
    duration,
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(after.keyframes), duration)
  } as Clip;
}

function packNestedSequence(project: Project, clipIds: string[], sequenceName: string): Project {
  const uniqueIds = Array.from(new Set(clipIds));
  if (uniqueIds.length === 0) {
    throw new Error('No clips selected for nested sequence');
  }
  const timeline = project.timeline;
  const selectedIds = new Set(uniqueIds);
  const trackIndexById = new Map(timeline.tracks.map((track, index) => [track.id, index]));
  const locations = uniqueIds.map((id) => findClipLocation(timeline, id)).sort((left, right) => {
    return (trackIndexById.get(left.trackId) ?? 0) - (trackIndexById.get(right.trackId) ?? 0) || left.clip.start - right.clip.start;
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
  const blocked = targetTrack.clips.some((clip) => !selectedIds.has(clip.id) && clip.start < end && clip.start + clip.duration > start);
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
              trackId: track.id
            }))
        })
      )
      .filter((track) => track.clips.length > 0),
    transitions: (timeline.transitions ?? []).filter((transition) => selectedIds.has(transition.fromClipId) && selectedIds.has(transition.toClipId)),
    markers: (timeline.markers ?? [])
      .filter((marker) => marker.time >= start && marker.time <= end)
      .map((marker) => ({ ...marker, time: round(marker.time - start) }))
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
    trimEnd: 0
  });
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const kept = track.clips.filter((clip) => !selectedIds.has(clip.id));
      if (track.id !== target.trackId) {
        return { ...track, clips: kept };
      }
      const insertIndex = kept.findIndex((clip) => clip.start > nestedClip.start);
      const clips = insertIndex === -1 ? [...kept, nestedClip] : [...kept.slice(0, insertIndex), nestedClip, ...kept.slice(insertIndex)];
      return { ...track, clips };
    }),
    transitions: (timeline.transitions ?? []).filter((transition) => !selectedIds.has(transition.fromClipId) && !selectedIds.has(transition.toClipId))
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
        timeline: nestedTimeline
      })
    ]
  };
}

function cutMulticamClip(project: Project, clipId: string, sceneTime: number, angleId: string): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  if (sceneTime < clip.start - 0.000001 || sceneTime > clip.start + clip.duration + 0.000001) {
    throw new Error('Multicam cut time must be inside the clip bounds');
  }
  const localTime = round(Math.min(clip.duration, Math.max(0, sceneTime - clip.start + clip.trimStart)));
  const switches = setMulticamSwitch(clip.multicam, localTime, angleId, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches
      }
    })
  );
}

function trimMulticamClip(project: Project, clipId: string, switchId: string, frameDelta: number, fps: number): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  const switches = trimMulticamSwitch(clip.multicam, switchId, frameDelta, fps, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches
      }
    })
  );
}

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
    effects: cloneEffects(clip.effects)
  };
  if (clip.type === 'credits') {
    return {
      ...cloned,
      rows: normalizeCreditsRows(clip.rows, clip.text),
      rollSpeed: normalizeCreditsRollSpeed(clip.rollSpeed),
      style: normalizeCreditsStyle(clip.style)
    } as TClip;
  }
  if (clip.type === 'motion-graphic') {
    return {
      ...cloned,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration)
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
        pathText: normalizeTextPath(clip.pathText)
      } as TClip;
    }
    return { ...cloned, style: { ...clip.style } } as TClip;
  }
  return cloned as TClip;
}

function sortMarkers(markers: TimelineMarker[]): TimelineMarker[] {
  return [...markers].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function sortAnnotations(annotations: ProjectAnnotation[]): ProjectAnnotation[] {
  return [...annotations].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function sortReviewAnnotations(annotations: ReviewAnnotation[]): ReviewAnnotation[] {
  return [...annotations].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function sortCollaborationNotes(notes: CollaborationNote[]): CollaborationNote[] {
  return normalizeCollaborationNotes(notes);
}

function sortTimelineNotes(notes: TimelineNote[]): TimelineNote[] {
  return normalizeTimelineNotes(notes);
}

function sortBookmarks(bookmarks: TimelineBookmark[]): TimelineBookmark[] {
  return [...bookmarks].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
