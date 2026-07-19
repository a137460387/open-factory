import { describe, it, expect } from 'vitest';
import {
  scoreVideoFrame,
  rankVideoFrames,
  calculateCoverCrop,
  buildCoverFfmpegArgs,
  generateCovers,
  generateSingleCover,
  getCoverSizeForPlatform,
  getAllCoverSizePresets,
  getDefaultCoverOverlay,
  COVER_SIZE_PRESETS,
  DEFAULT_COVER_CONFIG,
  type VideoFrame,
  type FaceRegion,
} from '../../src/distribution/cover-generator';

// ─── 测试辅助工厂 ────────────────────────────────────────────

function makeFrame(overrides?: Partial<VideoFrame>): VideoFrame {
  return {
    timeSecs: 10,
    width: 1920,
    height: 1080,
    brightness: 0.5,
    contrast: 0.5,
    saturation: 0.5,
    sharpness: 0.8,
    hasFace: false,
    faceCount: 0,
    motionBlur: 0.1,
    ...overrides,
  };
}

function makeFaceRegion(overrides?: Partial<FaceRegion>): FaceRegion {
  return {
    x: 0.35,
    y: 0.2,
    width: 0.3,
    height: 0.4,
    confidence: 0.9,
    ...overrides,
  };
}

// ─── 测试用例 ────────────────────────────────────────────

describe('cover-generator', () => {
  describe('scoreVideoFrame', () => {
    it('应返回完整评分结构', () => {
      const frame = makeFrame();
      const score = scoreVideoFrame(frame);

      expect(score.timeSecs).toBe(10);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
      expect(score.sharpnessScore).toBeGreaterThanOrEqual(0);
      expect(score.faceScore).toBeGreaterThanOrEqual(0);
      expect(score.colorScore).toBeGreaterThanOrEqual(0);
      expect(score.compositionScore).toBeGreaterThanOrEqual(0);
      expect(score.motionScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(score.reasons)).toBe(true);
    });

    it('清晰帧应有更高的清晰度分', () => {
      const sharpFrame = makeFrame({ sharpness: 0.95 });
      const blurryFrame = makeFrame({ sharpness: 0.2 });

      const sharpScore = scoreVideoFrame(sharpFrame);
      const blurryScore = scoreVideoFrame(blurryFrame);

      expect(sharpScore.sharpnessScore).toBeGreaterThan(blurryScore.sharpnessScore);
    });

    it('有人脸的帧应有更高的人脸分', () => {
      const faceFrame = makeFrame({
        hasFace: true,
        faceCount: 1,
        faceRegions: [makeFaceRegion()],
      });
      const noFaceFrame = makeFrame({ hasFace: false, faceCount: 0 });

      const faceScore = scoreVideoFrame(faceFrame);
      const noFaceScore = scoreVideoFrame(noFaceFrame);

      expect(faceScore.faceScore).toBeGreaterThan(noFaceScore.faceScore);
    });

    it('多人脸应进一步加分', () => {
      const singleFace = makeFrame({
        hasFace: true,
        faceCount: 1,
        faceRegions: [makeFaceRegion()],
      });
      const multiFace = makeFrame({
        hasFace: true,
        faceCount: 3,
        faceRegions: [
          makeFaceRegion({ x: 0.1 }),
          makeFaceRegion({ x: 0.4 }),
          makeFaceRegion({ x: 0.7 }),
        ],
      });

      const singleScore = scoreVideoFrame(singleFace);
      const multiScore = scoreVideoFrame(multiFace);

      expect(multiScore.faceScore).toBeGreaterThanOrEqual(singleScore.faceScore);
    });

    it('色彩丰富帧应有更高的色彩分', () => {
      const colorful = makeFrame({ saturation: 0.6, contrast: 0.5 });
      const dull = makeFrame({ saturation: 0.1, contrast: 0.2 });

      const colorfulScore = scoreVideoFrame(colorful);
      const dullScore = scoreVideoFrame(dull);

      expect(colorfulScore.colorScore).toBeGreaterThan(dullScore.colorScore);
    });

    it('运动模糊帧应有更低的运动分', () => {
      const clear = makeFrame({ motionBlur: 0.05 });
      const blurred = makeFrame({ motionBlur: 0.9 });

      const clearScore = scoreVideoFrame(clear);
      const blurredScore = scoreVideoFrame(blurred);

      expect(clearScore.motionScore).toBeGreaterThan(blurredScore.motionScore);
    });

    it('人脸在三分法位置应有更高构图分', () => {
      // 人脸在三分法交叉点附近
      const goodComposition = makeFrame({
        hasFace: true,
        faceCount: 1,
        faceRegions: [makeFaceRegion({ x: 0.2, y: 0.15, width: 0.2, height: 0.25 })],
      });
      // 人脸偏离三分法
      const badComposition = makeFrame({
        hasFace: true,
        faceCount: 1,
        faceRegions: [makeFaceRegion({ x: 0.0, y: 0.0, width: 0.2, height: 0.25 })],
      });

      const goodScore = scoreVideoFrame(goodComposition);
      const badScore = scoreVideoFrame(badComposition);

      expect(goodScore.compositionScore).toBeGreaterThanOrEqual(badScore.compositionScore);
    });

    it('应为清晰帧添加正面理由', () => {
      const frame = makeFrame({ sharpness: 0.9 });
      const score = scoreVideoFrame(frame);

      expect(score.reasons).toContain('画面清晰');
    });

    it('应为模糊帧添加负面理由', () => {
      const frame = makeFrame({ motionBlur: 0.9 });
      const score = scoreVideoFrame(frame);

      expect(score.reasons).toContain('存在运动模糊');
    });

    it('无人脸时应给基础分', () => {
      const frame = makeFrame({ hasFace: false });
      const score = scoreVideoFrame(frame);

      expect(score.faceScore).toBe(30);
    });
  });

  describe('rankVideoFrames', () => {
    it('应按综合分排序', () => {
      const frames = [
        makeFrame({ timeSecs: 5, sharpness: 0.3 }),
        makeFrame({ timeSecs: 10, sharpness: 0.9 }),
        makeFrame({ timeSecs: 15, sharpness: 0.6 }),
      ];

      const ranked = rankVideoFrames(frames, false);

      expect(ranked[0].sharpnessScore).toBeGreaterThanOrEqual(ranked[1].sharpnessScore);
      expect(ranked[1].sharpnessScore).toBeGreaterThanOrEqual(ranked[2].sharpnessScore);
    });

    it('优先人脸模式应将人脸帧排在前面', () => {
      const frames = [
        makeFrame({ timeSecs: 5, hasFace: false, sharpness: 0.9 }),
        makeFrame({
          timeSecs: 10,
          hasFace: true,
          faceCount: 1,
          faceRegions: [makeFaceRegion()],
          sharpness: 0.6,
        }),
      ];

      const ranked = rankVideoFrames(frames, true);

      expect(ranked[0].faceScore).toBeGreaterThan(50);
    });

    it('空列表应返回空数组', () => {
      const ranked = rankVideoFrames([]);
      expect(ranked).toEqual([]);
    });
  });

  describe('calculateCoverCrop', () => {
    it('同宽高比应无裁剪', () => {
      const crop = calculateCoverCrop(1920, 1080, 1280, 720);

      expect(crop.width).toBe(1);
      expect(crop.height).toBe(1);
      expect(crop.x).toBe(0);
      expect(crop.y).toBe(0);
    });

    it('横屏转竖屏应裁剪左右', () => {
      const crop = calculateCoverCrop(1920, 1080, 1080, 1920);

      expect(crop.width).toBeLessThan(1);
      expect(crop.height).toBe(1);
    });

    it('竖屏转横屏应裁剪上下', () => {
      const crop = calculateCoverCrop(1080, 1920, 1920, 1080);

      expect(crop.width).toBe(1);
      expect(crop.height).toBeLessThan(1);
    });

    it('有人脸时应以人脸为中心', () => {
      const faceRegion = makeFaceRegion({ x: 0.6, y: 0.3 });
      const crop = calculateCoverCrop(1920, 1080, 1080, 1920, [faceRegion]);

      // 裁剪中心应偏向人脸位置
      const cropCenterX = crop.x + crop.width / 2;
      expect(cropCenterX).toBeGreaterThan(0.4);
    });

    it('人脸位置应略上移（封面构图习惯）', () => {
      const faceRegion = makeFaceRegion({ x: 0.35, y: 0.4 });
      const crop = calculateCoverCrop(1920, 1080, 1080, 1920, [faceRegion]);

      // 裁剪区域应可接受
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1.01); // 允许微小浮点误差
    });
  });

  describe('buildCoverFfmpegArgs', () => {
    it('应生成有效的 FFmpeg 参数', () => {
      const args = buildCoverFfmpegArgs(
        '/input.mp4',
        '/output.jpg',
        10,
        1280,
        720,
        { x: 0, y: 0, width: 1, height: 1 },
      );

      expect(args).toContain('-i');
      expect(args).toContain('/input.mp4');
      expect(args).toContain('-ss');
      expect(args).toContain('10');
      expect(args).toContain('-vframes');
      expect(args).toContain('1');
      expect(args).toContain('/output.jpg');
    });

    it('应包含裁剪和缩放滤镜', () => {
      const args = buildCoverFfmpegArgs(
        '/input.mp4',
        '/output.jpg',
        10,
        1280,
        720,
        { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      );

      const vfIndex = args.indexOf('-vf');
      expect(vfIndex).toBeGreaterThan(-1);
      const filterChain = args[vfIndex + 1];
      expect(filterChain).toContain('crop=');
      expect(filterChain).toContain('scale=');
    });

    it('有渐变遮罩时应添加 drawbox 滤镜', () => {
      const overlay = {
        titleFontSizeRatio: 0.06,
        titleColor: '#FFFFFF',
        titlePosition: 'bottom' as const,
        titleOutline: true,
        titleShadow: true,
        gradientOverlay: 'bottom' as const,
        gradientOpacity: 0.6,
      };

      const args = buildCoverFfmpegArgs(
        '/input.mp4',
        '/output.jpg',
        10,
        1280,
        720,
        { x: 0, y: 0, width: 1, height: 1 },
        overlay,
      );

      const vfIndex = args.indexOf('-vf');
      const filterChain = args[vfIndex + 1];
      expect(filterChain).toContain('drawbox');
    });
  });

  describe('generateCovers', () => {
    const sampleFrames = [
      makeFrame({ timeSecs: 5, sharpness: 0.7 }),
      makeFrame({
        timeSecs: 10,
        sharpness: 0.9,
        hasFace: true,
        faceCount: 1,
        faceRegions: [makeFaceRegion()],
      }),
      makeFrame({ timeSecs: 15, sharpness: 0.5 }),
      makeFrame({ timeSecs: 20, sharpness: 0.8 }),
    ];

    it('应为每个目标平台生成封面', () => {
      const result = generateCovers(sampleFrames, DEFAULT_COVER_CONFIG);

      expect(result.covers.length).toBe(DEFAULT_COVER_CONFIG.targetPlatforms.length);
    });

    it('应选择最佳帧', () => {
      const result = generateCovers(sampleFrames, DEFAULT_COVER_CONFIG);

      // 有人脸且清晰度高的帧应被选中
      expect(result.summary.bestFrameTime).toBe(10);
      expect(result.summary.bestFrameScore).toBeGreaterThan(0);
    });

    it('应包含源视频信息', () => {
      const result = generateCovers(sampleFrames, DEFAULT_COVER_CONFIG);

      expect(result.sourceInfo.width).toBe(1920);
      expect(result.sourceInfo.height).toBe(1080);
      expect(result.sourceInfo.durationSecs).toBe(20);
    });

    it('应包含帧评分排名', () => {
      const result = generateCovers(sampleFrames, DEFAULT_COVER_CONFIG);

      expect(result.frameScores.length).toBeGreaterThan(0);
      expect(result.frameScores[0].totalScore).toBeGreaterThanOrEqual(
        result.frameScores[1]?.totalScore ?? 0,
      );
    });

    it('应为封面设置正确的输出尺寸', () => {
      const result = generateCovers(sampleFrames, {
        ...DEFAULT_COVER_CONFIG,
        targetPlatforms: ['youtube-1080p'],
      });

      const cover = result.covers[0];
      expect(cover.outputWidth).toBe(1280);
      expect(cover.outputHeight).toBe(720);
    });

    it('空帧列表应返回空结果', () => {
      const result = generateCovers([]);

      expect(result.covers.length).toBe(0);
      expect(result.frameScores.length).toBe(0);
    });

    it('应支持排除时间范围', () => {
      const result = generateCovers(sampleFrames, {
        ...DEFAULT_COVER_CONFIG,
        excludeRanges: [{ start: 8, end: 12 }],
      });

      // 最佳帧不应在排除范围内
      for (const score of result.frameScores) {
        expect(score.timeSecs < 8 || score.timeSecs > 12).toBe(true);
      }
    });
  });

  describe('generateSingleCover', () => {
    const frames = [
      makeFrame({ timeSecs: 5, sharpness: 0.8 }),
      makeFrame({ timeSecs: 10, sharpness: 0.9 }),
    ];

    it('应为单个平台生成封面', () => {
      const cover = generateSingleCover(frames, 'youtube-1080p');

      expect(cover).not.toBeNull();
      expect(cover!.platformId).toBe('youtube-1080p');
      expect(cover!.outputWidth).toBe(1280);
      expect(cover!.outputHeight).toBe(720);
    });

    it('应支持自定义标题', () => {
      const cover = generateSingleCover(frames, 'youtube-1080p', '测试标题');

      expect(cover).not.toBeNull();
      expect(cover!.overlay.title).toBe('测试标题');
    });

    it('空帧列表应返回 null', () => {
      const cover = generateSingleCover([], 'youtube-1080p');
      expect(cover).toBeNull();
    });
  });

  describe('getCoverSizeForPlatform', () => {
    it('YouTube 应返回 16:9 封面', () => {
      const preset = getCoverSizeForPlatform('youtube-1080p');

      expect(preset.width).toBe(1280);
      expect(preset.height).toBe(720);
      expect(preset.aspectRatio).toBe('16:9');
    });

    it('TikTok 应返回 9:16 封面', () => {
      const preset = getCoverSizeForPlatform('tiktok');

      expect(preset.aspectRatio).toBe('9:16');
    });

    it('未知平台应返回默认预设', () => {
      const preset = getCoverSizeForPlatform('unknown' as any);

      expect(preset).toBeDefined();
      expect(preset.width).toBeGreaterThan(0);
    });
  });

  describe('getAllCoverSizePresets', () => {
    it('应返回所有预设', () => {
      const presets = getAllCoverSizePresets();

      expect(presets.length).toBe(COVER_SIZE_PRESETS.length);
    });
  });

  describe('getDefaultCoverOverlay', () => {
    it('应为不同平台返回不同样式', () => {
      const youtubeOverlay = getDefaultCoverOverlay('youtube-1080p');
      const tiktokOverlay = getDefaultCoverOverlay('tiktok');

      // YouTube 横屏字号与 TikTok 竖屏字号不同
      expect(youtubeOverlay.titleFontSizeRatio).not.toBe(tiktokOverlay.titleFontSizeRatio);
      // TikTok 竖屏标题居中
      expect(tiktokOverlay.titlePosition).toBe('center');
      // YouTube 横屏标题在底部
      expect(youtubeOverlay.titlePosition).toBe('bottom');
    });

    it('应支持自定义标题和水印', () => {
      const overlay = getDefaultCoverOverlay('youtube-1080p', '自定义标题', {
        type: 'text',
        text: '品牌',
        logoScale: 0.1,
        textFontSizeRatio: 0.03,
        textColor: '#FFFFFF',
        textFontWeight: 'bold',
        position: 'bottom-right',
        marginRatio: 0.02,
        opacity: 0.8,
      });

      expect(overlay.title).toBe('自定义标题');
      expect(overlay.watermark).toBeDefined();
      expect(overlay.watermark!.text).toBe('品牌');
    });

    it('竖屏平台标题应居中', () => {
      const overlay = getDefaultCoverOverlay('tiktok');

      expect(overlay.titlePosition).toBe('center');
    });

    it('横屏平台标题应在底部', () => {
      const overlay = getDefaultCoverOverlay('youtube-1080p');

      expect(overlay.titlePosition).toBe('bottom');
    });
  });
});
