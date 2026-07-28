import type { ExportReport, FfmpegExportPlan } from './export-types';
export type RenderFarmSegmentStatusValue = 'pending' | 'running' | 'success' | 'error';
export interface RenderFarmTaskConfig {
    enabled: boolean;
    maxInstances: number;
}
export interface RenderFarmSegment {
    id: string;
    index: number;
    start: number;
    duration: number;
}
export interface RenderFarmSegmentStatus extends RenderFarmSegment {
    outputPath: string;
    status: RenderFarmSegmentStatusValue;
    progress: number;
    error?: string;
}
export interface RenderFarmRunOutcome {
    report?: ExportReport;
    usedFallback: boolean;
}
export interface RenderFarmRunContext {
    taskId: string;
    outputPath: string;
    plan: FfmpegExportPlan;
    config: RenderFarmTaskConfig;
    tempSegmentsDir: string;
    runPlan(plan: FfmpegExportPlan, taskId: string): Promise<{
        report?: ExportReport;
    }>;
    writeFile(path: string, contents: string): Promise<void>;
    removeFile(path: string): Promise<void>;
    onSegments?(segments: RenderFarmSegmentStatus[]): void;
    onSegmentUpdate?(segment: RenderFarmSegmentStatus): void;
    onProgress?(progress: number): void;
}
export declare const RENDER_FARM_SPLIT_THRESHOLD_SECONDS = 60;
export declare const RENDER_FARM_TARGET_SEGMENT_SECONDS = 30;
export declare function suggestRenderFarmInstances(cpuCores: number | undefined): number;
export declare function clampRenderFarmInstances(value: number): number;
export declare function calculateRenderFarmSegments(duration: number, options?: {
    thresholdSeconds?: number;
    targetSegmentSeconds?: number;
}): RenderFarmSegment[];
export declare function isRenderFarmPlanEligible(plan: FfmpegExportPlan): boolean;
export declare function createRenderFarmSegmentStatuses(segments: RenderFarmSegment[], tempSegmentsDir: string, taskId: string, outputPath: string): RenderFarmSegmentStatus[];
export declare function buildRenderFarmSegmentPath(tempSegmentsDir: string, taskId: string, index: number, outputPath: string): string;
export declare function buildRenderFarmSegmentPlan(plan: FfmpegExportPlan, segment: RenderFarmSegmentStatus): FfmpegExportPlan;
export declare function buildRenderFarmConcatList(segments: Pick<RenderFarmSegmentStatus, 'outputPath'>[]): string;
export declare function buildRenderFarmConcatPlan(segments: Pick<RenderFarmSegmentStatus, 'outputPath' | 'duration'>[], outputPath: string, concatListPath: string, sourcePlan?: Pick<FfmpegExportPlan, 'projectName' | 'postExportScript'>): FfmpegExportPlan;
export declare function calculateRenderFarmProgress(segments: Pick<RenderFarmSegmentStatus, 'duration' | 'progress'>[]): number;
export declare function runRenderFarmWithFallback(context: RenderFarmRunContext): Promise<RenderFarmRunOutcome>;
//# sourceMappingURL=render-farm.d.ts.map