import type { ExportTask } from './queue-types';
import type { FfmpegExportPlan } from './export-types';
export type ExportMemoryClass = 'light' | 'balanced' | 'heavy';
export interface ExportResourceEstimate {
    cpuCost: number;
    memoryMb: number;
    diskMb: number;
    effectCount: number;
    memoryClass: ExportMemoryClass;
    parallelEligible: boolean;
    reasons: string[];
}
export interface SharedDecodeCacheHit {
    cacheKey: string;
    taskIds: string[];
    inputPaths: string[];
    startSeconds: number;
    durationSeconds: number;
}
export declare function estimateExportResourceNeeds(plan: FfmpegExportPlan): ExportResourceEstimate;
export declare function isExportPlanParallelEligible(plan: FfmpegExportPlan): boolean;
export declare function canRunExportTasksInParallel(left: ExportTask | FfmpegExportPlan, right: ExportTask | FfmpegExportPlan, memoryLimitMb?: number): boolean;
export declare function startResourceAwareExportTaskSlots(tasks: ExportTask[], maxConcurrent?: number, now?: string): ExportTask[];
export declare function detectSharedDecodeCacheHits(tasks: Array<{
    id: string;
    plan: FfmpegExportPlan;
}>): SharedDecodeCacheHit[];
export declare function buildSharedDecodeCacheKey(plan: FfmpegExportPlan): string | undefined;
export declare function calculateLowPowerThreadCount(hardwareConcurrency: number | undefined): number;
export declare function applyLowPowerThreads(plan: FfmpegExportPlan, enabled: boolean, hardwareConcurrency?: number): FfmpegExportPlan;
//# sourceMappingURL=scheduling.d.ts.map