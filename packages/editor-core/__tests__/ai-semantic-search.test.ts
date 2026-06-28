import { describe, it, expect } from 'vitest';
import {
  buildSemanticSearchMediaPayload,
  buildSemanticSearchSystemPrompt,
  buildSemanticSearchUserPrompt,
  parseSemanticSearchResponse,
  getUnanalyzedMediaIds,
  appendSemanticSearchHistory,
  sanitizeSemanticSearchHistory,
  hasAvailableTextProvider,
  SEMANTIC_SEARCH_HISTORY_LIMIT,
  SEMANTIC_SEARCH_LARGE_LIBRARY_THRESHOLD,
  SEMANTIC_SEARCH_MAX_RESULTS,
  type SemanticSearchMediaItem,
  type SemanticSearchResult,
  type SemanticSearchHistoryEntry
} from '../src/ai-semantic-search';

describe('buildSemanticSearchMediaPayload', () => {
  it('extracts aiAnalysis fields from media items', () => {
    const media = [
      { id: 'm1', name: 'a.mp4', type: 'video', aiAnalysis: { tags: ['户外', '阳光'], scene: '公园', mood: '愉快', objects: ['树', '草'] } },
      { id: 'm2', name: 'b.mp4', type: 'video', aiAnalysis: { tags: ['室内'], scene: '办公室', mood: '专注', objects: ['电脑'] } }
    ];
    const result = buildSemanticSearchMediaPayload(media);
    expect(result).toHaveLength(2);
    expect(result[0].mediaId).toBe('m1');
    expect(result[0].aiAnalysis?.tags).toEqual(['户外', '阳光']);
    expect(result[0].aiAnalysis?.scene).toBe('公园');
    expect(result[0].aiAnalysis?.mood).toBe('愉快');
    expect(result[0].aiAnalysis?.objects).toEqual(['树', '草']);
  });

  it('falls back to filename for items without aiAnalysis', () => {
    const media = [
      { id: 'm1', name: 'sunset_beach.mp4', type: 'video' },
      { id: 'm2', name: 'office_meeting.mp4', type: 'video', aiAnalysis: { tags: ['会议'], scene: '会议室', mood: '严肃', objects: ['白板'] } }
    ];
    const result = buildSemanticSearchMediaPayload(media);
    expect(result).toHaveLength(2);
    expect(result[0].aiAnalysis?.scene).toBe('sunset_beach.mp4');
    expect(result[0].aiAnalysis?.tags).toEqual([]);
    expect(result[1].aiAnalysis?.scene).toBe('会议室');
  });

  it('filters to only aiAnalysis items when media count > 200', () => {
    const media = Array.from({ length: 201 }, (_, i) => ({
      id: `m${i}`,
      name: `file${i}.mp4`,
      type: 'video',
      ...(i % 2 === 0 ? { aiAnalysis: { tags: ['tag'], scene: 'scene', mood: 'mood', objects: [] } } : {})
    }));
    const result = buildSemanticSearchMediaPayload(media, 200);
    expect(result).toHaveLength(101);
    result.forEach((item) => {
      expect(item.aiAnalysis).toBeDefined();
    });
  });

  it('includes all items when media count <= threshold', () => {
    const media = Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`,
      name: `file${i}.mp4`,
      type: 'video'
    }));
    const result = buildSemanticSearchMediaPayload(media, 200);
    expect(result).toHaveLength(50);
  });
});

describe('buildSemanticSearchSystemPrompt', () => {
  it('returns a non-empty prompt with JSON format instructions', () => {
    const prompt = buildSemanticSearchSystemPrompt();
    expect(prompt).toContain('results');
    expect(prompt).toContain('mediaId');
    expect(prompt).toContain('score');
    expect(prompt).toContain('reason');
    expect(prompt).toContain('20');
  });
});

describe('buildSemanticSearchUserPrompt', () => {
  it('includes query and media info', () => {
    const media: SemanticSearchMediaItem[] = [
      { mediaId: 'm1', name: 'a.mp4', type: 'video', aiAnalysis: { tags: ['户外'], scene: '公园', mood: '愉快', objects: ['树'] } }
    ];
    const prompt = buildSemanticSearchUserPrompt('阳光明媚的户外场景', media);
    expect(prompt).toContain('阳光明媚的户外场景');
    expect(prompt).toContain('m1');
    expect(prompt).toContain('户外');
    expect(prompt).toContain('公园');
  });
});

describe('parseSemanticSearchResponse', () => {
  it('parses valid response and sorts by score descending', () => {
    const json = {
      results: [
        { mediaId: 'm1', score: 0.6, reason: '部分匹配' },
        { mediaId: 'm2', score: 0.9, reason: '高度匹配' },
        { mediaId: 'm3', score: 0.8, reason: '较好匹配' }
      ]
    };
    const result = parseSemanticSearchResponse(json);
    expect(result).toHaveLength(3);
    expect(result[0].mediaId).toBe('m2');
    expect(result[0].score).toBe(0.9);
    expect(result[0].reason).toBe('高度匹配');
    expect(result[1].mediaId).toBe('m3');
    expect(result[2].mediaId).toBe('m1');
  });

  it('filters out items with score 0', () => {
    const json = {
      results: [
        { mediaId: 'm1', score: 0.5, reason: '匹配' },
        { mediaId: 'm2', score: 0, reason: '不匹配' }
      ]
    };
    const result = parseSemanticSearchResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].mediaId).toBe('m1');
  });

  it('clamps score to 0-1 range', () => {
    const json = {
      results: [
        { mediaId: 'm1', score: 1.5, reason: '超过1' },
        { mediaId: 'm2', score: -0.1, reason: '低于0' }
      ]
    };
    const result = parseSemanticSearchResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(1);
  });

  it('returns empty array for invalid input', () => {
    expect(parseSemanticSearchResponse(null)).toEqual([]);
    expect(parseSemanticSearchResponse('string')).toEqual([]);
    expect(parseSemanticSearchResponse({ results: 'not-array' })).toEqual([]);
    expect(parseSemanticSearchResponse({ results: [{ mediaId: 123, score: 0.5, reason: 'bad' }] })).toEqual([]);
  });

  it('limits results to SEMANTIC_SEARCH_MAX_RESULTS', () => {
    const results = Array.from({ length: 25 }, (_, i) => ({
      mediaId: `m${i}`,
      score: 1 - i * 0.01,
      reason: `reason${i}`
    }));
    const parsed = parseSemanticSearchResponse({ results });
    expect(parsed).toHaveLength(SEMANTIC_SEARCH_MAX_RESULTS);
  });
});

describe('getUnanalyzedMediaIds', () => {
  it('returns ids of media without aiAnalysis not in result set', () => {
    const allMedia = [
      { id: 'm1', aiAnalysis: { tags: [], scene: 's', mood: 'm', objects: [] } },
      { id: 'm2' },
      { id: 'm3' },
      { id: 'm4', aiAnalysis: { tags: [], scene: 's', mood: 'm', objects: [] } }
    ];
    const resultIds = new Set(['m1']);
    const unanalyzed = getUnanalyzedMediaIds(allMedia, resultIds);
    expect(unanalyzed).toEqual(['m2', 'm3']);
  });

  it('returns empty when all media have aiAnalysis', () => {
    const allMedia = [
      { id: 'm1', aiAnalysis: { tags: [], scene: 's', mood: 'm', objects: [] } }
    ];
    expect(getUnanalyzedMediaIds(allMedia, new Set())).toEqual([]);
  });

  it('returns empty when all unanalyzed are already in results', () => {
    const allMedia = [{ id: 'm1' }];
    expect(getUnanalyzedMediaIds(allMedia, new Set(['m1']))).toEqual([]);
  });
});

describe('appendSemanticSearchHistory', () => {
  it('prepends new entry to history', () => {
    const existing: SemanticSearchHistoryEntry[] = [
      { query: '旧查询', timestamp: 1000, resultCount: 5 }
    ];
    const result = appendSemanticSearchHistory(existing, { query: '新查询', timestamp: 2000, resultCount: 3 });
    expect(result[0].query).toBe('新查询');
    expect(result[1].query).toBe('旧查询');
  });

  it('deduplicates by query (case-insensitive)', () => {
    const existing: SemanticSearchHistoryEntry[] = [
      { query: '户外场景', timestamp: 1000, resultCount: 5 }
    ];
    const result = appendSemanticSearchHistory(existing, { query: '户外场景', timestamp: 2000, resultCount: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(2000);
  });

  it('limits to SEMANTIC_SEARCH_HISTORY_LIMIT entries', () => {
    const existing: SemanticSearchHistoryEntry[] = Array.from(
      { length: SEMANTIC_SEARCH_HISTORY_LIMIT },
      (_, i) => ({ query: `query${i}`, timestamp: i, resultCount: 1 })
    );
    const result = appendSemanticSearchHistory(existing, { query: 'new', timestamp: 9999, resultCount: 1 });
    expect(result).toHaveLength(SEMANTIC_SEARCH_HISTORY_LIMIT);
    expect(result[0].query).toBe('new');
  });

  it('skips empty query entries', () => {
    const result = appendSemanticSearchHistory([], { query: '', timestamp: 1000, resultCount: 0 });
    expect(result).toHaveLength(0);
  });
});

describe('sanitizeSemanticSearchHistory', () => {
  it('returns empty for non-array input', () => {
    expect(sanitizeSemanticSearchHistory(null)).toEqual([]);
    expect(sanitizeSemanticSearchHistory('string')).toEqual([]);
    expect(sanitizeSemanticSearchHistory(123)).toEqual([]);
  });

  it('filters out entries with empty query', () => {
    const input = [{ query: '', timestamp: 1000, resultCount: 1 }, { query: 'valid', timestamp: 2000, resultCount: 2 }];
    const result = sanitizeSemanticSearchHistory(input);
    expect(result).toHaveLength(1);
    expect(result[0].query).toBe('valid');
  });

  it('limits entries to SEMANTIC_SEARCH_HISTORY_LIMIT', () => {
    const input = Array.from({ length: 15 }, (_, i) => ({ query: `q${i}`, timestamp: i, resultCount: 1 }));
    expect(sanitizeSemanticSearchHistory(input)).toHaveLength(SEMANTIC_SEARCH_HISTORY_LIMIT);
  });
});

describe('hasAvailableTextProvider', () => {
  it('returns true when a provider is enabled with apiKey', () => {
    const providers = [
      { enabled: true, apiKey: 'sk-test', isBuiltIn: true, id: 'openai' }
    ];
    expect(hasAvailableTextProvider(providers)).toBe(true);
  });

  it('returns true for ollama without apiKey', () => {
    const providers = [
      { enabled: true, isBuiltIn: true, id: 'ollama' }
    ];
    expect(hasAvailableTextProvider(providers)).toBe(true);
  });

  it('returns false when all providers are disabled', () => {
    const providers = [
      { enabled: false, apiKey: 'sk-test', isBuiltIn: true, id: 'openai' }
    ];
    expect(hasAvailableTextProvider(providers)).toBe(false);
  });

  it('returns false when no provider has apiKey', () => {
    const providers = [
      { enabled: true, isBuiltIn: true, id: 'openai' }
    ];
    expect(hasAvailableTextProvider(providers)).toBe(false);
  });

  it('returns false for empty providers', () => {
    expect(hasAvailableTextProvider([])).toBe(false);
  });
});
