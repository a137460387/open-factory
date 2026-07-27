export interface BatchExportTask {
    projectPath: string;
    preset?: string;
    outputDir?: string;
    outputName?: string;
}
export interface BatchExportScript {
    version: 1;
    tasks: BatchExportTask[];
    defaultPreset?: string;
    defaultOutputDir?: string;
}
export interface BatchExportTaskResult {
    projectPath: string;
    status: 'success' | 'error';
    durationMs: number;
    error?: string;
    outputPath?: string;
}
export interface BatchExportLog {
    startedAt: string;
    completedAt: string;
    scriptPath: string;
    results: BatchExportTaskResult[];
}
export interface CliBatchArg {
    batchScriptPath: string;
}
export declare function validateBatchExportScript(raw: unknown): {
    valid: boolean;
    errors: string[];
    script?: BatchExportScript;
};
export declare function parseBatchScriptJson(jsonStr: string): {
    valid: boolean;
    errors: string[];
    script?: BatchExportScript;
};
export declare function parseCliBatchArgs(argv: string[]): CliBatchArg | undefined;
export declare function formatBatchExportLog(log: BatchExportLog): string;
export declare function createBatchExportTaskResult(projectPath: string, status: 'success' | 'error', durationMs: number, error?: string, outputPath?: string): BatchExportTaskResult;
export declare function serializeGuiConfigToBatchScript(configs: Array<{
    projectPath: string;
    preset?: string;
    outputDir?: string;
}>, defaultPreset?: string, defaultOutputDir?: string): BatchExportScript;
//# sourceMappingURL=batch-export-script.d.ts.map