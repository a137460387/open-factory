import type { Timeline } from './model-types';
export type TimelineHeatmapType = 'edit-density' | 'volume' | 'cut-frequency';
export type TimelineHeatmapColorScheme = 'warm' | 'cool' | 'mono';
export interface TimelineHeatmapSegment {
    start: number;
    end: number;
    value: number;
    normalized: number;
}
export interface TimelineHeatmapOptions {
    bucketSeconds?: number;
    duration?: number;
    samplesPerBucket?: number;
}
export declare function calculateEditDensityHeatmap(timeline: Timeline, options?: TimelineHeatmapOptions): TimelineHeatmapSegment[];
export declare function calculateVolumeHeatmap(timeline: Timeline, options?: TimelineHeatmapOptions): TimelineHeatmapSegment[];
export declare function calculateCutFrequencyHeatmap(timeline: Timeline, options?: TimelineHeatmapOptions): TimelineHeatmapSegment[];
export declare function calculateTimelineHeatmap(type: TimelineHeatmapType, timeline: Timeline, options?: TimelineHeatmapOptions): TimelineHeatmapSegment[];
//# sourceMappingURL=timeline-heatmap.d.ts.map