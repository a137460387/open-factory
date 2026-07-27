import { createTrack, normalizeTrackCompressor, normalizeTrackEQ, normalizeTrackPan, normalizeTrackVolume } from '../../model';
import { findTrack } from './utils';
export class AddTrackCommand {
    accessor;
    track;
    description;
    index = -1;
    constructor(accessor, track) {
        this.accessor = accessor;
        this.track = track;
        this.description = `Add ${track.type} track`;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.index = timeline.tracks.length;
        this.accessor.setTimeline({ ...timeline, tracks: [...timeline.tracks, this.track] });
    }
    undo() {
        const timeline = this.accessor.getTimeline();
        this.accessor.setTimeline({ ...timeline, tracks: timeline.tracks.filter((track) => track.id !== this.track.id) });
    }
}
export class AddSpeakerDiarizationTracksCommand {
    accessor;
    tracks;
    description = 'Add speaker diarization tracks';
    before;
    constructor(accessor, tracks) {
        this.accessor = accessor;
        this.tracks = tracks;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        const existingIds = new Set(timeline.tracks.map((track) => track.id));
        const nextTracks = this.tracks.filter((track) => !existingIds.has(track.id));
        this.accessor.setTimeline({ ...timeline, tracks: [...timeline.tracks, ...nextTracks] });
    }
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
function applyTrackPatch(track, patch) {
    if (!patch) {
        return track;
    }
    return createTrack({
        ...track,
        ...patch,
        volume: patch.volume === undefined ? track.volume : normalizeTrackVolume(patch.volume),
        pan: patch.pan === undefined ? track.pan : normalizeTrackPan(patch.pan),
        eq: patch.eq === undefined ? track.eq : normalizeTrackEQ(patch.eq),
        compressor: patch.compressor === undefined ? track.compressor : normalizeTrackCompressor(patch.compressor),
    });
}
export class UpdateTrackCommand {
    accessor;
    trackId;
    patch;
    description = 'Update track';
    before;
    after;
    constructor(accessor, trackId, patch) {
        this.accessor = accessor;
        this.trackId = trackId;
        this.patch = patch;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findTrack(timeline, this.trackId);
        this.after = applyTrackPatch(this.before, this.patch);
        this.accessor.setTimeline({
            ...timeline,
            tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.after : track)),
        });
    }
    undo() {
        if (!this.before) {
            return;
        }
        const timeline = this.accessor.getTimeline();
        this.accessor.setTimeline({
            ...timeline,
            tracks: timeline.tracks.map((track) => (track.id === this.trackId ? this.before : track)),
        });
    }
}
export class BatchUpdateTrackCommand {
    accessor;
    options;
    description = 'Batch update tracks';
    before;
    after;
    constructor(accessor, options) {
        this.accessor = accessor;
        this.options = options;
    }
    execute() {
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
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
//# sourceMappingURL=track-commands.js.map