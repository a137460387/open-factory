import { DEFAULT_NESTED_SEQUENCE_NAME, createId, createMulticamClip, normalizeMulticamSequence, replaceProjectActiveTimeline } from '../../model';
import { addSwitchPoint, createMulticamSequenceProject } from '../../multicam';
import { round } from '../../time';
import { replaceClip } from '../../timeline';
import { findClip, insertClip, touchProject } from './utils';
import { cutMulticamClip, trimMulticamClip } from './utils-nested';
export class CreateMulticamSequenceCommand {
    accessor;
    clipIds;
    sequenceName;
    description = 'Create multicam sequence';
    before;
    after;
    resultClipId;
    resultSequenceId;
    constructor(accessor, clipIds, sequenceName = DEFAULT_NESTED_SEQUENCE_NAME) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.sequenceName = sequenceName;
    }
    get multicamClipId() {
        return this.resultClipId;
    }
    get sequenceId() {
        return this.resultSequenceId;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const result = createMulticamSequenceProject(this.before, this.clipIds, { sequenceName: this.sequenceName });
            this.after = result.project;
            this.resultClipId = result.multicamClipId;
            this.resultSequenceId = result.sequenceId;
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class CutMulticamClipCommand {
    accessor;
    clipId;
    sceneTime;
    angleId;
    description = 'Cut multicam clip';
    before;
    after;
    constructor(accessor, clipId, sceneTime, angleId) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.sceneTime = sceneTime;
        this.angleId = angleId;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.after ??= cutMulticamClip(this.before, this.clipId, this.sceneTime, this.angleId);
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class RecordAngleCutCommand {
    accessor;
    clipId;
    description = 'Record multicam angle cuts';
    before;
    after;
    cuts;
    constructor(accessor, clipId, cuts = []) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.cuts = cuts.map((cut) => ({ sceneTime: cut.sceneTime, angleId: cut.angleId }));
    }
    get cutCount() {
        return this.cuts.length;
    }
    record(sceneTime, angleId) {
        this.cuts.push({ sceneTime, angleId });
        this.applyCuts();
    }
    execute() {
        this.applyCuts();
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
    applyCuts() {
        this.before ??= this.accessor.getProject();
        this.after = this.cuts.reduce((project, cut) => cutMulticamClip(project, this.clipId, cut.sceneTime, cut.angleId), this.before);
        this.accessor.setProject(this.after);
    }
}
export class TrimMulticamSwitchCommand {
    accessor;
    clipId;
    switchId;
    frameDelta;
    fps;
    description = 'Trim multicam switch';
    before;
    after;
    constructor(accessor, clipId, switchId, frameDelta, fps) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.switchId = switchId;
        this.frameDelta = frameDelta;
        this.fps = fps;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.after ??= trimMulticamClip(this.before, this.clipId, this.switchId, this.frameDelta, this.fps);
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class ApplyMulticamAiCutSuggestionsCommand {
    accessor;
    clipId;
    suggestions;
    description = 'Apply AI multicam cut suggestions';
    before;
    after;
    constructor(accessor, clipId, suggestions) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.suggestions = suggestions;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const project = this.before;
            const clip = findClip(project.timeline, this.clipId);
            if (clip.type !== 'nested-sequence' || !clip.multicam) {
                throw new Error('Clip is not a multicam sequence');
            }
            const normalized = normalizeMulticamSequence(clip.multicam, clip.duration);
            if (!normalized) {
                throw new Error('Invalid multicam sequence');
            }
            const switchMap = new Map();
            for (const sw of normalized.switches) {
                switchMap.set(sw.time, { time: sw.time, angleId: sw.angleId });
            }
            for (const suggestion of this.suggestions) {
                const localTime = round(Math.min(clip.duration, Math.max(0, suggestion.time - clip.start + clip.trimStart)));
                switchMap.set(localTime, { time: localTime, angleId: suggestion.angleId });
            }
            const newSwitches = [...switchMap.values()]
                .sort((a, b) => a.time - b.time)
                .map((sw) => ({ id: createId('multicam-switch'), time: sw.time, angleId: sw.angleId }));
            const finalMc = normalizeMulticamSequence({ ...normalized, switches: newSwitches }, clip.duration);
            if (!finalMc) {
                throw new Error('Invalid multicam after merge');
            }
            const multicam = { ...clip.multicam, switches: finalMc.switches, aiCutSuggestions: this.suggestions };
            const updatedClip = { ...clip, multicam };
            this.after = replaceProjectActiveTimeline(project, replaceClip(project.timeline, updatedClip));
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class CreateMulticamClipCommand {
    accessor;
    trackId;
    angles;
    syncMode;
    syncReferenceAngle;
    start;
    duration;
    description = 'Create multicam clip';
    before;
    _result;
    constructor(accessor, trackId, angles, syncMode, syncReferenceAngle, start = 0, duration = 10) {
        this.accessor = accessor;
        this.trackId = trackId;
        this.angles = angles;
        this.syncMode = syncMode;
        this.syncReferenceAngle = syncReferenceAngle;
        this.start = start;
        this.duration = duration;
    }
    get result() {
        if (!this._result) {
            throw new Error('Command not executed');
        }
        return this._result;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this._result) {
            const clip = createMulticamClip(this.angles, this.syncMode, this.syncReferenceAngle);
            this._result = { ...clip, trackId: this.trackId, start: this.start, duration: this.duration };
        }
        const project = this.accessor.getProject();
        const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
        const timeline = syncedProject.timeline;
        const nextTimeline = insertClip(timeline, this._result);
        this.accessor.setProject(touchProject(replaceProjectActiveTimeline(syncedProject, nextTimeline)));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/**
 * 切换多机位角度命令（添加切换点）
 */
export class SwitchMulticamAngleCommand {
    accessor;
    clipId;
    time;
    targetAngle;
    transition;
    description = 'Switch multicam angle';
    before;
    after;
    constructor(accessor, clipId, time, targetAngle, transition = 'cut') {
        this.accessor = accessor;
        this.clipId = clipId;
        this.time = time;
        this.targetAngle = targetAngle;
        this.transition = transition;
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
            const newSwitchPoint = {
                time: this.time,
                targetAngle: this.targetAngle,
                transition: this.transition,
            };
            const updatedClip = { ...clip, switchPoints: addSwitchPoint(clip.switchPoints, newSwitchPoint) };
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
 * 删除切换点命令
 */
//# sourceMappingURL=multicam-commands.js.map