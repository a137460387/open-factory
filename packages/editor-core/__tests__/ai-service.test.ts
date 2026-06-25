import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PROVIDER_PRESETS,
  FILLER_WORDS_ZH,
  VISION_KEYWORDS,
  calculateExtractFrameTimes,
  calculateSubtitlePolishBatchSplit,
  createAllBuiltInProviders,
  createBuiltInProvider,
  estimateVisionCost,
  formatChaptersBilibili,
  formatChaptersYouTube,
  isProviderConfigured,
  isVisionCapable,
  mergeAITags,
  normalizeAIProvider,
  parseChapterResponse,
  parseSubtitlePolishResponse,
  parseVisionAnalysisResponse,
  removeFillerWords,
  splitChapterSegments,
  suggestChapterCount
} from '../src/ai-service';

describe('AI provider presets', () => {
  it('has 15 built-in presets', () => {
    expect(BUILT_IN_PROVIDER_PRESETS).toHaveLength(15);
  });

  it('creates all built-in providers', () => {
    const providers = createAllBuiltInProviders();
    expect(providers).toHaveLength(15);
    expect(providers[0].id).toBe('openai');
    expect(providers[14].id).toBe('ollama');
  });

  it('creates built-in provider from preset', () => {
    const provider = createBuiltInProvider(BUILT_IN_PROVIDER_PRESETS[0]);
    expect(provider.id).toBe('openai');
    expect(provider.protocol).toBe('openai-compatible');
    expect(provider.isBuiltIn).toBe(true);
  });
});

describe('normalizeAIProvider', () => {
  it('normalizes provider with defaults', () => {
    const provider = normalizeAIProvider({ id: 'test' });
    expect(provider.id).toBe('test');
    expect(provider.name).toBe('test');
    expect(provider.protocol).toBe('openai-compatible');
    expect(provider.defaultModel).toBe('gpt-4o');
    expect(provider.enabled).toBe(true);
    expect(provider.isBuiltIn).toBe(false);
  });

  it('normalizes provider with custom values', () => {
    const provider = normalizeAIProvider({
      id: 'custom',
      name: 'Custom Provider',
      protocol: 'custom',
      baseUrl: 'https://custom.api.com/v1',
      defaultModel: 'custom-model',
      enabled: false,
      isBuiltIn: true
    });
    expect(provider.id).toBe('custom');
    expect(provider.name).toBe('Custom Provider');
    expect(provider.protocol).toBe('custom');
    expect(provider.baseUrl).toBe('https://custom.api.com/v1');
    expect(provider.defaultModel).toBe('custom-model');
    expect(provider.enabled).toBe(false);
    expect(provider.isBuiltIn).toBe(true);
  });
});

describe('isVisionCapable', () => {
  it('detects vision keywords in model names', () => {
    expect(isVisionCapable('gpt-4o')).toBe(true);
    expect(isVisionCapable('gpt-4o-mini')).toBe(true);
    expect(isVisionCapable('claude-3-opus')).toBe(true);
    expect(isVisionCapable('gemini-pro-vision')).toBe(true);
    expect(isVisionCapable('qwen-vl-plus')).toBe(true);
    expect(isVisionCapable('glm-4v')).toBe(true);
    expect(isVisionCapable('llama-3.3-70b')).toBe(false);
    expect(isVisionCapable('deepseek-chat')).toBe(false);
  });
});

describe('isProviderConfigured', () => {
  it('returns false when disabled', () => {
    const provider = normalizeAIProvider({ id: 'test', enabled: false, apiKey: 'key' });
    expect(isProviderConfigured(provider)).toBe(false);
  });

  it('returns false when no key for non-ollama', () => {
    const provider = normalizeAIProvider({ id: 'openai', enabled: true, apiKey: '' });
    expect(isProviderConfigured(provider)).toBe(false);
  });

  it('returns true when key present', () => {
    const provider = normalizeAIProvider({ id: 'openai', enabled: true, apiKey: 'sk-test' });
    expect(isProviderConfigured(provider)).toBe(true);
  });

  it('returns true for ollama without key', () => {
    const provider = normalizeAIProvider({ id: 'ollama', enabled: true });
    expect(isProviderConfigured(provider)).toBe(true);
  });
});

describe('calculateSubtitlePolishBatchSplit', () => {
  it('splits 51 items into 2 batches', () => {
    const batches = calculateSubtitlePolishBatchSplit(51);
    expect(batches).toEqual([50, 1]);
  });

  it('handles 0 items', () => {
    expect(calculateSubtitlePolishBatchSplit(0)).toEqual([]);
  });

  it('handles exact batch size', () => {
    expect(calculateSubtitlePolishBatchSplit(50)).toEqual([50]);
  });

  it('handles small count', () => {
    expect(calculateSubtitlePolishBatchSplit(5)).toEqual([5]);
  });
});

describe('parseSubtitlePolishResponse', () => {
  it('parses valid JSON array', () => {
    const result = parseSubtitlePolishResponse([{ index: 0, text: '你好世界' }, { index: 1, text: '测试文本' }]);
    expect(result).toEqual([{ index: 0, text: '你好世界' }, { index: 1, text: '测试文本' }]);
  });

  it('filters invalid entries', () => {
    const result = parseSubtitlePolishResponse([{ index: 0, text: '有效' }, { index: 'bad', text: 123 }, null, { index: 1, text: '' }]);
    expect(result).toEqual([{ index: 0, text: '有效' }]);
  });

  it('handles non-array input', () => {
    expect(parseSubtitlePolishResponse('not array')).toEqual([]);
    expect(parseSubtitlePolishResponse(null)).toEqual([]);
  });
});

describe('removeFillerWords', () => {
  it('removes 嗯 filler word', () => {
    expect(removeFillerWords('嗯，你好')).toBe('你好');
  });

  it('removes 啊 filler word', () => {
    expect(removeFillerWords('你好啊，世界')).toBe('你好，世界');
  });

  it('removes 那个 filler word', () => {
    expect(removeFillerWords('那个，我想说')).toBe('我想说');
  });

  it('removes 就是 filler word', () => {
    expect(removeFillerWords('就是，这个')).toBe('这个');
  });

  it('removes 然后 filler word', () => {
    expect(removeFillerWords('然后，我们开始')).toBe('我们开始');
  });

  it('preserves text without fillers', () => {
    expect(removeFillerWords('你好世界')).toBe('你好世界');
  });
});

describe('splitChapterSegments', () => {
  it('splits 120s into 2 segments', () => {
    const segments = splitChapterSegments(120);
    expect(segments).toHaveLength(2);
    expect(segments[0].start).toBe(0);
    expect(segments[0].end).toBe(60);
    expect(segments[1].start).toBe(60);
    expect(segments[1].end).toBe(120);
  });

  it('returns empty for 0 duration', () => {
    expect(splitChapterSegments(0)).toEqual([]);
  });

  it('handles 30s video', () => {
    const segments = splitChapterSegments(30);
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBe(0);
    expect(segments[0].end).toBe(30);
  });
});

describe('suggestChapterCount', () => {
  it('suggests 3-5 for 5min video', () => {
    expect(suggestChapterCount(300)).toEqual({ min: 3, max: 5 });
  });

  it('suggests 5-8 for 10min video', () => {
    expect(suggestChapterCount(600)).toEqual({ min: 5, max: 8 });
  });

  it('suggests 8-12 for 30min video', () => {
    expect(suggestChapterCount(1800)).toEqual({ min: 8, max: 12 });
  });

  it('suggests 12-20 for 60min video', () => {
    expect(suggestChapterCount(3600)).toEqual({ min: 12, max: 20 });
  });

  it('suggests 15-30 for 120min video', () => {
    expect(suggestChapterCount(7200)).toEqual({ min: 15, max: 30 });
  });

  it('returns 0-0 for 0 duration', () => {
    expect(suggestChapterCount(0)).toEqual({ min: 0, max: 0 });
  });
});

describe('parseChapterResponse', () => {
  it('parses valid chapters', () => {
    const result = parseChapterResponse([{ time: 0, title: '介绍' }, { time: 60, title: '第一章' }]);
    expect(result).toEqual([{ time: 0, title: '介绍' }, { time: 60, title: '第一章' }]);
  });

  it('truncates long titles to 15 chars', () => {
    const result = parseChapterResponse([{ time: 0, title: '这是一个非常非常非常非常非常长的标题' }]);
    expect(result[0].title).toHaveLength(15);
  });

  it('filters invalid entries', () => {
    const result = parseChapterResponse([{ time: 'bad', title: 123 }, null, { time: 0, title: '' }]);
    expect(result).toEqual([]);
  });
});

describe('formatChaptersYouTube', () => {
  it('formats chapters in YouTube format', () => {
    const result = formatChaptersYouTube([{ time: 0, title: '介绍' }, { time: 65, title: '第一章' }]);
    expect(result).toBe('0:00 介绍\n1:05 第一章');
  });
});

describe('formatChaptersBilibili', () => {
  it('formats chapters in Bilibili format', () => {
    const result = formatChaptersBilibili([{ time: 0, title: '介绍' }, { time: 125, title: '第二章' }]);
    expect(result).toBe('0:00 介绍\n2:05 第二章');
  });
});

describe('calculateExtractFrameTimes', () => {
  it('calculates 5 frames for 30s video', () => {
    const times = calculateExtractFrameTimes(30);
    expect(times).toHaveLength(5);
    expect(times[0]).toBeCloseTo(5, 0);
    expect(times[4]).toBeCloseTo(25, 0);
  });

  it('limits frames based on duration', () => {
    const times = calculateExtractFrameTimes(10);
    expect(times).toHaveLength(1);
  });

  it('returns empty for 0 duration', () => {
    expect(calculateExtractFrameTimes(0)).toEqual([]);
  });
});

describe('parseVisionAnalysisResponse', () => {
  it('parses valid response', () => {
    const result = parseVisionAnalysisResponse({
      tags: ['室内', '办公'],
      scene: '办公室场景',
      mood: '专注',
      objects: ['电脑', '桌子']
    });
    expect(result.tags).toEqual(['室内', '办公']);
    expect(result.scene).toBe('办公室场景');
    expect(result.mood).toBe('专注');
    expect(result.objects).toEqual(['电脑', '桌子']);
  });

  it('handles missing fields', () => {
    const result = parseVisionAnalysisResponse({});
    expect(result.tags).toEqual([]);
    expect(result.scene).toBe('');
    expect(result.mood).toBe('');
    expect(result.objects).toEqual([]);
  });

  it('handles non-object input', () => {
    expect(parseVisionAnalysisResponse(null)).toEqual({ tags: [], scene: '', mood: '', objects: [] });
    expect(parseVisionAnalysisResponse('string')).toEqual({ tags: [], scene: '', mood: '', objects: [] });
  });
});

describe('mergeAITags', () => {
  it('merges tags without duplicates', () => {
    expect(mergeAITags(['室内', '办公'], ['办公', '安静'])).toEqual(['室内', '办公', '安静']);
  });

  it('handles case-insensitive dedup', () => {
    expect(mergeAITags(['Office'], ['office', 'OFFICE'])).toEqual(['Office']);
  });

  it('appends all when no overlap', () => {
    expect(mergeAITags(['A'], ['B', 'C'])).toEqual(['A', 'B', 'C']);
  });
});

describe('estimateVisionCost', () => {
  it('estimates cost for gpt-4o', () => {
    const result = estimateVisionCost(5, 'gpt-4o');
    expect(result.tokens).toBe(4500);
    expect(result.costCny).toBeGreaterThan(0);
  });

  it('estimates cost for gemini', () => {
    const result = estimateVisionCost(3, 'gemini-pro');
    expect(result.tokens).toBe(2900);
    expect(result.costCny).toBeGreaterThan(0);
  });

  it('uses default cost for unknown model', () => {
    const result = estimateVisionCost(2, 'unknown-model');
    expect(result.tokens).toBe(2100);
    expect(result.costCny).toBeGreaterThan(0);
  });
});
