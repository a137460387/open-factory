import { createId, normalizeTimelineBookmarks, type TimelineBookmark, type TimelineMarker } from './model';

export interface TimelineBookmarkFile {
  version: 1;
  bookmarks: TimelineBookmark[];
}

export type TimelineNavigationPointType = 'bookmark' | 'marker';

export interface TimelineNavigationPoint {
  id: string;
  type: TimelineNavigationPointType;
  time: number;
  label: string;
}

const NAVIGATION_EPSILON = 0.000001;

export function serializeTimelineBookmarks(bookmarks: TimelineBookmark[], maxTime?: number): string {
  const file: TimelineBookmarkFile = {
    version: 1,
    bookmarks: normalizeTimelineBookmarks(bookmarks, maxTime)
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseTimelineBookmarksJson(contents: string, maxTime?: number): TimelineBookmark[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid bookmark JSON');
  }

  const bookmarks = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Partial<TimelineBookmarkFile>).bookmarks)
      ? (parsed as Partial<TimelineBookmarkFile>).bookmarks
      : undefined;
  if (!bookmarks) {
    throw new Error('Bookmark file must contain a bookmarks array.');
  }
  return normalizeTimelineBookmarks(bookmarks as TimelineBookmark[], maxTime);
}

export function mergeImportedTimelineBookmarks(existing: TimelineBookmark[], imported: TimelineBookmark[], maxTime?: number): TimelineBookmark[] {
  const next = normalizeTimelineBookmarks(existing, maxTime);
  const usedIds = new Set(next.map((bookmark) => bookmark.id));
  for (const bookmark of normalizeTimelineBookmarks(imported, maxTime)) {
    const id = usedIds.has(bookmark.id) ? createId('bookmark') : bookmark.id;
    usedIds.add(id);
    next.push({ ...bookmark, id });
  }
  return normalizeTimelineBookmarks(next, maxTime);
}

export function buildTimelineNavigationPoints(bookmarks: TimelineBookmark[] | undefined, markers: TimelineMarker[] | undefined, maxTime?: number): TimelineNavigationPoint[] {
  const bookmarkPoints: TimelineNavigationPoint[] = normalizeTimelineBookmarks(bookmarks, maxTime).map((bookmark) => ({
    id: bookmark.id,
    type: 'bookmark',
    time: bookmark.time,
    label: bookmark.note
  }));
  const markerPoints: TimelineNavigationPoint[] = [...(markers ?? [])].map((marker) => ({
    id: marker.id,
    type: 'marker',
    time: marker.time,
    label: marker.label
  }));
  return [...bookmarkPoints, ...markerPoints].sort((left, right) => left.time - right.time || left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
}

export function findTimelineNavigationPoint(points: TimelineNavigationPoint[], currentTime: number, direction: 'next' | 'previous'): TimelineNavigationPoint | undefined {
  const time = Number.isFinite(currentTime) ? currentTime : 0;
  const sorted = [...points].sort((left, right) => left.time - right.time || left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
  if (direction === 'next') {
    return sorted.find((point) => point.time > time + NAVIGATION_EPSILON);
  }
  return sorted
    .slice()
    .reverse()
    .find((point) => point.time < time - NAVIGATION_EPSILON);
}
