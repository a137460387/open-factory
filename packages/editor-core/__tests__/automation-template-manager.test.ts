import { describe, expect, it, vi } from 'vitest';
import {
  TemplateManager,
  createEmptyTemplate,
  normalizeTemplate,
  normalizeRhythmParams,
  createDefaultRhythmParams,
  createDefaultTransitionPreference,
  createDefaultSubtitleStyleConfig,
  createDefaultClipFilterRule,
  createDefaultTemplateManagerConfig,
  BUILTIN_EDIT_TEMPLATES,
  BUILTIN_vlog_TEMPLATE,
  BUILTIN_SHORT_VIDEO_TEMPLATE,
  BUILTIN_PROMO_TEMPLATE,
  type EditTemplate,
  type EditTemplateCategory,
  type TemplateExportData,
} from '../src/automation/template-manager';

// ============================================================
// 工厂函数测试
// ============================================================

describe('createEmptyTemplate', () => {
  it('创建具有默认值的模板', () => {
    const tpl = createEmptyTemplate('我的模板', 'custom');
    expect(tpl.name).toBe('我的模板');
    expect(tpl.category).toBe('custom');
    expect(tpl.builtin).toBe(false);
    expect(tpl.version).toBe(1);
    expect(tpl.rhythm).toBeDefined();
    expect(tpl.transition).toBeDefined();
    expect(tpl.subtitle).toBeDefined();
    expect(tpl.filter).toBeDefined();
  });

  it('生成唯一 ID', () => {
    const a = createEmptyTemplate('A', 'vlog');
    const b = createEmptyTemplate('B', 'vlog');
    expect(a.id).not.toBe(b.id);
  });
});

describe('normalizeRhythmParams', () => {
  it('返回完整参数', () => {
    const params = normalizeRhythmParams({ style: 'fast', clipDurationRange: { min: 1, max: 5, preferred: 3 } });
    expect(params.style).toBe('fast');
    expect(params.clipDurationRange.min).toBe(1);
  });

  it('使用默认值填充缺失字段', () => {
    const params = normalizeRhythmParams({});
    expect(params.style).toBe('medium');
    expect(params.silenceTolerance).toBeGreaterThanOrEqual(0);
  });

  it('限制权重范围', () => {
    const params = normalizeRhythmParams({ sceneChangeWeight: 2, qualityWeight: -1 });
    expect(params.sceneChangeWeight).toBeLessThanOrEqual(1);
    expect(params.qualityWeight).toBeGreaterThanOrEqual(0);
  });
});

describe('normalizeTemplate', () => {
  it('规范化部分数据', () => {
    const tpl = normalizeTemplate({ name: '测试' });
    expect(tpl.name).toBe('测试');
    expect(tpl.id).toBeTruthy();
    expect(tpl.createdAt).toBeGreaterThan(0);
  });

  it('保留已有 ID', () => {
    const tpl = normalizeTemplate({ id: 'custom-id', name: '保留' });
    expect(tpl.id).toBe('custom-id');
  });
});

// ============================================================
// 内置模板测试
// ============================================================

describe('内置模板', () => {
  it('包含 3 个内置模板', () => {
    expect(BUILTIN_EDIT_TEMPLATES).toHaveLength(3);
  });

  it('Vlog 模板参数合理', () => {
    expect(BUILTIN_vlog_TEMPLATE.category).toBe('vlog');
    expect(BUILTIN_vlog_TEMPLATE.builtin).toBe(true);
    expect(BUILTIN_vlog_TEMPLATE.rhythm.clipDurationRange.min).toBeGreaterThan(0);
    expect(BUILTIN_vlog_TEMPLATE.transition.defaultDuration).toBeGreaterThan(0);
  });

  it('短视频模板节奏快', () => {
    expect(BUILTIN_SHORT_VIDEO_TEMPLATE.rhythm.style).toBe('fast');
    expect(BUILTIN_SHORT_VIDEO_TEMPLATE.rhythm.clipDurationRange.max).toBeLessThan(
      BUILTIN_vlog_TEMPLATE.rhythm.clipDurationRange.max,
    );
  });

  it('宣传片模板质量要求高', () => {
    expect(BUILTIN_PROMO_TEMPLATE.filter.minQuality).toBeGreaterThan(
      BUILTIN_SHORT_VIDEO_TEMPLATE.filter.minQuality,
    );
  });
});

// ============================================================
// TemplateManager 测试
// ============================================================

describe('TemplateManager', () => {
  it('初始化时加载内置模板', () => {
    const manager = new TemplateManager();
    const all = manager.getAllTemplates();
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.filter((t) => t.builtin)).toHaveLength(3);
  });

  describe('CRUD 操作', () => {
    it('创建自定义模板', () => {
      const manager = new TemplateManager();
      const tpl = manager.createTemplate({ name: '自定义', category: 'vlog' });
      expect(tpl.name).toBe('自定义');
      expect(tpl.builtin).toBe(false);
      expect(manager.getTemplate(tpl.id)).toBeDefined();
    });

    it('更新自定义模板', () => {
      const manager = new TemplateManager();
      const tpl = manager.createTemplate({ name: '原始' });
      const updated = manager.updateTemplate(tpl.id, { name: '更新后' });
      expect(updated.name).toBe('更新后');
      expect(updated.id).toBe(tpl.id);
    });

    it('不能更新内置模板', () => {
      const manager = new TemplateManager();
      expect(() => manager.updateTemplate('builtin-vlog', { name: '改名' })).toThrow();
    });

    it('删除自定义模板', () => {
      const manager = new TemplateManager();
      const tpl = manager.createTemplate({ name: '待删' });
      expect(manager.deleteTemplate(tpl.id)).toBe(true);
      expect(manager.getTemplate(tpl.id)).toBeUndefined();
    });

    it('不能删除内置模板', () => {
      const manager = new TemplateManager();
      expect(() => manager.deleteTemplate('builtin-vlog')).toThrow();
    });

    it('删除不存在的模板返回 false', () => {
      const manager = new TemplateManager();
      expect(manager.deleteTemplate('nonexistent')).toBe(false);
    });
  });

  describe('查询', () => {
    it('按类别查询', () => {
      const manager = new TemplateManager();
      const vlogTemplates = manager.getTemplatesByCategory('vlog');
      expect(vlogTemplates.length).toBeGreaterThanOrEqual(1);
      expect(vlogTemplates.every((t) => t.category === 'vlog')).toBe(true);
    });

    it('获取自定义模板', () => {
      const manager = new TemplateManager();
      manager.createTemplate({ name: '自定义1' });
      manager.createTemplate({ name: '自定义2' });
      expect(manager.getCustomTemplates()).toHaveLength(2);
    });

    it('搜索模板', () => {
      const manager = new TemplateManager();
      const results = manager.searchTemplates('vlog');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('搜索不区分大小写', () => {
      const manager = new TemplateManager();
      const results = manager.searchTemplates('VLOG');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('导入导出', () => {
    it('导出和导入模板', () => {
      const manager = new TemplateManager();
      const original = manager.createTemplate({ name: '导出测试', tags: ['test'] });
      const exported = manager.exportTemplate(original.id);
      expect(exported.formatVersion).toBe(1);
      expect(exported.template.name).toBe('导出测试');

      const imported = manager.importTemplate(exported);
      expect(imported.name).toBe('导出测试');
      expect(imported.id).not.toBe(original.id); // 新 ID
    });

    it('批量导出和导入', () => {
      const manager = new TemplateManager();
      manager.createTemplate({ name: 'A' });
      manager.createTemplate({ name: 'B' });
      const exported = manager.exportAllCustom();
      expect(exported).toHaveLength(2);

      const manager2 = new TemplateManager();
      const imported = manager2.importBatch(exported);
      expect(imported).toHaveLength(2);
    });

    it('拒绝不支持的格式版本', () => {
      const manager = new TemplateManager();
      expect(() =>
        manager.importTemplate({ formatVersion: 99 as any, template: {} as any, exportedAt: 0 }),
      ).toThrow();
    });
  });

  describe('事件', () => {
    it('触发创建事件', () => {
      const manager = new TemplateManager();
      const listener = vi.fn();
      manager.on('created', listener);
      manager.createTemplate({ name: '事件测试' });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toBe('created');
    });

    it('触发更新事件', () => {
      const manager = new TemplateManager();
      const tpl = manager.createTemplate({ name: '原始' });
      const listener = vi.fn();
      manager.on('updated', listener);
      manager.updateTemplate(tpl.id, { name: '更新' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('触发删除事件', () => {
      const manager = new TemplateManager();
      const tpl = manager.createTemplate({ name: '待删' });
      const listener = vi.fn();
      manager.on('deleted', listener);
      manager.deleteTemplate(tpl.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('移除监听器', () => {
      const manager = new TemplateManager();
      const listener = vi.fn();
      manager.on('created', listener);
      manager.off('created', listener);
      manager.createTemplate({ name: '无事件' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('限制', () => {
    it('自定义模板数量限制', () => {
      const manager = new TemplateManager({ maxCustomTemplates: 2 });
      manager.createTemplate({ name: 'A' });
      manager.createTemplate({ name: 'B' });
      expect(() => manager.createTemplate({ name: 'C' })).toThrow();
    });
  });

  describe('统计', () => {
    it('返回正确的统计信息', () => {
      const manager = new TemplateManager();
      manager.createTemplate({ name: '自定义', category: 'vlog' });
      const stats = manager.getStats();
      expect(stats.total).toBe(4); // 3 builtin + 1 custom
      expect(stats.builtin).toBe(3);
      expect(stats.custom).toBe(1);
      expect(stats.byCategory['vlog']).toBeGreaterThanOrEqual(2);
    });
  });
});
