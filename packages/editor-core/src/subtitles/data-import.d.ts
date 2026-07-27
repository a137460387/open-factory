import type { SubtitleStyle } from '../model';
export type SubtitleDataImportFormat = 'csv' | 'json';
export type SubtitleDataImportMode = 'append' | 'new-track' | 'replace-current-track';
export interface SubtitleDataCue {
    start: number;
    end: number;
    text: string;
    style?: Partial<SubtitleStyle>;
}
export interface SubtitleDataOverlap {
    firstIndex: number;
    secondIndex: number;
    start: number;
    end: number;
}
export declare function parseSubtitleDataImport(contents: string, format: SubtitleDataImportFormat): SubtitleDataCue[];
export declare function parseSubtitleDataCsv(contents: string): SubtitleDataCue[];
export declare function parseSubtitleDataJson(contents: string): SubtitleDataCue[];
export declare function parseSubtitleDataTimecode(value: unknown): number;
export declare function detectSubtitleDataOverlaps(cues: SubtitleDataCue[]): SubtitleDataOverlap[];
export declare function mergeOverlappingSubtitleDataCues(cues: SubtitleDataCue[]): SubtitleDataCue[];
//# sourceMappingURL=data-import.d.ts.map