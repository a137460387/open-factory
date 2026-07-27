import { type MediaAsset, type MediaFolder, type MediaMetadata, type Project } from './model';
export declare const MAX_MEDIA_FOLDER_DEPTH = 3;
export type SmartAlbumId = 'rating-five' | 'flag-green' | 'flag-red' | 'format-video' | 'format-audio' | 'format-image' | 'format-svg' | 'duration-short' | 'duration-medium' | 'duration-long' | 'recent-imports' | 'favorites' | 'recent-use';
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
export declare function createMediaFolder(input?: MediaFolderInput, existingFolders?: MediaFolder[], now?: string): MediaFolder;
export declare function normalizeMediaFolders(input: MediaFolder[] | undefined): MediaFolder[];
export declare function normalizeMediaFolderId(folderId: string | null | undefined, folders: MediaFolder[]): string | null;
export declare function getMediaFolderDepth(folders: MediaFolder[], folderId: string | null | undefined): number;
export declare function addMediaFolderToProject(project: Project, input?: MediaFolderInput, now?: string): {
    project: Project;
    folder: MediaFolder;
};
export declare function renameMediaFolder(project: Project, folderId: string, name: string, now?: string): Project;
export declare function setMediaFolderCollapsed(project: Project, folderId: string, collapsed: boolean, now?: string): Project;
export declare function deleteMediaFolder(project: Project, folderId: string, now?: string): Project;
export declare function moveMediaAssetsToFolder(project: Project, assetIds: string[], folderId: string | null | undefined, now?: string): Project;
export interface CollectSmartAlbumsExtras {
    favoriteIds?: string[];
    recentUseIds?: string[];
}
export declare function collectSmartAlbums(media: MediaAsset[], nowMs?: number, metadata?: Record<string, MediaMetadata>, extras?: CollectSmartAlbumsExtras): SmartAlbum[];
export declare function getSmartAlbumAssetIds(media: MediaAsset[], albumId: SmartAlbumId, nowMs?: number, metadata?: Record<string, MediaMetadata>): string[];
export declare function normalizeMediaImportedAt(value: string | undefined, fallback?: string): string | undefined;
//# sourceMappingURL=media-folders.d.ts.map