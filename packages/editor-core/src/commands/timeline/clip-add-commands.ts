import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Clip, Timeline, Track, createTrack } from '../../model';
import { detectOverlap, removeClip } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor, findTrack, insertClip } from './utils';

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
}
