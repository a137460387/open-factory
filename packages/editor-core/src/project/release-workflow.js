import { diffTimelineVersions } from '../timeline-compare';
import { getTimelineDuration } from '../timeline';
import { getProjectSequences } from '../model';
export const DEFAULT_PROJECT_RELEASE_VERSION = '0.1.0';
export const DEFAULT_SUBTITLE_RELEASE_MAX_CHARS = 80;
export const DEFAULT_RELEASE_CHECKLIST_OPTIONS = {
    qualityGate: true,
    mediaRelink: true,
    subtitleProof: true,
    exportPreset: true,
};
export function normalizeProjectReleaseVersion(value, fallback = DEFAULT_PROJECT_RELEASE_VERSION) {
    const text = typeof value === 'string' ? value.trim() : '';
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
    if (!match) {
        return fallback;
    }
    const [, major, minor, patch] = match;
    return `${normalizeSemverPart(major)}.${normalizeSemverPart(minor)}.${normalizeSemverPart(patch)}`;
}
export function incrementSemverPatch(value) {
    const version = normalizeProjectReleaseVersion(value);
    const [major, minor, patch] = version.split('.').map((part) => Number(part));
    return `${major}.${minor}.${patch + 1}`;
}
export function buildSemver(major, minor, patch) {
    return `${normalizeSemverPart(major)}.${normalizeSemverPart(minor)}.${normalizeSemverPart(patch)}`;
}
export function runReleaseChecklist(project, options = {}, context = {}) {
    const enabled = { ...DEFAULT_RELEASE_CHECKLIST_OPTIONS, ...options };
    const items = [
        evaluateQualityGate(enabled.qualityGate, context),
        evaluateMediaRelink(project, enabled.mediaRelink),
        evaluateSubtitleProof(project, enabled.subtitleProof, context.subtitleMaxChars ?? DEFAULT_SUBTITLE_RELEASE_MAX_CHARS),
        evaluateExportPreset(enabled.exportPreset, context),
    ];
    const blockingCount = items.filter((item) => item.status === 'blocking').length;
    return {
        items,
        canRelease: blockingCount === 0,
        blockingCount,
    };
}
export function buildProjectReleaseRecord(input) {
    const version = normalizeProjectReleaseVersion(input.version);
    const releasedAt = normalizeIsoTimestamp(input.releasedAt);
    return {
        schemaVersion: 1,
        id: `release-${input.project.id}-${version}-${releasedAt}`,
        projectId: input.project.id,
        projectName: input.project.name,
        version,
        releasedAt,
        checklist: input.checklist.items.map((item) => ({ ...item, details: [...item.details] })),
        exportPath: normalizeRequiredString(input.exportPath, 'Export path is required'),
        duration: getTimelineDuration(input.project.timeline),
        assignee: normalizeOptionalString(input.assignee),
        changelog: normalizeOptionalString(input.changelog),
        snapshotPath: normalizeRequiredString(input.snapshotPath, 'Snapshot path is required'),
        exportPresetId: normalizeOptionalString(input.exportPresetId) || undefined,
        exportPresetName: normalizeOptionalString(input.exportPresetName) || undefined,
    };
}
export function createReleaseRecordFileName(version, releasedAt = new Date().toISOString()) {
    const safeVersion = normalizeProjectReleaseVersion(version).replace(/[^0-9.]/g, '');
    const safeTimestamp = normalizeIsoTimestamp(releasedAt).replace(/[:.]/g, '-');
    return `release_${safeVersion}_${safeTimestamp}.json`;
}
export function buildReleaseComparisonRequest(base, target) {
    if (!base.snapshotPath || !target.snapshotPath) {
        throw new Error('Release comparison requires snapshot paths.');
    }
    return {
        baseVersion: base.version,
        targetVersion: target.version,
        baseSnapshotPath: base.snapshotPath,
        targetSnapshotPath: target.snapshotPath,
    };
}
export function diffReleaseSnapshots(baseRecord, targetRecord, baseProject, targetProject) {
    return {
        baseVersion: baseRecord.version,
        targetVersion: targetRecord.version,
        diff: diffTimelineVersions(baseProject.timeline, targetProject.timeline),
    };
}
function evaluateQualityGate(enabled, context) {
    if (!enabled) {
        return skipped('qualityGate', 'Quality gate skipped');
    }
    const blockingCount = Math.max(0, Math.round(context.qualityBlockingIssueCount ?? 0));
    const failed = context.qualityAssurance?.status === 'fail' || blockingCount > 0;
    return failed
        ? {
            id: 'qualityGate',
            status: 'blocking',
            message: 'Quality report has blocking issues',
            details: [`Blocking issues: ${Math.max(1, blockingCount)}`],
        }
        : {
            id: 'qualityGate',
            status: 'pass',
            message: 'Quality report has no blocking issues',
            details: context.qualityAssurance?.status ? [`Quality status: ${context.qualityAssurance.status}`] : [],
        };
}
function evaluateMediaRelink(project, enabled) {
    if (!enabled) {
        return skipped('mediaRelink', 'Media relink check skipped');
    }
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const missing = project.media
        .filter((asset) => asset.missing === true || !asset.path.trim())
        .map((asset) => asset.name || asset.id);
    for (const sequence of getProjectSequences(project)) {
        for (const track of sequence.timeline.tracks) {
            for (const clip of track.clips) {
                if (!('mediaId' in clip)) {
                    continue;
                }
                const asset = mediaById.get(clip.mediaId);
                if (!asset || asset.missing === true || !asset.path.trim()) {
                    missing.push(`${clip.name} -> ${clip.mediaId}`);
                }
            }
        }
    }
    const uniqueMissing = Array.from(new Set(missing)).sort();
    return uniqueMissing.length > 0
        ? {
            id: 'mediaRelink',
            status: 'blocking',
            message: 'Some media still needs relink',
            details: uniqueMissing,
        }
        : {
            id: 'mediaRelink',
            status: 'pass',
            message: 'All media is linked',
            details: [],
        };
}
function evaluateSubtitleProof(project, enabled, maxChars) {
    if (!enabled) {
        return skipped('subtitleProof', 'Subtitle proof check skipped');
    }
    const details = [];
    const limit = Math.max(1, Math.round(maxChars));
    for (const sequence of getProjectSequences(project)) {
        for (const track of sequence.timeline.tracks) {
            for (const clip of track.clips) {
                if (clip.type !== 'subtitle') {
                    continue;
                }
                const text = clip.text.trim();
                if (!text) {
                    details.push(`${clip.name || clip.id}: empty subtitle`);
                }
                else if (Array.from(text).length > limit) {
                    details.push(`${clip.name || clip.id}: subtitle exceeds ${limit} characters`);
                }
            }
        }
    }
    return details.length > 0
        ? {
            id: 'subtitleProof',
            status: 'blocking',
            message: 'Subtitle proof check found blocking issues',
            details,
        }
        : {
            id: 'subtitleProof',
            status: 'pass',
            message: 'Subtitle proof check passed',
            details: [],
        };
}
function evaluateExportPreset(enabled, context) {
    if (!enabled) {
        return skipped('exportPreset', 'Export preset check skipped');
    }
    const presetId = normalizeOptionalString(context.exportPresetId);
    const presetName = normalizeOptionalString(context.exportPresetName);
    return presetId || presetName
        ? {
            id: 'exportPreset',
            status: 'pass',
            message: 'Export preset selected',
            details: [presetName || presetId],
        }
        : {
            id: 'exportPreset',
            status: 'blocking',
            message: 'Export preset is required',
            details: [],
        };
}
function skipped(id, message) {
    return { id, status: 'skipped', message, details: [] };
}
function normalizeSemverPart(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(9999, Math.floor(numeric))) : 0;
}
function normalizeIsoTimestamp(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    const parsed = text ? new Date(text) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
function normalizeRequiredString(value, message) {
    const text = normalizeOptionalString(value);
    if (!text) {
        throw new Error(message);
    }
    return text;
}
function normalizeOptionalString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
//# sourceMappingURL=release-workflow.js.map