import { describe, expect, it } from 'vitest';
import { appendFrameSearchHistoryEntry, sanitizeFrameSearchHistory } from '../src';

describe('frame search history', () => {
  it('keeps the latest 10 jump records with newest entries first', () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      type: 'frame' as const,
      query: `f${index}`,
      label: `Frame ${index}`,
      time: index
    }));

    const history = entries.reduce((current, entry) => appendFrameSearchHistoryEntry(current, entry), [] as typeof entries);

    expect(history).toHaveLength(10);
    expect(history[0].query).toBe('f11');
    expect(history.at(-1)?.query).toBe('f2');
  });

  it('deduplicates matching records and sanitizes invalid persisted data', () => {
    const history = appendFrameSearchHistoryEntry(
      [
        { type: 'timecode', query: '00:00:01:00', label: '00:00:01:00', time: 1 },
        { type: 'clip', query: 'Interview', label: 'Interview', time: 3, selectedClipIds: ['clip-a'] }
      ],
      { type: 'timecode', query: '00:00:01:00', label: '00:00:01:00', time: 1 }
    );

    expect(history.map((entry) => entry.query)).toEqual(['00:00:01:00', 'Interview']);
    expect(
      sanitizeFrameSearchHistory([
        ...history,
        { type: 'bad', query: 'x', label: 'x', time: 0 },
        { type: 'frame', query: '', label: 'Frame', time: 0 },
        { type: 'marker', query: 'Beat', label: 'Beat', time: -4, selectedClipIds: ['clip-a', 'clip-a', ' '] }
      ])
    ).toEqual([
      { type: 'timecode', query: '00:00:01:00', label: '00:00:01:00', time: 1 },
      { type: 'clip', query: 'Interview', label: 'Interview', time: 3, selectedClipIds: ['clip-a'] },
      { type: 'marker', query: 'Beat', label: 'Beat', time: 0, selectedClipIds: ['clip-a'] }
    ]);
  });
});
