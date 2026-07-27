export function validateProxyAsset(asset, input = {}) {
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
export function buildProxyInventory(media, input = {}) {
    const inUseProxyPaths = collectTimelineProxyPaths(media, input.timeline);
    return media
        .filter((asset) => Boolean(asset.proxyPath))
        .map((asset) => {
        const proxyPath = asset.proxyPath;
        const proxyStat = input.proxyStats?.[proxyPath];
        const sourceStat = input.sourceStats?.[asset.path];
        const status = validateProxyAsset(asset, {
            proxyExists: input.existingProxyPaths ? input.existingProxyPaths.has(proxyPath) : proxyStat ? true : undefined,
            proxyStat,
            sourceStat,
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
            error: status === 'error' ? asset.proxyError : undefined,
        };
    });
}
export function summarizeProxyInventory(items) {
    return {
        totalBytes: items.reduce((total, item) => total + Math.max(0, item.size), 0),
        fileCount: items.length,
        expiredCount: items.filter((item) => item.status === 'expired').length,
        corruptCount: items.filter((item) => item.status === 'corrupt').length,
        missingCount: items.filter((item) => item.status === 'missing').length,
    };
}
export function planProxyCleanup(items) {
    return {
        deletePaths: items.filter((item) => !item.inUse && item.proxyPath).map((item) => item.proxyPath),
        skippedInUsePaths: items.filter((item) => item.inUse && item.proxyPath).map((item) => item.proxyPath),
    };
}
export function planProxyBatchDelete(items, assetIds) {
    const selected = new Set(assetIds);
    return items.filter((item) => selected.has(item.assetId) && item.proxyPath).map((item) => item.proxyPath);
}
export function buildProxyMigration(media, targetDirectory) {
    const target = normalizeDirectory(targetDirectory);
    const usedNames = new Set();
    return media
        .filter((asset) => Boolean(asset.proxyPath))
        .map((asset) => {
        const fileName = uniqueProxyFileName(`${asset.id}-${fileNameFromPath(asset.proxyPath)}`, usedNames);
        return {
            assetId: asset.id,
            fromPath: asset.proxyPath,
            toPath: `${target}/${fileName}`,
        };
    });
}
export function applyProxyMigration(media, updates) {
    const updateByAssetId = new Map(updates.map((update) => [update.assetId, update]));
    return media.map((asset) => {
        const update = updateByAssetId.get(asset.id);
        if (!update || asset.proxyPath !== update.fromPath) {
            return asset;
        }
        return {
            ...asset,
            proxyPath: update.toPath,
            proxyStatus: asset.type === 'video' ? 'ready' : asset.proxyStatus,
            proxyError: undefined,
        };
    });
}
export function getProxyAssetsNeedingRegeneration(items) {
    return items
        .filter((item) => item.status === 'expired' || item.status === 'corrupt' || item.status === 'missing')
        .map((item) => item.assetId);
}
export function shouldRunProxyIntegrityCheck(lastRunAtMs, nowMs, intervalMs = 24 * 60 * 60 * 1000) {
    return lastRunAtMs === undefined || nowMs - lastRunAtMs >= intervalMs;
}
export function calculateProxyCoverageStats(media) {
    const proxyCapable = media.filter((asset) => asset.type === 'video');
    const proxied = proxyCapable.filter((asset) => Boolean(asset.proxyPath && asset.proxyStatus === 'ready'));
    return {
        proxiedMediaCount: proxied.length,
        totalMediaCount: proxyCapable.length,
        coverageRatio: proxyCapable.length === 0 ? 1 : proxied.length / proxyCapable.length,
        estimatedPreviewSecondsSaved: proxied.reduce((total, asset) => total + Math.max(0, asset.duration ?? 0), 0),
    };
}
export function buildProxyStorageTrend(items, nowMs, days = 7) {
    const dayStarts = Array.from({ length: Math.max(1, days) }, (_, index) => startOfUtcDay(nowMs) - (Math.max(1, days) - 1 - index) * 24 * 60 * 60 * 1000);
    return dayStarts.map((dayStart) => {
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        return {
            day: new Date(dayStart).toISOString().slice(0, 10),
            totalBytes: items
                .filter((item) => (item.generatedAtMs ?? 0) < dayEnd)
                .reduce((total, item) => total + Math.max(0, item.size), 0),
        };
    });
}
export function markExpiredProxyAssets(media, sourceStats) {
    return media.map((asset) => {
        if (!asset.proxyPath) {
            return asset;
        }
        const status = validateProxyAsset(asset, { sourceStat: sourceStats[asset.path] });
        return status === 'expired' ? { ...asset, proxyStatus: 'error', proxyError: 'Proxy expired' } : asset;
    });
}
function collectTimelineProxyPaths(media, timeline) {
    if (!timeline) {
        return new Set();
    }
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    const paths = new Set();
    for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
        const mediaId = 'mediaId' in clip ? clip.mediaId : undefined;
        const proxyPath = mediaId ? mediaById.get(mediaId)?.proxyPath : undefined;
        if (proxyPath) {
            paths.add(proxyPath);
        }
    }
    return paths;
}
function normalizeDirectory(path) {
    return path.replace(/\\/g, '/').replace(/\/+$/, '') || '.';
}
function fileNameFromPath(path) {
    return path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'proxy.mp4';
}
function uniqueProxyFileName(fileName, usedNames) {
    const normalized = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    if (!usedNames.has(normalized)) {
        usedNames.add(normalized);
        return normalized;
    }
    const dotIndex = normalized.lastIndexOf('.');
    const stem = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
    const ext = dotIndex > 0 ? normalized.slice(dotIndex) : '';
    let index = 2;
    while (usedNames.has(`${stem}-${index}${ext}`)) {
        index += 1;
    }
    const next = `${stem}-${index}${ext}`;
    usedNames.add(next);
    return next;
}
function startOfUtcDay(value) {
    const date = new Date(value);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
//# sourceMappingURL=proxy-management.js.map