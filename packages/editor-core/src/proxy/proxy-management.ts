import type { MediaAsset, Timeline } from '../model';

export type ProxyInventoryStatus = 'ready' | 'pending' | 'missing' | 'expired' | 'corrupt' | 'error';

export interface ProxyFileStatLike {
  size: number;
  mtimeMs: number;
}

export interface ProxyInventoryItem {
  assetId: string;
  sourcePath: string;
  sourceName: string;
  proxyPath: string;
  status: ProxyInventoryStatus;
  size: number;
  generatedAtMs?: number;
  sourceMtimeMs?: number;
  currentSourceMtimeMs?: number;
  inUse: boolean;
  error?: string;
}

export interface ProxyInventoryStats {
  totalBytes: number;
  fileCount: number;
  expiredCount: number;
  corruptCount: number;
  missingCount: number;
}

export interface ProxyCleanupPlan {
  deletePaths: string[];
  skippedInUsePaths: string[];
}

export function validateProxyAsset(
  asset: MediaAsset,
  input: {
    proxyExists?: boolean;
    proxyStat?: ProxyFileStatLike;
    sourceStat?: ProxyFileStatLike;
  } = {}
): ProxyInventoryStatus {
  if (!asset.proxyPath || asset.proxyStatus === 'pending') {
    return 'pending';
  }
  if (asset.proxyStatus === 'error') {
    return 'error';
  }
  if (input.proxyExists === false) {
    return 'missing';
  }
  if (input.proxyStat && input.proxyStat.size <= 0) {
    return 'corrupt';
  }
  if (input.sourceStat && asset.mtimeMs && input.sourceStat.mtimeMs > asset.mtimeMs + 1) {
    return 'expired';
  }
  return 'ready';
}

export function buildProxyInventory(
  media: MediaAsset[],
  input: {
    sourceStats?: Record<string, ProxyFileStatLike | undefined>;
    proxyStats?: Record<string, ProxyFileStatLike | undefined>;
    existingProxyPaths?: Set<string>;
    timeline?: Timeline;
  } = {}
): ProxyInventoryItem[] {
  const inUseProxyPaths = collectTimelineProxyPaths(media, input.timeline);
  return media
    .filter((asset) => Boolean(asset.proxyPath))
    .map((asset) => {
      const proxyPath = asset.proxyPath!;
      const proxyStat = input.proxyStats?.[proxyPath];
      const sourceStat = input.sourceStats?.[asset.path];
      const status = validateProxyAsset(asset, {
        proxyExists: input.existingProxyPaths ? input.existingProxyPaths.has(proxyPath) : proxyStat ? true : undefined,
        proxyStat,
        sourceStat
      });
      return {
        assetId: asset.id,
        sourcePath: asset.path,
        sourceName: asset.name,
        proxyPath,
        status,
        size: proxyStat?.size ?? 0,
        generatedAtMs: proxyStat?.mtimeMs,
        sourceMtimeMs: asset.mtimeMs,
        currentSourceMtimeMs: sourceStat?.mtimeMs,
        inUse: inUseProxyPaths.has(proxyPath),
        error: status === 'error' ? asset.proxyError : undefined
      };
    });
}

export function summarizeProxyInventory(items: ProxyInventoryItem[]): ProxyInventoryStats {
  return {
    totalBytes: items.reduce((total, item) => total + Math.max(0, item.size), 0),
    fileCount: items.length,
    expiredCount: items.filter((item) => item.status === 'expired').length,
    corruptCount: items.filter((item) => item.status === 'corrupt').length,
    missingCount: items.filter((item) => item.status === 'missing').length
  };
}

export function planProxyCleanup(items: ProxyInventoryItem[]): ProxyCleanupPlan {
  return {
    deletePaths: items.filter((item) => !item.inUse && item.proxyPath).map((item) => item.proxyPath),
    skippedInUsePaths: items.filter((item) => item.inUse && item.proxyPath).map((item) => item.proxyPath)
  };
}

export function planProxyBatchDelete(items: ProxyInventoryItem[], assetIds: string[]): string[] {
  const selected = new Set(assetIds);
  return items.filter((item) => selected.has(item.assetId) && item.proxyPath).map((item) => item.proxyPath);
}

export function markExpiredProxyAssets(media: MediaAsset[], sourceStats: Record<string, ProxyFileStatLike | undefined>): MediaAsset[] {
  return media.map((asset) => {
    if (!asset.proxyPath) {
      return asset;
    }
    const status = validateProxyAsset(asset, { sourceStat: sourceStats[asset.path] });
    return status === 'expired' ? { ...asset, proxyStatus: 'error', proxyError: 'Proxy expired' } : asset;
  });
}

function collectTimelineProxyPaths(media: MediaAsset[], timeline: Timeline | undefined): Set<string> {
  if (!timeline) {
    return new Set();
  }
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const paths = new Set<string>();
  for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
    const mediaId = 'mediaId' in clip ? clip.mediaId : undefined;
    const proxyPath = mediaId ? mediaById.get(mediaId)?.proxyPath : undefined;
    if (proxyPath) {
      paths.add(proxyPath);
    }
  }
  return paths;
}
