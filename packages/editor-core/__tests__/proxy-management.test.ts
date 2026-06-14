import { describe, expect, it } from 'vitest';
import { buildProxyInventory, markExpiredProxyAssets, planProxyBatchDelete, planProxyCleanup, summarizeProxyInventory, validateProxyAsset } from '../src';
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
});
