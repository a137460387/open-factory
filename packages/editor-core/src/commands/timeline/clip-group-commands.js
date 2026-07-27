import { createClipGroup, normalizeClipGroups, removeClipIdsFromGroups } from '../../clip-groups';
import { replaceProjectActiveTimeline } from '../../model';
import { applyStyleToClip } from '../../style-transfer';
import { applyClipGroupBatchPatch, getProjectActiveClipIds, removeClipsFromTimeline, timelineHasOverlaps, touchProject } from './utils';
export class CreateClipGroupCommand {
    accessor;
    clipIds;
    options;
    description = 'Create clip group';
    before;
    group;
    constructor(accessor, clipIds, options = {}) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.options = options;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const activeClipIds = getProjectActiveClipIds(project);
        const uniqueClipIds = Array.from(new Set(this.clipIds)).filter((clipId) => activeClipIds.includes(clipId));
        this.group ??= createClipGroup({ ...this.options, clipIds: uniqueClipIds }, activeClipIds);
        const withoutGroupedClips = removeClipIdsFromGroups(project.clipGroups, this.group.clipIds);
        this.accessor.setProject(touchProject({
            ...project,
            clipGroups: normalizeClipGroups([...withoutGroupedClips, this.group], activeClipIds),
        }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateClipGroupCommand {
    accessor;
    groupId;
    patch;
    description = 'Update clip group';
    before;
    constructor(accessor, groupId, patch) {
        this.accessor = accessor;
        this.groupId = groupId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const activeClipIds = getProjectActiveClipIds(project);
        const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
        if (!groups.some((group) => group.id === this.groupId)) {
            throw new Error(`Clip group ${this.groupId} not found`);
        }
        this.accessor.setProject(touchProject({
            ...project,
            clipGroups: normalizeClipGroups(groups.map((group) => (group.id === this.groupId ? { ...group, ...this.patch } : group)), activeClipIds),
        }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UngroupCommand {
    accessor;
    groupId;
    description = 'Ungroup clips';
    before;
    constructor(accessor, groupId) {
        this.accessor = accessor;
        this.groupId = groupId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const activeClipIds = getProjectActiveClipIds(project);
        const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
        if (!groups.some((group) => group.id === this.groupId)) {
            throw new Error(`Clip group ${this.groupId} not found`);
        }
        this.accessor.setProject(touchProject({
            ...project,
            clipGroups: groups.filter((group) => group.id !== this.groupId),
        }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class DeleteGroupCommand {
    accessor;
    groupId;
    description = 'Delete clip group';
    before;
    constructor(accessor, groupId) {
        this.accessor = accessor;
        this.groupId = groupId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const activeClipIds = getProjectActiveClipIds(project);
        const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
        const group = groups.find((item) => item.id === this.groupId);
        if (!group) {
            throw new Error(`Clip group ${this.groupId} not found`);
        }
        const ids = new Set(group.clipIds);
        const timeline = removeClipsFromTimeline(project.timeline, ids);
        this.accessor.setProject(touchProject({
            ...replaceProjectActiveTimeline(project, timeline),
            clipGroups: groups.filter((item) => item.id !== group.id),
        }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class BatchUpdateClipGroupClipsCommand {
    accessor;
    groupId;
    patch;
    description = 'Batch update clip group clips';
    before;
    constructor(accessor, groupId, patch) {
        this.accessor = accessor;
        this.groupId = groupId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const activeClipIds = getProjectActiveClipIds(project);
        const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
        const group = groups.find((item) => item.id === this.groupId);
        if (!group) {
            throw new Error(`Clip group ${this.groupId} not found`);
        }
        const ids = new Set(group.clipIds);
        const nextTimeline = {
            ...project.timeline,
            tracks: project.timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => (ids.has(clip.id) ? applyClipGroupBatchPatch(clip, this.patch) : clip)),
            })),
        };
        if (timelineHasOverlaps(nextTimeline)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        this.accessor.setProject(touchProject({
            ...replaceProjectActiveTimeline(project, nextTimeline),
            clipGroups: groups,
        }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class ApplyStyleCommand {
    accessor;
    summary;
    options;
    description = 'Apply style transfer';
    before;
    constructor(accessor, summary, options) {
        this.accessor = accessor;
        this.summary = summary;
        this.options = options;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        const targetIds = this.options.clipIds?.length ? new Set(this.options.clipIds) : undefined;
        let applied = 0;
        const nextTimeline = {
            ...timeline,
            tracks: timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => {
                    if (targetIds && !targetIds.has(clip.id)) {
                        return clip;
                    }
                    applied += 1;
                    return applyStyleToClip(clip, this.summary, this.options);
                }),
            })),
        };
        if (targetIds && applied === 0) {
            throw new Error('No clips match style transfer target');
        }
        this.accessor.setTimeline(nextTimeline);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=clip-group-commands.js.map