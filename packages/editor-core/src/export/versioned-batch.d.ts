import type { ExportRenderRange } from './export-ranges';
import type { ExportTask, VersionedExportTaskMetadata } from './queue-types';
import type { ExportProject, ExportSettings } from './export-types';
export type { VersionedExportTaskMetadata } from './queue-types';
export interface VersionedExportMetadataTemplate {
    title?: string;
    author?: string;
    description?: string;
    copyright?: string;
    date?: string;
}
export interface VersionedExportDefinition {
    id: string;
    name: string;
    enabled?: boolean;
    presetId?: string;
    platform?: string;
    language?: string;
    outputPathTemplate?: string;
    range?: ExportRenderRange | null;
    variables?: Record<string, string>;
    settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
    metadata?: VersionedExportMetadataTemplate;
}
export interface VersionedBatchExportTemplateFile {
    version: 1;
    name: string;
    outputPathTemplate: string;
    versions: VersionedExportDefinition[];
    exportedAt: string;
}
export interface VersionedExportJob {
    batch: VersionedExportTaskMetadata;
    outputPath: string;
    range?: ExportRenderRange | null;
    settings: Partial<Omit<ExportSettings, 'outputPath'>>;
    metadata?: ExportProject['metadata'];
    presetId?: string;
}
export interface CreateVersionedExportJobsInput {
    batchId: string;
    outputPathTemplate: string;
    defaultSettings: Partial<Omit<ExportSettings, 'outputPath'>>;
    defaultRange?: ExportRenderRange | null;
    presetSettingsById?: Map<string, Partial<Omit<ExportSettings, 'outputPath'>>>;
    metadata?: VersionedExportMetadataTemplate;
    versions: VersionedExportDefinition[];
}
export interface VersionedExportReportRow {
    batchId: string;
    versionId: string;
    versionName: string;
    platform?: string;
    language?: string;
    outputPath: string;
    status: ExportTask['status'];
    fileSizeBytes: number | null;
    durationSeconds: number | null;
    elapsedMs: number | null;
    width: number | null;
    height: number | null;
}
export declare function expandVersionedExportVariables(template: string, variables: Record<string, string>, options?: {
    pathSafe?: boolean;
}): string;
export declare function mergeVersionedExportSettings(defaultSettings: Partial<Omit<ExportSettings, 'outputPath'>>, presetSettings: Partial<Omit<ExportSettings, 'outputPath'>> | undefined, version: Pick<VersionedExportDefinition, 'settings'>): Partial<Omit<ExportSettings, 'outputPath'>>;
export declare function createVersionedExportJobs(input: CreateVersionedExportJobsInput): VersionedExportJob[];
export declare function serializeVersionedBatchTemplate(name: string, outputPathTemplate: string, versions: VersionedExportDefinition[], exportedAt?: string): string;
export declare function parseVersionedBatchTemplate(contents: string): VersionedBatchExportTemplateFile;
export declare function countRunningVersionedBatchTasks(tasks: ExportTask[], batchId: string): number;
export declare function buildVersionedExportReportRows(tasks: ExportTask[], options?: {
    batchId?: string;
    fileSizes?: Record<string, number>;
}): VersionedExportReportRow[];
//# sourceMappingURL=versioned-batch.d.ts.map