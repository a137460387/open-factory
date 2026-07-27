import { createTimelineMarker, normalizeTimelineMarker } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { sortMarkers } from './utils-nested';
export class AddTimelineMarkerCommand {
    accessor;
    input;
    description = 'Add timeline marker';
    marker;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.marker ??= createTimelineMarker(this.input, getTimelineDuration(timeline));
        this.marker = normalizeTimelineMarker(this.marker, getTimelineDuration(timeline));
        this.accessor.setTimeline({
            ...timeline,
            markers: sortMarkers([...(timeline.markers ?? []), this.marker]),
        });
    }
    undo() {
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
export class UpdateTimelineMarkerCommand {
    accessor;
    markerId;
    patch;
    description = 'Update timeline marker';
    before;
    after;
    constructor(accessor, markerId, patch) {
        this.accessor = accessor;
        this.markerId = markerId;
        this.patch = patch;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= (timeline.markers ?? []).find((marker) => marker.id === this.markerId);
        if (!this.before) {
            throw new Error(`Timeline marker ${this.markerId} not found`);
        }
        this.after = createTimelineMarker({ ...this.before, ...this.patch }, getTimelineDuration(timeline));
        this.accessor.setTimeline({
            ...timeline,
            markers: sortMarkers((timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.after : marker))),
        });
    }
    undo() {
        if (!this.before) {
            return;
        }
        const timeline = this.accessor.getTimeline();
        this.accessor.setTimeline({
            ...timeline,
            markers: sortMarkers((timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.before : marker))),
        });
    }
}
export class RemoveTimelineMarkerCommand {
    accessor;
    markerId;
    description = 'Remove timeline marker';
    removed;
    index = -1;
    constructor(accessor, markerId) {
        this.accessor = accessor;
        this.markerId = markerId;
    }
    execute() {
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
    undo() {
        if (!this.removed) {
            return;
        }
        const timeline = this.accessor.getTimeline();
        const markers = [...(timeline.markers ?? [])];
        markers.splice(Math.max(0, this.index), 0, this.removed);
        this.accessor.setTimeline({ ...timeline, markers: sortMarkers(markers) });
    }
}
export class BatchAddMarkersCommand {
    accessor;
    inputs;
    description = 'Add timeline markers';
    before;
    markers;
    constructor(accessor, inputs) {
        this.accessor = accessor;
        this.inputs = inputs;
    }
    execute() {
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
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
//# sourceMappingURL=marker-commands.js.map