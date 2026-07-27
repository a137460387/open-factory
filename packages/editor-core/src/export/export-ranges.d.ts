export interface ExportRenderRange {
    id?: string;
    label?: string;
    start: number;
    duration: number;
}
export interface NormalizedExportRenderRange {
    id?: string;
    label?: string;
    start: number;
    duration: number;
}
export declare function normalizeExportRenderRange(range: ExportRenderRange | null | undefined, timelineDuration: number, fps: number): NormalizedExportRenderRange | null;
export declare function exportRenderRangeFromPoints(start: number | undefined, end: number | undefined, timelineDuration: number, fps: number, metadata?: Pick<ExportRenderRange, 'id' | 'label'>): NormalizedExportRenderRange | null;
export declare function appendExportRangeSequence(path: string, sequence: number, total?: number): string;
//# sourceMappingURL=export-ranges.d.ts.map