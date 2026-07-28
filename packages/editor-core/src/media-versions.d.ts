import type { MediaAsset, MediaMetadata, MediaVersion, Project } from './model-types';
export interface MediaVersionEntry {
    id: string;
    label: string;
    assetId: string;
    path: string;
    name: string;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    isOriginal: boolean;
}
export interface MediaVersionCompareRequest {
    assetId: string;
    time: number;
    left: MediaVersionEntry;
    right: MediaVersionEntry;
}
export declare function getMediaVersionLabel(index: number): string;
export declare function createMediaVersionFromAsset(asset: MediaAsset, index?: number, createdAt?: string): MediaVersion;
export declare function normalizeMediaVersion(value: unknown): MediaVersion | undefined;
export declare function normalizeMediaVersions(value: unknown): MediaVersion[] | undefined;
export declare function listMediaVersionEntries(asset: MediaAsset, metadata?: MediaMetadata, media?: MediaAsset[]): MediaVersionEntry[];
export declare function addMediaVersion(metadata: MediaMetadata | undefined, asset: MediaAsset): MediaMetadata;
export declare function removeMediaVersion(metadata: MediaMetadata | undefined, versionId: string): MediaMetadata | undefined;
export declare function findMediaVersionOwner(project: Pick<Project, 'media' | 'mediaMetadata'>, mediaId: string): MediaAsset | undefined;
export declare function findMediaVersionAsset(project: Pick<Project, 'media'>, entry: Pick<MediaVersionEntry, 'assetId'>): MediaAsset | undefined;
export declare function buildMediaVersionCompareRequest(project: Pick<Project, 'media' | 'mediaMetadata'>, assetId: string, leftVersionId?: string, rightVersionId?: string, time?: number): MediaVersionCompareRequest | undefined;
//# sourceMappingURL=media-versions.d.ts.map