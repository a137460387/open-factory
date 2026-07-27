import type { MediaAsset } from './model-types';
import type { AIRoughCutClip } from './ai-service';
export type AlgorithmStep = 'highlight' | 'scene' | 'silence' | 'dialogue';
export interface AlgorithmPipelineOptions {
    steps: AlgorithmStep[];
    highlight?: HighlightOptions;
    silence?: SilenceOptions;
}
export interface HighlightOptions {
    maxClips?: number;
    minDuration?: number;
    maxDuration?: number;
}
export interface SilenceOptions {
    minSilenceDuration?: number;
    paddingRatio?: number;
}
export declare function scoreMediaForHighlight(media: MediaAsset): number;
export declare function selectHighlightClips(media: MediaAsset[], options?: HighlightOptions): AIRoughCutClip[];
export declare function assembleBySceneOrder(media: MediaAsset[]): AIRoughCutClip[];
export declare function filterSilentFromMedia(media: MediaAsset[], options?: SilenceOptions): AIRoughCutClip[];
export declare function assembleByDialogue(media: MediaAsset[]): AIRoughCutClip[];
export declare function runAlgorithmPipeline(media: MediaAsset[], options: AlgorithmPipelineOptions): AIRoughCutClip[];
//# sourceMappingURL=algorithm-pipeline.d.ts.map