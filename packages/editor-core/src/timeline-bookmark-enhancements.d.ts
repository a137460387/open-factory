import type { BookmarkGroup, TimelineBookmark } from './model-types';
export declare const BOOKMARK_ANNOTATION_MAX_LENGTH = 50;
export declare const BOOKMARK_GROUP_DEFAULT_COLORS: string[];
export declare const DEFAULT_BOOKMARK_GROUP: BookmarkGroup;
export declare function createBookmarkGroup(input: {
    name: string;
    color?: string;
    collapsed?: boolean;
    sortOrder?: number;
    id?: string;
}): BookmarkGroup;
export declare function normalizeBookmarkAnnotationText(text: string | undefined): string | undefined;
export declare function groupBookmarks(bookmarks: TimelineBookmark[], groups: BookmarkGroup[]): Map<string, TimelineBookmark[]>;
export declare function calculateBookmarkNavDots(bookmarks: TimelineBookmark[], totalDuration: number, containerWidth: number, groups?: BookmarkGroup[]): Array<{
    id: string;
    left: number;
    color: string;
}>;
export declare function captureBookmarkThumbnail(bookmark: TimelineBookmark, thumbnailPath: string): TimelineBookmark;
export declare function applyBookmarkGroupCollapseState(groups: BookmarkGroup[], groupId: string, collapsed: boolean): BookmarkGroup[];
export declare function serializeBookmarkGroups(groups: BookmarkGroup[]): string;
export declare function parseBookmarkGroupsJson(json: string): BookmarkGroup[];
export declare function normalizeBookmarkGroupColor(color: string | undefined): string;
//# sourceMappingURL=timeline-bookmark-enhancements.d.ts.map