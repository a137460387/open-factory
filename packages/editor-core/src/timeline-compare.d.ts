import type { Timeline } from './model';
export interface TimelineDiffRange {
    start: number;
    end: number;
}
export type TimelineVersionDiffType = 'track-added' | 'track-removed' | 'clip-added' | 'clip-deleted' | 'clip-modified' | 'clip-moved';
export interface TimelineVersionDiffField {
    field: string;
    before: unknown;
    after: unknown;
}
export interface TimelineVersionDiffItem {
    id: string;
    type: TimelineVersionDiffType;
    label: string;
    trackId?: string;
    clipId?: string;
    fields: TimelineVersionDiffField[];
}
export interface TimelineVersionDiffSummary {
    added: number;
    deleted: number;
    modified: number;
    trackChanges: number;
}
export interface TimelineVersionDiff {
    items: TimelineVersionDiffItem[];
    summary: TimelineVersionDiffSummary;
}
export type TimelineDiffNavigationDirection = 'previous' | 'next';
export declare function diffTimelineSnapshots(current: Timeline, snapshot: Timeline): TimelineDiffRange[];
export declare function diffTimelineVersions(before: Timeline, after: Timeline): TimelineVersionDiff;
export declare function applyTimelineVersionDiffSelection(target: Timeline, source: Timeline, selectedItemIds: readonly string[]): Timeline;
export declare function getTimelineVersionDiffNavigationIndex(items: readonly TimelineVersionDiffItem[], currentIndex: number, direction: TimelineDiffNavigationDirection): number;
export declare function calculateTimelineCompareScrollSync(sourceScrollLeft: number, sourceScrollWidth: number, sourceViewportWidth: number, targetScrollWidth: number, targetViewportWidth: number): number;
//# sourceMappingURL=timeline-compare.d.ts.map