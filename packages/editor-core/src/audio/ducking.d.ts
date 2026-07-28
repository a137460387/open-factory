import { type Clip, type Keyframe, type Timeline } from '../model';
export interface LoudnessSample {
    time: number;
    db: number;
    duration?: number;
}
export interface DuckingRegion {
    start: number;
    end: number;
    peakDb: number;
}
export interface DetectDuckingRegionsOptions {
    sampleDuration?: number;
    minRegionDuration?: number;
    mergeGap?: number;
}
export interface DuckingKeyframeOptions {
    targetRatio: number;
    attack: number;
    release: number;
    idPrefix?: string;
}
export interface DuckingKeyframePlan {
    clipId: string;
    keyframes: Keyframe<number>[];
}
export declare function peakToDb(peak: number, floorDb?: number): number;
export declare function detectDuckingRegions(samples: LoudnessSample[], thresholdDb: number, options?: DetectDuckingRegionsOptions): DuckingRegion[];
export declare function buildDuckingKeyframesForClip(clip: Clip, regions: DuckingRegion[], options: DuckingKeyframeOptions): Keyframe<number>[];
export declare function buildDuckingKeyframePlan(timeline: Timeline, backgroundTrackId: string, regions: DuckingRegion[], options: DuckingKeyframeOptions): DuckingKeyframePlan[];
//# sourceMappingURL=ducking.d.ts.map