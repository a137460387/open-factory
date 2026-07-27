import { createId } from './model';
export function getAnnotationSyncFilename(projectId) {
    return `annotations_${projectId}.json`;
}
export function packAnnotationSyncData(projectId, notes, bookmarks, markers, syncedAt) {
    return {
        version: 1,
        projectId,
        syncedAt: syncedAt ?? new Date().toISOString(),
        notes: notes.map((n) => ({ ...n, id: n.id || createId('note') })),
        bookmarks: bookmarks.map((b) => ({ ...b, id: b.id || createId('bookmark') })),
        markers: markers.map((m) => ({ ...m, id: m.id || createId('marker') })),
    };
}
export function serializeAnnotationSyncData(data) {
    return JSON.stringify(data, null, 2) + '\n';
}
export function parseAnnotationSyncData(contents) {
    try {
        const parsed = JSON.parse(contents);
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
    }
    catch {
        return undefined;
    }
}
export function mergeAnnotationSyncData(local, remote, mergedAt) {
    const now = mergedAt ?? new Date().toISOString();
    const conflicts = [];
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
function mergeById(local, remote, type, conflicts, now) {
    const localMap = new Map(local.map((item) => [item.id, item]));
    const remoteMap = new Map(remote.map((item) => [item.id, item]));
    const mergedIds = new Set();
    const result = [];
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
        }
        else if (remoteTime > localTime) {
            result.push(remoteItem);
            conflicts.push({
                id,
                type,
                localUpdatedAt: localItem.updatedAt,
                remoteUpdatedAt: remoteItem.updatedAt,
                resolvedTo: 'remote',
            });
        }
        else {
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
//# sourceMappingURL=annotation-sync.js.map