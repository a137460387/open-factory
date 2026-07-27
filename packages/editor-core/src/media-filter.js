export function filterMediaAssets(media, options = {}) {
    const query = options.query?.trim().toLowerCase() ?? '';
    const legacyFilter = options.filter ?? 'all';
    const typeFilter = options.typeFilter ?? (isAssetTypeFilter(legacyFilter) ? legacyFilter : 'all');
    const metadataFilter = options.metadataFilter ?? (isMetadataFilter(legacyFilter) ? legacyFilter : 'all');
    return media.filter((asset) => {
        const matchesSearch = query.length === 0 ||
            asset.name.toLowerCase().includes(query) ||
            (asset.aiAnalysis?.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
        const matchesType = typeFilter === 'all' || asset.type === typeFilter;
        const matchesMetadata = mediaMetadataMatchesFilter(options.metadata?.[asset.id], metadataFilter);
        return matchesSearch && matchesType && matchesMetadata;
    });
}
function isAssetTypeFilter(filter) {
    return filter === 'video' || filter === 'audio' || filter === 'image';
}
function isMetadataFilter(filter) {
    return filter === 'tagged' || filter === 'selected' || filter === 'rejected' || filter === 'five-star';
}
function mediaMetadataMatchesFilter(metadata, filter) {
    if (filter === 'all') {
        return true;
    }
    if (filter === 'tagged') {
        return Boolean(metadata?.labelColor);
    }
    if (filter === 'selected') {
        return metadata?.flag === 'green';
    }
    if (filter === 'rejected') {
        return metadata?.flag === 'red';
    }
    return (metadata?.rating ?? 0) >= 5;
}
//# sourceMappingURL=media-filter.js.map