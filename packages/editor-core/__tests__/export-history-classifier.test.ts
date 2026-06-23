import { describe, it, expect } from 'vitest';
import {
  classifyExportEntry,
  classifyExportHistory,
  filterExportHistory,
  calculateExportCategoryStats,
  findExportAssociation,
  overrideEntryCategory,
  EXPORT_CATEGORY_RULES,
  type ClassifiedExportEntry,
  type ExportCategoryTag,
} from '../src/export/export-history-classifier';
import type { ExportTaskHistoryEntry } from '../src/export/export-queue';

function makeHistoryEntry(overrides: Partial<ExportTaskHistoryEntry> = {}): ExportTaskHistoryEntry {
  return {
    id: 'entry-1',
    name: 'Test Export',
    outputPath: '/output/test.mp4',
    status: 'success',
    priority: 'normal',
    createdAt: '2024-06-01T10:00:00Z',
    finishedAt: '2024-06-01T10:30:00Z',
    ...overrides,
  };
}

describe('classifyExportEntry', () => {
  it('classifies social media by preset ID', () => {
    const entry = makeHistoryEntry();
    const result = classifyExportEntry(entry, 'youtube-1080p');
    expect(result.category).toBe('social-media');
    expect(result.categoryLabel).toBe('社媒发布');
  });

  it('classifies client delivery by preset ID', () => {
    const entry = makeHistoryEntry();
    const result = classifyExportEntry(entry, 'prores-4444-master');
    expect(result.category).toBe('client-delivery');
  });

  it('classifies internal preview by preset ID', () => {
    const entry = makeHistoryEntry();
    const result = classifyExportEntry(entry, 'draft-preview');
    expect(result.category).toBe('internal-preview');
  });

  it('classifies archive backup by preset ID', () => {
    const entry = makeHistoryEntry();
    const result = classifyExportEntry(entry, 'archive-lossless');
    expect(result.category).toBe('archive-backup');
  });

  it('classifies by name patterns when no preset match', () => {
    const entry = makeHistoryEntry({ name: '客户最终交付版' });
    const result = classifyExportEntry(entry);
    expect(result.category).toBe('client-delivery');
  });

  it('defaults to internal-preview for unknown', () => {
    const entry = makeHistoryEntry({ name: 'random export' });
    const result = classifyExportEntry(entry);
    expect(result.category).toBe('internal-preview');
  });

  it('associates preset and snapshot metadata', () => {
    const entry = makeHistoryEntry();
    const result = classifyExportEntry(entry, 'web-1080p', 'Web 1080p', 'snap-1');
    expect(result.presetId).toBe('web-1080p');
    expect(result.presetName).toBe('Web 1080p');
    expect(result.projectSnapshotId).toBe('snap-1');
  });
});

describe('classifyExportHistory', () => {
  it('classifies a batch with preset map', () => {
    const entries = [
      makeHistoryEntry({ id: 'e1', name: 'Export 1' }),
      makeHistoryEntry({ id: 'e2', name: 'Export 2' }),
    ];
    const presetMap = new Map([
      ['e1', { presetId: 'youtube-1080p' }],
      ['e2', { presetId: 'archive-backup' }],
    ]);
    const results = classifyExportHistory(entries, presetMap);
    expect(results[0].category).toBe('social-media');
    expect(results[1].category).toBe('archive-backup');
  });
});

describe('filterExportHistory', () => {
  const entries: ClassifiedExportEntry[] = [
    { ...makeHistoryEntry({ id: 'e1', name: '社媒', finishedAt: '2024-06-01T10:00:00Z', status: 'success' }), category: 'social-media', categoryLabel: '社媒发布' },
    { ...makeHistoryEntry({ id: 'e2', name: '交付', finishedAt: '2024-06-05T10:00:00Z', status: 'error' }), category: 'client-delivery', categoryLabel: '客户交付' },
    { ...makeHistoryEntry({ id: 'e3', name: '预览', finishedAt: '2024-06-10T10:00:00Z', status: 'success' }), category: 'internal-preview', categoryLabel: '内部预览' },
  ];

  it('filters by category', () => {
    const result = filterExportHistory(entries, { categories: ['social-media'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('filters by date range', () => {
    const result = filterExportHistory(entries, { dateFrom: '2024-06-04T00:00:00Z', dateTo: '2024-06-08T00:00:00Z' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });

  it('filters by status', () => {
    const result = filterExportHistory(entries, { statusOnly: 'error' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });

  it('filters by search text', () => {
    const result = filterExportHistory(entries, { searchText: '预览' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('combines multiple filters', () => {
    const result = filterExportHistory(entries, {
      categories: ['social-media', 'internal-preview'],
      statusOnly: 'success',
    });
    expect(result).toHaveLength(2);
  });
});

describe('calculateExportCategoryStats', () => {
  it('returns stats for all categories', () => {
    const entries: ClassifiedExportEntry[] = [
      { ...makeHistoryEntry({ id: 'e1', finishedAt: '2024-06-01T10:00:00Z' }), category: 'social-media', categoryLabel: '社媒发布' },
      { ...makeHistoryEntry({ id: 'e2', finishedAt: '2024-06-02T10:00:00Z' }), category: 'social-media', categoryLabel: '社媒发布' },
      { ...makeHistoryEntry({ id: 'e3', finishedAt: '2024-06-03T10:00:00Z' }), category: 'client-delivery', categoryLabel: '客户交付' },
    ];
    const stats = calculateExportCategoryStats(entries);
    expect(stats).toHaveLength(EXPORT_CATEGORY_RULES.length);
    const socialStat = stats.find((s) => s.tag === 'social-media')!;
    expect(socialStat.count).toBe(2);
    const clientStat = stats.find((s) => s.tag === 'client-delivery')!;
    expect(clientStat.count).toBe(1);
    const archiveStat = stats.find((s) => s.tag === 'archive-backup')!;
    expect(archiveStat.count).toBe(0);
  });

  it('calculates weekly trend', () => {
    const entries: ClassifiedExportEntry[] = [
      { ...makeHistoryEntry({ id: 'e1', finishedAt: '2024-06-01T10:00:00Z' }), category: 'social-media', categoryLabel: '社媒发布' },
      { ...makeHistoryEntry({ id: 'e2', finishedAt: '2024-06-02T10:00:00Z' }), category: 'social-media', categoryLabel: '社媒发布' },
    ];
    const stats = calculateExportCategoryStats(entries);
    const socialStat = stats.find((s) => s.tag === 'social-media')!;
    expect(socialStat.trend.length).toBeGreaterThan(0);
  });
});

describe('findExportAssociation', () => {
  it('finds associated preset and snapshot', () => {
    const map = new Map([
      ['e1', { presetId: 'youtube-1080p', presetName: 'YouTube 1080p', projectSnapshotId: 'snap-1' }],
    ]);
    const result = findExportAssociation('e1', map);
    expect(result?.presetId).toBe('youtube-1080p');
    expect(result?.projectSnapshotId).toBe('snap-1');
  });

  it('returns undefined for missing entry', () => {
    const map = new Map<string, { presetId: string }>();
    expect(findExportAssociation('e999', map)).toBeUndefined();
  });
});

describe('overrideEntryCategory', () => {
  it('changes category and label', () => {
    const entry: ClassifiedExportEntry = {
      ...makeHistoryEntry(),
      category: 'internal-preview',
      categoryLabel: '内部预览',
    };
    const result = overrideEntryCategory(entry, 'social-media');
    expect(result.category).toBe('social-media');
    expect(result.categoryLabel).toBe('社媒发布');
  });
});
