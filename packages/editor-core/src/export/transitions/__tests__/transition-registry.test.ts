import { describe, it, expect } from 'vitest';
import {
  TRANSITION_REGISTRY,
  getTransitionsByCategory,
  getTransitionDefinition,
  getTransitionDefaultDuration,
  isCustomTransition,
  searchTransitions,
} from '../transition-registry';
import { TRANSITION_TYPES } from '../../../model/defaults';

describe('transition-registry', () => {
  it('TRANSITION_REGISTRY 包含所有 TRANSITION_TYPES 中的类型', () => {
    const registryTypes = TRANSITION_REGISTRY.map((t) => t.type);
    for (const type of TRANSITION_TYPES) {
      expect(registryTypes).toContain(type);
    }
  });

  it('TRANSITION_REGISTRY 中无重复类型', () => {
    const types = TRANSITION_REGISTRY.map((t) => t.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('每个注册项都有必填字段', () => {
    for (const def of TRANSITION_REGISTRY) {
      expect(def.type).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(['basic', 'advanced', '3d']).toContain(def.category);
      expect(def.icon).toBeTruthy();
      expect(def.defaultDuration).toBeGreaterThan(0);
      expect(def.description).toBeTruthy();
      // 必须有 xfadeName 或 customBuilder 之一
      expect(def.xfadeName != null || def.customBuilder != null).toBe(true);
    }
  });

  it('getTransitionsByCategory 按分类筛选', () => {
    const basic = getTransitionsByCategory('basic');
    const advanced = getTransitionsByCategory('advanced');
    const threeD = getTransitionsByCategory('3d');

    expect(basic.length).toBeGreaterThanOrEqual(8); // dissolve, fade-black, wipe×4, zoom, push×4
    expect(advanced.length).toBeGreaterThanOrEqual(8); // flash×2, block, film-roll×2, motion-blur, light-leak, glitch, shape×2
    expect(threeD.length).toBeGreaterThanOrEqual(4); // rotate, flip×2, cube-rotate, portal

    expect(basic.every((t) => t.category === 'basic')).toBe(true);
    expect(advanced.every((t) => t.category === 'advanced')).toBe(true);
    expect(threeD.every((t) => t.category === '3d')).toBe(true);
  });

  it('getTransitionDefinition 查找已知类型', () => {
    const dissolve = getTransitionDefinition('dissolve');
    expect(dissolve).toBeDefined();
    expect(dissolve!.xfadeName).toBe('dissolve');
    expect(dissolve!.category).toBe('basic');
  });

  it('getTransitionDefinition 返回 undefined 给未知类型', () => {
    // @ts-expect-testing 故意传入非法值
    expect(getTransitionDefinition('nonexistent' as any)).toBeUndefined();
  });

  it('getTransitionDefaultDuration 返回正确默认值', () => {
    expect(getTransitionDefaultDuration('dissolve')).toBe(0.5);
    expect(getTransitionDefaultDuration('flash-white')).toBe(0.3);
    expect(getTransitionDefaultDuration('light-leak')).toBe(0.8);
  });

  it('isCustomTransition 正确区分标准和自定义转场', () => {
    expect(isCustomTransition('dissolve')).toBe(false);
    expect(isCustomTransition('wipe-left')).toBe(false);
    expect(isCustomTransition('push-right')).toBe(false);

    expect(isCustomTransition('rotate')).toBe(true);
    expect(isCustomTransition('light-leak')).toBe(true);
    expect(isCustomTransition('glitch')).toBe(true);
    expect(isCustomTransition('flip-horizontal')).toBe(true);
    expect(isCustomTransition('cube-rotate')).toBe(true);
    expect(isCustomTransition('portal')).toBe(true);
    expect(isCustomTransition('shape-heart')).toBe(true);
    expect(isCustomTransition('motion-blur-wipe')).toBe(true);
  });

  it('searchTransitions 按名称搜索', () => {
    const results = searchTransitions('dissolve');
    expect(results.some((t) => t.type === 'dissolve')).toBe(true);
    expect(results.some((t) => t.type === 'zoom-dissolve')).toBe(true);
  });

  it('searchTransitions 按描述搜索', () => {
    const results = searchTransitions('light leak');
    expect(results.some((t) => t.type === 'light-leak')).toBe(true);
  });

  it('searchTransitions 空查询返回全部', () => {
    expect(searchTransitions('')).toHaveLength(TRANSITION_REGISTRY.length);
    expect(searchTransitions('  ')).toHaveLength(TRANSITION_REGISTRY.length);
  });

  it('新增推拉类转场都映射到 slide xfade', () => {
    const pushLeft = getTransitionDefinition('push-left');
    const pushRight = getTransitionDefinition('push-right');
    const pushUp = getTransitionDefinition('push-up');
    const pushDown = getTransitionDefinition('push-down');

    expect(pushLeft?.xfadeName).toBe('slideleft');
    expect(pushRight?.xfadeName).toBe('slideright');
    expect(pushUp?.xfadeName).toBe('slideup');
    expect(pushDown?.xfadeName).toBe('slidedown');
  });

  it('新增 3D 转场都使用 customBuilder', () => {
    expect(getTransitionDefinition('flip-horizontal')?.customBuilder).toBe('flip-h');
    expect(getTransitionDefinition('flip-vertical')?.customBuilder).toBe('flip-v');
    expect(getTransitionDefinition('cube-rotate')?.customBuilder).toBe('cube-rotate');
    expect(getTransitionDefinition('portal')?.customBuilder).toBe('portal');
  });
});
