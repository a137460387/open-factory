import { describe, it, expect } from 'vitest';
import {
  detectCoverageGaps,
  matchKeywords,
  calculateCharOverlap,
  parseBrollAiResponse,
  createBrollSuggestions,
  normalizeBrollSuggestions
} from '../src/ai-broll-suggestion';

describe('detectCoverageGaps', () => {
  it('returns empty for no segments', () => {
    expect(detectCoverageGaps([], [])).toEqual([]);
  });

  it('filters out segments shorter than minDuration', () => {
    const segments = [{ id: 's1', start: 0, end: 2, text: '短' }];
    expect(detectCoverageGaps(segments, [], 3)).toEqual([]);
  });

  it('detects gap when no broll coverage', () => {
    const segments = [{ id: 's1', start: 0, end: 5, text: '长字幕片段' }];
    const gaps = detectCoverageGaps(segments, [], 3);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].segmentId).toBe('s1');
    expect(gaps[0].duration).toBe(5);
  });

  it('does not detect gap when broll covers segment', () => {
    const segments = [{ id: 's1', start: 0, end: 5, text: '长字幕片段' }];
    const broll = [{ start: 0, end: 5 }];
    expect(detectCoverageGaps(segments, broll, 3)).toEqual([]);
  });

  it('detects gap when broll does not overlap segment', () => {
    const segments = [{ id: 's1', start: 0, end: 10, text: '很长的字幕片段' }];
    const broll = [{ start: 12, end: 15 }];
    const gaps = detectCoverageGaps(segments, broll, 3);
    expect(gaps).toHaveLength(1);
  });

  it('uses custom minDuration', () => {
    const segments = [{ id: 's1', start: 0, end: 2, text: '短' }];
    expect(detectCoverageGaps(segments, [], 1)).toHaveLength(1);
  });
});

describe('matchKeywords', () => {
  it('returns empty for empty text', () => {
    expect(matchKeywords('', ['tag'])).toEqual([]);
  });

  it('returns empty for empty tags', () => {
    expect(matchKeywords('hello', [])).toEqual([]);
  });

  it('matches exact substring', () => {
    expect(matchKeywords('户外阳光明媚', ['阳光', '雨天'])).toEqual(['阳光']);
  });

  it('matches case-insensitive substring', () => {
    expect(matchKeywords('Hello World', ['hello'])).toEqual(['hello']);
  });

  it('matches fuzzy via char overlap', () => {
    const result = matchKeywords('abc', ['abd'], 0.5);
    expect(result).toEqual(['abd']);
  });

  it('does not match when below threshold', () => {
    const result = matchKeywords('xyz', ['abc'], 0.9);
    expect(result).toEqual([]);
  });

  it('matches multiple tags', () => {
    const result = matchKeywords('户外阳光森林', ['阳光', '森林', '海洋']);
    expect(result).toEqual(['阳光', '森林']);
  });
});

describe('calculateCharOverlap', () => {
  it('returns 0 for empty strings', () => {
    expect(calculateCharOverlap('', 'abc')).toBe(0);
    expect(calculateCharOverlap('abc', '')).toBe(0);
  });

  it('returns 1 for identical strings', () => {
    expect(calculateCharOverlap('abc', 'abc')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(calculateCharOverlap('abc', 'xyz')).toBe(0);
  });

  it('calculates correct overlap', () => {
    expect(calculateCharOverlap('abc', 'abd')).toBe(2 / 4);
  });
});

describe('parseBrollAiResponse', () => {
  it('returns empty for null', () => {
    expect(parseBrollAiResponse(null)).toEqual({ suggestions: [] });
  });

  it('returns empty for non-object', () => {
    expect(parseBrollAiResponse('string')).toEqual({ suggestions: [] });
  });

  it('parses valid response', () => {
    const input = {
      suggestions: [
        { segmentId: 's1', mediaId: 'm1', insertTime: 1.5, reason: '匹配关键词', confidence: 0.8 }
      ]
    };
    const result = parseBrollAiResponse(input);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].segmentId).toBe('s1');
    expect(result.suggestions[0].confidence).toBe(0.8);
  });

  it('filters out invalid items', () => {
    const input = {
      suggestions: [
        { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'ok', confidence: 0.5 },
        { invalid: true },
        null
      ]
    };
    const result = parseBrollAiResponse(input);
    expect(result.suggestions).toHaveLength(1);
  });

  it('clamps confidence to 0-1', () => {
    const input = {
      suggestions: [
        { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'test', confidence: 1.5 }
      ]
    };
    const result = parseBrollAiResponse(input);
    expect(result.suggestions[0].confidence).toBe(1);
  });

  it('handles missing suggestions array', () => {
    expect(parseBrollAiResponse({ other: true })).toEqual({ suggestions: [] });
  });
});

describe('createBrollSuggestions', () => {
  it('creates suggestions with pending status', () => {
    const response = {
      suggestions: [
        { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'test', confidence: 0.8 }
      ]
    };
    const result = createBrollSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
  });
});

describe('normalizeBrollSuggestions', () => {
  it('returns undefined for non-array', () => {
    expect(normalizeBrollSuggestions(undefined)).toBeUndefined();
    expect(normalizeBrollSuggestions(null)).toBeUndefined();
    expect(normalizeBrollSuggestions('string')).toBeUndefined();
  });

  it('normalizes valid items', () => {
    const input = [
      { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'test', confidence: 0.8, status: 'accepted' }
    ];
    const result = normalizeBrollSuggestions(input);
    expect(result).toHaveLength(1);
    expect(result![0].status).toBe('accepted');
  });

  it('defaults invalid status to pending', () => {
    const input = [
      { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'test', confidence: 0.5, status: 'invalid' }
    ];
    const result = normalizeBrollSuggestions(input);
    expect(result![0].status).toBe('pending');
  });

  it('filters out invalid items', () => {
    const input = [
      { segmentId: 's1', mediaId: 'm1', insertTime: 1, reason: 'test', confidence: 0.5, status: 'pending' },
      { invalid: true }
    ];
    const result = normalizeBrollSuggestions(input);
    expect(result).toHaveLength(1);
  });
});
