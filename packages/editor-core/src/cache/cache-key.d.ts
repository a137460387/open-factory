import type { CacheKeyInput, CachePathSet, MediaCacheKind } from './cache-types';
export declare function getMediaCacheKey(input: CacheKeyInput): string;
export declare function hashCacheKey(key: string): string;
export declare function buildCachePaths(kind: MediaCacheKind, key: string): CachePathSet;
export declare function normalizeCachePath(path: string): string;
export declare function isSafeCacheFileName(value: string): boolean;
//# sourceMappingURL=cache-key.d.ts.map