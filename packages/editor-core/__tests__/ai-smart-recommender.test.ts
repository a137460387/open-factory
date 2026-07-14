import { describe, it, expect } from 'vitest';
import { recommendClips } from '../src/ai-smart-recommender';
import type { Clip } from '../src/model-types';
import type { ClipContentAnalysis, ContentSceneType } from '../src/content-analysis';

// Helper to create a mock clip with content analysis
function createMockClip(
  id: string,
  sceneTypes: ContentSceneType[] = ['dialogue'],
  brightness: number = 0.5,
  motion: number = 0.3,
  emotionValue: number = 0.5
): Clip {
  return {
    id,
    startTime: 0,
    duration: 10,
    contentAnalysis: {
      sceneTypes,
      segments: [
        { startTime: 0, endTime: 10, brightness, motion, dominantColors: [] }
      ],
      emotionCurve: [
        { time: 5, value: emotionValue }
      ],
      keywords: ['test', 'video'],
      summary: 'Test clip'
    }
  } as unknown as Clip;
}

describe('ai-smart-recommender', () => {
  describe('recommendClips', () => {
    it('should return empty result for empty candidates', () => {
      const result = recommendClips([], {
        selectedClips: [],
        currentTime: 0
      });

      expect(result.clips).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.generatedAt).toBeDefined();
    });

    it('should skip clips without content analysis', () => {
      const clips = [
        { id: 'clip1', startTime: 0, duration: 10 } as Clip,
        createMockClip('clip2')
      ];

      const result = recommendClips(clips, {
        selectedClips: [],
        currentTime: 0
      });

      expect(result.totalCount).toBe(1);
      expect(result.clips[0].clipId).toBe('clip2');
    });

    it('should recommend clips with higher similarity score', () => {
      const selectedClip = createMockClip('selected', ['dialogue'], 0.6, 0.3, 0.7);
      const candidate1 = createMockClip('candidate1', ['dialogue'], 0.6, 0.3, 0.7);
      const candidate2 = createMockClip('candidate2', ['action'], 0.2, 0.9, 0.2);

      const result = recommendClips([candidate1, candidate2], {
        selectedClips: [selectedClip],
        currentTime: 0
      });

      expect(result.clips.length).toBe(2);
      // candidate1 should have higher score (more similar to selected)
      expect(result.clips[0].clipId).toBe('candidate1');
      expect(result.clips[0].score).toBeGreaterThan(result.clips[1].score);
    });

    it('should respect maxResults option', () => {
      const clips = Array.from({ length: 20 }, (_, i) =>
        createMockClip(`clip${i}`)
      );

      const result = recommendClips(clips, {
        selectedClips: [],
        currentTime: 0
      }, { maxResults: 5 });

      expect(result.clips.length).toBe(5);
      expect(result.totalCount).toBe(20);
    });

    it('should filter clips below minScoreThreshold', () => {
      const selectedClip = createMockClip('selected', ['dialogue'], 0.8, 0.1, 0.9);
      const candidate = createMockClip('candidate', ['action'], 0.1, 0.9, 0.1);

      const result = recommendClips([candidate], {
        selectedClips: [selectedClip],
        currentTime: 0
      }, { minScoreThreshold: 0.9 });

      // candidate should be filtered out due to very high threshold
      expect(result.clips.length).toBe(0);
    });

    it('should compute emotion coherence correctly', () => {
      const selectedClip = createMockClip('selected', ['dialogue'], 0.5, 0.3, 0.8);
      const candidate1 = createMockClip('candidate1', ['dialogue'], 0.5, 0.3, 0.7);
      const candidate2 = createMockClip('candidate2', ['dialogue'], 0.5, 0.3, 0.2);

      const result = recommendClips([candidate1, candidate2], {
        selectedClips: [selectedClip],
        currentTime: 0,
        currentEmotionTrend: 0.8
      }, { emotionWeight: 0.6, similarityWeight: 0.2, diversityWeight: 0.2 });

      // candidate1 should have higher emotion score (closer to 0.8)
      expect(result.clips[0].clipId).toBe('candidate1');
    });

    it('should provide recommendation reason', () => {
      const clip = createMockClip('clip1');

      const result = recommendClips([clip], {
        selectedClips: [],
        currentTime: 0
      });

      expect(result.clips[0].reason).toBeDefined();
      expect(typeof result.clips[0].reason).toBe('string');
    });

    it('should sort results by score descending', () => {
      const clips = [
        createMockClip('low', ['action'], 0.1, 0.9, 0.1),
        createMockClip('high', ['dialogue'], 0.7, 0.3, 0.8),
        createMockClip('medium', ['dialogue'], 0.5, 0.5, 0.5)
      ];

      const selectedClip = createMockClip('selected', ['dialogue'], 0.7, 0.3, 0.8);

      const result = recommendClips(clips, {
        selectedClips: [selectedClip],
        currentTime: 0
      });

      // Verify scores are in descending order
      for (let i = 1; i < result.clips.length; i++) {
        expect(result.clips[i - 1].score).toBeGreaterThanOrEqual(result.clips[i].score);
      }
    });

    it('should handle custom weights', () => {
      const clip = createMockClip('clip1', ['dialogue'], 0.5, 0.5, 0.5);

      const result = recommendClips([clip], {
        selectedClips: [],
        currentTime: 0
      }, {
        similarityWeight: 0.5,
        emotionWeight: 0.3,
        diversityWeight: 0.2
      });

      expect(result.clips.length).toBe(1);
      expect(result.clips[0].score).toBeGreaterThan(0);
    });

    it('should compute diversity bonus for different scene types', () => {
      const selectedClip = createMockClip('selected', ['dialogue'], 0.5, 0.3, 0.5);
      const candidate1 = createMockClip('candidate1', ['dialogue'], 0.5, 0.3, 0.5);
      const candidate2 = createMockClip('candidate2', ['action'], 0.5, 0.3, 0.5);

      const result = recommendClips([candidate1, candidate2], {
        selectedClips: [selectedClip],
        currentTime: 0
      }, { diversityWeight: 0.5, similarityWeight: 0.3, emotionWeight: 0.2 });

      // candidate2 should get diversity bonus for different scene type
      const c1 = result.clips.find(c => c.clipId === 'candidate1');
      const c2 = result.clips.find(c => c.clipId === 'candidate2');

      expect(c1).toBeDefined();
      expect(c2).toBeDefined();
      expect(c2!.diversityScore).toBeGreaterThan(c1!.diversityScore);
    });
  });
});
