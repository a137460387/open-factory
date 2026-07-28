import type { ExportSettings, FfmpegExportPlan } from './export-types';
export interface ProgressiveExportState {
    enabled: boolean;
    supported: boolean;
    partialPath: string;
    completedDuration: number;
    fallbackReason?: string;
}
export interface ProgressiveExportSupportInput {
    format?: string;
    videoCodec?: string;
    outputMode?: ExportSettings['outputMode'];
}
export declare function buildProgressivePartialPath(outputPath: string): string;
export declare function isProgressiveExportSupported(input: ProgressiveExportSupportInput): boolean;
export declare function createProgressiveExportState(input: {
    outputPath: string;
    settings: ProgressiveExportSupportInput;
    completedDuration?: number;
}): ProgressiveExportState;
export declare function buildProgressiveResumeArgs(completedDuration: number): string[];
export declare function estimateProgressiveCompletedDuration(duration: number, progress: number): number;
export declare function buildProgressiveExportPlan(plan: FfmpegExportPlan, partialPath: string, completedDuration?: number): FfmpegExportPlan;
export declare function getPlayablePartialMovFlags(): string;
export declare function buildProgressiveSegmentOutputPath(partialPath: string, completedDuration: number): string;
//# sourceMappingURL=progressive.d.ts.map