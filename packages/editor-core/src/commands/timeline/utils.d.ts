import { ClipGroupBatchPatch } from '../../clip-groups';
import { ChromaKey, ClipKeyframes, Project, ProtectedRange, Timeline, Track } from '../../model';
import type { Clip, KeyframeProperty } from '../../model';
import { ReplaceableMediaClip } from './clip-edit-commands';
/**
 * Throws if any of the given clip IDs belong to a locked track.
 * Used by clip-modifying commands to prevent editing locked tracks.
 */
export declare function assertClipsNotOnLockedTrack(timeline: Timeline, clipIds: string[]): void;
export declare function insertClip(timeline: Timeline, clip: Clip, index?: number): Timeline;
export declare function findTrack(timeline: Timeline, trackId: string): Track;
export declare function findClip(timeline: Timeline, clipId: string): Clip;
export declare function findClipLocation(timeline: Timeline, clipId: string): {
    clip: Clip;
    trackId: string;
    index: number;
};
export declare function timelineHasOverlaps(timeline: Timeline): boolean;
export declare function getProjectActiveClipIds(project: Project): string[];
export declare function removeClipsFromTimeline(timeline: Timeline, ids: Set<string>): Timeline;
export declare function applyClipGroupBatchPatch(clip: Clip, patch: ClipGroupBatchPatch): Clip;
export interface LocalTimeRange {
    start: number;
    end: number;
}
export declare function normalizeLocalTimeRanges(ranges: LocalTimeRange[], maxDuration: number): LocalTimeRange[];
export declare function buildKeptRanges(duration: number, removedRanges: LocalTimeRange[]): LocalTimeRange[];
export declare function buildSplitRanges(duration: number, splitTimes: number[]): LocalTimeRange[];
export declare function sliceClipForLocalRange<TClip extends Clip>(clip: TClip, range: LocalTimeRange, nextStart: number): TClip;
export declare function sliceClipSceneCuts(cuts: number[] | undefined, offset: number, duration: number): number[] | undefined;
export declare function sliceClipKeyframes(keyframes: ClipKeyframes | undefined, offset: number, duration: number): ClipKeyframes | undefined;
export declare function replaceClipWithSlices(timeline: Timeline, clipId: string, ranges: LocalTimeRange[], rippleRemovedGaps: boolean): Timeline;
export declare function rippleDeleteTrackClips(track: Track, selectedIds: Set<string>, protectedRanges?: ProtectedRange[]): Track;
export declare function mergeTimelineIntervals(intervals: LocalTimeRange[]): LocalTimeRange[];
export declare function findTrackGapAtTime(track: Track, time: number): LocalTimeRange | undefined;
export declare function closeTrackGap(track: Track, gapStart: number, gapEnd: number): Track;
export declare function buildSlipClip<TClip extends Clip>(clip: TClip, requestedDelta: number): TClip;
export declare function getClipTotalSourceDuration(clip: Clip): number;
export declare function touchProject(project: Project): Project;
export declare function replaceClipWithGeneratedClips(timeline: Timeline, sourceClipId: string, clips: Clip[]): Timeline;
export declare function insertGeneratedClips(timeline: Timeline, clips: Clip[]): Timeline;
export declare function sortTimelineClips(timeline: Timeline): Timeline;
export declare function cloneCommandValue<T>(value: T): T;
export declare function asReplaceableMediaClip(clip: Clip): ReplaceableMediaClip;
export declare function isReplaceableMediaClip(clip: Clip): clip is ReplaceableMediaClip;
export declare function mergeChromaKeyPatch(before: ChromaKey | undefined, patch: Partial<ChromaKey> | undefined): ChromaKey;
export declare function isPiPVisualClip(clip: Clip): boolean;
export declare function clampTrimValues(clip: Clip, requestedTrimStart: number, requestedTrimEnd: number, minDuration: number): {
    trimStart: number;
    trimEnd: number;
};
export declare function applySpeedKeyframeDuration(before: Clip, after: Clip, property: KeyframeProperty): Clip;
//# sourceMappingURL=utils.d.ts.map