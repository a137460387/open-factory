import type { ExportRenderRange, NormalizedExportRenderRange } from '../export-ranges';
import type { ExportAudioVisualizationBackground, ExportAudioVisualizationSettings, ExportClip, ExportLoudnessNormalization, ExportMasterEq, ExportMasterEqBand, ExportMasterProcessingSettings, ExportPreviewSampleKind, ExportProject, ExportSettings, ExportVideoProfile, ExportWatermarkPosition, FfmpegExportPass, FfmpegInput, TextArtifact } from '../export-types';
export declare const DEFAULT_EXPORT_SETTINGS: Omit<ExportSettings, 'outputPath'>;
export declare const SETPTS_EXPRESSION_LIMIT = 4096;
export declare const GIF_PALETTE_PLACEHOLDER = "__GIF_PALETTE_open_factory__";
export declare const LOUDNORM_MEASURED_I_PLACEHOLDER = "__LOUDNORM_MEASURED_I__";
export declare const LOUDNORM_MEASURED_TP_PLACEHOLDER = "__LOUDNORM_MEASURED_TP__";
export declare const LOUDNORM_MEASURED_LRA_PLACEHOLDER = "__LOUDNORM_MEASURED_LRA__";
export declare const LOUDNORM_MEASURED_THRESH_PLACEHOLDER = "__LOUDNORM_MEASURED_THRESH__";
export declare const LOUDNORM_OFFSET_PLACEHOLDER = "__LOUDNORM_OFFSET__";
export declare const WATERMARK_MARGIN_PX = 24;
export declare const SLATE_DURATION_SECONDS = 0.5;
export declare const CUSTOM_SHADER_SEQUENCE_KIND = "custom-shader-sequence";
export declare const PATH_TEXT_SEQUENCE_KIND = "path-text-sequence";
export declare const MOTION_GRAPHIC_SEQUENCE_PATH_MODE = "motion-graphic-sequence";
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
export declare const DEFAULT_EXPORT_MASTER_EQ_BANDS: ExportMasterEqBand[];
export declare const DEFAULT_EXPORT_MASTER_PROCESSING: ExportMasterProcessingSettings;
export declare function normalizeLoudnessNormalization(mode: ExportLoudnessNormalization | undefined): ExportLoudnessNormalization;
export declare function normalizeVideoProfile(profile: ExportVideoProfile | undefined): ExportVideoProfile | undefined;
export declare function normalizeExportAudioVisualization(input: ExportAudioVisualizationSettings | undefined): ExportAudioVisualizationSettings;
export declare function normalizeAudioVisualizationBackground(input: ExportAudioVisualizationBackground | undefined, fallback: ExportAudioVisualizationBackground): ExportAudioVisualizationBackground;
export declare function normalizeHexColor(value: string | undefined, fallback: string): string;
export declare function parseHexColor(value: string, fallback: string): {
    r: number;
    g: number;
    b: number;
};
export declare function toHexChannel(value: number): string;
export declare function buildMasterAudioFilters(masterProcessing: ExportSettings['masterProcessing'] | undefined): string[];
export declare function buildEqualizerFilters(eq: Pick<ExportMasterEq, 'bands'>): string[];
export declare function formatFfmpegNumber(value: number): string;
export declare function formatOpacity(value: number): string;
export declare function normalizeExportReframeSettings(settings: ExportSettings): ExportSettings;
export declare function normalizeExportSpatialAudioAssets(input: ExportSettings['spatialAudioAssets'] | undefined): ExportSettings['spatialAudioAssets'];
export declare function mergeExportMetadata(base: ExportProject['metadata'], override: ExportProject['metadata']): ExportProject['metadata'];
export declare function normalizeExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): ExportMasterProcessingSettings;
export declare function hasExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): boolean;
export declare function normalizeExportMasterEq(input: Partial<ExportMasterEq> | undefined): ExportMasterEq;
export declare function normalizeExportMasterEqBand(input: Partial<ExportMasterEqBand> | undefined, fallback: ExportMasterEqBand): ExportMasterEqBand;
export declare function normalizeSettingsForExportFormat(settings: ExportSettings): ExportSettings;
export declare function constrainDimensions(width: number, height: number, maxDimension: number): {
    width: number;
    height: number;
};
export declare function normalizeExportWatermark(watermark: ExportSettings['watermark'] | undefined): ExportSettings['watermark'];
export declare function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition;
export declare function normalizeTimecodeBurnIn(timecode: ExportSettings['timecodeBurnIn'] | undefined): ExportSettings['timecodeBurnIn'];
export declare function normalizeExportSlate(slate: ExportSettings['slate'] | undefined): ExportSettings['slate'];
export declare function buildTimecodeBurnInFilter(inputLabel: string, outputLabel: string, timecode: NonNullable<ExportSettings['timecodeBurnIn']>): string;
export declare function buildSlateVideoFilters(outputLabel: string, settings: ExportSettings, project: ExportProject, timelineDuration: number, slateDuration: number): string[];
export declare function buildWatermarkFilters(inputLabel: string, outputLabel: string, watermark: NonNullable<ExportSettings['watermark']>, settings: ExportSettings, imageInputIndex: number | undefined): string[];
export declare function buildWatermarkExpression(position: ExportWatermarkPosition, widthVar: string, heightVar: string, itemWidthVar: string, itemHeightVar: string): {
    x: string;
    y: string;
};
export declare function calculateWatermarkOverlayPosition(position: ExportWatermarkPosition, canvasWidth: number, canvasHeight: number, watermarkWidth: number, watermarkHeight: number): {
    x: number;
    y: number;
};
export declare function finiteNumber(value: number | undefined, fallback: number): number;
export declare function buildGifExportPasses(inputs: FfmpegInput[], baseFilterComplex: string, settings: ExportSettings, duration: number, textArtifacts: TextArtifact[], outputRange?: NormalizedExportRenderRange | null): {
    filterComplex: string;
    maps: string[];
    outputArgs: string[];
    fullArgs: string[];
    passes: FfmpegExportPass[];
};
export declare function buildExportRangeOutputArgs(range: NormalizedExportRenderRange | null | undefined): string[];
export declare function buildLoudnessNormalizationPasses(inputs: FfmpegInput[], analysisFilterComplex: string, renderFullArgs: string[], duration: number): {
    passes: FfmpegExportPass[];
};
export declare function buildFfmpegFullArgs(inputs: FfmpegInput[], filterComplex: string, maps: string[], outputArgs: string[]): string[];
//# sourceMappingURL=settings-normalize.d.ts.map