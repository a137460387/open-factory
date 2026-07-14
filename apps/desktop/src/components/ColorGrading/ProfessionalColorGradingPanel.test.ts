import { describe, expect, it } from 'vitest';
import type { ColorCorrection, ThreeWayColor } from '@open-factory/editor-core';
import {
  normalizeColorCorrection,
  normalizeThreeWayColor,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_THREE_WAY_COLOR,
} from '@open-factory/editor-core';

describe('ProfessionalColorGradingPanel - 数据转换', () => {
  describe('normalizeColorCorrection', () => {
    it('应该返回默认值当输入为 undefined', () => {
      const result = normalizeColorCorrection(undefined);
      expect(result.brightness).toBe(DEFAULT_COLOR_CORRECTION.brightness);
      expect(result.contrast).toBe(DEFAULT_COLOR_CORRECTION.contrast);
      expect(result.saturation).toBe(DEFAULT_COLOR_CORRECTION.saturation);
      expect(result.hue).toBe(DEFAULT_COLOR_CORRECTION.hue);
    });

    it('应该保留已设置的值', () => {
      const partial: Partial<ColorCorrection> = {
        brightness: 0.5,
        contrast: 1.5,
        saturation: 0.8,
        hue: 45,
      };
      const result = normalizeColorCorrection(partial);
      expect(result.brightness).toBe(0.5);
      expect(result.contrast).toBe(1.5);
      expect(result.saturation).toBe(0.8);
      expect(result.hue).toBe(45);
    });

    it('应该合并部分更新', () => {
      const base: ColorCorrection = {
        brightness: 0.1,
        contrast: 1.2,
        saturation: 1.0,
        hue: 0,
      };
      const patch: Partial<ColorCorrection> = {
        brightness: 0.5,
        contrast: 1.8,
      };
      const result = normalizeColorCorrection({ ...base, ...patch });
      expect(result.brightness).toBe(0.5);
      expect(result.contrast).toBe(1.8);
      expect(result.saturation).toBe(1.0);
      expect(result.hue).toBe(0);
    });

    it('应该处理 lutPath 为 null 的情况', () => {
      const result = normalizeColorCorrection({ lutPath: null });
      expect(result.lutPath).toBeNull();
    });

    it('应该处理 lutPath 为字符串的情况', () => {
      const result = normalizeColorCorrection({ lutPath: '/path/to/lut.cube' });
      expect(result.lutPath).toBe('/path/to/lut.cube');
    });
  });

  describe('normalizeThreeWayColor', () => {
    it('应该返回默认值当输入为 undefined', () => {
      const result = normalizeThreeWayColor(undefined);
      expect(result.lift).toEqual(DEFAULT_THREE_WAY_COLOR.lift);
      expect(result.gamma).toEqual(DEFAULT_THREE_WAY_COLOR.gamma);
      expect(result.gain).toEqual(DEFAULT_THREE_WAY_COLOR.gain);
    });

    it('应该保留已设置的色轮值', () => {
      const partial: Partial<ThreeWayColor> = {
        lift: { r: 0.1, g: -0.1, b: 0.2, intensity: 1.0 },
        gamma: { r: 0.0, g: 0.0, b: 0.0, intensity: 1.2 },
      };
      const result = normalizeThreeWayColor(partial);
      expect(result.lift.r).toBe(0.1);
      expect(result.lift.g).toBe(-0.1);
      expect(result.lift.b).toBe(0.2);
      expect(result.lift.intensity).toBe(1.0);
      expect(result.gamma.intensity).toBe(1.2);
    });

    it('应该处理部分色轮更新', () => {
      const base: ThreeWayColor = {
        lift: { r: 0.1, g: 0.0, b: 0.0, intensity: 1.0 },
        gamma: { r: 0.0, g: 0.0, b: 0.0, intensity: 1.0 },
        gain: { r: 0.0, g: 0.0, b: 0.0, intensity: 1.0 },
      };
      const result = normalizeThreeWayColor(base);
      expect(result.lift.r).toBe(0.1);
      expect(result.gamma.r).toBe(0.0);
      expect(result.gain.r).toBe(0.0);
    });
  });

  describe('颜色校正参数范围', () => {
    it('亮度应该在 -1 到 1 范围内', () => {
      const result = normalizeColorCorrection({ brightness: 0.5 });
      expect(result.brightness).toBeGreaterThanOrEqual(-1);
      expect(result.brightness).toBeLessThanOrEqual(1);
    });

    it('对比度应该在 0 到 2 范围内', () => {
      const result = normalizeColorCorrection({ contrast: 1.5 });
      expect(result.contrast).toBeGreaterThanOrEqual(0);
      expect(result.contrast).toBeLessThanOrEqual(2);
    });

    it('饱和度应该在 0 到 2 范围内', () => {
      const result = normalizeColorCorrection({ saturation: 0.8 });
      expect(result.saturation).toBeGreaterThanOrEqual(0);
      expect(result.saturation).toBeLessThanOrEqual(2);
    });

    it('色相应该在 -180 到 180 范围内', () => {
      const result = normalizeColorCorrection({ hue: 45 });
      expect(result.hue).toBeGreaterThanOrEqual(-180);
      expect(result.hue).toBeLessThanOrEqual(180);
    });
  });

  describe('色轮参数', () => {
    it('lift 的 RGB 值应该在 -1 到 1 范围内', () => {
      const result = normalizeThreeWayColor({
        lift: { r: 0.5, g: -0.3, b: 0.8, intensity: 1.0 },
      });
      expect(result.lift.r).toBeGreaterThanOrEqual(-1);
      expect(result.lift.r).toBeLessThanOrEqual(1);
      expect(result.lift.g).toBeGreaterThanOrEqual(-1);
      expect(result.lift.g).toBeLessThanOrEqual(1);
      expect(result.lift.b).toBeGreaterThanOrEqual(-1);
      expect(result.lift.b).toBeLessThanOrEqual(1);
    });

    it('gamma 的 RGB 值应该在 -1 到 1 范围内', () => {
      const result = normalizeThreeWayColor({
        gamma: { r: 0.2, g: -0.5, b: 0.1, intensity: 1.0 },
      });
      expect(result.gamma.r).toBeGreaterThanOrEqual(-1);
      expect(result.gamma.r).toBeLessThanOrEqual(1);
    });

    it('gain 的 RGB 值应该在 -1 到 1 范围内', () => {
      const result = normalizeThreeWayColor({
        gain: { r: -0.7, g: 0.4, b: 0.9, intensity: 1.0 },
      });
      expect(result.gain.r).toBeGreaterThanOrEqual(-1);
      expect(result.gain.r).toBeLessThanOrEqual(1);
    });

    it('intensity 应该在 0 到 2 范围内', () => {
      const result = normalizeThreeWayColor({
        lift: { r: 0.0, g: 0.0, b: 0.0, intensity: 1.5 },
      });
      expect(result.lift.intensity).toBeGreaterThanOrEqual(0);
      expect(result.lift.intensity).toBeLessThanOrEqual(2);
    });
  });
});
