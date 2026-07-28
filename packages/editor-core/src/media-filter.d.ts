import type { AssetType, MediaAsset, MediaMetadata } from './model';
export type MediaBinFilter = 'all' | AssetType | 'tagged' | 'selected' | 'rejected' | 'five-star';
export type MediaTypeFilter = 'all' | AssetType;
export type MediaMetadataFilter = 'all' | 'tagged' | 'selected' | 'rejected' | 'five-star';
export interface MediaFilterOptions {
    query?: string;
    filter?: MediaBinFilter;
    typeFilter?: MediaTypeFilter;
    metadataFilter?: MediaMetadataFilter;
    metadata?: Record<string, MediaMetadata>;
}
export declare function filterMediaAssets(media: MediaAsset[], options?: MediaFilterOptions): MediaAsset[];
//# sourceMappingURL=media-filter.d.ts.map