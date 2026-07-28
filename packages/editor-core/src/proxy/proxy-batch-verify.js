import { validateProxyAsset } from './proxy-management';
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export function categorizeProxyHealth(item) {
    if (item.status === 'ready')
        return 'healthy';
    if (item.status === 'expired')
        return 'expired';
    if (item.status === 'corrupt' || item.status === 'error')
        return 'corrupt';
    return 'missing';
}
export function classifyProxyVerifyResult(asset, proxyExists, proxyReadable, proxyStat, sourceStat) {
    const status = validateProxyAsset(asset, {
        proxyExists,
        proxyStat,
        sourceStat,
    });
    let category;
    if (!proxyExists) {
        category = 'missing';
    }
    else if (!proxyReadable || proxyStat?.size === 0) {
        category = 'corrupt';
    }
    else if (status === 'expired') {
        category = 'expired';
    }
    else {
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
export function buildBatchVerifyReport(results) {
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
export function collectRepairAssetIds(report) {
    return report.results.filter((r) => r.category !== 'healthy').map((r) => r.assetId);
}
export function shouldRunScheduledVerify(settings, nowMs) {
    if (settings.schedule === 'manual')
        return false;
    if (settings.schedule === 'startup')
        return true;
    if (!settings.lastRunAt)
        return true;
    return nowMs - settings.lastRunAt >= WEEKLY_INTERVAL_MS;
}
export function updateRepairProgress(progress, assetId, success, error) {
    return {
        ...progress,
        completed: progress.completed + (success ? 1 : 0),
        failed: progress.failed + (success ? 0 : 1),
        currentAssetId: undefined,
        errors: success ? progress.errors : [...progress.errors, { assetId, error: error ?? 'unknown_error' }],
    };
}
export function createRepairProgress(totalToRepair) {
    return { totalToRepair, completed: 0, failed: 0, errors: [] };
}
export function buildRepairHistoryEntry(progress, startedAt) {
    return {
        timestamp: Date.now(),
        totalAttempted: progress.completed + progress.failed,
        successCount: progress.completed,
        failCount: progress.failed,
        durationMs: Date.now() - startedAt,
    };
}
export function filterAssetsWithProxy(media) {
    return media.filter((a) => Boolean(a.proxyPath));
}
//# sourceMappingURL=proxy-batch-verify.js.map