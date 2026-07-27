import type { TimelineMarker } from './model-types-primitives';
export declare const DEFAULT_SCENE_DETECTION_THRESHOLD = 10;
export declare const DEFAULT_MIN_SCENE_SECONDS = 1;
export declare const SCENE_DETECTION_MAX_SECONDS: number;
export declare const SCENE_CUT_MARKER_COLOR = "#f97316";
export interface SceneDetectionAnalysisLimit {
    analysisDuration: number;
    limited: boolean;
    maxDuration: number;
}
export type SceneMarkerInput = Omit<TimelineMarker, 'id'> & Partial<Pick<TimelineMarker, 'id'>>;
export declare function normalizeSceneCutTimes(cuts: readonly number[] | undefined, maxTime?: number): number[] | undefined;
export declare function mapSceneDetectThreshold(value: number | undefined): number;
export declare function buildScdetFilterArg(threshold: number | undefined): string;
export declare function filterShortSceneCuts(cuts: readonly number[], clipDuration: number, minSceneSeconds?: number): number[];
export declare function buildSceneMarkerInputs(cuts: readonly number[], clipStart?: number, options?: {
    idPrefix?: string;
    labelPrefix?: string;
    color?: string;
}): SceneMarkerInput[];
export declare function buildYoutubeChapterLines(markers: readonly Pick<TimelineMarker, 'time' | 'label'>[]): string[];
export declare function getSceneDetectionAnalysisLimit(clipDuration: number, maxDuration?: number): SceneDetectionAnalysisLimit;
export declare function estimateSceneCutCountForThreshold(previousCuts: readonly number[] | undefined, threshold: number | undefined, duration?: number): number;
//# sourceMappingURL=scene-cuts.d.ts.map