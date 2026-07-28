import type { BeatMarker, Clip, Keyframe, Timeline } from './model-types';
export type BeatSensitivity = 'low' | 'medium' | 'high';
export type BeatGridDensity = 'beat' | 'measure' | 'four-measures';
export type { BeatMarker } from './model-types';
export interface RmsSample {
    time: number;
    rms: number;
}
export interface BeatSnapUpdate {
    clipId: string;
    from: number;
    to: number;
}
export interface RmsBeatDetectionOptions {
    windowSeconds?: number;
    threshold?: number;
    minGapSeconds?: number;
}
export interface BeatAlignmentUpdate {
    clipId: string;
    fromStart: number;
    toStart: number;
    fromEnd: number;
    toEnd: number;
    startError: number;
    endError: number;
}
export declare function createBeatMarker(time: number, id?: string): BeatMarker;
export declare function normalizeBeatMarkers(markers: BeatMarker[] | undefined, maxTime?: number): BeatMarker[];
export declare function detectRmsBeatPeaks(samples: RmsSample[], options?: RmsBeatDetectionOptions): number[];
export declare function detectBeatPeaks(samples: RmsSample[], sensitivity?: BeatSensitivity): number[];
export declare function estimateBpmFromBeatTimes(beatTimes: number[]): number | undefined;
export declare function estimateBpmFromBeatMarkers(markers: BeatMarker[] | undefined): number | undefined;
export declare function calculateBeatGridLines(beatTimes: number[], density?: BeatGridDensity): number[];
export declare function calculateBeatSnapUpdates(timeline: Timeline, clipIds: string[], beatTimes: number[], maxDistance?: number): BeatSnapUpdate[];
export declare function calculateBeatAlignmentUpdates(timeline: Timeline, clipIds: string[], beatTimes: number[], maxDistance?: number): BeatAlignmentUpdate[];
export declare function snapClipStartToBeat(clip: Clip, beatTimes: number[], maxDistance?: number): number;
export declare function calculateBeatSplitTimesForClip(clip: Clip, beatTimes: number[]): number[];
export declare function buildBeatSyncSpeedKeyframes(clip: Clip, beatTimes: number[]): Keyframe<number>[];
//# sourceMappingURL=beats.d.ts.map