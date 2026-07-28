export interface SubtitleTimingInput {
    id: string;
    start: number;
    duration: number;
}
export interface SubtitleTimingUpdate {
    clipId: string;
    start: number;
    duration: number;
}
export interface SubtitleAlignmentOptions {
    maxDistance?: number;
    minDuration?: number;
}
export interface SubtitleAlignmentReport {
    correctedCount: number;
    averageOffsetMs: number;
    updates: SubtitleTimingUpdate[];
}
export declare function calculateSubtitleShiftUpdates(clips: SubtitleTimingInput[], offsetSeconds: number, projectDuration: number): SubtitleTimingUpdate[];
export declare function calculateSubtitleScaleUpdates(clips: SubtitleTimingInput[], scale: number, projectDuration: number, minDuration?: number): SubtitleTimingUpdate[];
export declare function findNearestSubtitlePeak(time: number, peakTimes: number[], maxDistance?: number): number | undefined;
export declare function calculateSubtitlePeakAlignUpdate(clip: SubtitleTimingInput, peakTimes: number[], projectDuration: number, maxDistance?: number): SubtitleTimingUpdate | undefined;
export declare function calculateSubtitleAlignmentUpdates(clips: SubtitleTimingInput[], peakTimes: number[], projectDuration: number, options?: SubtitleAlignmentOptions): SubtitleAlignmentReport;
export declare function calculateSubtitleBatchAdjustUpdates(clips: SubtitleTimingInput[], startDelta: number, endDelta: number, projectDuration: number, minDuration?: number): SubtitleTimingUpdate[];
//# sourceMappingURL=retiming.d.ts.map