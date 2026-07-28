import { createId } from './model';
export const MAX_MEDIA_FOLDER_DEPTH = 3;
export function createMediaFolder(input = {}, existingFolders = [], now = new Date().toISOString()) {
    const parentId = input.parentId && existingFolders.some((folder) => folder.id === input.parentId) ? input.parentId : null;
    if (parentId && getMediaFolderDepth(existingFolders, parentId) >= MAX_MEDIA_FOLDER_DEPTH) {
        throw new Error(`Media folder nesting is limited to ${MAX_MEDIA_FOLDER_DEPTH} levels.`);
    }
    return {
        id: sanitizeMediaFolderId(input.id) || createId('media-folder'),
        name: sanitizeMediaFolderName(input.name),
        parentId,
        collapsed: input.collapsed === true,
        createdAt: isValidDateString(input.createdAt) ? input.createdAt : now,
    };
}
export function normalizeMediaFolders(input) {
    const output = [];
    for (const folder of input ?? []) {
        const id = sanitizeMediaFolderId(folder.id);
        if (!id || output.some((item) => item.id === id)) {
            continue;
        }
        const parentId = folder.parentId && output.some((item) => item.id === folder.parentId) ? folder.parentId : null;
        if (parentId && getMediaFolderDepth(output, parentId) >= MAX_MEDIA_FOLDER_DEPTH) {
            continue;
        }
        output.push({
            id,
            name: sanitizeMediaFolderName(folder.name),
            parentId,
            collapsed: folder.collapsed === true,
            createdAt: isValidDateString(folder.createdAt) ? folder.createdAt : new Date(0).toISOString(),
        });
    }
    return output;
}
export function normalizeMediaFolderId(folderId, folders) {
    return folderId && folders.some((folder) => folder.id === folderId) ? folderId : null;
}
export function getMediaFolderDepth(folders, folderId) {
    if (!folderId) {
        return 0;
    }
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) {
        return 0;
    }
    const visited = new Set();
    let depth = 0;
    let current = folder;
    while (current) {
        if (visited.has(current.id)) {
            return MAX_MEDIA_FOLDER_DEPTH + 1;
        }
        visited.add(current.id);
        depth += 1;
        current = current.parentId ? folders.find((item) => item.id === current?.parentId) : undefined;
    }
    return depth;
}
export function addMediaFolderToProject(project, input = {}, now = new Date().toISOString()) {
    const folders = normalizeMediaFolders(project.mediaFolders);
    const folder = createMediaFolder(input, folders, now);
    const next = {
        ...project,
        mediaFolders: [...folders, folder],
        updatedAt: now,
    };
    return { project: next, folder };
}
export function renameMediaFolder(project, folderId, name, now = new Date().toISOString()) {
    return {
        ...project,
        mediaFolders: normalizeMediaFolders(project.mediaFolders).map((folder) => folder.id === folderId ? { ...folder, name: sanitizeMediaFolderName(name) } : folder),
        updatedAt: now,
    };
}
export function setMediaFolderCollapsed(project, folderId, collapsed, now = new Date().toISOString()) {
    return {
        ...project,
        mediaFolders: normalizeMediaFolders(project.mediaFolders).map((folder) => folder.id === folderId ? { ...folder, collapsed } : folder),
        updatedAt: now,
    };
}
export function deleteMediaFolder(project, folderId, now = new Date().toISOString()) {
    const folders = normalizeMediaFolders(project.mediaFolders);
    const removed = collectDescendantFolderIds(folders, folderId);
    removed.add(folderId);
    return {
        ...project,
        mediaFolders: folders.filter((folder) => !removed.has(folder.id)),
        media: project.media.map((asset) => asset.folderId && removed.has(asset.folderId) ? { ...asset, folderId: null } : asset),
        updatedAt: now,
    };
}
export function moveMediaAssetsToFolder(project, assetIds, folderId, now = new Date().toISOString()) {
    const ids = new Set(assetIds);
    const folders = normalizeMediaFolders(project.mediaFolders);
    const nextFolderId = normalizeMediaFolderId(folderId, folders);
    return {
        ...project,
        mediaFolders: folders,
        media: project.media.map((asset) => ids.has(asset.id)
            ? { ...asset, folderId: nextFolderId }
            : { ...asset, folderId: normalizeMediaFolderId(asset.folderId, folders) }),
        updatedAt: now,
    };
}
export function collectSmartAlbums(media, nowMs = Date.now(), metadata = {}, extras) {
    const albums = [
        { id: 'rating-five', assetIds: [] },
        { id: 'flag-green', assetIds: [] },
        { id: 'flag-red', assetIds: [] },
        { id: 'format-video', assetIds: [] },
        { id: 'format-audio', assetIds: [] },
        { id: 'format-image', assetIds: [] },
        { id: 'format-svg', assetIds: [] },
        { id: 'duration-short', assetIds: [] },
        { id: 'duration-medium', assetIds: [] },
        { id: 'duration-long', assetIds: [] },
        { id: 'recent-imports', assetIds: [] },
        { id: 'favorites', assetIds: [] },
        { id: 'recent-use', assetIds: [] },
    ];
    const byId = new Map(albums.map((album) => [album.id, album]));
    for (const asset of media) {
        const assetMetadata = metadata[asset.id];
        if ((assetMetadata?.rating ?? 0) >= 5) {
            byId.get('rating-five')?.assetIds.push(asset.id);
        }
        if (assetMetadata?.flag === 'green') {
            byId.get('flag-green')?.assetIds.push(asset.id);
        }
        if (assetMetadata?.flag === 'red') {
            byId.get('flag-red')?.assetIds.push(asset.id);
        }
        byId.get(formatAlbumId(asset))?.assetIds.push(asset.id);
        byId.get(durationAlbumId(asset.duration))?.assetIds.push(asset.id);
        if (isRecentImport(asset.importedAt, nowMs)) {
            byId.get('recent-imports')?.assetIds.push(asset.id);
        }
    }
    if (extras?.favoriteIds) {
        for (const id of extras.favoriteIds) {
            byId.get('favorites')?.assetIds.push(id);
        }
    }
    if (extras?.recentUseIds) {
        for (const id of extras.recentUseIds) {
            byId.get('recent-use')?.assetIds.push(id);
        }
    }
    return albums;
}
export function getSmartAlbumAssetIds(media, albumId, nowMs = Date.now(), metadata = {}) {
    return collectSmartAlbums(media, nowMs, metadata).find((album) => album.id === albumId)?.assetIds ?? [];
}
export function normalizeMediaImportedAt(value, fallback) {
    return isValidDateString(value) ? value : isValidDateString(fallback) ? fallback : undefined;
}
function sanitizeMediaFolderId(value) {
    return typeof value === 'string' && value.trim() ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '-') : '';
}
function sanitizeMediaFolderName(value) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return (trimmed || 'New Folder').slice(0, 80);
}
function collectDescendantFolderIds(folders, folderId) {
    const removed = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        for (const folder of folders) {
            if (!removed.has(folder.id) &&
                (folder.parentId === folderId || (folder.parentId && removed.has(folder.parentId)))) {
                removed.add(folder.id);
                changed = true;
            }
        }
    }
    return removed;
}
function formatAlbumId(asset) {
    if (/\.svg$/i.test(asset.path) || /\.svg$/i.test(asset.name)) {
        return 'format-svg';
    }
    if (asset.type === 'video') {
        return 'format-video';
    }
    if (asset.type === 'audio') {
        return 'format-audio';
    }
    return 'format-image';
}
function durationAlbumId(duration) {
    if (duration < 30) {
        return 'duration-short';
    }
    if (duration <= 300) {
        return 'duration-medium';
    }
    return 'duration-long';
}
function isRecentImport(importedAt, nowMs) {
    if (!isValidDateString(importedAt)) {
        return false;
    }
    const ageMs = nowMs - Date.parse(importedAt);
    return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}
function isValidDateString(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
//# sourceMappingURL=media-folders.js.map