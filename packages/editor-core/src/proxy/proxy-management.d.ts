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
export interface ProxyMigrationUpdate {
    assetId: string;
    fromPath: string;
    toPath: string;
}
export interface ProxyCoverageStats {
    proxiedMediaCount: number;
    totalMediaCount: number;
    coverageRatio: number;
    estimatedPreviewSecondsSaved: number;
}
export interface ProxyStorageTrendPoint {
    day: string;
    totalBytes: number;
}
export declare function validateProxyAsset(asset: MediaAsset, input?: {
    proxyExists?: boolean;
    proxyStat?: ProxyFileStatLike;
    sourceStat?: ProxyFileStatLike;
}): ProxyInventoryStatus;
export declare function buildProxyInventory(media: MediaAsset[], input?: {
    sourceStats?: Record<string, ProxyFileStatLike | undefined>;
    proxyStats?: Record<string, ProxyFileStatLike | undefined>;
    existingProxyPaths?: Set<string>;
    timeline?: Timeline;
}): ProxyInventoryItem[];
export declare function summarizeProxyInventory(items: ProxyInventoryItem[]): ProxyInventoryStats;
export declare function planProxyCleanup(items: ProxyInventoryItem[]): ProxyCleanupPlan;
export declare function planProxyBatchDelete(items: ProxyInventoryItem[], assetIds: string[]): string[];
export declare function buildProxyMigration(media: MediaAsset[], targetDirectory: string): ProxyMigrationUpdate[];
export declare function applyProxyMigration(media: MediaAsset[], updates: ProxyMigrationUpdate[]): MediaAsset[];
export declare function getProxyAssetsNeedingRegeneration(items: ProxyInventoryItem[]): string[];
export declare function shouldRunProxyIntegrityCheck(lastRunAtMs: number | undefined, nowMs: number, intervalMs?: number): boolean;
export declare function calculateProxyCoverageStats(media: MediaAsset[]): ProxyCoverageStats;
export declare function buildProxyStorageTrend(items: ProxyInventoryItem[], nowMs: number, days?: number): ProxyStorageTrendPoint[];
export declare function markExpiredProxyAssets(media: MediaAsset[], sourceStats: Record<string, ProxyFileStatLike | undefined>): MediaAsset[];
//# sourceMappingURL=proxy-management.d.ts.map