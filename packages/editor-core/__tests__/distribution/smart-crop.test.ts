import { describe, it, expect } from 'vitest';
import {
  calculateSmartCrop,
  calculateBatchSmartCrops,
  parseAspectRatio,
  calcAspectRatioString,
  cropResultToReframeOffset,
  buildCropScaleFilterChain,
  calculateCropPreviewDimensions,
  type CropAnalysisInput,
} from '../../src/distribution/smart-crop';
import { getDistributionPlatform } from '../../src/distribution/platform-presets';

describe('smart-crop', () => {
  const landscapeInput: CropAnalysisInput = {
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 120,
  };

  const portraitInput: CropAnalysisInput = {
    sourceWidth: 1080,
    sourceHeight: 1920,
    duration: 60,
  };

  describe('parseAspectRatio', () => {
    it('应正确解析冒号格式', () => {
      expect(parseAspectRatio('16:9')).toBeCloseTo(16 / 9, 2);
      expect(parseAspectRatio('9:16')).toBeCloseTo(9 / 16, 2);
      expect(parseAspectRatio('1:1')).toBe(1);
    });

    it('应正确解析斜杠格式', () => {
      expect(parseAspectRatio('16/9')).toBeCloseTo(16 / 9, 2);
    });

    it('无效格式应返回默认值', () => {
      expect(parseAspectRatio('invalid')).toBeCloseTo(16 / 9, 2);
    });
  });

  describe('calcAspectRatioString', () => {
    it('应计算正确的宽高比字符串', () => {
      expect(calcAspectRatioString(1920, 1080)).toBe('16:9');
      expect(calcAspectRatioString(1080, 1080)).toBe('1:1');
      expect(calcAspectRatioString(1080, 1920)).toBe('9:16');
    });
  });

  describe('calculateSmartCrop', () => {
    it('相同宽高比应无需裁剪', () => {
      const platform = getDistributionPlatform('youtube-1080p');
      const result = calculateSmartCrop(landscapeInput, platform);
      expect(result.cropX).toBe(0);
      expect(result.cropY).toBe(0);
      expect(result.cropWidth).toBe(1);
      expect(result.cropHeight).toBe(1);
      expect(result.confidence).toBe(1.0);
    });

    it('横屏转竖屏应裁剪左右', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = calculateSmartCrop(landscapeInput, platform);
      expect(result.cropWidth).toBeLessThan(1);
      expect(result.cropHeight).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('竖屏转横屏应裁剪上下', () => {
      const platform = getDistributionPlatform('youtube-1080p');
      const result = calculateSmartCrop(portraitInput, platform);
      expect(result.cropWidth).toBe(1);
      expect(result.cropHeight).toBeLessThan(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('竖屏转方形应裁剪上下', () => {
      const platform = getDistributionPlatform('instagram-feed');
      const result = calculateSmartCrop(portraitInput, platform);
      expect(result.cropHeight).toBeLessThan(1);
    });

    it('裁剪结果应包含有效的 FFmpeg 滤镜', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = calculateSmartCrop(landscapeInput, platform);
      if (result.cropFilter) {
        expect(result.cropFilter).toMatch(/^crop=\d+:\d+:\d+:\d+$/);
      }
      expect(result.scaleFilter).toContain('scale=');
    });

    it('置信度应在 0-1 范围内', () => {
      for (const platform of [
        getDistributionPlatform('tiktok'),
        getDistributionPlatform('youtube-1080p'),
        getDistributionPlatform('instagram-feed'),
      ]) {
        const result = calculateSmartCrop(landscapeInput, platform);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('有运动分析数据应提高置信度', () => {
      const platform = getDistributionPlatform('tiktok');
      const withMotion = calculateSmartCrop(
        { ...landscapeInput, motionCenterX: 0.5, motionCenterY: 0.5 },
        platform,
      );
      const withoutMotion = calculateSmartCrop(landscapeInput, platform);
      expect(withMotion.confidence).toBeGreaterThanOrEqual(withoutMotion.confidence);
    });

    it('有字幕数据应影响重心偏移', () => {
      const platform = getDistributionPlatform('tiktok');
      const withSubtitle = calculateSmartCrop(
        { ...landscapeInput, subtitleY: 0.85, subtitleHeight: 0.1 },
        platform,
      );
      // 字幕在下方时，重心应上移（cropY 应更小或相同）
      expect(withSubtitle.cropY).toBeLessThanOrEqual(0.3);
    });
  });

  describe('calculateBatchSmartCrops', () => {
    it('应为每个平台生成裁剪结果', () => {
      const platforms = [
        getDistributionPlatform('youtube-1080p'),
        getDistributionPlatform('tiktok'),
        getDistributionPlatform('instagram-feed'),
      ];
      const results = calculateBatchSmartCrops(landscapeInput, platforms);
      expect(results.length).toBe(3);
      expect(results[0].platformId).toBe('youtube-1080p');
      expect(results[1].platformId).toBe('tiktok');
      expect(results[2].platformId).toBe('instagram-feed');
    });
  });

  describe('cropResultToReframeOffset', () => {
    it('无裁剪应返回零偏移', () => {
      const platform = getDistributionPlatform('youtube-1080p');
      const result = calculateSmartCrop(landscapeInput, platform);
      const offset = cropResultToReframeOffset(result);
      expect(offset.reframeOffsetX).toBeCloseTo(0, 2);
      expect(offset.reframeOffsetY).toBeCloseTo(0, 2);
    });

    it('裁剪后应返回有效偏移', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = calculateSmartCrop(landscapeInput, platform);
      const offset = cropResultToReframeOffset(result);
      expect(typeof offset.reframeOffsetX).toBe('number');
      expect(typeof offset.reframeOffsetY).toBe('number');
    });
  });

  describe('buildCropScaleFilterChain', () => {
    it('无裁剪时只返回 scale 滤镜', () => {
      const platform = getDistributionPlatform('youtube-1080p');
      const result = calculateSmartCrop(landscapeInput, platform);
      const filter = buildCropScaleFilterChain(result);
      expect(filter).toContain('scale=');
      expect(filter).not.toContain('crop=');
    });

    it('有裁剪时应包含 crop 和 scale', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = calculateSmartCrop(landscapeInput, platform);
      const filter = buildCropScaleFilterChain(result);
      expect(filter).toContain('crop=');
      expect(filter).toContain('scale=');
    });
  });

  describe('calculateCropPreviewDimensions', () => {
    it('应返回合理的预览尺寸', () => {
      const platform = getDistributionPlatform('tiktok');
      const result = calculateSmartCrop(landscapeInput, platform);
      const preview = calculateCropPreviewDimensions(result, 300, 200);

      expect(preview.previewWidth).toBeGreaterThan(0);
      expect(preview.previewHeight).toBeGreaterThan(0);
      expect(preview.regionWidth).toBeGreaterThan(0);
      expect(preview.regionHeight).toBeGreaterThan(0);
    });
  });
});
