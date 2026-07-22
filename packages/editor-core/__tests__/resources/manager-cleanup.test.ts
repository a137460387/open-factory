import { describe, it, expect } from 'vitest';
import { generateCleanupRecommendations } from '../../src/resources/manager';
import { DEFAULT_RESOURCE_CONFIG } from '../../src/resources/types';
import type { ResourceFile, CacheEntry, ResourceConfig } from '../../src/resources/types';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function makeFile(overrides: Partial<ResourceFile> = {}): ResourceFile {
  return {
    id: 'file-1',
    path: '/media/file.mp4',
    name: 'file.mp4',
    type: 'video',
    size: 1024,
    hash: 'abc123',
    createdAt: now,
    modifiedAt: now,
    lastAccessedAt: now,
    status: 'active',
    ...overrides,
  };
}

function makeCache(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    id: 'cache-1',
    category: 'preview',
    path: '/cache/preview.dat',
    size: 512,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 1,
    isExpired: false,
    ...overrides,
  };
}

describe('generateCleanupRecommendations: 临时文件', () => {
  it('检测到临时文件生成 temp-file 推荐', () => {
    const files = [
      makeFile({ type: 'temp', path: '/tmp/a.tmp' }),
      makeFile({ id: 'f2', type: 'temp', path: '/tmp/b.tmp' }),
    ];
    const recs = generateCleanupRecommendations(files, [], DEFAULT_RESOURCE_CONFIG);
    const tempRec = recs.find((r) => r.type === 'temp-file');
    expect(tempRec).toBeDefined();
    expect(tempRec!.files).toHaveLength(2);
    expect(tempRec!.risk).toBe('low');
    expect(tempRec!.autoCleanable).toBe(true);
  });

  it('无临时文件时不生成 temp-file 推荐', () => {
    const files = [makeFile({ type: 'video' })];
    const recs = generateCleanupRecommendations(files, [], DEFAULT_RESOURCE_CONFIG);
    expect(recs.find((r) => r.type === 'temp-file')).toBeUndefined();
  });
});

describe('generateCleanupRecommendations: 过期缓存', () => {
  it('过期缓存生成 cache-expired 推荐', () => {
    const cache = [makeCache({ isExpired: true, size: 2048 })];
    const recs = generateCleanupRecommendations([], cache, DEFAULT_RESOURCE_CONFIG);
    // analyzeCache 内部生成推荐
    expect(recs.length).toBeGreaterThan(0);
  });

  it('无过期缓存不生成缓存推荐', () => {
    const cache = [makeCache({ isExpired: false })];
    const recs = generateCleanupRecommendations([], cache, DEFAULT_RESOURCE_CONFIG);
    const cacheRecs = recs.filter((r) => r.type === 'cache-expired');
    expect(cacheRecs).toHaveLength(0);
  });
});

describe('generateCleanupRecommendations: 未使用文件', () => {
  it('启用 unused 检测且有过期文件时生成推荐', () => {
    // 注意：identifyUnusedFiles 要求 status === 'active' 且 lastAccessedAt 超过阈值
    const oldFile = makeFile({
      lastAccessedAt: now - 60 * DAY, // 60 天前，超过默认 30 天
      status: 'active',
      name: 'old-video.mp4',
    });
    const recs = generateCleanupRecommendations([oldFile], [], DEFAULT_RESOURCE_CONFIG);
    const unusedRec = recs.find((r) => r.type === 'unused-file');
    expect(unusedRec).toBeDefined();
    expect(unusedRec!.risk).toBe('medium');
  });

  it('禁用 unused 检测时不生成推荐', () => {
    const config: ResourceConfig = {
      ...DEFAULT_RESOURCE_CONFIG,
      unused: { ...DEFAULT_RESOURCE_CONFIG.unused, enabled: false },
    };
    const oldFile = makeFile({ lastAccessedAt: now - 60 * DAY, status: 'active', name: 'old.mp4' });
    const recs = generateCleanupRecommendations([oldFile], [], config);
    expect(recs.find((r) => r.type === 'unused-file')).toBeUndefined();
  });
});

describe('generateCleanupRecommendations: 重复文件', () => {
  it('完全相同的 hash 文件被检测为重复', () => {
    const files = [
      makeFile({ id: 'f1', hash: 'same', path: '/a.mp4' }),
      makeFile({ id: 'f2', hash: 'same', path: '/b.mp4' }),
    ];
    const recs = generateCleanupRecommendations(files, [], DEFAULT_RESOURCE_CONFIG);
    const dupRec = recs.find((r) => r.type === 'duplicate-file');
    expect(dupRec).toBeDefined();
  });

  it('禁用 duplicates 检测时不生成重复推荐', () => {
    const config: ResourceConfig = {
      ...DEFAULT_RESOURCE_CONFIG,
      duplicates: { ...DEFAULT_RESOURCE_CONFIG.duplicates, enabled: false },
    };
    const files = [
      makeFile({ id: 'f1', hash: 'same' }),
      makeFile({ id: 'f2', hash: 'same' }),
    ];
    const recs = generateCleanupRecommendations(files, [], config);
    expect(recs.find((r) => r.type === 'duplicate-file')).toBeUndefined();
  });
});

describe('generateCleanupRecommendations: 空输入', () => {
  it('空文件和空缓存返回可能为空或仅含默认推荐', () => {
    const recs = generateCleanupRecommendations([], [], DEFAULT_RESOURCE_CONFIG);
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe('generateCleanupRecommendations: 综合', () => {
  it('同时存在多种问题时生成多条推荐', () => {
    const files = [
      makeFile({ id: 'f1', type: 'temp', path: '/tmp/x' }),
      makeFile({ id: 'f2', hash: 'dup', path: '/dup/a.mp4', lastAccessedAt: now }),
      makeFile({ id: 'f3', hash: 'dup', path: '/dup/b.mp4', lastAccessedAt: now }),
    ];
    const cache = [makeCache({ isExpired: true })];
    const recs = generateCleanupRecommendations(files, cache, DEFAULT_RESOURCE_CONFIG);

    expect(recs.length).toBeGreaterThanOrEqual(2);
    const types = recs.map((r) => r.type);
    expect(types).toContain('temp-file');
  });

  it('每条推荐都有唯一 id', () => {
    const files = [
      makeFile({ id: 'f1', type: 'temp' }),
      makeFile({ id: 'f2', type: 'temp' }),
      makeFile({ id: 'f3', hash: 'dup' }),
      makeFile({ id: 'f4', hash: 'dup' }),
    ];
    const recs = generateCleanupRecommendations(files, [], DEFAULT_RESOURCE_CONFIG);
    const ids = recs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
