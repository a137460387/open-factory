import { type ProjectColorPipeline } from './color-pipeline';
import type { MediaAsset, Sequence, Timeline } from './model';
export declare const TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES: number;
export declare const TIMELINE_RENDER_CACHE_PRERENDER_SECONDS = 5;
export declare const TIMELINE_RENDER_CACHE_RETAIN_SECONDS = 10;
export interface TimelineRenderFrameKeyInput {
    timeline: Timeline;
    media: MediaAsset[];
    frame: number;
    fps: number;
    width: number;
    height: number;
    sequences?: Sequence[];
    activeSequenceId?: string;
    colorPipeline?: ProjectColorPipeline;
}
export interface TimelineRenderFrameRequest {
    frame: number;
    time: number;
    key: string;
}
export interface TimelineRenderRange {
    start: number;
    end: number;
}
export interface TimelineRenderFrameCacheEntry<TBitmap> {
    key: string;
    bitmap: TBitmap;
    time: number;
    duration: number;
    bytes: number;
    ts?: number;
}
export interface TimelineRenderFrameCacheSnapshot {
    ranges: TimelineRenderRange[];
    bytes: number;
    count: number;
}
export interface TimelineRenderFrameCacheOptions<TBitmap> {
    maxBytes?: number;
    disposeBitmap?: (bitmap: TBitmap) => void;
}
export declare class TimelineRenderFrameCache<TBitmap> {
    private readonly entries;
    private readonly maxBytes;
    private readonly disposeBitmap?;
    private bytes;
    private readonly heap;
    constructor(options?: TimelineRenderFrameCacheOptions<TBitmap>);
    get sizeBytes(): number;
    get size(): number;
    put(entry: TimelineRenderFrameCacheEntry<TBitmap>, now?: number): TimelineRenderFrameCacheSnapshot;
    get(key: string, now?: number): TBitmap | undefined;
    has(key: string): boolean;
    retainAround(playheadTime: number, retainSeconds?: number): TimelineRenderFrameCacheSnapshot;
    invalidateRange(start: number, end: number): TimelineRenderFrameCacheSnapshot;
    clear(): TimelineRenderFrameCacheSnapshot;
    snapshot(): TimelineRenderFrameCacheSnapshot;
    private pruneToBudget;
    private delete;
}
export declare function buildTimelineRenderFrameKey(input: TimelineRenderFrameKeyInput): string;
export declare function buildTimelineRenderFrameRequests(input: {
    timeline: Timeline;
    media: MediaAsset[];
    playheadTime: number;
    duration: number;
    fps: number;
    width: number;
    height: number;
    sequences?: Sequence[];
    activeSequenceId?: string;
    colorPipeline?: ProjectColorPipeline;
    beforeSeconds?: number;
    afterSeconds?: number;
}): TimelineRenderFrameRequest[];
export declare function getTimelineRenderInvalidationRanges(previous: Timeline, next: Timeline): TimelineRenderRange[];
export declare function mergeTimelineRenderRanges(ranges: TimelineRenderRange[]): TimelineRenderRange[];
//# sourceMappingURL=render-cache.d.ts.map