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
export declare function buildMediaHealthDashboard(project: Project, report: ProjectHealthReport, input?: MediaHealthDashboardInput): MediaHealthDashboard;
export declare function calculateMediaHealthRingProgress(value: number, total: number, circumference?: number): MediaHealthRingProgress;
export declare function buildRecentImportTrend(media: MediaAsset[], nowMs: number, days?: number): MediaHealthTrendPoint[];
export declare function planMediaHealthRepairTasks(report: ProjectHealthReport, expiredProxyAssetIds: string[]): MediaHealthRepairTask[];
export declare function shouldAutoShowMediaHealthDashboard(options: MediaHealthAutoShowOptions): boolean;
//# sourceMappingURL=media-health-dashboard.d.ts.map