import { DEFAULT_NESTED_SEQUENCE_NAME, normalizeStabilization, normalizeTransform, replaceProjectActiveTimeline } from '../../model';
import { removeClip, replaceClip, splitClip } from '../../timeline';
import { assertClipsNotOnLockedTrack, buildSplitRanges, findClip, findTrack, insertClip, replaceClipWithSlices } from './utils';
import { packNestedSequence } from './utils-nested';
export class PackNestedSequenceCommand {
    accessor;
    clipIds;
    sequenceName;
    description = 'Pack nested sequence';
    before;
    after;
    constructor(accessor, clipIds, sequenceName = DEFAULT_NESTED_SEQUENCE_NAME) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.sequenceName = sequenceName;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.after ??= packNestedSequence(this.before, this.clipIds, this.sequenceName);
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class SplitClipCommand {
    accessor;
    clipId;
    splitTime;
    description = 'Split clip';
    original;
    left;
    right;
    originalIndex = -1;
    constructor(accessor, clipId, splitTime) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.splitTime = splitTime;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        assertClipsNotOnLockedTrack(timeline, [this.clipId]);
        this.original ??= findClip(timeline, this.clipId);
        const track = findTrack(timeline, this.original.trackId);
        this.originalIndex = track.clips.findIndex((clip) => clip.id === this.clipId);
        [this.left, this.right] = splitClip(this.original, this.splitTime);
        const withoutOriginal = removeClip(timeline, this.original.id).timeline;
        this.accessor.setTimeline(insertClip(insertClip(withoutOriginal, this.left, this.originalIndex), this.right, this.originalIndex + 1));
    }
    undo() {
        if (!this.original || !this.left || !this.right) {
            return;
        }
        let timeline = removeClip(this.accessor.getTimeline(), this.left.id).timeline;
        timeline = removeClip(timeline, this.right.id).timeline;
        this.accessor.setTimeline(insertClip(timeline, this.original, this.originalIndex));
    }
}
export class SplitClipAtTimesCommand {
    accessor;
    clipId;
    splitTimes;
    description = 'Split clip at times';
    before;
    after;
    constructor(accessor, clipId, splitTimes) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.splitTimes = splitTimes;
    }
    execute() {
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
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
export class ApplyShakeStabilizationCommand {
    accessor;
    clipId;
    stabilizationUpdate;
    description = 'Apply shake stabilization';
    before;
    after;
    constructor(accessor, clipId, stabilizationUpdate) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.stabilizationUpdate = stabilizationUpdate;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const timeline = this.before.timeline;
            const clip = findClip(timeline, this.clipId);
            const prev = clip.stabilization ?? normalizeStabilization({});
            const updated = normalizeStabilization({
                ...prev,
                ...this.stabilizationUpdate,
                enabled: true,
                analyzed: true,
            });
            const updatedClip = { ...clip, stabilization: updated };
            this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before)
            this.accessor.setProject(this.before);
    }
}
export class ApplyPipPlacementCommand {
    accessor;
    clipId;
    suggestedCorner;
    description = 'Apply PiP placement suggestion';
    before;
    after;
    constructor(accessor, clipId, suggestedCorner) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.suggestedCorner = suggestedCorner;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const timeline = this.before.timeline;
            const clip = findClip(timeline, this.clipId);
            const currentTransform = clip.transform ?? normalizeTransform({});
            const updatedTransform = { ...currentTransform };
            switch (this.suggestedCorner) {
                case 'top-left':
                    updatedTransform.x = -0.5;
                    updatedTransform.y = 0.5;
                    break;
                case 'top-right':
                    updatedTransform.x = 0.5;
                    updatedTransform.y = 0.5;
                    break;
                case 'bottom-left':
                    updatedTransform.x = -0.5;
                    updatedTransform.y = -0.5;
                    break;
                case 'bottom-right':
                default:
                    updatedTransform.x = 0.5;
                    updatedTransform.y = -0.5;
                    break;
            }
            const updatedClip = { ...clip, transform: updatedTransform };
            this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before)
            this.accessor.setProject(this.before);
    }
}
export class ApplyPlatformFitCommand {
    accessor;
    suggestion;
    description = 'Apply platform fit suggestion';
    before;
    after;
    constructor(accessor, suggestion) {
        this.accessor = accessor;
        this.suggestion = suggestion;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const removedIds = new Set(this.suggestion.removedSegments.map((s) => s.clipId));
            let project = { ...this.before, platformFitSuggestion: this.suggestion };
            const timeline = project.timeline;
            const updatedTracks = timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => {
                    if (removedIds.has(clip.id)) {
                        return { ...clip, platformFitRemoved: true };
                    }
                    const { platformFitRemoved, ...rest } = clip;
                    return rest;
                }),
            }));
            project = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
            this.after = project;
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before)
            this.accessor.setProject(this.before);
    }
}
export class RestorePlatformFitClipCommand {
    accessor;
    clipId;
    description = 'Restore a platform-fit removed clip';
    before;
    after;
    constructor(accessor, clipId) {
        this.accessor = accessor;
        this.clipId = clipId;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            let project = this.before;
            if (project.platformFitSuggestion) {
                const kept = project.platformFitSuggestion.removedSegments.find((s) => s.clipId === this.clipId);
                if (kept) {
                    const newSuggestion = {
                        ...project.platformFitSuggestion,
                        removedSegments: project.platformFitSuggestion.removedSegments.filter((s) => s.clipId !== this.clipId),
                        keptSegments: [...project.platformFitSuggestion.keptSegments, kept].sort((a, b) => a.start - b.start),
                    };
                    project = { ...project, platformFitSuggestion: newSuggestion };
                }
            }
            const timeline = project.timeline;
            const updatedTracks = timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.id === this.clipId) {
                        const { platformFitRemoved, ...rest } = clip;
                        return rest;
                    }
                    return clip;
                }),
            }));
            this.after = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before)
            this.accessor.setProject(this.before);
    }
}
//# sourceMappingURL=clip-split-commands.js.map