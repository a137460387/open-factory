import { describe, expect, it } from 'vitest';
import {
  StyleMemory,
  calculateWeights,
  applyWeightsToTemplateParams,
  createDefaultPreferenceWeights,
  createDefaultStyleMemoryConfig,
  createEmptyStyleProfile,
  type ModificationRecord,
  type ModificationType,
  type PreferenceWeights,
  type StyleProfile,
} from '../src/automation/style-memory';

// ============================================================
// 工厂函数测试
// ============================================================

describe('createDefaultPreferenceWeights', () => {
  it('返回默认权重', () => {
    const w = createDefaultPreferenceWeights();
    expect(w.clipDurationBias).toBe(0);
    expect(w.pacePreference).toBe(0);
    expect(w.sampleCount).toBe(0);
    expect(w.qualityThresholdAdjust).toBe(0);
  });
});

describe('createEmptyStyleProfile', () => {
  it('创建空配置文件', () => {
    const profile = createEmptyStyleProfile('我的风格', 'template-1');
    expect(profile.name).toBe('我的风格');
    expect(profile.templateId).toBe('template-1');
    expect(profile.records).toHaveLength(0);
    expect(profile.weights.sampleCount).toBe(0);
  });

  it('生成唯一 ID', () => {
    const a = createEmptyStyleProfile('A');
    const b = createEmptyStyleProfile('B');
    expect(a.id).not.toBe(b.id);
  });
});

// ============================================================
// 权重计算测试
// ============================================================

describe('calculateWeights', () => {
  it('空记录返回默认权重', () => {
    const w = calculateWeights([]);
    expect(w.sampleCount).toBe(0);
    expect(w.clipDurationBias).toBe(0);
  });

  it('时长调整记录影响时长偏好', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'clip-duration-adjust', timestamp: 0, templateId: '', before: { duration: 5 }, after: { duration: 8 } },
      { id: '2', type: 'clip-duration-adjust', timestamp: 0, templateId: '', before: { duration: 4 }, after: { duration: 7 } },
    ];
    const w = calculateWeights(records);
    expect(w.clipDurationBias).toBeGreaterThan(0); // 用户倾向于更长
    expect(w.sampleCount).toBe(2);
  });

  it('缩短片段产生负偏好', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'clip-duration-adjust', timestamp: 0, templateId: '', before: { duration: 10 }, after: { duration: 5 } },
      { id: '2', type: 'clip-duration-adjust', timestamp: 0, templateId: '', before: { duration: 8 }, after: { duration: 4 } },
    ];
    const w = calculateWeights(records);
    expect(w.clipDurationBias).toBeLessThan(0);
  });

  it('转场偏好统计', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'transition-change', timestamp: 0, templateId: '', before: {}, after: { type: 'crossfade' } },
      { id: '2', type: 'transition-change', timestamp: 0, templateId: '', before: {}, after: { type: 'crossfade' } },
      { id: '3', type: 'transition-change', timestamp: 0, templateId: '', before: {}, after: { type: 'cut' } },
    ];
    const w = calculateWeights(records);
    expect(w.transitionPreference['crossfade']).toBeGreaterThan(w.transitionPreference['cut'] ?? 0);
  });

  it('速度调整影响节奏偏好', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'speed-change', timestamp: 0, templateId: '', before: { speed: 1 }, after: { speed: 1.5 } },
      { id: '2', type: 'speed-change', timestamp: 0, templateId: '', before: { speed: 1 }, after: { speed: 2 } },
    ];
    const w = calculateWeights(records);
    expect(w.pacePreference).toBeGreaterThan(0);
  });

  it('删除片段影响场景类型权重', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'clip-remove', timestamp: 0, templateId: '', before: {}, after: {}, sceneType: 'landscape' },
      { id: '2', type: 'clip-remove', timestamp: 0, templateId: '', before: {}, after: {}, sceneType: 'landscape' },
    ];
    const w = calculateWeights(records);
    expect(w.sceneTypeWeights['landscape']).toBeLessThan(0);
  });

  it('重排序片段给场景类型正权重', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'clip-reorder', timestamp: 0, templateId: '', before: {}, after: {}, sceneType: 'dialogue' },
    ];
    const w = calculateWeights(records);
    expect(w.sceneTypeWeights['dialogue']).toBeGreaterThan(0);
  });

  it('删除高质量片段提高质量阈值', () => {
    const records: ModificationRecord[] = [
      { id: '1', type: 'clip-remove', timestamp: 0, templateId: '', before: { quality: 80 }, after: {} },
      { id: '2', type: 'clip-remove', timestamp: 0, templateId: '', before: { quality: 75 }, after: {} },
    ];
    const w = calculateWeights(records);
    expect(w.qualityThresholdAdjust).toBeGreaterThan(0);
  });
});

// ============================================================
// 权重应用测试
// ============================================================

describe('applyWeightsToTemplateParams', () => {
  const params = {
    clipDurationRange: { min: 2, max: 10, preferred: 5 },
    qualityWeight: 0.5,
    sceneChangeWeight: 0.7,
    transitionDuration: 0.5,
  };

  it('低样本数不改变参数', () => {
    const weights: PreferenceWeights = { ...createDefaultPreferenceWeights(), sampleCount: 1 };
    const result = applyWeightsToTemplateParams(params, weights);
    expect(result.clipDurationRange.preferred).toBe(5);
  });

  it('正时长偏好增加时长', () => {
    const weights: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      clipDurationBias: 0.8,
    };
    const result = applyWeightsToTemplateParams(params, weights, 1.0);
    expect(result.clipDurationRange.preferred).toBeGreaterThan(5);
  });

  it('负时长偏好减少时长', () => {
    const weights: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      clipDurationBias: -0.8,
    };
    const result = applyWeightsToTemplateParams(params, weights, 1.0);
    expect(result.clipDurationRange.preferred).toBeLessThan(5);
  });

  it('正质量阈值调整增加质量权重', () => {
    const weights: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      qualityThresholdAdjust: 0.8,
    };
    const result = applyWeightsToTemplateParams(params, weights, 1.0);
    expect(result.qualityWeight).toBeGreaterThan(0.5);
  });

  it('快节奏偏好减少转场时长', () => {
    const weights: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      pacePreference: 0.8,
    };
    const result = applyWeightsToTemplateParams(params, weights, 1.0);
    expect(result.transitionDuration).toBeLessThan(0.5);
  });
});

// ============================================================
// StyleMemory 管理器测试
// ============================================================

describe('StyleMemory', () => {
  describe('配置文件管理', () => {
    it('创建配置文件', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('我的风格', 'template-1');
      expect(profile.name).toBe('我的风格');
      expect(mem.getProfile(profile.id)).toBeDefined();
    });

    it('获取所有配置文件', () => {
      const mem = new StyleMemory();
      mem.createProfile('A');
      mem.createProfile('B');
      expect(mem.getAllProfiles()).toHaveLength(2);
    });

    it('删除配置文件', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('待删');
      expect(mem.deleteProfile(profile.id)).toBe(true);
      expect(mem.getProfile(profile.id)).toBeUndefined();
    });

    it('配置文件数量限制', () => {
      const mem = new StyleMemory({ maxProfiles: 2 });
      mem.createProfile('A');
      mem.createProfile('B');
      expect(() => mem.createProfile('C')).toThrow();
    });

    it('重置配置文件', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('测试');
      mem.recordModification(profile.id, 'clip-remove', {}, {});
      expect(mem.getProfile(profile.id)!.records.length).toBeGreaterThan(0);
      mem.resetProfile(profile.id);
      expect(mem.getProfile(profile.id)!.records).toHaveLength(0);
      expect(mem.getProfile(profile.id)!.weights.sampleCount).toBe(0);
    });
  });

  describe('修改记录', () => {
    it('记录修改操作', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('测试');
      const record = mem.recordModification(
        profile.id,
        'clip-duration-adjust',
        { duration: 5 },
        { duration: 8 },
      );
      expect(record.type).toBe('clip-duration-adjust');
      expect(record.before.duration).toBe(5);
      expect(record.after.duration).toBe(8);
    });

    it('记录不存在的配置文件抛出异常', () => {
      const mem = new StyleMemory();
      expect(() => mem.recordModification('nonexistent', 'clip-remove', {}, {})).toThrow();
    });

    it('限制记录数', () => {
      const mem = new StyleMemory({ maxRecordsPerProfile: 3 });
      const profile = mem.createProfile('测试');
      for (let i = 0; i < 5; i++) {
        mem.recordModification(profile.id, 'clip-remove', {}, {});
      }
      expect(mem.getProfile(profile.id)!.records).toHaveLength(3);
    });

    it('自动重新计算权重', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('测试');
      mem.recordModification(profile.id, 'clip-duration-adjust', { duration: 10 }, { duration: 5 });
      const w = mem.getWeights(profile.id);
      expect(w.clipDurationBias).toBeLessThan(0);
    });
  });

  describe('置信度检查', () => {
    it('样本不足时返回 false', () => {
      const mem = new StyleMemory({ minSampleCount: 5 });
      const profile = mem.createProfile('测试');
      mem.recordModification(profile.id, 'clip-remove', {}, {});
      expect(mem.hasEnoughSamples(profile.id)).toBe(false);
    });

    it('样本充足时返回 true', () => {
      const mem = new StyleMemory({ minSampleCount: 3 });
      const profile = mem.createProfile('测试');
      for (let i = 0; i < 5; i++) {
        mem.recordModification(profile.id, 'clip-remove', {}, {});
      }
      expect(mem.hasEnoughSamples(profile.id)).toBe(true);
    });
  });

  describe('模板关联', () => {
    it('按模板 ID 查找配置文件', () => {
      const mem = new StyleMemory();
      mem.createProfile('风格A', 'template-1');
      mem.createProfile('风格B', 'template-2');
      const found = mem.getProfileForTemplate('template-1');
      expect(found?.name).toBe('风格A');
    });

    it('未找到返回 undefined', () => {
      const mem = new StyleMemory();
      expect(mem.getProfileForTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('统计', () => {
    it('返回正确的统计信息', () => {
      const mem = new StyleMemory();
      const profile = mem.createProfile('测试');
      mem.recordModification(profile.id, 'clip-remove', {}, {});
      mem.recordModification(profile.id, 'clip-remove', {}, {});
      mem.recordModification(profile.id, 'transition-change', {}, { type: 'crossfade' });

      const stats = mem.getProfileStats(profile.id);
      expect(stats.totalRecords).toBe(3);
      expect(stats.byType['clip-remove']).toBe(2);
      expect(stats.byType['transition-change']).toBe(1);
    });
  });
});
