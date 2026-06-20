import type { MediaAsset, Project } from '../model-types';
import type { ProjectHealthReport } from './project-health-check';

export interface MediaHealthFileStat {
  size: number;
  mtimeMs: number;
}

export interface MediaHealthDashboardInput {
  sourceStats?: Record<string, MediaHealthFileStat | undefined>;
  proxyStats?: Record<string, MediaHealthFileStat | undefined>;
  cacheBytes?: number;
  nowMs?: number;
}

export interface MediaHealthRingProgress {
  value: number;
  total: number;
  ratio: number;
  percent: number;
  dashArray: string;
}

export interface MediaHealthStorageSegment {
  kind: 'media' | 'proxy' | 'cache';
  bytes: number;
  ratio: number;
}

export interface MediaHealthTrendPoint {
  day: string;
  count: number;
}

export type MediaHealthRepairTaskType = 'generate-missing-proxies' | 'clean-unused-media' | 'rebuild-damaged-cache';

export interface MediaHealthRepairTask {
  type: MediaHealthRepairTaskType;
  count: number;
  assetIds: string[];
}

export interface MediaHealthDashboard {
  proxyCoverage: {
    ready: number;
    total: number;
    progress: MediaHealthRingProgress;
  };
  missingMedia: {
    count: number;
    assetIds: string[];
  };
  expiredProxies: {
    count: number;
    assetIds: string[];
  };
  unusedMedia: {
    count: number;
    assetIds: string[];
  };
  storage: {
    mediaBytes: number;
    proxyBytes: number;
    cacheBytes: number;
    totalBytes: number;
    segments: MediaHealthStorageSegment[];
  };
  recentImports: {
    points: MediaHealthTrendPoint[];
  };
  repairTasks: MediaHealthRepairTask[];
  issueCount: number;
}

export interface MediaHealthAutoShowOptions {
  enabled: boolean;
  issueCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildMediaHealthDashboard(project: Project, report: ProjectHealthReport, input: MediaHealthDashboardInput = {}): MediaHealthDashboard {
  const videoAssets = project.media.filter((asset) => asset.type === 'video');
  const readyProxyAssets = videoAssets.filter((asset) => Boolean(asset.proxyPath && asset.proxyStatus === 'ready'));
  const expiredProxyAssetIds = collectExpiredProxyAssetIds(project.media, input.sourceStats, input.proxyStats);
  const mediaBytes = sumMediaBytes(project.media, input.sourceStats);
  const proxyBytes = sumProxyBytes(project.media, input.proxyStats);
  const cacheBytes = Math.max(0, Math.round(input.cacheBytes ?? 0));
  const totalBytes = mediaBytes + proxyBytes + cacheBytes;
  const missingAssetIds = report.missingMedia.map((issue) => issue.assetId);
  const unusedAssetIds = report.orphanMedia.map((issue) => issue.assetId);
  const dashboardWithoutTasks = {
    proxyCoverage: {
      ready: readyProxyAssets.length,
      total: videoAssets.length,
      progress: calculateMediaHealthRingProgress(readyProxyAssets.length, videoAssets.length)
    },
    missingMedia: {
      count: missingAssetIds.length,
      assetIds: missingAssetIds
    },
    expiredProxies: {
      count: expiredProxyAssetIds.length,
      assetIds: expiredProxyAssetIds
    },
    unusedMedia: {
      count: unusedAssetIds.length,
      assetIds: unusedAssetIds
    },
    storage: {
      mediaBytes,
      proxyBytes,
      cacheBytes,
      totalBytes,
      segments: buildStorageSegments(mediaBytes, proxyBytes, cacheBytes)
    },
    recentImports: {
      points: buildRecentImportTrend(project.media, input.nowMs ?? Date.now(), 7)
    },
    issueCount: missingAssetIds.length + expiredProxyAssetIds.length + unusedAssetIds.length + report.proxyMissing.length
  };

  return {
    ...dashboardWithoutTasks,
    repairTasks: planMediaHealthRepairTasks(report, dashboardWithoutTasks.expiredProxies.assetIds)
  };
}

export function calculateMediaHealthRingProgress(value: number, total: number, circumference = 100): MediaHealthRingProgress {
  const safeTotal = Math.max(0, Math.round(total));
  const safeValue = Math.max(0, Math.min(Math.round(value), safeTotal));
  const ratio = safeTotal === 0 ? 1 : safeValue / safeTotal;
  const percent = Math.round(ratio * 100);
  const visible = Math.round(ratio * circumference * 100) / 100;
  const hidden = Math.round((circumference - visible) * 100) / 100;
  return {
    value: safeValue,
    total: safeTotal,
    ratio,
    percent,
    dashArray: `${visible} ${hidden}`
  };
}

export function buildRecentImportTrend(media: MediaAsset[], nowMs: number, days = 7): MediaHealthTrendPoint[] {
  const safeDays = Math.max(1, Math.round(days));
  const firstDayMs = startOfUtcDay(nowMs) - (safeDays - 1) * DAY_MS;
  const points = Array.from({ length: safeDays }, (_, index) => ({
    day: new Date(firstDayMs + index * DAY_MS).toISOString().slice(0, 10),
    count: 0
  }));
  const byDay = new Map(points.map((point) => [point.day, point]));
  for (const asset of media) {
    if (!asset.importedAt) {
      continue;
    }
    const importedMs = Date.parse(asset.importedAt);
    if (!Number.isFinite(importedMs) || importedMs < firstDayMs || importedMs >= firstDayMs + safeDays * DAY_MS) {
      continue;
    }
    const day = new Date(startOfUtcDay(importedMs)).toISOString().slice(0, 10);
    const point = byDay.get(day);
    if (point) {
      point.count += 1;
    }
  }
  return points;
}

export function planMediaHealthRepairTasks(report: ProjectHealthReport, expiredProxyAssetIds: string[]): MediaHealthRepairTask[] {
  const tasks: MediaHealthRepairTask[] = [];
  if (report.proxyMissing.length > 0) {
    tasks.push({
      type: 'generate-missing-proxies',
      count: report.proxyMissing.length,
      assetIds: report.proxyMissing.map((issue) => issue.assetId)
    });
  }
  if (report.orphanMedia.length > 0) {
    tasks.push({
      type: 'clean-unused-media',
      count: report.orphanMedia.length,
      assetIds: report.orphanMedia.map((issue) => issue.assetId)
    });
  }
  if (expiredProxyAssetIds.length > 0) {
    tasks.push({
      type: 'rebuild-damaged-cache',
      count: expiredProxyAssetIds.length,
      assetIds: [...expiredProxyAssetIds]
    });
  }
  return tasks;
}

export function shouldAutoShowMediaHealthDashboard(options: MediaHealthAutoShowOptions): boolean {
  return options.enabled && options.issueCount > 0;
}

function collectExpiredProxyAssetIds(
  media: MediaAsset[],
  sourceStats: Record<string, MediaHealthFileStat | undefined> | undefined,
  proxyStats: Record<string, MediaHealthFileStat | undefined> | undefined
): string[] {
  return media
    .filter((asset) => {
      if (!asset.proxyPath) {
        return false;
      }
      const sourceMtimeMs = sourceStats?.[asset.path]?.mtimeMs;
      const proxyMtimeMs = proxyStats?.[asset.proxyPath]?.mtimeMs;
      return Number.isFinite(sourceMtimeMs) && Number.isFinite(proxyMtimeMs) && sourceMtimeMs! > proxyMtimeMs! + 1;
    })
    .map((asset) => asset.id);
}

function sumMediaBytes(media: MediaAsset[], sourceStats: Record<string, MediaHealthFileStat | undefined> | undefined): number {
  return Math.max(
    0,
    Math.round(
      media.reduce((total, asset) => {
        const size = sourceStats?.[asset.path]?.size ?? asset.size ?? 0;
        return total + (Number.isFinite(size) && size > 0 ? size : 0);
      }, 0)
    )
  );
}

function sumProxyBytes(media: MediaAsset[], proxyStats: Record<string, MediaHealthFileStat | undefined> | undefined): number {
  const proxyPaths = new Set(media.map((asset) => asset.proxyPath).filter((path): path is string => Boolean(path)));
  let total = 0;
  for (const path of proxyPaths) {
    const size = proxyStats?.[path]?.size ?? 0;
    if (Number.isFinite(size) && size > 0) {
      total += size;
    }
  }
  return Math.max(0, Math.round(total));
}

function buildStorageSegments(mediaBytes: number, proxyBytes: number, cacheBytes: number): MediaHealthStorageSegment[] {
  const total = mediaBytes + proxyBytes + cacheBytes;
  return [
    { kind: 'media', bytes: mediaBytes, ratio: total === 0 ? 0 : mediaBytes / total },
    { kind: 'proxy', bytes: proxyBytes, ratio: total === 0 ? 0 : proxyBytes / total },
    { kind: 'cache', bytes: cacheBytes, ratio: total === 0 ? 0 : cacheBytes / total }
  ];
}

function startOfUtcDay(value: number): number {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
