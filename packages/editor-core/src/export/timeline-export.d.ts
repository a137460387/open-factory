import { type Clip, type ColorCorrection, type Project, type TrackType } from '../model';
export type TimelineExportFormat = 'edl' | 'fcp-xml';
export type ProfessionalNleExportFormat = 'aaf' | 'omf' | 'fcp-xml';
export type ProfessionalNleMediaMode = 'link' | 'copy';
export interface TimelineExportOptions {
    mediaPathMap?: Record<string, string> | Map<string, string>;
}
export interface ProfessionalNleExportOptions extends TimelineExportOptions {
    mediaMode?: ProfessionalNleMediaMode;
}
export interface TimelineExportEvent {
    id: string;
    clipId: string;
    clipType: Clip['type'];
    name: string;
    sourceName: string;
    sourcePath?: string;
    colorCorrection: ColorCorrection;
    trackType: TrackType;
    recordStart: number;
    recordEnd: number;
    sourceStart: number;
    sourceEnd: number;
}
export declare function exportTimeline(project: Project, format: TimelineExportFormat): string;
export declare function exportCmx3600Edl(project: Project): string;
export declare function exportFinalCutXml(project: Project, options?: TimelineExportOptions): string;
export declare function exportProfessionalNle(project: Project, format: ProfessionalNleExportFormat, options?: ProfessionalNleExportOptions): string;
export declare function exportAaf(project: Project, options?: ProfessionalNleExportOptions): string;
export declare function exportOmf(project: Project, options?: ProfessionalNleExportOptions): string;
export declare function flattenTimelineForExport(project: Project, options?: TimelineExportOptions): TimelineExportEvent[];
//# sourceMappingURL=timeline-export.d.ts.map