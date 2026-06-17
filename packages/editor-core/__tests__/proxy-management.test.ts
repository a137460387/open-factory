import { describe, expect, it } from 'vitest';
import {
  buildProxyInventory,
  buildProxyMigration,
  buildProxyStorageTrend,
  calculateProxyCoverageStats,
  getProxyAssetsNeedingRegeneration,
  markExpiredProxyAssets,
  planProxyBatchDelete,
  planProxyCleanup,
  shouldRunProxyIntegrityCheck,
  summarizeProxyInventory,
  validateProxyAsset
} from '../src';
import { makeTimeline, makeVideoClip } from './test-utils';

const baseAsset = {
  id: 'asset-video',
  type: 'video' as const,
  name: 'source.mp4',
  path: 'C:/Media/source.mp4',
  duration: 10,
  width: 3840,
  height: 2160,
  size: 4000,
  mtimeMs: 1000,
  proxyPath: 'C:/Proxy/source-proxy.mp4',
  proxyStatus: 'ready' as const,
  hasAudio: true,
  audioChannels: 2,
  audioSampleRate: 48000,
  audioCodec: 'aac'
};

describe('proxy management', () => {
  it('validates proxy files and detects source mtime expiration', () => {
    expect(validateProxyAsset(baseAsset, { sourceStat: { size: 4000, mtimeMs: 1000 }, proxyStat: { size: 1024, mtimeMs: 1500 } })).toBe('ready');
    expect(validateProxyAsset(baseAsset, { sourceStat: { size: 4000, mtimeMs: 2000 }, proxyStat: { size: 1024, mtimeMs: 1500 } })).toBe('expired');
    expect(validateProxyAsset(baseAsset, { proxyStat: { size: 0, mtimeMs: 1500 } })).toBe('corrupt');
    expect(validateProxyAsset(baseAsset, { proxyExists: false })).toBe('missing');
  });

  it('marks expired proxy assets without changing fresh proxies', () => {
    const fresh = { ...baseAsset, id: 'fresh', path: 'C:/Media/fresh.mp4', proxyPath: 'C:/Proxy/fresh.mp4' };
    const expired = { ...baseAsset, id: 'expired', path: 'C:/Media/expired.mp4', proxyPath: 'C:/Proxy/expired.mp4' };

    expect(
      markExpiredProxyAssets([fresh, expired], {
        'C:/Media/fresh.mp4': { size: 4000, mtimeMs: 1000 },
        'C:/Media/expired.mp4': { size: 4000, mtimeMs: 2500 }
      })
    ).toEqual([fresh, { ...expired, proxyStatus: 'error', proxyError: 'Proxy expired' }]);
  });

  it('builds storage stats and skips timeline-used proxies during cleanup', () => {
    const used = { ...baseAsset, id: 'asset-used', proxyPath: 'C:/Proxy/used.mp4' };
    const unused = { ...baseAsset, id: 'asset-unused', proxyPath: 'C:/Proxy/unused.mp4' };
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-used', mediaId: 'asset-used', trackId: 'track-video' })]);
    const inventory = buildProxyInventory([used, unused], {
      timeline,
      proxyStats: {
        'C:/Proxy/used.mp4': { size: 1000, mtimeMs: 2000 },
        'C:/Proxy/unused.mp4': { size: 2000, mtimeMs: 2100 }
      }
    });

    expect(summarizeProxyInventory(inventory)).toMatchObject({ totalBytes: 3000, fileCount: 2 });
    expect(planProxyCleanup(inventory)).toEqual({ deletePaths: ['C:/Proxy/unused.mp4'], skippedInUsePaths: ['C:/Proxy/used.mp4'] });
    expect(planProxyBatchDelete(inventory, ['asset-used', 'asset-unused'])).toEqual(['C:/Proxy/used.mp4', 'C:/Proxy/unused.mp4']);
  });

  it('plans proxy directory migrations and calculates coverage stats', () => {
    const updates = buildProxyMigration([baseAsset], 'D:\\Proxy Archive\\');

    expect(updates).toEqual([
      {
        assetId: 'asset-video',
        fromPath: 'C:/Proxy/source-proxy.mp4',
        toPath: 'D:/Proxy Archive/asset-video-source-proxy.mp4'
      }
    ]);
    expect(calculateProxyCoverageStats([baseAsset, { ...baseAsset, id: 'missing-proxy', proxyPath: undefined, proxyStatus: 'none' }])).toMatchObject({
      proxiedMediaCount: 1,
      totalMediaCount: 2,
      coverageRatio: 0.5,
      estimatedPreviewSecondsSaved: 10
    });
  });

  it('detects proxies needing regeneration and enforces a 24 hour integrity interval', () => {
    const inventory = buildProxyInventory(
      [
        baseAsset,
        { ...baseAsset, id: 'corrupt', proxyPath: 'C:/Proxy/corrupt.mp4' },
        { ...baseAsset, id: 'missing', proxyPath: 'C:/Proxy/missing.mp4' }
      ],
      {
        existingProxyPaths: new Set(['C:/Proxy/source-proxy.mp4', 'C:/Proxy/corrupt.mp4']),
        proxyStats: {
          'C:/Proxy/source-proxy.mp4': { size: 1000, mtimeMs: 1000 },
          'C:/Proxy/corrupt.mp4': { size: 0, mtimeMs: 1000 }
        }
      }
    );

    expect(getProxyAssetsNeedingRegeneration(inventory)).toEqual(['corrupt', 'missing']);
    expect(shouldRunProxyIntegrityCheck(undefined, 10)).toBe(true);
    expect(shouldRunProxyIntegrityCheck(0, 23 * 60 * 60 * 1000)).toBe(false);
    expect(shouldRunProxyIntegrityCheck(1000, 1000 + 23 * 60 * 60 * 1000)).toBe(false);
    expect(shouldRunProxyIntegrityCheck(1000, 1000 + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('builds a seven day proxy storage trend', () => {
    const now = Date.UTC(2026, 5, 18, 12);
    const inventory = [
      { assetId: 'old', sourcePath: 'a', sourceName: 'a', proxyPath: 'p1', status: 'ready' as const, size: 100, generatedAtMs: now - 3 * 24 * 60 * 60 * 1000, inUse: false },
      { assetId: 'new', sourcePath: 'b', sourceName: 'b', proxyPath: 'p2', status: 'ready' as const, size: 200, generatedAtMs: now, inUse: false }
    ];

    expect(buildProxyStorageTrend(inventory, now, 4)).toEqual([
      { day: '2026-06-15', totalBytes: 100 },
      { day: '2026-06-16', totalBytes: 100 },
      { day: '2026-06-17', totalBytes: 100 },
      { day: '2026-06-18', totalBytes: 300 }
    ]);
  });
});
