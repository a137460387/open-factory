import { describe, expect, it } from 'vitest';
import {
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorite,
  trackRecentMedia,
  getRecentMediaIds,
  parseFavoritesSearchFilter,
  sortWithPinned,
  getFavoritesStoragePath,
  normalizeFavoritesData,
  createDefaultFavoritesData,
  FAVORITES_MAX_RECENT,
} from '../src/media-favorites';

describe('addFavorite', () => {
  it('adds a new media to favorites', () => {
    expect(addFavorite([], 'm1')).toEqual(['m1']);
  });

  it('does not duplicate', () => {
    expect(addFavorite(['m1'], 'm1')).toEqual(['m1']);
  });

  it('appends to existing list', () => {
    expect(addFavorite(['m1'], 'm2')).toEqual(['m1', 'm2']);
  });
});

describe('removeFavorite', () => {
  it('removes existing media', () => {
    expect(removeFavorite(['m1', 'm2', 'm3'], 'm2')).toEqual(['m1', 'm3']);
  });

  it('returns same if not found', () => {
    expect(removeFavorite(['m1'], 'm2')).toEqual(['m1']);
  });
});

describe('toggleFavorite', () => {
  it('adds if not present', () => {
    expect(toggleFavorite([], 'm1')).toEqual(['m1']);
  });

  it('removes if present', () => {
    expect(toggleFavorite(['m1'], 'm1')).toEqual([]);
  });
});

describe('isFavorite', () => {
  it('returns true if in list', () => {
    expect(isFavorite(['m1', 'm2'], 'm1')).toBe(true);
  });

  it('returns false if not in list', () => {
    expect(isFavorite(['m1'], 'm2')).toBe(false);
  });
});

describe('trackRecentMedia', () => {
  it('prepends new media', () => {
    expect(trackRecentMedia([], 'm1')).toEqual(['m1']);
  });

  it('moves duplicate to front', () => {
    expect(trackRecentMedia(['m1', 'm2'], 'm1')).toEqual(['m1', 'm2']);
  });

  it('respects max limit', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `m${i}`);
    const result = trackRecentMedia(ids, 'new', 30);
    expect(result.length).toBe(30);
    expect(result[0]).toBe('new');
    expect(result).not.toContain('m29');
  });

  it('LRU: oldest removed when exceeding limit', () => {
    const result = trackRecentMedia(['old', 'mid', 'new'], 'brand-new', 3);
    expect(result).toEqual(['brand-new', 'old', 'mid']);
  });
});

describe('getRecentMediaIds', () => {
  it('returns up to max items', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `m${i}`);
    expect(getRecentMediaIds(ids, 30).length).toBe(30);
  });
});

describe('parseFavoritesSearchFilter', () => {
  it('parses filter:favorites', () => {
    const result = parseFavoritesSearchFilter('filter:favorites beach');
    expect(result.filter).toBe('favorites');
    expect(result.cleanQuery).toBe('beach');
  });

  it('parses filter:recent', () => {
    const result = parseFavoritesSearchFilter('filter:recent sunset');
    expect(result.filter).toBe('recent');
    expect(result.cleanQuery).toBe('sunset');
  });

  it('returns no filter for normal query', () => {
    const result = parseFavoritesSearchFilter('beach sunset');
    expect(result.filter).toBeUndefined();
    expect(result.cleanQuery).toBe('beach sunset');
  });

  it('case insensitive', () => {
    const result = parseFavoritesSearchFilter('Filter:Favorites test');
    expect(result.filter).toBe('favorites');
  });
});

describe('sortWithPinned', () => {
  it('pins items to front', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = sortWithPinned(items, new Set(['c']));
    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('a');
    expect(result[2].id).toBe('b');
  });

  it('preserves order for non-pinned', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = sortWithPinned(items, new Set());
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('getFavoritesStoragePath', () => {
  it('returns sharedPath when mode is shared', () => {
    expect(getFavoritesStoragePath('shared', '/data/favs.json')).toBe('/data/favs.json');
  });

  it('returns undefined when mode is project', () => {
    expect(getFavoritesStoragePath('project')).toBeUndefined();
  });
});

describe('normalizeFavoritesData', () => {
  it('returns defaults for invalid input', () => {
    const data = normalizeFavoritesData(null);
    expect(data.favoriteIds).toEqual([]);
    expect(data.recentIds).toEqual([]);
  });

  it('normalizes valid input', () => {
    const data = normalizeFavoritesData({ favoriteIds: ['a'], recentIds: ['b'], sharedPath: '/p' });
    expect(data.favoriteIds).toEqual(['a']);
    expect(data.recentIds).toEqual(['b']);
    expect(data.sharedPath).toBe('/p');
  });

  it('truncates recentIds to max', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `m${i}`);
    const data = normalizeFavoritesData({ favoriteIds: [], recentIds: ids });
    expect(data.recentIds.length).toBeLessThanOrEqual(FAVORITES_MAX_RECENT);
  });
});
