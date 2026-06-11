import type { AssetType, MediaAsset, MediaMetadata } from './model';

export type MediaBinFilter = 'all' | AssetType | 'tagged';

export interface MediaFilterOptions {
  query?: string;
  filter?: MediaBinFilter;
  metadata?: Record<string, MediaMetadata>;
}

export function filterMediaAssets(media: MediaAsset[], options: MediaFilterOptions = {}): MediaAsset[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  const filter = options.filter ?? 'all';
  return media.filter((asset) => {
    const matchesSearch = query.length === 0 || asset.name.toLowerCase().includes(query);
    const matchesType =
      filter === 'all' ? true : filter === 'tagged' ? Boolean(options.metadata?.[asset.id]?.labelColor) : asset.type === filter;
    return matchesSearch && matchesType;
  });
}
