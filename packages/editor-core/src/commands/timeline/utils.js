import { cloneEffects } from '../../effects';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../../keyframes';
import { createId, normalizeAudioFadeDuration, normalizeChromaKey, normalizeClipSceneCuts, normalizeColorCorrection, normalizeTrackVolume } from '../../model';
import { round } from '../../time';
import { calculateSpeedCurveSourceDuration, detectOverlap, getClipDisplayDuration, getClipSourceVisibleDuration, getClipSpeed, moveClip, removeClip, trimClip } from '../../timeline';
import { applyProtectedRippleDeleteToTrack } from '../../timeline-protection';
/**
 * Throws if any of the given clip IDs belong to a locked track.
 * Used by clip-modifying commands to prevent editing locked tracks.
 */
export function assertClipsNotOnLockedTrack(timeline, clipIds) {
    const ids = new Set(clipIds);
    for (const track of timeline.tracks) {
        if (track.locked && track.clips.some((clip) => ids.has(clip.id))) {
            throw new Error(`Cannot modify clips on locked track "${track.name || track.id}". Unlock the track first.`);
        }
    }
}
export function insertClip(timeline, clip, index) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            if (track.id !== clip.trackId) {
                return track;
            }
            const clips = [...track.clips];
            clips.splice(index ?? clips.length, 0, clip);
            return { ...track, clips };
        }),
    };
}
export function findTrack(timeline, trackId) {
    const track = timeline.tracks.find((item) => item.id === trackId);
    if (!track) {
        throw new Error(`Track ${trackId} not found`);
    }
    return track;
}
export function findClip(timeline, clipId) {
    const clip = timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    if (!clip) {
        throw new Error(`Clip ${clipId} not found`);
    }
    return clip;
}
export function findClipLocation(timeline, clipId) {
    for (const track of timeline.tracks) {
        const index = track.clips.findIndex((clip) => clip.id === clipId);
        if (index !== -1) {
            return { clip: track.clips[index], trackId: track.id, index };
        }
    }
    throw new Error(`Clip ${clipId} not found`);
}
export function timelineHasOverlaps(timeline) {
    return timeline.tracks.some((track) => track.clips.some((clip, index) => track.clips
        .slice(index + 1)
        .some((other) => clip.start < other.start + other.duration && other.start < clip.start + clip.duration)));
}
export function getProjectActiveClipIds(project) {
    return project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
}
export function removeClipsFromTimeline(timeline, ids) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) })),
        transitions: (timeline.transitions ?? []).filter((transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId)),
    };
}
export function applyClipGroupBatchPatch(clip, patch) {
    let next = {
        ...clip,
        colorCorrection: patch.colorCorrection
            ? normalizeColorCorrection({ ...clip.colorCorrection, ...patch.colorCorrection })
            : normalizeColorCorrection(clip.colorCorrection),
    };
    if (typeof patch.volume === 'number' && 'volume' in next) {
        next = { ...next, volume: normalizeTrackVolume(patch.volume) };
    }
    if (typeof patch.speed === 'number' &&
        (next.type === 'video' || next.type === 'audio' || next.type === 'nested-sequence')) {
        const speed = getClipSpeed({ speed: patch.speed });
        const duration = getClipDisplayDuration(getClipSourceVisibleDuration(clip), speed, next.keyframes);
        next = {
            ...next,
            speed,
            duration,
            fadeInDuration: normalizeAudioFadeDuration(next.fadeInDuration, duration),
            fadeOutDuration: normalizeAudioFadeDuration(next.fadeOutDuration, duration),
        };
    }
    return next;
}
export function normalizeLocalTimeRanges(ranges, maxDuration) {
    const duration = Math.max(0, maxDuration);
    const sorted = ranges
        .map((range) => ({
        start: round(Math.min(duration, Math.max(0, range.start))),
        end: round(Math.min(duration, Math.max(0, range.end))),
    }))
        .map((range) => ({ start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) }))
        .filter((range) => range.end - range.start > 0.000001)
        .sort((left, right) => left.start - right.start || left.end - right.end);
    const merged = [];
    for (const range of sorted) {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end + 0.000001) {
            previous.end = round(Math.max(previous.end, range.end));
        }
        else {
            merged.push({ ...range });
        }
    }
    return merged;
}
export function buildKeptRanges(duration, removedRanges) {
    const kept = [];
    let cursor = 0;
    for (const range of normalizeLocalTimeRanges(removedRanges, duration)) {
        if (range.start > cursor + 0.000001) {
            kept.push({ start: cursor, end: range.start });
        }
        cursor = Math.max(cursor, range.end);
    }
    if (cursor < duration - 0.000001) {
        kept.push({ start: cursor, end: duration });
    }
    return kept;
}
export function buildSplitRanges(duration, splitTimes) {
    const points = Array.from(new Set(splitTimes.map((time) => round(Math.min(duration, Math.max(0, time))))))
        .filter((time) => time > 0.000001 && time < duration - 0.000001)
        .sort((left, right) => left - right);
    const ranges = [];
    let cursor = 0;
    for (const point of points) {
        ranges.push({ start: cursor, end: point });
        cursor = point;
    }
    ranges.push({ start: cursor, end: duration });
    return ranges.filter((range) => range.end - range.start > 0.000001);
}
export function sliceClipForLocalRange(clip, range, nextStart) {
    const speed = getClipSpeed(clip);
    const pieceDuration = round(range.end - range.start);
    const sourceDuration = round(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd);
    const sourceRangeStart = calculateSpeedCurveSourceDuration(range.start, clip.keyframes, speed);
    const sourceRangeEnd = calculateSpeedCurveSourceDuration(range.end, clip.keyframes, speed);
    const pieceSourceDuration = round(Math.max(0, sourceRangeEnd - sourceRangeStart));
    const trimStart = round(clip.trimStart + sourceRangeStart);
    const trimEnd = round(Math.max(0, sourceDuration - trimStart - pieceSourceDuration));
    return {
        ...clip,
        id: createId('clip'),
        start: round(nextStart),
        duration: pieceDuration,
        trimStart,
        trimEnd,
        transform: { ...clip.transform },
        scenecuts: sliceClipSceneCuts(clip.scenecuts, range.start, pieceDuration),
        keyframes: sliceClipKeyframes(clip.keyframes, range.start, pieceDuration),
        effects: cloneEffects(clip.effects),
    };
}
export function sliceClipSceneCuts(cuts, offset, duration) {
    const localCuts = (cuts ?? [])
        .filter((time) => time > offset + 0.000001 && time < offset + duration - 0.000001)
        .map((time) => round(time - offset));
    return normalizeClipSceneCuts(localCuts, duration);
}
export function sliceClipKeyframes(keyframes, offset, duration) {
    const cloned = cloneClipKeyframes(keyframes);
    if (!cloned) {
        return undefined;
    }
    const sliced = {};
    for (const property of Object.keys(cloned)) {
        const frames = cloned[property]?.flatMap((frame) => {
            if (frame.time < offset - 0.000001 || frame.time > offset + duration + 0.000001) {
                return [];
            }
            return [{ ...frame, time: round(Math.max(0, frame.time - offset)) }];
        });
        if (frames?.length) {
            sliced[property] = frames;
        }
    }
    return normalizeClipKeyframes(sliced, duration);
}
export function replaceClipWithSlices(timeline, clipId, ranges, rippleRemovedGaps) {
    const { clip, trackId, index } = findClipLocation(timeline, clipId);
    const track = findTrack(timeline, trackId);
    let outputCursor = clip.start;
    const pieces = ranges.map((range) => {
        const start = rippleRemovedGaps ? outputCursor : clip.start + range.start;
        const piece = sliceClipForLocalRange(clip, range, start);
        outputCursor = round(outputCursor + piece.duration);
        return piece;
    });
    const clips = [...track.clips];
    clips.splice(index, 1, ...pieces);
    return {
        ...timeline,
        tracks: timeline.tracks.map((item) => (item.id === trackId ? { ...item, clips } : item)),
        transitions: (timeline.transitions ?? []).filter((transition) => transition.fromClipId !== clip.id && transition.toClipId !== clip.id),
    };
}
export function rippleDeleteTrackClips(track, selectedIds, protectedRanges = []) {
    if (protectedRanges.length > 0) {
        return applyProtectedRippleDeleteToTrack(track, selectedIds, protectedRanges);
    }
    const removedIntervals = mergeTimelineIntervals(track.clips
        .filter((clip) => selectedIds.has(clip.id))
        .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration) })));
    if (removedIntervals.length === 0) {
        return track;
    }
    return {
        ...track,
        clips: track.clips
            .filter((clip) => !selectedIds.has(clip.id))
            .map((clip) => {
            const shift = removedIntervals.reduce((total, interval) => (clip.start >= interval.end - 0.000001 ? total + interval.end - interval.start : total), 0);
            return shift > 0 ? moveClip(clip, round(clip.start - shift)) : clip;
        }),
    };
}
export function mergeTimelineIntervals(intervals) {
    const sorted = intervals
        .map((interval) => ({
        start: round(Math.max(0, Math.min(interval.start, interval.end))),
        end: round(Math.max(0, Math.max(interval.start, interval.end))),
    }))
        .filter((interval) => interval.end - interval.start > 0.000001)
        .sort((left, right) => left.start - right.start || left.end - right.end);
    const merged = [];
    for (const interval of sorted) {
        const previous = merged[merged.length - 1];
        if (previous && interval.start <= previous.end + 0.000001) {
            previous.end = round(Math.max(previous.end, interval.end));
        }
        else {
            merged.push({ ...interval });
        }
    }
    return merged;
}
export function findTrackGapAtTime(track, time) {
    const sortedClips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    const target = round(Math.max(0, time));
    let cursor = 0;
    for (const clip of sortedClips) {
        if (clip.start - cursor > 0.000001 && target >= cursor - 0.000001 && target <= clip.start + 0.000001) {
            return { start: round(cursor), end: round(clip.start) };
        }
        cursor = Math.max(cursor, clip.start + clip.duration);
    }
    return undefined;
}
export function closeTrackGap(track, gapStart, gapEnd) {
    const gapDuration = round(gapEnd - gapStart);
    return {
        ...track,
        clips: track.clips.map((clip) => clip.start >= gapEnd - 0.000001 ? moveClip(clip, round(clip.start - gapDuration)) : clip),
    };
}
export function buildSlipClip(clip, requestedDelta) {
    const speed = getClipSpeed(clip);
    const requestedSourceDelta = requestedDelta >= 0
        ? calculateSpeedCurveSourceDuration(requestedDelta, clip.keyframes, speed)
        : -calculateSpeedCurveSourceDuration(Math.abs(requestedDelta), clip.keyframes, speed);
    const sourceDelta = round(Math.min(clip.trimEnd, Math.max(-clip.trimStart, requestedSourceDelta)));
    const slipped = trimClip(clip, round(clip.trimStart + sourceDelta), round(clip.trimEnd - sourceDelta));
    return { ...slipped, start: clip.start, duration: clip.duration };
}
export function getClipTotalSourceDuration(clip) {
    return round(Math.max(0, clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd));
}
export function touchProject(project) {
    return { ...project, updatedAt: new Date().toISOString() };
}
export function replaceClipWithGeneratedClips(timeline, sourceClipId, clips) {
    const withoutSource = removeClip(timeline, sourceClipId).timeline;
    return insertGeneratedClips(withoutSource, clips);
}
export function insertGeneratedClips(timeline, clips) {
    let next = timeline;
    for (const clip of clips) {
        const track = findTrack(next, clip.trackId);
        if (track.clips.some((item) => item.id === clip.id)) {
            throw new Error(`Clip ${clip.id} already exists`);
        }
        if (detectOverlap(track, clip)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        next = insertClip(next, clip);
    }
    return sortTimelineClips(next);
}
export function sortTimelineClips(timeline) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
            ...track,
            clips: [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
        })),
    };
}
export function cloneCommandValue(value) {
    return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}
export function asReplaceableMediaClip(clip) {
    if (!isReplaceableMediaClip(clip)) {
        throw new Error('Media replacement requires a media clip');
    }
    return clip;
}
export function isReplaceableMediaClip(clip) {
    return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
}
export function mergeChromaKeyPatch(before, patch) {
    if (!patch) {
        return normalizeChromaKey(before);
    }
    if (patch.color && !patch.colors) {
        const current = normalizeChromaKey(before);
        return normalizeChromaKey({
            ...current,
            ...patch,
            colors: [patch.color, ...current.colors.slice(1)],
        });
    }
    return normalizeChromaKey({ ...before, ...patch });
}
export function isPiPVisualClip(clip) {
    return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}
export function clampTrimValues(clip, requestedTrimStart, requestedTrimEnd, minDuration) {
    const sourceDuration = Math.max(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd, 0);
    const minimumDuration = Math.max(0.001, minDuration);
    const maxCombinedTrim = Math.max(0, sourceDuration - minimumDuration);
    let trimStart = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimStart)));
    let trimEnd = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimEnd)));
    if (trimStart + trimEnd <= maxCombinedTrim) {
        return { trimStart, trimEnd };
    }
    const trimStartChanged = Math.abs(trimStart - clip.trimStart) >= Math.abs(trimEnd - clip.trimEnd);
    if (trimStartChanged) {
        trimStart = round(Math.max(0, maxCombinedTrim - trimEnd));
    }
    else {
        trimEnd = round(Math.max(0, maxCombinedTrim - trimStart));
    }
    return { trimStart, trimEnd };
}
export function applySpeedKeyframeDuration(before, after, property) {
    if (property !== 'speed') {
        return after;
    }
    const duration = getClipDisplayDuration(getClipSourceVisibleDuration(before), after.speed, after.keyframes);
    return {
        ...after,
        duration,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(after.keyframes), duration),
    };
}
//# sourceMappingURL=utils.js.map