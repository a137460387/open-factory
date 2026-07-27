import type { Clip, Timeline, Track } from './model';
export type SyncCompareAlignMode = 'start' | 'in' | 'manual';
export type SyncCompareSide = 'left' | 'right';
export interface SyncCompareClipRef {
    clip: Clip;
    track: Track;
    trackIndex: number;
    selectedIndex: number;
}
export interface SyncCompareOffsetOptions {
    mode: SyncCompareAlignMode;
    manualOffsetSeconds?: number;
}
export interface SyncComparePlaybackInput extends SyncCompareOffsetOptions {
    left: Clip;
    right: Clip;
    playheadTime: number;
    playing?: boolean;
    leftPaused?: boolean;
    rightPaused?: boolean;
    heldLeftTime?: number;
    heldRightTime?: number;
}
export interface SyncComparePlaybackState {
    leftTime: number;
    rightTime: number;
    leftPlaying: boolean;
    rightPlaying: boolean;
    offsetSeconds: number;
}
export declare function findSyncCompareClipRefs(timeline: Timeline, selectedClipIds: string[]): SyncCompareClipRef[];
export declare function calculateSyncCompareRightOffsetSeconds(left: Clip, right: Clip, options: SyncCompareOffsetOptions): number;
export declare function resolveSyncComparePlaybackState(input: SyncComparePlaybackInput): SyncComparePlaybackState;
export declare function clampClipDisplayTime(time: number, clip: Clip): number;
export declare function isSyncCompareVisualClip(clip: Clip): boolean;
//# sourceMappingURL=sync-compare.d.ts.map