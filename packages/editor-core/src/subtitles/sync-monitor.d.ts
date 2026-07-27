import type { SubtitleClip, Track } from '../model-types';
export type SubtitleSyncSensitivity = 'strict' | 'standard' | 'loose';
export interface SubtitleSyncWarning {
    subtitleClipId: string;
    trackId: string;
    expectedStart: number;
    actualStart: number;
    offsetMs: number;
    severity: 'minor' | 'major';
}
export interface SubtitleSyncReport {
    totalSubtitles: number;
    alignedCount: number;
    warningCount: number;
    warnings: SubtitleSyncWarning[];
}
export interface SubtitleTimingReference {
    clipId: string;
    originalStart: number;
    originalDuration: number;
    originalSpeed: number;
    currentStart: number;
    currentDuration: number;
    currentSpeed: number;
}
export declare function getSensitivityThresholds(sensitivity: SubtitleSyncSensitivity): {
    minorMs: number;
    majorMs: number;
};
export declare function mapSensitivityLabel(label: string): SubtitleSyncSensitivity;
export declare function calculateClipTimingDelta(ref: SubtitleTimingReference): {
    startDelta: number;
    durationDelta: number;
    speedChanged: boolean;
};
export declare function detectSubtitleSyncOffset(subtitleClip: SubtitleClip, ref: SubtitleTimingReference): number;
export declare function shouldTriggerSyncWarning(offsetSeconds: number, sensitivity: SubtitleSyncSensitivity): boolean;
export declare function buildSyncWarning(subtitleClipId: string, trackId: string, offsetSeconds: number, expectedStart: number, sensitivity: SubtitleSyncSensitivity): SubtitleSyncWarning | undefined;
export declare function scanSubtitleTrackSync(subtitleClips: SubtitleClip[], subtitleTrackId: string, timingRefs: SubtitleTimingReference[], sensitivity?: SubtitleSyncSensitivity): SubtitleSyncReport;
export declare function batchScanSubtitleSync(tracks: Track[], timingRefs: SubtitleTimingReference[], sensitivity?: SubtitleSyncSensitivity): SubtitleSyncReport;
export declare function calculateSingleSubtitleRepair(subtitleClip: SubtitleClip, timingRef: SubtitleTimingReference, projectDuration: number): {
    start: number;
    duration: number;
} | undefined;
export declare function needsSyncRecheck(clipBefore: {
    start: number;
    duration: number;
    speed: number;
}, clipAfter: {
    start: number;
    duration: number;
    speed: number;
}): boolean;
//# sourceMappingURL=sync-monitor.d.ts.map