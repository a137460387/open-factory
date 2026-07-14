import { logError } from "../lib/error-handlers";
import {
  detectMediaCleanupCandidates,
  detectSmartDuplicateGroups,
  expandRenameTemplate,
  type MediaCleanupReport,
  type MediaAsset,
  type MediaMetadata,
  type Project,
  type SmartDuplicateCandidate,
  type SmartDuplicateGroup
} from '@open-factory/editor-core';
import { generateMediaFingerprint } from './duplicateMedia';
import { fsExists, getFileStat } from './tauri-bridge';

export async function scanSmartDuplicateMediaGroups(media: MediaAsset[], mediaMetadata: Record<string, MediaMetadata>): Promise<SmartDuplicateGroup[]> {
  const candidates: SmartDuplicateCandidate[] = [];
  for (const asset of media) {
    if (asset.missing || (asset.type !== 'video' && asset.type !== 'image') || !asset.path.trim()) {
      continue;
    }
    const stat = await getFileStat(asset.path).catch(logError("mediaOrganizer"));
    const fingerprint = mediaMetadata[asset.id]?.fingerprint ?? (await generateMediaFingerprint(asset).catch(logError("mediaOrganizer")));
    const frameHashes = fingerprint?.frameHashes?.length ? fingerprint.frameHashes : fingerprint?.hash ? [fingerprint.hash] : [];
    if (!stat || frameHashes.length === 0) {
      continue;
    }
    candidates.push({
      asset,
      size: stat.size,
      duration: asset.duration,
      frameHashes,
      createdAt: asset.importedAt
    });
  }
  return detectSmartDuplicateGroups(candidates);
}

export async function scanMediaCleanupReport(project: Project): Promise<MediaCleanupReport> {
  const existsByPath: Record<string, boolean> = {};
  for (const asset of project.media) {
    existsByPath[asset.path] = await fsExists(asset.path).catch(() => false);
  }
  return detectMediaCleanupCandidates(project, existsByPath);
}

export function buildArchiveDestinationPath(archiveDir: string, asset: MediaAsset, index: number): string {
  const root = archiveDir.replace(/[\\/]+$/, '');
  const name = sanitizeFileName(asset.name || fileNameFromPath(asset.path) || `media-${index + 1}`);
  const suffix = index > 0 ? `-${String(index + 1).padStart(3, '0')}` : '';
  const extensionIndex = name.lastIndexOf('.');
  const outputName = extensionIndex > 0 ? `${name.slice(0, extensionIndex)}${suffix}${name.slice(extensionIndex)}` : `${name}${suffix}`;
  return `${root}/${outputName}`;
}

export function buildRenameDestinationPath(asset: MediaAsset, template: string, index: number): string {
  const directory = dirname(asset.path);
  const originalName = fileNameFromPath(asset.path);
  const extension = extensionFromName(originalName);
  const stem = expandRenameTemplate(template, {
    date: asset.importedAt,
    width: asset.width,
    height: asset.height,
    codec: asset.videoCodec ?? asset.audioCodec,
    index: index + 1,
    name: originalName.replace(/\.[^.]+$/, '')
  });
  return `${directory}/${stem}${extension}`;
}

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '.';
}

function extensionFromName(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index) : '';
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]+/g, '_') || 'media';
}
