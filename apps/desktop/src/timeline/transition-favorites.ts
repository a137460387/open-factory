import { TRANSITION_TYPES, type TransitionType } from '@open-factory/editor-core';

export const TRANSITION_FAVORITES_STORAGE_KEY = 'open-factory:transition-favorites';

export interface TransitionFavoriteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readTransitionFavorites(storage: TransitionFavoriteStorage | undefined = getDefaultStorage()): TransitionType[] {
  if (!storage) {
    return [];
  }
  try {
    const parsed = JSON.parse(storage.getItem(TRANSITION_FAVORITES_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is TransitionType => typeof value === 'string' && TRANSITION_TYPES.includes(value as TransitionType));
  } catch {
    return [];
  }
}

export function writeTransitionFavorites(favorites: TransitionType[], storage: TransitionFavoriteStorage | undefined = getDefaultStorage()): TransitionType[] {
  const normalized = Array.from(new Set(favorites.filter((value) => TRANSITION_TYPES.includes(value))));
  storage?.setItem(TRANSITION_FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function toggleTransitionFavorite(type: TransitionType, storage: TransitionFavoriteStorage | undefined = getDefaultStorage()): TransitionType[] {
  const favorites = readTransitionFavorites(storage);
  return writeTransitionFavorites(favorites.includes(type) ? favorites.filter((item) => item !== type) : [type, ...favorites], storage);
}

function getDefaultStorage(): TransitionFavoriteStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
