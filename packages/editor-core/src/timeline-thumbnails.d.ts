import type { ClipKeyframes, Timeline } from './model';
import type { TimelineLabelColor } from './timeline-color-labels';
export declare const TIMELINE_THUMBNAIL_WIDTH = 80;
export declare const TIMELINE_THUMBNAIL_TRACK_HEIGHT = 48;
export declare const TIMELINE_THUMBNAIL_TRACK_MIN_SPACING_PX = 72;
export interface TimelineThumbnailSamplingInput {
    clipDuration: number;
    clipPixelWidth: number;
    thumbWidth?: number;
    trimStart?: number;
    speed?: number;
    keyframes?: ClipKeyframes;
}
export interface TimelineThumbnailCachePlan {
    hits: number[];
    misses: number[];
    keys: string[];
}
export interface TimelineThumbnailTrackSamplingInput {
    zoom: number;
    trackWidth: number;
    duration?: number;
    visibleStart?: number;
    visibleEnd?: number;
}
export interface TimelineThumbnailTrackSample {
    id: string;
    time: number;
    intervalSeconds: number;
    clipId?: string;
    mediaId?: string;
    sourceTimestamp?: number;
    trackColor?: TimelineLabelColor | null;
}
export declare function calculateTimelineThumbnailTimestamps(input: TimelineThumbnailSamplingInput): number[];
export declare function buildTimelineThumbnailCacheKey(mediaPath: string, timestamp: number): string;
export declare function planTimelineThumbnailCache(mediaPath: string, timestamps: number[], cachedKeys: ReadonlySet<string>): TimelineThumbnailCachePlan;
export declare function calculateTimelineThumbnailTrackInterval(input: Pick<TimelineThumbnailTrackSamplingInput, 'zoom' | 'trackWidth'>): number;
export declare function calculateTimelineThumbnailTrackTimestamps(input: TimelineThumbnailTrackSamplingInput): number[];
export declare function buildTimelineThumbnailTrackSamples(timeline: Timeline, input: TimelineThumbnailTrackSamplingInput): TimelineThumbnailTrackSample[];
export declare function sortTimelineThumbnailSamplesByPriority(samples: TimelineThumbnailTrackSample[], playheadTime: number): TimelineThumbnailTrackSample[];
//# sourceMappingURL=timeline-thumbnails.d.ts.map