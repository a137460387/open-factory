import type { Project, Timeline } from '../model';
export * from './export-types';
export * from './post-export-script';
export * from './ffmpeg-builder';
export * from './ffmpeg-escape';
export * from './export-queue';
export interface ExportSegment {
    inputPath: string;
    start: number;
    duration: number;
    name: string;
}
export interface ExportPlan {
    segments: ExportSegment[];
    totalDuration: number;
    width: number;
    height: number;
    fps: number;
    limitation: string;
}
export declare function buildSingleVideoTrackExportPlan(project: Project): ExportPlan;
export declare function timelineHasExportableVideo(timeline: Timeline): boolean;
export declare function buildProjectFfmpegExportPlan(project: Project, outputPath: string): import("./export-types").FfmpegExportPlan;
//# sourceMappingURL=ffmpeg.d.ts.map