import type { MediaAsset } from '@open-factory/editor-core';

export type MediaLibraryViewMode = 'grid' | 'list' | 'timeline';
export type MediaLibraryGridSize = 'small' | 'medium' | 'large';
export type MediaLibrarySortKey = 'name' | 'duration' | 'size' | 'importedAt' | 'frameRate' | 'resolution' | 'codec';
type MediaLibrarySortDirection = 'asc' | 'desc';

export interface MediaLibraryViewSettings {
  mode: MediaLibraryViewMode;
  gridSize: MediaLibraryGridSize;
  sortKey: MediaLibrarySortKey;
  sortDirection: MediaLibrarySortDirection;
}

export const DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS: MediaLibraryViewSettings = {
  mode: 'grid',
  gridSize: 'medium',
  sortKey: 'importedAt',
  sortDirection: 'asc'
};

export function normalizeMediaLibraryViewSettings(settings: Partial<MediaLibraryViewSettings> | undefined | null): MediaLibraryViewSettings {
  return {
    mode: isMediaLibraryViewMode(settings?.mode) ? settings.mode : DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS.mode,
    gridSize: isMediaLibraryGridSize(settings?.gridSize) ? settings.gridSize : DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS.gridSize,
    sortKey: isMediaLibrarySortKey(settings?.sortKey) ? settings.sortKey : DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS.sortKey,
    sortDirection: settings?.sortDirection === 'asc' || settings?.sortDirection === 'desc' ? settings.sortDirection : DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS.sortDirection
  };
}

export function sortMediaLibraryAssets(media: MediaAsset[], settings: Pick<MediaLibraryViewSettings, 'sortKey' | 'sortDirection'>): MediaAsset[] {
  const direction = settings.sortDirection === 'asc' ? 1 : -1;
  return media
    .map((asset, index) => ({ asset, index }))
    .sort((left, right) => {
      const valueCompare = compareBySortKey(left.asset, right.asset, settings.sortKey);
      if (valueCompare !== 0) {
        return valueCompare * direction;
      }
      if (settings.sortKey === 'importedAt') {
        return left.index - right.index;
      }
      return compareText(left.asset.name, right.asset.name) || left.asset.id.localeCompare(right.asset.id);
    })
    .map((item) => item.asset);
}

function compareBySortKey(left: MediaAsset, right: MediaAsset, sortKey: MediaLibrarySortKey): number {
  if (sortKey === 'name') {
    return compareText(left.name, right.name);
  }
  if (sortKey === 'duration') {
    return compareNumber(left.duration, right.duration);
  }
  if (sortKey === 'size') {
    return compareNumber(left.size, right.size);
  }
  if (sortKey === 'frameRate') return compareNumber(left.frameRate, right.frameRate);
  if (sortKey === 'resolution') return compareNumber(getPixelCount(left), getPixelCount(right));
  if (sortKey === 'codec') return compareText(left.videoCodec ?? left.audioCodec ?? '', right.videoCodec ?? right.audioCodec ?? '');
  return compareNumber(parseImportedAt(left.importedAt), parseImportedAt(right.importedAt));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function compareNumber(left: number | undefined, right: number | undefined): number {
  const normalizedLeft = Number.isFinite(left) ? left! : Number.NEGATIVE_INFINITY;
  const normalizedRight = Number.isFinite(right) ? right! : Number.NEGATIVE_INFINITY;
  return normalizedLeft - normalizedRight;
}

function parseImportedAt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function isMediaLibraryViewMode(value: unknown): value is MediaLibraryViewMode {
  return value === 'grid' || value === 'list' || value === 'timeline';
}

function isMediaLibraryGridSize(value: unknown): value is MediaLibraryGridSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isMediaLibrarySortKey(value: unknown): value is MediaLibrarySortKey {
  return value === 'name' || value === 'duration' || value === 'size' || value === 'importedAt' || value === 'frameRate' || value === 'resolution' || value === 'codec';
}

function getPixelCount(asset: MediaAsset): number | undefined {
  if (asset.width && asset.height) return asset.width * asset.height;
  return undefined;
}
