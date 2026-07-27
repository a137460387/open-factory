import { type EffectType } from '../effects';
import { type Project, type Timeline } from '../model';
import type { ExportSettings } from './export-types';
export type ExportCostCpuLoad = 'light' | 'medium' | 'heavy';
export interface ExportCostHistorySample {
    timelineDurationSeconds?: number;
    exportDurationSeconds: number;
    estimatedDurationSeconds?: number;
}
export interface ExportCostFactorBreakdown {
    id: string;
    factor: number;
    weight: number;
}
export interface ExportCostEstimateInput {
    project: Project;
    settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
    now?: Date | string | number;
    history?: ExportCostHistorySample[];
    qualityEvaluation?: boolean;
}
export interface ExportCostEstimate {
    timelineDurationSeconds: number;
    estimatedDurationSeconds: number;
    estimatedFileSizeMb: number;
    cpuLoad: ExportCostCpuLoad;
    estimatedCompletionIso: string;
    complexityFactor: number;
    factorBreakdown: ExportCostFactorBreakdown[];
    lastErrorPercent?: number;
}
export declare const NO_EFFECT_COMPLEXITY_FACTOR = 1;
export declare const COLOR_CORRECTION_COMPLEXITY_FACTOR = 1.3;
export declare const VMAF_QUALITY_COMPLEXITY_FACTOR = 2.5;
export declare const EXPORT_COST_EFFECT_COMPLEXITY_FACTORS: Record<EffectType, number>;
export type EstimateConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';
export interface ExportEstimateConfidence {
    level: EstimateConfidenceLevel;
    sampleCount: number;
    label: string;
}
export interface ExportEstimateHistoryComparisonEntry {
    id: string;
    estimatedSeconds: number;
    actualSeconds: number;
    errorPercent: number;
    timestamp?: string;
}
export interface LearnedComplexityCoefficient {
    effectType: string;
    defaultFactor: number;
    learnedFactor: number;
    sampleCount: number;
}
export declare function calculateEstimateConfidence(sampleCount: number): ExportEstimateConfidence;
export declare function buildEstimateHistoryComparison(samples: ExportCostHistorySample[]): ExportEstimateHistoryComparisonEntry[];
export declare function learnComplexityCoefficients(historySamples: ExportCostHistorySample[], currentFactors?: Record<string, number>): LearnedComplexityCoefficient[];
export declare function applyLearnedCoefficients(learned: LearnedComplexityCoefficient[]): Record<string, number>;
export declare function createDebouncedEstimator<TArgs, TResult>(fn: (args: TArgs) => TResult, delayMs: number): {
    call: (args: TArgs) => void;
    flush: () => TResult | undefined;
    cancel: () => void;
    lastResult: () => TResult | undefined;
};
export declare function estimateExportCost(input: ExportCostEstimateInput): ExportCostEstimate;
export declare function calculateFilterComplexityFactor(timeline: Timeline, settings?: Partial<Omit<ExportSettings, 'outputPath'>>, qualityEvaluation?: boolean): {
    factor: number;
    breakdown: ExportCostFactorBreakdown[];
};
export declare function estimateExportFileSizeMb(input: {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    format?: string | null;
    outputMode?: ExportSettings['outputMode'];
    videoBitrate?: string | null;
    audioBitrate?: string | null;
}): number;
export declare function calculateHistoricalExportSpeed(samples: ExportCostHistorySample[] | undefined): number | undefined;
export declare function calculateHistoricalEstimateErrorPercent(estimatedSeconds: number | undefined, actualSeconds: number | undefined): number | undefined;
export declare function parseExportBitrate(value: string | null | undefined): number | undefined;
export declare function assertExportCostEffectCoverage(): true;
//# sourceMappingURL=cost-estimate.d.ts.map