import { useEffect, useState } from 'react';
import type { Project, ProxyInventoryItem } from '@open-factory/editor-core';
import {
  buildProxyInventory,
  buildProxyStorageTrend,
  calculateProxyCoverageStats,
  planProxyCleanup,
  summarizeProxyInventory,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { fsExists, getFileStat, openDirectoryDialog } from '../lib/tauri-bridge';
import {
  PROXY_RESOLUTION_PRESETS,
  PROXY_TRIGGER_THRESHOLDS,
  type ProxyResolutionPreset,
  type ProxyTriggerThreshold,
} from '../store/proxySettingsStore';
import { formatBytes, formatDateTime, formatDurationSeconds } from './formatHelpers';

export type { ProxyResolutionPreset, ProxyTriggerThreshold };

export function ProxySettingsPanel({
  project,
  resolutionPreset,
  triggerShortEdge,
  onResolutionPresetChange,
  onTriggerShortEdgeChange,
  onDeleteProxies,
  onRegenerateProxies,
  onMigrateProxies,
  onReset,
}: {
  project: Project;
  resolutionPreset: ProxyResolutionPreset;
  triggerShortEdge: ProxyTriggerThreshold;
  onResolutionPresetChange(preset: ProxyResolutionPreset): void;
  onTriggerShortEdgeChange(threshold: ProxyTriggerThreshold): void;
  onDeleteProxies(assetIds: string[]): Promise<void> | void;
  onRegenerateProxies(assetIds: string[]): Promise<void> | void;
  onMigrateProxies(targetDirectory: string): Promise<void> | void;
  onReset(): void;
}) {
  const t = zhCN.settings.proxy;
  const [items, setItems] = useState<ProxyInventoryItem[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const stats = summarizeProxyInventory(items);
  const coverageStats = calculateProxyCoverageStats(project.media);
  const storageTrend = buildProxyStorageTrend(items, Date.now(), 7);

  const refreshInventory = async () => {
    setRefreshing(true);
    try {
      const proxyStats: Record<string, { size: number; mtimeMs: number } | undefined> = {};
      const sourceStats: Record<string, { size: number; mtimeMs: number } | undefined> = {};
      const existingProxyPaths = new Set<string>();
      const proxiedAssets = project.media.filter((asset) => asset.proxyPath);
      for (const asset of proxiedAssets) {
        try {
          sourceStats[asset.path] = await getFileStat(asset.path);
        } catch {
          sourceStats[asset.path] = undefined;
        }
        if (!asset.proxyPath) {
          continue;
        }
        const exists = await fsExists(asset.proxyPath).catch(() => false);
        if (exists) {
          existingProxyPaths.add(asset.proxyPath);
          try {
            proxyStats[asset.proxyPath] = await getFileStat(asset.proxyPath);
          } catch {
            proxyStats[asset.proxyPath] = undefined;
          }
        }
      }
      const nextItems = buildProxyInventory(project.media, {
        sourceStats,
        proxyStats,
        existingProxyPaths,
        timeline: project.timeline,
      });
      setItems(nextItems);
      setSelectedAssetIds(
        (current) => new Set(nextItems.filter((item) => current.has(item.assetId)).map((item) => item.assetId)),
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshInventory();
  }, [project.media, project.timeline]);

  const selectedItems = items.filter((item) => selectedAssetIds.has(item.assetId));
  const allSelected = items.length > 0 && selectedAssetIds.size === items.length;
  const toggleSelection = (assetId: string) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };
  const deleteSelected = async (assetIds: string[]) => {
    if (assetIds.length === 0) {
      return;
    }
    await onDeleteProxies(assetIds);
    setSelectedAssetIds(new Set());
    await refreshInventory();
  };
  const clearUnused = async () => {
    const cleanup = planProxyCleanup(items);
    const deleteAssetIds = items
      .filter((item) => cleanup.deletePaths.includes(item.proxyPath))
      .map((item) => item.assetId);
    await deleteSelected(deleteAssetIds);
  };
  const migrateDirectory = async () => {
    const targetDirectory = await openDirectoryDialog();
    if (!targetDirectory) {
      return;
    }
    setMigrating(true);
    try {
      await onMigrateProxies(targetDirectory);
      await refreshInventory();
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="proxy-settings-reset-button"
          onClick={onReset}
        >
          {t.reset}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          {t.resolution}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={resolutionPreset}
            data-testid="proxy-resolution-select"
            onChange={(event) => onResolutionPresetChange(normalizeProxyResolutionPreset(event.target.value))}
          >
            {Object.keys(PROXY_RESOLUTION_PRESETS).map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.triggerThreshold}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={triggerShortEdge}
            data-testid="proxy-threshold-select"
            onChange={(event) => onTriggerShortEdgeChange(normalizeProxyTriggerThreshold(event.target.value))}
          >
            {PROXY_TRIGGER_THRESHOLDS.map((threshold) => (
              <option key={threshold} value={threshold}>
                {t.thresholdOption(threshold)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3" data-testid="proxy-stats-dashboard">
        <div className="rounded-md border border-line bg-white p-3">
          <div className="text-[11px] font-semibold uppercase text-slate-500">{t.coverage}</div>
          <div className="mt-1 text-lg font-semibold text-ink" data-testid="proxy-coverage-ratio">
            {Math.round(coverageStats.coverageRatio * 100)}%
          </div>
          <div className="text-[11px] text-slate-500">
            {coverageStats.proxiedMediaCount}/{coverageStats.totalMediaCount}
          </div>
        </div>
        <div className="rounded-md border border-line bg-white p-3">
          <div className="text-[11px] font-semibold uppercase text-slate-500">{t.previewSaved}</div>
          <div className="mt-1 text-lg font-semibold text-ink" data-testid="proxy-preview-saved">
            {formatDurationSeconds(coverageStats.estimatedPreviewSecondsSaved)}
          </div>
        </div>
        <div className="rounded-md border border-line bg-white p-3">
          <div className="text-[11px] font-semibold uppercase text-slate-500">{t.storageTrend}</div>
          <div className="mt-2 flex h-8 items-end gap-1" data-testid="proxy-storage-trend">
            {storageTrend.map((point) => {
              const maxBytes = Math.max(1, ...storageTrend.map((item) => item.totalBytes));
              const height = Math.max(2, Math.round((point.totalBytes / maxBytes) * 32));
              return (
                <span
                  key={point.day}
                  className="w-full rounded-sm bg-brand/70"
                  title={`${point.day}: ${formatBytes(point.totalBytes)}`}
                  style={{ height }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-md border border-line bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-ink">{t.managementTitle}</h4>
            <div className="mt-1 text-xs text-slate-500" data-testid="proxy-storage-stats">
              {t.storageStats(stats.fileCount, formatBytes(stats.totalBytes))}
              {stats.expiredCount > 0 ? ` · ${t.expiredCount(stats.expiredCount)}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid="proxy-verify-button"
              disabled={refreshing}
              onClick={() => void refreshInventory()}
            >
              {refreshing ? t.verifying : t.verify}
            </button>
            <button
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-slate-700 hover:bg-panel disabled:opacity-40"
              type="button"
              data-testid="proxy-regenerate-selected-button"
              disabled={selectedItems.length === 0}
              onClick={() => void onRegenerateProxies(selectedItems.map((item) => item.assetId))}
            >
              {t.regenerateSelected}
            </button>
            <button
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              type="button"
              data-testid="proxy-delete-selected-button"
              disabled={selectedItems.length === 0}
              onClick={() => void deleteSelected(selectedItems.map((item) => item.assetId))}
            >
              {t.deleteSelected}
            </button>
            <button
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid="proxy-clear-unused-button"
              onClick={() => void clearUnused()}
            >
              {t.clearUnused}
            </button>
            <button
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-slate-700 hover:bg-panel disabled:opacity-40"
              type="button"
              data-testid="proxy-migrate-directory-button"
              disabled={migrating || items.length === 0}
              onClick={() => void migrateDirectory()}
            >
              {migrating ? t.migrating : t.migrateDirectory}
            </button>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={allSelected}
            data-testid="proxy-select-all-checkbox"
            onChange={(event) =>
              setSelectedAssetIds(event.target.checked ? new Set(items.map((item) => item.assetId)) : new Set())
            }
          />
          {t.selectAll}
        </label>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="w-8 py-1" />
                <th className="py-1 pr-3">{t.sourceFile}</th>
                <th className="py-1 pr-3">{t.proxyFile}</th>
                <th className="py-1 pr-3">{t.size}</th>
                <th className="py-1 pr-3">{t.generatedAt}</th>
                <th className="py-1">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>
                    {t.emptyList}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.assetId} className="border-t border-line" data-testid="proxy-management-row">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.has(item.assetId)}
                        data-testid={`proxy-select-${item.assetId}`}
                        onChange={() => toggleSelection(item.assetId)}
                      />
                    </td>
                    <td className="max-w-52 py-2 pr-3">
                      <div className="truncate font-medium text-slate-700">{item.sourceName}</div>
                      <div className="truncate text-slate-500">{item.sourcePath}</div>
                    </td>
                    <td className="max-w-64 py-2 pr-3 text-slate-500">
                      <div className="truncate">{item.proxyPath}</div>
                      {item.inUse ? <div className="mt-0.5 text-[11px] text-emerald-700">{t.inUse}</div> : null}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{formatBytes(item.size)}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {item.generatedAtMs ? formatDateTime(item.generatedAtMs) : t.unknown}
                    </td>
                    <td className="py-2">
                      <ProxyInventoryStatusBadge item={item} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProxyInventoryStatusBadge({ item }: { item: ProxyInventoryItem }) {
  const t = zhCN.settings.proxy.statuses;
  const tone =
    item.status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : item.status === 'expired' || item.status === 'corrupt' || item.status === 'missing'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : item.status === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      title={item.error}
      data-testid={`proxy-management-status-${item.assetId}`}
      data-proxy-status={item.status}
    >
      {t[item.status]}
    </span>
  );
}

function normalizeProxyResolutionPreset(value: string): ProxyResolutionPreset {
  return value === '540p' || value === '1080p' ? value : '720p';
}

function normalizeProxyTriggerThreshold(value: string): ProxyTriggerThreshold {
  const numeric = Number(value);
  return PROXY_TRIGGER_THRESHOLDS.includes(numeric as ProxyTriggerThreshold)
    ? (numeric as ProxyTriggerThreshold)
    : 1080;
}
