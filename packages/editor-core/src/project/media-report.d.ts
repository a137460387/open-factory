import { type MediaAsset, type Project } from '../model';
import { type ReportLocale } from './report-i18n';
export interface OfflineMediaFileStatus {
    path: string;
    exists: boolean;
    size?: number;
}
export interface OfflineMediaReportOptions {
    estimatedExportSizeBytes?: number;
    generatedAt?: string;
    locale?: ReportLocale;
}
export interface OfflineMediaReportRow {
    assetId: string;
    assetName: string;
    assetType: MediaAsset['type'];
    path: string;
    exists: boolean;
    sizeBytes: number;
    hasProxy: boolean;
    timelineAppearances: number;
    totalUsedDurationSeconds: number;
    usageSegments: MediaUsageSegment[];
}
export interface OfflineMediaReportTotals {
    durationSeconds: number;
    mediaSizeBytes: number;
    estimatedExportSizeBytes: number;
    missingCount: number;
    totalUsedDurationSeconds: number;
}
export interface MediaUsageSegment {
    sequenceId: string;
    sequenceName: string;
    trackId: string;
    trackName: string;
    clipId: string;
    clipName: string;
    start: number;
    end: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
}
export interface MediaUsageStat {
    assetId: string;
    assetName: string;
    assetType: MediaAsset['type'];
    appearanceCount: number;
    totalUsedDurationSeconds: number;
    segments: MediaUsageSegment[];
}
export interface TimelineHeatmapBucket {
    start: number;
    end: number;
    overlapCount: number;
    intensity: number;
}
export interface OfflineMediaReport {
    projectName: string;
    generatedAt: string;
    locale: ReportLocale;
    rows: OfflineMediaReportRow[];
    totals: OfflineMediaReportTotals;
    usageStats: MediaUsageStat[];
    heatmap: TimelineHeatmapBucket[];
    unusedMedia: OfflineMediaReportRow[];
}
export interface ProjectArchivePreflight {
    missingRows: OfflineMediaReportRow[];
    missingPaths: string[];
}
export declare function collectOfflineMediaReportPaths(project: Project): string[];
export declare function buildOfflineMediaReport(project: Project, fileStatuses?: OfflineMediaFileStatus[], options?: OfflineMediaReportOptions): OfflineMediaReport;
export declare function buildMediaUsageStats(project: Project): MediaUsageStat[];
export declare function buildTimelineHeatmapData(project: Project, bucketCount?: number): TimelineHeatmapBucket[];
export declare function buildProjectArchivePreflight(project: Project, fileStatuses?: OfflineMediaFileStatus[]): ProjectArchivePreflight;
export declare function renderOfflineMediaReportHtml(report: OfflineMediaReport): string;
export declare function buildOfflineMediaReportHtml(project: Project, fileStatuses?: OfflineMediaFileStatus[], options?: OfflineMediaReportOptions): string;
//# sourceMappingURL=media-report.d.ts.map