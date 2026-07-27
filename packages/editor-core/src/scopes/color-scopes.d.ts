export interface RgbaFrame {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
}
export interface RgbHistogram {
    r: number[];
    g: number[];
    b: number[];
}
export interface WaveformScope {
    columns: number[][];
}
export interface VectorscopePoint {
    x: number;
    y: number;
    count: number;
}
export interface ColorScopes {
    histogram: RgbHistogram;
    waveform: WaveformScope;
    vectorscope: VectorscopePoint[];
}
export declare function computeColorScopes(frame: RgbaFrame, waveformColumns?: number): ColorScopes;
export declare function computeRgbHistogram(frame: RgbaFrame): RgbHistogram;
export declare function computeWaveform(frame: RgbaFrame, columnCount?: number): WaveformScope;
export declare function computeVectorscope(frame: RgbaFrame, precision?: number): VectorscopePoint[];
export declare function rgbToCbCrPoint(r: number, g: number, b: number): {
    x: number;
    y: number;
};
//# sourceMappingURL=color-scopes.d.ts.map