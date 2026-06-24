import { createId, type MediaAsset, type MediaFolder, type MediaMetadata, type Project } from './model';

export const MAX_MEDIA_FOLDER_DEPTH = 3;

export type SmartAlbumId =
  | 'rating-five'
  | 'flag-green'
  | 'flag-red'
  | 'format-video'
  | 'format-audio'
  | 'format-image'
  | 'format-svg'
  | 'duration-short'
  | 'duration-medium'
  | 'duration-long'
  | 'recent-imports'
  | 'favorites'
  | 'recent-use';

export interface SmartAlbum {
  id: SmartAlbumId;
  assetIds: string[];
}

export interface MediaFolderInput {
  id?: string;
  name?: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt?: string;
}

export function createMediaFolder(input: MediaFolderInput = {}, existingFolders: MediaFolder[] = [], now = new Date().toISOString()): MediaFolder {
  const parentId = input.parentId && existingFolders.some((folder) => folder.id === input.parentId) ? input.parentId : null;
  if (parentId && getMediaFolderDepth(existingFolders, parentId) >= MAX_MEDIA_FOLDER_DEPTH) {
    throw new Error(`Media folder nesting is limited to ${MAX_MEDIA_FOLDER_DEPTH} levels.`);
  }
  return {
    id: sanitizeMediaFolderId(input.id) || createId('media-folder'),
    name: sanitizeMediaFolderName(input.name),
    parentId,
    collapsed: input.collapsed === true,
    createdAt: isValidDateString(input.createdAt) ? input.createdAt! : now
  };
}

export function normalizeMediaFolders(input: MediaFolder[] | undefined): MediaFolder[] {
  const output: MediaFolder[] = [];
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
      createdAt: isValidDateString(folder.createdAt) ? folder.createdAt : new Date(0).toISOString()
    });
  }
  return output;
}

export function normalizeMediaFolderId(folderId: string | null | undefined, folders: MediaFolder[]): string | null {
  return folderId && folders.some((folder) => folder.id === folderId) ? folderId : null;
}

export function getMediaFolderDepth(folders: MediaFolder[], folderId: string | null | undefined): number {
  if (!folderId) {
    return 0;
  }
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return 0;
  }
  const visited = new Set<string>();
  let depth = 0;
  let current: MediaFolder | undefined = folder;
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

export function addMediaFolderToProject(project: Project, input: MediaFolderInput = {}, now = new Date().toISOString()): { project: Project; folder: MediaFolder } {
  const folders = normalizeMediaFolders(project.mediaFolders);
  const folder = createMediaFolder(input, folders, now);
  const next = {
    ...project,
    mediaFolders: [...folders, folder],
    updatedAt: now
  };
  return { project: next, folder };
}

export function renameMediaFolder(project: Project, folderId: string, name: string, now = new Date().toISOString()): Project {
  return {
    ...project,
    mediaFolders: normalizeMediaFolders(project.mediaFolders).map((folder) => (folder.id === folderId ? { ...folder, name: sanitizeMediaFolderName(name) } : folder)),
    updatedAt: now
  };
}

export function setMediaFolderCollapsed(project: Project, folderId: string, collapsed: boolean, now = new Date().toISOString()): Project {
  return {
    ...project,
    mediaFolders: normalizeMediaFolders(project.mediaFolders).map((folder) => (folder.id === folderId ? { ...folder, collapsed } : folder)),
    updatedAt: now
  };
}

export function deleteMediaFolder(project: Project, folderId: string, now = new Date().toISOString()): Project {
  const folders = normalizeMediaFolders(project.mediaFolders);
  const removed = collectDescendantFolderIds(folders, folderId);
  removed.add(folderId);
  return {
    ...project,
    mediaFolders: folders.filter((folder) => !removed.has(folder.id)),
    media: project.media.map((asset) => (asset.folderId && removed.has(asset.folderId) ? { ...asset, folderId: null } : asset)),
    updatedAt: now
  };
}

export function moveMediaAssetsToFolder(project: Project, assetIds: string[], folderId: string | null | undefined, now = new Date().toISOString()): Project {
  const ids = new Set(assetIds);
  const folders = normalizeMediaFolders(project.mediaFolders);
  const nextFolderId = normalizeMediaFolderId(folderId, folders);
  return {
    ...project,
    mediaFolders: folders,
    media: project.media.map((asset) => (ids.has(asset.id) ? { ...asset, folderId: nextFolderId } : { ...asset, folderId: normalizeMediaFolderId(asset.folderId, folders) })),
    updatedAt: now
  };
}

export interface CollectSmartAlbumsExtras { favoriteIds?: string[]; recentUseIds?: string[]; }

export function collectSmartAlbums(media: MediaAsset[], nowMs = Date.now(), metadata: Record<string, MediaMetadata> = {}, extras?: CollectSmartAlbumsExtras): SmartAlbum[] {
  const albums: SmartAlbum[] = [
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
    { id: 'recent-use', assetIds: [] }
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

export function getSmartAlbumAssetIds(media: MediaAsset[], albumId: SmartAlbumId, nowMs = Date.now(), metadata: Record<string, MediaMetadata> = {}): string[] {
  return collectSmartAlbums(media, nowMs, metadata).find((album) => album.id === albumId)?.assetIds ?? [];
}

export function normalizeMediaImportedAt(value: string | undefined, fallback?: string): string | undefined {
  return isValidDateString(value) ? value : isValidDateString(fallback) ? fallback : undefined;
}

function sanitizeMediaFolderId(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '-') : '';
}

function sanitizeMediaFolderName(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return (trimmed || 'New Folder').slice(0, 80);
}

function collectDescendantFolderIds(folders: MediaFolder[], folderId: string): Set<string> {
  const removed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (!removed.has(folder.id) && (folder.parentId === folderId || (folder.parentId && removed.has(folder.parentId)))) {
        removed.add(folder.id);
        changed = true;
      }
    }
  }
  return removed;
}

function formatAlbumId(asset: MediaAsset): SmartAlbumId {
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

function durationAlbumId(duration: number): SmartAlbumId {
  if (duration < 30) {
    return 'duration-short';
  }
  if (duration <= 300) {
    return 'duration-medium';
  }
  return 'duration-long';
}

function isRecentImport(importedAt: string | undefined, nowMs: number): boolean {
  if (!isValidDateString(importedAt)) {
    return false;
  }
  const ageMs = nowMs - Date.parse(importedAt as string);
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}

function isValidDateString(value: string | undefined): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
