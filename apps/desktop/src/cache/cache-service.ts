import {
  buildCachePaths,
  getMediaCacheKey,
  type MediaAsset,
  type ThumbnailCacheEntry,
  type WaveformCacheEntry
} from '@open-factory/editor-core';
import { clearCache as bridgeClearCache, getCacheSize, readCache, writeCache } from '../lib/tauri-bridge';

async function getAssetCacheKey(asset: MediaAsset): Promise<string | undefined> {
  if (!asset.size || !asset.mtimeMs) {
    return undefined;
  }
  return getMediaCacheKey({ path: asset.path, size: asset.size, mtimeMs: asset.mtimeMs });
}

export async function readThumbnailFromCache(asset: MediaAsset): Promise<string | undefined> {
  const key = await getAssetCacheKey(asset);
  if (!key) {
    return undefined;
  }
  const paths = buildCachePaths('thumbnail', key);
  const raw = await readCache(paths.dataPath).catch((error) => {
    console.warn('Thumbnail cache read failed', error);
    return null;
  });
  if (!raw) {
    return undefined;
  }
  try {
    const entry = JSON.parse(raw) as ThumbnailCacheEntry;
    return entry.key === key ? entry.dataUrl : undefined;
  } catch {
    return undefined;
  }
}

export async function writeThumbnailToCache(asset: MediaAsset, dataUrl: string, width: number, height: number): Promise<void> {
  const key = await getAssetCacheKey(asset);
  if (!key) {
    return;
  }
  const paths = buildCachePaths('thumbnail', key);
  const entry: ThumbnailCacheEntry = {
    key,
    sourcePath: asset.path,
    dataUrl,
    width,
    height,
    createdAt: new Date().toISOString()
  };
  await writeCache(paths.dataPath, JSON.stringify(entry)).catch((error) => {
    console.warn('Thumbnail cache write failed', error);
  });
}

export async function readWaveformFromCache(asset: MediaAsset): Promise<WaveformCacheEntry | undefined> {
  const key = await getAssetCacheKey(asset);
  if (!key) {
    return undefined;
  }
  const paths = buildCachePaths('waveform', key);
  const raw = await readCache(paths.dataPath).catch((error) => {
    console.warn('Waveform cache read failed', error);
    return null;
  });
  if (!raw) {
    return undefined;
  }
  try {
    const entry = JSON.parse(raw) as WaveformCacheEntry;
    return entry.key === key ? entry : undefined;
  } catch {
    return undefined;
  }
}

export async function writeWaveformToCache(asset: MediaAsset, entry: Omit<WaveformCacheEntry, 'key' | 'sourcePath' | 'createdAt'>): Promise<void> {
  const key = await getAssetCacheKey(asset);
  if (!key) {
    return;
  }
  const paths = buildCachePaths('waveform', key);
  const payload: WaveformCacheEntry = {
    ...entry,
    key,
    sourcePath: asset.path,
    createdAt: new Date().toISOString()
  };
  await writeCache(paths.dataPath, JSON.stringify(payload)).catch((error) => {
    console.warn('Waveform cache write failed', error);
  });
}

export async function clearMediaCache(): Promise<number> {
  await bridgeClearCache();
  return getCacheSize().catch(() => 0);
}
