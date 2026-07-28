import type { MediaAsset, MediaMetadata } from './model-types';
export interface MediaTagFrequency {
    tag: string;
    count: number;
    isColorTag: boolean;
}
export interface MediaTagFilter {
    tags: string[];
    mode: 'and';
}
export declare const MEDIA_COLOR_TAG_PREFIX = "color:";
export declare function buildMediaTagIndex(media: MediaAsset[], metadata: Record<string, MediaMetadata>): Map<string, Set<string>>;
export declare function collectAssetTags(asset: MediaAsset, meta?: MediaMetadata): string[];
export declare function buildTagFrequencies(tagIndex: Map<string, Set<string>>): MediaTagFrequency[];
export declare function filterMediaByTags(media: MediaAsset[], metadata: Record<string, MediaMetadata>, filter: MediaTagFilter): MediaAsset[];
export declare function renameTag(metadata: Record<string, MediaMetadata>, oldTag: string, newTag: string): Record<string, MediaMetadata>;
export declare function deleteTag(metadata: Record<string, MediaMetadata>, tagToDelete: string): Record<string, MediaMetadata>;
export declare function normalizeTag(tag: string): string;
//# sourceMappingURL=media-tags.d.ts.map