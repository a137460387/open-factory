import { describe, it, expect } from 'vitest';
import {
  COMPLEXITY_WEIGHTS,
  COMPLEXITY_EFFECT_TYPE_FACTORS,
  REFERENCE_COMPLEXITY_PROJECTS,
  getComplexityLevel,
  calculateComplexityScore,
  calculateTimelineDensityScore,
  calculateEffectComplexityScore,
  calculateColorDepthScore,
  calculateAudioComplexityScore,
  calculateKeyframeDensityScore,
  createComplexityReport,
} from '../src/complexity-score';
import type { Timeline, Project, Clip, Track } from '../src/model-types';

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'c1',
    type: 'video',
    start: 0,
    duration: 5,
    trimStart: 0,
    mediaId: 'm1',
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeTrack(type: 'video' | 'audio' = 'video', clips: Clip[] = [makeClip()]): Track {
  return { id: 't1', type, clips, name: 'Track 1' } as Track;
}

function makeTimeline(tracks: Track[] = [makeTrack()]): Timeline {
  return { tracks, duration: 60 } as Timeline;
}

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

  describe('COMPLEXITY_EFFECT_TYPE_FACTORS', () => {
    it('has factors for all effect types', () => {
      expect(COMPLEXITY_EFFECT_TYPE_FACTORS.blur).toBe(1);
      expect(COMPLEXITY_EFFECT_TYPE_FACTORS['custom-shader']).toBe(2.2);
      expect(COMPLEXITY_EFFECT_TYPE_FACTORS['motion-blur']).toBe(1.8);
    });
  });

  describe('REFERENCE_COMPLEXITY_PROJECTS', () => {
    it('has 3 reference projects', () => {
      expect(REFERENCE_COMPLEXITY_PROJECTS).toHaveLength(3);
    });

    it('has ascending scores', () => {
      const scores = REFERENCE_COMPLEXITY_PROJECTS.map((p) => p.score);
      expect(scores).toEqual([35, 62, 78]);
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
      const timeline = makeTimeline([]);
      const result = calculateTimelineDensityScore(timeline);
      expect(result.score).toBe(0);
      expect(result.id).toBe('timelineDensity');
      expect(result.weight).toBe(COMPLEXITY_WEIGHTS.timelineDensity);
    });

    it('calculates density from clips', () => {
      const timeline = makeTimeline([makeTrack('video', [makeClip(), makeClip({id: 'c2', start: 5})])]);
      const result = calculateTimelineDensityScore(timeline);
      expect(result.score).toBeGreaterThan(0);
      expect(result.detail).toContain('clips/min');
    });

    it('caps score at 100', () => {
      const manyClips = Array.from({ length: 200 }, (_, i) => makeClip({ id: `c${i}`, start: i * 0.1, duration: 0.1 }));
      const timeline = makeTimeline([makeTrack('video', manyClips)]);
      const result = calculateTimelineDensityScore(timeline);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateEffectComplexityScore', () => {
    it('returns 0 for timeline without effects', () => {
      const timeline = makeTimeline();
      const result = calculateEffectComplexityScore(timeline);
      expect(result.score).toBe(0);
      expect(result.rawValue).toBe(0);
    });

    it('calculates weighted effects', () => {
      const clip = makeClip({
        effects: [
          { type: 'blur', enabled: true, params: {} },
          { type: 'custom-shader', enabled: true, params: {} },
        ],
      } as Partial<Clip>);
      const timeline = makeTimeline([makeTrack('video', [clip])]);
      const result = calculateEffectComplexityScore(timeline);
      expect(result.rawValue).toBeCloseTo(1 + 2.2, 1);
      expect(result.score).toBeGreaterThan(0);
    });

    it('ignores disabled effects', () => {
      const clip = makeClip({
        effects: [
          { type: 'blur', enabled: false, params: {} },
          { type: 'sharpen', enabled: true, params: {} },
        ],
      } as Partial<Clip>);
      const timeline = makeTimeline([makeTrack('video', [clip])]);
      const result = calculateEffectComplexityScore(timeline);
      expect(result.rawValue).toBeCloseTo(1, 1);
    });

    it('caps score at 100', () => {
      const effects = Array.from({ length: 50 }, () => ({ type: 'custom-shader' as const, enabled: true, params: {} }));
      const clip = makeClip({ effects } as Partial<Clip>);
      const timeline = makeTimeline([makeTrack('video', [clip])]);
      const result = calculateEffectComplexityScore(timeline);
      expect(result.score).toBe(100);
    });
  });

  describe('calculateColorDepthScore', () => {
    it('returns 0 for non-visual clips', () => {
      const clip = makeClip({ type: 'audio' as any });
      const timeline = makeTimeline([makeTrack('audio', [clip])]);
      const result = calculateColorDepthScore(timeline);
      expect(result.score).toBe(0);
      expect(result.detail).toBe('0% adjusted');
    });

    it('returns 0 for visual clips with default color correction', () => {
      const timeline = makeTimeline();
      const result = calculateColorDepthScore(timeline);
      expect(result.score).toBe(0);
    });

    it('calculates adjusted ratio for clips with color correction', () => {
      const clip = makeClip({
        colorCorrection: { brightness: 50, contrast: 50, saturation: 0, hue: 0 },
      } as Partial<Clip>);
      const timeline = makeTimeline([makeTrack('video', [clip])]);
      const result = calculateColorDepthScore(timeline);
      expect(result.score).toBeGreaterThan(0);
      expect(result.detail).toContain('% adjusted');
    });
  });

  describe('calculateAudioComplexityScore', () => {
    it('returns 0 for timeline without audio tracks', () => {
      const timeline = makeTimeline([makeTrack('video')]);
      const result = calculateAudioComplexityScore(timeline);
      expect(result.score).toBe(0);
    });

    it('accounts for audio track count', () => {
      const audioTrack = makeTrack('audio', []);
      const timeline = makeTimeline([makeTrack('video'), audioTrack]);
      const result = calculateAudioComplexityScore(timeline);
      expect(result.rawValue).toBeGreaterThanOrEqual(2);
    });

    it('accounts for track volume changes', () => {
      const audioTrack = { ...makeTrack('audio', []), volume: 0.5 } as Track;
      const timeline = makeTimeline([audioTrack]);
      const result = calculateAudioComplexityScore(timeline);
      expect(result.rawValue).toBeGreaterThanOrEqual(3); // 2 (track) + 1 (volume)
    });

    it('accounts for clip audio properties', () => {
      const clip = makeClip({
        type: 'audio' as any,
        volume: 0.5,
        fadeInDuration: 0.5,
        fadeOutDuration: 0.5,
      } as Partial<Clip>);
      const audioTrack = makeTrack('audio', [clip]);
      const timeline = makeTimeline([audioTrack]);
      const result = calculateAudioComplexityScore(timeline);
      expect(result.rawValue).toBeGreaterThan(2);
    });
  });

  describe('calculateKeyframeDensityScore', () => {
    it('returns 0 for empty timeline', () => {
      const timeline = makeTimeline([]);
      const result = calculateKeyframeDensityScore(timeline);
      expect(result.score).toBe(0);
      expect(result.detail).toBe('0 keyframes/clip');
    });

    it('returns 0 for clips without keyframes', () => {
      const timeline = makeTimeline();
      const result = calculateKeyframeDensityScore(timeline);
      expect(result.rawValue).toBe(0);
    });

    it('calculates keyframe density', () => {
      const clip = makeClip({
        keyframes: { opacity: [{ time: 0, value: 1 }, { time: 5, value: 0 }] },
      } as Partial<Clip>);
      const timeline = makeTimeline([makeTrack('video', [clip])]);
      const result = calculateKeyframeDensityScore(timeline);
      expect(result.rawValue).toBe(2);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('calculateComplexityScore', () => {
    it('returns a valid result for empty project', () => {
      const project = { timeline: makeTimeline([]) };
      const result = calculateComplexityScore(project);
      expect(result.totalScore).toBe(0);
      expect(result.level).toBe('beginner');
      expect(result.dimensions).toHaveProperty('timelineDensity');
      expect(result.dimensions).toHaveProperty('effectComplexity');
      expect(result.dimensions).toHaveProperty('colorDepth');
      expect(result.dimensions).toHaveProperty('audioComplexity');
      expect(result.dimensions).toHaveProperty('keyframeDensity');
    });

    it('calculates weighted total score', () => {
      const clip = makeClip({
        effects: [{ type: 'blur', enabled: true, params: {} }],
        keyframes: { opacity: [{ time: 0, value: 1 }] },
      } as Partial<Clip>);
      const project = { timeline: makeTimeline([makeTrack('video', [clip])]) };
      const result = calculateComplexityScore(project);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'professional', 'master']).toContain(result.level);
    });
  });

  describe('createComplexityReport', () => {
    it('creates a full report', () => {
      const project = { id: 'p1', name: 'Test Project', timeline: makeTimeline([]) };
      const report = createComplexityReport(project, '2024-01-01T00:00:00Z');
      expect(report.projectId).toBe('p1');
      expect(report.projectName).toBe('Test Project');
      expect(report.generatedAt).toBe('2024-01-01T00:00:00Z');
      expect(report.totalScore).toBe(0);
      expect(report.level).toBe('beginner');
      expect(report.dimensions).toHaveLength(5);
      expect(report.references).toEqual(REFERENCE_COMPLEXITY_PROJECTS);
    });

    it('uses current date when not provided', () => {
      const project = { id: 'p1', name: 'Test', timeline: makeTimeline() };
      const report = createComplexityReport(project);
      expect(report.generatedAt).toBeTruthy();
    });
  });
});
