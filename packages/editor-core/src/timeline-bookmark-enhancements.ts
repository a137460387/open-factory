import { createId } from './model';
import type { BookmarkGroup, BookmarkSortMode, TimelineBookmark } from './model-types';

export const BOOKMARK_ANNOTATION_MAX_LENGTH = 50;
export const BOOKMARK_GROUP_DEFAULT_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
export const DEFAULT_BOOKMARK_GROUP: BookmarkGroup = {
  id: '__default__',
  name: '未分组',
  color: '#64748b',
  collapsed: false,
  sortOrder: 0,
};

export function createBookmarkGroup(input: {
  name: string;
  color?: string;
  collapsed?: boolean;
  sortOrder?: number;
  id?: string;
}): BookmarkGroup {
  return {
    id: input.id ?? createId('bg'),
    name: input.name.trim().slice(0, 40) || '未命名分组',
    color: normalizeBookmarkGroupColor(input.color),
    collapsed: input.collapsed ?? false,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder! : 0,
  };
}

export function normalizeBookmarkAnnotationText(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, BOOKMARK_ANNOTATION_MAX_LENGTH);
}

export function sortBookmarks(
  bookmarks: TimelineBookmark[],
  mode: BookmarkSortMode,
  groups?: BookmarkGroup[],
): TimelineBookmark[] {
  const sorted = [...bookmarks];
  switch (mode) {
    case 'time':
      return sorted.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    case 'group': {
      const groupOrder = new Map<string, number>();
      if (groups) {
        for (const group of groups) {
          groupOrder.set(group.id, group.sortOrder);
        }
      }
      return sorted.sort((a, b) => {
        const ga = groupOrder.get(a.groupId ?? '') ?? 9999;
        const gb = groupOrder.get(b.groupId ?? '') ?? 9999;
        return ga - gb || a.time - b.time || a.id.localeCompare(b.id);
      });
    }
    case 'created':
      return sorted.sort((a, b) => {
        const ca = a.createdAt ?? '';
        const cb = b.createdAt ?? '';
        return ca.localeCompare(cb) || a.id.localeCompare(b.id);
      });
    default:
      return sorted;
  }
}

export function groupBookmarks(
  bookmarks: TimelineBookmark[],
  groups: BookmarkGroup[],
): Map<string, TimelineBookmark[]> {
  const result = new Map<string, TimelineBookmark[]>();
  result.set(DEFAULT_BOOKMARK_GROUP.id, []);
  for (const group of groups) {
    result.set(group.id, []);
  }
  for (const bookmark of bookmarks) {
    const groupId = bookmark.groupId && result.has(bookmark.groupId) ? bookmark.groupId : DEFAULT_BOOKMARK_GROUP.id;
    result.get(groupId)!.push(bookmark);
  }
  return result;
}

export function calculateBookmarkNavDots(
  bookmarks: TimelineBookmark[],
  totalDuration: number,
  containerWidth: number,
  groups?: BookmarkGroup[],
): Array<{ id: string; left: number; color: string }> {
  if (!totalDuration || totalDuration <= 0 || !containerWidth || containerWidth <= 0) {
    return [];
  }
  const groupColorMap = new Map<string, string>();
  if (groups) {
    for (const group of groups) {
      groupColorMap.set(group.id, group.color);
    }
  }
  return bookmarks.map((bookmark) => ({
    id: bookmark.id,
    left: Math.min(containerWidth - 4, Math.max(0, (bookmark.time / totalDuration) * containerWidth)),
    color: groupColorMap.get(bookmark.groupId ?? '') ?? '#3b82f6',
  }));
}

export function captureBookmarkThumbnail(bookmark: TimelineBookmark, thumbnailPath: string): TimelineBookmark {
  return { ...bookmark, thumbnailPath };
}

export function applyBookmarkGroupCollapseState(
  groups: BookmarkGroup[],
  groupId: string,
  collapsed: boolean,
): BookmarkGroup[] {
  return groups.map((group) => (group.id === groupId ? { ...group, collapsed } : group));
}

export function serializeBookmarkGroups(groups: BookmarkGroup[]): string {
  return JSON.stringify(groups, null, 2) + '\n';
}

export function parseBookmarkGroupsJson(json: string): BookmarkGroup[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((item) => normalizeBookmarkGroup(item as Partial<BookmarkGroup>));
}

export function normalizeBookmarkGroupColor(color: string | undefined): string {
  const match = /^#?[a-fA-F0-9]{6}$/.exec(color?.trim() ?? '');
  return match ? `#${match[0].replace('#', '')}` : BOOKMARK_GROUP_DEFAULT_COLORS[0];
}

function normalizeBookmarkGroup(raw: Partial<BookmarkGroup>): BookmarkGroup {
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId('bg'),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : '未命名分组',
    color: normalizeBookmarkGroupColor(raw.color),
    collapsed: raw.collapsed ?? false,
    sortOrder: Number.isFinite(raw.sortOrder) ? raw.sortOrder! : 0,
  };
}
