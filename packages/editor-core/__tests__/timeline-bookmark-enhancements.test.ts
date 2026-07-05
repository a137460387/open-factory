import { describe, expect, it } from 'vitest';
import {
  applyBookmarkGroupCollapseState,
  BOOKMARK_ANNOTATION_MAX_LENGTH,
  calculateBookmarkNavDots,
  captureBookmarkThumbnail,
  createBookmarkGroup,
  groupBookmarks,
  normalizeBookmarkAnnotationText,
  parseBookmarkGroupsJson,
  serializeBookmarkGroups,
  sortBookmarks,
  type BookmarkGroup
} from '../src';
import type { TimelineBookmark } from '../src';

function makeBookmark(overrides: Partial<TimelineBookmark>): TimelineBookmark {
  return {
    id: 'bookmark-1',
    time: 5,
    note: 'Test',
    ...overrides
  };
}

describe('timeline bookmark enhancements', () => {
  describe('bookmark groups', () => {
    it('creates a bookmark group with defaults', () => {
      const group = createBookmarkGroup({ name: '问题点' });
      expect(group.name).toBe('问题点');
      expect(group.collapsed).toBe(false);
      expect(group.color).toMatch(/^#[a-fA-F0-9]{6}$/);
    });

    it('clamps group name to 40 characters', () => {
      const longName = 'A'.repeat(50);
      const group = createBookmarkGroup({ name: longName });
      expect(group.name).toHaveLength(40);
    });
  });

  describe('annotation text', () => {
    it('normalizes annotation within 50-char limit', () => {
      expect(normalizeBookmarkAnnotationText('短批注')).toBe('短批注');
    });

    it('truncates annotation exceeding limit', () => {
      const long = 'A'.repeat(60);
      const result = normalizeBookmarkAnnotationText(long);
      expect(result).toHaveLength(BOOKMARK_ANNOTATION_MAX_LENGTH);
    });

    it('returns undefined for empty annotation', () => {
      expect(normalizeBookmarkAnnotationText('')).toBeUndefined();
      expect(normalizeBookmarkAnnotationText(undefined)).toBeUndefined();
    });
  });

  describe('sorting', () => {
    const bookmarks: TimelineBookmark[] = [
      makeBookmark({ id: 'b1', time: 10, groupId: 'g2', createdAt: '2026-01-03T00:00:00Z' }),
      makeBookmark({ id: 'b2', time: 5, groupId: 'g1', createdAt: '2026-01-01T00:00:00Z' }),
      makeBookmark({ id: 'b3', time: 8, groupId: 'g1', createdAt: '2026-01-02T00:00:00Z' })
    ];

    it('sorts by time', () => {
      const sorted = sortBookmarks(bookmarks, 'time');
      expect(sorted.map((b) => b.time)).toEqual([5, 8, 10]);
    });

    it('sorts by group then time', () => {
      const groups: BookmarkGroup[] = [
        createBookmarkGroup({ id: 'g1', name: 'Group 1', sortOrder: 1 }),
        createBookmarkGroup({ id: 'g2', name: 'Group 2', sortOrder: 2 })
      ];
      const sorted = sortBookmarks(bookmarks, 'group', groups);
      expect(sorted.map((b) => b.groupId)).toEqual(['g1', 'g1', 'g2']);
    });

    it('sorts by created order', () => {
      const sorted = sortBookmarks(bookmarks, 'created');
      expect(sorted.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
    });
  });

  describe('grouping', () => {
    it('groups bookmarks by group id', () => {
      const bookmarks: TimelineBookmark[] = [
        makeBookmark({ id: 'b1', groupId: 'g1' }),
        makeBookmark({ id: 'b2', groupId: 'g2' }),
        makeBookmark({ id: 'b3' })
      ];
      const groups: BookmarkGroup[] = [
        createBookmarkGroup({ id: 'g1', name: 'G1' }),
        createBookmarkGroup({ id: 'g2', name: 'G2' })
      ];
      const grouped = groupBookmarks(bookmarks, groups);
      expect(grouped.get('__default__')).toHaveLength(1);
      expect(grouped.get('g1')).toHaveLength(1);
      expect(grouped.get('g2')).toHaveLength(1);
    });
  });

  describe('navigation bar dots', () => {
    it('calculates dot positions within container width', () => {
      const bookmarks: TimelineBookmark[] = [
        makeBookmark({ id: 'b1', time: 0, groupId: 'g1' }),
        makeBookmark({ id: 'b2', time: 30, groupId: 'g1' }),
        makeBookmark({ id: 'b3', time: 60, groupId: 'g2' })
      ];
      const groups: BookmarkGroup[] = [
        createBookmarkGroup({ id: 'g1', name: 'G1', color: '#ef4444' }),
        createBookmarkGroup({ id: 'g2', name: 'G2', color: '#3b82f6' })
      ];
      const dots = calculateBookmarkNavDots(bookmarks, 60, 300, groups);
      expect(dots).toHaveLength(3);
      expect(dots[0].left).toBe(0);
      expect(dots[1].left).toBe(150);
      expect(dots[2].left).toBe(300 - 4);
      expect(dots[0].color).toBe('#ef4444');
      expect(dots[2].color).toBe('#3b82f6');
    });

    it('returns empty array for zero duration', () => {
      expect(calculateBookmarkNavDots([makeBookmark({})], 0, 300)).toEqual([]);
    });
  });

  describe('thumbnail capture', () => {
    it('attaches thumbnail path to bookmark', () => {
      const bookmark = makeBookmark({});
      const updated = captureBookmarkThumbnail(bookmark, '/thumbs/frame.png');
      expect(updated.thumbnailPath).toBe('/thumbs/frame.png');
      expect(updated.id).toBe(bookmark.id);
    });
  });

  describe('collapse state persistence', () => {
    it('toggles group collapse state', () => {
      const groups: BookmarkGroup[] = [
        createBookmarkGroup({ id: 'g1', name: 'G1' }),
        createBookmarkGroup({ id: 'g2', name: 'G2' })
      ];
      const updated = applyBookmarkGroupCollapseState(groups, 'g1', true);
      expect(updated[0].collapsed).toBe(true);
      expect(updated[1].collapsed).toBe(false);
    });

    it('serializes and parses group collapse state', () => {
      const groups: BookmarkGroup[] = [
        { id: 'g1', name: 'G1', color: '#ef4444', collapsed: true, sortOrder: 0 }
      ];
      const json = serializeBookmarkGroups(groups);
      const parsed = parseBookmarkGroupsJson(json);
      expect(parsed[0].collapsed).toBe(true);
    expect(parsed[0].name).toBe('G1');
    });
  });

  it('returns unsorted copy for unknown sort mode', () => {
    const bookmarks: TimelineBookmark[] = [
      makeBookmark({ id: 'b1', time: 10 }),
      makeBookmark({ id: 'b2', time: 5 })
    ];
    const result = sortBookmarks(bookmarks, 'unknown' as unknown as 'time');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when parsed JSON is not an array', () => {
    expect(parseBookmarkGroupsJson('{}')).toEqual([]);
    expect(parseBookmarkGroupsJson('"text"')).toEqual([]);
  });
});
