import { describe, expect, it, beforeEach } from 'vitest';
import {
  SceneAnalyzer,
  createDefaultAnalyzerConfig,
  createDefaultSceneDetectionConfig,
  createDefaultAutomationQualityAssessmentConfig,
  createDefaultQualityMetrics,
  createEmptySceneAnalysis,
  calculateOverallQuality,
  isLowQuality,
  getQualityGrade,
  getQualityGradeLabel,
  generateDefaultTags,
  generateAnalysisStats,
  generateAnalysisReport,
} from '../src/automation/scene-analyzer';
import type { SceneAnalysis, AutomationSceneType } from '../src/automation/scene-analyzer';

describe('scene-analyzer', () => {
  // ============================================================
  // 工厂函数测试
  // ============================================================

  describe('工厂函数', () => {
    it('createDefaultAnalyzerConfig 创建默认配置', () => {
      const config = createDefaultAnalyzerConfig();
      expect(config.generateTags).toBe(true);
      expect(config.generateDescriptions).toBe(false);
      expect(config.maxConcurrent).toBe(2);
      expect(config.sceneDetection.threshold).toBe(0.3);
      expect(config.qualityAssessment.lowQualityThreshold).toBe(60);
    });

    it('createDefaultSceneDetectionConfig 创建默认场景检测配置', () => {
      const config = createDefaultSceneDetectionConfig();
      expect(config.threshold).toBe(0.3);
      expect(config.minSceneDuration).toBe(0.5);
      expect(config.detectBlackFrames).toBe(true);
      expect(config.blackFrameThreshold).toBe(10);
    });

    it('createDefaultAutomationQualityAssessmentConfig 创建默认质量评估配置', () => {
      const config = createDefaultAutomationQualityAssessmentConfig();
      expect(config.assessSharpness).toBe(true);
      expect(config.assessExposure).toBe(true);
      expect(config.assessAudio).toBe(true);
    });

    it('createDefaultQualityMetrics 创建默认质量指标', () => {
      const metrics = createDefaultQualityMetrics();
      expect(metrics.overall).toBe(0);
      expect(metrics.sharpness).toBe(0);
      expect(metrics.noiseLevel).toBe(0);
    });

    it('createEmptySceneAnalysis 创建空分析结果', () => {
      const analysis = createEmptySceneAnalysis('/path/to/video.mp4');
      expect(analysis.mediaPath).toBe('/path/to/video.mp4');
      expect(analysis.sceneType).toBe('unknown');
      expect(analysis.quality.overall).toBe(0);
      expect(analysis.tags).toEqual([]);
      expect(analysis.analyzedAt).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 质量计算测试
  // ============================================================

  describe('质量计算', () => {
    it('calculateOverallQuality 计算综合质量分', () => {
      const quality = calculateOverallQuality({
        sharpness: 80,
        exposure: 80,
        colorSaturation: 80,
        stability: 80,
        audioQuality: 80,
        noiseLevel: 20, // 低噪点 = 高分
      });
      // 加权平均：80*0.25 + 80*0.2 + 80*0.15 + 80*0.2 + 80*0.1 + (100-20)*0.1
      // = 20 + 16 + 12 + 16 + 8 + 8 = 80
      expect(quality).toBe(80);
    });

    it('calculateOverallQuality 处理极端值', () => {
      const perfect = calculateOverallQuality({
        sharpness: 100,
        exposure: 100,
        colorSaturation: 100,
        stability: 100,
        audioQuality: 100,
        noiseLevel: 0,
      });
      expect(perfect).toBe(100);

      const terrible = calculateOverallQuality({
        sharpness: 0,
        exposure: 0,
        colorSaturation: 0,
        stability: 0,
        audioQuality: 0,
        noiseLevel: 100,
      });
      expect(terrible).toBe(0);
    });

    it('isLowQuality 判断低质量', () => {
      expect(isLowQuality({ overall: 50 } as any, 60)).toBe(true);
      expect(isLowQuality({ overall: 80 } as any, 60)).toBe(false);
      expect(isLowQuality({ overall: 60 } as any, 60)).toBe(false);
    });

    it('getQualityGrade 质量等级', () => {
      expect(getQualityGrade(95)).toBe('excellent');
      expect(getQualityGrade(80)).toBe('good');
      expect(getQualityGrade(65)).toBe('fair');
      expect(getQualityGrade(45)).toBe('poor');
      expect(getQualityGrade(20)).toBe('terrible');
    });

    it('getQualityGradeLabel 质量等级标签', () => {
      expect(getQualityGradeLabel('excellent')).toBe('优秀');
      expect(getQualityGradeLabel('good')).toBe('良好');
      expect(getQualityGradeLabel('fair')).toBe('一般');
      expect(getQualityGradeLabel('poor')).toBe('较差');
      expect(getQualityGradeLabel('terrible')).toBe('很差');
    });
  });

  // ============================================================
  // 标签生成测试
  // ============================================================

  describe('标签生成', () => {
    it('generateDefaultTags 为不同场景类型生成标签', () => {
      const dialogueTags = generateDefaultTags('dialogue');
      expect(dialogueTags.length).toBeGreaterThan(0);
      expect(dialogueTags.some((t) => t.name === '人物')).toBe(true);

      const actionTags = generateDefaultTags('action');
      expect(actionTags.some((t) => t.name === '动作')).toBe(true);

      const blackTags = generateDefaultTags('black');
      expect(blackTags.some((t) => t.name === '黑场')).toBe(true);
    });

    it('generateDefaultTags 未知场景返回空', () => {
      expect(generateDefaultTags('unknown')).toEqual([]);
    });

    it('标签有置信度', () => {
      const tags = generateDefaultTags('dialogue');
      for (const tag of tags) {
        expect(tag.confidence).toBeGreaterThan(0);
        expect(tag.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ============================================================
  // 分析报告测试
  // ============================================================

  describe('分析报告', () => {
    const makeScene = (overrides: Partial<SceneAnalysis> = {}): SceneAnalysis => ({
      id: `scene_${Math.random()}`,
      mediaPath: '/test.mp4',
      startTime: 0,
      endTime: 10,
      duration: 10,
      sceneType: 'unknown',
      sceneTypeConfidence: 0.7,
      tags: [],
      quality: createDefaultQualityMetrics(),
      keyframes: [0, 10],
      analyzedAt: Date.now(),
      ...overrides,
    });

    it('generateAnalysisStats 空场景列表', () => {
      const stats = generateAnalysisStats([]);
      expect(stats.totalScenes).toBe(0);
      expect(stats.averageQuality).toBe(0);
    });

    it('generateAnalysisStats 计算统计', () => {
      const scenes = [
        makeScene({
          sceneType: 'dialogue',
          quality: { ...createDefaultQualityMetrics(), overall: 80 },
          tags: [{ id: 't1', name: '人物', category: 'content', confidence: 0.8 }],
          duration: 10,
        }),
        makeScene({
          sceneType: 'action',
          quality: { ...createDefaultQualityMetrics(), overall: 40 },
          tags: [{ id: 't2', name: '动作', category: 'content', confidence: 0.9 }],
          duration: 5,
        }),
        makeScene({
          sceneType: 'dialogue',
          quality: { ...createDefaultQualityMetrics(), overall: 90 },
          tags: [{ id: 't3', name: '人物', category: 'content', confidence: 0.7 }],
          duration: 8,
        }),
      ];

      const stats = generateAnalysisStats(scenes);
      expect(stats.totalScenes).toBe(3);
      expect(stats.sceneTypeCounts['dialogue']).toBe(2);
      expect(stats.sceneTypeCounts['action']).toBe(1);
      expect(stats.averageQuality).toBe(70); // (80+40+90)/3 = 70
      expect(stats.minQuality).toBe(40);
      expect(stats.maxQuality).toBe(90);
      expect(stats.lowQualityScenes).toHaveLength(1); // quality=40 < 60
      expect(stats.totalDuration).toBe(23);
      expect(stats.topTags.length).toBeGreaterThan(0);
      expect(stats.topTags[0].tag).toBe('人物'); // 出现 2 次
      expect(stats.topTags[0].count).toBe(2);
    });

    it('generateAnalysisReport 生成报告', () => {
      const scenes = [
        makeScene({ quality: { ...createDefaultQualityMetrics(), overall: 75 } }),
      ];
      const report = generateAnalysisReport(['/test.mp4'], scenes);
      expect(report.id).toBeTruthy();
      expect(report.mediaPaths).toEqual(['/test.mp4']);
      expect(report.scenes).toHaveLength(1);
      expect(report.stats.totalScenes).toBe(1);
      expect(report.generatedAt).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 场景分析器测试
  // ============================================================

  describe('SceneAnalyzer', () => {
    let analyzer: SceneAnalyzer;

    beforeEach(() => {
      analyzer = new SceneAnalyzer();
    });

    it('使用默认配置创建', () => {
      const config = analyzer.getConfig();
      expect(config.generateTags).toBe(true);
      expect(config.sceneDetection.threshold).toBe(0.3);
    });

    it('更新配置', () => {
      analyzer.updateConfig({ generateTags: false });
      expect(analyzer.getConfig().generateTags).toBe(false);
    });

    it('分析单个场景', async () => {
      const result = await analyzer.analyzeScene('/test.mp4', 0, 10);
      expect(result.mediaPath).toBe('/test.mp4');
      expect(result.startTime).toBe(0);
      expect(result.endTime).toBe(10);
      expect(result.duration).toBe(10);
      // 无帧数据时场景类型为 unknown
      expect(result.sceneType).toBe('unknown');
      expect(result.keyframes.length).toBeGreaterThan(0);
    });

    it('分析带帧数据的场景', async () => {
      const result = await analyzer.analyzeScene('/test.mp4', 0, 10, {
        brightness: [120, 125, 130, 128, 122],
        motionVectors: [0.1, 0.15, 0.12, 0.11, 0.13],
        audioLevels: [-15, -12, -18, -14, -16],
      });

      expect(result.quality.overall).toBeGreaterThan(0);
      expect(result.quality.exposure).toBeGreaterThan(0);
    });

    it('检测黑场', async () => {
      const result = await analyzer.analyzeScene('/test.mp4', 0, 5, {
        brightness: [2, 3, 1, 4, 2],
      });
      expect(result.sceneType).toBe('black');
    });

    it('检测动作场景', async () => {
      const result = await analyzer.analyzeScene('/test.mp4', 0, 5, {
        brightness: [100, 110, 105, 108, 112],
        motionVectors: [0.8, 0.9, 0.85, 0.88, 0.92],
      });
      expect(result.sceneType).toBe('action');
    });

    it('批量分析', async () => {
      const items = [
        { path: '/video1.mp4', duration: 30 },
        { path: '/video2.mp4', duration: 20 },
      ];

      const progressCalls: Array<{ current: number; total: number }> = [];
      const report = await analyzer.analyzeBatch(items, (p) => {
        progressCalls.push({ current: p.current, total: p.total });
      });

      expect(report.mediaPaths).toEqual(['/video1.mp4', '/video2.mp4']);
      expect(report.scenes.length).toBeGreaterThan(0);
      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('分析历史管理', async () => {
      await analyzer.analyzeScene('/test.mp4', 0, 10);
      await analyzer.analyzeScene('/test.mp4', 10, 20);

      const history = analyzer.getAnalysisHistory('/test.mp4');
      expect(history).toHaveLength(2);

      analyzer.clearHistory('/test.mp4');
      expect(analyzer.getAnalysisHistory('/test.mp4')).toHaveLength(0);
    });

    it('清除所有历史', async () => {
      await analyzer.analyzeScene('/test1.mp4', 0, 10);
      await analyzer.analyzeScene('/test2.mp4', 0, 10);

      analyzer.clearHistory();
      expect(analyzer.getAnalysisHistory('/test1.mp4')).toHaveLength(0);
      expect(analyzer.getAnalysisHistory('/test2.mp4')).toHaveLength(0);
    });
  });
});
