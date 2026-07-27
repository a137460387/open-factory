export declare const FRAME_SEARCH_HISTORY_LIMIT = 10;
export type FrameSearchHistoryEntryType = 'timecode' | 'frame' | 'marker' | 'clip';
export interface FrameSearchHistoryEntry {
    type: FrameSearchHistoryEntryType;
    query: string;
    label: string;
    time: number;
    selectedClipIds?: string[];
    createdAt?: string;
}
export declare function appendFrameSearchHistoryEntry(history: readonly FrameSearchHistoryEntry[], entry: FrameSearchHistoryEntry, limit?: number): FrameSearchHistoryEntry[];
export declare function sanitizeFrameSearchHistory(input: unknown, limit?: number): FrameSearchHistoryEntry[];
//# sourceMappingURL=frame-search.d.ts.map