import { type ColorMatchFrameSample } from './color-match';
import type { ColorCorrection } from './model';
export type ColorTintBias = 'warm' | 'cool' | 'neutral';
export interface RgbMean {
    r: number;
    g: number;
    b: number;
}
export interface ColorAnalysisMetrics {
    averageBrightness: number;
    colorTemperatureKelvin: number;
    averageSaturation: number;
    contrast: number;
    cbMean: number;
    crMean: number;
    tintBias: ColorTintBias;
    meanRgb: RgbMean;
}
export interface TimelineColorAnalysisResult {
    clipId: string;
    trackId?: string;
    mediaId?: string;
    name?: string;
    start: number;
    duration: number;
    metrics: ColorAnalysisMetrics;
}
export interface TimelineColorHeatmapPoint {
    clipId: string;
    start: number;
    end: number;
    height: number;
    color: string;
    brightness: number;
    colorTemperatureKelvin: number;
}
export interface SceneColorDifference {
    fromClipId: string;
    toClipId: string;
    time: number;
    score: number;
    temperatureDelta: number;
    brightnessDelta: number;
    saturationDelta: number;
    contrastDelta: number;
    tintDelta: number;
}
export interface SceneColorDifferenceThresholds {
    score?: number;
    temperatureKelvin?: number;
    brightness?: number;
    saturation?: number;
    contrast?: number;
    tint?: number;
}
export interface ColorAnalysisClipSample {
    clipId: string;
    sample: ColorMatchFrameSample;
}
export interface ColorAlignmentUpdate {
    clipId: string;
    colorCorrection: Partial<ColorCorrection>;
}
export declare function analyzeColorFrameSample(sample: ColorMatchFrameSample): ColorAnalysisMetrics;
export declare function estimateColorTemperatureKelvin(meanRgb: RgbMean): number;
export declare function buildTimelineColorHeatmapData(results: TimelineColorAnalysisResult[]): TimelineColorHeatmapPoint[];
export declare function detectSceneColorJumps(results: TimelineColorAnalysisResult[], thresholds?: SceneColorDifferenceThresholds): SceneColorDifference[];
export declare function buildColorAlignmentUpdates(samples: ColorAnalysisClipSample[], referenceClipId: string): ColorAlignmentUpdate[];
//# sourceMappingURL=color-analysis.d.ts.map