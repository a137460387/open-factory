import { type TextStyle } from '../../model';
import { type SubtitleCueInput } from '../../subtitles/srt';
import type { ExportClip, ExportAudioVisualizationBackground, ExportAudioVisualizationSettings, ExportSubtitleFormat, ExportSettings, ExportTimeline, TextArtifact } from '../export-types';
export declare function buildInputArgs(clip: ExportClip): string[];
export declare function buildCustomShaderSequenceInputArgs(settings: ExportSettings): string[];
export declare function buildCustomShaderSequenceClip(clip: ExportClip): ExportClip;
export declare function buildPathTextSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined;
export declare function buildMotionGraphicSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined;
export declare function buildCustomShaderSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined;
export declare function buildImageSequenceArtifact(clip: ExportClip): TextArtifact;
export declare function pngSequenceOutputPath(outputPath: string): string;
export declare function escapeConcatPath(path: string): string;
export declare function formatSequenceFrameDuration(value: number): string;
export declare function getExportClipSourceDuration(clip: ExportClip): number;
export declare function buildTextFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings): {
    filter: string;
    artifacts: TextArtifact[];
};
export declare function buildAdvancedTextFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings, style: NonNullable<ExportClip['textStyle']>, textSourceLabel: string, textLayerLabel: string): {
    filter: string;
    artifacts: TextArtifact[];
};
export declare function shouldUseAdvancedTextFilters(style: NonNullable<ExportClip['textStyle']>): boolean;
export declare function buildOpenTypeDrawtextOptions(style: NonNullable<ExportClip['textStyle']> | null | undefined): string;
export declare function exportTextStyleToTextStyle(style: NonNullable<ExportClip['textStyle']>): TextStyle;
export declare function resolveAudioVisualizationBackground(visualization: ExportAudioVisualizationSettings): ExportAudioVisualizationBackground;
export declare function buildCreditsRollFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings): {
    filter: string;
    artifact: TextArtifact;
};
export declare function buildPathTextSequenceOverlayFilter(inputLabel: string, outputLabel: string, inputIndex: number, clip: ExportClip): string;
export declare function buildTextFontSizeExpression(clip: ExportClip, baseFontSize: number): string;
export declare function buildDrawtextPositionExpression(clip: ExportClip, axis: 'x' | 'y', staticValue: number): string;
export declare function buildSubtitleBurnInFilter(inputLabel: string, outputLabel: string, clips: ExportClip[], format: ExportSubtitleFormat, options?: SubtitleArtifactOptions): {
    filter: string;
    artifact: TextArtifact;
};
export interface SubtitleArtifactOptions {
    language?: string;
    includeLanguageInFileName?: boolean;
}
export declare function buildSubtitleArtifact(clips: ExportClip[], pathMode: TextArtifact['pathMode'], format: ExportSubtitleFormat, options?: SubtitleArtifactOptions): TextArtifact;
export declare function buildSubtitleLanguageGroups(timeline: ExportTimeline, clips: ExportClip[], selectedLanguages: string[] | undefined): SubtitleLanguageGroup[];
export declare function selectSubtitleBurnInGroup(groups: SubtitleLanguageGroup[], language: string | null | undefined): SubtitleLanguageGroup | undefined;
export declare function subtitleLanguageToFfmpegMetadata(language: string): string;
export declare function buildSubtitleCueInputs(clips: ExportClip[]): SubtitleCueInput[];
export declare function buildSubtitleCueInput(clip: ExportClip, start: number, duration: number, text: string, id: string): SubtitleCueInput;
export declare function projectFrameRateFromClip(clip: ExportClip): number;
export declare function serializeSubtitleCueInputs(cues: SubtitleCueInput[], format: ExportSubtitleFormat): string;
export declare function buildSubtitleInputArgs(format: ExportSubtitleFormat): string[];
export declare function buildSoftSubtitleCodec(format: ExportSubtitleFormat, settings: ExportSettings): string;
export declare function normalizeSubtitleFormat(format: ExportSettings['subtitleFormat']): ExportSubtitleFormat;
export interface SubtitleLanguageGroup {
    language: string;
    clips: ExportClip[];
}
export declare function round(value: number): number;
export declare function formatOpacity(value: number): string;
export declare function formatSigned(value: number): string;
export declare function cssColorToAssColor(hex: string, opacity?: number): string;
//# sourceMappingURL=text-subtitle-filters.d.ts.map