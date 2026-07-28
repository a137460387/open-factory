import { getProjectSequences, replaceProjectActiveTimeline, } from '../model';
import { shouldGenerateProxy } from '../proxy/proxy-planner';
import { parseFontFamilyList } from '../export/preflight';
const GENERIC_FONT_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
]);
export function runProjectHealthCheck(project, options = {}) {
    const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
    const mediaById = new Map(syncedProject.media.map((asset) => [asset.id, asset]));
    const missingMediaAssetIds = new Set(options.missingMediaAssetIds ?? []);
    const referencesByMediaId = collectMediaReferences(syncedProject);
    const usedMediaIds = new Set(referencesByMediaId.keys());
    const isMissing = (asset) => {
        if (!asset) {
            return true;
        }
        return Boolean(asset.missing || !asset.path.trim() || missingMediaAssetIds.has(asset.id) || options.isMediaMissing?.(asset));
    };
    return {
        missingMedia: collectMissingMedia(mediaById, referencesByMediaId, isMissing),
        duplicateMedia: collectDuplicateMedia(syncedProject.media, referencesByMediaId),
        orphanMedia: collectOrphanMedia(syncedProject.media, usedMediaIds, syncedProject.mediaFolders),
        proxyMissing: collectProxyMissingMedia(syncedProject.media, isMissing, options.proxySettings),
        missingFonts: collectMissingFonts(syncedProject, options.isFontFamilyAvailable),
    };
}
export function getProjectHealthIssueCount(report) {
    return (report.missingMedia.length +
        report.duplicateMedia.length +
        report.orphanMedia.length +
        report.proxyMissing.length +
        report.missingFonts.length);
}
function collectMediaReferences(project) {
    const references = new Map();
    for (const sequence of getProjectSequences(project)) {
        for (const track of sequence.timeline.tracks) {
            for (const clip of track.clips) {
                if (!('mediaId' in clip)) {
                    continue;
                }
                const entries = references.get(clip.mediaId) ?? [];
                entries.push(toReference(clip, track, sequence.id, sequence.name));
                references.set(clip.mediaId, entries);
            }
        }
    }
    return references;
}
function collectMissingMedia(mediaById, referencesByMediaId, isMissing) {
    const issues = [];
    for (const [mediaId, references] of referencesByMediaId) {
        const asset = mediaById.get(mediaId);
        if (!isMissing(asset)) {
            continue;
        }
        const summary = mediaSummary(asset ?? fallbackMissingAsset(mediaId, references[0]?.clipName));
        issues.push({
            type: 'missing-media',
            id: `missing-media-${mediaId}`,
            ...summary,
            references,
        });
    }
    return sortIssuesByName(issues);
}
function collectDuplicateMedia(media, referencesByMediaId) {
    const bySignature = new Map();
    for (const asset of media) {
        if (asset.missing || !isFiniteNumber(asset.size) || !isFiniteNumber(asset.mtimeMs)) {
            continue;
        }
        const group = bySignature.get(`${asset.size}|${asset.mtimeMs}`) ?? [];
        group.push(asset);
        bySignature.set(`${asset.size}|${asset.mtimeMs}`, group);
    }
    const issues = [];
    let index = 0;
    for (const group of bySignature.values()) {
        const distinctPaths = new Set(group.map((asset) => normalizePathKey(asset.path)));
        if (distinctPaths.size < 2) {
            continue;
        }
        const sorted = [...group].sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id));
        const keepAssetId = sorted[0].id;
        issues.push({
            type: 'duplicate-media',
            id: `duplicate-media-${index}`,
            size: sorted[0].size,
            mtimeMs: sorted[0].mtimeMs,
            keepAssetId,
            assets: sorted.map((asset) => ({
                ...mediaSummary(asset),
                references: referencesByMediaId.get(asset.id) ?? [],
            })),
        });
        index += 1;
    }
    return issues;
}
function collectOrphanMedia(media, usedMediaIds, folders) {
    const unusedFolderIds = new Set(folders
        .filter((folder) => {
        const name = folder.name.trim().toLowerCase();
        return name === 'unused' || name === '\u672a\u4f7f\u7528';
    })
        .map((folder) => folder.id));
    return sortIssuesByName(media
        .filter((asset) => !usedMediaIds.has(asset.id) && !(asset.folderId && unusedFolderIds.has(asset.folderId)))
        .map((asset) => ({
        type: 'orphan-media',
        id: `orphan-media-${asset.id}`,
        ...mediaSummary(asset),
    })));
}
function collectProxyMissingMedia(media, isMissing, proxySettings) {
    return sortIssuesByName(media
        .filter((asset) => asset.type === 'video' && !isMissing(asset) && shouldGenerateProxy(asset, proxySettings))
        .map((asset) => ({
        type: 'proxy-missing',
        id: `proxy-missing-${asset.id}`,
        ...mediaSummary(asset),
        width: asset.width,
        height: asset.height,
        proxyStatus: asset.proxyStatus,
    })));
}
function collectMissingFonts(project, isFontFamilyAvailable) {
    if (!isFontFamilyAvailable) {
        return [];
    }
    const issues = [];
    const seen = new Set();
    for (const sequence of getProjectSequences(project)) {
        for (const track of sequence.timeline.tracks) {
            for (const clip of track.clips) {
                if (clip.type !== 'subtitle') {
                    continue;
                }
                const families = parseFontFamilyList(clip.style.fontFamily);
                if (families.length === 0 ||
                    families.some((family) => isGenericFontFamily(family) || isFontFamilyAvailable(family))) {
                    continue;
                }
                const fontFamily = families[0] ?? clip.style.fontFamily;
                const key = `${clip.id}|${fontFamily}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                issues.push({
                    type: 'missing-font',
                    id: `missing-font-${clip.id}-${slug(fontFamily)}`,
                    fontFamily,
                    clip: toReference(clip, track, sequence.id, sequence.name),
                });
            }
        }
    }
    return issues.sort((left, right) => left.fontFamily.localeCompare(right.fontFamily) || left.clip.clipName.localeCompare(right.clip.clipName));
}
function toReference(clip, track, sequenceId, sequenceName) {
    return {
        clipId: clip.id,
        clipName: clip.name,
        trackId: track.id,
        trackName: track.name,
        sequenceId,
        sequenceName,
    };
}
function mediaSummary(asset) {
    return {
        assetId: asset.id,
        name: asset.name || fileNameFromPath(asset.path) || asset.id,
        path: asset.path,
        fileName: fileNameFromPath(asset.path || asset.name || asset.id),
    };
}
function fallbackMissingAsset(assetId, clipName) {
    return {
        id: assetId,
        type: 'video',
        name: clipName || assetId,
        path: '',
        duration: 0,
        width: 0,
        height: 0,
        missing: true,
    };
}
function fileNameFromPath(path) {
    return path.replace(/\\/g, '/').split('/').pop() ?? path;
}
function normalizePathKey(path) {
    return path.replace(/\\/g, '/').toLowerCase();
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isGenericFontFamily(fontFamily) {
    return GENERIC_FONT_FAMILIES.has(fontFamily.trim().toLowerCase());
}
function sortIssuesByName(issues) {
    return [...issues].sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
}
function slug(value) {
    return (value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'font');
}
//# sourceMappingURL=project-health-check.js.map