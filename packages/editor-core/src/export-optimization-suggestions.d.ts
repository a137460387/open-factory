import type { ExportSettings } from './export/export-types';
import type { Project } from './model-types';
export type ExportOptimizationSuggestionId = 'proxy-for-4k-downscale' | 'unify-frame-rate' | 'normalize-loudness' | 'convert-vfr-to-cfr' | 'parallel-long-export';
export type ExportOptimizationSuggestionSeverity = 'info' | 'warning';
export interface ExportOptimizationSettings {
    dismissedSuggestionIds: ExportOptimizationSuggestionId[];
}
export interface ExportOptimizationAnalysisContext {
    measuredIntegratedLufs?: number;
    renderFarmEnabled?: boolean;
    suggestedRenderFarmInstances?: number;
}
export interface ExportOptimizationSuggestion {
    id: ExportOptimizationSuggestionId;
    severity: ExportOptimizationSuggestionSeverity;
    mediaIds: string[];
    value?: number;
    targetValue?: number;
}
export interface ExportOptimizationApplyResult {
    settings: Partial<Omit<ExportSettings, 'outputPath'>>;
    renderFarm?: {
        enabled: boolean;
        instances: number;
    };
}
export declare const DEFAULT_EXPORT_OPTIMIZATION_SETTINGS: ExportOptimizationSettings;
export declare function normalizeExportOptimizationSettings(settings: unknown): ExportOptimizationSettings;
export declare function analyzeExportOptimizationSuggestions(project: Pick<Project, 'media' | 'timeline' | 'settings'>, settings: Partial<Omit<ExportSettings, 'outputPath'>>, optimizationSettings?: ExportOptimizationSettings, context?: ExportOptimizationAnalysisContext): ExportOptimizationSuggestion[];
export declare function applyExportOptimizationSuggestion(suggestion: ExportOptimizationSuggestion | ExportOptimizationSuggestionId, settings: Partial<Omit<ExportSettings, 'outputPath'>>, context?: ExportOptimizationAnalysisContext): ExportOptimizationApplyResult;
//# sourceMappingURL=export-optimization-suggestions.d.ts.map