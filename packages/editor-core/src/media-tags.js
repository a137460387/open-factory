export const MEDIA_COLOR_TAG_PREFIX = 'color:';
export function buildMediaTagIndex(media, metadata) {
    const tagToAssetIds = new Map();
    for (const asset of media) {
        const meta = metadata[asset.id];
        const tags = collectAssetTags(asset, meta);
        for (const tag of tags) {
            let set = tagToAssetIds.get(tag);
            if (!set) {
                set = new Set();
                tagToAssetIds.set(tag, set);
            }
            set.add(asset.id);
        }
    }
    return tagToAssetIds;
}
export function collectAssetTags(asset, meta) {
    const tags = [];
    if (meta?.labelColor) {
        tags.push(`${MEDIA_COLOR_TAG_PREFIX}${meta.labelColor}`);
    }
    if (meta?.customTags) {
        for (const tag of meta.customTags) {
            if (tag && !tags.includes(tag)) {
                tags.push(tag);
            }
        }
    }
    return tags;
}
export function buildTagFrequencies(tagIndex) {
    const frequencies = [];
    for (const [tag, assetIds] of tagIndex) {
        frequencies.push({
            tag,
            count: assetIds.size,
            isColorTag: tag.startsWith(MEDIA_COLOR_TAG_PREFIX),
        });
    }
    return frequencies.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
export function filterMediaByTags(media, metadata, filter) {
    if (filter.tags.length === 0) {
        return media;
    }
    return media.filter((asset) => {
        const tags = collectAssetTags(asset, metadata[asset.id]);
        return filter.tags.every((filterTag) => tags.includes(filterTag));
    });
}
export function renameTag(metadata, oldTag, newTag) {
    if (!oldTag || !newTag || oldTag === newTag) {
        return metadata;
    }
    const updated = {};
    for (const [assetId, meta] of Object.entries(metadata)) {
        if (!meta.customTags || !meta.customTags.includes(oldTag)) {
            updated[assetId] = meta;
            continue;
        }
        updated[assetId] = {
            ...meta,
            customTags: meta.customTags.map((t) => (t === oldTag ? newTag : t)),
        };
    }
    return updated;
}
export function deleteTag(metadata, tagToDelete) {
    if (!tagToDelete) {
        return metadata;
    }
    const updated = {};
    for (const [assetId, meta] of Object.entries(metadata)) {
        if (!meta.customTags || !meta.customTags.includes(tagToDelete)) {
            updated[assetId] = meta;
            continue;
        }
        const filtered = meta.customTags.filter((t) => t !== tagToDelete);
        updated[assetId] = {
            ...meta,
            customTags: filtered.length > 0 ? filtered : undefined,
        };
    }
    return updated;
}
export function normalizeTag(tag) {
    return tag.trim().toLowerCase();
}
//# sourceMappingURL=media-tags.js.map