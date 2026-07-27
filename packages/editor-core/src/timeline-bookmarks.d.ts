import { type TimelineBookmark, type TimelineMarker } from './model';
export interface TimelineBookmarkFile {
    version: 1;
    bookmarks: TimelineBookmark[];
}
export type TimelineNavigationPointType = 'bookmark' | 'marker';
export interface TimelineNavigationPoint {
    id: string;
    type: TimelineNavigationPointType;
    time: number;
    label: string;
}
export declare function serializeTimelineBookmarks(bookmarks: TimelineBookmark[], maxTime?: number): string;
export declare function parseTimelineBookmarksJson(contents: string, maxTime?: number): TimelineBookmark[];
export declare function mergeImportedTimelineBookmarks(existing: TimelineBookmark[], imported: TimelineBookmark[], maxTime?: number): TimelineBookmark[];
export declare function buildTimelineNavigationPoints(bookmarks: TimelineBookmark[] | undefined, markers: TimelineMarker[] | undefined, maxTime?: number): TimelineNavigationPoint[];
export declare function findTimelineNavigationPoint(points: TimelineNavigationPoint[], currentTime: number, direction: 'next' | 'previous'): TimelineNavigationPoint | undefined;
//# sourceMappingURL=timeline-bookmarks.d.ts.map