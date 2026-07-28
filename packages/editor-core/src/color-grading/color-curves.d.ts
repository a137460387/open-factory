export interface CurvePoint {
    x: number;
    y: number;
}
export interface ColorCurves {
    master: CurvePoint[];
    r: CurvePoint[];
    g: CurvePoint[];
    b: CurvePoint[];
}
export interface ColorWheelValue {
    r: number;
    g: number;
    b: number;
    intensity: number;
}
export interface ThreeWayColor {
    lift: ColorWheelValue;
    gamma: ColorWheelValue;
    gain: ColorWheelValue;
}
export interface RgbColor {
    r: number;
    g: number;
    b: number;
}
export declare const DEFAULT_CURVE_POINTS: CurvePoint[];
export declare const DEFAULT_COLOR_WHEEL_VALUE: ColorWheelValue;
export declare const DEFAULT_COLOR_CURVES: ColorCurves;
export declare const DEFAULT_THREE_WAY_COLOR: ThreeWayColor;
export declare function createDefaultColorCurves(): ColorCurves;
export declare function createDefaultThreeWayColor(): ThreeWayColor;
export declare function normalizeCurvePoints(points: Partial<CurvePoint>[] | undefined): CurvePoint[];
export declare function normalizeColorCurves(curves: Partial<ColorCurves> | undefined): ColorCurves;
export declare function normalizeColorWheelValue(value: Partial<ColorWheelValue> | undefined): ColorWheelValue;
export declare function normalizeThreeWayColor(value: Partial<ThreeWayColor> | undefined): ThreeWayColor;
export declare function isDefaultColorCurves(curves: Partial<ColorCurves> | undefined): boolean;
export declare function isNeutralThreeWayColor(value: Partial<ThreeWayColor> | undefined): boolean;
export declare function sampleCurve(points: Partial<CurvePoint>[] | undefined, x: number): number;
export declare function sampleColorCurves(curves: Partial<ColorCurves> | undefined, x: number): RgbColor;
export declare function applyColorCurvesToRgb(input: RgbColor, curves: Partial<ColorCurves> | undefined): RgbColor;
export declare function serializeColorCurvesToCube(curves: Partial<ColorCurves> | undefined, size?: number, title?: string): string;
export declare function applyThreeWayColor(input: RgbColor, value: Partial<ThreeWayColor> | undefined): RgbColor;
//# sourceMappingURL=color-curves.d.ts.map