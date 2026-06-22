import { describe, expect, it } from 'vitest';
import {
  classifyMediaAspect,
  detectMediaFeatures,
  suggestTrackCount,
  recommendTemplate,
  buildRecommendationReason,
  getProjectTemplate,
  instantiateProjectTemplate,
  type MediaFeatureInput
} from '../src/project/project-templates';

describe('project templates', () => {
  describe('classifyMediaAspect', () => {
    it('classifies 9:16 vertical video', () => {
      expect(classifyMediaAspect(1080, 1920)).toBe('vertical');
    });
    it('classifies 16:9 horizontal video', () => {
      expect(classifyMediaAspect(1920, 1080)).toBe('horizontal');
    });
    it('classifies 1:1 square video', () => {
      expect(classifyMediaAspect(1080, 1080)).toBe('square');
    });
  });

  describe('detectMediaFeatures', () => {
    it('detects resolution from media files', () => {
      const media: MediaFeatureInput[] = [
        { width: 1080, height: 1920, durationSeconds: 30, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 45, hasAudio: true }
      ];
      const result = detectMediaFeatures(media);
      expect(result.avgWidth).toBe(1080);
      expect(result.avgHeight).toBe(1920);
    });
    it('detects duration from media files', () => {
      const media: MediaFeatureInput[] = [
        { width: 1920, height: 1080, durationSeconds: 60, hasAudio: true },
        { width: 1920, height: 1080, durationSeconds: 120, hasAudio: true }
      ];
      const result = detectMediaFeatures(media);
      expect(result.avgDuration).toBe(90);
      expect(result.totalDuration).toBe(180);
    });
    it('detects media count', () => {
      const media: MediaFeatureInput[] = [
        { width: 1080, height: 1920, durationSeconds: 10, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 15, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 20, hasAudio: true }
      ];
      const result = detectMediaFeatures(media);
      expect(result.count).toBe(3);
    });
    it('returns empty summary for empty input', () => {
      const result = detectMediaFeatures([]);
      expect(result.count).toBe(0);
      expect(result.aspectClass).toBe('unknown');
    });
    it('detects aspect class by majority vote', () => {
      const media: MediaFeatureInput[] = [
        { width: 1080, height: 1920, durationSeconds: 10, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 10, hasAudio: true },
        { width: 1920, height: 1080, durationSeconds: 10, hasAudio: true }
      ];
      const result = detectMediaFeatures(media);
      expect(result.aspectClass).toBe('vertical');
    });
  });

  describe('suggestTrackCount', () => {
    it('suggests at least the template track count', () => {
      const template = getProjectTemplate('vertical-short');
      const result = suggestTrackCount(1, template);
      expect(result.videoTracks).toBeGreaterThanOrEqual(1);
      expect(result.audioTracks).toBeGreaterThanOrEqual(1);
    });
    it('suggests more tracks for more media files', () => {
      const template = getProjectTemplate('youtube-horizontal');
      const result = suggestTrackCount(5, template);
      expect(result.videoTracks).toBeGreaterThanOrEqual(5);
    });
    it('caps video tracks at 8', () => {
      const template = getProjectTemplate('youtube-horizontal');
      const result = suggestTrackCount(20, template);
      expect(result.videoTracks).toBeLessThanOrEqual(8);
    });
  });

  describe('recommendTemplate', () => {
    it('recommends vertical-short for vertical media', () => {
      const media: MediaFeatureInput[] = [
        { width: 1080, height: 1920, durationSeconds: 30, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 45, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 60, hasAudio: true }
      ];
      const result = recommendTemplate(media);
      expect(result.templateId).toBe('vertical-short');
      expect(result.suggestedVideoTracks).toBeGreaterThanOrEqual(3);
      expect(result.reasonKey).toBe('verticalDetected');
    });
    it('recommends youtube-horizontal for horizontal media', () => {
      const media: MediaFeatureInput[] = [
        { width: 1920, height: 1080, durationSeconds: 120, hasAudio: true }
      ];
      const result = recommendTemplate(media);
      expect(result.templateId).toBe('youtube-horizontal');
      expect(result.reasonKey).toBe('horizontalDetected');
    });
    it('recommends square-social for square media', () => {
      const media: MediaFeatureInput[] = [
        { width: 1080, height: 1080, durationSeconds: 30, hasAudio: true },
        { width: 1080, height: 1080, durationSeconds: 30, hasAudio: true }
      ];
      const result = recommendTemplate(media);
      expect(result.templateId).toBe('square-social');
      expect(result.reasonKey).toBe('squareDetected');
    });
    it('defaults to youtube-horizontal for empty media', () => {
      const result = recommendTemplate([]);
      expect(result.templateId).toBe('youtube-horizontal');
      expect(result.score).toBe(0);
    });
  });

  describe('buildRecommendationReason', () => {
    it('builds reason text from translation map', () => {
      const translations = {
        verticalDetected: (params: Record<string, string | number>) =>
          `检测到${params.count}个${params.height}视频，推荐竖版短视频模板`
      };
      const recommendation = recommendTemplate([
        { width: 1080, height: 1920, durationSeconds: 30, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 30, hasAudio: true },
        { width: 1080, height: 1920, durationSeconds: 30, hasAudio: true }
      ]);
      const reason = buildRecommendationReason(recommendation, translations);
      expect(reason).toContain('3');
      expect(reason).toContain('1920');
      expect(reason).toContain('竖版短视频');
    });
    it('returns empty string for missing translations', () => {
      const recommendation = recommendTemplate([]);
      const reason = buildRecommendationReason(recommendation, {});
      expect(reason).toBe('');
    });
  });

  describe('instantiateProjectTemplate', () => {
    it('creates a project from the vertical template', () => {
      const result = instantiateProjectTemplate('vertical-short', { name: 'Test' });
      expect(result.project.name).toBe('Test');
      expect(result.project.settings.width).toBe(1080);
      expect(result.project.settings.height).toBe(1920);
      expect(result.template.tracks.length).toBe(3);
    });
    it('throws for unknown template id', () => {
      expect(() => instantiateProjectTemplate('unknown' as any)).toThrow();
    });
  });
});
