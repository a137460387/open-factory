import type { ColorGradingGraph } from './types';
/** 调色预设 */
export interface ColorGradingPreset {
    id: string;
    name: string;
    author: string;
    description?: string;
    tags: string[];
    graph: ColorGradingGraph;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}
/** 预设文件格式 */
export interface ColorGradingPresetFile {
    schemaVersion: 1;
    kind: 'open-factory.color-grading-preset';
    preset: ColorGradingPreset;
}
/** 创建调色预设 */
export declare function createColorGradingPreset(name: string, graph: ColorGradingGraph, options?: Partial<Omit<ColorGradingPreset, 'id' | 'name' | 'graph' | 'createdAt' | 'updatedAt'>>): ColorGradingPreset;
/** 序列化预设为文件 */
export declare function serializeColorGradingPreset(preset: ColorGradingPreset): string;
/** 从文件反序列化预设 */
export declare function deserializeColorGradingPreset(json: string): ColorGradingPreset | null;
/** 验证预设 */
export declare function validateColorGradingPreset(preset: unknown): preset is ColorGradingPreset;
/** 内置预设 */
export declare const BUILTIN_COLOR_PRESETS: ColorGradingPreset[];
//# sourceMappingURL=color-grading-presets.d.ts.map