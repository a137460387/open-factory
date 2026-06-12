import { joinPath, type ExportTaskHistoryEntry } from '@open-factory/editor-core';
import { getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import { createHistoryEntryForTask, useExportQueueStore } from './export-queue-store';

const EXPORT_HISTORY_FILE = 'export-history.json';
const EXPORT_LOG_DIR = 'export-logs';
const MAX_HISTORY_ENTRIES = 100;

export async function getExportLogPath(taskId: string): Promise<string> {
  return joinPath(joinPath(await getAppDataDir(), EXPORT_LOG_DIR), `${safeFileName(taskId)}.log`);
}

export async function loadExportHistoryIntoStore(): Promise<void> {
  useExportQueueStore.getState().setHistory(await readExportHistory());
}

export async function persistFinishedTaskToHistory(taskId: string): Promise<void> {
  const entry = createHistoryEntryForTask(taskId);
  if (!entry) {
    return;
  }
  const nextHistory = [entry, ...(await readExportHistory()).filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES);
  await writeFile(await getExportHistoryPath(), JSON.stringify(nextHistory, null, 2));
  useExportQueueStore.getState().setHistory(nextHistory);
}

async function readExportHistory(): Promise<ExportTaskHistoryEntry[]> {
  try {
    const raw = await readFile(await getExportHistoryPath());
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isExportHistoryEntry).slice(0, MAX_HISTORY_ENTRIES) : [];
  } catch {
    return [];
  }
}

async function getExportHistoryPath(): Promise<string> {
  return joinPath(await getAppDataDir(), EXPORT_HISTORY_FILE);
}

function isExportHistoryEntry(value: unknown): value is ExportTaskHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<ExportTaskHistoryEntry>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.outputPath === 'string' &&
    (item.status === 'success' || item.status === 'error') &&
    typeof item.finishedAt === 'string'
  );
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'export-task';
}
