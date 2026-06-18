import { createReleaseRecordFileName, type ProjectReleaseRecord } from '@open-factory/editor-core';
import { fileNameFromPath } from '../lib/tauri';
import { fsExists, getAppDataDir, getFileStat, readFile, scanDirectory, writeFile } from '../lib/tauri-bridge';

export interface ProjectReleaseEntry extends ProjectReleaseRecord {
  path: string;
  size: number;
}

export async function saveProjectReleaseRecord(record: ProjectReleaseRecord): Promise<ProjectReleaseEntry> {
  const dir = await getProjectReleaseDir(record.projectId);
  const path = joinPath(dir, createReleaseRecordFileName(record.version, record.releasedAt));
  const contents = JSON.stringify(record, null, 2);
  await writeFile(path, contents);
  const stat = await getFileStat(path).catch(() => ({ path, size: contents.length, mtimeMs: Date.now() }));
  return { ...record, path, size: stat.size };
}

export async function listProjectReleaseRecords(projectId: string): Promise<ProjectReleaseEntry[]> {
  const dir = await getProjectReleaseDir(projectId);
  if (!(await fsExists(dir).catch(() => false))) {
    return [];
  }
  const paths = await scanDirectory(dir, 1).catch(() => []);
  const entries = await Promise.all(
    paths
      .filter((path) => isReleaseRecordFileName(fileNameFromPath(path)))
      .map(async (path) => {
        try {
          const record = parseProjectReleaseRecord(await readFile(path));
          if (record.projectId !== projectId) {
            return undefined;
          }
          const stat = await getFileStat(path).catch(() => ({ path, size: 0, mtimeMs: Date.parse(record.releasedAt) || 0 }));
          return { ...record, path, size: stat.size } satisfies ProjectReleaseEntry;
        } catch {
          return undefined;
        }
      })
  );
  return entries
    .filter((entry): entry is ProjectReleaseEntry => Boolean(entry))
    .sort((left, right) => right.releasedAt.localeCompare(left.releasedAt) || right.path.localeCompare(left.path));
}

export async function readProjectReleaseRecord(path: string): Promise<ProjectReleaseRecord> {
  return parseProjectReleaseRecord(await readFile(path));
}

export async function getProjectReleaseDir(projectId: string): Promise<string> {
  const appDataDir = await getAppDataDir();
  return joinPath(appDataDir, 'releases', encodeURIComponent(projectId || 'project'));
}

export function parseProjectReleaseRecord(contents: string): ProjectReleaseRecord {
  const parsed = JSON.parse(contents) as Partial<ProjectReleaseRecord>;
  if (parsed.schemaVersion !== 1 || typeof parsed.projectId !== 'string' || typeof parsed.version !== 'string' || typeof parsed.releasedAt !== 'string') {
    throw new Error('Invalid release record.');
  }
  return {
    schemaVersion: 1,
    id: typeof parsed.id === 'string' ? parsed.id : `release-${parsed.projectId}-${parsed.version}-${parsed.releasedAt}`,
    projectId: parsed.projectId,
    projectName: typeof parsed.projectName === 'string' ? parsed.projectName : '',
    version: parsed.version,
    releasedAt: parsed.releasedAt,
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    exportPath: typeof parsed.exportPath === 'string' ? parsed.exportPath : '',
    duration: typeof parsed.duration === 'number' && Number.isFinite(parsed.duration) ? parsed.duration : 0,
    assignee: typeof parsed.assignee === 'string' ? parsed.assignee : '',
    changelog: typeof parsed.changelog === 'string' ? parsed.changelog : '',
    snapshotPath: typeof parsed.snapshotPath === 'string' ? parsed.snapshotPath : '',
    exportPresetId: typeof parsed.exportPresetId === 'string' ? parsed.exportPresetId : undefined,
    exportPresetName: typeof parsed.exportPresetName === 'string' ? parsed.exportPresetName : undefined
  };
}

function isReleaseRecordFileName(fileName: string): boolean {
  return /^release_[0-9]+\.[0-9]+\.[0-9]+_.+\.json$/.test(fileName);
}

function joinPath(...parts: string[]): string {
  return parts
    .map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}
