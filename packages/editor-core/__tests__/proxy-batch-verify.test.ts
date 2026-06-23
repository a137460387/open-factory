import { describe, expect, it } from 'vitest';
import {
  categorizeProxyHealth,
  classifyProxyVerifyResult,
  buildBatchVerifyReport,
  collectRepairAssetIds,
  shouldRunScheduledVerify,
  updateRepairProgress,
  createRepairProgress,
  buildRepairHistoryEntry,
  filterAssetsWithProxy,
  type ProxyVerifyResult,
  type ProxyBatchVerifySettings,
  type ProxyInventoryItem,
  type MediaAsset,
} from '../src';

function makeInventoryItem(overrides: Partial<ProxyInventoryItem> = {}): ProxyInventoryItem {
  return {
    assetId: overrides.assetId ?? 'asset-1',
    sourcePath: 'C:/Media/source.mp4',
    sourceName: 'source.mp4',
    proxyPath: 'C:/Proxy/source.mp4',
    status: overrides.status ?? 'ready',
    size: overrides.size ?? 1024,
    inUse: false,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: overrides.id ?? 'asset-1',
    type: 'video',
    name: 'source.mp4',
    path: 'C:/Media/source.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    proxyPath: overrides.proxyPath ?? 'C:/Proxy/source.mp4',
    proxyStatus: overrides.proxyStatus ?? 'ready',
    mtimeMs: 1000,
    ...overrides,
  };
}

describe('categorizeProxyHealth', () => {
  it('categorizes ready as healthy', () => {
    expect(categorizeProxyHealth(makeInventoryItem({ status: 'ready' }))).toBe('healthy');
  });

  it('categorizes expired as expired', () => {
    expect(categorizeProxyHealth(makeInventoryItem({ status: 'expired' }))).toBe('expired');
  });

  it('categorizes corrupt as corrupt', () => {
    expect(categorizeProxyHealth(makeInventoryItem({ status: 'corrupt' }))).toBe('corrupt');
  });

  it('categorizes missing as missing', () => {
    expect(categorizeProxyHealth(makeInventoryItem({ status: 'missing' }))).toBe('missing');
  });

  it('categorizes error as corrupt', () => {
    expect(categorizeProxyHealth(makeInventoryItem({ status: 'error' }))).toBe('corrupt');
  });
});

describe('classifyProxyVerifyResult', () => {
  it('classifies healthy proxy', () => {
    const result = classifyProxyVerifyResult(makeAsset(), true, true, { size: 1024, mtimeMs: 2000 }, { size: 4000, mtimeMs: 1000 });
    expect(result.category).toBe('healthy');
    expect(result.readable).toBe(true);
  });

  it('classifies missing proxy', () => {
    const result = classifyProxyVerifyResult(makeAsset(), false, false);
    expect(result.category).toBe('missing');
    expect(result.readable).toBe(false);
  });

  it('classifies corrupt proxy (not readable)', () => {
    const result = classifyProxyVerifyResult(makeAsset(), true, false, { size: 0, mtimeMs: 2000 });
    expect(result.category).toBe('corrupt');
  });

  it('classifies corrupt proxy (zero size)', () => {
    const result = classifyProxyVerifyResult(makeAsset(), true, true, { size: 0, mtimeMs: 2000 }, { size: 4000, mtimeMs: 1000 });
    expect(result.category).toBe('corrupt');
  });

  it('classifies expired proxy (source newer than proxy)', () => {
    const result = classifyProxyVerifyResult(
      makeAsset({ mtimeMs: 1000 }),
      true, true,
      { size: 1024, mtimeMs: 500 },
      { size: 4000, mtimeMs: 3000 },
    );
    expect(result.category).toBe('expired');
  });
});

describe('buildBatchVerifyReport', () => {
  it('counts categories correctly', () => {
    const results: ProxyVerifyResult[] = [
      { assetId: 'a1', assetName: 'a1', proxyPath: '', category: 'healthy', readable: true },
      { assetId: 'a2', assetName: 'a2', proxyPath: '', category: 'expired', readable: true, error: 'proxy_expired' },
      { assetId: 'a3', assetName: 'a3', proxyPath: '', category: 'corrupt', readable: false, error: 'proxy_corrupt' },
      { assetId: 'a4', assetName: 'a4', proxyPath: '', category: 'missing', readable: false, error: 'proxy_missing' },
    ];
    const report = buildBatchVerifyReport(results);
    expect(report.totalCount).toBe(4);
    expect(report.healthyCount).toBe(1);
    expect(report.expiredCount).toBe(1);
    expect(report.corruptCount).toBe(1);
    expect(report.missingCount).toBe(1);
  });
});

describe('collectRepairAssetIds', () => {
  it('collects non-healthy asset ids', () => {
    const report = buildBatchVerifyReport([
      { assetId: 'a1', assetName: 'a1', proxyPath: '', category: 'healthy', readable: true },
      { assetId: 'a2', assetName: 'a2', proxyPath: '', category: 'expired', readable: true, error: 'x' },
      { assetId: 'a3', assetName: 'a3', proxyPath: '', category: 'missing', readable: false, error: 'x' },
    ]);
    expect(collectRepairAssetIds(report)).toEqual(['a2', 'a3']);
  });
});

describe('shouldRunScheduledVerify', () => {
  it('always runs for startup schedule', () => {
    expect(shouldRunScheduledVerify({ schedule: 'startup', lastRunAt: Date.now() }, Date.now())).toBe(true);
  });

  it('never runs for manual schedule', () => {
    expect(shouldRunScheduledVerify({ schedule: 'manual' }, Date.now())).toBe(false);
  });

  it('runs weekly when interval exceeded', () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    expect(shouldRunScheduledVerify({ schedule: 'weekly', lastRunAt: eightDaysAgo }, now)).toBe(true);
  });

  it('skips weekly when interval not reached', () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    expect(shouldRunScheduledVerify({ schedule: 'weekly', lastRunAt: oneDayAgo }, now)).toBe(false);
  });

  it('runs weekly when no lastRunAt', () => {
    expect(shouldRunScheduledVerify({ schedule: 'weekly' }, Date.now())).toBe(true);
  });
});

describe('createRepairProgress / updateRepairProgress', () => {
  it('creates empty progress', () => {
    const p = createRepairProgress(5);
    expect(p.totalToRepair).toBe(5);
    expect(p.completed).toBe(0);
    expect(p.failed).toBe(0);
  });

  it('tracks successful repair', () => {
    const p = updateRepairProgress(createRepairProgress(3), 'a1', true);
    expect(p.completed).toBe(1);
    expect(p.failed).toBe(0);
  });

  it('tracks failed repair with error', () => {
    const p = updateRepairProgress(createRepairProgress(3), 'a2', false, 'timeout');
    expect(p.completed).toBe(0);
    expect(p.failed).toBe(1);
    expect(p.errors[0].assetId).toBe('a2');
    expect(p.errors[0].error).toBe('timeout');
  });
});

describe('buildRepairHistoryEntry', () => {
  it('records stats from progress', () => {
    let p = createRepairProgress(3);
    p = updateRepairProgress(p, 'a1', true);
    p = updateRepairProgress(p, 'a2', true);
    p = updateRepairProgress(p, 'a3', false, 'error');
    const entry = buildRepairHistoryEntry(p, Date.now() - 5000);
    expect(entry.successCount).toBe(2);
    expect(entry.failCount).toBe(1);
    expect(entry.totalAttempted).toBe(3);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('filterAssetsWithProxy', () => {
  it('filters to assets with proxyPath', () => {
    const assets = [
      makeAsset({ id: 'a1', proxyPath: 'proxy1' }),
      makeAsset({ id: 'a2', proxyPath: undefined }),
      makeAsset({ id: 'a3', proxyPath: 'proxy3' }),
    ];
    expect(filterAssetsWithProxy(assets).map((a) => a.id)).toEqual(['a1', 'a3']);
  });
});
