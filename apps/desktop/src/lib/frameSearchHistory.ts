import {
  appendFrameSearchHistoryEntry,
  sanitizeFrameSearchHistory,
  type FrameSearchHistoryEntry
} from '@open-factory/editor-core';

export const FRAME_SEARCH_HISTORY_STORAGE_KEY = 'open-factory:frame-search-history';

export interface FrameSearchHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readFrameSearchHistory(storage = resolveFrameSearchHistoryStorage()): FrameSearchHistoryEntry[] {
  if (!storage) {
    return [];
  }
  try {
    const parsed = JSON.parse(storage.getItem(FRAME_SEARCH_HISTORY_STORAGE_KEY) ?? '[]') as unknown;
    return sanitizeFrameSearchHistory(Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown }).entries);
  } catch {
    return [];
  }
}

export function writeFrameSearchHistory(entries: readonly FrameSearchHistoryEntry[], storage = resolveFrameSearchHistoryStorage()): FrameSearchHistoryEntry[] {
  const sanitized = sanitizeFrameSearchHistory(entries);
  if (!storage) {
    return sanitized;
  }
  storage.setItem(FRAME_SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function appendFrameSearchHistory(entry: FrameSearchHistoryEntry, storage = resolveFrameSearchHistoryStorage()): FrameSearchHistoryEntry[] {
  const next = appendFrameSearchHistoryEntry(readFrameSearchHistory(storage), entry);
  return writeFrameSearchHistory(next, storage);
}

function resolveFrameSearchHistoryStorage(): FrameSearchHistoryStorage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
