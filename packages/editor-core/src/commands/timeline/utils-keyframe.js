import { distributeKeyframeTimes } from '../../keyframes';
import { round } from '../../time';
import { findClip } from './utils';
export function uniqueKeyframeRefs(refs) {
    const seen = new Set();
    const output = [];
    for (const ref of refs) {
        const key = `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(ref);
    }
    return output;
}
export function groupKeyframeRefsByClip(refs) {
    const output = new Map();
    for (const ref of refs) {
        const group = output.get(ref.clipId) ?? [];
        group.push(ref);
        output.set(ref.clipId, group);
    }
    return output;
}
export function calculateKeyframeSelectionCenter(timeline, refs) {
    const absoluteTimes = refs.flatMap((ref) => {
        const clip = findClip(timeline, ref.clipId);
        const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
        return frame ? [clip.start + frame.time] : [];
    });
    if (absoluteTimes.length === 0) {
        return 0;
    }
    return round((Math.min(...absoluteTimes) + Math.max(...absoluteTimes)) / 2);
}
export function keyframeRefKey(ref) {
    return `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
}
export function calculateDistributedKeyframeTimeMap(timeline, refs) {
    const entries = refs.flatMap((ref) => {
        const clip = findClip(timeline, ref.clipId);
        const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
        return frame
            ? [
                {
                    ref,
                    clip,
                    frame: {
                        ...frame,
                        id: keyframeRefKey(ref),
                        time: clip.start + frame.time,
                    },
                },
            ]
            : [];
    });
    const distributed = distributeKeyframeTimes(entries.map((entry) => entry.frame));
    const distributedByKey = new Map(distributed.map((frame) => [frame.id, frame.time]));
    const output = new Map();
    for (const entry of entries) {
        const absoluteTime = distributedByKey.get(keyframeRefKey(entry.ref));
        if (absoluteTime === undefined) {
            continue;
        }
        output.set(keyframeRefKey(entry.ref), clampKeyframeTime(absoluteTime - entry.clip.start, entry.clip.duration));
    }
    return output;
}
export function getBatchAlignValue(timeline, refs, value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    for (const ref of refs) {
        const clip = findClip(timeline, ref.clipId);
        const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
        if (frame) {
            return frame.value;
        }
    }
    return 0;
}
export function getBatchEditedKeyframeTime(clip, frame, operation, center) {
    if (operation.type === 'shift') {
        const delta = Number.isFinite(operation.delta) ? operation.delta : 0;
        return clampKeyframeTime(frame.time + delta, clip.duration);
    }
    if (operation.type === 'scale-time') {
        const factor = Math.max(0.01, Number.isFinite(operation.factor) ? operation.factor : 1);
        const absoluteTime = clip.start + frame.time;
        return clampKeyframeTime(center + (absoluteTime - center) * factor - clip.start, clip.duration);
    }
    return frame.time;
}
export function clampKeyframeTime(time, duration) {
    return round(Math.min(Math.max(0, time), Math.max(0, duration)));
}
//# sourceMappingURL=utils-keyframe.js.map