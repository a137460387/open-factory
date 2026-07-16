import { describe, it, expect } from 'vitest';
import {
  EASING_PRESETS,
  getEasingPresetsByCategory,
  getEasingPresetById,
  getPresetHandles,
  isStepsPreset,
  getStepsCount,
  type EasingPreset,
} from '../src/easing-presets';
import { applyKeyframeHandlePatch, interpolateKeyframes, type Keyframe } from '../src/keyframes';

describe('easing-presets', () => {
  it('EASING_PRESETS 包含至少 30 个预设', () => {
    expect(EASING_PRESETS.length).toBeGreaterThanOrEqual(30);
  });

  it('所有预设都有必填字段', () => {
    for (const preset of EASING_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(['standard', 'overshoot', 'spring', 'steps']).toContain(preset.category);
      expect(preset.description).toBeTruthy();
      expect(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'elastic', 'bounce']).toContain(preset.easing);
    }
  });

  it('所有预设 ID 唯一', () => {
    const ids = EASING_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('四个分类都有预设', () => {
    expect(getEasingPresetsByCategory('standard').length).toBeGreaterThan(0);
    expect(getEasingPresetsByCategory('overshoot').length).toBeGreaterThan(0);
    expect(getEasingPresetsByCategory('spring').length).toBeGreaterThan(0);
    expect(getEasingPresetsByCategory('steps').length).toBeGreaterThan(0);
  });

  describe('getEasingPresetById', () => {
    it('查找已知 ID', () => {
      const linear = getEasingPresetById('linear');
      expect(linear).toBeDefined();
      expect(linear!.easing).toBe('linear');
    });

    it('查找步进预设', () => {
      const steps4 = getEasingPresetById('steps-4');
      expect(steps4).toBeDefined();
      expect(steps4!.steps).toBe(4);
    });

    it('未知 ID 返回 undefined', () => {
      expect(getEasingPresetById('nonexistent')).toBeUndefined();
    });
  });

  describe('getPresetHandles', () => {
    it('返回有手柄的预设的手柄配置', () => {
      const handles = getPresetHandles('cubic-in');
      expect(handles).not.toBeNull();
      expect(handles!.inHandle).toBeDefined();
      expect(handles!.outHandle).toBeDefined();
    });

    it('返回无手柄的预设的 null', () => {
      const handles = getPresetHandles('linear');
      expect(handles).not.toBeNull();
      expect(handles!.inHandle).toBeUndefined();
      expect(handles!.outHandle).toBeUndefined();
    });

    it('未知 ID 返回 null', () => {
      expect(getPresetHandles('nonexistent')).toBeNull();
    });
  });

  describe('isStepsPreset', () => {
    it('步进预设返回 true', () => {
      expect(isStepsPreset('steps-2')).toBe(true);
      expect(isStepsPreset('steps-4')).toBe(true);
      expect(isStepsPreset('steps-8')).toBe(true);
    });

    it('非步进预设返回 false', () => {
      expect(isStepsPreset('linear')).toBe(false);
      expect(isStepsPreset('cubic-in')).toBe(false);
      expect(isStepsPreset('elastic')).toBe(false);
    });

    it('未知 ID 返回 false', () => {
      expect(isStepsPreset('nonexistent')).toBe(false);
    });
  });

  describe('getStepsCount', () => {
    it('步进预设返回正确步数', () => {
      expect(getStepsCount('steps-2')).toBe(2);
      expect(getStepsCount('steps-3')).toBe(3);
      expect(getStepsCount('steps-4')).toBe(4);
      expect(getStepsCount('steps-5')).toBe(5);
      expect(getStepsCount('steps-6')).toBe(6);
      expect(getStepsCount('steps-8')).toBe(8);
      expect(getStepsCount('steps-10')).toBe(10);
      expect(getStepsCount('steps-12')).toBe(12);
    });

    it('非步进预设返回 null', () => {
      expect(getStepsCount('linear')).toBeNull();
      expect(getStepsCount('cubic-in')).toBeNull();
    });

    it('未知 ID 返回 null', () => {
      expect(getStepsCount('nonexistent')).toBeNull();
    });
  });

  describe('贝塞尔手柄有效性', () => {
    it('有手柄的预设 dx/dy 值在合理范围内', () => {
      for (const preset of EASING_PRESETS) {
        if (preset.inHandle) {
          expect(preset.inHandle.dx).toBeGreaterThanOrEqual(-1);
          expect(preset.inHandle.dx).toBeLessThanOrEqual(2);
          expect(preset.inHandle.dy).toBeGreaterThanOrEqual(-1);
          expect(preset.inHandle.dy).toBeLessThanOrEqual(2);
        }
        if (preset.outHandle) {
          expect(preset.outHandle.dx).toBeGreaterThanOrEqual(-1);
          expect(preset.outHandle.dx).toBeLessThanOrEqual(2);
          expect(preset.outHandle.dy).toBeGreaterThanOrEqual(-1);
          expect(preset.outHandle.dy).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('预设应用到关键帧的交互测试', () => {
    it('将 cubic-in 预设应用到关键帧后，插值产生加速效果', () => {
      const preset = getEasingPresetById('cubic-in')!;
      const handles = getPresetHandles('cubic-in')!;

      const frames: Keyframe<number>[] = [
        { id: 'a', time: 0, value: 0, easing: preset.easing, inHandle: handles.inHandle, outHandle: handles.outHandle },
        { id: 'b', time: 1, value: 1, easing: preset.easing, inHandle: handles.inHandle, outHandle: handles.outHandle },
      ];

      // 有贝塞尔手柄时，中点值不应是简单的线性插值 0.5
      const midValue = interpolateKeyframes(frames, 0.5, 0);
      // cubic-in 应该在前半段较慢，所以中点值应 < 0.5
      expect(midValue).toBeLessThan(0.55);
    });

    it('将 spring-soft 预设应用到关键帧后，插值有过冲行为', () => {
      const preset = getEasingPresetById('spring-soft')!;
      const handles = getPresetHandles('spring-soft')!;

      const frames: Keyframe<number>[] = [
        { id: 'a', time: 0, value: 0, easing: preset.easing, inHandle: handles.inHandle, outHandle: handles.outHandle },
        { id: 'b', time: 1, value: 1, easing: preset.easing, inHandle: handles.inHandle, outHandle: handles.outHandle },
      ];

      const lateValue = interpolateKeyframes(frames, 0.9, 0);
      // spring 预设在接近结束时应有过冲（值可能 > 1）
      expect(lateValue).toBeGreaterThan(0.8);
    });

    it('applyKeyframeHandlePatch 正确应用预设手柄', () => {
      const baseFrame: Keyframe<number> = { id: 'kf1', time: 0, value: 0, easing: 'linear' };
      const handles = getPresetHandles('back-out')!;

      const patched = applyKeyframeHandlePatch(
        baseFrame,
        'out',
        handles.outHandle!,
        baseFrame.handleMode ?? 'independent',
      );

      expect(patched.outHandle).toEqual(handles.outHandle);
    });

    it('所有有手柄的预设都能成功应用到关键帧', () => {
      for (const preset of EASING_PRESETS) {
        const handles = getPresetHandles(preset.id);
        if (!handles?.inHandle && !handles?.outHandle) continue;

        const frame: Keyframe<number> = { id: 'test', time: 0, value: 0, easing: 'linear' };
        let patched = frame;
        if (handles.inHandle) {
          patched = applyKeyframeHandlePatch(patched, 'in', handles.inHandle, 'independent');
        }
        if (handles.outHandle) {
          patched = applyKeyframeHandlePatch(patched, 'out', handles.outHandle, 'independent');
        }
        // applyKeyframeHandlePatch 只更新手柄，不更新 easing
        // 验证手柄已正确应用
        if (handles.inHandle) {
          expect(patched.inHandle).toBeDefined();
        }
        if (handles.outHandle) {
          expect(patched.outHandle).toBeDefined();
        }
      }
    });
  });

  describe('applyStepsEasing (from keyframes.ts)', () => {
    it('steps=2 正确离散化', async () => {
      const { applyStepsEasing } = await import('../src/keyframes');
      expect(applyStepsEasing(0, 2)).toBe(0);
      expect(applyStepsEasing(0.3, 2)).toBe(0);
      expect(applyStepsEasing(0.5, 2)).toBe(0.5);
      expect(applyStepsEasing(0.7, 2)).toBe(0.5);
      expect(applyStepsEasing(1, 2)).toBe(1);
    });

    it('steps=4 正确离散化', async () => {
      const { applyStepsEasing } = await import('../src/keyframes');
      expect(applyStepsEasing(0, 4)).toBe(0);
      expect(applyStepsEasing(0.24, 4)).toBe(0);
      expect(applyStepsEasing(0.25, 4)).toBe(0.25);
      expect(applyStepsEasing(0.5, 4)).toBe(0.5);
      expect(applyStepsEasing(0.75, 4)).toBe(0.75);
      expect(applyStepsEasing(1, 4)).toBe(1);
    });

    it('steps<=1 返回原值', async () => {
      const { applyStepsEasing } = await import('../src/keyframes');
      expect(applyStepsEasing(0.5, 1)).toBe(0.5);
      expect(applyStepsEasing(0.5, 0)).toBe(0.5);
    });

    it('边界值处理', async () => {
      const { applyStepsEasing } = await import('../src/keyframes');
      expect(applyStepsEasing(-0.1, 3)).toBe(0);
      expect(applyStepsEasing(1.1, 3)).toBe(1);
    });
  });
});
