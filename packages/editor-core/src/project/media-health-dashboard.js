const DAY_MS = 24 * 60 * 60 * 1000;
export function buildMediaHealthDashboard(project, report, input = {}) {
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
            progress: calculateMediaHealthRingProgress(readyProxyAssets.length, videoAssets.length),
        },
        missingMedia: {
            count: missingAssetIds.length,
            assetIds: missingAssetIds,
        },
        expiredProxies: {
            count: expiredProxyAssetIds.length,
            assetIds: expiredProxyAssetIds,
        },
        unusedMedia: {
            count: unusedAssetIds.length,
            assetIds: unusedAssetIds,
        },
        storage: {
            mediaBytes,
            proxyBytes,
            cacheBytes,
            totalBytes,
            segments: buildStorageSegments(mediaBytes, proxyBytes, cacheBytes),
        },
        recentImports: {
            points: buildRecentImportTrend(project.media, input.nowMs ?? Date.now(), 7),
        },
        issueCount: missingAssetIds.length + expiredProxyAssetIds.length + unusedAssetIds.length + report.proxyMissing.length,
    };
    return {
        ...dashboardWithoutTasks,
        repairTasks: planMediaHealthRepairTasks(report, dashboardWithoutTasks.expiredProxies.assetIds),
    };
}
export function calculateMediaHealthRingProgress(value, total, circumference = 100) {
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
        dashArray: `${visible} ${hidden}`,
    };
}
export function buildRecentImportTrend(media, nowMs, days = 7) {
    const safeDays = Math.max(1, Math.round(days));
    const firstDayMs = startOfUtcDay(nowMs) - (safeDays - 1) * DAY_MS;
    const points = Array.from({ length: safeDays }, (_, index) => ({
        day: new Date(firstDayMs + index * DAY_MS).toISOString().slice(0, 10),
        count: 0,
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
export function planMediaHealthRepairTasks(report, expiredProxyAssetIds) {
    const tasks = [];
    if (report.proxyMissing.length > 0) {
        tasks.push({
            type: 'generate-missing-proxies',
            count: report.proxyMissing.length,
            assetIds: report.proxyMissing.map((issue) => issue.assetId),
        });
    }
    if (report.orphanMedia.length > 0) {
        tasks.push({
            type: 'clean-unused-media',
            count: report.orphanMedia.length,
            assetIds: report.orphanMedia.map((issue) => issue.assetId),
        });
    }
    if (expiredProxyAssetIds.length > 0) {
        tasks.push({
            type: 'rebuild-damaged-cache',
            count: expiredProxyAssetIds.length,
            assetIds: [...expiredProxyAssetIds],
        });
    }
    return tasks;
}
export function shouldAutoShowMediaHealthDashboard(options) {
    return options.enabled && options.issueCount > 0;
}
function collectExpiredProxyAssetIds(media, sourceStats, proxyStats) {
    return media
        .filter((asset) => {
        if (!asset.proxyPath) {
            return false;
        }
        const sourceMtimeMs = sourceStats?.[asset.path]?.mtimeMs;
        const proxyMtimeMs = proxyStats?.[asset.proxyPath]?.mtimeMs;
        return Number.isFinite(sourceMtimeMs) && Number.isFinite(proxyMtimeMs) && sourceMtimeMs > proxyMtimeMs + 1;
    })
        .map((asset) => asset.id);
}
function sumMediaBytes(media, sourceStats) {
    return Math.max(0, Math.round(media.reduce((total, asset) => {
        const size = sourceStats?.[asset.path]?.size ?? asset.size ?? 0;
        return total + (Number.isFinite(size) && size > 0 ? size : 0);
    }, 0)));
}
function sumProxyBytes(media, proxyStats) {
    const proxyPaths = new Set(media.map((asset) => asset.proxyPath).filter((path) => Boolean(path)));
    let total = 0;
    for (const path of proxyPaths) {
        const size = proxyStats?.[path]?.size ?? 0;
        if (Number.isFinite(size) && size > 0) {
            total += size;
        }
    }
    return Math.max(0, Math.round(total));
}
function buildStorageSegments(mediaBytes, proxyBytes, cacheBytes) {
    const total = mediaBytes + proxyBytes + cacheBytes;
    return [
        { kind: 'media', bytes: mediaBytes, ratio: total === 0 ? 0 : mediaBytes / total },
        { kind: 'proxy', bytes: proxyBytes, ratio: total === 0 ? 0 : proxyBytes / total },
        { kind: 'cache', bytes: cacheBytes, ratio: total === 0 ? 0 : cacheBytes / total },
    ];
}
function startOfUtcDay(value) {
    const date = new Date(value);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
//# sourceMappingURL=media-health-dashboard.js.map