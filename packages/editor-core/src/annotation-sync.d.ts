export type AnnotationSyncStatus = 'synced' | 'syncing' | 'conflict' | 'offline';
export interface AnnotationSyncNote {
    id: string;
    start: number;
    end: number;
    text: string;
    color: string;
    authorName: string;
    resolved: boolean;
    updatedAt: string;
}
export interface AnnotationSyncBookmark {
    id: string;
    time: number;
    note: string;
    updatedAt: string;
}
export interface AnnotationSyncMarker {
    id: string;
    time: number;
    label: string;
    updatedAt: string;
}
export interface AnnotationSyncData {
    version: 1;
    projectId: string;
    syncedAt: string;
    notes: AnnotationSyncNote[];
    bookmarks: AnnotationSyncBookmark[];
    markers: AnnotationSyncMarker[];
}
export interface AnnotationSyncConflict {
    id: string;
    type: 'note' | 'bookmark' | 'marker';
    localUpdatedAt: string;
    remoteUpdatedAt: string;
    resolvedTo: 'local' | 'remote';
}
export interface AnnotationSyncMergeResult {
    merged: AnnotationSyncData;
    conflicts: AnnotationSyncConflict[];
    mergedAt: string;
}
export declare function getAnnotationSyncFilename(projectId: string): string;
export declare function packAnnotationSyncData(projectId: string, notes: AnnotationSyncNote[], bookmarks: AnnotationSyncBookmark[], markers: AnnotationSyncMarker[], syncedAt?: string): AnnotationSyncData;
export declare function serializeAnnotationSyncData(data: AnnotationSyncData): string;
export declare function parseAnnotationSyncData(contents: string): AnnotationSyncData | undefined;
export declare function mergeAnnotationSyncData(local: AnnotationSyncData, remote: AnnotationSyncData, mergedAt?: string): AnnotationSyncMergeResult;
//# sourceMappingURL=annotation-sync.d.ts.map