import { joinPath, makeRelativePath, normalizePath, serializeProject, type MediaAsset, type Project } from '@open-factory/editor-core';

export interface ArchiveCopyTask {
  sourcePath: string;
  destinationPath: string;
  relativePath: string;
  copyRequired: boolean;
}

export interface ProjectArchivePlan {
  archiveDir: string;
  mediaDir: string;
  projectPath: string;
  project: Project;
  copyTasks: ArchiveCopyTask[];
}

export interface ArchiveProgress {
  copied: number;
  total: number;
}

export interface ProjectArchiveDependencies {
  copyFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  writeFile(path: string, contents: string): Promise<void> | void;
}

export function collectProjectMediaPaths(project: Project): string[] {
  const paths = new Map<string, string>();
  for (const asset of project.media) {
    addPath(paths, asset.path);
    for (const framePath of asset.imageSequence?.paths ?? []) {
      addPath(paths, framePath);
    }
  }
  return Array.from(paths.values());
}

export function createProjectArchivePlan(project: Project, archiveParentDir: string): ProjectArchivePlan {
  const baseName = sanitizeArchiveBaseName(project.name);
  const archiveDir = joinPath(normalizePath(archiveParentDir), `${baseName}_archive`);
  const mediaDir = joinPath(archiveDir, 'media');
  const projectPath = joinPath(archiveDir, `${baseName}.cutproj.json`);
  const allocator = new DestinationAllocator(mediaDir);
  const mappings = new Map<string, ArchiveCopyTask>();
  const mediaPaths = collectProjectMediaPaths(project);

  for (const sourcePath of mediaPaths) {
    const normalizedSource = normalizePath(sourcePath);
    if (isInsidePath(normalizedSource, archiveDir)) {
      allocator.reserve(normalizedSource);
    }
  }

  for (const sourcePath of mediaPaths) {
    const normalizedSource = normalizePath(sourcePath);
    const alreadyArchived = isInsidePath(normalizedSource, archiveDir);
    const destinationPath = alreadyArchived ? normalizedSource : allocator.allocate(normalizedSource);
    const relativePath = makeRelativePath(destinationPath, projectPath) ?? normalizePath(destinationPath);
    mappings.set(pathKey(normalizedSource), {
      sourcePath: normalizedSource,
      destinationPath,
      relativePath,
      copyRequired: !isInsidePath(normalizedSource, archiveDir)
    });
  }

  return {
    archiveDir,
    mediaDir,
    projectPath,
    project: relativizeProject(project, mappings, projectPath, mediaDir, archiveDir),
    copyTasks: Array.from(mappings.values())
  };
}

export async function writeProjectArchive(plan: ProjectArchivePlan, dependencies: ProjectArchiveDependencies, onProgress?: (progress: ArchiveProgress) => void): Promise<void> {
  const copyTasks = plan.copyTasks.filter((task) => task.copyRequired);
  for (let index = 0; index < copyTasks.length; index += 1) {
    onProgress?.({ copied: index, total: copyTasks.length });
    await dependencies.copyFile(copyTasks[index].sourcePath, copyTasks[index].destinationPath);
  }
  onProgress?.({ copied: copyTasks.length, total: copyTasks.length });
  await dependencies.writeFile(plan.projectPath, serializeArchivedProject(plan.project));
}

export function serializeArchivedProject(project: Project): string {
  return JSON.stringify(serializeProject(project), null, 2);
}

function relativizeProject(project: Project, mappings: Map<string, ArchiveCopyTask>, projectPath: string, mediaDir: string, archiveDir: string): Project {
  return {
    ...project,
    media: project.media.map((asset) => relativizeAsset(asset, mappings, projectPath, mediaDir, archiveDir)),
    updatedAt: new Date().toISOString()
  };
}

function relativizeAsset(asset: MediaAsset, mappings: Map<string, ArchiveCopyTask>, projectPath: string, mediaDir: string, archiveDir: string): MediaAsset {
  const sourcePath = normalizePath(asset.path);
  const mapping = mappings.get(pathKey(sourcePath));
  const relativePath = mapping?.relativePath ?? makeRelativePath(sourcePath, projectPath) ?? sourcePath;
  const {
    cacheKey: _cacheKey,
    thumbnailCachePath: _thumbnailCachePath,
    waveformCachePath: _waveformCachePath,
    proxyPath: _proxyPath,
    proxyError: _proxyError,
    ...rest
  } = asset;
  return {
    ...rest,
    path: relativePath,
    relativePath,
    originalAbsolutePath: asset.originalAbsolutePath ?? sourcePath,
    proxyStatus: asset.proxyPath ? 'none' : asset.proxyStatus,
    imageSequence: asset.imageSequence
      ? {
          ...asset.imageSequence,
          pattern: relativizeImageSequencePattern(asset.imageSequence.pattern, projectPath, mediaDir, archiveDir),
          paths: asset.imageSequence.paths.map((framePath) => mappings.get(pathKey(normalizePath(framePath)))?.relativePath ?? normalizePath(framePath))
        }
      : undefined
  };
}

function relativizeImageSequencePattern(pattern: string, projectPath: string, mediaDir: string, archiveDir: string): string {
  const normalized = normalizePath(pattern);
  if (isInsidePath(normalized, archiveDir)) {
    return makeRelativePath(normalized, projectPath) ?? normalized;
  }
  return makeRelativePath(joinPath(mediaDir, fileNameFromPath(normalized, 'sequence%04d.png')), projectPath) ?? normalized;
}

function addPath(paths: Map<string, string>, path: string | undefined): void {
  if (!path?.trim()) {
    return;
  }
  const normalized = normalizePath(path);
  paths.set(pathKey(normalized), normalized);
}

function sanitizeArchiveBaseName(name: string): string {
  const trimmed = name.trim().replace(/\.cutproj(?:\.json)?$/i, '') || 'open-factory-project';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim() || 'open-factory-project';
}

function isInsidePath(path: string, parentDir: string): boolean {
  const child = normalizePath(path).toLowerCase();
  const parent = normalizePath(parentDir).replace(/\/+$/g, '').toLowerCase();
  return child === parent || child.startsWith(`${parent}/`);
}

function pathKey(path: string): string {
  return normalizePath(path).toLowerCase();
}

function fileNameFromPath(path: string, fallback: string): string {
  const fileName = normalizePath(path).split('/').filter(Boolean).pop();
  return fileName?.trim() || fallback;
}

class DestinationAllocator {
  private readonly used = new Set<string>();

  constructor(private readonly mediaDir: string) {}

  reserve(path: string): void {
    this.used.add(pathKey(path));
  }

  allocate(sourcePath: string): string {
    const fileName = fileNameFromPath(sourcePath, `media-${this.used.size + 1}`);
    const extensionIndex = fileName.lastIndexOf('.');
    const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
    let candidate = joinPath(this.mediaDir, fileName);
    let suffix = 2;
    while (this.used.has(pathKey(candidate))) {
      candidate = joinPath(this.mediaDir, `${stem}-${suffix}${extension}`);
      suffix += 1;
    }
    this.used.add(pathKey(candidate));
    return candidate;
  }
}
