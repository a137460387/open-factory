const PROXY_SUFFIX_PATTERNS = [
    /(?:[\s._-]+(?:proxy|prox|offline|lowres|low-res|low_resolution|preview|draft))(?:[\s._-]*(?:\d{3,4}p|uhd|hd|hq|lq|cfr|edit))?$/i,
    /(?:[\s._-]+(?:\d{3,4}p|uhd|hd|hq|lq|draft|edit))(?:[\s._-]+(?:proxy|prox|offline|lowres|low-res|low_resolution|preview))$/i,
];
export function stripProxySuffix(pathOrName) {
    let stem = stripExtension(fileNameFromPath(pathOrName)).trim();
    let changed = true;
    while (changed) {
        changed = false;
        for (const pattern of PROXY_SUFFIX_PATTERNS) {
            const next = stem.replace(pattern, '').trim();
            if (next !== stem && next.length > 0) {
                stem = next;
                changed = true;
            }
        }
    }
    return stem;
}
export function buildConformFilenameKey(pathOrName, options = {}) {
    const key = stripProxySuffix(pathOrName).replace(/\s+/g, ' ').trim();
    return (options.caseInsensitive ?? true) ? key.toLocaleLowerCase() : key;
}
export function matchConformByFilename(media, candidates, options = {}) {
    const candidateIndex = new Map();
    for (const candidate of candidates) {
        const key = buildConformFilenameKey(candidate.name ?? candidate.path, options);
        const matches = candidateIndex.get(key) ?? [];
        matches.push(candidate);
        candidateIndex.set(key, matches);
    }
    return media.map((asset) => {
        const key = buildConformFilenameKey(asset.name || asset.path, options);
        const matches = candidateIndex.get(key) ?? [];
        if (matches.length === 0) {
            return { assetId: asset.id, strategy: 'filename', failureReason: 'not-found', candidatePaths: [] };
        }
        if (matches.length > 1) {
            return {
                assetId: asset.id,
                strategy: 'filename',
                failureReason: 'duplicate-candidates',
                candidatePaths: matches.map((candidate) => candidate.path),
            };
        }
        return { assetId: asset.id, strategy: 'filename', candidate: matches[0], candidatePaths: [matches[0].path] };
    });
}
export function matchConformByTimecode(media, candidates) {
    const candidateIndex = new Map();
    for (const candidate of candidates) {
        const timecode = normalizeTimecode(readTimecode(candidate));
        if (!timecode) {
            continue;
        }
        const matches = candidateIndex.get(timecode) ?? [];
        matches.push(candidate);
        candidateIndex.set(timecode, matches);
    }
    return media.map((asset) => {
        const timecode = normalizeTimecode(readTimecode(asset));
        const matches = timecode ? (candidateIndex.get(timecode) ?? []) : [];
        if (matches.length === 0) {
            return { assetId: asset.id, strategy: 'timecode', failureReason: 'not-found', candidatePaths: [] };
        }
        if (matches.length > 1) {
            return {
                assetId: asset.id,
                strategy: 'timecode',
                failureReason: 'duplicate-candidates',
                candidatePaths: matches.map((candidate) => candidate.path),
            };
        }
        return { assetId: asset.id, strategy: 'timecode', candidate: matches[0], candidatePaths: [matches[0].path] };
    });
}
export function buildManualConformMatches(pairings) {
    return pairings.map((pairing) => ({
        assetId: pairing.assetId,
        strategy: 'manual',
        candidate: pairing.candidate,
        candidatePaths: pairing.candidate ? [pairing.candidate.path] : [],
        failureReason: pairing.candidate ? undefined : 'not-found',
    }));
}
export function buildConformPreflight(media, matches, options = {}) {
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    const selectedAssetIds = options.selectedAssetIds ? new Set(options.selectedAssetIds) : undefined;
    return matches.map((match) => {
        const asset = mediaById.get(match.assetId);
        const candidatePath = match.candidate?.path;
        const candidatePaths = match.candidatePaths ?? (candidatePath ? [candidatePath] : []);
        if (!asset) {
            return {
                assetId: match.assetId,
                proxyName: '',
                proxyPath: '',
                strategy: match.strategy,
                candidatePath,
                selected: selectedAssetIds ? selectedAssetIds.has(match.assetId) : true,
                status: 'failed',
                warnings: [],
                failureReason: 'not-found',
                candidatePaths,
            };
        }
        const warnings = match.failureReason || !match.candidate
            ? []
            : collectPreflightWarnings(asset, match.candidate, options.fallbackFrameRate);
        const selected = selectedAssetIds ? selectedAssetIds.has(match.assetId) : true;
        const failureReason = match.failureReason ?? (match.candidate ? undefined : 'not-found');
        return {
            assetId: asset.id,
            proxyName: asset.name || fileNameFromPath(asset.path),
            proxyPath: asset.path,
            strategy: match.strategy,
            candidatePath,
            selected,
            status: failureReason ? 'failed' : warnings.length > 0 ? 'warning' : 'success',
            warnings,
            failureReason,
            candidatePaths,
        };
    });
}
export function buildConformMediaReplacements(items) {
    return items
        .filter((item) => item.selected && !item.failureReason && item.candidatePath)
        .map((item) => ({
        assetId: item.assetId,
        replacementPath: item.candidatePath,
        strategy: item.strategy,
    }));
}
export function buildConformReport(items, options = {}) {
    const reportItems = options.selectedOnly ? items.filter((item) => item.selected) : items;
    const successes = [];
    const warnings = [];
    const failures = [];
    for (const item of reportItems) {
        if (item.failureReason) {
            failures.push({
                assetId: item.assetId,
                proxyPath: item.proxyPath,
                reason: item.failureReason,
                candidatePaths: item.candidatePaths,
            });
            continue;
        }
        if (item.candidatePath) {
            successes.push({
                assetId: item.assetId,
                fromPath: item.proxyPath,
                toPath: item.candidatePath,
                strategy: item.strategy,
            });
        }
        for (const warning of item.warnings) {
            warnings.push({
                ...warning,
                proxyPath: item.proxyPath,
                originalPath: item.candidatePath ?? '',
            });
        }
    }
    return {
        totalCount: reportItems.length,
        successCount: successes.length,
        warningCount: warnings.length,
        failureCount: failures.length,
        successes,
        warnings,
        failures,
    };
}
export function applyConformMedia(project, replacements) {
    if (replacements.length === 0) {
        return project;
    }
    const replacementByAssetId = new Map(replacements.map((replacement) => [replacement.assetId, replacement]));
    return {
        ...project,
        media: project.media.map((asset) => {
            const replacement = replacementByAssetId.get(asset.id);
            if (!replacement) {
                return asset;
            }
            return {
                ...asset,
                path: replacement.replacementPath,
                missing: false,
            };
        }),
    };
}
function collectPreflightWarnings(asset, candidate, fallbackFrameRate) {
    const warnings = [];
    const proxyDuration = finiteNumber(asset.duration);
    const originalDuration = finiteNumber(candidate.duration);
    const frameRate = getFrameRate(asset) ?? getFrameRate(candidate) ?? finiteNumber(fallbackFrameRate) ?? 30;
    if (proxyDuration !== undefined && originalDuration !== undefined) {
        const threshold = 1 / frameRate;
        if (Math.abs(proxyDuration - originalDuration) > threshold + Number.EPSILON) {
            warnings.push({
                assetId: asset.id,
                reason: 'duration-mismatch',
                proxyValue: proxyDuration,
                originalValue: originalDuration,
                threshold,
            });
        }
    }
    const proxyFrameRate = getFrameRate(asset);
    const originalFrameRate = getFrameRate(candidate);
    if (proxyFrameRate !== undefined &&
        originalFrameRate !== undefined &&
        Math.abs(proxyFrameRate - originalFrameRate) > 0.01) {
        warnings.push({
            assetId: asset.id,
            reason: 'frame-rate-mismatch',
            proxyValue: proxyFrameRate,
            originalValue: originalFrameRate,
        });
    }
    if (asset.width > 0 &&
        asset.height > 0 &&
        candidate.width !== undefined &&
        candidate.height !== undefined &&
        (asset.width !== candidate.width || asset.height !== candidate.height)) {
        warnings.push({
            assetId: asset.id,
            reason: 'resolution-mismatch',
            proxyValue: `${asset.width}x${asset.height}`,
            originalValue: `${candidate.width}x${candidate.height}`,
        });
    }
    return warnings;
}
function getFrameRate(media) {
    return finiteNumber(media.frameRate) ?? parseFrameRate(media.realFrameRate) ?? parseFrameRate(media.avgFrameRate);
}
function parseFrameRate(value) {
    if (!value) {
        return undefined;
    }
    if (value.includes('/')) {
        const [numerator, denominator] = value.split('/').map(Number);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
            return numerator / denominator;
        }
        return undefined;
    }
    return finiteNumber(Number(value));
}
function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function readTimecode(value) {
    const timed = value;
    return timed.timecode ?? timed.startTimecode;
}
function normalizeTimecode(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function fileNameFromPath(path) {
    return path.replace(/\\/g, '/').split('/').pop() ?? path;
}
function stripExtension(name) {
    const index = name.lastIndexOf('.');
    return index === -1 ? name : name.slice(0, index);
}
//# sourceMappingURL=conform-media.js.map