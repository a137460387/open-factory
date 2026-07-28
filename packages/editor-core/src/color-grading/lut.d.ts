/** LUT 数据 */
export interface LUTData {
    size: number;
    domainMin: [number, number, number];
    domainMax: [number, number, number];
    data: Float32Array;
}
/** LUT 图层 */
export interface ColorGradingLUTLayer {
    id: string;
    lutId: string;
    intensity: number;
    enabled: boolean;
}
/** LUT 库条目 */
export interface LUTLibraryEntry {
    id: string;
    name: string;
    filePath: string;
    format: 'cube' | '3dl';
    size: number;
    thumbnail?: string;
    tags: string[];
    createdAt: string;
}
/** 创建 LUT 图层 */
export declare function createColorGradingLUTLayer(lutId: string): ColorGradingLUTLayer;
/** 验证 LUT 数据 */
export declare function validateLUTData(data: LUTData): boolean;
/** 归一化 LUT 图层 */
export declare function normalizeColorGradingLUTLayer(layer: unknown): ColorGradingLUTLayer | null;
//# sourceMappingURL=lut.d.ts.map