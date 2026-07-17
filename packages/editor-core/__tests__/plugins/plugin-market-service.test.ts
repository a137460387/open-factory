import { describe, expect, it } from 'vitest';
import {
  calculatePluginScore,
  checkVersionCompatibility,
  compareSemver,
  normalizeMarketEntry,
  parseMarketCatalogJson,
  searchMarketEntries,
  type MarketPluginEntry,
} from '../../src/plugins/plugin-market-service';

function entry(overrides: Partial<MarketPluginEntry> = {}): MarketPluginEntry {
  return {
    id: 'com.example.plugin',
    name: 'Test Plugin',
    author: 'Test Author',
    version: '1.0.0',
    description: 'A test plugin for the marketplace.',
    category: 'effect',
    permissions: ['read-project'],
    downloadUrl: '/plugins/test-plugin.js',
    sha256: 'a'.repeat(64),
    tags: ['color', 'correction'],
    rating: { average: 4.5, count: 10 },
    downloads: 500,
    publishedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    official: false,
    ...overrides,
  };
}

describe('normalizeMarketEntry', () => {
  it('returns undefined for entries missing required fields', () => {
    expect(normalizeMarketEntry(null)).toBeUndefined();
    expect(normalizeMarketEntry({})).toBeUndefined();
    expect(normalizeMarketEntry({ id: 'x', name: 'X' })).toBeUndefined();
  });

  it('returns undefined for entries with invalid category', () => {
    expect(
      normalizeMarketEntry({
        id: 'x',
        name: 'X',
        author: 'A',
        version: '1.0.0',
        downloadUrl: '/x.js',
        sha256: 'a'.repeat(64),
        category: 'invalid',
      }),
    ).toBeUndefined();
  });

  it('normalizes a valid entry with all fields', () => {
    const result = normalizeMarketEntry({
      id: 'com.example.test',
      name: 'Test',
      author: 'Author',
      version: '2.0.0',
      description: 'Desc',
      category: 'workflow',
      permissions: ['read-project', 'bad-perm' as never],
      downloadUrl: '/test.js',
      sha256: 'B'.repeat(64),
      tags: ['Tag1', 'tag1', ''],
      rating: { average: 4.5, count: 10 },
      downloads: 1234,
      homepage: 'https://example.com',
      minAppVersion: '4.35.0',
      publishedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      official: true,
    });

    expect(result).toBeDefined();
    expect(result!.id).toBe('com.example.test');
    expect(result!.category).toBe('workflow');
    expect(result!.permissions).toEqual(['read-project']);
    expect(result!.sha256).toBe('b'.repeat(64));
    expect(result!.tags).toEqual(['tag1']);
    expect(result!.rating).toEqual({ average: 4.5, count: 10 });
    expect(result!.downloads).toBe(1234);
    expect(result!.official).toBe(true);
  });

  it('defaults missing optional fields', () => {
    const result = normalizeMarketEntry({
      id: 'x',
      name: 'X',
      author: 'A',
      version: '1.0.0',
      downloadUrl: '/x.js',
      sha256: 'a'.repeat(64),
      category: 'export',
    });

    expect(result).toBeDefined();
    expect(result!.description).toBe('');
    expect(result!.tags).toEqual([]);
    expect(result!.rating).toEqual({ average: 0, count: 0 });
    expect(result!.downloads).toBe(0);
    expect(result!.official).toBe(false);
  });
});

describe('parseMarketCatalogJson', () => {
  it('parses a catalog with valid and invalid entries', () => {
    const json = JSON.stringify({
      plugins: [
        {
          id: 'com.valid.plugin',
          name: 'Valid',
          author: 'Author',
          version: '1.0.0',
          category: 'effect',
          downloadUrl: '/valid.js',
          sha256: 'a'.repeat(64),
        },
        { id: 'invalid' },
        {
          id: 'com.bad-cat',
          name: 'Bad',
          author: 'Author',
          version: '1.0.0',
          category: 'nope',
          downloadUrl: '/bad.js',
          sha256: 'a'.repeat(64),
        },
      ],
    });

    const entries = parseMarketCatalogJson(json);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('com.valid.plugin');
  });

  it('parses an array-format catalog', () => {
    const json = JSON.stringify([
      {
        id: 'arr.plugin',
        name: 'Arr',
        author: 'A',
        version: '1.0.0',
        category: 'export',
        downloadUrl: '/arr.js',
        sha256: 'a'.repeat(64),
      },
    ]);
    const entries = parseMarketCatalogJson(json);
    expect(entries).toHaveLength(1);
  });
});

describe('searchMarketEntries', () => {
  const entries: MarketPluginEntry[] = [
    entry({ id: 'a', name: 'Color Corrector', category: 'effect', tags: ['color'], downloads: 1000, rating: { average: 4.8, count: 50 }, official: true }),
    entry({ id: 'b', name: 'Subtitle Translator', category: 'workflow', tags: ['subtitle', 'translation'], downloads: 500, rating: { average: 4.2, count: 20 } }),
    entry({ id: 'c', name: 'Social Export', category: 'export', tags: ['social', 'export'], downloads: 2000, rating: { average: 3.5, count: 30 }, official: true }),
    entry({ id: 'd', name: 'AI Scene Detector', category: 'ai-model', tags: ['ai', 'scene'], downloads: 300, rating: { average: 4.9, count: 15 } }),
  ];

  it('returns all entries with no filters', () => {
    const result = searchMarketEntries(entries);
    expect(result.total).toBe(4);
    expect(result.categories).toHaveLength(4);
  });

  it('filters by text query', () => {
    const result = searchMarketEntries(entries, { query: 'color' });
    expect(result.total).toBe(1);
    expect(result.entries[0].id).toBe('a');
  });

  it('filters by category', () => {
    const result = searchMarketEntries(entries, { category: 'effect' });
    expect(result.total).toBe(1);
    expect(result.entries[0].category).toBe('effect');
  });

  it('filters by tags', () => {
    const result = searchMarketEntries(entries, { tags: ['social'] });
    expect(result.total).toBe(1);
    expect(result.entries[0].id).toBe('c');
  });

  it('filters official only', () => {
    const result = searchMarketEntries(entries, { officialOnly: true });
    expect(result.total).toBe(2);
  });

  it('filters by minimum rating', () => {
    const result = searchMarketEntries(entries, { minRating: 4.5 });
    expect(result.total).toBe(2);
  });

  it('sorts by rating descending', () => {
    const result = searchMarketEntries(entries, { sortBy: 'rating', sortDirection: 'desc' });
    expect(result.entries[0].rating.average).toBe(4.9);
  });

  it('sorts by name ascending', () => {
    const result = searchMarketEntries(entries, { sortBy: 'name', sortDirection: 'asc' });
    expect(result.entries[0].name).toBe('AI Scene Detector');
  });

  it('sorts by downloads descending by default', () => {
    const result = searchMarketEntries(entries);
    expect(result.entries[0].downloads).toBe(2000);
    expect(result.entries[1].downloads).toBe(1000);
  });

  it('combines multiple filters', () => {
    const result = searchMarketEntries(entries, { officialOnly: true, minRating: 4.0 });
    expect(result.total).toBe(1);
    expect(result.entries[0].id).toBe('a');
  });
});

describe('compareSemver', () => {
  it('compares major versions', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compares minor versions', () => {
    expect(compareSemver('1.10.0', '1.2.0')).toBe(1);
  });

  it('compares patch versions', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
  });

  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('ignores pre-release suffixes', () => {
    expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(0);
  });
});

describe('checkVersionCompatibility', () => {
  it('returns compatible when no min version is specified', () => {
    expect(checkVersionCompatibility(undefined, '4.35.0')).toEqual({ compatible: true });
  });

  it('returns compatible when app version meets minimum', () => {
    expect(checkVersionCompatibility('4.35.0', '4.36.0')).toEqual({ compatible: true });
  });

  it('returns compatible when app version equals minimum', () => {
    expect(checkVersionCompatibility('4.35.0', '4.35.0')).toEqual({ compatible: true });
  });

  it('returns incompatible when app version is below minimum', () => {
    const result = checkVersionCompatibility('4.36.0', '4.35.0');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('4.36.0');
    expect(result.reason).toContain('4.35.0');
  });
});

describe('calculatePluginScore', () => {
  it('scores highly rated popular plugins highest', () => {
    const high = entry({ rating: { average: 5, count: 100 }, downloads: 10000 });
    const low = entry({ rating: { average: 2, count: 5 }, downloads: 10 });
    expect(calculatePluginScore(high)).toBeGreaterThan(calculatePluginScore(low));
  });

  it('handles zero downloads gracefully', () => {
    const zero = entry({ downloads: 0, rating: { average: 4, count: 10 } });
    expect(calculatePluginScore(zero)).toBeGreaterThan(0);
  });

  it('gives higher weight to rating than downloads', () => {
    const highRating = entry({ rating: { average: 5, count: 10 }, downloads: 100 });
    const highDownloads = entry({ rating: { average: 3, count: 10 }, downloads: 100000 });
    expect(calculatePluginScore(highRating)).toBeGreaterThan(calculatePluginScore(highDownloads));
  });
});
