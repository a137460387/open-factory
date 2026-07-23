import { createTrack, normalizeMasterVolume, normalizeTrackVolume, normalizeTrackPan, normalizeTrackEQ, normalizeTrackCompressor, type Project, type Track } from '../model';
import { clampTrackHeight } from '../track-height';
import type { Command } from './command';
import { type TimelineAccessor, type ProjectAccessor, findTrack, applyTrackPatch } from './helpers';

export class AddTrackCommand implements Command {
  readonly description: string;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly track: Track,
  ) {
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

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly tracks: Track[],
  ) {}

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

export type TrackPatch = Partial<
  Pick<
    Track,
    | 'name'
    | 'language'
    | 'subtitleType'
    | 'color'
    | 'muted'
    | 'solo'
    | 'locked'
    | 'volume'
    | 'pan'
    | 'eq'
    | 'compressor'
  >
>;

export interface BatchUpdateTrackCommandOptions {
  patches?: Record<string, TrackPatch>;
  order?: string[];
  deleteEmptyTrackIds?: string[];
}

export class UpdateTrackCommand implements Command {
  readonly description = 'Update track';
  private before?: Track;
  private after?: Track;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly trackId: string,
    private readonly patch: TrackPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findTrack(timeline, this.trackId);
    this.after = applyTrackPatch(this.before, this.patch);
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.after! : track)),
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.before! : track)),
    });
  }
}

export class BatchUpdateTrackCommand implements Command {
  readonly description = 'Batch update tracks';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly options: BatchUpdateTrackCommandOptions,
  ) {}

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
