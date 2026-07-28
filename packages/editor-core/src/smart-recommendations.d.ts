import type { MediaAsset, Project, Timeline } from './model-types';
export type SmartRecommendationReasonCode = 'color-similar' | 'duration-fit' | 'type-match' | 'unused';
export interface SmartRecommendationReason {
    code: SmartRecommendationReasonCode;
    weight: number;
}
export interface SmartTimelineGap {
    id: string;
    trackId: string;
    trackName: string;
    start: number;
    end: number;
    duration: number;
}
export interface SmartTimelineContext {
    usedMediaIds: string[];
    usedTypes: MediaAsset['type'][];
    rhythmCutsPerMinute: number;
    averageClipDuration: number;
    colorHistogram: number[];
    gaps: SmartTimelineGap[];
}
export interface SmartSegmentRecommendation {
    id: string;
    assetId: string;
    assetName: string;
    assetType: MediaAsset['type'];
    duration: number;
    thumbnail?: string;
    score: number;
    colorSimilarity: number;
    durationScore: number;
    typeScore: number;
    reasons: SmartRecommendationReason[];
    gap?: SmartTimelineGap;
}
export interface SmartSegmentRecommendationOptions {
    histograms?: Record<string, readonly number[] | undefined>;
    maxRecommendations?: number;
    durationTolerance?: number;
    minGapDuration?: number;
}
export declare function calculateColorHistogramDistance(left: readonly number[], right: readonly number[]): number;
export declare function calculateColorHistogramSimilarity(left: readonly number[], right: readonly number[]): number;
export declare function durationMatchesGap(assetDuration: number, gapDuration: number, tolerance?: number): boolean;
export declare function calculateDurationMatchScore(assetDuration: number, gapDuration: number, tolerance?: number): number;
export declare function detectTimelineGaps(timeline: Timeline, minGapDuration?: number): SmartTimelineGap[];
export declare function buildSmartTimelineContext(project: Project, options?: SmartSegmentRecommendationOptions): SmartTimelineContext;
export declare function buildSmartSegmentRecommendations(project: Project, options?: SmartSegmentRecommendationOptions): SmartSegmentRecommendation[];
export declare function sortRecommendationsBySimilarity(recommendations: readonly SmartSegmentRecommendation[]): SmartSegmentRecommendation[];
//# sourceMappingURL=smart-recommendations.d.ts.map