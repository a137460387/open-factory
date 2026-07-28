import { buildBeatSyncSpeedKeyframes, calculateBeatAlignmentUpdates, calculateBeatSnapUpdates } from '../../beats';
import { normalizeClipKeyframes } from '../../keyframes';
import { normalizeClipBeatMarkers, normalizeDetectedBpm } from '../../model';
import { round } from '../../time';
import { detectOverlap, moveClip, replaceClip } from '../../timeline';
import { canMoveClipWithProtectedRanges } from '../../timeline-protection';
import { assertClipsNotOnLockedTrack, findClip, findTrack, timelineHasOverlaps } from './utils';
export class MoveClipCommand {
    accessor;
    clipId;
    newStart;
    protectedRanges;
    description = 'Move clip';
    before;
    after;
    constructor(accessor, clipId, newStart, protectedRanges = []) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.newStart = newStart;
        this.protectedRanges = protectedRanges;
    }
    execute() {
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
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class MoveClipsCommand {
    accessor;
    newStartsByClipId;
    protectedRanges;
    description = 'Move clips';
    before;
    after;
    constructor(accessor, newStartsByClipId, protectedRanges = []) {
        this.accessor = accessor;
        this.newStartsByClipId = newStartsByClipId;
        this.protectedRanges = protectedRanges;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        const ids = Object.keys(this.newStartsByClipId);
        assertClipsNotOnLockedTrack(timeline, ids);
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
                clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip),
            })),
        };
        if (timelineHasOverlaps(nextTimeline)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        this.accessor.setTimeline(nextTimeline);
    }
    undo() {
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
export class BatchShiftClipsCommand {
    accessor;
    offsetsByClipId;
    protectedRanges;
    description = 'Shift clips';
    delegate;
    constructor(accessor, offsetsByClipId, protectedRanges = []) {
        this.accessor = accessor;
        this.offsetsByClipId = offsetsByClipId;
        this.protectedRanges = protectedRanges;
    }
    execute() {
        if (!this.delegate) {
            const timeline = this.accessor.getTimeline();
            const startsByClipId = Object.fromEntries(Object.entries(this.offsetsByClipId).map(([clipId, offset]) => {
                const clip = findClip(timeline, clipId);
                return [clipId, round(clip.start + offset)];
            }));
            if (Object.keys(startsByClipId).length === 0) {
                throw new Error('No clips to shift');
            }
            this.delegate = new MoveClipsCommand(this.accessor, startsByClipId, this.protectedRanges);
        }
        this.delegate.execute();
    }
    undo() {
        this.delegate?.undo();
    }
}
export class BatchReorderClipsCommand {
    accessor;
    startsByClipId;
    protectedRanges;
    description = 'Batch reorder clips';
    delegate;
    constructor(accessor, startsByClipId, protectedRanges = []) {
        this.accessor = accessor;
        this.startsByClipId = startsByClipId;
        this.protectedRanges = protectedRanges;
    }
    execute() {
        this.delegate ??= new MoveClipsCommand(this.accessor, this.startsByClipId, this.protectedRanges);
        this.delegate.execute();
    }
    undo() {
        this.delegate?.undo();
    }
}
export class SnapToBeatsCommand {
    accessor;
    clipIds;
    beatTimes;
    maxDistance;
    description = 'Snap clips to beats';
    before;
    after;
    updates;
    constructor(accessor, clipIds, beatTimes, maxDistance = 0.25) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.beatTimes = beatTimes;
        this.maxDistance = maxDistance;
    }
    get appliedUpdates() {
        return this.updates ?? [];
    }
    execute() {
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
                    clips: track.clips.map((clip) => startsByClipId.has(clip.id) ? moveClip(clip, startsByClipId.get(clip.id)) : clip),
                })),
            };
            if (timelineHasOverlaps(nextTimeline)) {
                throw new Error('Clip overlaps another clip on this track');
            }
            this.after = nextTimeline;
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class BatchAlignToBeatCommand {
    accessor;
    clipIds;
    beatTimes;
    options;
    description = 'Batch align clips to beats';
    before;
    after;
    updates;
    constructor(accessor, clipIds, beatTimes, options = {}) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.beatTimes = beatTimes;
        this.options = options;
    }
    get appliedUpdates() {
        return this.updates ?? [];
    }
    execute() {
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
                            detectedBpm: normalizeDetectedBpm(clip.detectedBpm),
                        };
                        if (syncSpeed && next.type === 'video') {
                            const speedFrames = buildBeatSyncSpeedKeyframes(next, this.beatTimes);
                            if (speedFrames.length > 0) {
                                next = {
                                    ...next,
                                    keyframes: normalizeClipKeyframes({ ...(next.keyframes ?? {}), speed: speedFrames }, next.duration),
                                };
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
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=clip-move-commands.js.map