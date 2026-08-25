// @vitest-environment jsdom
// 源文件：apps/desktop/src/cache/cache-service.ts（95 可执行行，五期前覆盖 34.74%）
// 覆盖目标：≥70%。模式：vi.mock tauri-bridge 的 readCache/writeCache/clearCache/getCacheSize，
// 断言缓存命中 / key 校验失效 / JSON 解析失败 / 写入结构 / 清理与大小回退。

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/tauri-bridge', () => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  clearCache: vi.fn(),
  getCacheSize: vi.fn(),
}));

import {
  readThumbnailFromCache,
  writeThumbnailToCache,
  readWaveformFromCache,
  writeWaveformToCache,
  clearMediaCache,
} from './cache-service';
import { readCache, writeCache, clearCache, getCacheSize } from '../lib/tauri-bridge';
import { buildCachePaths, getMediaCacheKey, type MediaAsset } from '@open-factory/editor-core';

const asset: MediaAsset = {
  id: 'media-a',
  type: 'video',
  name: 'A.mp4',
  path: 'D:/media/A.mp4',
  duration: 6,
  width: 1920,
  height: 1080,
  size: 1024,
  mtimeMs: 12345,
} as MediaAsset;

const key = getMediaCacheKey({ path: asset.path, size: asset.size!, mtimeMs: asset.mtimeMs! });
const thumbnailPaths = buildCachePaths('thumbnail', key);
const waveformPaths = buildCachePaths('waveform', key);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(writeCache).mockResolvedValue(undefined);
  vi.mocked(clearCache).mockResolvedValue(undefined);
});

describe('readThumbnailFromCache', () => {
  it('命中：key 匹配时返回 dataUrl', async () => {
    vi.mocked(readCache).mockResolvedValueOnce(JSON.stringify({ key, dataUrl: 'data:image/png;base64,xxx' }));
    await expect(readThumbnailFromCache(asset)).resolves.toBe('data:image/png;base64,xxx');
    expect(readCache).toHaveBeenCalledWith(thumbnailPaths.dataPath);
  });

  it('key 不匹配（陈旧条目）返回 undefined', async () => {
    vi.mocked(readCache).mockResolvedValueOnce(JSON.stringify({ key: 'other-key', dataUrl: 'x' }));
    await expect(readThumbnailFromCache(asset)).resolves.toBeUndefined();
  });

  it('readCache 抛错（catch 兜底 null）返回 undefined', async () => {
    vi.mocked(readCache).mockRejectedValueOnce(new Error('io'));
    await expect(readThumbnailFromCache(asset)).resolves.toBeUndefined();
  });

  it('JSON 解析失败返回 undefined', async () => {
    vi.mocked(readCache).mockResolvedValueOnce('not-json');
    await expect(readThumbnailFromCache(asset)).resolves.toBeUndefined();
  });

  it('资产缺少 size/mtimeMs 无法建 key，直接返回 undefined', async () => {
    await expect(readThumbnailFromCache({ ...asset, size: undefined } as MediaAsset)).resolves.toBeUndefined();
    await expect(readThumbnailFromCache({ ...asset, mtimeMs: undefined } as MediaAsset)).resolves.toBeUndefined();
    expect(readCache).not.toHaveBeenCalled();
  });
});

describe('writeThumbnailToCache', () => {
  it('写入完整条目（key/sourcePath/dataUrl/尺寸/时间戳）', async () => {
    await writeThumbnailToCache(asset, 'data:image/png;base64,yyy', 320, 180);
    expect(writeCache).toHaveBeenCalledTimes(1);
    const [path, raw] = vi.mocked(writeCache).mock.calls[0];
    expect(path).toBe(thumbnailPaths.dataPath);
    const entry = JSON.parse(raw) as { key: string; sourcePath: string; dataUrl: string; width: number; height: number; createdAt: string };
    expect(entry).toMatchObject({ key, sourcePath: asset.path, dataUrl: 'data:image/png;base64,yyy', width: 320, height: 180 });
    expect(typeof entry.createdAt).toBe('string');
  });

  it('资产缺 size 时跳过写入；写入失败仅告警不抛错', async () => {
    await writeThumbnailToCache({ ...asset, size: undefined } as MediaAsset, 'x', 1, 1);
    expect(writeCache).not.toHaveBeenCalled();

    vi.mocked(writeCache).mockRejectedValueOnce(new Error('disk full'));
    await expect(writeThumbnailToCache(asset, 'x', 1, 1)).resolves.toBeUndefined();
  });
});

describe('readWaveformFromCache', () => {
  it('命中：key 匹配时返回完整条目', async () => {
    const entry = { key, sourcePath: asset.path, peaks: [0.1, 0.5], duration: 6, channels: 2, pointsPerSecond: 20, isSampled: false, createdAt: '2026-01-01T00:00:00Z' };
    vi.mocked(readCache).mockResolvedValueOnce(JSON.stringify(entry));
    await expect(readWaveformFromCache(asset)).resolves.toEqual(entry);
    expect(readCache).toHaveBeenCalledWith(waveformPaths.dataPath);
  });

  it('key 不匹配 / 解析失败 / 无 size 均返回 undefined', async () => {
    vi.mocked(readCache).mockResolvedValueOnce(JSON.stringify({ key: 'stale' }));
    await expect(readWaveformFromCache(asset)).resolves.toBeUndefined();
    vi.mocked(readCache).mockResolvedValueOnce('{{{');
    await expect(readWaveformFromCache(asset)).resolves.toBeUndefined();
    await expect(readWaveformFromCache({ ...asset, size: undefined } as MediaAsset)).resolves.toBeUndefined();
  });
});

describe('writeWaveformToCache', () => {
  it('补全 key/sourcePath/createdAt 后写入', async () => {
    await writeWaveformToCache(asset, { peaks: [0.2, 0.4], duration: 6, channels: 2, pointsPerSecond: 20, isSampled: true });
    expect(writeCache).toHaveBeenCalledTimes(1);
    const [path, raw] = vi.mocked(writeCache).mock.calls[0];
    expect(path).toBe(waveformPaths.dataPath);
    const entry = JSON.parse(raw) as { key: string; sourcePath: string; peaks: number[]; createdAt: string };
    expect(entry).toMatchObject({ key, sourcePath: asset.path, peaks: [0.2, 0.4] });
    expect(typeof entry.createdAt).toBe('string');
  });

  it('资产缺 mtimeMs 跳过；写入失败不抛错', async () => {
    await writeWaveformToCache({ ...asset, mtimeMs: undefined } as MediaAsset, { peaks: [], duration: 1, channels: 1, pointsPerSecond: 1, isSampled: false });
    expect(writeCache).not.toHaveBeenCalled();

    vi.mocked(writeCache).mockRejectedValueOnce(new Error('io'));
    await expect(writeWaveformToCache(asset, { peaks: [], duration: 1, channels: 1, pointsPerSecond: 1, isSampled: false })).resolves.toBeUndefined();
  });
});

describe('clearMediaCache', () => {
  it('清理后返回缓存目录大小', async () => {
    vi.mocked(getCacheSize).mockResolvedValueOnce(2048);
    await expect(clearMediaCache()).resolves.toBe(2048);
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it('大小查询失败回退 0', async () => {
    vi.mocked(getCacheSize).mockRejectedValueOnce(new Error('io'));
    await expect(clearMediaCache()).resolves.toBe(0);
  });
});
