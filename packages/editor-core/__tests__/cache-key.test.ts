import { describe, expect, it } from 'vitest';
import { buildCachePaths, getMediaCacheKey, hashCacheKey, isSafeCacheFileName } from '../src';

describe('cache keys', () => {
  it('generates the same key for identical path size and mtime', () => {
    const first = getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 100, mtimeMs: 200 });
    const second = getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 100, mtimeMs: 200 });
    expect(first).toBe(second);
  });

  it('changes when mtime, size, or cache format changes', () => {
    const base = getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 100, mtimeMs: 200 });
    expect(getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 100, mtimeMs: 201 })).not.toBe(base);
    expect(getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 101, mtimeMs: 200 })).not.toBe(base);
    expect(getMediaCacheKey({ path: 'D:/Media/Clip.mp4', size: 100, mtimeMs: 200, formatVersion: 'v2' })).not.toBe(base);
  });

  it('normalizes Windows slash and case variants', () => {
    const backslash = getMediaCacheKey({ path: 'D:\\Media\\Clip.mp4', size: 100, mtimeMs: 200 });
    const slash = getMediaCacheKey({ path: 'd:/media/clip.mp4', size: 100, mtimeMs: 200 });
    expect(backslash).toBe(slash);
  });

  it('hashes raw keys into safe file names', () => {
    const raw = getMediaCacheKey({ path: 'D:\\媒体\\Clip:01.mp4', size: 100, mtimeMs: 200 });
    const hash = hashCacheKey(raw);
    expect(raw).toContain(':');
    expect(isSafeCacheFileName(hash)).toBe(true);
    expect(buildCachePaths('thumbnail', raw).dataPath).toMatch(/^thumbnails\/[a-f0-9]{16}\.webp$/);
  });

  it('builds waveform and media-index cache paths', () => {
    const raw = getMediaCacheKey({ path: '/media/clip.wav', size: 1, mtimeMs: 2 });
    expect(buildCachePaths('waveform', raw).dataPath).toMatch(/^waveforms\/[a-f0-9]{16}\.json$/);
    expect(buildCachePaths('proxy', raw).dataPath).toMatch(/^proxies\/[a-f0-9]{16}\.mp4$/);
    expect(buildCachePaths('media-index', raw).dataPath).toMatch(/^media-index\/[a-f0-9]{16}\.json$/);
    expect(isSafeCacheFileName('unsafe:name')).toBe(false);
  });
});
