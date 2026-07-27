export interface MediaQualityInfo {
    assetId: string;
    name: string;
    path: string;
    width: number;
    height: number;
    bitrate: number;
    fileSize: number;
    codec?: string;
    fps?: number;
}
export interface MediaQualityComparison {
    groupId: string;
    assets: MediaQualityInfo[];
    recommendedKeepAssetId: string;
}
export interface MergeHistoryEntry {
    id: string;
    timestamp: string;
    groupId: string;
    keptAssetId: string;
    keptName: string;
    mergedAssetIds: string[];
    mergedNames: string[];
    movedToTrash: boolean;
}
export interface MergeHistoryStore {
    entries: MergeHistoryEntry[];
}
export declare const MAX_MERGE_HISTORY_ENTRIES = 100;
export declare function createEmptyMergeHistory(): MergeHistoryStore;
export declare function addMergeHistoryEntry(store: MergeHistoryStore, entry: MergeHistoryEntry): MergeHistoryStore;
export declare function undoLastMergeEntry(store: MergeHistoryStore): {
    store: MergeHistoryStore;
    entry: MergeHistoryEntry | undefined;
};
export declare function buildQualityComparison(groupId: string, assets: MediaQualityInfo[]): MediaQualityComparison;
export declare function buildRecycleBinArgs(filePath: string): string[];
export declare function detectCrossProjectDuplicates(currentMedia: {
    id: string;
    path: string;
    headHash?: string;
    size?: number;
}[], sharedLibrary: {
    id: string;
    path: string;
    headHash?: string;
    size?: number;
}[]): {
    currentAssetId: string;
    sharedAssetId: string;
    reason: string;
}[];
export declare function serializeMergeHistory(store: MergeHistoryStore): string;
export declare function deserializeMergeHistory(json: string): MergeHistoryStore;
//# sourceMappingURL=duplicate-media-merge.d.ts.map