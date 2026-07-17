import type { SubtitleStyle } from '../model';
import { normalizeSubtitleStyleTemplateStyle, type SubtitleStyleTemplate, type SubtitleStyleTemplateKind } from './style-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
export function createStylePreset(
  name: string,
  style: Partial<SubtitleStyle>,
  tags?: string[],
): SubtitleStylePreset {
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
export function updateStylePreset(
  preset: SubtitleStylePreset,
  updates: Partial<Omit<SubtitleStylePreset, 'style'>> & { style?: Partial<SubtitleStyle> },
): SubtitleStylePreset {
  const updatedStyle = updates.style
    ? normalizeSubtitleStyleTemplateStyle(updates.style)
    : preset.style;

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
export function mergeWithBuiltinTemplates(
  presets: SubtitleStylePreset[],
  builtinTemplates: SubtitleStyleTemplate[],
): Array<SubtitleStylePreset | SubtitleStyleTemplate> {
  return [
    ...builtinTemplates.map((template) => ({
      ...template,
      kind: template.kind as SubtitleStyleTemplateKind,
    })),
    ...presets,
  ];
}

/**
 * 过滤预设
 */
export function filterPresets(
  presets: SubtitleStylePreset[],
  filter: {
    searchText?: string;
    tags?: string[];
    favoritesOnly?: boolean;
  },
): SubtitleStylePreset[] {
  let filtered = [...presets];

  // 按搜索文本过滤
  if (filter.searchText) {
    const searchLower = filter.searchText.toLowerCase();
    filtered = filtered.filter(
      (preset) =>
        preset.name.toLowerCase().includes(searchLower) ||
        preset.tags?.some((tag) => tag.toLowerCase().includes(searchLower)),
    );
  }

  // 按标签过滤
  if (filter.tags && filter.tags.length > 0) {
    filtered = filtered.filter((preset) =>
      preset.tags?.some((tag) => filter.tags!.includes(tag)),
    );
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
export function sortPresets(
  presets: SubtitleStylePreset[],
  sortBy: 'name' | 'createdAt' | 'updatedAt' = 'updatedAt',
  order: 'asc' | 'desc' = 'desc',
): SubtitleStylePreset[] {
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
export function savePresetsToStorage(presets: SubtitleStylePreset[]): void {
  const collection: SubtitleStylePresetCollection = {
    presets: presets.slice(0, MAX_PRESETS),
    version: CURRENT_VERSION,
  };

  try {
    const serialized = JSON.stringify(collection);
    localStorage.setItem(PRESET_STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save subtitle style presets:', error);
  }
}

/**
 * 从本地存储加载预设集合
 */
export function loadPresetsFromStorage(): SubtitleStylePresetCollection {
  try {
    const serialized = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!serialized) {
      return { presets: [], version: CURRENT_VERSION };
    }

    const collection = JSON.parse(serialized) as SubtitleStylePresetCollection;

    // 版本迁移
    if (collection.version < CURRENT_VERSION) {
      return migratePresets(collection);
    }

    return collection;
  } catch (error) {
    console.error('Failed to load subtitle style presets:', error);
    return { presets: [], version: CURRENT_VERSION };
  }
}

/**
 * 清除本地存储中的预设
 */
export function clearPresetsFromStorage(): void {
  localStorage.removeItem(PRESET_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Import/Export
// ---------------------------------------------------------------------------

/**
 * 导出预设为JSON
 */
export function exportPresetsToJson(presets: SubtitleStylePreset[]): string {
  const collection: SubtitleStylePresetCollection = {
    presets,
    version: CURRENT_VERSION,
  };

  return JSON.stringify(collection, null, 2);
}

/**
 * 从JSON导入预设
 */
export function importPresetsFromJson(json: string): SubtitleStylePreset[] {
  try {
    const collection = JSON.parse(json) as SubtitleStylePresetCollection;

    if (!collection.presets || !Array.isArray(collection.presets)) {
      throw new Error('Invalid preset format');
    }

    // 验证和规范化每个预设
    return collection.presets.map((preset) => ({
      ...preset,
      id: preset.id || generatePresetId(),
      name: preset.name || 'Unnamed Preset',
      kind: 'preset' as const,
      style: normalizeSubtitleStyleTemplateStyle(preset.style),
      createdAt: preset.createdAt || new Date().toISOString(),
      updatedAt: preset.updatedAt || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to import presets:', error);
    throw new Error('Invalid preset file format');
  }
}

/**
 * 导出单个预设为文件
 */
export function exportPresetToFile(
  preset: SubtitleStylePreset,
  format: SubtitleStylePresetExportFormat = 'json',
): { filename: string; content: string } {
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
export function importPresetFromFile(content: string): SubtitleStylePreset {
  try {
    const data = JSON.parse(content);

    // 检查是否为 Open Factory 预设格式
    if (data.format === 'open-factory-preset' && data.type === 'subtitle-style') {
      return importSinglePreset(data.preset);
    }

    // 直接作为预设导入
    return importSinglePreset(data);
  } catch (error) {
    console.error('Failed to import preset from file:', error);
    throw new Error('Invalid preset file');
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * 比较两个样式是否相同
 */
export function areStylesEqual(style1: SubtitleStyle, style2: SubtitleStyle): boolean {
  const keys = Object.keys(style1) as Array<keyof SubtitleStyle>;

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
export function diffStyles(
  style1: SubtitleStyle,
  style2: SubtitleStyle,
): Partial<Record<keyof SubtitleStyle, { from: unknown; to: unknown }>> {
  const diff: Partial<Record<keyof SubtitleStyle, { from: unknown; to: unknown }>> = {};
  const keys = Object.keys(style1) as Array<keyof SubtitleStyle>;

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

function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function importSinglePreset(data: unknown): SubtitleStylePreset {
  const preset = data as Record<string, unknown>;

  if (!preset.style || typeof preset.style !== 'object') {
    throw new Error('Invalid preset: missing style');
  }

  return {
    id: (preset.id as string) || generatePresetId(),
    name: (preset.name as string) || 'Imported Preset',
    kind: 'preset',
    style: normalizeSubtitleStyleTemplateStyle(preset.style as Partial<SubtitleStyle>),
    createdAt: (preset.createdAt as string) || new Date().toISOString(),
    updatedAt: (preset.updatedAt as string) || new Date().toISOString(),
    favorite: preset.favorite as boolean | undefined,
    tags: preset.tags as string[] | undefined,
  };
}

function migratePresets(collection: SubtitleStylePresetCollection): SubtitleStylePresetCollection {
  // 未来版本迁移逻辑
  return {
    ...collection,
    version: CURRENT_VERSION,
    presets: collection.presets.map((preset) => ({
      ...preset,
      kind: 'preset' as const,
      style: normalizeSubtitleStyleTemplateStyle(preset.style),
    })),
  };
}
