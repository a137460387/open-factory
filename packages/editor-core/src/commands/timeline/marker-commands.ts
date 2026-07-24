import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Timeline, TimelineMarker, createTimelineMarker, normalizeTimelineMarker } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor } from './utils';
import { sortMarkers } from './utils-nested';

export interface AddTimelineMarkerInput {
  id?: string;
  time: number;
  label?: string;
  color?: string;
}

export class AddTimelineMarkerCommand implements Command {
  readonly description = 'Add timeline marker';
  private marker?: TimelineMarker;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: AddTimelineMarkerInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.marker ??= createTimelineMarker(this.input, getTimelineDuration(timeline));
    this.marker = normalizeTimelineMarker(this.marker, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers([...(timeline.markers ?? []), this.marker]),
    });
  }

  undo(): void {
    if (!this.marker) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.marker?.id),
    });
  }
}

export type TimelineMarkerPatch = Partial<Pick<TimelineMarker, 'time' | 'label' | 'color'>>;

export class UpdateTimelineMarkerCommand implements Command {
  readonly description = 'Update timeline marker';
  private before?: TimelineMarker;
  private after?: TimelineMarker;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly markerId: string,
    private readonly patch: TimelineMarkerPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= (timeline.markers ?? []).find((marker) => marker.id === this.markerId);
    if (!this.before) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.after = createTimelineMarker({ ...this.before, ...this.patch }, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers(
        (timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.after! : marker)),
      ),
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers(
        (timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.before! : marker)),
      ),
    });
  }
}

export class RemoveTimelineMarkerCommand implements Command {
  readonly description = 'Remove timeline marker';
  private removed?: TimelineMarker;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly markerId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.markers ?? []).findIndex((marker) => marker.id === this.markerId);
    if (this.index === -1) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.removed ??= (timeline.markers ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.markerId),
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
