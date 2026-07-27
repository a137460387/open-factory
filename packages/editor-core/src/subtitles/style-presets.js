import { normalizeSubtitleStyleTemplateStyle, } from './style-templates';
import { logger } from '../utils/logger.js';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRESET_STORAGE_KEY = 'open-factory-subtitle-style-presets';
const CURRENT_VERSION = 1;
const MAX_PRESETS = 100;
// ---------------------------------------------------------------------------
// Preset Management
// ---------------------------------------------------------------------------
/**
 * 创建新的样式预设
 */
export function createStylePreset(name, style, tags) {
    const normalizedStyle = normalizeSubtitleStyleTemplateStyle(style);
    const now = new Date().toISOString();
    return {
        id: generatePresetId(),
        name,
        kind: 'preset',
        style: normalizedStyle,
        createdAt: now,
        updatedAt: now,
        tags,
    };
}
/**
 * 更新样式预设
 */
export function updateStylePreset(preset, updates) {
    const updatedStyle = updates.style ? normalizeSubtitleStyleTemplateStyle(updates.style) : preset.style;
    return {
        ...preset,
        ...updates,
        style: updatedStyle,
        updatedAt: new Date().toISOString(),
    };
}
/**
 * 合并内置模板和用户预设
 */
export function mergeWithBuiltinTemplates(presets, builtinTemplates) {
    return [
        ...builtinTemplates.map((template) => ({
            ...template,
            kind: template.kind,
        })),
        ...presets,
    ];
}
/**
 * 过滤预设
 */
export function filterPresets(presets, filter) {
    let filtered = [...presets];
    // 按搜索文本过滤
    if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        filtered = filtered.filter((preset) => preset.name.toLowerCase().includes(searchLower) ||
            preset.tags?.some((tag) => tag.toLowerCase().includes(searchLower)));
    }
    // 按标签过滤
    if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter((preset) => preset.tags?.some((tag) => filter.tags.includes(tag)));
    }
    // 只显示收藏
    if (filter.favoritesOnly) {
        filtered = filtered.filter((preset) => preset.favorite === true);
    }
    return filtered;
}
/**
 * 对预设进行排序
 */
export function sortPresets(presets, sortBy = 'updatedAt', order = 'desc') {
    return [...presets].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'createdAt':
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                break;
            case 'updatedAt':
                comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
                break;
        }
        return order === 'asc' ? comparison : -comparison;
    });
}
// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
/**
 * 保存预设集合到本地存储
 */
export function savePresetsToStorage(presets) {
    const collection = {
        presets: presets.slice(0, MAX_PRESETS),
        version: CURRENT_VERSION,
    };
    try {
        const serialized = JSON.stringify(collection);
        localStorage.setItem(PRESET_STORAGE_KEY, serialized);
    }
    catch (error) {
        logger.error('Failed to save subtitle style presets:', error);
    }
}
/**
 * 从本地存储加载预设集合
 */
export function loadPresetsFromStorage() {
    try {
        const serialized = localStorage.getItem(PRESET_STORAGE_KEY);
        if (!serialized) {
            return { presets: [], version: CURRENT_VERSION };
        }
        const collection = JSON.parse(serialized);
        // 版本迁移
        if (collection.version < CURRENT_VERSION) {
            return migratePresets(collection);
        }
        return collection;
    }
    catch (error) {
        logger.error('Failed to load subtitle style presets:', error);
        return { presets: [], version: CURRENT_VERSION };
    }
}
/**
 * 清除本地存储中的预设
 */
export function clearPresetsFromStorage() {
    localStorage.removeItem(PRESET_STORAGE_KEY);
}
// ---------------------------------------------------------------------------
// Import/Export
// ---------------------------------------------------------------------------
/**
 * 导出预设为JSON
 */
export function exportPresetsToJson(presets) {
    const collection = {
        presets,
        version: CURRENT_VERSION,
    };
    return JSON.stringify(collection, null, 2);
}
/**
 * 从JSON导入预设
 */
export function importPresetsFromJson(json) {
    try {
        const collection = JSON.parse(json);
        if (!collection.presets || !Array.isArray(collection.presets)) {
            throw new Error('Invalid preset format');
        }
        // 验证和规范化每个预设
        return collection.presets.map((preset) => ({
            ...preset,
            id: preset.id || generatePresetId(),
            name: preset.name || 'Unnamed Preset',
            kind: 'preset',
            style: normalizeSubtitleStyleTemplateStyle(preset.style),
            createdAt: preset.createdAt || new Date().toISOString(),
            updatedAt: preset.updatedAt || new Date().toISOString(),
        }));
    }
    catch (error) {
        logger.error('Failed to import presets:', error);
        throw new Error('Invalid preset file format');
    }
}
/**
 * 导出单个预设为文件
 */
export function exportPresetToFile(preset, format = 'json') {
    const sanitized_name = preset.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    switch (format) {
        case 'json':
            return {
                filename: `${sanitized_name}.json`,
                content: JSON.stringify(preset, null, 2),
            };
        case 'ofp':
            return {
                filename: `${sanitized_name}.ofp`,
                content: JSON.stringify({
                    format: 'open-factory-preset',
                    version: 1,
                    type: 'subtitle-style',
                    preset,
                }, null, 2),
            };
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}
/**
 * 从文件导入预设
 */
export function importPresetFromFile(content) {
    try {
        const data = JSON.parse(content);
        // 检查是否为 Open Factory 预设格式
        if (data.format === 'open-factory-preset' && data.type === 'subtitle-style') {
            return importSinglePreset(data.preset);
        }
        // 直接作为预设导入
        return importSinglePreset(data);
    }
    catch (error) {
        logger.error('Failed to import preset from file:', error);
        throw new Error('Invalid preset file');
    }
}
// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------
/**
 * 比较两个样式是否相同
 */
export function areStylesEqual(style1, style2) {
    const keys = Object.keys(style1);
    for (const key of keys) {
        if (style1[key] !== style2[key]) {
            return false;
        }
    }
    return true;
}
/**
 * 计算样式差异
 */
export function diffStyles(style1, style2) {
    const diff = {};
    const keys = Object.keys(style1);
    for (const key of keys) {
        if (style1[key] !== style2[key]) {
            diff[key] = { from: style1[key], to: style2[key] };
        }
    }
    return diff;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generatePresetId() {
    return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
function importSinglePreset(data) {
    const preset = data;
    if (!preset.style || typeof preset.style !== 'object') {
        throw new Error('Invalid preset: missing style');
    }
    return {
        id: preset.id || generatePresetId(),
        name: preset.name || 'Imported Preset',
        kind: 'preset',
        style: normalizeSubtitleStyleTemplateStyle(preset.style),
        createdAt: preset.createdAt || new Date().toISOString(),
        updatedAt: preset.updatedAt || new Date().toISOString(),
        favorite: preset.favorite,
        tags: preset.tags,
    };
}
function migratePresets(collection) {
    // 未来版本迁移逻辑
    return {
        ...collection,
        version: CURRENT_VERSION,
        presets: collection.presets.map((preset) => ({
            ...preset,
            kind: 'preset',
            style: normalizeSubtitleStyleTemplateStyle(preset.style),
        })),
    };
}
//# sourceMappingURL=style-presets.js.map