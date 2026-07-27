import type { ExportSettings } from './export-types';
export type ExportPresetDiffFieldType = 'number' | 'string' | 'boolean' | 'watermark' | 'timecodeBurnIn' | 'slate' | 'colorManagement' | 'postExportScript' | 'masterProcessing' | 'audioVisualization';
export interface ExportPresetDiffField {
    key: string;
    label: string;
    type: ExportPresetDiffFieldType;
    valueA: unknown;
    valueB: unknown;
    equal: boolean;
}
export interface ExportPresetDiffResult {
    presetIdA: string;
    presetIdB: string;
    presetNameA: string;
    presetNameB: string;
    fields: ExportPresetDiffField[];
    diffCount: number;
}
export interface ExportPresetChangeLogEntry {
    timestamp: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
}
export interface ExportPresetInheritance {
    parentPresetId?: string;
    childPresetIds: string[];
}
export type ExportPresetSettings = Partial<Omit<ExportSettings, 'outputPath'>>;
export declare function extractPresetDiffFields(settingsA: ExportPresetSettings, settingsB: ExportPresetSettings, presetIdA: string, presetIdB: string, presetNameA: string, presetNameB: string): ExportPresetDiffResult;
export declare function mergePresetDiffs(baseSettings: ExportPresetSettings, sourceSettings: ExportPresetSettings, selectedKeys: string[]): ExportPresetSettings;
export declare function buildPresetChangeLog(oldSettings: ExportPresetSettings, newSettings: ExportPresetSettings, now?: () => Date): ExportPresetChangeLogEntry[];
export declare function serializePresetChangeLog(entries: ExportPresetChangeLogEntry[]): string;
export declare function parsePresetChangeLog(contents: string): ExportPresetChangeLogEntry[];
export declare function buildPresetInheritance(existingInheritances: Map<string, ExportPresetInheritance>, parentId: string, childId: string): Map<string, ExportPresetInheritance>;
export declare function getChildPresetIds(inheritances: Map<string, ExportPresetInheritance>, parentId: string): string[];
//# sourceMappingURL=export-preset-diff.d.ts.map