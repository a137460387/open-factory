import type { ExportTaskHistoryEntry, ExportUploadState, ExportUploadTargetType } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import {
  copyFile,
  putWebdavExportFile,
  readExportUploadWebdavPassword,
  type WebdavExportUploadRequest,
  type WebdavExportUploadResult,
} from '../lib/tauri-bridge';
import { readExportUploadSettings, type ExportUploadSettings } from '../settings/appSettings';
import { readExportHistoryEntry, updateExportHistoryUpload } from './export-history';

export interface ExportUploadDependencies {
  copyFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  putWebdavExportFile(request: WebdavExportUploadRequest): Promise<WebdavExportUploadResult> | WebdavExportUploadResult;
  readWebdavPassword(): Promise<string | undefined> | string | undefined;
  updateHistoryUpload?(
    entryId: string,
    patch: Parameters<typeof updateExportHistoryUpload>[1],
  ): Promise<ExportTaskHistoryEntry | undefined> | ExportTaskHistoryEntry | undefined;
}

export interface ExportUploadExecution {
  targetType: ExportUploadTargetType;
  destination: string;
  started: ExportUploadState;
  finished: ExportUploadState;
}

export async function runConfiguredExportUpload(entryId: string): Promise<ExportUploadExecution | undefined> {
  const entry = await readExportHistoryEntry(entryId);
  if (!entry || entry.status !== 'success') {
    return undefined;
  }
  const settings = await readExportUploadSettings();
  return runExportUploadForHistoryEntry(entry, settings, {
    copyFile,
    putWebdavExportFile,
    readWebdavPassword: readExportUploadWebdavPassword,
  });
}

export async function retryExportUploadFromHistory(entryId: string): Promise<ExportUploadExecution | undefined> {
  return runConfiguredExportUpload(entryId);
}

export async function runExportUploadForHistoryEntry(
  entry: ExportTaskHistoryEntry,
  settings: ExportUploadSettings,
  dependencies: ExportUploadDependencies,
): Promise<ExportUploadExecution | undefined> {
  const target = resolveExportUploadTarget(entry, settings);
  if (!target) {
    return undefined;
  }
  const updateUpload = dependencies.updateHistoryUpload ?? updateExportHistoryUpload;
  const startedEntry = await updateUpload(entry.id, {
    targetType: target.targetType,
    status: 'running',
    destination: target.destination,
    progress: 0.25,
  });
  const started = startedEntry?.upload;
  try {
    if (target.targetType === 'webdav') {
      const password = await dependencies.readWebdavPassword();
      await dependencies.putWebdavExportFile({
        url: target.destination,
        username: settings.webdav.username,
        password,
        sourcePath: entry.outputPath,
      });
    } else {
      await dependencies.copyFile(entry.outputPath, target.destination);
    }
    const finishedEntry = await updateUpload(entry.id, {
      targetType: target.targetType,
      status: 'success',
      destination: target.destination,
      progress: 1,
    });
    const finished = finishedEntry?.upload;
    return started && finished
      ? { targetType: target.targetType, destination: target.destination, started, finished }
      : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : zhCN.exportDialog.upload.failedMessage;
    const finishedEntry = await updateUpload(entry.id, {
      targetType: target.targetType,
      status: 'error',
      destination: target.destination,
      error: message,
      progress: 1,
    });
    const finished = finishedEntry?.upload;
    return started && finished
      ? { targetType: target.targetType, destination: target.destination, started, finished }
      : undefined;
  }
}

export function resolveExportUploadTarget(
  entry: Pick<ExportTaskHistoryEntry, 'outputPath'>,
  settings: ExportUploadSettings,
): { targetType: ExportUploadTargetType; destination: string } | undefined {
  if (!settings.enabled) {
    return undefined;
  }
  if (settings.targetType === 'local') {
    const directory = settings.local.directory?.trim();
    return directory
      ? { targetType: 'local', destination: joinDirectoryAndFile(directory, fileNameFromPath(entry.outputPath)) }
      : undefined;
  }
  const url = settings.webdav.url?.trim();
  return url ? { targetType: 'webdav', destination: url } : undefined;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function joinDirectoryAndFile(directory: string, fileName: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/g, '')}${separator}${fileName}`;
}
