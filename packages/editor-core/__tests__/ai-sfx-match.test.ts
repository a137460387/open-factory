import { describe, expect, it } from 'vitest';
import {
  detectActionCandidatePoints,
  parseSfxMatchResponse,
  normalizeCategory,
  matchLocalSfxLibrary,
  buildSfxSuggestions,
  buildSfxMatchPrompt,
  ACTION_DELTA_RATIO_THRESHOLD,
  type SfxLibraryEntry,
  type SfxAISuggestion
} from '../src';

describe('detectActionCandidatePoints', () => {
  it('returns empty for single magnitude', () => {
    expect(detectActionCandidatePoints([5])).toEqual([]);
  });

  it('returns empty when no spike > 50%', () => {
    const mags = [10, 11, 12, 11, 10];
    expect(detectActionCandidatePoints(mags)).toEqual([]);
  });

  it('detects spike when magnitude increases > 50%', () => {
    const mags = [10, 10, 20, 10];
    const result = detectActionCandidatePoints(mags);
    expect(result.length).toBe(1);
    expect(result[0].time).toBe(2);
    expect(result[0].deltaRatio).toBeCloseTo(1.0);
  });

  it('detects multiple spikes', () => {
    const mags = [1, 1, 3, 1, 5];
    const result = detectActionCandidatePoints(mags);
    expect(result.length).toBe(2);
  });

  it('handles zero previous magnitude', () => {
    const mags = [0, 5, 3];
    const result = detectActionCandidatePoints(mags);
    expect(result.length).toBe(1);
    expect(result[0].deltaRatio).toBe(Infinity);
  });

  it('boundary: exactly at threshold is not detected', () => {
    const prev = 10;
    const curr = prev * (1 + ACTION_DELTA_RATIO_THRESHOLD);
    const mags = [prev, curr];
    const result = detectActionCandidatePoints(mags);
    expect(result.length).toBe(0);
  });

  it('boundary: just above threshold is detected', () => {
    const prev = 10;
    const curr = prev * (1 + ACTION_DELTA_RATIO_THRESHOLD) + 0.01;
    const mags = [prev, curr];
    const result = detectActionCandidatePoints(mags);
    expect(result.length).toBe(1);
  });
});

describe('parseSfxMatchResponse', () => {
  it('parses valid JSON response', () => {
    const json = JSON.stringify({
      suggestions: [
        { time: 5, soundEffectCategory: 'footstep', reason: 'walking', confidence: 0.8 },
        { time: 10, soundEffectCategory: 'door', reason: 'closing', confidence: 0.7 }
      ]
    });
    const result = parseSfxMatchResponse(json);
    expect(result.length).toBe(2);
    expect(result[0].soundEffectCategory).toBe('footstep');
  });

  it('filters out low confidence suggestions', () => {
    const json = JSON.stringify({
      suggestions: [
        { time: 5, soundEffectCategory: 'footstep', reason: 'walking', confidence: 0.1 }
      ]
    });
    const result = parseSfxMatchResponse(json);
    expect(result.length).toBe(0);
  });

  it('returns empty for invalid JSON', () => {
    expect(parseSfxMatchResponse('not json')).toEqual([]);
  });

  it('returns empty for missing suggestions array', () => {
    expect(parseSfxMatchResponse('{"foo": "bar"}')).toEqual([]);
  });
});

describe('normalizeCategory', () => {
  it('normalizes footsteps to footstep', () => {
    expect(normalizeCategory('footsteps')).toBe('footstep');
  });

  it('normalizes Impact to collision', () => {
    expect(normalizeCategory('Impact')).toBe('collision');
  });

  it('normalizes swoosh to whoosh', () => {
    expect(normalizeCategory('swoosh')).toBe('whoosh');
  });

  it('preserves unknown categories', () => {
    expect(normalizeCategory('rain')).toBe('rain');
  });

  it('handles spaces and dashes', () => {
    expect(normalizeCategory('Page Turn')).toBe('page_turn');
    expect(normalizeCategory('door-open')).toBe('door');
  });
});

describe('matchLocalSfxLibrary', () => {
  const library: SfxLibraryEntry[] = [
    { id: 'sfx-1', category: 'footstep', filename: 'step.wav', duration: 0.5 },
    { id: 'sfx-2', category: 'door', filename: 'door.wav', duration: 1.0 },
    { id: 'sfx-3', category: 'collision', filename: 'hit.wav', duration: 0.3 }
  ];

  it('matches footstep category', () => {
    expect(matchLocalSfxLibrary('footstep', library)?.id).toBe('sfx-1');
  });

  it('matches with alias (impact -> collision)', () => {
    expect(matchLocalSfxLibrary('impact', library)?.id).toBe('sfx-3');
  });

  it('returns null for unmatched category', () => {
    expect(matchLocalSfxLibrary('rain', library)).toBeNull();
  });
});

describe('buildSfxSuggestions', () => {
  const library: SfxLibraryEntry[] = [
    { id: 'sfx-1', category: 'footstep', filename: 'step.wav', duration: 0.5 }
  ];

  it('builds suggestions with matched asset', () => {
    const ai: SfxAISuggestion[] = [
      { time: 5, soundEffectCategory: 'footstep', reason: 'walking', confidence: 0.9 }
    ];
    const result = buildSfxSuggestions(ai, library);
    expect(result.length).toBe(1);
    expect(result[0].matchedAssetId).toBe('sfx-1');
    expect(result[0].status).toBe('pending');
  });

  it('sets matchedAssetId to null when no match', () => {
    const ai: SfxAISuggestion[] = [
      { time: 5, soundEffectCategory: 'explosion', reason: 'boom', confidence: 0.9 }
    ];
    const result = buildSfxSuggestions(ai, library);
    expect(result[0].matchedAssetId).toBeNull();
  });
});

describe('buildSfxMatchPrompt', () => {
  it('includes scene tag and subtitle in prompt', () => {
    const prompt = buildSfxMatchPrompt([
      { time: 5, sceneTag: 'street', nearbySubtitle: 'hello' }
    ]);
    expect(prompt).toContain('5s');
    expect(prompt).toContain('street');
    expect(prompt).toContain('hello');
  });

  it('handles empty moments', () => {
    const prompt = buildSfxMatchPrompt([]);
    expect(prompt).toContain('候选时刻');
  });
});
