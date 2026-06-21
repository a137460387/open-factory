import { describe, expect, it } from 'vitest';
import {
  buildQualityComparison,
  createEmptyMergeHistory,
  addMergeHistoryEntry,
  undoLastMergeEntry,
  buildRecycleBinArgs,
  detectCrossProjectDuplicates,
  serializeMergeHistory,
  deserializeMergeHistory,
  MAX_MERGE_HISTORY_ENTRIES
} from '../src/duplicate-media-merge';
import type { MediaQualityInfo, MergeHistoryEntry } from '../src/duplicate-media-merge';

describe('quality comparison', () => {
  it('builds comparison sorted by quality (resolution + bitrate)', () => {
    const assets: MediaQualityInfo[] = [
      { assetId: 'a1', name: 'low.mp4', path: '/a', width: 640, height: 360, bitrate: 500000, fileSize: 1000000 },
      { assetId: 'a2', name: 'high.mp4', path: '/b', width: 1920, height: 1080, bitrate: 5000000, fileSize: 10000000 },
      { assetId: 'a3', name: 'mid.mp4', path: '/c', width: 1280, height: 720, bitrate: 2000000, fileSize: 5000000 }
    ];
    const comparison = buildQualityComparison('group-1', assets);
    expect(comparison.recommendedKeepAssetId).toBe('a2');
    expect(comparison.assets[0].assetId).toBe('a2');
    expect(comparison.assets[1].assetId).toBe('a3');
    expect(comparison.assets[2].assetId).toBe('a1');
  });

  it('handles empty assets', () => {
    const comparison = buildQualityComparison('group-empty', []);
    expect(comparison.assets).toEqual([]);
    expect(comparison.recommendedKeepAssetId).toBe('');
  });
});

describe('merge history', () => {
  it('creates empty history', () => {
    const store = createEmptyMergeHistory();
    expect(store.entries).toEqual([]);
  });

  it('adds entries to history', () => {
    const entry: MergeHistoryEntry = {
      id: 'merge-1',
      timestamp: '2024-01-15T10:00:00Z',
      groupId: 'group-1',
      keptAssetId: 'a1',
      keptName: 'high.mp4',
      mergedAssetIds: ['a2'],
      mergedNames: ['low.mp4'],
      movedToTrash: false
    };
    const store = addMergeHistoryEntry(createEmptyMergeHistory(), entry);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].id).toBe('merge-1');
  });

  it('limits history to MAX_MERGE_HISTORY_ENTRIES', () => {
    let store = createEmptyMergeHistory();
    for (let i = 0; i < MAX_MERGE_HISTORY_ENTRIES + 10; i++) {
      store = addMergeHistoryEntry(store, {
        id: `merge-${i}`,
        timestamp: new Date().toISOString(),
        groupId: 'g',
        keptAssetId: 'a',
        keptName: 'file.mp4',
        mergedAssetIds: [],
        mergedNames: [],
        movedToTrash: false
      });
    }
    expect(store.entries.length).toBeLessThanOrEqual(MAX_MERGE_HISTORY_ENTRIES);
  });

  it('undoes the last merge entry', () => {
    const entry: MergeHistoryEntry = {
      id: 'merge-1',
      timestamp: '2024-01-15T10:00:00Z',
      groupId: 'group-1',
      keptAssetId: 'a1',
      keptName: 'high.mp4',
      mergedAssetIds: ['a2'],
      mergedNames: ['low.mp4'],
      movedToTrash: true
    };
    let store = addMergeHistoryEntry(createEmptyMergeHistory(), entry);
    const { store: updated, entry: undone } = undoLastMergeEntry(store);
    expect(undone?.id).toBe('merge-1');
    expect(updated.entries).toHaveLength(0);
  });

  it('returns undefined when undoing empty history', () => {
    const { entry } = undoLastMergeEntry(createEmptyMergeHistory());
    expect(entry).toBeUndefined();
  });
});

describe('recycle bin args', () => {
  it('builds recycle bin args (not delete)', () => {
    const args = buildRecycleBinArgs('/media/clip.mp4');
    expect(args).toEqual(['--recycle', '/media/clip.mp4']);
    expect(args).not.toContain('--delete');
    expect(args).not.toContain('-rf');
  });
});

describe('cross-project duplicate detection', () => {
  it('detects duplicates between current and shared library', () => {
    const current = [
      { id: 'c1', path: '/media/a.mp4', headHash: 'abc123', size: 5000000 },
      { id: 'c2', path: '/media/b.mp4', headHash: 'def456', size: 3000000 }
    ];
    const shared = [
      { id: 's1', path: '/shared/a.mp4', headHash: 'abc123', size: 5000000 },
      { id: 's2', path: '/shared/other.mp4', headHash: 'xyz789', size: 2000000 }
    ];
    const dupes = detectCrossProjectDuplicates(current, shared);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].currentAssetId).toBe('c1');
    expect(dupes[0].sharedAssetId).toBe('s1');
  });

  it('returns empty when no duplicates', () => {
    const current = [{ id: 'c1', path: '/a.mp4', headHash: 'aaa', size: 100 }];
    const shared = [{ id: 's1', path: '/b.mp4', headHash: 'bbb', size: 200 }];
    expect(detectCrossProjectDuplicates(current, shared)).toEqual([]);
  });
});

describe('merge history serialization', () => {
  it('round-trips through JSON', () => {
    const entry: MergeHistoryEntry = {
      id: 'merge-1',
      timestamp: '2024-01-15T10:00:00Z',
      groupId: 'group-1',
      keptAssetId: 'a1',
      keptName: 'file.mp4',
      mergedAssetIds: ['a2', 'a3'],
      mergedNames: ['file2.mp4', 'file3.mp4'],
      movedToTrash: true
    };
    const store = addMergeHistoryEntry(createEmptyMergeHistory(), entry);
    const json = serializeMergeHistory(store);
    const restored = deserializeMergeHistory(json);
    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0].id).toBe('merge-1');
  });

  it('handles invalid JSON gracefully', () => {
    expect(deserializeMergeHistory('not-json').entries).toEqual([]);
  });
});
