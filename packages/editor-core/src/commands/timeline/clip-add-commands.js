import { createTrack } from '../../model';
import { detectOverlap, removeClip } from '../../timeline';
import { findTrack, insertClip } from './utils';
export class AddClipCommand {
    accessor;
    clip;
    description;
    constructor(accessor, clip) {
        this.accessor = accessor;
        this.clip = clip;
        this.description = `Add clip ${clip.name}`;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        const track = findTrack(timeline, this.clip.trackId);
        if (detectOverlap(track, this.clip)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        this.accessor.setTimeline(insertClip(timeline, this.clip));
    }
    undo() {
        this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
    }
}
export class AddAdjustmentLayerCommand {
    accessor;
    track;
    clip;
    description;
    insertedTrack = false;
    constructor(accessor, track, clip) {
        this.accessor = accessor;
        this.track = track;
        this.clip = clip;
        this.description = `Add adjustment layer ${clip.name}`;
    }
    execute() {
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
    undo() {
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
export class AddMotionGraphicCommand {
    accessor;
    track;
    clip;
    description;
    insertedTrack = false;
    constructor(accessor, track, clip) {
        this.accessor = accessor;
        this.track = track;
        this.clip = clip;
        this.description = `Add motion graphic ${clip.name}`;
    }
    execute() {
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
    undo() {
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
export class AddCreditsClipCommand {
    accessor;
    clip;
    description;
    constructor(accessor, clip) {
        this.accessor = accessor;
        this.clip = clip;
        this.description = `Add credits clip ${clip.name}`;
    }
    execute() {
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
    undo() {
        this.accessor.setTimeline(removeClip(this.accessor.getTimeline(), this.clip.id).timeline);
    }
}
export class BatchAddClipsCommand {
    accessor;
    clips;
    newTracks;
    description = 'Batch add clips (AI rough cut)';
    before;
    after;
    insertedTrackIds = [];
    constructor(accessor, clips, newTracks) {
        this.accessor = accessor;
        this.clips = clips;
        this.newTracks = newTracks;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            const trackMap = new Map();
            for (const nt of this.newTracks) {
                if (!timeline.tracks.some((t) => t.id === nt.id)) {
                    trackMap.set(nt.id, createTrack({ id: nt.id, type: nt.type, name: nt.name, clips: [] }));
                    this.insertedTrackIds.push(nt.id);
                }
            }
            const newTracks = Array.from(trackMap.values());
            let updatedTimeline = newTracks.length > 0 ? { ...timeline, tracks: [...timeline.tracks, ...newTracks] } : timeline;
            for (const clip of this.clips) {
                updatedTimeline = insertClip(updatedTimeline, clip);
            }
            this.after = updatedTimeline;
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=clip-add-commands.js.map