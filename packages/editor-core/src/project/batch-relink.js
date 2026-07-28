export function planBatchRelinkByFileName(media, candidates, options = {}) {
    const caseInsensitive = options.caseInsensitive ?? false;
    const candidateIndex = new Map();
    for (const candidate of candidates) {
        const key = normalizeKey(fileNameFromPath(candidate.path), caseInsensitive);
        const paths = candidateIndex.get(key) ?? [];
        paths.push(candidate.path);
        candidateIndex.set(key, paths);
    }
    const replacements = [];
    const warnings = [];
    for (const asset of media.filter((item) => item.missing)) {
        const fileName = asset.name || fileNameFromPath(asset.path);
        const candidatePaths = candidateIndex.get(normalizeKey(fileName, caseInsensitive)) ?? [];
        if (candidatePaths.length === 0) {
            warnings.push({ assetId: asset.id, fileName, reason: 'no-match', candidatePaths: [] });
            continue;
        }
        if (candidatePaths.length > 1) {
            warnings.push({ assetId: asset.id, fileName, reason: 'duplicate-candidates', candidatePaths });
            continue;
        }
        replacements.push({ assetId: asset.id, candidatePath: candidatePaths[0] });
    }
    return { replacements, warnings };
}
export function fileNameFromPath(path) {
    return path.replace(/\\/g, '/').split('/').pop() ?? path;
}
function normalizeKey(value, caseInsensitive) {
    return caseInsensitive ? value.toLocaleLowerCase() : value;
}
//# sourceMappingURL=batch-relink.js.map