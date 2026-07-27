import type { ExportRange, Timeline, TimelineBookmark, TimelineMarker } from './model-types';
export declare const TIMELINE_MINIMAP_WIDTH = 120;
export declare const TIMELINE_MINIMAP_MIN_VIEWPORT_HEIGHT = 12;
export interface TimelineMinimapViewportInput {
    scrollLeft: number;
    viewportWidth: number;
    labelWidth: number;
    zoom: number;
    duration: number;
    minimapHeight: number;
}
export interface TimelineMinimapViewportRect {
    y: number;
    height: number;
    start: number;
    end: number;
}
export interface TimelineMinimapScrollInput {
    y: number;
    viewportWidth: number;
    labelWidth: number;
    zoom: number;
    duration: number;
    minimapHeight: number;
    mode?: 'top' | 'center';
}
export interface TimelineMinimapClipRect {
    id: string;
    trackId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}
export interface TimelineMinimapTrackRect {
    id: string;
    x: number;
    width: number;
    color: string;
}
export interface TimelineMinimapMarkerLine {
    id: string;
    y: number;
    color: string;
    kind: 'marker' | 'bookmark' | 'export-range-start' | 'export-range-end';
}
export interface TimelineMinimapLayout {
    tracks: TimelineMinimapTrackRect[];
    clips: TimelineMinimapClipRect[];
    markers: TimelineMinimapMarkerLine[];
}
export declare function calculateTimelineMinimapViewportRect(input: TimelineMinimapViewportInput): TimelineMinimapViewportRect;
export declare function calculateTimelineScrollLeftFromMinimapY(input: TimelineMinimapScrollInput): number;
export declare function buildTimelineMinimapLayout(timeline: Timeline, options: {
    duration: number;
    width?: number;
    height: number;
    maxClips?: number;
    markers?: TimelineMarker[];
    bookmarks?: TimelineBookmark[];
    exportRanges?: Array<Pick<ExportRange, 'id' | 'start' | 'end'>>;
}): TimelineMinimapLayout;
//# sourceMappingURL=timeline-minimap.d.ts.map