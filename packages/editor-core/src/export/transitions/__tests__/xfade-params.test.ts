import { describe, it, expect } from 'vitest';
import { buildXfadeParams, getXfadeName } from '../xfade-params';

describe('xfade-params', () => {
  describe('buildXfadeParams', () => {
    it('为标准 dissolve 转场生成正确滤镜', () => {
      const result = buildXfadeParams({
        type: 'dissolve',
        duration: 0.5,
        offset: 1.0,
        label: 't0',
      });

      expect(result).not.toBeNull();
      expect(result!.filters).toHaveLength(1);
      expect(result!.filters[0]).toBe(
        '[t0_from][t0_to]xfade=transition=dissolve:duration=0.5:offset=1[t0_raw]',
      );
      expect(result!.outputLabel).toBe('t0_raw');
    });

    it('为 wipe-left 生成 wipeleft 滤镜', () => {
      const result = buildXfadeParams({
        type: 'wipe-left',
        duration: 0.3,
        offset: 2.0,
        label: 'tr',
      });

      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('wipeleft');
      expect(result!.filters[0]).toContain('duration=0.3');
      expect(result!.filters[0]).toContain('offset=2');
    });

    it('为 push-left 生成 slideleft 滤镜', () => {
      const result = buildXfadeParams({
        type: 'push-left',
        duration: 0.5,
        offset: 1.5,
        label: 't1',
      });

      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('slideleft');
    });

    it('为 push-right 生成 slideright 滤镜', () => {
      const result = buildXfadeParams({
        type: 'push-right',
        duration: 0.4,
        offset: 1.0,
        label: 't2',
      });

      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('slideright');
    });

    it('为 push-up 生成 slideup 滤镜', () => {
      const result = buildXfadeParams({ type: 'push-up', duration: 0.5, offset: 1.0, label: 't3' });
      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('slideup');
    });

    it('为 push-down 生成 slidedown 滤镜', () => {
      const result = buildXfadeParams({ type: 'push-down', duration: 0.5, offset: 1.0, label: 't4' });
      expect(result).not.toBeNull();
      expect(result!.filters[0]).toContain('slidedown');
    });

    it('自定义转场返回 null', () => {
      expect(buildXfadeParams({ type: 'rotate', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'light-leak', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'glitch', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'flip-horizontal', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'cube-rotate', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'portal', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'shape-heart', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
      expect(buildXfadeParams({ type: 'motion-blur-wipe', duration: 0.5, offset: 1.0, label: 't' })).toBeNull();
    });

    it('所有标准转场都能生成滤镜', () => {
      const standardTypes = [
        'dissolve', 'fade-black', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down',
        'zoom-dissolve', 'flash-white', 'flash-black', 'block',
        'film-roll-open', 'film-roll-close',
        'push-left', 'push-right', 'push-up', 'push-down',
      ] as const;

      for (const type of standardTypes) {
        const result = buildXfadeParams({ type, duration: 0.5, offset: 1.0, label: 't' });
        expect(result, `${type} 应生成滤镜`).not.toBeNull();
        expect(result!.filters[0]).toContain('xfade=');
      }
    });

    it('格式化持续时间和偏移量为 FFmpeg 秒格式', () => {
      const result = buildXfadeParams({
        type: 'dissolve',
        duration: 1.234,
        offset: 5.678,
        label: 't',
      });

      expect(result!.filters[0]).toContain('duration=1.234');
      expect(result!.filters[0]).toContain('offset=5.678');
    });
  });

  describe('getXfadeName', () => {
    it('标准转场返回正确的 xfade 名称', () => {
      expect(getXfadeName('dissolve')).toBe('dissolve');
      expect(getXfadeName('fade-black')).toBe('fadeblack');
      expect(getXfadeName('wipe-left')).toBe('wipeleft');
      expect(getXfadeName('flash-white')).toBe('fadewhite');
      expect(getXfadeName('block')).toBe('pixelize');
      expect(getXfadeName('film-roll-open')).toBe('horzopen');
      expect(getXfadeName('push-left')).toBe('slideleft');
    });

    it('自定义转场返回 null', () => {
      expect(getXfadeName('rotate')).toBeNull();
      expect(getXfadeName('light-leak')).toBeNull();
      expect(getXfadeName('glitch')).toBeNull();
      expect(getXfadeName('flip-horizontal')).toBeNull();
      expect(getXfadeName('cube-rotate')).toBeNull();
      expect(getXfadeName('portal')).toBeNull();
    });
  });
});
