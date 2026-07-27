import { round } from './time';
export function findSyncCompareClipRefs(timeline, selectedClipIds) {
    if (selectedClipIds.length !== 2) {
        return [];
    }
    const selectedOrder = new Map(selectedClipIds.map((id, index) => [id, index]));
    const refs = timeline.tracks
        .flatMap((track, trackIndex) => track.clips.map((clip) => ({
        clip,
        track,
        trackIndex,
        selectedIndex: selectedOrder.get(clip.id),
    })))
        .filter((item) => item.selectedIndex !== undefined && isSyncCompareVisualClip(item.clip))
        .sort((left, right) => left.selectedIndex - right.selectedIndex);
    return refs.length === 2 ? refs : [];
}
export function calculateSyncCompareRightOffsetSeconds(left, right, options) {
    const startAlignedOffset = right.start - left.start;
    if (options.mode === 'in') {
        return round(startAlignedOffset + left.trimStart - right.trimStart);
    }
    if (options.mode === 'manual') {
        return round(startAlignedOffset + finiteOrZero(options.manualOffsetSeconds));
    }
    return round(startAlignedOffset);
}
export function resolveSyncComparePlaybackState(input) {
    const offsetSeconds = calculateSyncCompareRightOffsetSeconds(input.left, input.right, input);
    const liveLeftTime = clampClipDisplayTime(input.playheadTime - input.left.start, input.left);
    const liveRightTime = clampClipDisplayTime(input.playheadTime - input.right.start + offsetSeconds, input.right);
    return {
        leftTime: input.leftPaused ? clampClipDisplayTime(input.heldLeftTime ?? liveLeftTime, input.left) : liveLeftTime,
        rightTime: input.rightPaused
            ? clampClipDisplayTime(input.heldRightTime ?? liveRightTime, input.right)
            : liveRightTime,
        leftPlaying: (input.playing ?? true) && !input.leftPaused,
        rightPlaying: (input.playing ?? true) && !input.rightPaused,
        offsetSeconds,
    };
}
export function clampClipDisplayTime(time, clip) {
    return round(Math.min(Math.max(0, finiteOrZero(time)), Math.max(0, clip.duration)));
}
export function isSyncCompareVisualClip(clip) {
    return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}
function finiteOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
//# sourceMappingURL=sync-compare.js.map