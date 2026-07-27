import type { Project, ReviewAnnotation } from '../model';
import { type ReportLocale } from './report-i18n';
export interface ReviewReportOptions {
    generatedAt?: string;
    locale?: ReportLocale;
}
export interface ReviewReportAnnotationRow {
    index: number;
    id: string;
    time: number;
    type: ReviewAnnotation['type'];
    text: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ReviewReport {
    projectName: string;
    duration: number;
    fps: number;
    generatedAt: string;
    locale: ReportLocale;
    annotations: ReviewReportAnnotationRow[];
}
export declare function buildReviewReport(project: Project, options?: ReviewReportOptions): ReviewReport;
export declare function buildReviewReportHtml(project: Project, options?: ReviewReportOptions): string;
export declare function renderReviewReportHtml(report: ReviewReport): string;
//# sourceMappingURL=review-report.d.ts.map