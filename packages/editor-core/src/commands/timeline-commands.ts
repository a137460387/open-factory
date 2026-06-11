import {
  createId,
  createMask,
  createNestedSequenceClip,
  createSequence,
  createTransition,
  createTimelineMarker,
  createTrack,
  DEFAULT_NESTED_SEQUENCE_NAME,
  normalizeMasterVolume,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeProperty,
  normalizeColorCorrection,
  normalizeChromaKey,
  normalizeFrameInterpolation,
  normalizeMask,
  normalizeMasks,
  normalizeSequenceFrameRate,
  normalizeStabilization,
  normalizeTimelineMarker,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeTrackPan,
  normalizeTrackVolume,
  replaceProjectActiveTimeline,
  type Clip,
  type ClipKeyframes,
  type ChromaKey,
  type ClipFrameInterpolation,
  type ClipStabilization,
  type ClipMask,
  type ColorCorrection,
  type Project,
  type SubtitleMode,
  type SubtitleStyle,
  type TextStyle,
  type Timeline,
  type TimelineMarker,
  type Track,
  type Transition,
  type TransitionType,
  type Transform
} from '../model';
import { createKeyframe, removeKeyframeForProperty, setKeyframeForProperty } from '../keyframes';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { cloneEffects, normalizeEffect, normalizeEffects, type Effect, type EffectType } from '../effects';
import {
  calculateSpeedCurveSourceDuration,
  clampTransitionDuration,
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
    keyframes: sliceClipKeyframes(clip.keyframes, range.start, pieceDuration),
    effects: cloneEffects(clip.effects)
  } as TClip;
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

export type TrackPatch = Partial<Pick<Track, 'name' | 'muted' | 'solo' | 'locked' | 'volume' | 'pan' | 'eq' | 'compressor'>>;

export class UpdateTrackCommand implements Command {
  readonly description = 'Update track';
  private before?: Track;
  private after?: Track;

  constructor(private readonly accessor: TimelineAccessor, private readonly trackId: string, private readonly patch: TrackPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findTrack(timeline, this.trackId);
    this.after = createTrack({
      ...this.before,
      ...this.patch,
      volume: this.patch.volume === undefined ? this.before.volume : normalizeTrackVolume(this.patch.volume),
      pan: this.patch.pan === undefined ? this.before.pan : normalizeTrackPan(this.patch.pan),
      eq: this.patch.eq === undefined ? this.before.eq : normalizeTrackEQ(this.patch.eq),
      compressor: this.patch.compressor === undefined ? this.before.compressor : normalizeTrackCompressor(this.patch.compressor)
    });
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

export class MoveClipCommand implements Command {
  readonly description = 'Move clip';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly newStart: number) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
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

  constructor(private readonly accessor: TimelineAccessor, private readonly newStartsByClipId: Record<string, number>) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const ids = Object.keys(this.newStartsByClipId);
    this.before ??= ids.map((id) => findClip(timeline, id));
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

export type KeyframePatch = Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing'>>;

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

export type ClipPatch = Partial<Omit<Clip, 'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation'>> & {
  keyframes?: ClipKeyframes;
  kenBurns?: boolean;
  volume?: number;
  text?: string;
  mediaId?: string;
  subtitleMode?: SubtitleMode;
  speed?: number;
  chromaKey?: Partial<ChromaKey>;
  stabilization?: Partial<ClipStabilization>;
  frameInterpolation?: Partial<ClipFrameInterpolation>;
  masks?: ClipMask[];
  sequenceFrameRate?: number;
  colorCorrection?: Partial<ColorCorrection>;
  transform?: Partial<Transform>;
  style?: Partial<TextStyle> | Partial<SubtitleStyle>;
};

export class UpdateClipCommand implements Command {
  readonly description = 'Update clip';
  private before?: Clip;
  private after?: Clip;

  constructor(private readonly accessor: TimelineAccessor, private readonly clipId: string, private readonly patch: ClipPatch) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const nextSpeed = typeof this.patch.speed === 'number' ? getClipSpeed({ speed: this.patch.speed }) : undefined;
    this.after = {
      ...this.before,
      ...this.patch,
      speed: nextSpeed ?? this.before.speed,
      colorCorrection: normalizeColorCorrection({ ...this.before.colorCorrection, ...this.patch.colorCorrection }),
      chromaKey: normalizeChromaKey({ ...this.before.chromaKey, ...this.patch.chromaKey }),
      stabilization: normalizeStabilization({ ...this.before.stabilization, ...this.patch.stabilization }),
      frameInterpolation: normalizeFrameInterpolation({ ...this.before.frameInterpolation, ...this.patch.frameInterpolation }),
      masks: this.patch.masks === undefined ? normalizeMasks(this.before.masks) : normalizeMasks(this.patch.masks),
      sequenceFrameRate: normalizeSequenceFrameRate(this.patch.sequenceFrameRate ?? this.before.sequenceFrameRate),
      transform: { ...this.before.transform, ...this.patch.transform }
    } as Clip;
    const speedKeyframesChanged = this.patch.keyframes !== undefined && (Boolean(this.before.keyframes?.speed?.length) || Boolean(this.patch.keyframes?.speed?.length));
    if (typeof nextSpeed === 'number' || speedKeyframesChanged) {
      this.after = {
        ...this.after,
        duration: getClipDisplayDuration(getClipSourceVisibleDuration(this.before), nextSpeed ?? this.after.speed, this.after.keyframes)
      } as Clip;
    }
    if ('style' in this.before || this.patch.style) {
      this.after = {
        ...this.after,
        style: { ...('style' in this.before ? this.before.style : {}), ...this.patch.style }
      } as Clip;
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
  params?: Record<string, number>;
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

function cloneClipForNestedSequence<TClip extends Clip>(clip: TClip): TClip {
  const cloned = {
    ...clip,
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    transform: { ...clip.transform },
    chromaKey: normalizeChromaKey(clip.chromaKey),
    stabilization: normalizeStabilization(clip.stabilization),
    frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
    masks: normalizeMasks(clip.masks),
    sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration),
    effects: cloneEffects(clip.effects)
  };
  if (clip.type === 'text' || clip.type === 'subtitle') {
    return { ...cloned, style: { ...clip.style } } as TClip;
  }
  return cloned as TClip;
}

function sortMarkers(markers: TimelineMarker[]): TimelineMarker[] {
  return [...markers].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
