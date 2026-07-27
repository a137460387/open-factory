import { type Clip, type Timeline, type Transition, type TransitionType } from './model';
export type GapFillStrategy = 'freeze-frame' | 'black' | 'white' | 'repeat' | 'crossfade';
export interface TimelineGap {
    trackId: string;
    start: number;
    end: number;
    duration: number;
    previousClip?: Clip;
    nextClip?: Clip;
}
export type FillGapOperation = {
    type: 'insert-clip';
    clip: Clip;
} | {
    type: 'repeat-previous';
    clipId?: string;
    name?: string;
} | {
    type: 'crossfade';
    transitionId?: string;
    transitionType?: TransitionType;
    duration?: number;
};
export declare function findTimelineGapAtTime(timeline: Timeline, trackId: string, time: number): TimelineGap | undefined;
export declare function buildGapFillCommandOperation(strategy: GapFillStrategy, options?: {
    clip?: Clip;
    transitionType?: TransitionType;
}): FillGapOperation;
export declare function createGapFillImageClip(input: {
    id?: string;
    name: string;
    mediaId: string;
    trackId: string;
    start: number;
    duration: number;
}): Extract<Clip, {
    type: 'image';
}>;
export declare function buildRepeatedGapFillClip(gap: TimelineGap, options?: {
    clipId?: string;
    name?: string;
}): Clip;
export declare function buildCrossfadeGapFillTransition(gap: TimelineGap, operation: Extract<FillGapOperation, {
    type: 'crossfade';
}>): Transition;
export declare function buildFreezeFrameFfmpegArgs(sourcePath: string, outputPath: string, sourceTime: number): string[];
export declare function buildSolidColorFrameFfmpegArgs(outputPath: string, color: string, width: number, height: number): string[];
export declare function normalizeGapFillFfmpegColor(color: string): string;
//# sourceMappingURL=timeline-gap-fill.d.ts.map