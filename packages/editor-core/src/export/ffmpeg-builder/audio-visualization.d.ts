import { type AudioSpectrumParams } from '../../effects';
import { type ExpandedAudioVisualizationTheme } from '../../audio-visualization-themes';
import type { ExportClip, ExportAudioVisualizationBackground, ExportAudioVisualizationSettings, ExportSettings } from '../export-types';
export interface AudioSpectrumExportItem {
    clipId: string;
    start: number;
    duration: number;
    params: AudioSpectrumParams;
}
export declare function collectAudioSpectrumEffects(clips: ExportClip[]): AudioSpectrumExportItem[];
export declare function buildAudioSpectrumFilter(inputLabel: string, outputLabel: string, params: AudioSpectrumParams, settings: ExportSettings): string;
export declare function buildAudioSpectrumOverlayYExpression(params: AudioSpectrumParams): string;
export declare function buildAudioVisualizationBackgroundFilters(background: ExportAudioVisualizationBackground, settings: ExportSettings, duration: number, imageInputIndex?: number): string[];
export declare function buildAudioVisualizationFilter(inputLabel: string, outputLabel: string, visualization: ExportAudioVisualizationSettings, settings: ExportSettings): string;
export interface AudioSpectrumVisualFilterInput {
    inputLabel: string;
    outputLabel: string;
    visualizerFilter: string;
    colorStart: string;
    colorEnd: string;
    alpha: number;
    audioGain?: string;
    postVisualizerFilters?: string[];
    mirror: boolean;
    circularMask?: boolean;
    theme?: ExpandedAudioVisualizationTheme;
}
export declare function buildAudioSpectrumVisualFilter(input: AudioSpectrumVisualFilterInput): string;
export declare function hasAudioVisualizationThemeDecorations(theme: ExpandedAudioVisualizationTheme | undefined): boolean;
export declare function appendAudioVisualizationThemeDecorationFilters(filters: string[], inputLabel: string, outputLabel: string, theme: ExpandedAudioVisualizationTheme): string;
export declare function buildAudioSpectrumGradientFilters(inputLabel: string, outputLabel: string, colorStart: string, colorEnd: string): string[];
export declare function buildColorChannelMixerForHex(color: string): string;
export declare function buildCircularAlphaMaskFilter(): string;
export declare function buildAudioVisualizationOverlayPosition(style: ExportAudioVisualizationSettings['style'], _settings: ExportSettings): {
    x: string;
    y: string;
};
/** @internal */
export declare function normalizeHexColor(value: string | undefined, fallback: string): string;
/** @internal */
export declare function parseHexColor(value: string, fallback: string): {
    r: number;
    g: number;
    b: number;
};
export declare function buildGradientChannelExpression(start: number, end: number): string;
/** @internal */
export declare function toHexChannel(value: number): string;
export declare function resolveExportAudioVisualizationTheme(visualization: ExportAudioVisualizationSettings): ExpandedAudioVisualizationTheme | undefined;
//# sourceMappingURL=audio-visualization.d.ts.map