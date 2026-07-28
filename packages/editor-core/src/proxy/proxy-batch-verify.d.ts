import type { MediaAsset } from '../model-types';
import type { ProxyFileStatLike, ProxyInventoryItem } from './proxy-management';
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
    errors: Array<{
        assetId: string;
        error: string;
    }>;
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
export declare function categorizeProxyHealth(item: ProxyInventoryItem): ProxyHealthCategory;
export declare function classifyProxyVerifyResult(asset: MediaAsset, proxyExists: boolean, proxyReadable: boolean, proxyStat?: ProxyFileStatLike, sourceStat?: ProxyFileStatLike): ProxyVerifyResult;
export declare function buildBatchVerifyReport(results: ProxyVerifyResult[]): ProxyBatchVerifyReport;
export declare function collectRepairAssetIds(report: ProxyBatchVerifyReport): string[];
export declare function shouldRunScheduledVerify(settings: ProxyBatchVerifySettings, nowMs: number): boolean;
export declare function updateRepairProgress(progress: ProxyRepairProgress, assetId: string, success: boolean, error?: string): ProxyRepairProgress;
export declare function createRepairProgress(totalToRepair: number): ProxyRepairProgress;
export declare function buildRepairHistoryEntry(progress: ProxyRepairProgress, startedAt: number): ProxyRepairHistoryEntry;
export declare function filterAssetsWithProxy(media: MediaAsset[]): MediaAsset[];
//# sourceMappingURL=proxy-batch-verify.d.ts.map