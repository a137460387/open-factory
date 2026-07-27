import { describe, it, expect } from 'vitest';
import {
  getMediaCacheKey,
  hashCacheKey,
  buildCachePaths,
  normalizeCachePath,
  isSafeCacheFileName,
} from '../src/cache/cache-key';

describe('cache-key', () => {
  describe('normalizeCachePath', () => {
    it('normalizes backslashes to forward slashes', () => {
      expect(normalizeCachePath('C:\\Users\\test\\file.mp4')).toBe('c:/users/test/file.mp4');
    });

    it('collapses double slashes', () => {
      expect(normalizeCachePath('/home//user///file.mp4')).toBe('/home/user/file.mp4');
    });

    it('lowercases drive letter paths', () => {
      expect(normalizeCachePath('D:/Videos/test.mp4')).toBe('d:/videos/test.mp4');
    });

    it('preserves non-drive-letter paths', () => {
      expect(normalizeCachePath('/home/user/file.mp4')).toBe('/home/user/file.mp4');
    });
  });

  describe('getMediaCacheKey', () => {
    it('generates consistent key for same input', () => {
      const input = { path: '/video.mp4', size: 1000, mtimeMs: 5000 };
      const key1 = getMediaCacheKey(input);
      const key2 = getMediaCacheKey(input);
      expect(key1).toBe(key2);
    });

    it('includes version, path, size, and mtime', () => {
      const key = getMediaCacheKey({ path: '/video.mp4', size: 1000, mtimeMs: 5000 });
      expect(key).toContain('v1');
      expect(key).toContain('size=1000');
      expect(key).toContain('mtime=5000');
    });

    it('uses custom format version', () => {
      const key = getMediaCacheKey({ path: '/v.mp4', size: 0, mtimeMs: 0, formatVersion: 'v2' });
      expect(key.startsWith('v2|')).toBe(true);
    });

    it('clamps negative values to 0', () => {
      const key = getMediaCacheKey({ path: '/v.mp4', size: -5, mtimeMs: -10 });
      expect(key).toContain('size=0');
      expect(key).toContain('mtime=0');
    });
  });

  describe('hashCacheKey', () => {
    it('returns 16-char hex string', () => {
      const hash = hashCacheKey('test-key');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('returns consistent hash for same input', () => {
      expect(hashCacheKey('abc')).toBe(hashCacheKey('abc'));
    });

    it('returns different hash for different inputs', () => {
      expect(hashCacheKey('abc')).not.toBe(hashCacheKey('def'));
    });

    it('handles empty string', () => {
      const hash = hashCacheKey('');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('buildCachePaths', () => {
    it('builds thumbnail paths', () => {
      const paths = buildCachePaths('thumbnail', 'test-key');
      expect(paths.dataPath).toMatch(/^thumbnails\/[a-f0-9]{16}\.webp$/);
      expect(paths.metaPath).toMatch(/^thumbnails\/[a-f0-9]{16}\.meta\.json$/);
    });

    it('builds waveform paths', () => {
      const paths = buildCachePaths('waveform', 'test-key');
      expect(paths.dataPath).toMatch(/^waveforms\/[a-f0-9]{16}\.json$/);
    });

    it('builds proxy paths', () => {
      const paths = buildCachePaths('proxy', 'test-key');
      expect(paths.dataPath).toMatch(/^proxies\/[a-f0-9]{16}\.mp4$/);
    });

    it('builds media-index paths for unknown kind', () => {
      const paths = buildCachePaths('unknown' as any, 'test-key');
      expect(paths.dataPath).toMatch(/^media-index\/[a-f0-9]{16}\.json$/);
    });

    it('dataPath and metaPath share same hash', () => {
      const paths = buildCachePaths('thumbnail', 'test-key');
      const dataHash = paths.dataPath.match(/[a-f0-9]{16}/)?.[0];
      const metaHash = paths.metaPath.match(/[a-f0-9]{16}/)?.[0];
      expect(dataHash).toBe(metaHash);
    });
  });

  describe('isSafeCacheFileName', () => {
    it('returns true for valid 16-char hex', () => {
      expect(isSafeCacheFileName('0123456789abcdef')).toBe(true);
    });

    it('returns false for non-hex chars', () => {
      expect(isSafeCacheFileName('0123456789abcdeg')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect(isSafeCacheFileName('abc')).toBe(false);
      expect(isSafeCacheFileName('0123456789abcdef0')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSafeCacheFileName('')).toBe(false);
    });
  });
});
