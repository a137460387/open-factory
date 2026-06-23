import type { MediaAsset } from '../model-types';
import type { ProxyFileStatLike, ProxyInventoryItem, ProxyInventoryStatus } from './proxy-management';
import { validateProxyAsset, buildProxyInventory } from './proxy-management';

export type ProxyHealthCategory = 'healthy' | 'expired' | 'corrupt' | 'missing';

export interface ProxyVerifyResult {
  assetId: string;
  assetName: string;
  proxyPath: string;
  category: ProxyHealthCategory;
  readable: boolean;
  sourceMtimeMs?: number;
  proxyMtimeMs?: number;
  proxySize?: number;
  error?: string;
}

export interface ProxyBatchVerifyReport {
  totalCount: number;
  healthyCount: number;
  expiredCount: number;
  corruptCount: number;
  missingCount: number;
  results: ProxyVerifyResult[];
  verifiedAt: number;
}

export type ProxyVerifySchedule = 'startup' | 'weekly' | 'manual';

export interface ProxyRepairProgress {
  totalToRepair: number;
  completed: number;
  failed: number;
  currentAssetId?: string;
  errors: Array<{ assetId: string; error: string }>;
}

export interface ProxyRepairHistoryEntry {
  timestamp: number;
  totalAttempted: number;
  successCount: number;
  failCount: number;
  durationMs: number;
}

export interface ProxyBatchVerifySettings {
  schedule: ProxyVerifySchedule;
  lastRunAt?: number;
  lastRepairHistory?: ProxyRepairHistoryEntry;
}

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function categorizeProxyHealth(item: ProxyInventoryItem): ProxyHealthCategory {
  if (item.status === 'ready') return 'healthy';
  if (item.status === 'expired') return 'expired';
  if (item.status === 'corrupt' || item.status === 'error') return 'corrupt';
  return 'missing';
}

export function classifyProxyVerifyResult(
  asset: MediaAsset,
  proxyExists: boolean,
  proxyReadable: boolean,
  proxyStat?: ProxyFileStatLike,
  sourceStat?: ProxyFileStatLike,
): ProxyVerifyResult {
  const status = validateProxyAsset(asset, {
    proxyExists,
    proxyStat,
    sourceStat,
  });
  let category: ProxyHealthCategory;
  if (!proxyExists) {
    category = 'missing';
  } else if (!proxyReadable || proxyStat?.size === 0) {
    category = 'corrupt';
  } else if (status === 'expired') {
    category = 'expired';
  } else {
    category = 'healthy';
  }
  return {
    assetId: asset.id,
    assetName: asset.name,
    proxyPath: asset.proxyPath ?? '',
    category,
    readable: proxyReadable,
    sourceMtimeMs: sourceStat?.mtimeMs,
    proxyMtimeMs: proxyStat?.mtimeMs,
    proxySize: proxyStat?.size,
    error: category !== 'healthy' ? `proxy_${category}` : undefined,
  };
}

export function buildBatchVerifyReport(results: ProxyVerifyResult[]): ProxyBatchVerifyReport {
  return {
    totalCount: results.length,
    healthyCount: results.filter((r) => r.category === 'healthy').length,
    expiredCount: results.filter((r) => r.category === 'expired').length,
    corruptCount: results.filter((r) => r.category === 'corrupt').length,
    missingCount: results.filter((r) => r.category === 'missing').length,
    results,
    verifiedAt: Date.now(),
  };
}

export function collectRepairAssetIds(report: ProxyBatchVerifyReport): string[] {
  return report.results
    .filter((r) => r.category !== 'healthy')
    .map((r) => r.assetId);
}

export function shouldRunScheduledVerify(settings: ProxyBatchVerifySettings, nowMs: number): boolean {
  if (settings.schedule === 'manual') return false;
  if (settings.schedule === 'startup') return true;
  if (!settings.lastRunAt) return true;
  return nowMs - settings.lastRunAt >= WEEKLY_INTERVAL_MS;
}

export function updateRepairProgress(
  progress: ProxyRepairProgress,
  assetId: string,
  success: boolean,
  error?: string,
): ProxyRepairProgress {
  return {
    ...progress,
    completed: progress.completed + (success ? 1 : 0),
    failed: progress.failed + (success ? 0 : 1),
    currentAssetId: undefined,
    errors: success
      ? progress.errors
      : [...progress.errors, { assetId, error: error ?? 'unknown_error' }],
  };
}

export function createRepairProgress(totalToRepair: number): ProxyRepairProgress {
  return { totalToRepair, completed: 0, failed: 0, errors: [] };
}

export function buildRepairHistoryEntry(
  progress: ProxyRepairProgress,
  startedAt: number,
): ProxyRepairHistoryEntry {
  return {
    timestamp: Date.now(),
    totalAttempted: progress.completed + progress.failed,
    successCount: progress.completed,
    failCount: progress.failed,
    durationMs: Date.now() - startedAt,
  };
}

export function filterAssetsWithProxy(media: MediaAsset[]): MediaAsset[] {
  return media.filter((a) => Boolean(a.proxyPath));
}
