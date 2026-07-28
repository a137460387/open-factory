import { type ClipKeyframes, type Project, type Timeline } from '../../model';
import type { MixerState } from '../../audio/mixer-types';
import type { ExportRenderRange } from '../export-ranges';
import type { ExportClip, ExportClipKeyframes, ExportAudioVisualizationBackground, ExportAudioVisualizationSettings, ExportLoudnessNormalization, ExportProject, ExportSettings, ExportVideoProfile, ExportWatermarkPosition, ExportTimeline, ExportMasterEq, ExportMasterEqBand, ExportMasterProcessingSettings, ExportPreviewSampleKind } from '../export-types';
export interface BuildExportProjectOptions {
    outputPath: string;
    defaultFontPath?: string | null;
    settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
    metadata?: ExportProject['metadata'];
}
/** @internal */
export declare const DEFAULT_EXPORT_SETTINGS: Omit<ExportSettings, 'outputPath'>;
/** @internal */
export declare const SETPTS_EXPRESSION_LIMIT = 4096;
/** @internal */
export declare const GIF_PALETTE_PLACEHOLDER = "__GIF_PALETTE_open_factory__";
/** @internal */
export declare const LOUDNORM_MEASURED_I_PLACEHOLDER = "__LOUDNORM_MEASURED_I__";
/** @internal */
export declare const LOUDNORM_MEASURED_TP_PLACEHOLDER = "__LOUDNORM_MEASURED_TP__";
/** @internal */
export declare const LOUDNORM_MEASURED_LRA_PLACEHOLDER = "__LOUDNORM_MEASURED_LRA__";
/** @internal */
export declare const LOUDNORM_MEASURED_THRESH_PLACEHOLDER = "__LOUDNORM_MEASURED_THRESH__";
/** @internal */
export declare const LOUDNORM_OFFSET_PLACEHOLDER = "__LOUDNORM_OFFSET__";
/** @internal */
export declare const WATERMARK_MARGIN_PX = 24;
/** @internal */
export declare const SLATE_DURATION_SECONDS = 0.5;
/** @internal */
export declare const CUSTOM_SHADER_SEQUENCE_KIND = "custom-shader-sequence";
/** @internal */
export declare const PATH_TEXT_SEQUENCE_KIND = "path-text-sequence";
/** @internal */
export declare const MOTION_GRAPHIC_SEQUENCE_PATH_MODE = "motion-graphic-sequence";
/** @internal */
export declare const EXPORT_PREVIEW_SAMPLE_KINDS: ExportPreviewSampleKind[];
export interface LoudnessNormalizationPreset {
    mode: Exclude<ExportLoudnessNormalization, 'off'>;
    args: string[];
}
export interface BuildFfmpegExportPlanOptions {
    frameExport?: {
        time: number;
    };
    exportRange?: ExportRenderRange | null;
    stemTrackIndex?: number;
}
export interface SubtitleLanguageGroup {
    language: string;
    clips: ExportClip[];
}
/** @internal */
export declare const DEFAULT_EXPORT_MASTER_EQ_BANDS: ExportMasterEqBand[];
/** @internal */
export declare const DEFAULT_EXPORT_MASTER_PROCESSING: ExportMasterProcessingSettings;
export declare function buildExportProjectFromProject(project: Project, options: BuildExportProjectOptions): ExportProject;
export declare function buildExportTimeline(timeline: Timeline, mediaById: Map<string, Project['media'][number]>, options: BuildExportProjectOptions, mixerState?: MixerState): ExportTimeline;
export declare function buildExportClipKeyframes(keyframes: ClipKeyframes | undefined, duration: number, trackVolume: number): ExportClipKeyframes | null;
/** @internal */
export declare function safeLabel(value: string): string;
/** @internal */
export declare function nestedInputPlaceholder(sequenceId: string): string;
/** @internal */
export declare function mergeExportMetadata(base: ExportProject['metadata'], override: ExportProject['metadata']): ExportProject['metadata'];
/** @internal */
export declare function normalizeExportReframeSettings(settings: ExportSettings): ExportSettings;
/** @internal */
export declare function normalizeExportSpatialAudioAssets(input: ExportSettings['spatialAudioAssets'] | undefined): ExportSettings['spatialAudioAssets'];
/** @internal */
export declare function normalizeExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): ExportMasterProcessingSettings;
/** @internal */
export declare function normalizeExportMasterEq(input: Partial<ExportMasterEq> | undefined): ExportMasterEq;
/** @internal */
export declare function normalizeExportMasterEqBand(input: Partial<ExportMasterEqBand> | undefined, fallback: ExportMasterEqBand): ExportMasterEqBand;
/** @internal */
export declare function finiteNumber(value: number | undefined, fallback: number): number;
/** @internal */
export declare function normalizeLoudnessNormalization(mode: ExportLoudnessNormalization | undefined): ExportLoudnessNormalization;
/** @internal */
export declare function normalizeVideoProfile(profile: ExportVideoProfile | undefined): ExportVideoProfile | undefined;
/** @internal */
export declare function normalizeExportWatermark(watermark: ExportSettings['watermark'] | undefined): ExportSettings['watermark'];
/** @internal */
export declare function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition;
/** @internal */
export declare function normalizeTimecodeBurnIn(timecode: ExportSettings['timecodeBurnIn'] | undefined): ExportSettings['timecodeBurnIn'];
/** @internal */
export declare function normalizeExportSlate(slate: ExportSettings['slate'] | undefined): ExportSettings['slate'];
/** @internal */
export declare function normalizeExportAudioVisualization(input: ExportAudioVisualizationSettings | undefined): ExportAudioVisualizationSettings;
/** @internal */
export declare function normalizeHexColor(value: string | undefined, fallback: string): string;
/** @internal */
export declare function parseHexColor(value: string, fallback: string): {
    r: number;
    g: number;
    b: number;
};
/** @internal */
export declare function toHexChannel(value: number): string;
export declare function normalizeAudioVisualizationBackground(input: ExportAudioVisualizationBackground | undefined, fallback: ExportAudioVisualizationBackground): ExportAudioVisualizationBackground;
//# sourceMappingURL=project-converter.d.ts.map