import { cloneClipKeyframes, createKeyframe, normalizeClipKeyframes, normalizePastedKeyframes, setKeyframeForProperty } from '../../keyframes';
import { detectOverlap, replaceClip } from '../../timeline';
import { applySpeedKeyframeDuration, findClip, findTrack } from './utils';
export class PasteKeyframesCommand {
    accessor;
    input;
    description = 'Paste keyframes';
    before;
    after;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.input.targetClipId);
        const result = normalizePastedKeyframes(this.input.groups, this.before.start, this.before.duration, this.input.mode, this.input.targetProperty);
        let keyframes = cloneClipKeyframes(this.before.keyframes);
        for (const { property, keyframes: pasted } of result) {
            for (const kf of pasted) {
                keyframes = setKeyframeForProperty(keyframes, property, kf, this.before.duration);
            }
        }
        this.after = {
            ...this.before,
            keyframes: normalizeClipKeyframes(keyframes, this.before.duration),
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class AddKeyframeCommand {
    accessor;
    clipId;
    property;
    input;
    description = 'Add keyframe';
    before;
    after;
    keyframe;
    constructor(accessor, clipId, property, input) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.property = property;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        this.keyframe ??= createKeyframe(this.property, this.input, this.before.duration);
        this.after = {
            ...this.before,
            keyframes: setKeyframeForProperty(this.before.keyframes, this.property, this.keyframe, this.before.duration),
        };
        this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
        if (this.property === 'speed' &&
            detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)) {
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
export class BatchUpdateKeyframeCommand {
    accessor;
    updates;
    description;
    before;
    constructor(accessor, updates, description = 'Batch update keyframes') {
        this.accessor = accessor;
        this.updates = updates;
        this.description = description;
    }
    execute() {
        let timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        for (const update of this.updates) {
            const beforeClip = findClip(timeline, update.clipId);
            let keyframes = update.replace
                ? { ...(beforeClip.keyframes ?? {}), [update.property]: [] }
                : beforeClip.keyframes;
            for (const input of update.keyframes) {
                keyframes = setKeyframeForProperty(keyframes, update.property, createKeyframe(update.property, input, beforeClip.duration), beforeClip.duration);
            }
            let after = {
                ...beforeClip,
                keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
            };
            after = applySpeedKeyframeDuration(beforeClip, after, update.property);
            if (update.property === 'speed' && detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
                throw new Error('Clip overlaps another clip on this track');
            }
            timeline = replaceClip(timeline, after);
        }
        this.accessor.setTimeline(timeline);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=keyframe-commands.js.map