export declare const PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD = 200;
export declare const PRERENDER_LOW_RES_WIDTH = 40;
export type ThumbnailPrerenderPriorityZone = 'visible' | 'nearby' | 'remaining';
export interface ThumbnailPrerenderTask {
    clipId: string;
    mediaPath: string;
    mediaId: string;
    timestamp: number;
    cacheKey: string;
    priority: number;
    zone: ThumbnailPrerenderPriorityZone;
}
export interface ThumbnailPrerenderPlan {
    tasks: ThumbnailPrerenderTask[];
    totalCount: number;
    cachedCount: number;
    lowResolution: boolean;
}
export interface ThumbnailPrerenderProgress {
    completed: number;
    total: number;
    fraction: number;
    active: boolean;
}
export interface PrerenderClipInput {
    clipId: string;
    mediaPath: string;
    mediaId: string;
    duration: number;
    clipPixelWidth: number;
    trimStart?: number;
    speed?: number;
}
export interface PrerenderVisibleRange {
    startTime: number;
    endTime: number;
    nearbyMargin?: number;
}
export declare function buildThumbnailPrerenderPlan(clips: PrerenderClipInput[], cachedKeys: ReadonlySet<string>, visibleRange?: PrerenderVisibleRange, thumbWidth?: number): ThumbnailPrerenderPlan;
export declare function buildThumbnailPrerenderProgress(completed: number, total: number): ThumbnailPrerenderProgress;
export declare function filterUncachedThumbnails(mediaPath: string, timestamps: number[], cachedKeys: ReadonlySet<string>): {
    uncachedTimestamps: number[];
    uncachedKeys: string[];
};
//# sourceMappingURL=timeline-prerender.d.ts.map