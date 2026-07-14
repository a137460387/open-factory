import { logError } from '../lib/error-handlers';
import {
  buildMediaHealthDashboard,
  type MediaHealthDashboard,
  type MediaHealthFileStat,
  type Project,
  type ProjectHealthReport,
  type ProxySettings,
} from '@open-factory/editor-core';
import { isTauriRuntime } from './tauri';
import { getCacheSize, getFileStat, getTauriMocks } from './tauri-bridge';
import { scanProjectHealth } from './projectHealth';

const MEDIA_HEALTH_AUTO_SHOW_KEY = 'open-factory:media-health-dashboard-auto-show';

export interface MediaHealthDashboardScanResult {
  dashboard: MediaHealthDashboard;
  report: ProjectHealthReport;
}

export async function scanMediaHealthDashboard(
  project: Project,
  proxySettings?: ProxySettings,
): Promise<MediaHealthDashboardScanResult> {
  const report = await scanProjectHealth(project, proxySettings);
  const canReadNativeFiles = isTauriRuntime() || Boolean(getTauriMocks());
  const sourceStats: Record<string, MediaHealthFileStat | undefined> = {};
  const proxyStats: Record<string, MediaHealthFileStat | undefined> = {};
  let cacheBytes = 0;

  if (canReadNativeFiles) {
    await Promise.all(
      project.media.map(async (asset) => {
        sourceStats[asset.path] = await getFileStat(asset.path).catch(() => fallbackStat(asset.size, asset.mtimeMs));
        if (asset.proxyPath) {
          proxyStats[asset.proxyPath] = await getFileStat(asset.proxyPath).catch(logError('mediaHealthDashboard'));
        }
      }),
    );
    cacheBytes = await getCacheSize().catch(() => 0);
  } else {
    for (const asset of project.media) {
      sourceStats[asset.path] = fallbackStat(asset.size, asset.mtimeMs);
    }
  }

  return {
    report,
    dashboard: buildMediaHealthDashboard(project, report, {
      sourceStats,
      proxyStats,
      cacheBytes,
      nowMs: Date.now(),
    }),
  };
}

export function readMediaHealthAutoShowEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(MEDIA_HEALTH_AUTO_SHOW_KEY) === 'true';
}

export function writeMediaHealthAutoShowEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(MEDIA_HEALTH_AUTO_SHOW_KEY, enabled ? 'true' : 'false');
}

function fallbackStat(size: number | undefined, mtimeMs: number | undefined): MediaHealthFileStat | undefined {
  if (!Number.isFinite(size) && !Number.isFinite(mtimeMs)) {
    return undefined;
  }
  return {
    size: Number.isFinite(size) ? Math.max(0, Math.round(size!)) : 0,
    mtimeMs: Number.isFinite(mtimeMs) ? Math.max(0, Math.round(mtimeMs!)) : 0,
  };
}
