import { describe, it, expect } from 'vitest';
import {
  extractProjectContentProfile,
  scoreTemplate,
  recommendTemplates,
  explainRecommendation,
} from './template-recommender';
import type { EditingTemplate } from '../models/template-schema';
import type { ProjectContentProfile, UserPreference } from './template-recommender';

// ─── Fixtures ──────────────────────────────────────────────────────

function makeProject(overrides: Record<string, any> = {}): any {
  return {
    media: [],
    timeline: {
      tracks: [{
        id: 't1',
        type: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', type: 'video', duration: 5, speed: 1, start: 0, trimStart: 0, trimEnd: 0, trackId: 't1', name: 'c1' },
          { id: 'c2', type: 'video', duration: 5, speed: 1.5, start: 5, trimStart: 0, trimEnd: 0, trackId: 't1', name: 'c2' },
          { id: 'c3', type: 'video', duration: 5, speed: 0.8, start: 10, trimStart: 0, trimEnd: 0, trackId: 't1', name: 'c3' },
        ],
      }],
      transitions: [
        { type: 'dissolve', durationSec: 0.5 },
      ],
    },
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProjectContentProfile> = {}): ProjectContentProfile {
  return {
    duration: 15,
    clipCount: 3,
    avgMotion: 0.3,
    hasDialogue: false,
    musicGenre: null,
    mood: 'neutral',
    dominantClipType: 'video',
    avgClipDuration: 5,
    transitionDensity: 4,
    ...overrides,
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
      id: 'tpl-rec',
      version: '1.0',
      name: 'Test Template',
      description: '',
      category: 'vlog',
      tags: [],
      author: 'test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      aspectRatio: '16:9',
      resolutionWidth: 1920,
      resolutionHeight: 1080,
      frameRate: 30,
      estimatedDurationSec: 15,
      difficulty: 'beginner',
    },
    tracks: [{
      type: 'video',
      name: 'main',
      clips: [{
        type: 'video',
        durationSec: 5,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      }],
      transitions: [{ type: 'dissolve', durationSec: 0.5 }],
      trackEffects: [],
      muted: false,
      locked: false,
    }],
    audioLayout: {
      tracks: [{ role: 'music', volumeDb: -18, pan: 0, fadeInSec: 0.5, fadeOutSec: 0.5 }],
      masterLoudnessTarget: -14,
      masterLimiter: true,
    },
    globalColorNodes: [],
    variables: [],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('Template Recommender', () => {
  describe('extractProjectContentProfile', () => {
    it('extracts duration and clip count from project', () => {
      const project = makeProject();
      const profile = extractProjectContentProfile(project);

      expect(profile.duration).toBe(15);
      expect(profile.clipCount).toBe(3);
      expect(profile.avgClipDuration).toBe(5);
    });

    it('detects mood from cut rate', () => {
      // 60 clips / 60s = 60 cuts/min -> energetic
      const clips = Array.from({ length: 60 }, (_, i) => ({
        id: `c${i}`, type: 'video', duration: 1, speed: 1, start: i,
        trimStart: 0, trimEnd: 0, trackId: 't1', name: `c${i}`,
      }));
      const project = makeProject({
        timeline: { tracks: [{ id: 't1', type: 'video', name: 'V1', clips }], transitions: [] },
      });
      const profile = extractProjectContentProfile(project);

      expect(profile.mood).toBe('energetic');
    });

    it('detects dialogue from track name', () => {
      const project = makeProject({
        timeline: {
          tracks: [
            { id: 't1', type: 'video', name: 'V1', clips: [{ id: 'c1', type: 'video', duration: 5, speed: 1, start: 0, trimStart: 0, trimEnd: 0, trackId: 't1', name: 'c1' }] },
            { id: 't2', type: 'audio', name: 'Voice Over', clips: [] },
          ],
          transitions: [],
        },
      });
      const profile = extractProjectContentProfile(project);

      expect(profile.hasDialogue).toBe(true);
    });
  });

  describe('scoreTemplate', () => {
    it('returns a score between 0 and 1', () => {
      const result = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('scores higher for matching category preference', () => {
      const tpl = makeTemplate({ metadata: { ...makeTemplate().metadata, category: 'vlog' } });
      const prefs = makePreferences({ favoriteCategories: ['vlog'] });
      const result = scoreTemplate(tpl, makeProfile(), prefs);

      expect(result.matchDimensions.preferenceMatch).toBeGreaterThan(0.5);
    });

    it('includes match dimensions in result', () => {
      const result = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());

      expect(result.matchDimensions).toHaveProperty('contentMatch');
      expect(result.matchDimensions).toHaveProperty('preferenceMatch');
      expect(result.matchDimensions).toHaveProperty('materialFit');
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
      const result = recommendTemplates(templates, makeProfile(), makePreferences(), 3);

      expect(result).toHaveLength(3);
    });

    it('returns empty for empty template list', () => {
      const result = recommendTemplates([], makeProfile(), makePreferences());
      expect(result).toEqual([]);
    });
  });

  describe('explainRecommendation', () => {
    it('includes template name and score percentage', () => {
      const rec = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());
      const explanation = explainRecommendation(rec);

      expect(explanation).toContain('Test Template');
      expect(explanation).toContain('%');
    });

    it('includes dimension scores', () => {
      const rec = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());
      const explanation = explainRecommendation(rec);

      expect(explanation).toContain('Content match');
      expect(explanation).toContain('Preference match');
      expect(explanation).toContain('Material fit');
    });

    it('includes reasons section', () => {
      const rec = scoreTemplate(makeTemplate(), makeProfile(), makePreferences());
      const explanation = explainRecommendation(rec);

      expect(explanation).toContain('Reasons:');
    });
  });
});
