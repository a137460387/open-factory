import type { ExportReport, FfmpegExportPlan } from './export-types';
import type { ProgressiveExportState } from './progressive';
import { type RenderFarmSegmentStatus, type RenderFarmTaskConfig } from './render-farm';
import type { ExportTask, ExportTaskPriority, ExportTaskStatus, ExportUploadState, ExportUploadStatus, ExportUploadTargetType, VersionedExportTaskMetadata } from './queue-types';
export type { ExportTask, ExportTaskPriority, ExportTaskStatus, ExportUploadState, ExportUploadStatus, ExportUploadTargetType, VersionedExportTaskMetadata, } from './queue-types';
export interface ExportTaskHistoryEntry {
    id: string;
    name: string;
    outputPath: string;
    sourcePath?: string;
    status: Extract<ExportTaskStatus, 'success' | 'error'>;
    priority: ExportTaskPriority;
    createdAt: string;
    startedAt?: string;
    finishedAt: string;
    logPath?: string;
    error?: string;
    report?: ExportReport;
    upload?: ExportUploadState;
}
export declare function createExportTask(input: {
    name: string;
    projectName?: string;
    outputPath: string;
    plan: FfmpegExportPlan;
    priority?: ExportTaskPriority;
    renderFarm?: RenderFarmTaskConfig;
    progressive?: ProgressiveExportState;
    versionedBatch?: VersionedExportTaskMetadata;
    scheduledStartAt?: string;
    id?: string;
    now?: string;
}): ExportTask;
export declare function startNextExportTask(tasks: ExportTask[], now?: string): ExportTask[];
export declare function clampExportConcurrency(value: number): number;
export declare function startExportTaskSlots(tasks: ExportTask[], maxConcurrent?: number, now?: string): ExportTask[];
export declare function activateScheduledExportTasks(tasks: ExportTask[], now?: string): ExportTask[];
export declare function updateExportTaskProgress(tasks: ExportTask[], taskId: string, progress: number): ExportTask[];
export declare function updateExportTaskProgressive(tasks: ExportTask[], taskId: string, patch: Partial<ProgressiveExportState>): ExportTask[];
export declare function setExportTaskSegments(tasks: ExportTask[], taskId: string, segments: RenderFarmSegmentStatus[]): ExportTask[];
export declare function updateExportTaskSegment(tasks: ExportTask[], taskId: string, segmentId: string, patch: Partial<RenderFarmSegmentStatus>): ExportTask[];
export declare function finishExportTask(tasks: ExportTask[], taskId: string, report?: ExportReport, now?: string): ExportTask[];
export declare function failExportTask(tasks: ExportTask[], taskId: string, error: string, now?: string, report?: ExportReport): ExportTask[];
export declare function cancelExportTask(tasks: ExportTask[], taskId: string, now?: string): ExportTask[];
export declare function interruptExportTask(tasks: ExportTask[], taskId: string, error?: string, now?: string): ExportTask[];
export declare function setExportTaskLogPath(tasks: ExportTask[], taskId: string, logPath: string): ExportTask[];
export declare function sortExportQueueByPriority(tasks: ExportTask[]): ExportTask[];
export declare function createExportTaskHistoryEntry(task: ExportTask): ExportTaskHistoryEntry | undefined;
export declare function updateExportTaskHistoryUpload(history: ExportTaskHistoryEntry[], entryId: string, patch: {
    targetType: ExportUploadTargetType;
    status: ExportUploadStatus;
    destination?: string;
    error?: string;
    progress?: number;
}, now?: string): ExportTaskHistoryEntry[];
export declare function normalizeExportTaskPriority(priority: ExportTaskPriority | undefined): ExportTaskPriority;
export declare function normalizeRenderFarmTaskConfig(config: RenderFarmTaskConfig | undefined): RenderFarmTaskConfig | undefined;
export declare function normalizeProgressiveExportState(state: ProgressiveExportState | undefined): ProgressiveExportState | undefined;
//# sourceMappingURL=export-queue.d.ts.map