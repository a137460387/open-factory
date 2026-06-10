export type MediaCacheKind = 'thumbnail' | 'waveform' | 'media-index' | 'proxy';

export interface CacheKeyInput {
  path: string;
  size: number;
  mtimeMs: number;
  formatVersion?: string;
}

export interface CachePathSet {
  dataPath: string;
  metaPath: string;
}

export interface ThumbnailCacheEntry {
  key: string;
  sourcePath: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface WaveformCacheEntry {
  key: string;
  sourcePath: string;
  peaks: number[];
  duration: number;
  channels: number;
  pointsPerSecond: number;
  isSampled: boolean;
  createdAt: string;
}

export interface ProxyCacheEntry {
  key: string;
  sourcePath: string;
  proxyPath: string;
  width: number;
  height: number;
  videoBitrate: string;
  createdAt: string;
}
