import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SubtitleStyle } from '../src/model';
import {
  createStylePreset,
  updateStylePreset,
  filterPresets,
  sortPresets,
  mergeWithBuiltinTemplates,
  areStylesEqual,
  diffStyles,
  exportPresetsToJson,
  importPresetsFromJson,
  exportPresetToFile,
  importPresetFromFile,
  type SubtitleStylePreset,
} from '../src/subtitles/style-presets';
import { BUILTIN_SUBTITLE_STYLE_TEMPLATES, normalizeSubtitleStyleTemplateStyle } from '../src/subtitles/style-templates';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestPreset(overrides: Partial<SubtitleStylePreset> = {}): SubtitleStylePreset {
  return {
    id: `preset_${Math.random().toString(36).substring(7)}`,
    name: 'Test Preset',
    kind: 'preset',
    style: normalizeSubtitleStyleTemplateStyle({
      color: '#ffffff',
      fontSize: 42,
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStylePreset', () => {
  it('应该创建新的样式预设', () => {
    const preset = createStylePreset('My Preset', { color: '#ff0000', fontSize: 48 });

    expect(preset.name).toBe('My Preset');
    expect(preset.kind).toBe('preset');
    expect(preset.style.color).toBe('#ff0000');
    expect(preset.style.fontSize).toBe(48);
    expect(preset.id).toBeDefined();
    expect(preset.createdAt).toBeDefined();
    expect(preset.updatedAt).toBeDefined();
  });

  it('应该规范化样式值', () => {
    const preset = createStylePreset('Test', { fontSize: 500 }); // 超出范围

    expect(preset.style.fontSize).toBe(200); // 最大值限制
  });

  it('应该支持标签', () => {
    const preset = createStylePreset('Test', {}, ['movie', 'subtitle']);

    expect(preset.tags).toEqual(['movie', 'subtitle']);
  });
});

describe('updateStylePreset', () => {
  it('应该更新预设名称', () => {
    const preset = createTestPreset({ name: 'Old Name' });
    const updated = updateStylePreset(preset, { name: 'New Name' });

    expect(updated.name).toBe('New Name');
    expect(updated.id).toBe(preset.id);
    expect(updated.updatedAt).toBeDefined();
  });

  it('应该更新预设样式', () => {
    const preset = createTestPreset();
    const updated = updateStylePreset(preset, { style: { color: '#00ff00' } });

    expect(updated.style.color).toBe('#00ff00');
  });

  it('应该更新收藏状态', () => {
    const preset = createTestPreset();
    const updated = updateStylePreset(preset, { favorite: true });

    expect(updated.favorite).toBe(true);
  });
});

describe('filterPresets', () => {
  let presets: SubtitleStylePreset[];

  beforeEach(() => {
    presets = [
      createTestPreset({ id: '1', name: 'Movie Style', tags: ['movie'], favorite: true }),
      createTestPreset({ id: '2', name: 'Subtitle Basic', tags: ['basic'] }),
      createTestPreset({ id: '3', name: 'Karaoke Fun', tags: ['karaoke', 'fun'], favorite: true }),
    ];
  });

  it('应该按搜索文本过滤', () => {
    const filtered = filterPresets(presets, { searchText: 'movie' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('应该按标签过滤', () => {
    const filtered = filterPresets(presets, { tags: ['fun'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('3');
  });

  it('应该只显示收藏', () => {
    const filtered = filterPresets(presets, { favoritesOnly: true });
    expect(filtered).toHaveLength(2);
  });

  it('应该支持组合过滤', () => {
    const filtered = filterPresets(presets, {
      searchText: 'style',
      favoritesOnly: true,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
});

describe('sortPresets', () => {
  it('应该按名称排序', () => {
    const presets = [
      createTestPreset({ name: 'Banana' }),
      createTestPreset({ name: 'Apple' }),
      createTestPreset({ name: 'Cherry' }),
    ];

    const sorted = sortPresets(presets, 'name', 'asc');
    expect(sorted.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('应该按创建时间排序', () => {
    const presets = [
      createTestPreset({ createdAt: '2024-01-01' }),
      createTestPreset({ createdAt: '2024-03-01' }),
      createTestPreset({ createdAt: '2024-02-01' }),
    ];

    const sorted = sortPresets(presets, 'createdAt', 'desc');
    expect(sorted.map((p) => p.createdAt)).toEqual([
      '2024-03-01',
      '2024-02-01',
      '2024-01-01',
    ]);
  });
});

describe('mergeWithBuiltinTemplates', () => {
  it('应该合并内置模板和用户预设', () => {
    const userPresets = [createTestPreset({ name: 'User Preset' })];

    const merged = mergeWithBuiltinTemplates(userPresets, BUILTIN_SUBTITLE_STYLE_TEMPLATES);

    expect(merged.length).toBe(BUILTIN_SUBTITLE_STYLE_TEMPLATES.length + 1);
    // 内置模板在前
    expect(merged[0].kind).toBe('builtin');
    // 用户预设在后
    expect(merged[merged.length - 1].kind).toBe('preset');
  });
});

describe('areStylesEqual', () => {
  it('应该判断相同样式为相等', () => {
    const style1 = normalizeSubtitleStyleTemplateStyle({ color: '#ff0000' });
    const style2 = normalizeSubtitleStyleTemplateStyle({ color: '#ff0000' });

    expect(areStylesEqual(style1, style2)).toBe(true);
  });

  it('应该判断不同样式为不相等', () => {
    const style1 = normalizeSubtitleStyleTemplateStyle({ color: '#ff0000' });
    const style2 = normalizeSubtitleStyleTemplateStyle({ color: '#00ff00' });

    expect(areStylesEqual(style1, style2)).toBe(false);
  });
});

describe('diffStyles', () => {
  it('应该计算样式差异', () => {
    const style1 = normalizeSubtitleStyleTemplateStyle({ color: '#ff0000', fontSize: 42 });
    const style2 = normalizeSubtitleStyleTemplateStyle({ color: '#00ff00', fontSize: 42 });

    const diff = diffStyles(style1, style2);

    expect(diff.color).toEqual({ from: '#ff0000', to: '#00ff00' });
    expect(diff.fontSize).toBeUndefined(); // 相同
  });
});

describe('exportPresetsToJson', () => {
  it('应该导出预设为JSON', () => {
    const presets = [createTestPreset({ name: 'Test' })];
    const json = exportPresetsToJson(presets);

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.presets).toHaveLength(1);
    expect(parsed.presets[0].name).toBe('Test');
  });
});

describe('importPresetsFromJson', () => {
  it('应该从JSON导入预设', () => {
    const original = [createTestPreset({ name: 'Imported' })];
    const json = exportPresetsToJson(original);

    const imported = importPresetsFromJson(json);

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('Imported');
    expect(imported[0].kind).toBe('preset');
  });

  it('应该在JSON格式无效时抛出错误', () => {
    expect(() => importPresetsFromJson('invalid json')).toThrow();
  });

  it('应该在缺少presets数组时抛出错误', () => {
    expect(() => importPresetsFromJson('{}')).toThrow();
  });
});

describe('exportPresetToFile', () => {
  it('应该导出为JSON格式', () => {
    const preset = createTestPreset({ name: 'My Preset' });
    const { filename, content } = exportPresetToFile(preset, 'json');

    expect(filename).toBe('My_Preset.json');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('应该导出为OFP格式', () => {
    const preset = createTestPreset({ name: 'My Preset' });
    const { filename, content } = exportPresetToFile(preset, 'ofp');

    expect(filename).toBe('My_Preset.ofp');

    const parsed = JSON.parse(content);
    expect(parsed.format).toBe('open-factory-preset');
    expect(parsed.type).toBe('subtitle-style');
  });
});

describe('importPresetFromFile', () => {
  it('应该从OFP文件导入', () => {
    const preset = createTestPreset({ name: 'OFP Preset' });
    const { content } = exportPresetToFile(preset, 'ofp');

    const imported = importPresetFromFile(content);

    expect(imported.name).toBe('OFP Preset');
    expect(imported.kind).toBe('preset');
  });

  it('应该从JSON文件导入', () => {
    const preset = createTestPreset({ name: 'JSON Preset' });
    const content = JSON.stringify(preset);

    const imported = importPresetFromFile(content);

    expect(imported.name).toBe('JSON Preset');
  });
});
