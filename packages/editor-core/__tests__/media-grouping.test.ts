import { describe, expect, it } from 'vitest';
import {
  detectTimeWindowGroups,
  detectFilenameSequenceGroups,
  detectColorSimilarityGroups,
  extractFilenameSequencePrefix,
  mergeGroupingSuggestions,
  recordIgnorePreference,
  filterSuggestionsByPreferences,
  normalizeMediaGroupingSettings
} from '../src';

describe('media grouping', () => {
  it('detects time-window groups from import timestamps', () => {
    const now = Date.now();
    const media = [
      { id: 'a', importedAt: new Date(now).toISOString() },
      { id: 'b', importedAt: new Date(now + 60_000).toISOString() },
      { id: 'c', importedAt: new Date(now + 120_000).toISOString() },
      { id: 'd', importedAt: new Date(now + 600_000).toISOString() }
    ];
    const groups = detectTimeWindowGroups(media, 300_000);
    expect(groups).toHaveLength(1);
    expect(groups[0].mediaIds).toEqual(['a', 'b', 'c']);
    expect(groups[0].reason).toBe('time-window');
  });

  it('returns empty when fewer than 2 media items in window', () => {
    const media = [{ id: 'a', importedAt: new Date().toISOString() }];
    expect(detectTimeWindowGroups(media)).toEqual([]);
  });

  it('splits into multiple groups when time gap exceeds window', () => {
    const now = Date.now();
    const media = [
      { id: 'a', importedAt: new Date(now).toISOString() },
      { id: 'b', importedAt: new Date(now + 60_000).toISOString() },
      { id: 'c', importedAt: new Date(now + 1_000_000).toISOString() },
      { id: 'd', importedAt: new Date(now + 1_060_000).toISOString() }
    ];
    const groups = detectTimeWindowGroups(media, 300_000);
    expect(groups).toHaveLength(2);
  });

  it('extracts filename sequence prefix correctly', () => {
    expect(extractFilenameSequencePrefix('IMG_001.jpg')).toBe('img_');
    expect(extractFilenameSequencePrefix('clip-0042.mov')).toBe('clip-');
    expect(extractFilenameSequencePrefix('photo 003.png')).toBe('photo');
    expect(extractFilenameSequencePrefix('a')).toBe('');
  });

  it('detects filename sequence groups for matching prefixes', () => {
    const media = [
      { id: 'a', name: 'IMG_001.jpg' },
      { id: 'b', name: 'IMG_002.jpg' },
      { id: 'c', name: 'IMG_003.jpg' },
      { id: 'd', name: 'IMG_004.jpg' },
      { id: 'e', name: 'DSC_001.jpg' }
    ];
    const groups = detectFilenameSequenceGroups(media);
    expect(groups).toHaveLength(1);
    expect(groups[0].mediaIds).toEqual(['a', 'b', 'c', 'd']);
    expect(groups[0].reason).toBe('filename-sequence');
  });

  it('detects color similarity groups from histograms', () => {
    const media = [
      { id: 'a', thumbnail: undefined },
      { id: 'b', thumbnail: undefined },
      { id: 'c', thumbnail: undefined },
      { id: 'd', thumbnail: undefined }
    ];
    const histograms = {
      a: [0.3, 0.3, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2],
      b: [0.31, 0.29, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2],
      c: [0.1, 0.1, 0.4, 0.4, 0.1, 0.1, 0.4, 0.4, 0.1, 0.1, 0.4, 0.4],
      d: [0.1, 0.1, 0.4, 0.4, 0.1, 0.1, 0.4, 0.4, 0.1, 0.1, 0.4, 0.4]
    };
    const groups = detectColorSimilarityGroups(media, histograms, 0.95);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.some((g) => g.mediaIds.includes('a') && g.mediaIds.includes('b'))).toBe(true);
    expect(groups.some((g) => g.mediaIds.includes('c') && g.mediaIds.includes('d'))).toBe(true);
  });

  it('merges and deduplicates overlapping grouping suggestions', () => {
    const merged = mergeGroupingSuggestions(
      [{ id: 'g1', mediaIds: ['a', 'b', 'c'], reason: 'time-window', label: 'A', confidence: 0.8, createdAt: '' }],
      [{ id: 'g2', mediaIds: ['b', 'c', 'd', 'e'], reason: 'filename-sequence', label: 'B', confidence: 0.7, createdAt: '' }]
    );
    expect(merged).toHaveLength(2);
    const first = merged.find((g) => g.id === 'g1')!;
    expect(first.mediaIds).toEqual(['a', 'b', 'c']);
    const second = merged.find((g) => g.id === 'g2')!;
    expect(second.mediaIds).toEqual(['d', 'e']);
  });

  it('records ignore preference and increments count', () => {
    let prefs = recordIgnorePreference([], 'time-window', '2026-01-01');
    expect(prefs).toHaveLength(1);
    expect(prefs[0].ignoreCount).toBe(1);
    prefs = recordIgnorePreference(prefs, 'time-window', '2026-01-02');
    expect(prefs[0].ignoreCount).toBe(2);
    prefs = recordIgnorePreference(prefs, 'filename-sequence', '2026-01-02');
    expect(prefs).toHaveLength(2);
  });

  it('filters suggestions when ignore count exceeds threshold', () => {
    const suggestions = [
      { id: 'g1', mediaIds: ['a', 'b'], reason: 'time-window' as const, label: '', confidence: 0.8, createdAt: '' },
      { id: 'g2', mediaIds: ['c', 'd'], reason: 'filename-sequence' as const, label: '', confidence: 0.7, createdAt: '' }
    ];
    const prefs = [{ reason: 'time-window' as const, ignoreCount: 3, lastIgnoredAt: '' }];
    const filtered = filterSuggestionsByPreferences(suggestions, prefs, 3);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].reason).toBe('filename-sequence');
  });

  it('normalizes media grouping settings with defaults', () => {
    const result = normalizeMediaGroupingSettings(undefined);
    expect(result.enabled).toBe(true);
    expect(result.ignorePreferences).toEqual([]);
  });

  it('normalizes settings with disabled flag', () => {
    const result = normalizeMediaGroupingSettings({ enabled: false });
    expect(result.enabled).toBe(false);
  });
});
