export const MAX_MERGE_HISTORY_ENTRIES = 100;
export function createEmptyMergeHistory() {
    return { entries: [] };
}
export function addMergeHistoryEntry(store, entry) {
    const entries = [entry, ...store.entries].slice(0, MAX_MERGE_HISTORY_ENTRIES);
    return { entries };
}
export function undoLastMergeEntry(store) {
    const entry = store.entries[0];
    if (!entry) {
        return { store, entry: undefined };
    }
    return {
        store: { entries: store.entries.slice(1) },
        entry,
    };
}
export function buildQualityComparison(groupId, assets) {
    if (assets.length === 0) {
        return { groupId, assets: [], recommendedKeepAssetId: '' };
    }
    const sorted = [...assets].sort((a, b) => {
        const aScore = a.width * a.height + a.bitrate;
        const bScore = b.width * b.height + b.bitrate;
        return bScore - aScore;
    });
    return {
        groupId,
        assets: sorted,
        recommendedKeepAssetId: sorted[0].assetId,
    };
}
export function buildRecycleBinArgs(filePath) {
    return ['--recycle', filePath];
}
export function detectCrossProjectDuplicates(currentMedia, sharedLibrary) {
    const duplicates = [];
    const sharedByHash = new Map();
    for (const asset of sharedLibrary) {
        if (asset.headHash && asset.size && asset.size > 0) {
            const key = `${asset.size}|${asset.headHash}`;
            const group = sharedByHash.get(key) ?? [];
            group.push(asset);
            sharedByHash.set(key, group);
        }
    }
    for (const asset of currentMedia) {
        if (!asset.headHash || !asset.size || asset.size <= 0)
            continue;
        const key = `${asset.size}|${asset.headHash}`;
        const matches = sharedByHash.get(key);
        if (matches) {
            for (const match of matches) {
                if (match.id !== asset.id) {
                    duplicates.push({
                        currentAssetId: asset.id,
                        sharedAssetId: match.id,
                        reason: `文件大小和内容哈希匹配 (${formatBytes(asset.size)})`,
                    });
                }
            }
        }
    }
    return duplicates;
}
export function serializeMergeHistory(store) {
    return JSON.stringify(store);
}
export function deserializeMergeHistory(json) {
    try {
        const parsed = JSON.parse(json);
        if (parsed && Array.isArray(parsed.entries)) {
            return {
                entries: parsed.entries
                    .filter((e) => typeof e === 'object' && e !== null && typeof e.id === 'string')
                    .slice(0, MAX_MERGE_HISTORY_ENTRIES),
            };
        }
    }
    catch {
        // ignore
    }
    return createEmptyMergeHistory();
}
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024)
        return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}
//# sourceMappingURL=duplicate-media-merge.js.map