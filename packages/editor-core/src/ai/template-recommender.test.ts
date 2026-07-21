import { describe, it, expect } from 'vitest';
import { extractProjectContentProfile, scoreTemplate, recommendTemplates, explainRecommendation } from './template-recommender';
import type { EditingTemplate } from '../models/template-schema';
import type { ProjectContentProfile, UserPreference } from './template-recommender';

function makeClip(id: string, duration: number, speed = 1) {
  return { id, type: 'video' as const, duration, speed, start: 0, trimStart: 0, trimEnd: 0, trackId: 't1', name: id };
}

function makeProject(overrides: Record<string, any> = {}): any {
  return {
    media: [],
    timeline: {
      tracks: [{
        id: 't1', type: 'video', name: 'V1',
        clips: [makeClip('c1', 5), makeClip('c2', 5, 1.5), makeClip('c3', 5, 0.8)],
      }],
      transitions: [{ type: 'dissolve', durationSec: 0.5 }],
    },
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProjectContentProfile> = {}): ProjectContentProfile {
  return {
    duration: 15, clipCount: 3, avgMotion: 0.3, hasDialogue: false,
    musicGenre: null, mood: 'neutral', dominantClipType: 'video',
    avgClipDuration: 5, transitionDensity: 4, ...overrides,
  };
}

function makePreferences(overrides: Partial<UserPreference> = {}): UserPreference {
  return {
    favoriteCategories: ['vlog', 'tutorial', 'music-video'],
    preferredPace: 'medium',
    preferredTransitions: ['dissolve', 'fade-black'],
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EditingTemplate> = {}): EditingTemplate {
  return {
    metadata: {
      id: 'tpl-rec', version: '1.0', name: 'Test Template', description: '',
      category: 'vlog', tags: [], author: 'test',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      aspectRatio: '16:9', resolutionWidth: 1920, resolutionHeight: 1080,
      frameRate: 30, estimatedDurationSec: 15, difficulty: 'beginner',
    },
    tracks: [{
      type: 'video', name: 'main',
      clips: [{
        type: 'video', durationSec: 5, flexibleDuration: true,
        placeholder: 'user-video', placeholderParams: {},
        effects: [], keyframes: [], colorNodes: [],
        opacity: 1, speed: 1, volume: 1,
      }],
      transitions: [{ type: 'dissolve', durationSec: 0.5 }],
      trackEffects: [], muted: false, locked: false,
    }],
    audioLayout: {
      tracks: [{ role: 'music', volumeDb: -18, pan: 0, fadeInSec: 0.5, fadeOutSec: 0.5 }],
      masterLoudnessTarget: -14, masterLimiter: true,
    },
    globalColorNodes: [], variables: [], ...overrides,
  };
}

describe('Template Recommender', () => {
  describe('extractProjectContentProfile', () => {
    it('extracts duration and clip count', () => {
      const profile = extractProjectContentProfile(makeProject());
      expect(profile.duration).toBe(15);
      expect(profile.clipCount).toBe(3);
      expect(profile.avgClipDuration).toBe(5);
    });

    it('detects energetic mood from high cut rate', () => {
      const clips = Array.from({ length: 60 }, (_, i) => makeClip(`c${i}`, 1));
      const project = makeProject({ timeline: { tracks: [{ id: 't1', type: 'video', name: 'V1', clips }], transitions: [] } });
      expect(extractProjectContentProfile(project).mood).toBe('energetic');
    });

    it('detects dialogue from voice track name', () => {
      const project = makeProject({
        timeline: {
          tracks: [
            { id: 't1', type: 'video', name: 'V1', clips: [makeClip('c1', 5)] },
            { id: 't2', type: 'audio', name: 'Voice Over', clips: [] },
          ],
          transitions: [],
        },
      });
      expect(extractProjectContentProfile(project).hasDialogue).toBe(true);
    });
  });

  describe('scoreTemplate', () => {
    it('returns score between 0 and 1', () => {
      const result = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('scores higher for matching category preference', () => {
      const tpl = makeTemplate({ metadata: { ...makeTemplate().metadata, category: 'vlog' } });
      const result = scoreTemplate(tpl, makeProfile(), makePreferences({ favoriteCategories: ['vlog'] }));
      expect(result.matchDimensions.preferenceMatch).toBeGreaterThan(0.5);
    });

    it('includes all match dimensions', () => {
      const { matchDimensions } = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());
      expect(matchDimensions).toHaveProperty('contentMatch');
      expect(matchDimensions).toHaveProperty('preferenceMatch');
      expect(matchDimensions).toHaveProperty('materialFit');
    });
  });

  describe('recommendTemplates', () => {
    it('returns templates sorted by score descending', () => {
      const templates = [
        makeTemplate({ metadata: { ...makeTemplate().metadata, id: 'a', category: 'tutorial' } }),
        makeTemplate({ metadata: { ...makeTemplate().metadata, id: 'b', category: 'vlog' } }),
        makeTemplate({ metadata: { ...makeTemplate().metadata, id: 'c', category: 'documentary' } }),
      ];
      const result = recommendTemplates(templates, makeProfile(), makePreferences());
      expect(result).toHaveLength(3);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });

    it('respects topK limit', () => {
      const templates = Array.from({ length: 10 }, (_, i) =>
        makeTemplate({ metadata: { ...makeTemplate().metadata, id: `tpl-${i}` } }),
      );
      expect(recommendTemplates(templates, makeProfile(), makePreferences(), 3)).toHaveLength(3);
    });

    it('returns empty for empty template list', () => {
      expect(recommendTemplates([], makeProfile(), makePreferences())).toEqual([]);
    });
  });

  describe('explainRecommendation', () => {
    it('includes template name and score percentage', () => {
      const explanation = explainRecommendation(scoreTemplate(makeTemplate(), makeProfile(), makePreferences()));
      expect(explanation).toContain('Test Template');
      expect(explanation).toContain('%');
    });

    it('includes dimension scores', () => {
      const explanation = explainRecommendation(scoreTemplate(makeTemplate(), makeProfile(), makePreferences()));
      expect(explanation).toContain('Content match');
      expect(explanation).toContain('Preference match');
      expect(explanation).toContain('Material fit');
    });

    it('includes reasons section', () => {
      const explanation = explainRecommendation(scoreTemplate(makeTemplate(), makeProfile(), makePreferences()));
      expect(explanation).toContain('Reasons:');
    });
  });
});
