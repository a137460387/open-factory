import { MediaMetadata, Project, Timeline } from '../../model';
export declare function normalizeAssetIdSet(assetIds: string | string[]): Set<string>;
export declare function assertMediaAssetsExist(project: Project, assetIds: Set<string>): void;
export declare function collectProjectMediaIds(project: Project): Set<string>;
export declare function removeMediaAssets(project: Project, removeIds: Set<string>): Project;
export declare function mergeMediaReferences(project: Project, keepAssetId: string, removeIds: Set<string>): Project;
export declare function replaceTimelineMediaReferences(timeline: Timeline, keepAssetId: string, removeIds: Set<string>): Timeline;
export declare function filterMediaMetadata(metadata: Record<string, MediaMetadata>, removeIds: Set<string>): Record<string, MediaMetadata>;
//# sourceMappingURL=utils-media.d.ts.map