import { diffTimelineVersions, type TimelineVersionDiff } from '../timeline-compare';
import { getTimelineDuration } from '../timeline';
import { getProjectSequences, type Project } from '../model';
import type { PostExportQualityAssuranceResult } from '../export/post-export-quality';
import type { ExportPublishNodeLog } from '../export/publish-pipeline';

export const DEFAULT_PROJECT_RELEASE_VERSION = '0.1.0';
export const DEFAULT_SUBTITLE_RELEASE_MAX_CHARS = 80;

export type ReleaseChecklistItemId = 'qualityGate' | 'mediaRelink' | 'subtitleProof' | 'exportPreset';
export type ReleaseChecklistStatus = 'pass' | 'blocking' | 'skipped';

export interface ReleaseChecklistOptions {
  qualityGate: boolean;
  mediaRelink: boolean;
  subtitleProof: boolean;
  exportPreset: boolean;
}

export interface ReleaseChecklistContext {
  qualityAssurance?: Pick<PostExportQualityAssuranceResult, 'status'>;
  qualityBlockingIssueCount?: number;
  exportPresetId?: string;
  exportPresetName?: string;
  subtitleMaxChars?: number;
}

export interface ReleaseChecklistItemResult {
  id: ReleaseChecklistItemId;
  status: ReleaseChecklistStatus;
  message: string;
  details: string[];
}

export interface ReleaseChecklistResult {
  items: ReleaseChecklistItemResult[];
  canRelease: boolean;
  blockingCount: number;
}

export interface ProjectReleaseRecord {
  schemaVersion: 1;
  id: string;
  projectId: string;
  projectName: string;
  version: string;
  releasedAt: string;
  checklist: ReleaseChecklistItemResult[];
  exportPath: string;
  duration: number;
  assignee: string;
  changelog: string;
  snapshotPath: string;
  exportPresetId?: string;
  exportPresetName?: string;
  publishLogs?: ExportPublishNodeLog[];
}

export interface BuildReleaseRecordInput {
  project: Project;
  version: string;
  releasedAt?: string;
  checklist: ReleaseChecklistResult;
  exportPath: string;
  assignee?: string;
  changelog?: string;
  snapshotPath: string;
  exportPresetId?: string;
  exportPresetName?: string;
}

export interface ReleaseComparisonRequest {
  baseVersion: string;
  targetVersion: string;
  baseSnapshotPath: string;
  targetSnapshotPath: string;
}

export interface ReleaseVersionDiff {
  baseVersion: string;
  targetVersion: string;
  diff: TimelineVersionDiff;
}

export const DEFAULT_RELEASE_CHECKLIST_OPTIONS: ReleaseChecklistOptions = {
  qualityGate: true,
  mediaRelink: true,
  subtitleProof: true,
  exportPreset: true,
};

export function normalizeProjectReleaseVersion(value: unknown, fallback = DEFAULT_PROJECT_RELEASE_VERSION): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (!match) {
    return fallback;
  }
  const [, major, minor, patch] = match;
  return `${normalizeSemverPart(major)}.${normalizeSemverPart(minor)}.${normalizeSemverPart(patch)}`;
}

export function incrementSemverPatch(value: unknown): string {
  const version = normalizeProjectReleaseVersion(value);
  const [major, minor, patch] = version.split('.').map((part) => Number(part));
  return `${major}.${minor}.${patch + 1}`;
}

export function buildSemver(major: unknown, minor: unknown, patch: unknown): string {
  return `${normalizeSemverPart(major)}.${normalizeSemverPart(minor)}.${normalizeSemverPart(patch)}`;
}

export function runReleaseChecklist(
  project: Project,
  options: Partial<ReleaseChecklistOptions> = {},
  context: ReleaseChecklistContext = {},
): ReleaseChecklistResult {
  const enabled = { ...DEFAULT_RELEASE_CHECKLIST_OPTIONS, ...options };
  const items: ReleaseChecklistItemResult[] = [
    evaluateQualityGate(enabled.qualityGate, context),
    evaluateMediaRelink(project, enabled.mediaRelink),
    evaluateSubtitleProof(
      project,
      enabled.subtitleProof,
      context.subtitleMaxChars ?? DEFAULT_SUBTITLE_RELEASE_MAX_CHARS,
    ),
    evaluateExportPreset(enabled.exportPreset, context),
  ];
  const blockingCount = items.filter((item) => item.status === 'blocking').length;
  return {
    items,
    canRelease: blockingCount === 0,
    blockingCount,
  };
}

export function buildProjectReleaseRecord(input: BuildReleaseRecordInput): ProjectReleaseRecord {
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

export function createReleaseRecordFileName(version: string, releasedAt = new Date().toISOString()): string {
  const safeVersion = normalizeProjectReleaseVersion(version).replace(/[^0-9.]/g, '');
  const safeTimestamp = normalizeIsoTimestamp(releasedAt).replace(/[:.]/g, '-');
  return `release_${safeVersion}_${safeTimestamp}.json`;
}

export function buildReleaseComparisonRequest(
  base: ProjectReleaseRecord,
  target: ProjectReleaseRecord,
): ReleaseComparisonRequest {
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

export function diffReleaseSnapshots(
  baseRecord: ProjectReleaseRecord,
  targetRecord: ProjectReleaseRecord,
  baseProject: Project,
  targetProject: Project,
): ReleaseVersionDiff {
  return {
    baseVersion: baseRecord.version,
    targetVersion: targetRecord.version,
    diff: diffTimelineVersions(baseProject.timeline, targetProject.timeline),
  };
}

function evaluateQualityGate(enabled: boolean, context: ReleaseChecklistContext): ReleaseChecklistItemResult {
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

function evaluateMediaRelink(project: Project, enabled: boolean): ReleaseChecklistItemResult {
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

function evaluateSubtitleProof(project: Project, enabled: boolean, maxChars: number): ReleaseChecklistItemResult {
  if (!enabled) {
    return skipped('subtitleProof', 'Subtitle proof check skipped');
  }
  const details: string[] = [];
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
        } else if (Array.from(text).length > limit) {
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

function evaluateExportPreset(enabled: boolean, context: ReleaseChecklistContext): ReleaseChecklistItemResult {
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

function skipped(id: ReleaseChecklistItemId, message: string): ReleaseChecklistItemResult {
  return { id, status: 'skipped', message, details: [] };
}

function normalizeSemverPart(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(9999, Math.floor(numeric))) : 0;
}

function normalizeIsoTimestamp(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const parsed = text ? new Date(text) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeRequiredString(value: unknown, message: string): string {
  const text = normalizeOptionalString(value);
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
