import {
  createId,
  DEFAULT_SUBTITLE_STYLE,
  normalizeClipBeatMarkers,
  normalizeDetectedBpm,
  normalizeClipSceneCuts,
  normalizeClipKeyframes,
  replaceProjectActiveTimeline,
  type Clip,
  type ClipKeyframes,
  type ProtectedRange,
  type Timeline,
  type Track,
  type Transition,
} from '../model';
import {
  calculateSpeedCurveSourceDuration,
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
import { cloneEffects } from '../effects';
import { normalizeSubtitleStyleTemplateStyle } from '../subtitles/style-templates';
import { normalizeTimelineLabelColor, type TimelineLabelColor } from '../timeline-color-labels';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges } from '../timeline-protection';
import {
  buildCrossfadeGapFillTransition,
  buildRepeatedGapFillClip,
  findTimelineGapAtTime,
  type FillGapOperation,
} from '../timeline-gap-fill';
import { filterShortSceneCuts } from '../scene-cuts';
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
import {
  cloneClipKeyframes,
  normalizeClipKeyframes,
} from '../keyframes';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle, type CreditsRow, type CreditsStyle } from '../credits-roll';
import { normalizeMotionGraphic } from '../motion-graphics';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';
import { normalizeTextPath } from '../model';
import type { Command } from './command';
import {
  type TimelineAccessor,
  type LocalTimeRange,
  assertClipsNotOnLockedTrack,
  findTrack,
  findClip,
  findClipLocation,
  timelineHasOverlaps,
  buildKeptRanges,
  buildSplitRanges,
  replaceClipWithSlices,
  buildRollingTrimClips,
  getClipTotalSourceDuration,
  insertClip,
  clampTrimValues,
  closeTrackGap,
  findTrackGapAtTime,
  removeClipsFromTimeline,
  sortTimelineClips,
  insertGeneratedClips,
  replaceClipWithGeneratedClips,
} from './helpers';

export interface SlideClipEditResult {
  timeline: Timeline;
  leftClip: Clip;
  clip: Clip;
  rightClip: Clip;
  delta: number;
}

export function buildSlipClip<TClip extends Clip>(clip: TClip, requestedDelta: number): TClip {
  const speed = getClipSpeed(clip);
  const requestedSourceDelta =
    requestedDelta >= 0
      ? calculateSpeedCurveSourceDuration(requestedDelta, clip.keyframes, speed)
      : -calculateSpeedCurveSourceDuration(Math.abs(requestedDelta), clip.keyframes, speed);
  const sourceDelta = round(Math.min(clip.trimEnd, Math.max(-clip.trimStart, requestedSourceDelta)));
  const slipped = trimClip(clip, round(clip.trimStart + sourceDelta), round(clip.trimEnd - sourceDelta));
  return { ...slipped, start: clip.start, duration: clip.duration } as TClip;
}

export function buildSlideClipEdit(
  timeline: Timeline,
  clipId: string,
  requestedDelta: number,
  minDuration = 1 / 30,
): SlideClipEditResult {
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
  const leftMaxDuration = getClipDisplayDuration(
    Math.max(0, leftSourceDuration - left.trimStart),
    getClipSpeed(left),
    left.keyframes,
  );
  const rightMaxDuration = getClipDisplayDuration(
    Math.max(0, rightSourceDuration - right.trimEnd),
    getClipSpeed(right),
    right.keyframes,
  );
  const maxPositive = Math.max(0, Math.min(leftMaxDuration - left.duration, right.duration - minClipDuration));
  const maxNegative = -Math.max(0, Math.min(left.duration - minClipDuration, rightMaxDuration - right.duration));
  const delta = round(Math.min(maxPositive, Math.max(maxNegative, requestedDelta)));
  if (Math.abs(delta) <= 0.000001) {
    throw new Error('Slide edit has no available media at this position');
  }

  const nextLeftDuration = round(left.duration + delta);
  const nextRightDuration = round(right.duration - delta);
  const leftVisibleSourceDuration = calculateSpeedCurveSourceDuration(
    nextLeftDuration,
    left.keyframes,
    getClipSpeed(left),
  );
  const rightVisibleSourceDuration = calculateSpeedCurveSourceDuration(
    nextRightDuration,
    right.keyframes,
    getClipSpeed(right),
  );
  const nextLeft = trimClip(
    left,
    left.trimStart,
    round(Math.max(0, leftSourceDuration - left.trimStart - leftVisibleSourceDuration)),
  );
  const nextClip = moveClip(clip, round(clip.start + delta));
  const nextRight = {
    ...trimClip(
      right,
      round(Math.max(0, rightSourceDuration - right.trimEnd - rightVisibleSourceDuration)),
      right.trimEnd,
    ),
    start: round(right.start + delta),
  } as Clip;
  const byId = new Map([
    [nextLeft.id, nextLeft],
    [nextClip.id, nextClip],
    [nextRight.id, nextRight],
  ]);
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((item) =>
      item.id === track.id ? { ...item, clips: item.clips.map((itemClip) => byId.get(itemClip.id) ?? itemClip) } : item,
    ),
    transitions: timeline.transitions ?? [],
  };
  if (timelineHasOverlaps(nextTimeline)) {
    throw new Error('Clip overlaps another clip on this track');
  }
  return { timeline: nextTimeline, leftClip: nextLeft, clip: nextClip, rightClip: nextRight, delta };
}

function getClipTotalSourceDuration(clip: Clip): number {
  return round(Math.max(0, clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd));
}

export class AddClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Clip,
  ) {
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

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly clip: Extract<Clip, { type: 'adjustment' }>,
  ) {
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
          clips: [this.clip],
        },
      ],
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
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id),
    });
  }

export class AddMotionGraphicCommand implements Command {
  readonly description: string;
  private insertedTrack = false;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
    private readonly clip: Extract<Clip, { type: 'motion-graphic' }>,
  ) {
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
          clips: [this.clip],
        },
      ],
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
      tracks: timeline.tracks.filter((track) => track.id !== this.track.id),
    });
  }

export class AddSubtitleClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Extract<Clip, { type: 'subtitle' }>,
  ) {
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

export class AddCreditsClipCommand implements Command {
  readonly description: string;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clip: Extract<Clip, { type: 'credits' }>,
  ) {
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

export class BatchAddClipsCommand implements Command {
  readonly description = 'Batch add clips (AI rough cut)';
  private before?: Timeline;
  private after?: Timeline;
  private insertedTrackIds: string[] = [];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clips: Clip[],
    private readonly newTracks: Array<{ id: string; name: string; type: 'video' | 'audio' }>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const trackMap = new Map<string, Track>();
      for (const nt of this.newTracks) {
        if (!timeline.tracks.some((t) => t.id === nt.id)) {
          trackMap.set(nt.id, createTrack({ id: nt.id, type: nt.type, name: nt.name, clips: [] }));
          this.insertedTrackIds.push(nt.id);
        }
      }
      const newTracks = Array.from(trackMap.values());
      let updatedTimeline: Timeline =
        newTracks.length > 0 ? { ...timeline, tracks: [...timeline.tracks, ...newTracks] } : timeline;
      for (const clip of this.clips) {
        updatedTimeline = insertClip(updatedTimeline, clip);
      }
      this.after = updatedTimeline;
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
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
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
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
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const ids = Object.keys(this.newStartsByClipId);
    assertClipsNotOnLockedTrack(timeline, ids);
    this.before ??= ids.map((id) => findClip(timeline, id));
    const blocked = this.before.find(
      (clip) =>
        !canMoveClipWithProtectedRanges(clip, this.newStartsByClipId[clip.id] ?? clip.start, this.protectedRanges),
    );
    if (blocked) {
      throw new Error('Clip move is blocked by a protected range');
    }
    this.after = this.before.map((clip) => moveClip(clip, this.newStartsByClipId[clip.id] ?? clip.start));
    const movedById = new Map(this.after.map((clip) => [clip.id, clip]));
    const nextTimeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip),
      })),
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
        clips: track.clips.map((clip) => beforeById.get(clip.id) ?? clip),
      })),
    });
  }
}

export class BatchShiftClipsCommand implements Command {
  readonly description = 'Shift clips';
  private delegate?: MoveClipsCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly offsetsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    if (!this.delegate) {
      const timeline = this.accessor.getTimeline();
      const startsByClipId = Object.fromEntries(
        Object.entries(this.offsetsByClipId).map(([clipId, offset]) => {
          const clip = findClip(timeline, clipId);
          return [clipId, round(clip.start + offset)];
        }),
      );
      if (Object.keys(startsByClipId).length === 0) {
        throw new Error('No clips to shift');
      }
      this.delegate = new MoveClipsCommand(this.accessor, startsByClipId, this.protectedRanges);
    }
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
  }
}

export class BatchReorderClipsCommand implements Command {
  readonly description = 'Batch reorder clips';
  private delegate?: MoveClipsCommand;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly startsByClipId: Record<string, number>,
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    this.delegate ??= new MoveClipsCommand(this.accessor, this.startsByClipId, this.protectedRanges);
    this.delegate.execute();
  }

  undo(): void {
    this.delegate?.undo();
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
    private readonly maxDistance = 0.25,
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
          clips: track.clips.map((clip) =>
            startsByClipId.has(clip.id) ? moveClip(clip, startsByClipId.get(clip.id)!) : clip,
          ),
        })),
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
    private readonly options: BatchAlignToBeatOptions = {},
  ) {}

  get appliedUpdates(): BeatAlignmentUpdate[] {
    return this.updates ?? [];
  }

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      this.updates = calculateBeatAlignmentUpdates(
        timeline,
        this.clipIds,
        this.beatTimes,
        this.options.maxDistance ?? 0.05,
      );
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
              detectedBpm: normalizeDetectedBpm(clip.detectedBpm),
            } as Clip;
            if (syncSpeed && next.type === 'video') {
              const speedFrames = buildBeatSyncSpeedKeyframes(next, this.beatTimes);
              if (speedFrames.length > 0) {
                next = {
                  ...next,
                  keyframes: normalizeClipKeyframes({ ...(next.keyframes ?? {}), speed: speedFrames }, next.duration),
                } as Clip;
              }
            }
            return next;
          }),
        })),
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

export class SlipClipCommand implements Command {
  readonly description = 'Slip clip';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly delta: number,
  ) {}

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

export class SlideClipCommand implements Command {
  readonly description = 'Slide clip';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly delta: number,
    private readonly minDuration = 1 / 30,
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
    private readonly minDuration = 1 / 30,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
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

export class DeleteClipsCommand implements Command {
  readonly description = 'Delete clips';
  private removed: Array<{ clip: Clip; index: number; trackId: string }> = [];
  private removedTransitions: Transition[] = [];

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
  ) {}

  execute(): void {
    const uniqueIds = Array.from(new Set(this.clipIds));
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, uniqueIds);
    this.removed = uniqueIds.map((id) => findClipLocation(timeline, id));
    const ids = new Set(uniqueIds);
    // Save and remove transitions referencing deleted clips
    this.removedTransitions = (timeline.transitions ?? []).filter(
      (transition) => ids.has(transition.fromClipId) || ids.has(transition.toClipId),
    );
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) })),
      transitions: (timeline.transitions ?? []).filter(
        (transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId),
      ),
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
    // Restore removed transitions
    if (this.removedTransitions.length > 0) {
      timeline = {
        ...timeline,
        transitions: [...(timeline.transitions ?? []), ...this.removedTransitions],
      };
    }
    this.accessor.setTimeline(timeline);
  }

export class RippleDeleteCommand implements Command {
  readonly description = 'Ripple delete clips';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipIds: string[],
    private readonly protectedRanges: ProtectedRange[] = [],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const uniqueIds = Array.from(new Set(this.clipIds));
      if (uniqueIds.length === 0) {
        throw new Error('No clips selected for ripple delete');
      }
      assertClipsNotOnLockedTrack(timeline, uniqueIds);
      const ids = new Set(uniqueIds);
      const missingIds = uniqueIds.filter(
        (clipId) => !timeline.tracks.some((track) => track.clips.some((clip) => clip.id === clipId)),
      );
      if (missingIds.length > 0) {
        throw new Error(`Clip ${missingIds[0]} not found`);
      }
      this.after = {
        ...timeline,
        tracks: timeline.tracks.map((track) => rippleDeleteTrackClips(track, ids, this.protectedRanges)),
        transitions: (timeline.transitions ?? []).filter(
          (transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId),
        ),
      };
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }

export class CloseGapCommand implements Command {
  readonly description = 'Close timeline gap';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly time: number,
  ) {}

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
        tracks: timeline.tracks.map((item) =>
          item.id === this.trackId ? closeTrackGap(item, gap.start, gap.end) : item,
        ),
        transitions: timeline.transitions ?? [],
      };
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }

export class FillGapCommand implements Command {
  readonly description = 'Fill timeline gap';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly time: number,
    private readonly operation: FillGapOperation,
  ) {}

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
          duration: gap.duration,
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
            ...(timeline.transitions ?? []).filter(
              (item) => item.fromClipId !== transition.fromClipId || item.toClipId !== transition.toClipId,
            ),
            transition,
          ],
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

export class RollingTrimCommand implements Command {
  readonly description = 'Rolling trim';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly leftClipId: string,
    private readonly rightClipId: string,
    private readonly delta: number,
    private readonly minDuration = 1 / 30,
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
                clips: track.clips.map((clip) => (clip.id === left.id ? left : clip.id === right.id ? right : clip)),
              }
            : track,
        ),
        transitions: timeline.transitions ?? [],
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

export class DeleteClipCommand implements Command {
  readonly description = 'Delete clip';
  private removed?: Clip;
  private removedIndex = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
  ) {}

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

export class AddSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclip: Subclip,
  ) {
    this.description = `Add subclip "${subclip.name}"`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: [...(project.subclips ?? []), this.subclip],
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface SubclipPatch {
  name?: string;
  inPoint?: number;
  outPoint?: number;
  color?: TimelineLabelColor | null;
  description?: string;
}

export class UpdateSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
    private readonly patch: SubclipPatch,
  ) {
    this.description = `Update subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const subclips = (project.subclips ?? []).map((s) => {
      if (s.id !== this.subclipId) return s;
      return {
        ...s,
        ...(this.patch.name !== undefined ? { name: this.patch.name } : {}),
        ...(this.patch.inPoint !== undefined ? { inPoint: Math.max(0, this.patch.inPoint) } : {}),
        ...(this.patch.outPoint !== undefined ? { outPoint: Math.max(s.inPoint, this.patch.outPoint) } : {}),
        ...(this.patch.color !== undefined ? { color: this.patch.color } : {}),
        ...(this.patch.description !== undefined ? { description: this.patch.description } : {}),
      };
    });
    this.accessor.setProject({ ...project, subclips, updatedAt: new Date().toISOString() });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
  ) {
    this.description = `Delete subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: (project.subclips ?? []).filter((s) => s.id !== this.subclipId),
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }

export interface SubclipPatch {
  name?: string;
  inPoint?: number;
  outPoint?: number;
  color?: TimelineLabelColor | null;
  description?: string;
