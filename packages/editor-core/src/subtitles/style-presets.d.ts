import type { SubtitleStyle } from '../model';
import { type SubtitleStyleTemplate } from './style-templates';
/** 用户自定义样式预设 */
export interface SubtitleStylePreset {
    /** 预设ID */
    id: string;
    /** 预设名称 */
    name: string;
    /** 预设类型 */
    kind: 'preset';
    /** 样式配置 */
    style: SubtitleStyle;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 是否为收藏 */
    favorite?: boolean;
    /** 标签 */
    tags?: string[];
}
/** 样式预设集合 */
export interface SubtitleStylePresetCollection {
    /** 预设列表 */
    presets: SubtitleStylePreset[];
    /** 版本号 */
    version: number;
}
/** 预设导出格式 */
export type SubtitleStylePresetExportFormat = 'json' | 'ofp';
/**
 * 创建新的样式预设
 */
export declare function createStylePreset(name: string, style: Partial<SubtitleStyle>, tags?: string[]): SubtitleStylePreset;
/**
 * 更新样式预设
 */
export declare function updateStylePreset(preset: SubtitleStylePreset, updates: Partial<Omit<SubtitleStylePreset, 'style'>> & {
    style?: Partial<SubtitleStyle>;
}): SubtitleStylePreset;
/**
 * 合并内置模板和用户预设
 */
export declare function mergeWithBuiltinTemplates(presets: SubtitleStylePreset[], builtinTemplates: SubtitleStyleTemplate[]): Array<SubtitleStylePreset | SubtitleStyleTemplate>;
/**
 * 过滤预设
 */
export declare function filterPresets(presets: SubtitleStylePreset[], filter: {
    searchText?: string;
    tags?: string[];
    favoritesOnly?: boolean;
}): SubtitleStylePreset[];
/**
 * 对预设进行排序
 */
export declare function sortPresets(presets: SubtitleStylePreset[], sortBy?: 'name' | 'createdAt' | 'updatedAt', order?: 'asc' | 'desc'): SubtitleStylePreset[];
/**
 * 保存预设集合到本地存储
 */
export declare function savePresetsToStorage(presets: SubtitleStylePreset[]): void;
/**
 * 从本地存储加载预设集合
 */
export declare function loadPresetsFromStorage(): SubtitleStylePresetCollection;
/**
 * 清除本地存储中的预设
 */
export declare function clearPresetsFromStorage(): void;
/**
 * 导出预设为JSON
 */
export declare function exportPresetsToJson(presets: SubtitleStylePreset[]): string;
/**
 * 从JSON导入预设
 */
export declare function importPresetsFromJson(json: string): SubtitleStylePreset[];
/**
 * 导出单个预设为文件
 */
export declare function exportPresetToFile(preset: SubtitleStylePreset, format?: SubtitleStylePresetExportFormat): {
    filename: string;
    content: string;
};
/**
 * 从文件导入预设
 */
export declare function importPresetFromFile(content: string): SubtitleStylePreset;
/**
 * 比较两个样式是否相同
 */
export declare function areStylesEqual(style1: SubtitleStyle, style2: SubtitleStyle): boolean;
/**
 * 计算样式差异
 */
export declare function diffStyles(style1: SubtitleStyle, style2: SubtitleStyle): Partial<Record<keyof SubtitleStyle, {
    from: unknown;
    to: unknown;
}>>;
//# sourceMappingURL=style-presets.d.ts.map