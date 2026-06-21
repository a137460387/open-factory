import { describe, expect, it } from 'vitest';
import {
  buildMediaTagIndex,
  buildTagFrequencies,
  collectAssetTags,
  filterMediaByTags,
  renameTag,
  deleteTag,
  normalizeTag,
  MEDIA_COLOR_TAG_PREFIX
} from '../src/media-tags';
import type { MediaAsset, MediaMetadata } from '../src/model-types';

function makeAsset(id: string): MediaAsset {
  return {
    id,
    type: 'video',
    name: `video-${id}.mp4`,
    path: `/media/video-${id}.mp4`,
    duration: 10,
    width: 1920,
    height: 1080
  };
}

describe('collectAssetTags', () => {
  it('collects color tag from metadata labelColor', () => {
    const asset = makeAsset('a1');
    const meta: MediaMetadata = { labelColor: 'red' };
    const tags = collectAssetTags(asset, meta);
    expect(tags).toContain(`${MEDIA_COLOR_TAG_PREFIX}red`);
  });

  it('collects custom tags', () => {
    const asset = makeAsset('a2');
    const meta: MediaMetadata = { customTags: ['outdoor', 'nature'] };
    const tags = collectAssetTags(asset, meta);
    expect(tags).toContain('outdoor');
    expect(tags).toContain('nature');
  });

  it('combines color and custom tags', () => {
    const asset = makeAsset('a3');
    const meta: MediaMetadata = { labelColor: 'blue', customTags: ['ocean'] };
    const tags = collectAssetTags(asset, meta);
    expect(tags).toContain(`${MEDIA_COLOR_TAG_PREFIX}blue`);
    expect(tags).toContain('ocean');
  });

  it('returns empty array when no metadata', () => {
    expect(collectAssetTags(makeAsset('a4'))).toEqual([]);
  });
});

describe('buildMediaTagIndex', () => {
  it('builds index mapping tags to asset ids', () => {
    const media = [makeAsset('a1'), makeAsset('a2')];
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature'] },
      a2: { customTags: ['nature', 'city'] }
    };
    const index = buildMediaTagIndex(media, metadata);
    expect(index.get('nature')?.size).toBe(2);
    expect(index.get('city')?.size).toBe(1);
  });
});

describe('buildTagFrequencies', () => {
  it('returns tags sorted by frequency descending', () => {
    const index = new Map<string, Set<string>>([
      ['rare', new Set(['a1'])],
      ['common', new Set(['a1', 'a2', 'a3'])]
    ]);
    const freq = buildTagFrequencies(index);
    expect(freq[0].tag).toBe('common');
    expect(freq[0].count).toBe(3);
    expect(freq[1].tag).toBe('rare');
    expect(freq[1].count).toBe(1);
  });

  it('marks color tags correctly', () => {
    const index = new Map<string, Set<string>>([
      [`${MEDIA_COLOR_TAG_PREFIX}red`, new Set(['a1'])],
      ['outdoor', new Set(['a2'])]
    ]);
    const freq = buildTagFrequencies(index);
    const colorFreq = freq.find((f) => f.tag === `${MEDIA_COLOR_TAG_PREFIX}red`);
    expect(colorFreq?.isColorTag).toBe(true);
    const customFreq = freq.find((f) => f.tag === 'outdoor');
    expect(customFreq?.isColorTag).toBe(false);
  });
});

describe('filterMediaByTags', () => {
  it('returns all media when filter tags is empty', () => {
    const media = [makeAsset('a1'), makeAsset('a2')];
    expect(filterMediaByTags(media, {}, { tags: [], mode: 'and' })).toEqual(media);
  });

  it('filters by single tag', () => {
    const media = [makeAsset('a1'), makeAsset('a2')];
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature'] },
      a2: { customTags: ['city'] }
    };
    const result = filterMediaByTags(media, metadata, { tags: ['nature'], mode: 'and' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('a1');
  });

  it('AND filters by multiple tags (intersection)', () => {
    const media = [makeAsset('a1'), makeAsset('a2'), makeAsset('a3')];
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature', 'outdoor'] },
      a2: { customTags: ['nature'] },
      a3: { customTags: ['outdoor'] }
    };
    const result = filterMediaByTags(media, metadata, { tags: ['nature', 'outdoor'], mode: 'and' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('a1');
  });
});

describe('renameTag', () => {
  it('renames custom tag across all metadata entries', () => {
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature', 'outdoor'] },
      a2: { customTags: ['nature'] },
      a3: { customTags: ['city'] }
    };
    const updated = renameTag(metadata, 'nature', 'landscape');
    expect(updated.a1.customTags).toContain('landscape');
    expect(updated.a1.customTags).not.toContain('nature');
    expect(updated.a2.customTags).toContain('landscape');
    expect(updated.a2.customTags).not.toContain('nature');
    expect(updated.a3.customTags).toEqual(['city']);
  });

  it('returns same metadata when old tag not found', () => {
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['city'] }
    };
    const updated = renameTag(metadata, 'nature', 'landscape');
    expect(updated).toEqual(metadata);
  });

  it('returns same metadata when old equals new', () => {
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature'] }
    };
    expect(renameTag(metadata, 'nature', 'nature')).toEqual(metadata);
  });
});

describe('deleteTag', () => {
  it('removes tag from all metadata entries', () => {
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['nature', 'outdoor'] },
      a2: { customTags: ['nature'] }
    };
    const updated = deleteTag(metadata, 'nature');
    expect(updated.a1.customTags).toEqual(['outdoor']);
    expect(updated.a2.customTags).toBeUndefined();
  });

  it('returns same metadata when tag not found', () => {
    const metadata: Record<string, MediaMetadata> = {
      a1: { customTags: ['outdoor'] }
    };
    expect(deleteTag(metadata, 'nature')).toEqual(metadata);
  });
});

describe('normalizeTag', () => {
  it('trims and lowercases', () => {
    expect(normalizeTag('  Nature  ')).toBe('nature');
  });
});
