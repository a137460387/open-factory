import { describe, it, expect } from 'vitest';
import {
  getNoiseReductionPreset,
  getNoiseReductionPresets,
  getNoiseReductionPresetLabel,
  normalizeNoiseReductionParams,
  buildNoiseReductionFfmpegArgs,
  buildNoiseReductionFilterString,
  estimateNoiseReduction,
  isValidNoiseReductionParams,
  strengthToNoiseReductionParams,
  noiseReductionToEffectParams,
  type NoiseReductionParams,
} from '../../src/audio/noise-reduction';

describe('noise-reduction', () => {
  describe('getNoiseReductionPreset', () => {
    it('返回轻度降噪预设', () => {
      const preset = getNoiseReductionPreset('light');
      expect(preset.noiseFloor).toBe(-20);
      expect(preset.nrType).toBe(0);
      expect(preset.autoNoiseSampling).toBe(false);
    });

    it('返回中度降噪预设', () => {
      const preset = getNoiseReductionPreset('medium');
      expect(preset.noiseFloor).toBe(-30);
      expect(preset.nrType).toBe(1);
      expect(preset.autoNoiseSampling).toBe(false);
    });

    it('返回强力降噪预设', () => {
      const preset = getNoiseReductionPreset('heavy');
      expect(preset.noiseFloor).toBe(-45);
      expect(preset.nrType).toBe(2);
      expect(preset.autoNoiseSampling).toBe(true);
    });

    it('返回自定义预设', () => {
      const preset = getNoiseReductionPreset('custom');
      expect(preset.noiseFloor).toBe(-25);
      expect(preset.nrType).toBe(1);
    });

    it('返回的对象是副本，不是引用', () => {
      const preset1 = getNoiseReductionPreset('medium');
      const preset2 = getNoiseReductionPreset('medium');
      expect(preset1).not.toBe(preset2);
      expect(preset1).toEqual(preset2);
    });
  });

  describe('getNoiseReductionPresets', () => {
    it('返回所有预设名称', () => {
      const presets = getNoiseReductionPresets();
      expect(presets).toContain('light');
      expect(presets).toContain('medium');
      expect(presets).toContain('heavy');
      expect(presets).toContain('custom');
      expect(presets.length).toBe(4);
    });
  });

  describe('getNoiseReductionPresetLabel', () => {
    it('返回正确的中文标签', () => {
      expect(getNoiseReductionPresetLabel('light')).toBe('轻度降噪');
      expect(getNoiseReductionPresetLabel('medium')).toBe('中度降噪');
      expect(getNoiseReductionPresetLabel('heavy')).toBe('强力降噪');
      expect(getNoiseReductionPresetLabel('custom')).toBe('自定义');
    });
  });

  describe('normalizeNoiseReductionParams', () => {
    it('使用默认值填充缺失字段', () => {
      const params = normalizeNoiseReductionParams({});
      expect(params.noiseFloor).toBe(-25);
      expect(params.nrType).toBe(1);
      expect(params.autoNoiseSampling).toBe(false);
      expect(params.noiseSampleStart).toBe(0);
      expect(params.noiseSampleEnd).toBe(0);
    });

    it('钳制 noiseFloor 到有效范围', () => {
      expect(normalizeNoiseReductionParams({ noiseFloor: -100 }).noiseFloor).toBe(-60);
      expect(normalizeNoiseReductionParams({ noiseFloor: 10 }).noiseFloor).toBe(0);
      expect(normalizeNoiseReductionParams({ noiseFloor: -30 }).noiseFloor).toBe(-30);
    });

    it('钳制 nrType 到有效范围', () => {
      expect(normalizeNoiseReductionParams({ nrType: -1 }).nrType).toBe(0);
      expect(normalizeNoiseReductionParams({ nrType: 5 }).nrType).toBe(2);
      expect(normalizeNoiseReductionParams({ nrType: 1 }).nrType).toBe(1);
    });

    it('处理非有限数值', () => {
      const params = normalizeNoiseReductionParams({ noiseFloor: NaN });
      expect(params.noiseFloor).toBe(-60); // 默认回退到 min
    });

    it('保留提供的有效值', () => {
      const params = normalizeNoiseReductionParams({
        noiseFloor: -40,
        nrType: 2,
        autoNoiseSampling: true,
        noiseSampleStart: 0.5,
        noiseSampleEnd: 2,
      });
      expect(params.noiseFloor).toBe(-40);
      expect(params.nrType).toBe(2);
      expect(params.autoNoiseSampling).toBe(true);
      expect(params.noiseSampleStart).toBe(0.5);
      expect(params.noiseSampleEnd).toBe(2);
    });
  });

  describe('buildNoiseReductionFfmpegArgs', () => {
    it('生成基本 afftdn 参数', () => {
      const args = buildNoiseReductionFfmpegArgs({
        noiseFloor: -25,
        nrType: 1,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
      });
      expect(args.length).toBeGreaterThan(0);
      expect(args.some((a) => a.includes('afftdn'))).toBe(true);
      expect(args.some((a) => a.includes('nf=-25'))).toBe(true);
      expect(args.some((a) => a.includes('nr=1'))).toBe(true);
    });

    it('使用参数数组风格，不拼接 shell 字符串', () => {
      const args = buildNoiseReductionFfmpegArgs(getNoiseReductionPreset('medium'));
      // 每个参数应该是独立的字符串
      for (const arg of args) {
        expect(typeof arg).toBe('string');
      }
    });

    it('规范化参数后再生成', () => {
      const args = buildNoiseReductionFfmpegArgs({
        noiseFloor: -100, // 超出范围
        nrType: 5, // 超出范围
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
      });
      // 应该被钳制到有效范围
      expect(args.some((a) => a.includes('nf=-60'))).toBe(true);
      expect(args.some((a) => a.includes('nr=2'))).toBe(true);
    });
  });

  describe('buildNoiseReductionFilterString', () => {
    it('生成正确的滤镜字符串格式', () => {
      const filter = buildNoiseReductionFilterString({
        noiseFloor: -30,
        nrType: 1,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
      });
      expect(filter).toBe('afftdn=nf=-30:nr=1');
    });

    it('支持所有降噪类型', () => {
      for (let nrType = 0; nrType <= 2; nrType++) {
        const filter = buildNoiseReductionFilterString({
          noiseFloor: -25,
          nrType,
          autoNoiseSampling: false,
          noiseSampleStart: 0,
          noiseSampleEnd: 0,
        });
        expect(filter).toContain(`nr=${nrType}`);
      }
    });
  });

  describe('estimateNoiseReduction', () => {
    it('返回预览结果', () => {
      const result = estimateNoiseReduction(getNoiseReductionPreset('medium'), 0);
      expect(result.beforePeakDb).toBe(0);
      expect(result.afterPeakDb).toBeLessThanOrEqual(0);
      expect(result.snrImprovement).toBeGreaterThan(0);
      expect(result.filterArgs.length).toBeGreaterThan(0);
    });

    it('降噪强度越大，SNR 改善越大', () => {
      const light = estimateNoiseReduction(getNoiseReductionPreset('light'), 0);
      const heavy = estimateNoiseReduction(getNoiseReductionPreset('heavy'), 0);
      expect(heavy.snrImprovement).toBeGreaterThan(light.snrImprovement);
    });

    it('输入峰值被保留', () => {
      const result = estimateNoiseReduction(getNoiseReductionPreset('medium'), -10);
      expect(result.beforePeakDb).toBe(-10);
    });
  });

  describe('isValidNoiseReductionParams', () => {
    it('有效参数返回 true', () => {
      expect(isValidNoiseReductionParams({ noiseFloor: -30, nrType: 1 })).toBe(true);
    });

    it('超出范围的 noiseFloor 返回 false', () => {
      expect(isValidNoiseReductionParams({ noiseFloor: -100 })).toBe(false);
      expect(isValidNoiseReductionParams({ noiseFloor: 10 })).toBe(false);
    });

    it('超出范围的 nrType 返回 false', () => {
      expect(isValidNoiseReductionParams({ nrType: -1 })).toBe(false);
      expect(isValidNoiseReductionParams({ nrType: 3 })).toBe(false);
    });

    it('空参数返回 true', () => {
      expect(isValidNoiseReductionParams({})).toBe(true);
    });

    it('采样窗口无效返回 false', () => {
      expect(
        isValidNoiseReductionParams({
          noiseSampleStart: 5,
          noiseSampleEnd: 2,
        }),
      ).toBe(false);
    });
  });

  describe('strengthToNoiseReductionParams', () => {
    it('0 强度返回无降噪参数', () => {
      const params = strengthToNoiseReductionParams(0);
      expect(params.noiseFloor).toBe(-60);
      expect(params.nrType).toBe(0);
      expect(params.autoNoiseSampling).toBe(false);
    });

    it('100 强度返回最强降噪参数', () => {
      const params = strengthToNoiseReductionParams(100);
      expect(params.noiseFloor).toBe(0);
      expect(params.nrType).toBe(2);
      expect(params.autoNoiseSampling).toBe(true);
    });

    it('50 强度返回中度降噪', () => {
      const params = strengthToNoiseReductionParams(50);
      expect(params.noiseFloor).toBe(-30);
      expect(params.nrType).toBe(1);
    });

    it('钳制超出范围的值', () => {
      expect(strengthToNoiseReductionParams(-10).noiseFloor).toBe(-60);
      expect(strengthToNoiseReductionParams(150).noiseFloor).toBe(0);
    });

    it('强度递增时 noiseFloor 递增', () => {
      const p25 = strengthToNoiseReductionParams(25);
      const p50 = strengthToNoiseReductionParams(50);
      const p75 = strengthToNoiseReductionParams(75);
      expect(p25.noiseFloor).toBeLessThan(p50.noiseFloor);
      expect(p50.noiseFloor).toBeLessThan(p75.noiseFloor);
    });
  });

  describe('noiseReductionToEffectParams', () => {
    it('转换为效果槽参数格式', () => {
      const params = getNoiseReductionPreset('medium');
      const effectParams = noiseReductionToEffectParams(params);
      expect(effectParams).toHaveProperty('threshold');
      expect(effectParams).toHaveProperty('reduction');
      expect(effectParams).toHaveProperty('attack');
      expect(effectParams).toHaveProperty('release');
    });

    it('threshold 等于 noiseFloor', () => {
      const params = getNoiseReductionPreset('heavy');
      const effectParams = noiseReductionToEffectParams(params);
      expect(effectParams.threshold).toBe(params.noiseFloor);
    });

    it('reduction 是 0-100 范围', () => {
      const params = getNoiseReductionPreset('light');
      const effectParams = noiseReductionToEffectParams(params);
      expect(effectParams.reduction).toBeGreaterThanOrEqual(0);
      expect(effectParams.reduction).toBeLessThanOrEqual(100);
    });
  });
});
