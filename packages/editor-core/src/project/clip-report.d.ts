import type { Clip, Project } from '../model';
import { type ReportLocale } from './report-i18n';
export interface ClipReportOptions {
    generatedAt?: string;
    exportPresetName?: string;
    locale?: ReportLocale;
}
export interface ClipReportOverview {
    projectName: string;
    duration: number;
    fps: number;
    trackCount: number;
    clipCount: number;
    exportPresetName: string;
    generatedAt: string;
    locale: ReportLocale;
}
export interface ClipReportClipRow {
    index: number;
    clipId: string;
    name: string;
    type: Clip['type'];
    trackName: string;
    inPoint: number;
    outPoint: number;
    start: number;
    duration: number;
    effectTypes: string[];
    keyframeCount: number;
}
export interface ClipReportMediaRow {
    mediaId: string;
    fileName: string;
    format: string;
    resolution: string;
    duration: number;
    useCount: number;
}
export interface ClipReportSubtitleRow {
    clipId: string;
    text: string;
    trackName: string;
    start: number;
    duration: number;
}
export interface ClipReportMarkerRow {
    markerId: string;
    name: string;
    time: number;
    color: string;
}
export interface ClipReport {
    overview: ClipReportOverview;
    clips: ClipReportClipRow[];
    media: ClipReportMediaRow[];
    subtitles: ClipReportSubtitleRow[];
    markers: ClipReportMarkerRow[];
}
export declare function buildClipReport(project: Project, options?: ClipReportOptions): ClipReport;
export declare function buildClipReportHtml(project: Project, options?: ClipReportOptions): string;
export declare function renderClipReportHtml(report: ClipReport): string;
//# sourceMappingURL=clip-report.d.ts.map