import type { TransitionType } from './model-types';
import type { AiModuleResult, TranslateFn } from './ai-module-types';
export declare const CHI_SQUARE_BINS = 16;
export declare const CHI_SQUARE_THRESHOLD = 0.4;
export declare const MOTION_HIGH_THRESHOLD = 12;
export declare const MOTION_LOW_THRESHOLD = 3;
export interface TransitionClipFeatures {
    colorHist: number[];
    motionScore: number;
    sceneTag?: string;
}
export interface TransitionRecommendation {
    transitionType: TransitionType;
    duration: number;
    reason: string;
    confidence: number;
}
export interface TransitionRecommendationResult {
    recommended: TransitionRecommendation[];
}
export declare function calculateRGBHistogramChiSquareDistance(histA: readonly number[], histB: readonly number[]): number;
export declare function estimateMotionFromFrameDifferences(framePixels: readonly (readonly number[])[], width: number, height: number): number;
export declare function estimateMotionFromLumaDiffs(lumaDiffs: readonly number[]): number;
export declare function mapToValidTransitionType(type: string): TransitionType;
export declare function recommendTransition(clipA: TransitionClipFeatures, clipB: TransitionClipFeatures): TransitionRecommendationResult;
export declare function recommendTransitionSafe(clipA: TransitionClipFeatures, clipB: TransitionClipFeatures, t?: TranslateFn): Promise<AiModuleResult<TransitionRecommendationResult>>;
//# sourceMappingURL=ai-transition-recommend.d.ts.map