import type { ExportTask } from './export-queue';
export interface ResourceSample {
    timestamp: number;
    cpuPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    diskReadMbPerSec: number;
    diskWriteMbPerSec: number;
}
export interface TaskResourceEstimate {
    taskId: string;
    taskName: string;
    cpuCost: number;
    memoryMb: number;
    memoryClass: 'light' | 'balanced' | 'heavy';
    parallelEligible: boolean;
}
export interface OverloadStatus {
    overloaded: boolean;
    runningCount: number;
    recommendedMax: number;
    cpuCores: number;
    overloadCoefficient: number;
}
export interface ExportResourceSnapshot {
    exportId: string;
    startedAt: number;
    finishedAt: number;
    samples: ResourceSample[];
    taskNames: string[];
}
export interface ResourceDashboardState {
    rollingWindow: ResourceSample[];
    exportHistory: ExportResourceSnapshot[];
    currentEstimates: TaskResourceEstimate[];
    overloadStatus: OverloadStatus;
    enabled: boolean;
}
export declare const ROLLING_WINDOW_DURATION_MS = 60000;
export declare const MAX_EXPORT_HISTORY_COUNT = 5;
export declare const DEFAULT_OVERLOAD_COEFFICIENT = 1.2;
export declare const MAX_OVERLOAD_COEFFICIENT = 3;
export declare const MIN_OVERLOAD_COEFFICIENT = 0.5;
export declare function createEmptyDashboardState(): ResourceDashboardState;
export declare function appendResourceSample(samples: ResourceSample[], sample: ResourceSample, nowMs: number, windowDurationMs?: number): ResourceSample[];
export declare function calculateOverloadStatus(runningTaskCount: number, cpuCores: number, coefficient?: number): OverloadStatus;
export declare function isOverloaded(runningTaskCount: number, cpuCores: number, coefficient?: number): boolean;
export declare function clampCoefficient(value: number): number;
export declare function estimateTaskResourceUsage(tasks: ExportTask[]): TaskResourceEstimate[];
export declare function estimateSingleTaskCpuPercent(task: ExportTask, cpuCores: number): number;
export declare function startExportRecording(snapshots: ExportResourceSnapshot[], exportId: string, taskNames: string[], nowMs: number): ExportResourceSnapshot[];
export declare function appendExportSample(snapshots: ExportResourceSnapshot[], exportId: string, sample: ResourceSample): ExportResourceSnapshot[];
export declare function finishExportRecording(snapshots: ExportResourceSnapshot[], exportId: string, nowMs: number): ExportResourceSnapshot[];
export declare function trimExportHistory(snapshots: ExportResourceSnapshot[]): ExportResourceSnapshot[];
export interface ResourceCurvePoint {
    timestamp: number;
    cpuPercent: number;
    memoryUsedMb: number;
    diskReadMbPerSec: number;
    diskWriteMbPerSec: number;
    elapsedSeconds: number;
}
export declare function extractExportCurve(snapshot: ExportResourceSnapshot): ResourceCurvePoint[];
export declare function normalizeExportHistory(snapshots: ExportResourceSnapshot[]): ExportResourceSnapshot[];
export declare function normalizeOverloadCoefficient(value: number | undefined): number;
//# sourceMappingURL=resource-dashboard.d.ts.map