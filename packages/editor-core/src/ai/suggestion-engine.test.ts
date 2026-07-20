import { describe, it, expect } from 'vitest';
import {
  parseSuggestionResponse,
  buildSuggestionMessages,
  enrichSuggestionWithStyle,
  generateComparison,
  recordFeedback,
  filterSuggestions,
  rankSuggestions,
  type EditingSuggestion,
  type SuggestionCategory,
  type SuggestionRequest,
} from './suggestion-engine';
import {
  STYLE_FINGERPRINT_VERSION,
  type StyleFingerprint,
} from './style-analyzer';
import type { MaterialMetadata } from './semantic-extractor';
import type { TransitionType } from '../model-types';

// ─── Test Helpers ───────────────────────────────────────────────

function makeMetadata(overrides: Partial<MaterialMetadata> = {}): MaterialMetadata {
  return {
    version: '1.0',
    source: {
      fileName: 'test.mp4', durationSec: 60, width: 1920,
      height: 1080, fps: 30, codec: 'h264', fileSizeBytes: 10_000_000,
    },
    extractedAt: new Date().toISOString(),
    keyFrames: [],
    asrSegments: [],
    transcriptText: 'Hello world this is a test video about nature',
    audioProfile: {
      avgLoudness: -14, peakDb: -1, silenceRatio: 0.1,
      hasMusic: false, speechRatio: 0.8, noiseLevel: 'quiet',
    },
    visualProfile: {
      motionIntensity: 0.5, colorPalette: ['#ff0000'],
      avgBrightness: 0.5, sceneDistribution: { outdoor: 0.7 },
      faceCount: 1, hasOverlay: false,
    },
    tags: ['nature', 'outdoor'],
    ...overrides,
  };
}

function makeStyle(overrides: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    version: STYLE_FINGERPRINT_VERSION,
    id: 'style-test',
    name: 'Test Style',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analyzedProjectCount: 1,
    totalClipCount: 10,
    totalDurationSec: 60,
    transitions: [{ type: 'dissolve' as TransitionType, count: 5, avgDurationSec: 0.5, durationStddev: 0.1, ratio: 0.5 }],
    rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 },
    colorGrading: { brightness: { mean: 0, stddev: 0, count: 0 }, contrast: { mean: 0, stddev: 0, count: 0 }, saturation: { mean: 0, stddev: 0, count: 0 }, hue: { mean: 0, stddev: 0, count: 0 }, preferredLutPath: null, lutUsageRatio: 0, temperatureTendency: 'neutral' },
    audioProcessing: { avgTargetLoudness: -14, loudnessStddev: 0, avgFadeInSec: 0.3, avgFadeOutSec: 0.5, musicSpeechRatio: 0.5, crossfadeRatio: 0.3 },
    effects: [],
    tags: ['medium-paced', 'neutral-tones'],
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<EditingSuggestion> = {}): EditingSuggestion {
  return {
    id: 'sug-1',
    category: 'creative',
    title: 'Test Suggestion',
    description: 'A test suggestion',
    confidence: 0.8,
    rationale: 'Test rationale',
    previewInstructions: [
      { action: 'cut', target: { materialIndex: 0, startSec: 5, endSec: 10 }, params: {}, reason: 'Remove dead air' },
    ],
    tags: ['test'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('suggestion-engine', () => {
  describe('parseSuggestionResponse', () => {
    it('parses a valid suggestion response', () => {
      const json = JSON.stringify({
        suggestions: [
          {
            id: 's1',
            category: 'creative',
            title: 'Highlight Reel',
            description: 'Create a fast-paced highlight reel',
            confidence: 0.85,
            rationale: 'Content has many action scenes',
            previewInstructions: [
              { action: 'cut', target: { startSec: 0, endSec: 5 }, params: {}, reason: 'Focus on key moments' },
            ],
            tags: ['highlight', 'fast'],
          },
        ],
        analysisNotes: 'Good content for highlights',
      });

      const result = parseSuggestionResponse(json);
      expect(result).not.toBeNull();
      expect(result!.suggestions.length).toBe(1);
      expect(result!.suggestions[0].title).toBe('Highlight Reel');
      expect(result!.suggestions[0].category).toBe('creative');
      expect(result!.suggestions[0].confidence).toBe(0.85);
      expect(result!.analysisNotes).toBe('Good content for highlights');
    });

    it('returns null for invalid JSON', () => {
      expect(parseSuggestionResponse('not json')).toBeNull();
    });

    it('returns null when suggestions array is missing', () => {
      expect(parseSuggestionResponse(JSON.stringify({ analysisNotes: 'test' }))).toBeNull();
    });

    it('normalizes invalid category to creative', () => {
      const json = JSON.stringify({
        suggestions: [{ id: 's1', category: 'invalid', title: 'Test', description: '', confidence: 0.5, rationale: '', previewInstructions: [], tags: [] }],
      });
      const result = parseSuggestionResponse(json);
      expect(result!.suggestions[0].category).toBe('creative');
    });

    it('clamps confidence to 0-1', () => {
      const json = JSON.stringify({
        suggestions: [
          { id: 's1', category: 'creative', title: 'Test', description: '', confidence: 1.5, rationale: '', previewInstructions: [], tags: [] },
          { id: 's2', category: 'creative', title: 'Test2', description: '', confidence: -0.5, rationale: '', previewInstructions: [], tags: [] },
        ],
      });
      const result = parseSuggestionResponse(json);
      expect(result!.suggestions[0].confidence).toBe(1);
      expect(result!.suggestions[1].confidence).toBe(0);
    });
  });

  describe('buildSuggestionMessages', () => {
    it('builds messages with materials and styles', () => {
      const request: SuggestionRequest = {
        materials: [makeMetadata()],
        styles: [makeStyle()],
        platform: 'youtube',
        maxSuggestions: 3,
      };
      const messages = buildSuggestionMessages(request);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('youtube');
      expect(messages[1].content).toContain('3');
    });

    it('includes user guidance when provided', () => {
      const request: SuggestionRequest = {
        materials: [makeMetadata()],
        styles: [],
        userGuidance: 'Focus on the nature scenes',
      };
      const messages = buildSuggestionMessages(request);
      expect(messages[1].content).toContain('Focus on the nature scenes');
    });
  });

  describe('enrichSuggestionWithStyle', () => {
    it('enriches transition instructions with style preferences', () => {
      const suggestion = makeSuggestion({
        previewInstructions: [
          { action: 'add_transition', target: {}, params: {}, reason: 'Smooth transition' },
        ],
      });
      const style = makeStyle({
        transitions: [{ type: 'dissolve' as TransitionType, count: 3, avgDurationSec: 0.7, durationStddev: 0.1, ratio: 0.6 }],
      });

      const enriched = enrichSuggestionWithStyle(suggestion, style, 1.0);
      expect(enriched.styleId).toBe(style.id);
      expect(enriched.previewInstructions[0].params.type).toBe('dissolve');
      expect(enriched.previewInstructions[0].params.duration).toBeCloseTo(0.7, 1);
    });

    it('enriches audio instructions with fade preferences', () => {
      const suggestion = makeSuggestion({
        previewInstructions: [
          { action: 'adjust_audio', target: {}, params: {}, reason: 'Add fades' },
        ],
      });
      const style = makeStyle();

      const enriched = enrichSuggestionWithStyle(suggestion, style, 1.0);
      expect(enriched.previewInstructions[0].params.fadeIn).toBeCloseTo(0.3, 1);
      expect(enriched.previewInstructions[0].params.fadeOut).toBeCloseTo(0.5, 1);
    });
  });

  describe('generateComparison', () => {
    it('generates a comparison matrix', () => {
      const suggestions = [
        makeSuggestion({ id: 's1', category: 'creative', confidence: 0.8 }),
        makeSuggestion({ id: 's2', category: 'experimentation', confidence: 0.6 }),
      ];
      const comparison = generateComparison(suggestions);
      expect(comparison.suggestions.length).toBe(2);
      expect(comparison.dimensions.length).toBe(3);
      expect(comparison.dimensions[0].name).toBe('creativity');
      expect(comparison.dimensions[0].scores['s2']).toBeGreaterThan(comparison.dimensions[0].scores['s1']);
    });
  });

  describe('recordFeedback', () => {
    it('records feedback on a suggestion', () => {
      const suggestion = makeSuggestion();
      const result = recordFeedback(suggestion, 0.8, 'Great suggestion');
      expect(result.feedbackScore).toBe(0.8);
      expect(result.feedbackNotes).toBe('Great suggestion');
    });

    it('clamps feedback score to -1..1', () => {
      const suggestion = makeSuggestion();
      expect(recordFeedback(suggestion, 2).feedbackScore).toBe(1);
      expect(recordFeedback(suggestion, -2).feedbackScore).toBe(-1);
    });
  });

  describe('filterSuggestions', () => {
    it('filters by category', () => {
      const suggestions = [
        makeSuggestion({ id: 's1', category: 'creative' }),
        makeSuggestion({ id: 's2', category: 'platform' }),
        makeSuggestion({ id: 's3', category: 'creative' }),
      ];
      const filtered = filterSuggestions(suggestions, { categories: ['creative'] });
      expect(filtered.length).toBe(2);
    });

    it('filters by min confidence', () => {
      const suggestions = [
        makeSuggestion({ id: 's1', confidence: 0.9 }),
        makeSuggestion({ id: 's2', confidence: 0.3 }),
      ];
      const filtered = filterSuggestions(suggestions, { minConfidence: 0.5 });
      expect(filtered.length).toBe(1);
    });

    it('filters by tags', () => {
      const suggestions = [
        makeSuggestion({ id: 's1', tags: ['fast', 'highlight'] }),
        makeSuggestion({ id: 's2', tags: ['slow', 'contemplative'] }),
      ];
      const filtered = filterSuggestions(suggestions, { tags: ['highlight'] });
      expect(filtered.length).toBe(1);
    });
  });

  describe('rankSuggestions', () => {
    it('ranks suggestions by weighted score', () => {
      const suggestions = [
        makeSuggestion({ id: 's1', category: 'efficiency', confidence: 0.6 }),
        makeSuggestion({ id: 's2', category: 'creative', confidence: 0.9 }),
        makeSuggestion({ id: 's3', category: 'experimentation', confidence: 0.5, feedbackScore: 0.9 }),
      ];
      const ranked = rankSuggestions(suggestions, {
        confidence: 0.4,
        categoryPreference: { experimentation: 0.9, creative: 0.7, efficiency: 0.3 },
        feedbackWeight: 0.3,
      });
      expect(ranked.length).toBe(3);
      // s3 should rank highest due to high feedback + high category pref
      expect(ranked[0].id).toBe('s3');
    });
  });
});
