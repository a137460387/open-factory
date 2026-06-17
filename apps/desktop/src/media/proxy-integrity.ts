import {
  buildProxyInventory,
  getProxyAssetsNeedingRegeneration,
  shouldRunProxyIntegrityCheck,
  type Project,
  type ProxyFileStatLike,
  type ProxyInventoryItem
} from '@open-factory/editor-core';
import { fsExists, getFileStat } from '../lib/tauri-bridge';

const PROXY_INTEGRITY_LAST_RUN_KEY = 'open-factory:proxy-integrity-last-run';

export interface ProxyIntegrityCheckDependencies {
  nowMs?: number;
  intervalMs?: number;
  getLastRunAtMs?(): number | undefined;
  setLastRunAtMs?(value: number): void;
  fileExists?(path: string): Promise<boolean> | boolean;
  readFileStat?(path: string): Promise<ProxyFileStatLike> | ProxyFileStatLike;
  enqueueProxyAssets?(assetIds: string[]): Promise<void> | void;
}

export interface ProxyIntegrityCheckResult {
  ran: boolean;
  assetIds: string[];
  inventory: ProxyInventoryItem[];
}

export async function runScheduledProxyIntegrityCheck(project: Project, dependencies: ProxyIntegrityCheckDependencies = {}): Promise<ProxyIntegrityCheckResult> {
  const nowMs = dependencies.nowMs ?? Date.now();
  const lastRunAtMs = dependencies.getLastRunAtMs?.() ?? readLastRunAtMs();
  if (!shouldRunProxyIntegrityCheck(lastRunAtMs, nowMs, dependencies.intervalMs)) {
    return { ran: false, assetIds: [], inventory: [] };
  }

  const inventory = await collectProxyIntegrityInventory(project, dependencies);
  const assetIds = getProxyAssetsNeedingRegeneration(inventory);
  if (assetIds.length > 0) {
    await dependencies.enqueueProxyAssets?.(assetIds);
  }
  (dependencies.setLastRunAtMs ?? writeLastRunAtMs)(nowMs);
  return { ran: true, assetIds, inventory };
}

export async function collectProxyIntegrityInventory(project: Project, dependencies: ProxyIntegrityCheckDependencies = {}): Promise<ProxyInventoryItem[]> {
  const sourceStats: Record<string, ProxyFileStatLike | undefined> = {};
  const proxyStats: Record<string, ProxyFileStatLike | undefined> = {};
  const existingProxyPaths = new Set<string>();
  const proxiedAssets = project.media.filter((asset) => asset.proxyPath);
  for (const asset of proxiedAssets) {
    sourceStats[asset.path] = await safeStat(asset.path, dependencies);
    if (!asset.proxyPath) {
      continue;
    }
    const exists = await safeExists(asset.proxyPath, dependencies);
    if (exists) {
      existingProxyPaths.add(asset.proxyPath);
      proxyStats[asset.proxyPath] = await safeStat(asset.proxyPath, dependencies);
    }
  }
  return buildProxyInventory(project.media, { sourceStats, proxyStats, existingProxyPaths, timeline: project.timeline });
}

async function safeExists(path: string, dependencies: ProxyIntegrityCheckDependencies): Promise<boolean> {
  try {
    return await (dependencies.fileExists ?? fsExists)(path);
  } catch {
    return false;
  }
}

async function safeStat(path: string, dependencies: ProxyIntegrityCheckDependencies): Promise<ProxyFileStatLike | undefined> {
  try {
    return await (dependencies.readFileStat ?? getFileStat)(path);
  } catch {
    return undefined;
  }
}

function readLastRunAtMs(): number | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const raw = window.localStorage.getItem(PROXY_INTEGRITY_LAST_RUN_KEY);
  if (raw === null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function writeLastRunAtMs(value: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PROXY_INTEGRITY_LAST_RUN_KEY, String(value));
}
