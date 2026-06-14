import { describe, expect, it } from 'vitest';
import {
  buildTimelineNavigationPoints,
  findTimelineNavigationPoint,
  mergeImportedTimelineBookmarks,
  parseTimelineBookmarksJson,
  serializeTimelineBookmarks
} from '../src';

describe('timeline bookmarks', () => {
  it('serializes and parses bookmark json format', () => {
    const json = serializeTimelineBookmarks(
      [
        { id: 'bookmark-b', time: 12, note: '  Late  ' },
        { id: 'bookmark-a', time: 1, note: 'Intro' }
      ],
      10
    );

    expect(JSON.parse(json)).toEqual({
      version: 1,
      bookmarks: [
        { id: 'bookmark-a', time: 1, note: 'Intro' },
        { id: 'bookmark-b', time: 10, note: 'Late' }
      ]
    });
    expect(parseTimelineBookmarksJson(json, 10)).toEqual([
      { id: 'bookmark-a', time: 1, note: 'Intro' },
      { id: 'bookmark-b', time: 10, note: 'Late' }
    ]);
  });

  it('parses shared bookmark arrays from older exports', () => {
    expect(parseTimelineBookmarksJson(JSON.stringify([{ id: 'bookmark-a', time: 2, note: 'Shared' }]))).toEqual([{ id: 'bookmark-a', time: 2, note: 'Shared' }]);
  });

  it('rejects invalid bookmark import payloads', () => {
    expect(() => parseTimelineBookmarksJson('{"version":1}')).toThrow('bookmarks array');
    expect(() => parseTimelineBookmarksJson('{')).toThrow();
  });

  it('merges imported bookmarks with unique ids and sorted times', () => {
    const merged = mergeImportedTimelineBookmarks(
      [{ id: 'bookmark-a', time: 1, note: 'Local' }],
      [
        { id: 'bookmark-a', time: 2, note: 'Imported duplicate' },
        { id: 'bookmark-b', time: 0.5, note: 'Imported B' }
      ],
      10
    );

    expect(merged.map((bookmark) => bookmark.time)).toEqual([0.5, 1, 2]);
    expect(merged[2].id).not.toBe('bookmark-a');
    expect(merged[2].note).toBe('Imported duplicate');
  });

  it('builds combined sorted navigation points for bookmarks and markers', () => {
    const points = buildTimelineNavigationPoints(
      [
        { id: 'bookmark-b', time: 4, note: 'Bookmark B' },
        { id: 'bookmark-a', time: 1, note: 'Bookmark A' }
      ],
      [
        { id: 'marker-a', time: 2, label: 'Marker A', color: '#38bdf8' },
        { id: 'marker-b', time: 6, label: 'Marker B', color: '#38bdf8' }
      ]
    );

    expect(points.map((point) => `${point.type}:${point.id}`)).toEqual(['bookmark:bookmark-a', 'marker:marker-a', 'bookmark:bookmark-b', 'marker:marker-b']);
    expect(findTimelineNavigationPoint(points, 2, 'next')?.id).toBe('bookmark-b');
    expect(findTimelineNavigationPoint(points, 2, 'previous')?.id).toBe('bookmark-a');
    expect(findTimelineNavigationPoint(points, Number.NaN, 'next')?.id).toBe('bookmark-a');
    expect(findTimelineNavigationPoint(points, 6, 'next')).toBeUndefined();
  });
});
