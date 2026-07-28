import type { ExportPreviewSampleKind, ExportPreviewSamplePlan, ExportProject, FfmpegCapabilities, FfmpegExportPlan, NestedFfmpegExportPlan } from '../export-types';
import { type BuildFfmpegExportPlanOptions } from './settings-normalize';
export declare function buildFfmpegExportPlan(project: ExportProject, capabilities?: FfmpegCapabilities, depth?: number, sequenceStack?: string[], options?: BuildFfmpegExportPlanOptions): FfmpegExportPlan;
export declare function buildFfmpegCurrentFrameExportPlan(project: ExportProject, time: number, capabilities?: FfmpegCapabilities): FfmpegExportPlan;
export interface StemExportPlan {
    trackIndex: number;
    trackName: string;
    format: string;
    outputPath: string;
    plan: FfmpegExportPlan;
}
export declare function buildStemExportPlans(project: ExportProject, capabilities: FfmpegCapabilities | undefined, stemTracks: Array<{
    trackIndex: number;
    trackName: string;
    format: string;
}>, outputDir: string): StemExportPlan[];
/** @internal */
export declare function sanitizeStemPathComponent(name: string): string;
/** @internal */
export declare function buildStemOutputPath(outputDir: string, projectName: string, stemName: string, trackIndex: number, format: string): string;
export declare function calculateExportPreviewSampleTimes(duration: number): Array<{
    kind: ExportPreviewSampleKind;
    time: number;
}>;
export declare function buildFfmpegPreviewSamplePlans(project: ExportProject, outputPaths: string[], capabilities?: FfmpegCapabilities): ExportPreviewSamplePlan[];
export declare function buildNestedSequencePlans(project: ExportProject, capabilities: FfmpegCapabilities | undefined, warnings: string[], depth: number, sequenceStack: string[]): NestedFfmpegExportPlan[];
//# sourceMappingURL=export-plan.d.ts.map