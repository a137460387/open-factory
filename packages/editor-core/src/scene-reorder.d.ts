import type { Timeline } from './model';
export type SceneReorderStrategy = 'brightness-asc' | 'brightness-desc' | 'color-similar' | 'motion-rhythm' | 'duration-balance';
export interface SceneFrameSample {
    pixels: Array<readonly [number, number, number]>;
    motionFromPrevious?: number;
    weight?: number;
}
export interface SceneClipFeatureInput {
    clipId: string;
    duration: number;
    frames: SceneFrameSample[];
}
export interface SceneClipFeatures {
    clipId: string;
    histogram: number[];
    brightness: number;
    motion: number;
    duration: number;
    analyzed: boolean;
}
export declare function extractSceneClipFeatures(input: SceneClipFeatureInput): SceneClipFeatures;
export declare function createFallbackSceneClipFeatures(input: {
    clipId: string;
    duration: number;
    brightness?: number;
    motion?: number;
    color?: readonly [number, number, number];
}): SceneClipFeatures;
export declare function orderSceneClipFeatures(features: SceneClipFeatures[], strategy: SceneReorderStrategy): SceneClipFeatures[];
export declare function buildSceneReorderClipIds(currentIds: string[], selectedIds: string[], orderedSelectedIds: string[]): string[];
export declare function buildSceneReorderStarts(timeline: Timeline, selectedClipIds: string[], orderedSelectedClipIds: string[]): Record<string, number>;
export declare function sceneHistogramDistance(left: SceneClipFeatures, right: SceneClipFeatures): number;
//# sourceMappingURL=scene-reorder.d.ts.map