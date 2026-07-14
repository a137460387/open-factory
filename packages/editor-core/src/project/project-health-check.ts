import {
  getProjectSequences,
  replaceProjectActiveTimeline,
  type Clip,
  type MediaAsset,
  type Project,
  type Track,
} from '../model';
import { shouldGenerateProxy } from '../proxy/proxy-planner';
import type { ProxySettings } from '../proxy/proxy-types';
import { parseFontFamilyList } from '../export/preflight';

export type ProjectHealthIssueType =
  'missing-media' | 'duplicate-media' | 'orphan-media' | 'proxy-missing' | 'missing-font';

export interface ProjectHealthClipReference {
  clipId: string;
  clipName: string;
  trackId: string;
  trackName: string;
  sequenceId: string;
  sequenceName: string;
}

export interface ProjectHealthMediaSummary {
  assetId: string;
  name: string;
  path: string;
  fileName: string;
}

export interface MissingMediaIssue extends ProjectHealthMediaSummary {
  type: 'missing-media';
  id: string;
  references: ProjectHealthClipReference[];
}

export interface DuplicateMediaAsset extends ProjectHealthMediaSummary {
  references: ProjectHealthClipReference[];
}

export interface DuplicateMediaIssue {
  type: 'duplicate-media';
  id: string;
  size: number;
  mtimeMs: number;
  keepAssetId: string;
  assets: DuplicateMediaAsset[];
}

export interface OrphanMediaIssue extends ProjectHealthMediaSummary {
  type: 'orphan-media';
  id: string;
}

export interface ProxyMissingIssue extends ProjectHealthMediaSummary {
  type: 'proxy-missing';
  id: string;
  width: number;
  height: number;
  proxyStatus: MediaAsset['proxyStatus'];
}

export interface MissingFontIssue {
  type: 'missing-font';
  id: string;
  fontFamily: string;
  clip: ProjectHealthClipReference;
}

export interface ProjectHealthReport {
  missingMedia: MissingMediaIssue[];
  duplicateMedia: DuplicateMediaIssue[];
  orphanMedia: OrphanMediaIssue[];
  proxyMissing: ProxyMissingIssue[];
  missingFonts: MissingFontIssue[];
}

export interface ProjectHealthCheckOptions {
  missingMediaAssetIds?: Iterable<string>;
  isMediaMissing?: (asset: MediaAsset) => boolean;
  isFontFamilyAvailable?: (fontFamily: string) => boolean;
  proxySettings?: ProxySettings;
}

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

export function runProjectHealthCheck(project: Project, options: ProjectHealthCheckOptions = {}): ProjectHealthReport {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const mediaById = new Map(syncedProject.media.map((asset) => [asset.id, asset]));
  const missingMediaAssetIds = new Set(options.missingMediaAssetIds ?? []);
  const referencesByMediaId = collectMediaReferences(syncedProject);
  const usedMediaIds = new Set(referencesByMediaId.keys());
  const isMissing = (asset: MediaAsset | undefined): boolean => {
    if (!asset) {
      return true;
    }
    return Boolean(
      asset.missing || !asset.path.trim() || missingMediaAssetIds.has(asset.id) || options.isMediaMissing?.(asset),
    );
  };

  return {
    missingMedia: collectMissingMedia(mediaById, referencesByMediaId, isMissing),
    duplicateMedia: collectDuplicateMedia(syncedProject.media, referencesByMediaId),
    orphanMedia: collectOrphanMedia(syncedProject.media, usedMediaIds, syncedProject.mediaFolders),
    proxyMissing: collectProxyMissingMedia(syncedProject.media, isMissing, options.proxySettings),
    missingFonts: collectMissingFonts(syncedProject, options.isFontFamilyAvailable),
  };
}

export function getProjectHealthIssueCount(report: ProjectHealthReport): number {
  return (
    report.missingMedia.length +
    report.duplicateMedia.length +
    report.orphanMedia.length +
    report.proxyMissing.length +
    report.missingFonts.length
  );
}

function collectMediaReferences(project: Project): Map<string, ProjectHealthClipReference[]> {
  const references = new Map<string, ProjectHealthClipReference[]>();
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

function collectMissingMedia(
  mediaById: Map<string, MediaAsset>,
  referencesByMediaId: Map<string, ProjectHealthClipReference[]>,
  isMissing: (asset: MediaAsset | undefined) => boolean,
): MissingMediaIssue[] {
  const issues: MissingMediaIssue[] = [];
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

function collectDuplicateMedia(
  media: MediaAsset[],
  referencesByMediaId: Map<string, ProjectHealthClipReference[]>,
): DuplicateMediaIssue[] {
  const bySignature = new Map<string, MediaAsset[]>();
  for (const asset of media) {
    if (asset.missing || !isFiniteNumber(asset.size) || !isFiniteNumber(asset.mtimeMs)) {
      continue;
    }
    const group = bySignature.get(`${asset.size}|${asset.mtimeMs}`) ?? [];
    group.push(asset);
    bySignature.set(`${asset.size}|${asset.mtimeMs}`, group);
  }

  const issues: DuplicateMediaIssue[] = [];
  let index = 0;
  for (const group of bySignature.values()) {
    const distinctPaths = new Set(group.map((asset) => normalizePathKey(asset.path)));
    if (distinctPaths.size < 2) {
      continue;
    }
    const sorted = [...group].sort(
      (left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id),
    );
    const keepAssetId = sorted[0].id;
    issues.push({
      type: 'duplicate-media',
      id: `duplicate-media-${index}`,
      size: sorted[0].size!,
      mtimeMs: sorted[0].mtimeMs!,
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

function collectOrphanMedia(
  media: MediaAsset[],
  usedMediaIds: Set<string>,
  folders: Project['mediaFolders'],
): OrphanMediaIssue[] {
  const unusedFolderIds = new Set(
    folders
      .filter((folder) => {
        const name = folder.name.trim().toLowerCase();
        return name === 'unused' || name === '\u672a\u4f7f\u7528';
      })
      .map((folder) => folder.id),
  );
  return sortIssuesByName(
    media
      .filter((asset) => !usedMediaIds.has(asset.id) && !(asset.folderId && unusedFolderIds.has(asset.folderId)))
      .map((asset) => ({
        type: 'orphan-media' as const,
        id: `orphan-media-${asset.id}`,
        ...mediaSummary(asset),
      })),
  );
}

function collectProxyMissingMedia(
  media: MediaAsset[],
  isMissing: (asset: MediaAsset | undefined) => boolean,
  proxySettings: ProxySettings | undefined,
): ProxyMissingIssue[] {
  return sortIssuesByName(
    media
      .filter((asset) => asset.type === 'video' && !isMissing(asset) && shouldGenerateProxy(asset, proxySettings))
      .map((asset) => ({
        type: 'proxy-missing' as const,
        id: `proxy-missing-${asset.id}`,
        ...mediaSummary(asset),
        width: asset.width,
        height: asset.height,
        proxyStatus: asset.proxyStatus,
      })),
  );
}

function collectMissingFonts(
  project: Project,
  isFontFamilyAvailable: ProjectHealthCheckOptions['isFontFamilyAvailable'],
): MissingFontIssue[] {
  if (!isFontFamilyAvailable) {
    return [];
  }
  const issues: MissingFontIssue[] = [];
  const seen = new Set<string>();
  for (const sequence of getProjectSequences(project)) {
    for (const track of sequence.timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.type !== 'subtitle') {
          continue;
        }
        const families = parseFontFamilyList(clip.style.fontFamily);
        if (
          families.length === 0 ||
          families.some((family) => isGenericFontFamily(family) || isFontFamilyAvailable(family))
        ) {
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
  return issues.sort(
    (left, right) =>
      left.fontFamily.localeCompare(right.fontFamily) || left.clip.clipName.localeCompare(right.clip.clipName),
  );
}

function toReference(clip: Clip, track: Track, sequenceId: string, sequenceName: string): ProjectHealthClipReference {
  return {
    clipId: clip.id,
    clipName: clip.name,
    trackId: track.id,
    trackName: track.name,
    sequenceId,
    sequenceName,
  };
}

function mediaSummary(asset: MediaAsset): ProjectHealthMediaSummary {
  return {
    assetId: asset.id,
    name: asset.name || fileNameFromPath(asset.path) || asset.id,
    path: asset.path,
    fileName: fileNameFromPath(asset.path || asset.name || asset.id),
  };
}

function fallbackMissingAsset(assetId: string, clipName?: string): MediaAsset {
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

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGenericFontFamily(fontFamily: string): boolean {
  return GENERIC_FONT_FAMILIES.has(fontFamily.trim().toLowerCase());
}

function sortIssuesByName<T extends { name: string; path: string }>(issues: T[]): T[] {
  return [...issues].sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'font'
  );
}
