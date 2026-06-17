import type { MediaAsset, Project, Timeline } from './model-types';
import { getProjectSequences, replaceProjectActiveTimeline } from './model';

export interface SmartDuplicateCandidate {
  asset: MediaAsset;
  size: number;
  duration: number;
  frameHashes: string[];
  createdAt?: string;
}

export interface SmartDuplicateAsset {
  assetId: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  width?: number;
  height?: number;
  resolutionScore: number;
  codec?: string;
  createdAt?: string;
  similarity: number;
}

export interface SmartDuplicateGroup {
  id: string;
  keepAssetId: string;
  assets: SmartDuplicateAsset[];
  similarity: number;
}

export interface RenameTemplateContext {
  date?: string | Date;
  width?: number;
  height?: number;
  codec?: string;
  index?: number;
  name?: string;
}

export interface MediaCleanupReport {
  orphaned: MediaAsset[];
  unused: MediaAsset[];
}

export interface ArchiveRelinkEntry {
  assetId: string;
  newPath: string;
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.95;
const DURATION_BUCKET_SECONDS = 0.1;

export function calculatePhashSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeHash(left);
  const normalizedRight = normalizeHash(right);
  const length = Math.max(normalizedLeft.length, normalizedRight.length);
  if (length === 0) {
    return 0;
  }
  let distance = 0;
  for (let index = 0; index < length; index += 1) {
    const leftNibble = Number.parseInt(normalizedLeft[index] ?? '0', 16);
    const rightNibble = Number.parseInt(normalizedRight[index] ?? '0', 16);
    distance += countBits((Number.isFinite(leftNibble) ? leftNibble : 0) ^ (Number.isFinite(rightNibble) ? rightNibble : 0));
  }
  return clamp01(1 - distance / (length * 4));
}

export function calculateMultiFramePhashSimilarity(left: string[], right: string[]): number {
  const pairs = Math.min(left.length, right.length);
  if (pairs === 0) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < pairs; index += 1) {
    total += calculatePhashSimilarity(left[index], right[index]);
  }
  return total / pairs;
}

export function detectSmartDuplicateGroups(
  candidates: SmartDuplicateCandidate[],
  threshold = DUPLICATE_SIMILARITY_THRESHOLD
): SmartDuplicateGroup[] {
  const buckets = new Map<string, SmartDuplicateCandidate[]>();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.size) || candidate.size <= 0 || !Number.isFinite(candidate.duration) || candidate.duration < 0 || candidate.frameHashes.length === 0) {
      continue;
    }
    const key = `${Math.round(candidate.size)}|${Math.round(candidate.duration / DURATION_BUCKET_SECONDS)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(candidate);
    buckets.set(key, bucket);
  }

  const groups: SmartDuplicateGroup[] = [];
  for (const bucket of buckets.values()) {
    const visited = new Set<string>();
    for (const candidate of bucket) {
      if (visited.has(candidate.asset.id)) {
        continue;
      }
      const matches = bucket
        .filter((other) => other.asset.id !== candidate.asset.id && !visited.has(other.asset.id))
        .map((other) => ({
          candidate: other,
          similarity: calculateMultiFramePhashSimilarity(candidate.frameHashes, other.frameHashes)
        }))
        .filter((match) => match.similarity >= threshold);
      if (matches.length === 0) {
        continue;
      }
      const groupCandidates = [candidate, ...matches.map((match) => match.candidate)];
      const distinctPaths = new Set(groupCandidates.map((item) => normalizePathKey(item.asset.path)));
      if (distinctPaths.size < 2) {
        continue;
      }
      for (const item of groupCandidates) {
        visited.add(item.asset.id);
      }
      const minimumSimilarity = Math.min(...matches.map((match) => match.similarity));
      const assets = groupCandidates.map((item) => toSmartDuplicateAsset(item, item.asset.id === candidate.asset.id ? 1 : calculateMultiFramePhashSimilarity(candidate.frameHashes, item.frameHashes)));
      const sortedAssets = assets.sort(compareDuplicateAssets);
      groups.push({
        id: `media-organizer-duplicate-${groups.length}`,
        keepAssetId: sortedAssets[0].assetId,
        assets: sortedAssets,
        similarity: minimumSimilarity
      });
    }
  }

  return groups.sort((left, right) => left.assets[0].path.localeCompare(right.assets[0].path) || left.id.localeCompare(right.id));
}

export function expandRenameTemplate(template: string, context: RenameTemplateContext): string {
  const date = formatTemplateDate(context.date);
  const resolution = context.width && context.height ? `${Math.round(context.width)}x${Math.round(context.height)}` : 'unknown-resolution';
  const codec = sanitizePathSegment(context.codec || 'unknown-codec');
  const index = String(Math.max(1, Math.round(context.index ?? 1))).padStart(3, '0');
  const name = sanitizePathSegment(context.name || 'media');
  return template
    .replace(/\{date\}/g, date)
    .replace(/\{resolution\}/g, resolution)
    .replace(/\{codec\}/g, codec)
    .replace(/\{index\}/g, index)
    .replace(/\{name\}/g, name)
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function detectMediaCleanupCandidates(project: Project, existsByPath: Record<string, boolean>): MediaCleanupReport {
  const usedIds = collectUsedMediaIds(project);
  const orphaned = project.media.filter((asset) => existsByPath[asset.path] === false);
  const orphanedIds = new Set(orphaned.map((asset) => asset.id));
  const unused = project.media.filter((asset) => !usedIds.has(asset.id) && !orphanedIds.has(asset.id));
  return { orphaned, unused };
}

export function applyArchiveRelinkPlan(project: Project, entries: ArchiveRelinkEntry[]): Project {
  if (entries.length === 0) {
    return project;
  }
  const replacements = new Map(entries.map((entry) => [entry.assetId, entry.newPath.trim()]).filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])));
  if (replacements.size === 0) {
    return project;
  }
  return {
    ...project,
    media: project.media.map((asset) => {
      const newPath = replacements.get(asset.id);
      return newPath ? { ...asset, path: newPath, relativePath: undefined } : asset;
    }),
    updatedAt: new Date().toISOString()
  };
}

export function collectUsedMediaIds(project: Project): Set<string> {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const ids = new Set<string>();
  for (const sequence of getProjectSequences(synced)) {
    collectTimelineMediaIds(sequence.timeline, ids);
  }
  return ids;
}

function collectTimelineMediaIds(timeline: Timeline, ids: Set<string>): void {
  for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
    if ('mediaId' in clip) {
      ids.add(clip.mediaId);
    }
  }
}

function toSmartDuplicateAsset(candidate: SmartDuplicateCandidate, similarity: number): SmartDuplicateAsset {
  const width = candidate.asset.width;
  const height = candidate.asset.height;
  const resolutionScore = Number.isFinite(width) && Number.isFinite(height) ? Math.max(0, Math.round((width ?? 0) * (height ?? 0))) : 0;
  return {
    assetId: candidate.asset.id,
    name: candidate.asset.name,
    path: candidate.asset.path,
    size: candidate.size,
    duration: candidate.duration,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    resolutionScore,
    ...(candidate.asset.videoCodec || candidate.asset.audioCodec ? { codec: candidate.asset.videoCodec ?? candidate.asset.audioCodec } : {}),
    ...(candidate.createdAt ? { createdAt: candidate.createdAt } : {}),
    similarity
  };
}

function compareDuplicateAssets(left: SmartDuplicateAsset, right: SmartDuplicateAsset): number {
  return right.resolutionScore - left.resolutionScore || right.size - left.size || left.path.localeCompare(right.path) || left.assetId.localeCompare(right.assetId);
}

function formatTemplateDate(value: string | Date | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    return 'unknown-date';
  }
  return date.toISOString().slice(0, 10);
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[<>:"\\|?*]+/g, '_').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'media';
}

function normalizeHash(value: string): string {
  return value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
}

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function countBits(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining > 0) {
    count += remaining & 1;
    remaining >>= 1;
  }
  return count;
}
