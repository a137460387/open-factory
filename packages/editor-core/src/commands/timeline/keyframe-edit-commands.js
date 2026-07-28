import { alignKeyframeValues, applyBatchKeyframeEasing, cloneClipKeyframes, createKeyframe, normalizeClipKeyframes, removeKeyframeForProperty, setKeyframeForProperty } from '../../keyframes';
import { buildTextAnimationKeyframes, mergeTextAnimationKeyframes, normalizeTextAnimationDirection, normalizeTextAnimationDuration, normalizeTextAnimationPreset } from '../../text-animation';
import { detectOverlap, replaceClip } from '../../timeline';
import { applySpeedKeyframeDuration, findClip, findTrack } from './utils';
import { calculateDistributedKeyframeTimeMap, calculateKeyframeSelectionCenter, getBatchAlignValue, getBatchEditedKeyframeTime, groupKeyframeRefsByClip, keyframeRefKey, uniqueKeyframeRefs } from './utils-keyframe';
export class UpdateKeyframeCommand {
    accessor;
    clipId;
    property;
    keyframeId;
    patch;
    description = 'Update keyframe';
    before;
    after;
    constructor(accessor, clipId, property, keyframeId, patch) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.property = property;
        this.keyframeId = keyframeId;
        this.patch = patch;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const existing = this.before.keyframes?.[this.property]?.find((frame) => frame.id === this.keyframeId);
        if (!existing) {
            throw new Error(`Keyframe ${this.keyframeId} not found`);
        }
        const nextKeyframe = createKeyframe(this.property, {
            id: existing.id,
            time: this.patch.time ?? existing.time,
            value: this.patch.value ?? existing.value,
            easing: this.patch.easing ?? existing.easing,
            inHandle: this.patch.inHandle ?? existing.inHandle,
            outHandle: this.patch.outHandle ?? existing.outHandle,
            handleMode: this.patch.handleMode ?? existing.handleMode,
        }, this.before.duration);
        this.after = {
            ...this.before,
            keyframes: setKeyframeForProperty(this.before.keyframes, this.property, nextKeyframe, this.before.duration),
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
export class BatchKeyframeEditCommand {
    accessor;
    refs;
    operation;
    description;
    before;
    constructor(accessor, refs, operation, description = 'Batch edit keyframes') {
        this.accessor = accessor;
        this.refs = refs;
        this.operation = operation;
        this.description = description;
    }
    execute() {
        let timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        const refs = uniqueKeyframeRefs(this.refs);
        if (refs.length === 0) {
            return;
        }
        const center = this.operation.type === 'scale-time'
            ? (this.operation.center ?? calculateKeyframeSelectionCenter(timeline, refs))
            : 0;
        const distributedTimes = this.operation.type === 'distribute-time'
            ? calculateDistributedKeyframeTimeMap(timeline, refs)
            : new Map();
        const alignValue = this.operation.type === 'align-value' ? getBatchAlignValue(timeline, refs, this.operation.value) : undefined;
        const refsByClipId = groupKeyframeRefsByClip(refs);
        for (const [clipId, clipRefs] of refsByClipId) {
            const beforeClip = findClip(timeline, clipId);
            let keyframes = cloneClipKeyframes(beforeClip.keyframes);
            const touchedProperties = new Set();
            for (const ref of clipRefs) {
                const existing = keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId);
                if (!existing) {
                    throw new Error(`Keyframe ${ref.keyframeId} not found`);
                }
                touchedProperties.add(ref.property);
                if (this.operation.type === 'delete') {
                    keyframes = removeKeyframeForProperty(keyframes, ref.property, ref.keyframeId);
                    continue;
                }
                const nextTime = this.operation.type === 'distribute-time'
                    ? (distributedTimes.get(keyframeRefKey(ref)) ?? existing.time)
                    : getBatchEditedKeyframeTime(beforeClip, existing, this.operation, center);
                const nextValue = this.operation.type === 'align-value' ? alignKeyframeValues([existing], alignValue)[0].value : existing.value;
                const nextEasing = this.operation.type === 'easing'
                    ? applyBatchKeyframeEasing([existing], this.operation.easing)[0].easing
                    : existing.easing;
                keyframes = setKeyframeForProperty(keyframes, ref.property, createKeyframe(ref.property, {
                    id: existing.id,
                    time: nextTime,
                    value: nextValue,
                    easing: nextEasing,
                    inHandle: existing.inHandle,
                    outHandle: existing.outHandle,
                    handleMode: existing.handleMode,
                }, beforeClip.duration), beforeClip.duration);
            }
            let after = {
                ...beforeClip,
                keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
            };
            if (touchedProperties.has('speed')) {
                after = applySpeedKeyframeDuration(beforeClip, after, 'speed');
                if (detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
                    throw new Error('Clip overlaps another clip on this track');
                }
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
export class RemoveKeyframeCommand {
    accessor;
    clipId;
    property;
    keyframeId;
    description = 'Remove keyframe';
    before;
    after;
    constructor(accessor, clipId, property, keyframeId) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.property = property;
        this.keyframeId = keyframeId;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        if (!this.before.keyframes?.[this.property]?.some((frame) => frame.id === this.keyframeId)) {
            throw new Error(`Keyframe ${this.keyframeId} not found`);
        }
        this.after = {
            ...this.before,
            keyframes: removeKeyframeForProperty(this.before.keyframes, this.property, this.keyframeId),
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
export class ApplyTextAnimationCommand {
    accessor;
    clipId;
    input;
    description = 'Apply text animation';
    before;
    after;
    constructor(accessor, clipId, input) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        if (this.before.type !== 'text') {
            throw new Error('Text animation can only be applied to text clips');
        }
        const preset = normalizeTextAnimationPreset(this.input.preset);
        const direction = normalizeTextAnimationDirection(this.input.direction);
        const duration = normalizeTextAnimationDuration(this.input.duration);
        const generated = buildTextAnimationKeyframes({
            preset,
            direction,
            duration,
            clipDuration: this.before.duration,
            transform: this.before.transform,
            text: this.before.text,
        });
        this.after = {
            ...this.before,
            keyframes: mergeTextAnimationKeyframes(this.before.keyframes, generated, this.before.duration),
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
//# sourceMappingURL=keyframe-edit-commands.js.map