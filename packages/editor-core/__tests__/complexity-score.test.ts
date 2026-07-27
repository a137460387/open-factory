import { describe, it, expect } from 'vitest';
import {
  COMPLEXITY_WEIGHTS,
  getComplexityLevel,
  calculateComplexityScore,
  calculateTimelineDensityScore,
  calculateKeyframeDensityScore,
} from '../src/complexity-score';
import type { Timeline, Project } from '../src/model-types';

describe('complexity-score', () => {
  describe('COMPLEXITY_WEIGHTS', () => {
    it('has weights for all dimensions', () => {
      expect(COMPLEXITY_WEIGHTS).toHaveProperty('timelineDensity');
      expect(COMPLEXITY_WEIGHTS).toHaveProperty('effectComplexity');
      expect(COMPLEXITY_WEIGHTS).toHaveProperty('colorDepth');
      expect(COMPLEXITY_WEIGHTS).toHaveProperty('audioComplexity');
      expect(COMPLEXITY_WEIGHTS).toHaveProperty('keyframeDensity');
    });

    it('weights sum to 1', () => {
      const sum = Object.values(COMPLEXITY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('getComplexityLevel', () => {
    it('returns master for >= 80', () => {
      expect(getComplexityLevel(80)).toBe('master');
      expect(getComplexityLevel(100)).toBe('master');
    });

    it('returns professional for >= 65', () => {
      expect(getComplexityLevel(65)).toBe('professional');
      expect(getComplexityLevel(79)).toBe('professional');
    });

    it('returns intermediate for >= 40', () => {
      expect(getComplexityLevel(40)).toBe('intermediate');
      expect(getComplexityLevel(64)).toBe('intermediate');
    });

    it('returns beginner for < 40', () => {
      expect(getComplexityLevel(0)).toBe('beginner');
      expect(getComplexityLevel(39)).toBe('beginner');
    });

    it('handles NaN as 0', () => {
      expect(getComplexityLevel(NaN)).toBe('beginner');
    });

    it('handles Infinity as 0 (beginner)', () => {
      expect(getComplexityLevel(Infinity)).toBe('beginner');
    });
  });

  describe('calculateTimelineDensityScore', () => {
    it('returns 0 score for empty timeline', () => {
      const timeline = { tracks: [], duration: 60 } as unknown as Timeline;
      const result = calculateTimelineDensityScore(timeline);
      expect(result.score).toBe(0);
      expect(result.id).toBe('timelineDensity');
    });

    it('calculates density from clips', () => {
      const timeline = {
        tracks: [
          {
            type: 'video',
            clips: [
              { id: '1', type: 'video', start: 0, duration: 5, trimStart: 0, mediaId: 'm1', keyframes: {} },
              { id: '2', type: 'video', start: 5, duration: 5, trimStart: 0, mediaId: 'm2', keyframes: {} },
            ],
          },
        ],
        duration: 60,
      } as unknown as Timeline;
      const result = calculateTimelineDensityScore(timeline);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('calculateKeyframeDensityScore', () => {
    it('returns 0 for empty timeline', () => {
      const timeline = { tracks: [], duration: 60 } as unknown as Timeline;
      const result = calculateKeyframeDensityScore(timeline);
      expect(result.score).toBe(0);
    });

    it('returns 0 for clips without keyframes', () => {
      const timeline = {
        tracks: [
          {
            type: 'video',
            clips: [
              { id: '1', type: 'video', start: 0, duration: 5, trimStart: 0, mediaId: 'm1' },
            ],
          },
        ],
        duration: 60,
      } as unknown as Timeline;
      const result = calculateKeyframeDensityScore(timeline);
      expect(result.rawValue).toBe(0);
    });
  });

  describe('calculateComplexityScore', () => {
    it('returns a valid result for empty project', () => {
      const project = {
        timeline: { tracks: [], duration: 60 },
      } as Pick<Project, 'timeline'>;
      const result = calculateComplexityScore(project);
      expect(result.totalScore).toBe(0);
      expect(result.level).toBe('beginner');
      expect(result.dimensions).toHaveProperty('timelineDensity');
      expect(result.dimensions).toHaveProperty('effectComplexity');
      expect(result.dimensions).toHaveProperty('colorDepth');
      expect(result.dimensions).toHaveProperty('audioComplexity');
      expect(result.dimensions).toHaveProperty('keyframeDensity');
    });
  });
});
