import { describe, expect, it } from 'vitest';
import {
  readTransitionFavorites,
  toggleTransitionFavorite,
  TRANSITION_FAVORITES_STORAGE_KEY,
  writeTransitionFavorites,
  type TransitionFavoriteStorage,
} from './transition-favorites';

function makeStorage(initial?: string): TransitionFavoriteStorage & { value(): string | undefined } {
  let value = initial;
  return {
    getItem: (key) => (key === TRANSITION_FAVORITES_STORAGE_KEY ? (value ?? null) : null),
    setItem: (key, next) => {
      if (key === TRANSITION_FAVORITES_STORAGE_KEY) {
        value = next;
      }
    },
    value: () => value,
  };
}

describe('transition favorites persistence', () => {
  it('reads only known transition types from storage', () => {
    const storage = makeStorage(JSON.stringify(['wipe-left', 'bad', 'shape-star']));

    expect(readTransitionFavorites(storage)).toEqual(['wipe-left', 'shape-star']);
  });

  it('handles malformed storage without failing', () => {
    expect(readTransitionFavorites(makeStorage('{bad json'))).toEqual([]);
  });

  it('toggles favorites and persists a de-duplicated order', () => {
    const storage = makeStorage();

    expect(toggleTransitionFavorite('wipe-left', storage)).toEqual(['wipe-left']);
    expect(toggleTransitionFavorite('shape-star', storage)).toEqual(['shape-star', 'wipe-left']);
    expect(toggleTransitionFavorite('wipe-left', storage)).toEqual(['shape-star']);
    expect(JSON.parse(storage.value() ?? '[]')).toEqual(['shape-star']);
  });

  it('deduplicates writes', () => {
    const storage = makeStorage();

    expect(writeTransitionFavorites(['wipe-left', 'wipe-left', 'dissolve'], storage)).toEqual([
      'wipe-left',
      'dissolve',
    ]);
  });
});
