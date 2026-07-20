import { describe, expect, it, beforeEach } from 'vitest';
import { AIDistributionEngine } from '../src/distribution/ai-distribution-engine';

describe('AIDistributionEngine', () => {
  let engine: AIDistributionEngine;

  beforeEach(() => {
    engine = new AIDistributionEngine();
  });

  describe('Content Analysis', () => {
    it('analyzes content quality', () => {
      const result = engine.analyzeContent({
        title: '如何制作专业的视频教程 | 10个实用技巧',
        description: '本教程详细介绍了视频制作的核心技巧，包括拍摄、剪辑、调色等环节，适合初学者和进阶用户。',
        duration: 300,
        width: 1920,
        height: 1080,
        hasSubtitles: true,
      });

      expect(result.qualityScore).toBeGreaterThan(50);
      expect(result.category).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('generates title suggestions for short titles', () => {
      const result = engine.analyzeContent({
        title: '视频',
        description: 'A description that is long enough to pass the quality check for testing purposes.',
        duration: 120,
        width: 1920,
        height: 1080,
        hasSubtitles: false,
      });

      expect(result.titleSuggestions.length).toBeGreaterThan(0);
    });

    it('generates platform advice', () => {
      const result = engine.analyzeContent({
        title: 'Portrait Video Tutorial',
        description: 'A description that is long enough to pass the quality check for testing purposes.',
        duration: 30,
        width: 1080,
        height: 1920,
        hasSubtitles: false,
      });

      expect(result.platformAdvice.length).toBeGreaterThan(0);
      const tiktokAdvice = result.platformAdvice.find((a) => a.platformId === 'tiktok');
      expect(tiktokAdvice?.recommended).toBe(true);
    });

    it('generates cover suggestions', () => {
      const result = engine.analyzeContent({
        title: 'Test Video Title Here',
        description: 'A description that is long enough to pass the quality check for testing purposes.',
        duration: 300,
        width: 1920,
        height: 1080,
        hasSubtitles: false,
      });

      expect(result.coverSuggestions.length).toBe(3);
      expect(result.coverSuggestions[0].timestamp).toBeLessThan(300);
    });
  });

  describe('Publish Time Prediction', () => {
    it('predicts publish time for YouTube', () => {
      const prediction = engine.predictPublishTime('youtube-1080p');
      expect(prediction.platformId).toBe('youtube-1080p');
      expect(prediction.recommendedSlots.length).toBeGreaterThan(0);
      expect(prediction.bestTime.score).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('predicts publish time for TikTok', () => {
      const prediction = engine.predictPublishTime('tiktok');
      expect(prediction.platformId).toBe('tiktok');
      expect(prediction.bestTime.hour).toBe(20);
    });

    it('returns default for unknown platforms', () => {
      const prediction = engine.predictPublishTime('unknown-platform' as any);
      expect(prediction.recommendedSlots.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Analytics', () => {
    it('returns empty summary with no data', () => {
      const summary = engine.getAnalyticsSummary({
        from: '2026-01-01',
        to: '2026-01-31',
      });
      expect(summary.platformPerformance).toHaveLength(0);
      expect(summary.totals.views).toBe(0);
    });

    it('calculates analytics from recorded data', () => {
      engine.recordPerformance('youtube-1080p', {
        date: '2026-01-15',
        views: 1000,
        engagements: 50,
        avgWatchTime: 120,
        retentionRate: 0.6,
        followerGrowth: 10,
        revenue: 5,
      });

      const summary = engine.getAnalyticsSummary({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(summary.platformPerformance).toHaveLength(1);
      expect(summary.totals.views).toBe(1000);
      expect(summary.totals.engagements).toBe(50);
    });

    it('generates insights', () => {
      // Record declining data
      for (let i = 0; i < 14; i++) {
        engine.recordPerformance('youtube-1080p', {
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          views: i < 7 ? 1000 : 500,
          engagements: i < 7 ? 50 : 20,
          avgWatchTime: 120,
          retentionRate: 0.6,
          followerGrowth: 0,
        });
      }

      const summary = engine.getAnalyticsSummary({
        from: '2026-01-01',
        to: '2026-01-14',
      });

      expect(summary.insights.length).toBeGreaterThan(0);
    });
  });

  describe('A/B Testing', () => {
    it('creates an A/B test', () => {
      const test = engine.createABTest({
        name: 'Title Test',
        description: 'Testing different titles',
        platformId: 'youtube-1080p',
        variants: [
          { name: 'Control', description: 'Original title', trafficShare: 0.5 },
          { name: 'Variant A', description: 'New title', title: 'New Title!', trafficShare: 0.5 },
        ],
        durationDays: 7,
      });

      expect(test.id).toBeDefined();
      expect(test.status).toBe('draft');
      expect(test.variants).toHaveLength(2);
    });

    it('starts an A/B test', () => {
      const test = engine.createABTest({
        name: 'Title Test',
        description: 'Testing different titles',
        platformId: 'youtube-1080p',
        variants: [
          { name: 'Control', description: 'Original', trafficShare: 0.5 },
          { name: 'Variant A', description: 'New', trafficShare: 0.5 },
        ],
        durationDays: 7,
      });

      const started = engine.startABTest(test.id);
      expect(started.status).toBe('running');
      expect(started.startedAt).toBeDefined();
    });

    it('lists A/B tests', () => {
      engine.createABTest({
        name: 'Test 1',
        description: 'Test 1',
        platformId: 'youtube-1080p',
        variants: [{ name: 'A', description: 'A', trafficShare: 1 }],
        durationDays: 7,
      });
      engine.createABTest({
        name: 'Test 2',
        description: 'Test 2',
        platformId: 'tiktok',
        variants: [{ name: 'A', description: 'A', trafficShare: 1 }],
        durationDays: 7,
      });

      expect(engine.listABTests()).toHaveLength(2);
      expect(engine.listABTests('youtube-1080p')).toHaveLength(1);
    });

    it('throws for unknown test ID', () => {
      expect(() => engine.getABTest('unknown')).toThrow('not found');
    });
  });
});
