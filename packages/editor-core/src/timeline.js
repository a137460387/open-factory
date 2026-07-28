import { MIN_CLIP_SPEED, clampClipSpeed, createId, normalizeChromaKey, normalizeFrameInterpolation, normalizeMasks, normalizeMotionTrack, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeStabilization, normalizeTrackPan, normalizeTransitionDuration, } from './model';
import { cloneEffects } from './effects';
import { cloneClipKeyframes, interpolateKeyframes, normalizeClipKeyframes } from './keyframes';
import { normalizeMotionGraphic } from './motion-graphics';
import { DEFAULT_SNAP_GRID, round, snap } from './time';
const EPSILON = 0.000001;
/** Maximum integration steps for speed curve duration calculation. */
export const SPEED_CURVE_INTEGRATION_STEPS = 100;
/**
 * Find the clip at the given time on a track.
 * @param track - Track to search
 * @param time - Time in seconds
 */
export function findClipAtTime(track, time) {
    return track.clips.find((clip) => time >= clip.start && time < clip.start + clip.duration);
}
/**
 * Get all active clips across all renderable tracks at the given time.
 * @param timeline - Timeline instance
 * @param time - Time in seconds
 */
export function getActiveClipsAtTime(timeline, time) {
    return getRenderableTracks(timeline).flatMap((track) => track.clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration));
}
/**
 * Split a clip at the given time into two clips.
 * @param clip - Clip to split
 * @param splitTime - Time in seconds where to split (must be within clip bounds)
 * @returns Tuple of [left clip, right clip]
 */
export function splitClip(clip, splitTime) {
    const speed = getClipSpeed(clip);
    const clipEnd = clip.start + clip.duration;
    if (splitTime <= clip.start + EPSILON || splitTime >= clipEnd - EPSILON) {
        throw new RangeError('splitTime must be inside the clip bounds');
    }
    const leftDuration = round(splitTime - clip.start);
    const rightDuration = round(clip.duration - leftDuration);
    const sourceVisibleDuration = getClipSourceVisibleDuration(clip);
    const leftSourceDuration = calculateSpeedCurveSourceDuration(leftDuration, clip.keyframes, speed);
    const rightSourceDuration = round(Math.max(0, sourceVisibleDuration - leftSourceDuration));
    const left = {
        ...clip,
        id: createId('clip'),
        duration: leftDuration,
        trimEnd: round(clip.trimEnd + rightSourceDuration),
        transform: { ...clip.transform },
        chromaKey: normalizeChromaKey(clip.chromaKey),
        stabilization: normalizeStabilization(clip.stabilization),
        frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
        masks: normalizeMasks(clip.masks),
        motionTrack: normalizeMotionTrack(clip.motionTrack, leftDuration),
        sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), leftDuration),
        effects: cloneEffects(clip.effects),
        ...cloneMotionGraphicForDuration(clip, leftDuration),
    };
    const right = {
        ...clip,
        id: createId('clip'),
        start: round(splitTime),
        duration: rightDuration,
        trimStart: round(clip.trimStart + leftSourceDuration),
        transform: { ...clip.transform },
        chromaKey: normalizeChromaKey(clip.chromaKey),
        stabilization: normalizeStabilization(clip.stabilization),
        frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
        masks: normalizeMasks(clip.masks),
        motionTrack: normalizeMotionTrack(clip.motionTrack, rightDuration),
        sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
        keyframes: shiftClipKeyframes(cloneClipKeyframes(clip.keyframes), leftDuration, rightDuration),
        effects: cloneEffects(clip.effects),
        ...cloneMotionGraphicForDuration(clip, rightDuration),
    };
    return [left, right];
}
export function trimClip(clip, newTrimStart, newTrimEnd) {
    const speed = getClipSpeed(clip);
    const sourceDuration = Math.max(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd, 0);
    const trimStart = round(Math.max(0, newTrimStart));
    const trimEnd = round(Math.max(0, newTrimEnd));
    if (trimStart + trimEnd >= sourceDuration - EPSILON) {
        throw new RangeError('trim values leave no visible clip duration');
    }
    const duration = getClipDisplayDuration(sourceDuration - trimStart - trimEnd, speed, clip.keyframes);
    return {
        ...clip,
        trimStart,
        trimEnd,
        duration,
        transform: { ...clip.transform },
        chromaKey: normalizeChromaKey(clip.chromaKey),
        stabilization: normalizeStabilization(clip.stabilization),
        frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
        masks: normalizeMasks(clip.masks),
        motionTrack: normalizeMotionTrack(clip.motionTrack, duration),
        sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), duration),
        effects: cloneEffects(clip.effects),
        ...cloneMotionGraphicForDuration(clip, duration),
    };
}
export function moveClip(clip, newStart) {
    return {
        ...clip,
        start: round(Math.max(0, newStart)),
        transform: { ...clip.transform },
        chromaKey: normalizeChromaKey(clip.chromaKey),
        stabilization: normalizeStabilization(clip.stabilization),
        frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
        masks: normalizeMasks(clip.masks),
        motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
        sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
        keyframes: cloneClipKeyframes(clip.keyframes),
        effects: cloneEffects(clip.effects),
        ...cloneMotionGraphicForDuration(clip, clip.duration),
    };
}
export function detectOverlap(track, clip, excludeId) {
    const start = clip.start;
    const end = clip.start + clip.duration;
    return track.clips.some((other) => {
        if (other.id === clip.id || other.id === excludeId) {
            return false;
        }
        const otherStart = other.start;
        const otherEnd = other.start + other.duration;
        return start < otherEnd - EPSILON && otherStart < end - EPSILON;
    });
}
export function snapTime(time, grid = DEFAULT_SNAP_GRID) {
    return snap(time, grid);
}
export function getTimelineDuration(timeline) {
    return round(timeline.tracks.reduce((duration, track) => {
        const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
        return Math.max(duration, trackEnd);
    }, 0));
}
export function getTimelinePlaybackDuration(timeline) {
    return round(timeline.tracks.reduce((duration, track) => {
        let transitionOffset = 0;
        const clips = sortClipsByTime(track.clips);
        const trackEnd = clips.reduce((end, clip, index) => {
            const previous = clips[index - 1];
            const transition = previous ? findPairTransition(timeline.transitions ?? [], previous.id, clip.id) : undefined;
            if (previous && transition && areClipsAdjacent(previous, clip)) {
                transitionOffset = round(transitionOffset + clampTransitionDuration(transition.duration, previous, clip));
            }
            const playbackStart = round(clip.start - transitionOffset);
            return Math.max(end, playbackStart + clip.duration);
        }, 0);
        return Math.max(duration, trackEnd);
    }, 0));
}
export function getRenderableTracks(timeline) {
    const hasSolo = timeline.tracks.some((track) => Boolean(track.solo));
    return timeline.tracks.filter((track) => {
        if (track.muted) {
            return false;
        }
        return hasSolo ? Boolean(track.solo) : true;
    });
}
export function getTrackVolume(track) {
    return typeof track.volume === 'number' && Number.isFinite(track.volume) ? Math.min(2, Math.max(0, track.volume)) : 1;
}
export function getTrackPan(track) {
    return normalizeTrackPan(track.pan);
}
export function getTransitionMaxDuration(fromClip, toClip) {
    return round(Math.max(0, Math.min(fromClip.duration, toClip.duration) * 0.5));
}
export function clampTransitionDuration(duration, fromClip, toClip) {
    return round(Math.min(normalizeTransitionDuration(duration), getTransitionMaxDuration(fromClip, toClip)));
}
export function areClipsAdjacent(fromClip, toClip) {
    return Math.abs(fromClip.start + fromClip.duration - toClip.start) <= 0.001;
}
export function findAdjacentTransitionClips(timeline, fromClipId, toClipId) {
    for (const track of timeline.tracks) {
        const clips = sortClipsByTime(track.clips);
        const fromIndex = clips.findIndex((clip) => clip.id === fromClipId);
        const toIndex = clips.findIndex((clip) => clip.id === toClipId);
        if (fromIndex === -1 || toIndex === -1 || toIndex !== fromIndex + 1) {
            continue;
        }
        const fromClip = clips[fromIndex];
        const toClip = clips[toIndex];
        if (!areClipsAdjacent(fromClip, toClip)) {
            continue;
        }
        return { track, fromClip, toClip, fromIndex, toIndex };
    }
    return undefined;
}
export function getClipPlaybackStart(timeline, clipId) {
    for (const track of timeline.tracks) {
        const clips = sortClipsByTime(track.clips);
        let transitionOffset = 0;
        for (let index = 0; index < clips.length; index += 1) {
            const clip = clips[index];
            const previous = clips[index - 1];
            const transition = previous ? findPairTransition(timeline.transitions ?? [], previous.id, clip.id) : undefined;
            if (previous && transition && areClipsAdjacent(previous, clip)) {
                transitionOffset = round(transitionOffset + clampTransitionDuration(transition.duration, previous, clip));
            }
            if (clip.id === clipId) {
                return round(clip.start - transitionOffset);
            }
        }
    }
    return undefined;
}
export function getTransitionPlaybackWindow(timeline, transition) {
    const pair = findAdjacentTransitionClips(timeline, transition.fromClipId, transition.toClipId);
    if (!pair) {
        return undefined;
    }
    const duration = clampTransitionDuration(transition.duration, pair.fromClip, pair.toClip);
    if (duration <= 0) {
        return undefined;
    }
    const toPlaybackStart = getClipPlaybackStart(timeline, pair.toClip.id);
    if (toPlaybackStart === undefined) {
        return undefined;
    }
    return {
        start: toPlaybackStart,
        end: round(toPlaybackStart + duration),
        duration,
        fromClip: pair.fromClip,
        toClip: pair.toClip,
    };
}
export function getClipSpeed(clip) {
    return clampClipSpeed(clip.speed);
}
export function getClipSpeedAtTime(clip, localTime) {
    return getSpeedAtTime(clip.keyframes, localTime, getClipSpeed(clip));
}
export function hasSpeedKeyframes(keyframes) {
    return Boolean(keyframes?.speed?.length);
}
export function getClipSourceVisibleDuration(clip) {
    return calculateSpeedCurveSourceDuration(Math.max(0, clip.duration), clip.keyframes, getClipSpeed(clip));
}
export function getClipDisplayDuration(sourceVisibleDuration, speed, keyframes) {
    return calculateSpeedCurveDisplayDuration(sourceVisibleDuration, keyframes, getClipSpeed({ speed }));
}
export function setClipSpeed(clip, speed) {
    const nextSpeed = getClipSpeed({ speed });
    const duration = getClipDisplayDuration(getClipSourceVisibleDuration(clip), nextSpeed, clip.keyframes);
    return {
        ...clip,
        speed: nextSpeed,
        duration,
        transform: { ...clip.transform },
        chromaKey: normalizeChromaKey(clip.chromaKey),
        stabilization: normalizeStabilization(clip.stabilization),
        frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
        masks: normalizeMasks(clip.masks),
        motionTrack: normalizeMotionTrack(clip.motionTrack, duration),
        sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), duration),
        effects: cloneEffects(clip.effects),
        ...cloneMotionGraphicForDuration(clip, duration),
    };
}
function cloneMotionGraphicForDuration(clip, duration) {
    if (clip.type !== 'motion-graphic') {
        return {};
    }
    return { motionGraphic: normalizeMotionGraphic(clip.motionGraphic, duration) };
}
export function calculateSpeedCurveSourceDuration(displayDuration, keyframes, fallbackSpeed, steps = SPEED_CURVE_INTEGRATION_STEPS) {
    const duration = Math.max(0, displayDuration);
    const speed = getClipSpeed({ speed: fallbackSpeed });
    if (duration <= EPSILON) {
        return 0;
    }
    if (!hasSpeedKeyframes(keyframes)) {
        return round(duration * speed);
    }
    const sampleCount = Math.max(1, Math.round(steps));
    const stepDuration = duration / sampleCount;
    let sourceDuration = 0;
    for (let index = 0; index < sampleCount; index += 1) {
        const sampleTime = (index + 0.5) * stepDuration;
        sourceDuration += getSpeedAtTime(keyframes, sampleTime, speed) * stepDuration;
    }
    return round(sourceDuration);
}
export function calculateSpeedCurveDisplayDuration(sourceVisibleDuration, keyframes, fallbackSpeed, steps = SPEED_CURVE_INTEGRATION_STEPS) {
    const sourceDuration = Math.max(0, sourceVisibleDuration);
    const speed = getClipSpeed({ speed: fallbackSpeed });
    if (sourceDuration <= EPSILON) {
        return 0;
    }
    if (!hasSpeedKeyframes(keyframes)) {
        return round(sourceDuration / speed);
    }
    const lastKeyframeTime = Math.max(0, ...(keyframes?.speed ?? []).map((frame) => (Number.isFinite(frame.time) ? frame.time : 0)));
    let low = 0;
    let high = Math.max(sourceDuration / MIN_CLIP_SPEED, lastKeyframeTime, sourceDuration / speed, 1 / 30);
    while (calculateSpeedCurveSourceDuration(high, keyframes, speed, steps) < sourceDuration &&
        high < sourceDuration / MIN_CLIP_SPEED + lastKeyframeTime + 1) {
        high *= 2;
    }
    for (let index = 0; index < 32; index += 1) {
        const mid = (low + high) / 2;
        const integrated = calculateSpeedCurveSourceDuration(mid, keyframes, speed, steps);
        if (integrated < sourceDuration) {
            low = mid;
        }
        else {
            high = mid;
        }
    }
    return round(high);
}
function getSpeedAtTime(keyframes, localTime, fallbackSpeed) {
    return clampClipSpeed(interpolateKeyframes(keyframes?.speed, localTime, fallbackSpeed));
}
export function replaceClip(timeline, replacement) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => track.id === replacement.trackId
            ? {
                ...track,
                clips: track.clips.map((clip) => (clip.id === replacement.id ? replacement : clip)),
            }
            : track),
    };
}
export function removeClip(timeline, clipId) {
    let removed;
    let removedIndex = -1;
    let removedTrackId;
    const tracks = timeline.tracks.map((track) => {
        const index = track.clips.findIndex((clip) => clip.id === clipId);
        if (index === -1) {
            return track;
        }
        removed = track.clips[index];
        removedIndex = index;
        removedTrackId = track.id;
        return { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) };
    });
    return {
        timeline: {
            ...timeline,
            tracks,
            transitions: (timeline.transitions ?? []).filter((transition) => transition.fromClipId !== clipId && transition.toClipId !== clipId),
        },
        clip: removed,
        index: removedIndex,
        trackId: removedTrackId,
    };
}
function sortClipsByTime(clips) {
    return [...clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}
function findPairTransition(transitions, fromClipId, toClipId) {
    return transitions.find((transition) => transition.fromClipId === fromClipId && transition.toClipId === toClipId);
}
function shiftClipKeyframes(keyframes, offset, duration) {
    if (!keyframes) {
        return undefined;
    }
    const shifted = {};
    for (const property of Object.keys(keyframes)) {
        const frames = keyframes[property];
        if (frames?.length) {
            shifted[property] = frames.map((frame) => ({
                ...frame,
                time: round(Math.max(0, frame.time - offset)),
            }));
        }
    }
    return normalizeClipKeyframes(shifted, duration);
}
//# sourceMappingURL=timeline.js.map