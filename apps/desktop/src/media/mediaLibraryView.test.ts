import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import { normalizeMediaLibraryViewSettings, sortMediaLibraryAssets } from './mediaLibraryView';

describe('media library view helpers', () => {
  it('sorts list view assets by name', () => {
    expect(sortMediaLibraryAssets([asset('b', 'Clip 10.mp4'), asset('a', 'Clip 2.mp4'), asset('c', 'alpha.wav')], { sortKey: 'name', sortDirection: 'asc' }).map((item) => item.id)).toEqual([
      'c',
      'a',
      'b'
    ]);
  });

  it('sorts list view assets by duration', () => {
    expect(
      sortMediaLibraryAssets([asset('long', 'Long.mov', { duration: 12 }), asset('short', 'Short.mov', { duration: 2 }), asset('mid', 'Mid.mov', { duration: 6 })], {
        sortKey: 'duration',
        sortDirection: 'desc'
      }).map((item) => item.id)
    ).toEqual(['long', 'mid', 'short']);
  });

  it('sorts list view assets by file size', () => {
    expect(
      sortMediaLibraryAssets([asset('small', 'Small.mov', { size: 2 }), asset('large', 'Large.mov', { size: 20 }), asset('missing', 'Missing.mov')], {
        sortKey: 'size',
        sortDirection: 'asc'
      }).map((item) => item.id)
    ).toEqual(['missing', 'small', 'large']);
  });

  it('normalizes persisted view state with compatible defaults', () => {
    expect(normalizeMediaLibraryViewSettings({ mode: 'list', gridSize: 'large', sortKey: 'duration', sortDirection: 'asc' })).toEqual({
      mode: 'list',
      gridSize: 'large',
      sortKey: 'duration',
      sortDirection: 'asc'
    });
    expect(normalizeMediaLibraryViewSettings({ mode: 'invalid' as never, sortKey: 'bad' as never })).toEqual({
      mode: 'grid',
      gridSize: 'medium',
      sortKey: 'importedAt',
      sortDirection: 'desc'
    });
  });
});

function asset(id: string, name: string, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    name,
    type: overrides.type ?? 'video',
    path: `C:/Media/${name}`,
    duration: overrides.duration ?? 1,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    size: overrides.size,
    importedAt: overrides.importedAt,
    mtimeMs: overrides.mtimeMs
  };
}
