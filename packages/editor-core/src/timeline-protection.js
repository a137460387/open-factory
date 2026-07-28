import { moveClip } from './timeline';
import { round } from './time';
const EPSILON = 0.000001;
export function intervalsOverlap(left, right) {
    return left.start < right.end - EPSILON && right.start < left.end - EPSILON;
}
export function intervalContains(container, child) {
    return child.start >= container.start - EPSILON && child.end <= container.end + EPSILON;
}
export function getClipProtectedRanges(clip, ranges) {
    const interval = { start: clip.start, end: round(clip.start + clip.duration) };
    return ranges.filter((range) => intervalsOverlap(interval, range));
}
export function canMoveClipWithProtectedRanges(clip, nextStart, ranges) {
    if (ranges.length === 0) {
        return true;
    }
    const currentRanges = getClipProtectedRanges(clip, ranges);
    const next = { start: round(Math.max(0, nextStart)), end: round(Math.max(0, nextStart) + clip.duration) };
    if (currentRanges.length > 0) {
        return currentRanges.some((range) => intervalContains(range, next));
    }
    return !ranges.some((range) => intervalsOverlap(next, range));
}
export function applyProtectedRippleDeleteToTrack(track, selectedIds, protectedRanges) {
    const removedIntervals = mergeIntervals(track.clips
        .filter((clip) => selectedIds.has(clip.id))
        .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration) })));
    if (removedIntervals.length === 0) {
        return track;
    }
    const stopTime = getRippleProtectedStopTime(removedIntervals, protectedRanges);
    return {
        ...track,
        clips: track.clips
            .filter((clip) => !selectedIds.has(clip.id))
            .map((clip) => {
            if (stopTime !== undefined && clip.start >= stopTime - EPSILON) {
                return clip;
            }
            const shift = removedIntervals.reduce((total, interval) => (clip.start >= interval.end - EPSILON ? total + interval.end - interval.start : total), 0);
            const nextStart = round(clip.start - shift);
            if (shift <= EPSILON || !canMoveClipWithProtectedRanges(clip, nextStart, protectedRanges)) {
                return clip;
            }
            return moveClip(clip, nextStart);
        }),
    };
}
export function getRippleProtectedStopTime(removedIntervals, protectedRanges) {
    const stops = protectedRanges.flatMap((range) => removedIntervals.some((interval) => interval.end <= range.start + EPSILON) ? [range.start] : []);
    return stops.length > 0 ? Math.min(...stops) : undefined;
}
function mergeIntervals(intervals) {
    const sorted = intervals
        .map((interval) => ({
        start: round(Math.max(0, Math.min(interval.start, interval.end))),
        end: round(Math.max(0, Math.max(interval.start, interval.end))),
    }))
        .filter((interval) => interval.end - interval.start > EPSILON)
        .sort((left, right) => left.start - right.start || left.end - right.end);
    const merged = [];
    for (const interval of sorted) {
        const previous = merged[merged.length - 1];
        if (previous && interval.start <= previous.end + EPSILON) {
            previous.end = round(Math.max(previous.end, interval.end));
        }
        else {
            merged.push({ ...interval });
        }
    }
    return merged;
}
//# sourceMappingURL=timeline-protection.js.map