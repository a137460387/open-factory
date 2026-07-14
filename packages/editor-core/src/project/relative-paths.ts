import type { MediaAsset } from '../model';

const DRIVE_RE = /^([a-zA-Z]):\//;

export function normalizePath(path: string): string {
  let normalized = path.trim().replace(/\\/g, '/');
  normalized = normalized.replace(/\/{2,}/g, (match, offset) => (offset === 0 ? match : '/'));
  const drive = normalized.match(DRIVE_RE);
  if (drive) {
    normalized = `${drive[1].toUpperCase()}:${normalized.slice(2)}`;
  }
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/g, '');
  }
  return normalized;
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return normalized.match(DRIVE_RE) ? normalized.slice(0, 3) : '.';
  }
  if (index === 2 && normalized.match(DRIVE_RE)) {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, index);
}

export function makeRelativePath(mediaPath: string, projectPath: string): string | null {
  const media = normalizePath(mediaPath);
  const projectDir = dirname(projectPath);
  const mediaDrive = getDrive(media);
  const projectDrive = getDrive(projectDir);

  if (mediaDrive && projectDrive && mediaDrive !== projectDrive) {
    return null;
  }
  if (mediaDrive !== projectDrive) {
    return null;
  }

  const mediaParts = stripDrive(media).split('/').filter(Boolean);
  const projectParts = stripDrive(projectDir).split('/').filter(Boolean);
  let shared = 0;
  while (
    shared < mediaParts.length &&
    shared < projectParts.length &&
    compareSegment(mediaParts[shared], projectParts[shared], Boolean(mediaDrive))
  ) {
    shared += 1;
  }

  const up = projectParts.slice(shared).map(() => '..');
  const down = mediaParts.slice(shared);
  const relative = [...up, ...down].join('/');
  return relative || './';
}

export function resolveMediaPath(asset: Pick<MediaAsset, 'path' | 'relativePath'>, projectPath?: string): string {
  if (!asset.relativePath || !projectPath) {
    return normalizePath(asset.path);
  }
  if (isAbsolutePath(asset.relativePath)) {
    return normalizePath(asset.relativePath);
  }
  return normalizePath(joinPath(dirname(projectPath), asset.relativePath));
}

export function joinPath(base: string, relative: string): string {
  const baseParts = normalizePath(base).split('/');
  const relativeParts = normalizePath(relative).split('/');
  const prefix = baseParts[0]?.match(DRIVE_RE) ? baseParts.shift() : undefined;
  for (const part of relativeParts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (baseParts.length > 0) {
        baseParts.pop();
      }
      continue;
    }
    baseParts.push(part);
  }
  return normalizePath(prefix ? `${prefix}/${baseParts.join('/')}` : baseParts.join('/'));
}

export function isCrossDrivePath(left: string, right: string): boolean {
  const leftDrive = getDrive(normalizePath(left));
  const rightDrive = getDrive(normalizePath(right));
  return Boolean(leftDrive && rightDrive && leftDrive !== rightDrive);
}

export function isAbsolutePath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.startsWith('/') || DRIVE_RE.test(normalized);
}

function getDrive(path: string): string | null {
  return path.match(DRIVE_RE)?.[1].toUpperCase() ?? null;
}

function stripDrive(path: string): string {
  return path.replace(DRIVE_RE, '/');
}

function compareSegment(left: string, right: string, windows: boolean): boolean {
  return windows ? left.toLowerCase() === right.toLowerCase() : left === right;
}
