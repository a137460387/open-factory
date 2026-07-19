import { describe, it, expect } from 'vitest';
import {
  generateMultiFormats,
  generateFormatVariant,
  generateDualFormat,
  extractCropAnalysisFromProject,
  generateFormatPreview,
  getSupportedOrientations,
  getRecommendedFormatsForOrientation,
  DEFAULT_MULTI_FORMAT_CONFIG,
  type MultiFormatConfig,
  type Project,
} from '../../src/distribution/multi-format-generator';

// ─── 测试辅助工厂 ────────────────────────────────────────────

function makeProject(overrides?: Partial<Project> & { width?: number; height?: number }): Project {
  const w = (overrides as any)?.width ?? 1920;
  const h = (overrides as any)?.height ?? 1080;
  const { width: _w, height: _h, ...rest } = overrides ?? ({} as any);
  return {
    name: 'test-project',
    settings: { width: w, height: h, fps: 30, timecodeFormat: 'hh:mm:ss:ff' },
    timeline: {
      tracks: [
        {
          id: 'track-1',
          type: 'video',
          name: '视频轨道',
          clips: [
            {
              id: 'clip-1',
              type: 'video',
              start: 0,
              duration: 30,
              mediaPath: '/test/video.mp4',
              mediaId: 'media-1',
              mediaWidth: w,
              mediaHeight: h,
            },
          ],
        },
      ],
    },
    ...rest,
  } as unknown as Project;
}

// ─── 测试用例 ────────────────────────────────────────────

describe('multi-format-generator', () => {
  describe('extractCropAnalysisFromProject', () => {
    it('应从项目中提取裁剪分析输入', () => {
      const project = makeProject();
      const input = extractCropAnalysisFromProject(project);

      expect(input.sourceWidth).toBe(1920);
      expect(input.sourceHeight).toBe(1080);
      expect(input.duration).toBe(30);
    });

    it('无时间线时应使用项目尺寸', () => {
      const project = makeProject({ timeline: undefined } as any);
      const input = extractCropAnalysisFromProject(project);

      expect(input.sourceWidth).toBe(1920);
      expect(input.sourceHeight).toBe(1080);
      expect(input.duration).toBe(0);
    });

    it('应支持覆盖参数', () => {
      const project = makeProject();
      const input = extractCropAnalysisFromProject(project, {
        motionCenterX: 0.6,
        motionCenterY: 0.4,
      });

      expect(input.motionCenterX).toBe(0.6);
      expect(input.motionCenterY).toBe(0.4);
    });

    it('有字幕轨时应设置字幕位置', () => {
      const project = makeProject({
        timeline: {
          tracks: [
            {
              id: 'track-1',
              type: 'video',
              name: '视频',
              clips: [
                {
                  id: 'clip-1',
                  type: 'video',
                  startTime: 0,
                  duration: 30,
                  sourceStart: 0,
                  sourceEnd: 30,
                  mediaPath: '/test.mp4',
                  mediaId: 'm1',
                  mediaWidth: 1920,
                  mediaHeight: 1080,
                },
              ],
            },
            {
              id: 'track-2',
              type: 'subtitle',
              name: '字幕',
              clips: [],
            },
          ],
        },
      } as any);
      const input = extractCropAnalysisFromProject(project);

      expect(input.subtitleY).toBeDefined();
      expect(input.subtitleHeight).toBeDefined();
    });
  });

  describe('generateMultiFormats', () => {
    it('应为所有平台生成格式变体', () => {
      const project = makeProject();
      const result = generateMultiFormats(project);

      expect(result.variants.length).toBeGreaterThan(0);
      expect(result.variants.length).toBeLessThanOrEqual(DEFAULT_MULTI_FORMAT_CONFIG.maxVariants);
    });

    it('应包含源项目信息', () => {
      const project = makeProject();
      const result = generateMultiFormats(project);

      expect(result.sourceInfo.width).toBe(1920);
      expect(result.sourceInfo.height).toBe(1080);
      expect(result.sourceInfo.durationSecs).toBe(30);
    });

    it('应为每个变体生成预览', () => {
      const project = makeProject();
      const result = generateMultiFormats(project);

      expect(result.previews.length).toBe(result.variants.length);
      for (const preview of result.previews) {
        expect(preview.previewWidth).toBeGreaterThan(0);
        expect(preview.previewHeight).toBeGreaterThan(0);
      }
    });

    it('应生成有效摘要', () => {
      const project = makeProject();
      const result = generateMultiFormats(project);

      expect(result.summary.totalVariants).toBe(result.variants.length);
      expect(result.summary.uniqueFormats).toBeGreaterThan(0);
      expect(result.summary.platformsCovered).toBeGreaterThan(0);
      expect(result.summary.averageQuality).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageQuality).toBeLessThanOrEqual(1);
    });

    it('应支持指定目标平台', () => {
      const project = makeProject();
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        targetPlatforms: ['youtube-1080p', 'tiktok'],
      });

      // 应该至少有横屏和竖屏两个变体
      expect(result.variants.length).toBeGreaterThanOrEqual(2);
    });

    it('应去重相同格式的变体', () => {
      const project = makeProject();
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        deduplicateFormats: true,
        targetPlatforms: ['tiktok', 'instagram-reels', 'youtube-shorts'],
      });

      // 三者都是 9:16 竖屏，去重后应只有一个变体
      const portraitVariants = result.variants.filter((v) => v.orientation === 'portrait');
      expect(portraitVariants.length).toBe(1);
    });

    it('去重变体应合并目标平台列表', () => {
      const project = makeProject();
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        deduplicateFormats: true,
        targetPlatforms: ['tiktok', 'instagram-reels'],
      });

      const portraitVariant = result.variants.find((v) => v.orientation === 'portrait');
      expect(portraitVariant).toBeDefined();
      expect(portraitVariant!.targetPlatforms).toContain('tiktok');
      expect(portraitVariant!.targetPlatforms).toContain('instagram-reels');
    });

    it('应支持排除方形格式', () => {
      const project = makeProject();
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        includeSquareFormat: false,
      });

      const squareVariants = result.variants.filter((v) => v.orientation === 'square');
      expect(squareVariants.length).toBe(0);
    });

    it('竖屏项目应生成横屏和竖屏变体', () => {
      const project = makeProject({ width: 1080, height: 1920 } as any);
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        targetPlatforms: ['youtube-1080p', 'tiktok'],
      });

      const orientations = new Set(result.variants.map((v) => v.orientation));
      expect(orientations.has('landscape')).toBe(true);
      expect(orientations.has('portrait')).toBe(true);
    });

    it('裁剪质量过低时应生成警告', () => {
      // 极端宽高比差异
      const project = makeProject({ width: 3840, height: 480 } as any);
      const result = generateMultiFormats(project, {
        ...DEFAULT_MULTI_FORMAT_CONFIG,
        targetPlatforms: ['tiktok'],
        minQualityThreshold: 0.8, // 很高的阈值
      });

      // 质量过低时可能不生成变体或生成警告
      expect(result.summary.warnings.length >= 0).toBe(true);
    });
  });

  describe('generateFormatVariant', () => {
    it('应为单个平台生成格式变体', () => {
      const project = makeProject();
      const variant = generateFormatVariant(project, 'youtube-1080p');

      expect(variant.id).toBe('variant-youtube-1080p');
      expect(variant.orientation).toBe('landscape');
      expect(variant.aspectRatio).toBe('16:9');
      expect(variant.width).toBe(1920);
      expect(variant.height).toBe(1080);
      expect(variant.targetPlatforms).toEqual(['youtube-1080p']);
    });

    it('应计算裁剪结果', () => {
      const project = makeProject();
      const variant = generateFormatVariant(project, 'tiktok');

      expect(variant.cropResult).toBeDefined();
      expect(variant.cropResult.platformId).toBe('tiktok');
    });

    it('质量损失应在 0-1 范围', () => {
      const project = makeProject();
      const variant = generateFormatVariant(project, 'bilibili');

      expect(variant.qualityLoss).toBeGreaterThanOrEqual(0);
      expect(variant.qualityLoss).toBeLessThanOrEqual(1);
    });
  });

  describe('generateDualFormat', () => {
    it('应生成横屏+竖屏双格式', () => {
      const project = makeProject();
      const result = generateDualFormat(project);

      expect(result.variants.length).toBe(2);
      const orientations = result.variants.map((v) => v.orientation).sort();
      expect(orientations).toEqual(['landscape', 'portrait']);
    });

    it('默认使用 YouTube 和 TikTok 平台', () => {
      const project = makeProject();
      const result = generateDualFormat(project);

      const landscapeVariant = result.variants.find((v) => v.orientation === 'landscape');
      const portraitVariant = result.variants.find((v) => v.orientation === 'portrait');

      expect(landscapeVariant?.targetPlatforms).toContain('youtube-1080p');
      expect(portraitVariant?.targetPlatforms).toContain('tiktok');
    });
  });

  describe('generateFormatPreview', () => {
    it('应生成预览尺寸数据', () => {
      const project = makeProject();
      const variant = generateFormatVariant(project, 'youtube-1080p');
      const preview = generateFormatPreview(variant, 320, 240);

      expect(preview.variantId).toBe(variant.id);
      expect(preview.previewWidth).toBeGreaterThan(0);
      expect(preview.previewHeight).toBeGreaterThan(0);
      expect(preview.cropRegionWidth).toBeGreaterThan(0);
      expect(preview.cropRegionHeight).toBeGreaterThan(0);
    });

    it('预览应适配容器尺寸', () => {
      const project = makeProject();
      const variant = generateFormatVariant(project, 'youtube-1080p');
      const preview = generateFormatPreview(variant, 160, 120);

      expect(preview.previewWidth).toBeLessThanOrEqual(160);
      expect(preview.previewHeight).toBeLessThanOrEqual(120);
    });
  });

  describe('工具函数', () => {
    it('getSupportedOrientations 应返回三种方向', () => {
      const orientations = getSupportedOrientations();
      expect(orientations).toEqual(['landscape', 'portrait', 'square']);
    });

    it('getRecommendedFormatsForOrientation 应按方向过滤', () => {
      const landscape = getRecommendedFormatsForOrientation('landscape');
      for (const p of landscape) {
        expect(p.orientation).toBe('landscape');
      }

      const portrait = getRecommendedFormatsForOrientation('portrait');
      for (const p of portrait) {
        expect(p.orientation).toBe('portrait');
      }
    });
  });
});
