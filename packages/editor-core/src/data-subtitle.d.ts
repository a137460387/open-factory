import type { DataSubtitleRow, DataSubtitleSource, DataSubtitleSourceType, SubtitleClip } from './model-types';
import type { SubtitleCueInput } from './subtitles/srt';
export interface DataSubtitleRenderContext {
    fps?: number;
    date?: Date;
}
export declare function parseDataSubtitleRows(contents: string, sourceType: Exclude<DataSubtitleSourceType, 'template'>): DataSubtitleRow[];
export declare function parseDataSubtitleCsvRows(contents: string): DataSubtitleRow[];
export declare function parseDataSubtitleJsonRows(contents: string): DataSubtitleRow[];
export declare function normalizeDataSubtitleSource(input: unknown): DataSubtitleSource | undefined;
export declare function normalizeDataSubtitleRows(input: unknown): DataSubtitleRow[] | undefined;
export declare function findDataSubtitleRowAtTime(rows: readonly DataSubtitleRow[], time: number): DataSubtitleRow | undefined;
export declare function expandDataSubtitleTemplate(template: string, row: DataSubtitleRow | undefined, time: number, context?: DataSubtitleRenderContext): string;
export declare function resolveDataSubtitleText(source: DataSubtitleSource | undefined, time: number, context?: DataSubtitleRenderContext): string;
export declare function expandDataSubtitleClipToCueInputs(clip: SubtitleClip, context?: DataSubtitleRenderContext): SubtitleCueInput[];
//# sourceMappingURL=data-subtitle.d.ts.map