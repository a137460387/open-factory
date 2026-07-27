export function getMediaVersionLabel(index) {
    return `v${Math.max(1, Math.floor(index) + 1)}`;
}
export function createMediaVersionFromAsset(asset, index = 1, createdAt = new Date().toISOString()) {
    return {
        id: createMediaVersionId(asset.id, index),
        label: getMediaVersionLabel(index),
        assetId: asset.id,
        path: asset.path,
        name: asset.name,
        createdAt,
        duration: finiteNumber(asset.duration),
        width: finiteNumber(asset.width),
        height: finiteNumber(asset.height),
        size: finiteNumber(asset.size),
    };
}
export function normalizeMediaVersion(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const record = value;
    const assetId = normalizeNonEmptyString(record.assetId);
    const path = normalizeNonEmptyString(record.path);
    const name = normalizeNonEmptyString(record.name);
    if (!assetId || !path || !name) {
        return undefined;
    }
    const id = normalizeNonEmptyString(record.id) ?? createMediaVersionId(assetId, 1);
    const label = normalizeNonEmptyString(record.label) ?? getMediaVersionLabel(1);
    const createdAt = normalizeNonEmptyString(record.createdAt) ?? new Date(0).toISOString();
    return {
        id,
        label,
        assetId,
        path,
        name,
        createdAt,
        duration: finiteNumber(record.duration),
        width: finiteNumber(record.width),
        height: finiteNumber(record.height),
        size: finiteNumber(record.size),
    };
}
export function normalizeMediaVersions(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const seen = new Set();
    const versions = [];
    for (const item of value) {
        const version = normalizeMediaVersion(item);
        if (!version) {
            continue;
        }
        const key = `${version.assetId}\n${version.path}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        versions.push({
            ...version,
            label: version.label || getMediaVersionLabel(versions.length + 1),
        });
    }
    return versions.length > 0 ? versions : undefined;
}
export function listMediaVersionEntries(asset, metadata, media = []) {
    const versions = normalizeMediaVersions(metadata?.versions) ?? [];
    const entries = [
        {
            id: asset.id,
            label: getMediaVersionLabel(0),
            assetId: asset.id,
            path: asset.path,
            name: asset.name,
            duration: finiteNumber(asset.duration),
            width: finiteNumber(asset.width),
            height: finiteNumber(asset.height),
            size: finiteNumber(asset.size),
            isOriginal: true,
        },
    ];
    for (const [index, version] of versions.entries()) {
        const referenced = media.find((item) => item.id === version.assetId);
        entries.push({
            id: version.id,
            label: version.label || getMediaVersionLabel(index + 1),
            assetId: version.assetId,
            path: referenced?.path ?? version.path,
            name: referenced?.name ?? version.name,
            duration: finiteNumber(referenced?.duration) ?? version.duration,
            width: finiteNumber(referenced?.width) ?? version.width,
            height: finiteNumber(referenced?.height) ?? version.height,
            size: finiteNumber(referenced?.size) ?? version.size,
            isOriginal: false,
        });
    }
    return entries;
}
export function addMediaVersion(metadata, asset) {
    const current = normalizeMediaVersions(metadata?.versions) ?? [];
    const existing = current.find((version) => version.assetId === asset.id || version.path === asset.path);
    const versions = existing ? current : [...current, createMediaVersionFromAsset(asset, current.length + 1)];
    return {
        ...(metadata ?? {}),
        versions,
    };
}
export function removeMediaVersion(metadata, versionId) {
    const versions = (normalizeMediaVersions(metadata?.versions) ?? []).filter((version) => version.id !== versionId && version.assetId !== versionId);
    const next = {
        ...(metadata ?? {}),
        versions: versions.length > 0 ? versions : undefined,
    };
    if (!next.versions) {
        delete next.versions;
    }
    return Object.keys(next).length > 0 ? next : undefined;
}
export function findMediaVersionOwner(project, mediaId) {
    const original = project.media.find((asset) => asset.id === mediaId);
    if (original && project.mediaMetadata[original.id]?.versions) {
        return original;
    }
    for (const asset of project.media) {
        const versions = normalizeMediaVersions(project.mediaMetadata[asset.id]?.versions) ?? [];
        if (versions.some((version) => version.assetId === mediaId)) {
            return asset;
        }
    }
    return original;
}
export function findMediaVersionAsset(project, entry) {
    return project.media.find((asset) => asset.id === entry.assetId);
}
export function buildMediaVersionCompareRequest(project, assetId, leftVersionId, rightVersionId, time = 0) {
    const asset = project.media.find((item) => item.id === assetId);
    if (!asset) {
        return undefined;
    }
    const entries = listMediaVersionEntries(asset, project.mediaMetadata[assetId], project.media);
    if (entries.length < 2) {
        return undefined;
    }
    const left = entries.find((entry) => entry.id === leftVersionId || entry.assetId === leftVersionId) ?? entries[0];
    const right = entries.find((entry) => entry.id === rightVersionId || entry.assetId === rightVersionId) ?? entries[1];
    return {
        assetId,
        time: Math.max(0, Number.isFinite(time) ? time : 0),
        left,
        right,
    };
}
function createMediaVersionId(assetId, index) {
    return `${assetId}-version-${Math.max(1, Math.floor(index))}`;
}
function normalizeNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=media-versions.js.map