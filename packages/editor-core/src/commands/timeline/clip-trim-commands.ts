import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ProtectedRange, Timeline, Transition } from '../../model';
import type { Clip } from '../../model';
import { detectOverlap, findAdjacentTransitionClips, replaceClip, trimClip } from '../../timeline';
import { FillGapOperation, buildCrossfadeGapFillTransition, buildRepeatedGapFillClip, findTimelineGapAtTime } from '../../timeline-gap-fill';
import { Command } from '../command';
import { TimelineAccessor, assertClipsNotOnLockedTrack, buildSlipClip, clampTrimValues, closeTrackGap, findClip, findClipLocation, findTrack, findTrackGapAtTime, insertClip, rippleDeleteTrackClips, timelineHasOverlaps } from './utils';
import { buildRollingTrimClips, buildSlideClipEdit } from './utils-nested';

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
}
