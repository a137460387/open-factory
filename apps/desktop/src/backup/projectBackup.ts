import type { Project } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import {
  getFileStat,
  putWebdavProject,
  readWebdavPassword,
  removeFile,
  scanDirectory,
  writeFile,
  type FileStat,
  type WebdavProjectBackupRequest,
  type WebdavProjectBackupResult,
} from '../lib/tauri-bridge';
import { readBackupSettings, saveBackupSettings, type BackupSettings } from '../settings/appSettings';

const LOCAL_BACKUP_LIMIT = 10;

export interface BackupTargetStatus {
  ok: boolean;
  path?: string;
  warning?: string;
}

export interface ProjectBackupStatus {
  attempted: boolean;
  local?: BackupTargetStatus;
  webdav?: BackupTargetStatus;
  lastBackupAt?: string;
  warning?: string;
}

export interface ProjectBackupDependencies {
  readSettings?: () => Promise<BackupSettings>;
  saveSettings?: (settings: Partial<BackupSettings>) => Promise<BackupSettings>;
  writeFile?: (path: string, contents: string) => Promise<void>;
  scanDirectory?: (path: string, depth?: number) => Promise<string[]>;
  getFileStat?: (path: string) => Promise<FileStat>;
  removeFile?: (path: string) => Promise<void>;
  readWebdavPassword?: () => Promise<string | undefined>;
  putWebdavProject?: (request: WebdavProjectBackupRequest) => Promise<WebdavProjectBackupResult>;
  now?: () => Date;
  warn?: (message: string, error?: unknown) => void;
}

export interface LocalBackupFile {
  path: string;
  mtimeMs: number;
}

export async function runProjectBackupAfterSave(
  project: Project,
  projectPath: string,
  serializedProject: string,
  dependencies: ProjectBackupDependencies = {},
): Promise<ProjectBackupStatus> {
  const readSettingsImpl = dependencies.readSettings ?? readBackupSettings;
  const saveSettingsImpl = dependencies.saveSettings ?? saveBackupSettings;
  const warn = dependencies.warn ?? ((message, error) => console.warn(message, error));
  const now = dependencies.now ?? (() => new Date());

  try {
    const settings = await readSettingsImpl();
    const status: ProjectBackupStatus = {
      attempted: Boolean(settings.local.enabled || settings.webdav.enabled),
      lastBackupAt: settings.lastBackupAt,
    };
    if (!status.attempted) {
      return status;
    }

    const warnings: string[] = [];
    let successfulBackupAt: string | undefined;

    if (settings.local.enabled) {
      status.local = await runLocalBackup(project, projectPath, serializedProject, settings, dependencies, now);
      if (status.local.ok) {
        successfulBackupAt = now().toISOString();
      } else if (status.local.warning) {
        warnings.push(status.local.warning);
      }
    }

    if (settings.webdav.enabled) {
      status.webdav = await runWebdavBackup(projectPath, serializedProject, settings, dependencies);
      if (status.webdav.ok) {
        successfulBackupAt = now().toISOString();
      } else if (status.webdav.warning) {
        warnings.push(status.webdav.warning);
      }
    }

    status.lastBackupAt = successfulBackupAt ?? settings.lastBackupAt;
    status.warning = warnings[0];
    await saveSettingsImpl({
      ...settings,
      lastBackupAt: status.lastBackupAt,
      lastBackupWarning: status.warning,
    }).catch((error) => warn(zhCN.settings.backup.statusSaveFailed, error));
    if (status.warning) {
      warn(status.warning);
    }
    return status;
  } catch (error) {
    const warning = error instanceof Error ? error.message : zhCN.settings.backup.failedMessage;
    warn(warning, error);
    return { attempted: true, warning };
  }
}

export async function runLocalBackup(
  project: Project,
  projectPath: string,
  serializedProject: string,
  settings: BackupSettings,
  dependencies: ProjectBackupDependencies = {},
  now: () => Date = () => new Date(),
): Promise<BackupTargetStatus> {
  const directory = settings.local.directory?.trim();
  if (!directory) {
    return { ok: false, warning: zhCN.settings.backup.localDirectoryMissing };
  }
  try {
    const writeFileImpl = dependencies.writeFile ?? writeFile;
    const path = createLocalBackupPath(directory, project.name, projectPath, now());
    await writeFileImpl(path, serializedProject);
    await rotateLocalBackups(directory, backupStemForProject(project.name, projectPath), dependencies);
    return { ok: true, path };
  } catch (error) {
    return { ok: false, warning: error instanceof Error ? error.message : zhCN.settings.backup.localFailedMessage };
  }
}

async function runWebdavBackup(
  projectPath: string,
  serializedProject: string,
  settings: BackupSettings,
  dependencies: ProjectBackupDependencies = {},
): Promise<BackupTargetStatus> {
  const url = settings.webdav.url?.trim();
  if (!url) {
    return { ok: false, warning: zhCN.settings.backup.webdavUrlMissing };
  }
  try {
    const request = await buildWebdavProjectBackupRequest(projectPath, serializedProject, settings, dependencies);
    await (dependencies.putWebdavProject ?? putWebdavProject)(request);
    return { ok: true, path: url };
  } catch (error) {
    return { ok: false, warning: error instanceof Error ? error.message : zhCN.settings.backup.webdavFailedMessage };
  }
}

export async function buildWebdavProjectBackupRequest(
  projectPath: string,
  serializedProject: string,
  settings: BackupSettings,
  dependencies: Pick<ProjectBackupDependencies, 'readWebdavPassword'> = {},
): Promise<WebdavProjectBackupRequest> {
  const url = settings.webdav.url?.trim();
  if (!url) {
    throw new Error(zhCN.settings.backup.webdavUrlMissing);
  }
  const password = await (dependencies.readWebdavPassword ?? readWebdavPassword)();
  return {
    url,
    username: settings.webdav.username?.trim() || undefined,
    password: password || undefined,
    projectPath,
    contents: serializedProject,
  };
}

export function createLocalBackupPath(directory: string, projectName: string, projectPath: string, date: Date): string {
  const root = directory.replace(/[\\/]+$/, '');
  return `${root}/${backupStemForProject(projectName, projectPath)}-${formatBackupTimestampForFile(date)}.cutproj.json`;
}

function backupStemForProject(projectName: string, projectPath: string): string {
  const candidate = projectName.trim() || fileStemFromPath(projectPath) || 'project';
  return sanitizeBackupStem(candidate);
}

export function sanitizeBackupStem(value: string): string {
  return (
    value
      .trim()
      .replace(/\.cutproj\.json$/i, '')
      .replace(/\.[^.]+$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'project'
  );
}

function formatBackupTimestampForFile(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    '-',
    pad(date.getUTCMilliseconds(), 3),
  ].join('');
}

export function formatBackupDisplayTime(iso: string | undefined): string | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function rotateLocalBackups(
  directory: string,
  stem: string,
  dependencies: ProjectBackupDependencies = {},
): Promise<string[]> {
  const scanDirectoryImpl = dependencies.scanDirectory ?? scanDirectory;
  const getFileStatImpl = dependencies.getFileStat ?? getFileStat;
  const removeFileImpl = dependencies.removeFile ?? removeFile;
  const files = await scanDirectoryImpl(directory, 1);
  const backups = await Promise.all(
    files
      .filter((path) => isLocalBackupPathForStem(path, stem))
      .map(async (path): Promise<LocalBackupFile> => ({ path, mtimeMs: (await getFileStatImpl(path)).mtimeMs })),
  );
  const expired = selectExpiredLocalBackups(backups);
  for (const backup of expired) {
    await removeFileImpl(backup.path);
  }
  return expired.map((backup) => backup.path);
}

export function selectExpiredLocalBackups(backups: LocalBackupFile[], limit = LOCAL_BACKUP_LIMIT): LocalBackupFile[] {
  return [...backups]
    .sort((left, right) => right.mtimeMs - left.mtimeMs || right.path.localeCompare(left.path))
    .slice(limit);
}

function isLocalBackupPathForStem(path: string, stem: string): boolean {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.startsWith(`${stem}-`) && fileName.endsWith('.cutproj.json');
}

function fileStemFromPath(path: string): string {
  return (path.split(/[\\/]/).pop() ?? '').replace(/\.cutproj\.json$/i, '').replace(/\.[^.]+$/i, '');
}
