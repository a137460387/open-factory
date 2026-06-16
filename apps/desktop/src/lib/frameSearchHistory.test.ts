import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendFrameSearchHistory, FRAME_SEARCH_HISTORY_STORAGE_KEY, readFrameSearchHistory, writeFrameSearchHistory } from './frameSearchHistory';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('frame search history persistence', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and restores sanitized recent jump records', () => {
    const stored = writeFrameSearchHistory([
      { type: 'timecode', query: '00:00:01:00', label: '00:00:01:00', time: 1 },
      { type: 'clip', query: 'Interview', label: 'Interview Clip', time: 3, selectedClipIds: ['clip-interview'] },
      { type: 'frame', query: '', label: 'Frame', time: 0 }
    ]);

    expect(stored).toHaveLength(2);
    expect(JSON.parse(storage.getItem(FRAME_SEARCH_HISTORY_STORAGE_KEY) ?? '[]')).toEqual(stored);
    expect(readFrameSearchHistory()).toEqual(stored);
  });

  it('appends newest records first and keeps only the latest 10', () => {
    for (let index = 0; index < 11; index += 1) {
      appendFrameSearchHistory({ type: 'frame', query: `f${index}`, label: `Frame ${index}`, time: index });
    }

    const history = readFrameSearchHistory();
    expect(history).toHaveLength(10);
    expect(history[0]).toMatchObject({ query: 'f10', type: 'frame' });
    expect(history.at(-1)).toMatchObject({ query: 'f1', type: 'frame' });
  });

  it('returns an empty list for corrupted persisted JSON', () => {
    storage.setItem(FRAME_SEARCH_HISTORY_STORAGE_KEY, '{');

    expect(readFrameSearchHistory()).toEqual([]);
  });
});
