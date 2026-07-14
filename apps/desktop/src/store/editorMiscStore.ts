import { create } from 'zustand';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

export interface EditorMiscState {
  favoriteIds: string[];
  pinnedIds: Set<string>;
  recentMediaIds: string[];

  setFavoriteIds: (updater: Updater<string[]>) => void;
  setPinnedIds: (updater: Updater<Set<string>>) => void;
  setRecentMediaIds: (updater: Updater<string[]>) => void;
}

export const useEditorMiscStore = create<EditorMiscState>((set) => ({
  favoriteIds: [],
  pinnedIds: new Set<string>(),
  recentMediaIds: [],

  setFavoriteIds(updater) {
    set((s) => ({ favoriteIds: applyUpdater(s.favoriteIds, updater) }));
  },
  setPinnedIds(updater) {
    set((s) => ({ pinnedIds: applyUpdater(s.pinnedIds, updater) }));
  },
  setRecentMediaIds(updater) {
    set((s) => ({ recentMediaIds: applyUpdater(s.recentMediaIds, updater) }));
  },
}));
