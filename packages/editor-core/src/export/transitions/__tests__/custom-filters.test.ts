import { describe, it, expect } from 'vitest';
import { buildCustomTransitionFilters } from '../custom-filters';

describe('custom-filters', () => {
  const baseOptions = {
    duration: 0.5,
    offset: 1.0,
    label: 't0',
    width: 1920,
    height: 1080,
    fps: 30,
  };

  describe('buildCustomTransitionFilters', () => {
    it('标准转场返回 null', () => {
      expect(buildCustomTransitionFilters({ ...baseOptions, type: 'dissolve' })).toBeNull();
      expect(buildCustomTransitionFilters({ ...baseOptions, type: 'wipe-left' })).toBeNull();
      expect(buildCustomTransitionFilters({ ...baseOptions, type: 'push-left' })).toBeNull();
    });

    it('rotate 转场生成旋转 + fade 滤镜链', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'rotate' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('rotate=');
      expect(result!.filters[0]).toContain('format=rgba');
      expect(result!.filters[1]).toContain('xfade=transition=fade');
      expect(result!.outputLabel).toBe('t0_raw');
    });

    it('motion-blur-wipe 转场生成运动模糊滤镜链', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'motion-blur-wipe' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(3);
      expect(result!.filters[0]).toContain('minterpolate');
      expect(result!.filters[0]).toContain('gblur');
      expect(result!.filters[1]).toContain('minterpolate');
      expect(result!.filters[2]).toContain('wipeleft');
    });

    it('shape-heart 转场生成形状 geq 滤镜', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'shape-heart' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('geq=');
      expect(result!.filters[0]).toContain('format=rgba');
      expect(result!.filters[1]).toContain('overlay=');
    });

    it('shape-star 转场生成星形 geq 滤镜', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'shape-star' });
      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('geq=');
      // star 使用不同的 alpha 表达式
      expect(result!.filters[0]).toContain('abs(X-W/2)');
    });

    it('light-leak 转场生成 dissolve + 光线叠加', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'light-leak' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(3);
      expect(result!.filters[0]).toContain('xfade=transition=dissolve');
      expect(result!.filters[1]).toContain('color=c=white');
      expect(result!.filters[1]).toContain('geq=');
      expect(result!.filters[2]).toContain('overlay=');
    });

    it('glitch 转场生成 pixelize + 色彩偏移', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'glitch' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('pixelize');
      expect(result!.filters[1]).toContain('rgbashift');
      expect(result!.filters[1]).toContain('eq=contrast');
    });

    it('flip-horizontal 转场生成 hflip + fade', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'flip-horizontal' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('hflip');
      expect(result!.filters[1]).toContain('xfade=transition=fade');
    });

    it('flip-vertical 转场生成 vflip + fade', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'flip-vertical' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('vflip');
      expect(result!.filters[1]).toContain('xfade=transition=fade');
    });

    it('cube-rotate 转场生成旋转 + zoompan + fade', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'cube-rotate' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('rotate=');
      expect(result!.filters[0]).toContain('zoompan=');
      expect(result!.filters[1]).toContain('xfade=transition=fade');
    });

    it('portal 转场生成 circleopen + zoompan', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'portal' });
      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(2);
      expect(result!.filters[0]).toContain('circleopen');
      expect(result!.filters[1]).toContain('zoompan=');
      expect(result!.filters[1]).toContain('sin(2*PI');
    });

    it('滤镜标签格式正确', () => {
      const result = buildCustomTransitionFilters({ ...baseOptions, type: 'flip-horizontal', label: 'tr1' });
      expect(result!.filters[0]).toContain('[tr1_from]');
      expect(result!.filters[0]).toContain('[tr1_from_flipped]');
      expect(result!.filters[1]).toContain('[tr1_from_flipped]');
      expect(result!.filters[1]).toContain('[tr1_to]');
      expect(result!.filters[1]).toContain('[tr1_raw]');
    });

    it('所有自定义转场都能生成滤镜', () => {
      const customTypes = [
        'rotate',
        'motion-blur-wipe',
        'shape-heart',
        'shape-star',
        'light-leak',
        'glitch',
        'flip-horizontal',
        'flip-vertical',
        'cube-rotate',
        'portal',
      ] as const;

      for (const type of customTypes) {
        const result = buildCustomTransitionFilters({ ...baseOptions, type });
        expect(result, `${type} 应生成滤镜`).not.toBeNull();
        expect(result!.filters.length).toBeGreaterThan(0);
      }
    });
  });
});
