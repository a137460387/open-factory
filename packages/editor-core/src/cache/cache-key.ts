import type { CacheKeyInput, CachePathSet, MediaCacheKind } from './cache-types';

const DEFAULT_CACHE_FORMAT_VERSION = 'v1';

export function getMediaCacheKey(input: CacheKeyInput): string {
  const path = normalizeCachePath(input.path);
  const version = input.formatVersion ?? DEFAULT_CACHE_FORMAT_VERSION;
  return `${version}|${path}|size=${Math.max(0, Math.round(input.size))}|mtime=${Math.max(0, Math.round(input.mtimeMs))}`;
}

export function hashCacheKey(key: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= BigInt(key.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

export function buildCachePaths(kind: MediaCacheKind, key: string): CachePathSet {
  const hash = hashCacheKey(key);
  if (kind === 'thumbnail') {
    return { dataPath: `thumbnails/${hash}.webp`, metaPath: `thumbnails/${hash}.meta.json` };
  }
  if (kind === 'waveform') {
    return { dataPath: `waveforms/${hash}.json`, metaPath: `waveforms/${hash}.meta.json` };
  }
  if (kind === 'proxy') {
    return { dataPath: `proxies/${hash}.mp4`, metaPath: `proxies/${hash}.meta.json` };
  }
  return { dataPath: `media-index/${hash}.json`, metaPath: `media-index/${hash}.meta.json` };
}

export function normalizeCachePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `${normalized[0].toUpperCase()}${normalized.slice(1)}`.toLowerCase();
  }
  return normalized;
}

export function isSafeCacheFileName(value: string): boolean {
  return /^[a-f0-9]{16}$/.test(value);
}
