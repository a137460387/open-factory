import { createId } from './model';

export type AnnotationSyncStatus = 'synced' | 'syncing' | 'conflict' | 'offline';

export interface AnnotationSyncNote {
  id: string;
  start: number;
  end: number;
  text: string;
  color: string;
  authorName: string;
  resolved: boolean;
  updatedAt: string;
}

export interface AnnotationSyncBookmark {
  id: string;
  time: number;
  note: string;
  updatedAt: string;
}

export interface AnnotationSyncMarker {
  id: string;
  time: number;
  label: string;
  updatedAt: string;
}

export interface AnnotationSyncData {
  version: 1;
  projectId: string;
  syncedAt: string;
  notes: AnnotationSyncNote[];
  bookmarks: AnnotationSyncBookmark[];
  markers: AnnotationSyncMarker[];
}

export interface AnnotationSyncConflict {
  id: string;
  type: 'note' | 'bookmark' | 'marker';
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  resolvedTo: 'local' | 'remote';
}

export interface AnnotationSyncMergeResult {
  merged: AnnotationSyncData;
  conflicts: AnnotationSyncConflict[];
  mergedAt: string;
}

export function getAnnotationSyncFilename(projectId: string): string {
  return `annotations_${projectId}.json`;
}

export function packAnnotationSyncData(
  projectId: string,
  notes: AnnotationSyncNote[],
  bookmarks: AnnotationSyncBookmark[],
  markers: AnnotationSyncMarker[],
  syncedAt?: string,
): AnnotationSyncData {
  return {
    version: 1,
    projectId,
    syncedAt: syncedAt ?? new Date().toISOString(),
    notes: notes.map((n) => ({ ...n, id: n.id || createId('note') })),
    bookmarks: bookmarks.map((b) => ({ ...b, id: b.id || createId('bookmark') })),
    markers: markers.map((m) => ({ ...m, id: m.id || createId('marker') })),
  };
}

export function serializeAnnotationSyncData(data: AnnotationSyncData): string {
  return JSON.stringify(data, null, 2) + '\n';
}

export function parseAnnotationSyncData(contents: string): AnnotationSyncData | undefined {
  try {
    const parsed = JSON.parse(contents) as Partial<AnnotationSyncData>;
    if (!parsed || parsed.version !== 1 || typeof parsed.projectId !== 'string') {
      return undefined;
    }
    return {
      version: 1,
      projectId: parsed.projectId,
      syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : new Date(0).toISOString(),
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    };
  } catch {
    return undefined;
  }
}

export function mergeAnnotationSyncData(
  local: AnnotationSyncData,
  remote: AnnotationSyncData,
  mergedAt?: string,
): AnnotationSyncMergeResult {
  const now = mergedAt ?? new Date().toISOString();
  const conflicts: AnnotationSyncConflict[] = [];

  const mergedNotes = mergeById(local.notes, remote.notes, 'note', conflicts, now);
  const mergedBookmarks = mergeById(local.bookmarks, remote.bookmarks, 'bookmark', conflicts, now);
  const mergedMarkers = mergeById(local.markers, remote.markers, 'marker', conflicts, now);

  return {
    merged: {
      version: 1,
      projectId: local.projectId,
      syncedAt: now,
      notes: mergedNotes,
      bookmarks: mergedBookmarks,
      markers: mergedMarkers,
    },
    conflicts,
    mergedAt: now,
  };
}

function mergeById<T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[],
  type: AnnotationSyncConflict['type'],
  conflicts: AnnotationSyncConflict[],
  now: string,
): T[] {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const mergedIds = new Set<string>();
  const result: T[] = [];

  for (const [id, localItem] of localMap) {
    const remoteItem = remoteMap.get(id);
    if (!remoteItem) {
      result.push(localItem);
      mergedIds.add(id);
      continue;
    }
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
    if (localTime > remoteTime) {
      result.push(localItem);
      if (localTime !== remoteTime) {
        conflicts.push({
          id,
          type,
          localUpdatedAt: localItem.updatedAt,
          remoteUpdatedAt: remoteItem.updatedAt,
          resolvedTo: 'local',
        });
      }
    } else if (remoteTime > localTime) {
      result.push(remoteItem);
      conflicts.push({
        id,
        type,
        localUpdatedAt: localItem.updatedAt,
        remoteUpdatedAt: remoteItem.updatedAt,
        resolvedTo: 'remote',
      });
    } else {
      result.push(localItem);
    }
    mergedIds.add(id);
  }

  for (const [id, remoteItem] of remoteMap) {
    if (!mergedIds.has(id)) {
      result.push(remoteItem);
      mergedIds.add(id);
    }
  }

  return result.sort((a, b) => a.id.localeCompare(b.id));
}
