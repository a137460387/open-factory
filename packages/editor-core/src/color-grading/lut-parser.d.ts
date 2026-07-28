import type { LUTData } from './lut';
/** 解析 .cube 文件 */
export declare function parseCubeFile(content: string): LUTData;
/** 解析 .3dl 文件 */
export declare function parse3dlFile(content: string): LUTData;
/** 导出为 .cube 格式 */
export declare function exportToCube(lut: LUTData, title?: string): string;
/** 生成 LUT 预览缩略图数据 */
export declare function generateLUTPreview(lut: LUTData, width?: number, height?: number): Uint8ClampedArray;
//# sourceMappingURL=lut-parser.d.ts.map