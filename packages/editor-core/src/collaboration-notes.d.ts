import { type CollaborationNote, type CollaborationNoteType, type Project } from './model';
import { type ReportLocale } from './project/report-i18n';
export interface CollaborationReportOptions {
    generatedAt?: string;
    locale?: ReportLocale;
}
export interface CollaborationReportRow {
    index: number;
    id: string;
    type: CollaborationNoteType;
    authorName: string;
    authorColor: string;
    start: number;
    end?: number;
    text: string;
    mediaPath?: string;
    resolved: boolean;
}
export interface CollaborationReport {
    projectName: string;
    duration: number;
    generatedAt: string;
    locale: ReportLocale;
    notes: CollaborationReportRow[];
}
export declare function filterCollaborationNotesByAuthor(notes: readonly CollaborationNote[], authorName?: string): CollaborationNote[];
export declare function toggleCollaborationNoteResolved(notes: readonly CollaborationNote[], noteId: string, resolved?: boolean, updatedAt?: string): CollaborationNote[];
export declare function buildCollaborationReport(project: Project, options?: CollaborationReportOptions): CollaborationReport;
export declare function buildCollaborationReportHtml(project: Project, options?: CollaborationReportOptions): string;
export declare function renderCollaborationReportHtml(report: CollaborationReport): string;
//# sourceMappingURL=collaboration-notes.d.ts.map