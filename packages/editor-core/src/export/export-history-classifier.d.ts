import type { ExportTaskHistoryEntry } from './export-queue';
export type ExportCategoryTag = 'social-media' | 'client-delivery' | 'internal-preview' | 'archive-backup';
export interface ExportCategoryRule {
    tag: ExportCategoryTag;
    label: string;
    /** Preset ID patterns that trigger this category. */
    presetPatterns: string[];
    /** Export name patterns (lowercase). */
    namePatterns: string[];
}
export declare const EXPORT_CATEGORY_RULES: ExportCategoryRule[];
export interface ClassifiedExportEntry extends ExportTaskHistoryEntry {
    category: ExportCategoryTag;
    categoryLabel: string;
    presetId?: string;
    presetName?: string;
    projectSnapshotId?: string;
}
export interface ExportHistoryFilter {
    categories?: ExportCategoryTag[];
    dateFrom?: string;
    dateTo?: string;
    minFileSize?: number;
    maxFileSize?: number;
    statusOnly?: 'success' | 'error';
    searchText?: string;
}
export interface ExportCategoryStats {
    tag: ExportCategoryTag;
    label: string;
    count: number;
    trend: Array<{
        week: string;
        count: number;
    }>;
}
/** Auto-classify an export history entry based on preset ID and name. */
export declare function classifyExportEntry(entry: ExportTaskHistoryEntry, presetId?: string, presetName?: string, projectSnapshotId?: string): ClassifiedExportEntry;
/** Classify a batch of export history entries. */
export declare function classifyExportHistory(entries: ExportTaskHistoryEntry[], presetMap?: Map<string, {
    presetId: string;
    presetName?: string;
    projectSnapshotId?: string;
}>): ClassifiedExportEntry[];
/** Apply composite filter to classified entries. */
export declare function filterExportHistory(entries: ClassifiedExportEntry[], filter: ExportHistoryFilter): ClassifiedExportEntry[];
/** Calculate export category stats with weekly trend buckets. */
export declare function calculateExportCategoryStats(entries: ClassifiedExportEntry[]): ExportCategoryStats[];
/** Find the associated preset and snapshot for a given history entry. */
export declare function findExportAssociation(entryId: string, presetMap: Map<string, {
    presetId: string;
    presetName?: string;
    projectSnapshotId?: string;
}>): {
    presetId?: string;
    presetName?: string;
    projectSnapshotId?: string;
} | undefined;
/** Manual category override: reclassify an entry. */
export declare function overrideEntryCategory(entry: ClassifiedExportEntry, newCategory: ExportCategoryTag): ClassifiedExportEntry;
//# sourceMappingURL=export-history-classifier.d.ts.map