import type { ExportPostExportScriptSettings } from './export-types';
export interface PostExportScriptVariables {
    outputPath: string;
    projectName: string;
    durationSeconds: number;
    date: Date;
}
export declare function normalizeExportPostScript(value: unknown): ExportPostExportScriptSettings | null;
export declare function expandPostExportScriptCommand(command: string, variables: PostExportScriptVariables): string;
export declare function formatPostExportDate(date: Date): string;
export declare function formatPostExportDuration(durationSeconds: number): string;
//# sourceMappingURL=post-export-script.d.ts.map