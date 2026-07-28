import type { Clip, Project } from './model';
export type TimelineSearchMediaFilter = 'all' | 'video' | 'audio' | 'image' | 'subtitle';
export type TimelineSearchEffectFilter = 'all' | 'has-effects' | 'no-effects';
export type TimelineSearchKeyframeFilter = 'all' | 'has-keyframes' | 'no-keyframes';
export type TimelineSearchResultKind = 'clip' | 'marker';
export interface TimelineSearchOptions {
    query: string;
    useRegex?: boolean;
    mediaFilter?: TimelineSearchMediaFilter;
    effectFilter?: TimelineSearchEffectFilter;
    keyframeFilter?: TimelineSearchKeyframeFilter;
}
export interface TimelineSearchResult {
    id: string;
    kind: TimelineSearchResultKind;
    label: string;
    start: number;
    duration?: number;
    trackId?: string;
    trackName: string;
    clipId?: string;
    clipType?: Clip['type'];
    mediaId?: string;
    mediaName?: string;
    matchReasons: string[];
}
export interface TimelineSearchResponse {
    results: TimelineSearchResult[];
    error?: 'invalid-regex';
}
export interface TimelineSearchJump {
    playheadTime: number;
    selectedClipIds: string[];
}
export interface TimelineSearchMatcher {
    empty: boolean;
    matches(value: string | undefined): boolean;
}
export declare function searchTimeline(project: Project, options: TimelineSearchOptions): TimelineSearchResponse;
export declare function buildTimelineSearchMatcher(query: string, useRegex?: boolean): TimelineSearchMatcher | undefined;
export declare function clipPassesTimelineSearchFilters(clip: Clip, options: Pick<TimelineSearchOptions, 'mediaFilter' | 'effectFilter' | 'keyframeFilter'>): boolean;
export declare function createTimelineSearchJump(result: TimelineSearchResult): TimelineSearchJump;
//# sourceMappingURL=timeline-search.d.ts.map