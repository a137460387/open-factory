import { type ColorCurves, type RgbColor } from './color-grading';
export interface ColorMatchFrameSample {
    data: ArrayLike<number>;
    width: number;
    height: number;
}
export interface ColorChannelStats {
    mean: number;
    stdDev: number;
}
export interface ColorMatchStats {
    r: ColorChannelStats;
    g: ColorChannelStats;
    b: ColorChannelStats;
    pixelCount: number;
}
export interface ColorMatchChannelTransform {
    slope: number;
    intercept: number;
    sourceMean: number;
}
export interface ColorMatchTransform {
    r: ColorMatchChannelTransform;
    g: ColorMatchChannelTransform;
    b: ColorMatchChannelTransform;
}
export declare function calculateColorMatchStats(sample: ColorMatchFrameSample): ColorMatchStats;
export declare function buildColorMatchTransform(source: ColorMatchStats, reference: ColorMatchStats): ColorMatchTransform;
export declare function buildColorMatchCurves(source: ColorMatchFrameSample, reference: ColorMatchFrameSample): ColorCurves;
export declare function colorMatchTransformToCurves(transform: ColorMatchTransform): ColorCurves;
export declare function applyColorMatchTransformToRgb(input: RgbColor, transform: ColorMatchTransform): RgbColor;
//# sourceMappingURL=color-match.d.ts.map