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
  parseColorGradingSuggestionResponse,
  buildColorGradingColorCorrectionPatch,
  mapColorParameterToColorCorrection,
  COLOR_GRADING_PARAMETER_LIMITS,
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
  suggestChapterCount,
  buildMediaInfoForAI,
  parseRoughCutAIResponse,
  buildRoughCutSystemPrompt,
  buildRoughCutUserPrompt,
  ROUGH_CUT_TEMPLATES,
  buildTtsEndpoint,
  buildTtsRequestBody,
  generateTtsCacheKey,
  detectTtsEngine,
  buildExportProjectInfo,
  buildExportOptimizationSystemPrompt,
  buildExportOptimizationUserPrompt,
  parseExportOptimizationResponse,
  sortExportSuggestionsByPriority,
  EXPORT_SUGGESTION_CACHE_TTL_MS
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

describe('COLOR_GRADING_PARAMETER_LIMITS', () => {
  it('has limits for all 10 parameters', () => {
    const expected = ['brightness', 'contrast', 'saturation', 'hue', 'lift_r', 'lift_g', 'lift_b', 'gain_r', 'gain_g', 'gain_b'];
    for (const param of expected) {
      expect(COLOR_GRADING_PARAMETER_LIMITS[param]).toBeDefined();
      expect(typeof COLOR_GRADING_PARAMETER_LIMITS[param].min).toBe('number');
      expect(typeof COLOR_GRADING_PARAMETER_LIMITS[param].max).toBe('number');
    }
  });

  it('brightness range is -1 to 1', () => {
    expect(COLOR_GRADING_PARAMETER_LIMITS.brightness).toEqual({ min: -1, max: 1 });
  });

  it('contrast range is 0 to 2', () => {
    expect(COLOR_GRADING_PARAMETER_LIMITS.contrast).toEqual({ min: 0, max: 2 });
  });

  it('hue range is -180 to 180', () => {
    expect(COLOR_GRADING_PARAMETER_LIMITS.hue).toEqual({ min: -180, max: 180 });
  });
});

describe('mapColorParameterToColorCorrection', () => {
  it('maps brightness to { brightness }', () => {
    expect(mapColorParameterToColorCorrection('brightness', 0.5)).toEqual({ brightness: 0.5 });
  });

  it('maps contrast to { contrast }', () => {
    expect(mapColorParameterToColorCorrection('contrast', 1.2)).toEqual({ contrast: 1.2 });
  });

  it('maps saturation to { saturation }', () => {
    expect(mapColorParameterToColorCorrection('saturation', 0.8)).toEqual({ saturation: 0.8 });
  });

  it('maps hue to { hue }', () => {
    expect(mapColorParameterToColorCorrection('hue', 30)).toEqual({ hue: 30 });
  });

  it('maps lift_r to threeWayColor.lift.r', () => {
    expect(mapColorParameterToColorCorrection('lift_r', 0.3)).toEqual({ threeWayColor: { lift: { r: 0.3 } } });
  });

  it('maps lift_g to threeWayColor.lift.g', () => {
    expect(mapColorParameterToColorCorrection('lift_g', -0.2)).toEqual({ threeWayColor: { lift: { g: -0.2 } } });
  });

  it('maps lift_b to threeWayColor.lift.b', () => {
    expect(mapColorParameterToColorCorrection('lift_b', 0.1)).toEqual({ threeWayColor: { lift: { b: 0.1 } } });
  });

  it('maps gain_r to threeWayColor.gain.r', () => {
    expect(mapColorParameterToColorCorrection('gain_r', 0.4)).toEqual({ threeWayColor: { gain: { r: 0.4 } } });
  });

  it('maps gain_g to threeWayColor.gain.g', () => {
    expect(mapColorParameterToColorCorrection('gain_g', -0.1)).toEqual({ threeWayColor: { gain: { g: -0.1 } } });
  });

  it('maps gain_b to threeWayColor.gain.b', () => {
    expect(mapColorParameterToColorCorrection('gain_b', 0.6)).toEqual({ threeWayColor: { gain: { b: 0.6 } } });
  });

  it('returns null for unknown parameter', () => {
    expect(mapColorParameterToColorCorrection('unknown', 1)).toBeNull();
  });
});

describe('parseColorGradingSuggestionResponse', () => {
  it('parses a valid response', () => {
    const input = {
      style: 'cinematic',
      issues: ['偏暗', '饱和度不足'],
      suggestions: [
        { parameter: 'brightness', currentValue: 0, recommendedValue: 0.2, reason: '画面偏暗' },
        { parameter: 'saturation', currentValue: 1, recommendedValue: 1.3, reason: '色彩偏淡' }
      ]
    };
    const result = parseColorGradingSuggestionResponse(input);
    expect(result).not.toBeNull();
    expect(result!.style).toBe('cinematic');
    expect(result!.issues).toEqual(['偏暗', '饱和度不足']);
    expect(result!.suggestions).toHaveLength(2);
    expect(result!.suggestions[0].parameter).toBe('brightness');
    expect(result!.suggestions[0].recommendedValue).toBe(0.2);
    expect(result!.suggestions[1].parameter).toBe('saturation');
  });

  it('returns null for non-object input', () => {
    expect(parseColorGradingSuggestionResponse(null)).toBeNull();
    expect(parseColorGradingSuggestionResponse('string')).toBeNull();
    expect(parseColorGradingSuggestionResponse(42)).toBeNull();
  });

  it('returns null when suggestions is not an array', () => {
    expect(parseColorGradingSuggestionResponse({ style: 'test', issues: [], suggestions: 'bad' })).toBeNull();
  });

  it('returns null when suggestions is empty', () => {
    expect(parseColorGradingSuggestionResponse({ style: 'test', issues: [], suggestions: [] })).toBeNull();
  });

  it('filters out entries with unknown parameter names', () => {
    const input = {
      style: '',
      issues: [],
      suggestions: [
        { parameter: 'brightness', recommendedValue: 0.5, reason: '' },
        { parameter: 'unknown_param', recommendedValue: 1, reason: '' }
      ]
    };
    const result = parseColorGradingSuggestionResponse(input);
    expect(result).not.toBeNull();
    expect(result!.suggestions).toHaveLength(1);
    expect(result!.suggestions[0].parameter).toBe('brightness');
  });

  it('clamps out-of-range values', () => {
    const input = {
      style: '',
      issues: [],
      suggestions: [
        { parameter: 'brightness', recommendedValue: 5, reason: '' },
        { parameter: 'contrast', recommendedValue: -1, reason: '' }
      ]
    };
    const result = parseColorGradingSuggestionResponse(input);
    expect(result).not.toBeNull();
    expect(result!.suggestions[0].recommendedValue).toBe(1);
    expect(result!.suggestions[1].recommendedValue).toBe(0);
  });

  it('filters out entries with non-finite recommendedValue', () => {
    const input = {
      style: '',
      issues: [],
      suggestions: [
        { parameter: 'brightness', recommendedValue: NaN, reason: '' }
      ]
    };
    expect(parseColorGradingSuggestionResponse(input)).toBeNull();
  });
});

describe('buildColorGradingColorCorrectionPatch', () => {
  it('builds patch for basic parameters', () => {
    const items = [
      { parameter: 'brightness', recommendedValue: 0.3 },
      { parameter: 'contrast', recommendedValue: 1.2 },
      { parameter: 'saturation', recommendedValue: 1.1 },
      { parameter: 'hue', recommendedValue: 10 }
    ];
    const patch = buildColorGradingColorCorrectionPatch(items);
    expect(patch).toEqual({ brightness: 0.3, contrast: 1.2, saturation: 1.1, hue: 10 });
  });

  it('builds patch for three-way color parameters', () => {
    const items = [
      { parameter: 'lift_r', recommendedValue: 0.2 },
      { parameter: 'gain_b', recommendedValue: -0.3 }
    ];
    const patch = buildColorGradingColorCorrectionPatch(items);
    expect(patch).toEqual({
      threeWayColor: {
        lift: { r: 0.2 },
        gain: { b: -0.3 }
      }
    });
  });

  it('builds patch for mixed basic and three-way parameters', () => {
    const items = [
      { parameter: 'brightness', recommendedValue: 0.1 },
      { parameter: 'lift_r', recommendedValue: -0.1 },
      { parameter: 'gain_g', recommendedValue: 0.3 }
    ];
    const patch = buildColorGradingColorCorrectionPatch(items);
    expect(patch).toEqual({
      brightness: 0.1,
      threeWayColor: {
        lift: { r: -0.1 },
        gain: { g: 0.3 }
      }
    });
  });

  it('returns null for empty array', () => {
    expect(buildColorGradingColorCorrectionPatch([])).toBeNull();
  });

  it('returns null when all items map to unknown parameters', () => {
    expect(buildColorGradingColorCorrectionPatch([{ parameter: 'unknown', recommendedValue: 1 }])).toBeNull();
  });
});

describe('AI rough cut', () => {
  it('buildMediaInfoForAI maps media with aiAnalysis', () => {
    const result = buildMediaInfoForAI([
      { id: 'm1', name: 'a.mp4', type: 'video', duration: 10, aiAnalysis: { tags: ['产品'], scene: '展示', mood: '专业' } },
      { id: 'm2', name: 'b.mp4', type: 'video', duration: 5 }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ mediaId: 'm1', filename: 'a.mp4', tags: ['产品'], scene: '展示', mood: '专业' });
    expect(result[1]).toMatchObject({ mediaId: 'm2', filename: 'b.mp4', tags: undefined, scene: undefined, mood: undefined });
  });

  it('parseRoughCutAIResponse parses valid array', () => {
    const result = parseRoughCutAIResponse([
      { mediaId: 'm1', startTime: 0, duration: 3, trackIndex: 0, reason: 'good' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mediaId: 'm1', duration: 3, trackIndex: 0, reason: 'good' });
  });

  it('parseRoughCutAIResponse filters invalid entries', () => {
    const result = parseRoughCutAIResponse([
      { mediaId: 'm1', startTime: 0, duration: 3, trackIndex: 0, reason: 'good' },
      { mediaId: 123, duration: 2 },
      null,
      { mediaId: '', duration: 1 },
      'not an object'
    ]);
    expect(result).toHaveLength(1);
  });

  it('parseRoughCutAIResponse returns empty for non-array', () => {
    expect(parseRoughCutAIResponse('bad')).toEqual([]);
    expect(parseRoughCutAIResponse(null)).toEqual([]);
    expect(parseRoughCutAIResponse({})).toEqual([]);
  });

  it('parseRoughCutAIResponse clamps negative startTime and duration', () => {
    const result = parseRoughCutAIResponse([
      { mediaId: 'm1', startTime: -5, duration: -2, trackIndex: -1, reason: '' }
    ]);
    expect(result[0].startTime).toBe(0);
    expect(result[0].duration).toBeGreaterThanOrEqual(0.1);
    expect(result[0].trackIndex).toBe(0);
  });

  it('buildRoughCutSystemPrompt contains 粗剪', () => {
    const prompt = buildRoughCutSystemPrompt();
    expect(prompt).toContain('粗剪');
    expect(prompt).toContain('mediaId');
  });

  it('buildRoughCutUserPrompt includes description and media info', () => {
    const prompt = buildRoughCutUserPrompt('产品介绍', [
      { mediaId: 'm1', filename: 'a.mp4', type: 'video', duration: 10, tags: ['产品'], scene: '展示', mood: '专业' }
    ]);
    expect(prompt).toContain('产品介绍');
    expect(prompt).toContain('a.mp4');
    expect(prompt).toContain('产品');
  });

  it('ROUGH_CUT_TEMPLATES has templates with segments', () => {
    expect(ROUGH_CUT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const tpl of ROUGH_CUT_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.segments.length).toBeGreaterThan(0);
      for (const seg of tpl.segments) {
        expect(seg.label).toBeTruthy();
        expect(seg.defaultDuration).toBeGreaterThan(0);
      }
    }
  });
});

describe('TTS endpoint building', () => {
  it('builds ElevenLabs endpoint with voiceId in path', () => {
    const url = buildTtsEndpoint({
      providerId: 'elevenlabs',
      baseUrl: 'https://api.elevenlabs.io/v1',
      engine: 'elevenlabs',
      voiceId: 'abc-123',
      speed: 1.0
    });
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc-123');
  });

  it('URL-encodes voiceId for ElevenLabs', () => {
    const url = buildTtsEndpoint({
      providerId: 'elevenlabs',
      baseUrl: 'https://api.elevenlabs.io/v1',
      engine: 'elevenlabs',
      voiceId: 'voice/id+test',
      speed: 1.0
    });
    expect(url).toContain('text-to-speech/voice%2Fid%2Btest');
  });

  it('builds OpenAI TTS endpoint', () => {
    const url = buildTtsEndpoint({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      engine: 'openai',
      voiceId: 'alloy',
      speed: 1.0
    });
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
  });

  it('builds compatible TTS endpoint like OpenAI', () => {
    const url = buildTtsEndpoint({
      providerId: 'custom',
      baseUrl: 'https://my-tts.example.com/v1',
      engine: 'compatible',
      voiceId: 'speaker1',
      speed: 1.0
    });
    expect(url).toBe('https://my-tts.example.com/v1/audio/speech');
  });
});

describe('TTS request body', () => {
  it('builds ElevenLabs body with voice_settings', () => {
    const body = buildTtsRequestBody('Hello world', {
      providerId: 'elevenlabs',
      baseUrl: 'https://api.elevenlabs.io/v1',
      engine: 'elevenlabs',
      voiceId: 'abc',
      speed: 1.2,
      stability: 0.7
    });
    expect(body.text).toBe('Hello world');
    expect(body.model_id).toBe('eleven_multilingual_v2');
    expect(body.voice_settings).toEqual({ stability: 0.7, speed: 1.2 });
  });

  it('builds OpenAI body with input and voice', () => {
    const body = buildTtsRequestBody('Test text', {
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      engine: 'openai',
      voiceId: 'alloy',
      speed: 1.0
    });
    expect(body.input).toBe('Test text');
    expect(body.voice).toBe('alloy');
    expect(body.model).toBe('tts-1');
    expect(body.speed).toBe(1.0);
  });
});

describe('TTS cache key generation', () => {
  it('generates deterministic hash for same input', () => {
    const config = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'abc', speed: 1.0, stability: 0.5 };
    const key1 = generateTtsCacheKey('hello', config);
    const key2 = generateTtsCacheKey('hello', config);
    expect(key1).toBe(key2);
  });

  it('generates different hash for different text', () => {
    const config = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'abc', speed: 1.0 };
    expect(generateTtsCacheKey('hello', config)).not.toBe(generateTtsCacheKey('world', config));
  });

  it('generates different hash for different voiceId', () => {
    const config1 = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'voice1', speed: 1.0 };
    const config2 = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'voice2', speed: 1.0 };
    expect(generateTtsCacheKey('hello', config1)).not.toBe(generateTtsCacheKey('hello', config2));
  });

  it('generates different hash for different speed', () => {
    const config1 = { providerId: 'openai', baseUrl: 'https://api.openai.com/v1', engine: 'openai' as const, voiceId: 'alloy', speed: 1.0 };
    const config2 = { providerId: 'openai', baseUrl: 'https://api.openai.com/v1', engine: 'openai' as const, voiceId: 'alloy', speed: 1.5 };
    expect(generateTtsCacheKey('hello', config1)).not.toBe(generateTtsCacheKey('hello', config2));
  });

  it('includes stability for ElevenLabs engine', () => {
    const config1 = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'abc', speed: 1.0, stability: 0.3 };
    const config2 = { providerId: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', engine: 'elevenlabs' as const, voiceId: 'abc', speed: 1.0, stability: 0.8 };
    expect(generateTtsCacheKey('hello', config1)).not.toBe(generateTtsCacheKey('hello', config2));
  });

  it('returns 8-char hex string', () => {
    const key = generateTtsCacheKey('test', { providerId: 'openai', baseUrl: 'https://api.openai.com/v1', engine: 'openai', voiceId: 'alloy', speed: 1.0 });
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('TTS engine detection', () => {
  it('detects ElevenLabs from URL', () => {
    expect(detectTtsEngine('https://api.elevenlabs.io/v1', 'custom')).toBe('elevenlabs');
  });

  it('detects OpenAI from URL', () => {
    expect(detectTtsEngine('https://api.openai.com/v1', 'custom')).toBe('openai');
  });

  it('detects ElevenLabs from providerId', () => {
    expect(detectTtsEngine('https://custom.api.com/v1', 'elevenlabs')).toBe('elevenlabs');
  });

  it('falls back to compatible for unknown', () => {
    expect(detectTtsEngine('https://my-tts.example.com/api', 'custom')).toBe('compatible');
  });
});

describe('AI Export Optimization - buildExportProjectInfo', () => {
  const project = {
    settings: { width: 1920, height: 1080, fps: 30 },
    timeline: {
      tracks: [
        { type: 'video', clips: [{ start: 0, duration: 5 }, { start: 5, duration: 3, effects: [{ type: 'blur' }] }] },
        { type: 'subtitle', clips: [{ start: 0, duration: 2 }] }
      ]
    }
  };

  it('returns correct project info fields', () => {
    const info = buildExportProjectInfo(project as any);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.fps).toBe(30);
    expect(info.trackCount).toBe(2);
    expect(info.clipCount).toBe(3);
    expect(info.durationSeconds).toBe(8);
    expect(info.hasSubtitle).toBe(true);
    expect(info.effectCount).toBe(1);
  });

  it('detects no subtitle when none present', () => {
    const p = { settings: project.settings, timeline: { tracks: [{ type: 'video', clips: [{ start: 0, duration: 1 }] }] } };
    expect(buildExportProjectInfo(p as any).hasSubtitle).toBe(false);
  });

  it('handles empty timeline', () => {
    const p = { settings: project.settings, timeline: { tracks: [] } };
    const info = buildExportProjectInfo(p as any);
    expect(info.clipCount).toBe(0);
    expect(info.durationSeconds).toBe(0);
    expect(info.trackCount).toBe(0);
  });
});

describe('AI Export Optimization - buildExportOptimizationSystemPrompt', () => {
  it('returns non-empty prompt mentioning video encoding', () => {
    const prompt = buildExportOptimizationSystemPrompt();
    expect(prompt).toContain('video encoding');
    expect(prompt).toContain('videoBitrate');
    expect(prompt).toContain('loudnessNormalization');
    expect(prompt).toContain('JSON array');
  });
});

describe('AI Export Optimization - buildExportOptimizationUserPrompt', () => {
  it('includes project info and preset settings in output', () => {
    const info = { durationSeconds: 60, width: 1920, height: 1080, fps: 30, trackCount: 3, effectCount: 2, hasSubtitle: true, hasHDR: false, clipCount: 10 };
    const prompt = buildExportOptimizationUserPrompt(info, { format: 'mp4', videoCodec: 'h264', videoBitrate: '8M', audioBitrate: '192k' });
    expect(prompt).toContain('60s');
    expect(prompt).toContain('1920x1080');
    expect(prompt).toContain('mp4');
    expect(prompt).toContain('h264');
    expect(prompt).toContain('8M');
    expect(prompt).toContain('Subtitles: yes');
    expect(prompt).toContain('HDR: no');
  });

  it('uses defaults when settings are empty', () => {
    const info = { durationSeconds: 10, width: 1280, height: 720, fps: 24, trackCount: 1, effectCount: 0, hasSubtitle: false, hasHDR: false, clipCount: 1 };
    const prompt = buildExportOptimizationUserPrompt(info, {});
    expect(prompt).toContain('mp4');
    expect(prompt).toContain('h264');
    expect(prompt).toContain('auto');
  });
});

describe('AI Export Optimization - parseExportOptimizationResponse', () => {
  it('parses valid suggestions', () => {
    const input = [
      { parameter: 'videoBitrate', currentValue: '2M', suggestedValue: '8M', reason: 'too low for 1080p', priority: 'high' },
      { parameter: 'fps', currentValue: '24', suggestedValue: '30', reason: 'match source', priority: 'low' }
    ];
    const result = parseExportOptimizationResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0].parameter).toBe('videoBitrate');
    expect(result[0].priority).toBe('high');
  });

  it('filters out invalid entries', () => {
    const input = [
      { parameter: 'videoBitrate', currentValue: '2M', suggestedValue: '8M', reason: 'ok', priority: 'high' },
      { parameter: 123, currentValue: 'a', suggestedValue: 'b', reason: 'c', priority: 'high' },
      null,
      { parameter: 'fps', currentValue: '24', suggestedValue: '30', reason: 'ok', priority: 'invalid' }
    ];
    const result = parseExportOptimizationResponse(input);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for non-array input', () => {
    expect(parseExportOptimizationResponse(null)).toEqual([]);
    expect(parseExportOptimizationResponse({})).toEqual([]);
    expect(parseExportOptimizationResponse('string')).toEqual([]);
  });

  it('handles empty array', () => {
    expect(parseExportOptimizationResponse([])).toEqual([]);
  });
});

describe('AI Export Optimization - sortExportSuggestionsByPriority', () => {
  it('sorts high before medium before low', () => {
    const input = [
      { parameter: 'a', currentValue: '1', suggestedValue: '2', reason: 'r', priority: 'low' as const },
      { parameter: 'b', currentValue: '1', suggestedValue: '2', reason: 'r', priority: 'high' as const },
      { parameter: 'c', currentValue: '1', suggestedValue: '2', reason: 'r', priority: 'medium' as const }
    ];
    const sorted = sortExportSuggestionsByPriority(input);
    expect(sorted[0].priority).toBe('high');
    expect(sorted[1].priority).toBe('medium');
    expect(sorted[2].priority).toBe('low');
  });

  it('does not mutate original array', () => {
    const input = [
      { parameter: 'a', currentValue: '1', suggestedValue: '2', reason: 'r', priority: 'low' as const },
      { parameter: 'b', currentValue: '1', suggestedValue: '2', reason: 'r', priority: 'high' as const }
    ];
    sortExportSuggestionsByPriority(input);
    expect(input[0].priority).toBe('low');
  });
});

describe('AI Export Optimization - EXPORT_SUGGESTION_CACHE_TTL_MS', () => {
  it('is 5 minutes', () => {
    expect(EXPORT_SUGGESTION_CACHE_TTL_MS).toBe(300_000);
  });
});

