import { describe, it, expect } from 'vitest';
import {
  scoreHighlightClip,
  scoreAllHighlightClips,
  extractTopHighlightClips,
  scoreAIMoodKeywords,
  buildHighlightReelSystemPrompt,
  buildHighlightReelUserPrompt,
  parseHighlightReelResponse,
  DEFAULT_HIGHLIGHT_WEIGHTS
} from '../src/highlight-reel';

describe('scoreHighlightClip', () => {
  it('calculates weighted total score', () => {
    const result = scoreHighlightClip({
      clipId: 'c1',
      visualScore: 0.8,
      loudnessScore: 0.6,
      aiScore: 0.9
    });
    expect(result.totalScore).toBeCloseTo(
      0.8 * DEFAULT_HIGHLIGHT_WEIGHTS.visual +
      0.6 * DEFAULT_HIGHLIGHT_WEIGHTS.loudness +
      0.9 * DEFAULT_HIGHLIGHT_WEIGHTS.aiContent,
      2
    );
  });

  it('uses custom weights', () => {
    const result = scoreHighlightClip(
      { clipId: 'c1', visualScore: 1, loudnessScore: 1, aiScore: 1 },
      { visual: 0.5, loudness: 0.3, aiContent: 0.2 }
    );
    expect(result.totalScore).toBeCloseTo(1.0, 2);
  });

  it('clamps scores to [0, 1]', () => {
    const result = scoreHighlightClip({
      clipId: 'c1',
      visualScore: 1.5,
      loudnessScore: -0.5,
      aiScore: 0.5
    });
    // visual clamped to 1, loudness clamped to 0
    expect(result.totalScore).toBeCloseTo(
      1 * 0.4 + 0 * 0.3 + 0.5 * 0.3,
      2
    );
  });

  it('preserves clipId and input scores', () => {
    const result = scoreHighlightClip({
      clipId: 'c42', visualScore: 0.5, loudnessScore: 0.5, aiScore: 0.5
    });
    expect(result.clipId).toBe('c42');
    expect(result.visualScore).toBe(0.5);
    expect(result.loudnessScore).toBe(0.5);
    expect(result.aiScore).toBe(0.5);
  });
});

describe('scoreAllHighlightClips', () => {
  it('returns clips sorted by totalScore descending', () => {
    const inputs = [
      { clipId: 'c1', visualScore: 0.1, loudnessScore: 0.1, aiScore: 0.1 },
      { clipId: 'c2', visualScore: 0.9, loudnessScore: 0.9, aiScore: 0.9 },
      { clipId: 'c3', visualScore: 0.5, loudnessScore: 0.5, aiScore: 0.5 }
    ];
    const result = scoreAllHighlightClips(inputs);
    expect(result[0].clipId).toBe('c2');
    expect(result[1].clipId).toBe('c3');
    expect(result[2].clipId).toBe('c1');
  });

  it('returns empty array for empty input', () => {
    expect(scoreAllHighlightClips([])).toEqual([]);
  });
});

describe('extractTopHighlightClips', () => {
  it('selects clips until target duration is reached', () => {
    const scores = [
      { clipId: 'c1', visualScore: 0.9, loudnessScore: 0.9, aiScore: 0.9, totalScore: 0.9 },
      { clipId: 'c2', visualScore: 0.7, loudnessScore: 0.7, aiScore: 0.7, totalScore: 0.7 },
      { clipId: 'c3', visualScore: 0.5, loudnessScore: 0.5, aiScore: 0.5, totalScore: 0.5 }
    ];
    const durations = new Map([['c1', 10], ['c2', 15], ['c3', 20]]);
    const result = extractTopHighlightClips(scores, durations, 30);
    expect(result.selected.length).toBeLessThanOrEqual(3);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('first clip is always selected even if it exceeds tolerance', () => {
    const scores = [
      { clipId: 'c1', visualScore: 0.9, loudnessScore: 0.9, aiScore: 0.9, totalScore: 0.9 }
    ];
    const durations = new Map([['c1', 12]]);
    const result = extractTopHighlightClips(scores, durations, 10, 0.1);
    // First clip is always admitted even if it exceeds maxDuration
    expect(result.selected).toHaveLength(1);
  });

  it('skips clips with zero or missing duration', () => {
    const scores = [
      { clipId: 'c1', visualScore: 0.9, loudnessScore: 0.9, aiScore: 0.9, totalScore: 0.9 },
      { clipId: 'c2', visualScore: 0.8, loudnessScore: 0.8, aiScore: 0.8, totalScore: 0.8 }
    ];
    const durations = new Map([['c1', 0], ['c2', 10]]);
    const result = extractTopHighlightClips(scores, durations, 30);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].clipId).toBe('c2');
  });

  it('returns empty selection for empty scores', () => {
    const result = extractTopHighlightClips([], new Map(), 30);
    expect(result.selected).toHaveLength(0);
    expect(result.totalDuration).toBe(0);
  });
});

describe('scoreAIMoodKeywords', () => {
  it('returns 0 for empty mood', () => {
    expect(scoreAIMoodKeywords('')).toBe(0);
  });

  it('returns high score for exciting mood', () => {
    expect(scoreAIMoodKeywords('exciting dynamic energetic')).toBe(1);
  });

  it('returns partial score for single keyword', () => {
    expect(scoreAIMoodKeywords('exciting')).toBeCloseTo(1 / 3, 2);
  });

  it('returns 0 for calm mood with no exciting keywords', () => {
    expect(scoreAIMoodKeywords('calm relaxed')).toBe(0);
  });

  it('matches Chinese keywords', () => {
    const score = scoreAIMoodKeywords('活力动感');
    expect(score).toBeGreaterThan(0);
  });

  it('caps at 1 even with many matches', () => {
    const score = scoreAIMoodKeywords('exciting dynamic energetic 活力 动感 激情 激烈 快节奏 热血');
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('buildHighlightReelSystemPrompt', () => {
  it('returns prompt with JSON format instructions', () => {
    const prompt = buildHighlightReelSystemPrompt();
    expect(prompt).toContain('selectedIds');
    expect(prompt).toContain('transitionNotes');
    expect(prompt).toContain('JSON');
  });
});

describe('buildHighlightReelUserPrompt', () => {
  it('includes description and candidate info', () => {
    const prompt = buildHighlightReelUserPrompt('制作30秒集锦', [
      { clipId: 'c1', duration: 10, totalScore: 0.9, mood: 'exciting' },
      { clipId: 'c2', duration: 15, totalScore: 0.7 }
    ]);
    expect(prompt).toContain('制作30秒集锦');
    expect(prompt).toContain('c1');
    expect(prompt).toContain('c2');
    expect(prompt).toContain('exciting');
  });

  it('omits mood when not provided', () => {
    const prompt = buildHighlightReelUserPrompt('desc', [
      { clipId: 'c1', duration: 10, totalScore: 0.5 }
    ]);
    expect(prompt).not.toContain('氛围:');
  });
});

describe('parseHighlightReelResponse', () => {
  it('returns empty for null input', () => {
    expect(parseHighlightReelResponse(null)).toEqual({ selectedIds: [], transitionNotes: [] });
  });

  it('returns empty for non-object input', () => {
    expect(parseHighlightReelResponse('string')).toEqual({ selectedIds: [], transitionNotes: [] });
  });

  it('parses valid response', () => {
    const result = parseHighlightReelResponse({
      selectedIds: ['c1', 'c2'],
      transitionNotes: ['c1→c2 快速切换']
    });
    expect(result.selectedIds).toEqual(['c1', 'c2']);
    expect(result.transitionNotes).toEqual(['c1→c2 快速切换']);
  });

  it('filters non-string elements from arrays', () => {
    const result = parseHighlightReelResponse({
      selectedIds: ['c1', 123, null, 'c2'],
      transitionNotes: [true, 'note1']
    });
    expect(result.selectedIds).toEqual(['c1', 'c2']);
    expect(result.transitionNotes).toEqual(['note1']);
  });

  it('returns empty arrays for missing fields', () => {
    const result = parseHighlightReelResponse({});
    expect(result.selectedIds).toEqual([]);
    expect(result.transitionNotes).toEqual([]);
  });
});
