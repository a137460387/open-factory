import { deserializeProject, serializeProject, type CutProjectFile, type Project } from '@open-factory/editor-core';
import { fileNameFromPath } from './tauri';
import { fsExists, getAppDataDir, getFileStat, readFile, removeFile, scanDirectory, writeFile } from './tauri-bridge';

const SNAPSHOT_LIMIT = 20;
const SNAPSHOT_SUFFIX = '.cutproj.json';

export interface ProjectSnapshotEntry {
  projectId: string;
  name: string;
  createdAt: string;
  path: string;
  size: number;
}

export async function saveProjectSnapshot(project: Project, name: string, projectPath?: string, limit = SNAPSHOT_LIMIT): Promise<ProjectSnapshotEntry> {
  const snapshotName = normalizeSnapshotName(name);
  const dir = await getSnapshotDir(project.id);
  const fileName = createSnapshotFileName(snapshotName);
  const path = joinPath(dir, fileName);
  const contents = JSON.stringify(serializeProject(project, projectPath), null, 2);
  await writeFile(path, contents);
  await pruneProjectSnapshots(project.id, limit);
  const stat = await getFileStat(path).catch(() => ({ path, size: contents.length, mtimeMs: Date.now() }));
  return {
    projectId: project.id,
    name: snapshotName,
    createdAt: parseSnapshotTimestamp(fileName)?.toISOString() ?? new Date(stat.mtimeMs).toISOString(),
    path,
    size: stat.size
  };
}

export async function listProjectSnapshots(projectId: string): Promise<ProjectSnapshotEntry[]> {
  const dir = await getSnapshotDir(projectId);
  if (!(await fsExists(dir).catch(() => false))) {
    return [];
  }
  const paths = await scanDirectory(dir, 1).catch(() => []);
  const entries = await Promise.all(
    paths
      .filter((path) => path.endsWith(SNAPSHOT_SUFFIX))
      .map(async (path) => {
        const fileName = fileNameFromPath(path);
        const parsed = parseSnapshotFileName(fileName);
        if (!parsed) {
          return undefined;
        }
        const stat = await getFileStat(path).catch(() => ({ path, size: 0, mtimeMs: parsed.createdAt.getTime() }));
        return {
          projectId,
          name: parsed.name,
          createdAt: parsed.createdAt.toISOString(),
          path,
          size: stat.size
        } satisfies ProjectSnapshotEntry;
      })
  );
  return entries
    .filter((entry): entry is ProjectSnapshotEntry => Boolean(entry))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.path.localeCompare(left.path));
}

export async function readProjectSnapshot(snapshot: Pick<ProjectSnapshotEntry, 'path'>, projectPathForMedia?: string): Promise<Project> {
  const raw = await readFile(snapshot.path);
  return deserializeProject(JSON.parse(raw) as CutProjectFile, projectPathForMedia);
}

export async function deleteProjectSnapshot(snapshot: Pick<ProjectSnapshotEntry, 'path'>): Promise<void> {
  await removeFile(snapshot.path);
}

export async function pruneProjectSnapshots(projectId: string, limit = SNAPSHOT_LIMIT): Promise<ProjectSnapshotEntry[]> {
  const snapshots = await listProjectSnapshots(projectId);
  const removed = snapshots.slice(Math.max(0, limit));
  for (const snapshot of removed) {
    await deleteProjectSnapshot(snapshot);
  }
  return removed;
}

export async function getSnapshotDir(projectId: string): Promise<string> {
  const appDataDir = await getAppDataDir();
  return joinPath(appDataDir, 'snapshots', encodeURIComponent(projectId || 'project'));
}

export function createSnapshotFileName(name: string, date = new Date()): string {
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `${timestamp}_${encodeURIComponent(normalizeSnapshotName(name))}${SNAPSHOT_SUFFIX}`;
}

export function normalizeSnapshotName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : 'snapshot';
}

export function formatSnapshotSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${Math.max(0, Math.round(bytes))} B`;
}

function parseSnapshotFileName(fileName: string): { name: string; createdAt: Date } | undefined {
  if (!fileName.endsWith(SNAPSHOT_SUFFIX)) {
    return undefined;
  }
  const body = fileName.slice(0, -SNAPSHOT_SUFFIX.length);
  const separator = body.indexOf('_');
  if (separator <= 0) {
    return undefined;
  }
  const timestamp = body.slice(0, separator);
  const encodedName = body.slice(separator + 1);
  const createdAt = parseSnapshotTimestamp(timestamp);
  if (!createdAt) {
    return undefined;
  }
  return {
    name: decodeSnapshotName(encodedName),
    createdAt
  };
}

function parseSnapshotTimestamp(fileNameOrTimestamp: string): Date | undefined {
  const timestamp = fileNameOrTimestamp.includes('_') ? fileNameOrTimestamp.slice(0, fileNameOrTimestamp.indexOf('_')) : fileNameOrTimestamp;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(timestamp);
  if (!match) {
    return undefined;
  }
  const [, year, month, day, hour, minute, second, millisecond] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function decodeSnapshotName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function joinPath(...parts: string[]): string {
  return parts
    .map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}
