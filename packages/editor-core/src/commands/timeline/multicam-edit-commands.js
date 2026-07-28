import { replaceProjectActiveTimeline } from '../../model';
import { deleteSwitchPoint, updateSwitchPoint } from '../../multicam';
import { replaceClip } from '../../timeline';
import { findClip, touchProject } from './utils';
export class DeleteSwitchPointCommand {
    accessor;
    clipId;
    switchPointIndex;
    description = 'Delete switch point';
    before;
    after;
    constructor(accessor, clipId, switchPointIndex) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.switchPointIndex = switchPointIndex;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const project = this.accessor.getProject();
            const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
            const timeline = syncedProject.timeline;
            const clip = findClip(timeline, this.clipId);
            if (clip.type !== 'multicam') {
                throw new Error('Clip is not a MulticamClip');
            }
            const updatedClip = {
                ...clip,
                switchPoints: deleteSwitchPoint(clip.switchPoints, this.switchPointIndex),
            };
            this.after = touchProject(replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip)));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/**
 * 更新切换点命令
 */
export class UpdateSwitchPointCommand {
    accessor;
    clipId;
    switchPointIndex;
    updates;
    description = 'Update switch point';
    before;
    after;
    constructor(accessor, clipId, switchPointIndex, updates) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.switchPointIndex = switchPointIndex;
        this.updates = updates;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const project = this.accessor.getProject();
            const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
            const timeline = syncedProject.timeline;
            const clip = findClip(timeline, this.clipId);
            if (clip.type !== 'multicam') {
                throw new Error('Clip is not a MulticamClip');
            }
            const updatedClip = {
                ...clip,
                switchPoints: updateSwitchPoint(clip.switchPoints, this.switchPointIndex, this.updates),
            };
            this.after = touchProject(replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip)));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/**
 * 同步多机位片段命令（更新同步模式和机位偏移量）
 */
export class SyncMulticamClipCommand {
    accessor;
    clipId;
    syncMode;
    offsets;
    description = 'Sync multicam clip';
    before;
    after;
    constructor(accessor, clipId, syncMode, offsets) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.syncMode = syncMode;
        this.offsets = offsets;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const project = this.accessor.getProject();
            const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
            const timeline = syncedProject.timeline;
            const clip = findClip(timeline, this.clipId);
            if (clip.type !== 'multicam') {
                throw new Error('Clip is not a MulticamClip');
            }
            const updatedAngles = clip.angles.map((angle) => {
                const newOffset = this.offsets.get(angle.id);
                return newOffset !== undefined ? { ...angle, offset: newOffset } : angle;
            });
            const updatedClip = { ...clip, angles: updatedAngles, syncMode: this.syncMode };
            this.after = touchProject(replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip)));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/**
 * 更新多机位角度属性命令
 */
export class UpdateMulticamAngleCommand {
    accessor;
    clipId;
    angleIndex;
    updates;
    description = 'Update multicam angle';
    before;
    after;
    constructor(accessor, clipId, angleIndex, updates) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.angleIndex = angleIndex;
        this.updates = updates;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const project = this.accessor.getProject();
            const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
            const timeline = syncedProject.timeline;
            const clip = findClip(timeline, this.clipId);
            if (clip.type !== 'multicam') {
                throw new Error('Clip is not a MulticamClip');
            }
            if (this.angleIndex < 0 || this.angleIndex >= clip.angles.length) {
                throw new Error('Angle index out of range');
            }
            const updatedAngles = clip.angles.map((angle, index) => index === this.angleIndex ? { ...angle, ...this.updates } : angle);
            const updatedClip = { ...clip, angles: updatedAngles };
            this.after = touchProject(replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip)));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
// === 调色节点图命令 ===
//# sourceMappingURL=multicam-edit-commands.js.map