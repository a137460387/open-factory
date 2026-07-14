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

export function filterMediaAssets(media: MediaAsset[], options: MediaFilterOptions = {}): MediaAsset[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  const legacyFilter = options.filter ?? 'all';
  const typeFilter = options.typeFilter ?? (isAssetTypeFilter(legacyFilter) ? legacyFilter : 'all');
  const metadataFilter = options.metadataFilter ?? (isMetadataFilter(legacyFilter) ? legacyFilter : 'all');
  return media.filter((asset) => {
    const matchesSearch =
      query.length === 0 ||
      asset.name.toLowerCase().includes(query) ||
      (asset.aiAnalysis?.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesMetadata = mediaMetadataMatchesFilter(options.metadata?.[asset.id], metadataFilter);
    return matchesSearch && matchesType && matchesMetadata;
  });
}

function isAssetTypeFilter(filter: MediaBinFilter): filter is AssetType {
  return filter === 'video' || filter === 'audio' || filter === 'image';
}

function isMetadataFilter(filter: MediaBinFilter): filter is MediaMetadataFilter {
  return filter === 'tagged' || filter === 'selected' || filter === 'rejected' || filter === 'five-star';
}

function mediaMetadataMatchesFilter(metadata: MediaMetadata | undefined, filter: MediaMetadataFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'tagged') {
    return Boolean(metadata?.labelColor);
  }
  if (filter === 'selected') {
    return metadata?.flag === 'green';
  }
  if (filter === 'rejected') {
    return metadata?.flag === 'red';
  }
  return (metadata?.rating ?? 0) >= 5;
}
