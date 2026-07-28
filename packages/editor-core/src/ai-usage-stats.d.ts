import type { AIUsageRecord } from './ai-service';
/** Extended record that includes which AI feature was used */
export interface AIFeatureUsageRecord extends AIUsageRecord {
    /** AIServiceType key or additional feature key */
    service: string;
}
export interface ProviderUsageStats {
    providerId: string;
    callCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCny: number;
}
export interface FeatureUsageStats {
    service: string;
    callCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCny: number;
}
export interface DailyUsagePoint {
    /** YYYY-MM-DD */
    date: string;
    callCount: number;
    totalCostCny: number;
}
export interface AIRecommendation {
    /** feature key to recommend */
    feature: string;
    /** i18n key for the recommendation reason */
    reasonKey: string;
}
export interface RecommendationRule {
    /** feature the user must have used */
    requiresFeature: string;
    /** feature to recommend (must NOT be in used set) */
    recommendFeature: string;
    /** i18n key for the reason */
    reasonKey: string;
}
/** Built-in recommendation rules */
export declare const RECOMMENDATION_RULES: RecommendationRule[];
/** Aggregate usage records by provider */
export declare function aggregateByProvider(records: AIUsageRecord[]): ProviderUsageStats[];
/** Aggregate feature-level records by service */
export declare function aggregateByFeature(records: AIFeatureUsageRecord[]): FeatureUsageStats[];
/** Build daily usage trend for the last N days, filling gaps with zeros */
export declare function aggregateDailyTrend(records: AIFeatureUsageRecord[], days?: number, now?: number): DailyUsagePoint[];
/** Generate recommendations based on used features (max 3) */
export declare function generateRecommendations(usedFeatures: string[], maxRecommendations?: number): AIRecommendation[];
/** Calculate total cost for the current calendar month */
export declare function calculateMonthlyCost(records: AIUsageRecord[], now?: number): number;
/** Check if monthly cost exceeds the user-set threshold */
export declare function checkCostAlert(records: AIUsageRecord[], thresholdCny: number, now?: number): boolean;
/** Get the set of unique features used from feature-level records */
export declare function getUsedFeatures(records: AIFeatureUsageRecord[]): string[];
//# sourceMappingURL=ai-usage-stats.d.ts.map