import { describe, expect, it } from 'vitest';
import {
  buildMediaTagPrompt,
  parseAIMediaOrganizeResponse,
  buildMediaCollectionsFromAI,
  mergeCollectionsWithExisting,
  filterAlreadyCategorizedMedia,
  type AIMediaOrganizeSuggestion
} from '../src';
import type { MediaCollection } from '../src/model-types';

const sampleMedia = [
  { id: 'm1', aiAnalysis: { tags: ['自然', '风景'], scene: '户外' } },
  { id: 'm2', aiAnalysis: { tags: ['人物', '室内'], scene: '室内' } },
  { id: 'm3', aiAnalysis: { tags: ['产品'], scene: '产品展示' } }
];

describe('buildMediaTagPrompt', () => {
  it('builds prompt from analyzed media', () => {
    const result = buildMediaTagPrompt(sampleMedia);
    expect(result).toContain('ID: m1');
    expect(result).toContain('tags: 自然,风景');
    expect(result).toContain('scene: 户外');
    expect(result).toContain('ID: m2');
  });

  it('excludes media without aiAnalysis', () => {
    const media = [
      { id: 'm1', aiAnalysis: { tags: ['自然'], scene: '户外' } },
      { id: 'm2' }
    ];
    const result = buildMediaTagPrompt(media);
    expect(result).toContain('m1');
    expect(result).not.toContain('m2');
  });

  it('excludes media with empty tags and no scene', () => {
    const media = [
      { id: 'm1', aiAnalysis: { tags: [], scene: '' } },
      { id: 'm2', aiAnalysis: { tags: ['test'], scene: 'test' } }
    ];
    const result = buildMediaTagPrompt(media);
    expect(result).not.toContain('m1');
    expect(result).toContain('m2');
  });

  it('returns empty string for no analyzed media', () => {
    expect(buildMediaTagPrompt([])).toBe('');
    expect(buildMediaTagPrompt([{ id: 'm1' }])).toBe('');
  });
});

describe('parseAIMediaOrganizeResponse', () => {
  it('parses valid response', () => {
    const input = {
      collections: [
        { name: '自然风景', mediaIds: ['m1'], reason: '风景标签' },
        { name: '室内场景', mediaIds: ['m2', 'm3'], reason: '室内标签' }
      ]
    };
    const result = parseAIMediaOrganizeResponse(input);
    expect(result.collections).toHaveLength(2);
    expect(result.collections[0].name).toBe('自然风景');
    expect(result.collections[0].mediaIds).toEqual(['m1']);
    expect(result.collections[1].mediaIds).toEqual(['m2', 'm3']);
  });

  it('returns empty for null/invalid input', () => {
    expect(parseAIMediaOrganizeResponse(null)).toEqual({ collections: [] });
    expect(parseAIMediaOrganizeResponse(undefined)).toEqual({ collections: [] });
    expect(parseAIMediaOrganizeResponse('bad')).toEqual({ collections: [] });
  });

  it('filters out entries without name', () => {
    const input = {
      collections: [
        { name: '', mediaIds: ['m1'], reason: '' },
        { name: 'Valid', mediaIds: ['m2'], reason: '' }
      ]
    };
    const result = parseAIMediaOrganizeResponse(input);
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0].name).toBe('Valid');
  });

  it('filters out entries with empty mediaIds', () => {
    const input = {
      collections: [
        { name: 'Empty', mediaIds: [], reason: '' },
        { name: 'NoStrings', mediaIds: [123, true], reason: '' }
      ]
    };
    const result = parseAIMediaOrganizeResponse(input);
    expect(result.collections).toHaveLength(0);
  });
});

describe('buildMediaCollectionsFromAI', () => {
  it('builds MediaCollection objects from suggestions', () => {
    const suggestions: AIMediaOrganizeSuggestion[] = [
      { name: '户外', mediaIds: ['m1'], reason: '风景' }
    ];
    const result = buildMediaCollectionsFromAI(suggestions, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('户外');
    expect(result[0].source).toBe('ai');
    expect(result[0].mediaIds).toEqual(['m1']);
    expect(result[0].id).toBeTruthy();
    expect(result[0].createdAt).toBeTruthy();
  });

  it('excludes media already in existing collections', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '已有', mediaIds: ['m1'], source: 'manual', createdAt: '' }
    ];
    const suggestions: AIMediaOrganizeSuggestion[] = [
      { name: '新分组', mediaIds: ['m1', 'm2'], reason: '' }
    ];
    const result = buildMediaCollectionsFromAI(suggestions, existing);
    expect(result).toHaveLength(1);
    expect(result[0].mediaIds).toEqual(['m2']);
  });

  it('filters out suggestions that become empty after dedup', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '已有', mediaIds: ['m1'], source: 'manual', createdAt: '' }
    ];
    const suggestions: AIMediaOrganizeSuggestion[] = [
      { name: '重复', mediaIds: ['m1'], reason: '' }
    ];
    const result = buildMediaCollectionsFromAI(suggestions, existing);
    expect(result).toHaveLength(0);
  });
});

describe('mergeCollectionsWithExisting', () => {
  it('appends new collections', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '已有', mediaIds: ['m1'], source: 'manual', createdAt: '' }
    ];
    const ai: MediaCollection[] = [
      { id: 'col-2', name: '新分组', mediaIds: ['m2'], source: 'ai', createdAt: '' }
    ];
    const result = mergeCollectionsWithExisting(ai, existing);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('新分组');
  });

  it('merges mediaIds when name matches', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '户外', mediaIds: ['m1'], source: 'manual', createdAt: '' }
    ];
    const ai: MediaCollection[] = [
      { id: 'col-2', name: '户外', mediaIds: ['m2'], source: 'ai', createdAt: '' }
    ];
    const result = mergeCollectionsWithExisting(ai, existing);
    expect(result).toHaveLength(1);
    expect(result[0].mediaIds).toContain('m1');
    expect(result[0].mediaIds).toContain('m2');
  });

  it('deduplicates mediaIds when merging', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '户外', mediaIds: ['m1', 'm2'], source: 'manual', createdAt: '' }
    ];
    const ai: MediaCollection[] = [
      { id: 'col-2', name: '户外', mediaIds: ['m2', 'm3'], source: 'ai', createdAt: '' }
    ];
    const result = mergeCollectionsWithExisting(ai, existing);
    expect(result).toHaveLength(1);
    expect(result[0].mediaIds).toEqual(['m1', 'm2', 'm3']);
  });

  it('preserves existing collection id on merge', () => {
    const existing: MediaCollection[] = [
      { id: 'col-original', name: '户外', mediaIds: ['m1'], source: 'manual', createdAt: '2024-01-01' }
    ];
    const ai: MediaCollection[] = [
      { id: 'col-ai', name: '户外', mediaIds: ['m2'], source: 'ai', createdAt: '' }
    ];
    const result = mergeCollectionsWithExisting(ai, existing);
    expect(result[0].id).toBe('col-original');
    expect(result[0].source).toBe('manual');
  });
});

describe('filterAlreadyCategorizedMedia', () => {
  it('excludes media already in collections', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '已有', mediaIds: ['m1'], source: 'manual', createdAt: '' }
    ];
    const result = filterAlreadyCategorizedMedia(sampleMedia as any, existing);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).not.toContain('m1');
  });

  it('excludes media without aiAnalysis', () => {
    const media = [
      { id: 'm1', aiAnalysis: { tags: ['自然'], scene: '户外' } },
      { id: 'm2' }
    ];
    const result = filterAlreadyCategorizedMedia(media as any, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('returns empty when all media categorized', () => {
    const existing: MediaCollection[] = [
      { id: 'col-1', name: '已有', mediaIds: ['m1', 'm2', 'm3'], source: 'manual', createdAt: '' }
    ];
    const result = filterAlreadyCategorizedMedia(sampleMedia as any, existing);
    expect(result).toHaveLength(0);
  });
});
