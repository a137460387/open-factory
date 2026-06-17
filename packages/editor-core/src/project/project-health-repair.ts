import { addMediaFolderToProject, moveMediaAssetsToFolder } from '../media-folders';
import type { MediaAsset, Project, Timeline } from '../model';
import { getProjectSequences, replaceProjectActiveTimeline } from '../model';
import { dirname, normalizePath } from './relative-paths';
import { scoreRelinkCandidate } from './relink-score';
import type { DuplicateMediaIssue, ProjectHealthReport } from './project-health-check';

export type ProjectHealthSearchRootKind = 'original' | 'sibling' | 'recent';
export type ProjectHealthRepairEntryStatus = 'success' | 'skipped' | 'manual';
export type ProjectHealthRepairEntryType = 'missing-media' | 'duplicate-media' | 'orphan-media' | 'proxy-missing' | 'frame-rate-proxy';

export interface ProjectHealthSearchRoot {
  path: string;
  kind: ProjectHealthSearchRootKind;
  priority: number;
}

export interface PlannedMissingMediaRelink {
  assetId: string;
  candidatePath: string;
  score: number;
  rootKind: ProjectHealthSearchRootKind;
}

export interface ProjectHealthAutoRepairInput {
  relinkedAssets?: Array<{ assetId: string; asset: MediaAsset }>;
  duplicateIssues?: DuplicateMediaIssue[];
  orphanAssetIds?: string[];
  proxyAssetIds?: string[];
  frameRateProxyAssetIds?: string[];
  manualEntries?: Array<Omit<ProjectHealthRepairEntry, 'status'> & { status?: ProjectHealthRepairEntryStatus }>;
  unusedFolderName?: string;
}

export interface ProjectHealthRepairEntry {
  type: ProjectHealthRepairEntryType;
  status: ProjectHealthRepairEntryStatus;
  assetId?: string;
  message: string;
}

export interface ProjectHealthRepairReport {
  successCount: number;
  skippedCount: number;
  manualCount: number;
  entries: ProjectHealthRepairEntry[];
}

export interface ProjectHealthAutoRepairResult {
  project: Project;
  report: ProjectHealthRepairReport;
}

export function buildProjectHealthSearchRoots(project: Project, recentDirectories: string[] = []): ProjectHealthSearchRoot[] {
  const roots: ProjectHealthSearchRoot[] = [];
  const missingDirs = project.media.filter((asset) => asset.missing || !asset.path.trim()).flatMap((asset) => (asset.path.trim() ? [dirname(asset.path)] : []));
  for (const directory of missingDirs) {
    addRoot(roots, directory, 'original', 0);
    const parent = dirname(directory);
    if (parent && parent !== directory) {
      addRoot(roots, parent, 'sibling', 1);
    }
  }
  for (const directory of recentDirectories) {
    addRoot(roots, directory, 'recent', 2);
  }
  return roots.sort((left, right) => left.priority - right.priority || left.path.localeCompare(right.path));
}

export function planMissingMediaAutoRelinks(
  project: Project,
  report: ProjectHealthReport,
  candidatePaths: string[],
  roots: ProjectHealthSearchRoot[],
  minScore = 0.35
): { replacements: PlannedMissingMediaRelink[]; manualEntries: ProjectHealthRepairEntry[] } {
  const rootPriority = new Map(roots.map((root) => [normalizePath(root.path).toLowerCase(), root]));
  const candidates = candidatePaths.map((path) => {
    const normalized = normalizePath(path);
    const root = findCandidateRoot(normalized, rootPriority);
    return {
      path: normalized,
      root,
      priority: root?.priority ?? 99
    };
  });
  const replacements: PlannedMissingMediaRelink[] = [];
  const manualEntries: ProjectHealthRepairEntry[] = [];
  for (const issue of report.missingMedia) {
    const asset = project.media.find((item) => item.id === issue.assetId);
    if (!asset) {
      manualEntries.push({ type: 'missing-media', status: 'manual', assetId: issue.assetId, message: `${issue.name}: media record is missing` });
      continue;
    }
    const best = candidates
      .map((candidate) => ({
        candidate,
        ...scoreRelinkCandidate(asset, { path: candidate.path })
      }))
      .filter((candidate) => candidate.score >= minScore)
      .sort((left, right) => right.score - left.score || left.candidate.priority - right.candidate.priority || left.candidate.path.localeCompare(right.candidate.path))[0];
    if (!best) {
      manualEntries.push({ type: 'missing-media', status: 'manual', assetId: issue.assetId, message: `${issue.name}: no same-name relink candidate found` });
      continue;
    }
    replacements.push({
      assetId: issue.assetId,
      candidatePath: best.candidate.path,
      score: best.score,
      rootKind: best.candidate.root?.kind ?? 'recent'
    });
  }
  return { replacements, manualEntries };
}

export function applyProjectHealthAutoRepair(project: Project, input: ProjectHealthAutoRepairInput, now = new Date().toISOString()): ProjectHealthAutoRepairResult {
  let nextProject = project;
  const entries: ProjectHealthRepairEntry[] = [];

  const relinkedAssets = input.relinkedAssets ?? [];
  if (relinkedAssets.length > 0) {
    const replacements = new Map(relinkedAssets.map((item) => [item.assetId, { ...item.asset, id: item.assetId, missing: false }]));
    nextProject = {
      ...nextProject,
      media: nextProject.media.map((asset) => replacements.get(asset.id) ?? asset),
      updatedAt: now
    };
    for (const item of relinkedAssets) {
      entries.push({ type: 'missing-media', status: 'success', assetId: item.assetId, message: `${item.asset.name || item.asset.path}: auto relinked` });
    }
  }

  for (const issue of input.duplicateIssues ?? []) {
    const removeIds = new Set(issue.assets.map((asset) => asset.assetId).filter((assetId) => assetId !== issue.keepAssetId));
    if (removeIds.size === 0) {
      entries.push({ type: 'duplicate-media', status: 'skipped', message: `${issue.id}: no duplicate media to merge` });
      continue;
    }
    nextProject = mergeMediaReferences(nextProject, issue.keepAssetId, removeIds, now);
    entries.push({ type: 'duplicate-media', status: 'success', assetId: issue.keepAssetId, message: `${issue.id}: merged ${removeIds.size} duplicate reference(s)` });
  }

  const orphanAssetIds = Array.from(new Set(input.orphanAssetIds ?? [])).filter((assetId) => nextProject.media.some((asset) => asset.id === assetId));
  if (orphanAssetIds.length > 0) {
    const folderName = input.unusedFolderName?.trim() || 'Unused';
    const existing = nextProject.mediaFolders.find((folder) => folder.name.toLowerCase() === folderName.toLowerCase());
    let folderId = existing?.id;
    if (!folderId) {
      const created = addMediaFolderToProject(nextProject, { name: folderName }, now);
      nextProject = created.project;
      folderId = created.folder.id;
    }
    nextProject = moveMediaAssetsToFolder(nextProject, orphanAssetIds, folderId, now);
    for (const assetId of orphanAssetIds) {
      entries.push({ type: 'orphan-media', status: 'success', assetId, message: `${assetId}: moved to ${folderName}` });
    }
  }

  for (const assetId of input.proxyAssetIds ?? []) {
    entries.push({ type: 'proxy-missing', status: 'success', assetId, message: `${assetId}: queued proxy regeneration` });
  }
  for (const assetId of input.frameRateProxyAssetIds ?? []) {
    entries.push({ type: 'frame-rate-proxy', status: 'success', assetId, message: `${assetId}: queued CFR proxy generation` });
  }
  for (const entry of input.manualEntries ?? []) {
    entries.push({ ...entry, status: entry.status ?? 'manual' });
  }

  return {
    project: nextProject,
    report: summarizeProjectHealthRepair(entries)
  };
}

export function summarizeProjectHealthRepair(entries: ProjectHealthRepairEntry[]): ProjectHealthRepairReport {
  return {
    successCount: entries.filter((entry) => entry.status === 'success').length,
    skippedCount: entries.filter((entry) => entry.status === 'skipped').length,
    manualCount: entries.filter((entry) => entry.status === 'manual').length,
    entries
  };
}

function addRoot(roots: ProjectHealthSearchRoot[], path: string, kind: ProjectHealthSearchRootKind, priority: number): void {
  const normalized = normalizePath(path);
  const key = normalized.toLowerCase();
  if (!normalized || normalized === '.' || roots.some((root) => root.path.toLowerCase() === key)) {
    return;
  }
  roots.push({ path: normalized, kind, priority });
}

function findCandidateRoot(path: string, roots: Map<string, ProjectHealthSearchRoot>): ProjectHealthSearchRoot | undefined {
  const normalized = normalizePath(path).toLowerCase();
  return Array.from(roots.values())
    .filter((root) => normalized === root.path.toLowerCase() || normalized.startsWith(`${root.path.toLowerCase()}/`))
    .sort((left, right) => left.priority - right.priority || right.path.length - left.path.length)[0];
}

function mergeMediaReferences(project: Project, keepAssetId: string, removeIds: Set<string>, now: string): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const sequences = getProjectSequences(synced).map((sequence) => ({
    ...sequence,
    timeline: replaceTimelineMediaReferences(sequence.timeline, keepAssetId, removeIds)
  }));
  const activeTimeline = sequences.find((sequence) => sequence.id === synced.activeSequenceId)?.timeline ?? synced.timeline;
  return {
    ...synced,
    media: synced.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata: filterMediaMetadata(synced.mediaMetadata, removeIds),
    timeline: activeTimeline,
    sequences,
    updatedAt: now
  };
}

function replaceTimelineMediaReferences(timeline: Timeline, keepAssetId: string, removeIds: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ('mediaId' in clip && removeIds.has(clip.mediaId) ? ({ ...clip, mediaId: keepAssetId } as typeof clip) : clip))
    }))
  };
}

function filterMediaMetadata<T>(metadata: Record<string, T>, removeIds: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(metadata).filter(([assetId]) => !removeIds.has(assetId)));
}
