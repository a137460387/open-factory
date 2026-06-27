import { describe, it, expect } from 'vitest';
import {
  buildSubtitleGlossarySystemPrompt,
  buildGlossaryExtractionUserPrompt,
  parseSubtitleGlossaryResponse,
  buildContextualTranslationSystemPrompt,
  parseContextualTranslationResponse,
  compareTranslationVersions,
  calculateContextualTranslationBatches
} from '../src/contextual-translation';

describe('buildSubtitleGlossarySystemPrompt', () => {
  it('returns prompt with JSON format instructions', () => {
    const prompt = buildSubtitleGlossarySystemPrompt();
    expect(prompt).toContain('terms');
    expect(prompt).toContain('original');
    expect(prompt).toContain('person');
    expect(prompt).toContain('JSON');
  });
});

describe('buildGlossaryExtractionUserPrompt', () => {
  it('includes subtitle lines with index and timecode', () => {
    const prompt = buildGlossaryExtractionUserPrompt([
      { index: 0, time: '00:00:01,000 --> 00:00:03,000', text: 'Hello World' },
      { index: 1, time: '00:00:03,000 --> 00:00:05,000', text: 'Test subtitle' }
    ]);
    expect(prompt).toContain('[0]');
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('00:00:01,000 --> 00:00:03,000');
    expect(prompt).toContain('Hello World');
    expect(prompt).toContain('Test subtitle');
  });
});

describe('parseSubtitleGlossaryResponse', () => {
  it('returns empty terms for null input', () => {
    expect(parseSubtitleGlossaryResponse(null)).toEqual({ terms: [] });
  });

  it('returns empty terms for non-object input', () => {
    expect(parseSubtitleGlossaryResponse('string')).toEqual({ terms: [] });
  });

  it('returns empty terms when terms is not an array', () => {
    expect(parseSubtitleGlossaryResponse({ terms: 'not-array' })).toEqual({ terms: [] });
  });

  it('parses valid terms', () => {
    const result = parseSubtitleGlossaryResponse({
      terms: [
        { original: 'OpenAI', type: 'organization' },
        { original: 'John', type: 'person', translation: '约翰' }
      ]
    });
    expect(result.terms).toHaveLength(2);
    expect(result.terms[0].original).toBe('OpenAI');
    expect(result.terms[0].type).toBe('organization');
    expect(result.terms[1].translation).toBe('约翰');
  });

  it('defaults invalid type to other', () => {
    const result = parseSubtitleGlossaryResponse({
      terms: [{ original: 'test', type: 'invalid-type' }]
    });
    expect(result.terms[0].type).toBe('other');
  });

  it('defaults missing type to other', () => {
    const result = parseSubtitleGlossaryResponse({
      terms: [{ original: 'test' }]
    });
    expect(result.terms[0].type).toBe('other');
  });

  it('skips entries with missing original', () => {
    const result = parseSubtitleGlossaryResponse({
      terms: [
        { type: 'person' },
        { original: '', type: 'person' },
        { original: 'valid', type: 'product' }
      ]
    });
    expect(result.terms).toHaveLength(1);
    expect(result.terms[0].original).toBe('valid');
  });

  it('skips non-object entries in terms array', () => {
    const result = parseSubtitleGlossaryResponse({
      terms: [null, 123, { original: 'ok', type: 'place' }]
    });
    expect(result.terms).toHaveLength(1);
    expect(result.terms[0].original).toBe('ok');
  });
});

describe('buildContextualTranslationSystemPrompt', () => {
  it('includes target language', () => {
    const prompt = buildContextualTranslationSystemPrompt([], 'English');
    expect(prompt).toContain('English');
  });

  it('includes glossary terms when provided', () => {
    const prompt = buildContextualTranslationSystemPrompt(
      [{ original: 'OpenAI', type: 'organization', translation: 'OpenAI公司' }],
      '中文'
    );
    expect(prompt).toContain('OpenAI');
    expect(prompt).toContain('organization');
    expect(prompt).toContain('OpenAI公司');
  });

  it('includes speaker style when provided', () => {
    const prompt = buildContextualTranslationSystemPrompt(
      [], 'English', 'casual friendly'
    );
    expect(prompt).toContain('casual friendly');
  });

  it('omits speaker style section when not provided', () => {
    const prompt = buildContextualTranslationSystemPrompt([], 'English');
    expect(prompt).not.toContain('说话人风格');
  });

  it('returns JSON array format instructions', () => {
    const prompt = buildContextualTranslationSystemPrompt([], 'English');
    expect(prompt).toContain('translatedText');
    expect(prompt).toContain('JSON');
  });
});

describe('parseContextualTranslationResponse', () => {
  it('returns empty array for non-array input', () => {
    expect(parseContextualTranslationResponse(null)).toEqual([]);
    expect(parseContextualTranslationResponse({})).toEqual([]);
    expect(parseContextualTranslationResponse('string')).toEqual([]);
  });

  it('parses valid translation items', () => {
    const result = parseContextualTranslationResponse([
      { index: 0, translatedText: '你好世界' },
      { index: 1, translatedText: '测试字幕' }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBe(0);
    expect(result[0].translatedText).toBe('你好世界');
  });

  it('rounds fractional index', () => {
    const result = parseContextualTranslationResponse([
      { index: 1.7, translatedText: 'test' }
    ]);
    expect(result[0].index).toBe(2);
  });

  it('clamps negative index to 0', () => {
    const result = parseContextualTranslationResponse([
      { index: -5, translatedText: 'test' }
    ]);
    expect(result[0].index).toBe(0);
  });

  it('filters out items with empty translatedText', () => {
    const result = parseContextualTranslationResponse([
      { index: 0, translatedText: '' },
      { index: 1, translatedText: '   ' },
      { index: 2, translatedText: 'valid' }
    ]);
    expect(result).toHaveLength(1);
  });

  it('filters out items with missing or non-string translatedText', () => {
    const result = parseContextualTranslationResponse([
      { index: 0 },
      { index: 1, translatedText: 123 },
      { index: 2, translatedText: 'ok' }
    ]);
    expect(result).toHaveLength(1);
  });
});

describe('compareTranslationVersions', () => {
  it('returns comparison for matching-length arrays', () => {
    const result = compareTranslationVersions(
      ['Hello', 'World'],
      ['你好', '世界'],
      ['你好呀', '世界！']
    );
    expect(result).toHaveLength(2);
    expect(result[0].original).toBe('Hello');
    expect(result[0].withoutContext).toBe('你好');
    expect(result[0].withContext).toBe('你好呀');
    expect(result[0].hasDifference).toBe(true);
    expect(result[1].hasDifference).toBe(true);
  });

  it('detects no difference when translations match', () => {
    const result = compareTranslationVersions(
      ['Hello'],
      ['你好'],
      ['你好']
    );
    expect(result[0].hasDifference).toBe(false);
  });

  it('handles arrays of different lengths', () => {
    const result = compareTranslationVersions(
      ['A', 'B'],
      ['a'],
      ['a', 'b', 'c']
    );
    expect(result).toHaveLength(3);
    expect(result[0].original).toBe('A');
    expect(result[1].original).toBe('B');
    expect(result[2].original).toBe('');
    expect(result[2].withoutContext).toBe('');
    expect(result[2].withContext).toBe('c');
  });

  it('handles empty arrays', () => {
    expect(compareTranslationVersions([], [], [])).toHaveLength(0);
  });
});

describe('calculateContextualTranslationBatches', () => {
  it('returns empty for 0 subtitles', () => {
    expect(calculateContextualTranslationBatches(0)).toEqual([]);
  });

  it('returns single batch for count <= maxBatchSize', () => {
    expect(calculateContextualTranslationBatches(30)).toEqual([30]);
  });

  it('splits into multiple batches for count > maxBatchSize', () => {
    const batches = calculateContextualTranslationBatches(120, 50);
    expect(batches).toEqual([50, 50, 20]);
  });

  it('uses default maxBatchSize of 50', () => {
    const batches = calculateContextualTranslationBatches(100);
    expect(batches).toEqual([50, 50]);
  });

  it('respects custom maxBatchSize', () => {
    const batches = calculateContextualTranslationBatches(10, 3);
    expect(batches).toEqual([3, 3, 3, 1]);
  });
});
