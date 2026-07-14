import { joinPath, type ExportTask } from '@open-factory/editor-core';
import { getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import { useExportQueueStore } from './export-queue-store';

const EXPORT_QUEUE_STATE_FILE = 'export-queue-state.json';
const EXPORT_QUEUE_STATE_VERSION = 1;

interface ExportQueueStateFile {
  version: 1;
  savedAt: string;
  tasks: ExportTask[];
}

export interface ExportQueueRecoveryCandidate {
  tasks: ExportTask[];
  pendingCount: number;
  interruptedCount: number;
}

export interface ExportQueueStateStorage {
  getAppDataDir(): Promise<string> | string;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

function getExportQueueStatePath(appDataDir: string): string {
  return joinPath(appDataDir, EXPORT_QUEUE_STATE_FILE);
}

export function serializeExportQueueState(tasks: ExportTask[], savedAt = new Date().toISOString()): string {
  const state: ExportQueueStateFile = {
    version: EXPORT_QUEUE_STATE_VERSION,
    savedAt,
    tasks: tasks.filter(isStoredExportQueueTask).map(sanitizeStoredTask),
  };
  return JSON.stringify(state, null, 2);
}

export function parseExportQueueState(
  contents: string,
  interruptedMessage: string,
): ExportQueueRecoveryCandidate | undefined {
  try {
    const parsed = JSON.parse(contents) as Partial<ExportQueueStateFile>;
    if (parsed.version !== EXPORT_QUEUE_STATE_VERSION || !Array.isArray(parsed.tasks)) {
      return undefined;
    }
    const tasks = parsed.tasks.flatMap((task) => normalizeRecoveredTask(task, interruptedMessage));
    return shouldShowExportQueueRecoveryDialog(tasks)
      ? {
          tasks,
          pendingCount: tasks.filter((task) => task.status === 'pending').length,
          interruptedCount: tasks.filter((task) => task.status === 'interrupted').length,
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function shouldShowExportQueueRecoveryDialog(tasks: ExportTask[]): boolean {
  return tasks.some((task) => task.status === 'pending' || task.status === 'interrupted');
}

export function shouldPersistExportQueueState(previous: ExportTask[], next: ExportTask[]): boolean {
  return buildPersistenceSignature(previous) !== buildPersistenceSignature(next);
}

export async function loadExportQueueRecoveryCandidate(
  interruptedMessage: string,
  storage: ExportQueueStateStorage = { getAppDataDir, readFile, writeFile },
): Promise<ExportQueueRecoveryCandidate | undefined> {
  try {
    const path = getExportQueueStatePath(await storage.getAppDataDir());
    return parseExportQueueState(await storage.readFile(path), interruptedMessage);
  } catch {
    return undefined;
  }
}

export async function persistExportQueueState(
  tasks: ExportTask[],
  storage: ExportQueueStateStorage = { getAppDataDir, readFile, writeFile },
): Promise<void> {
  const path = getExportQueueStatePath(await storage.getAppDataDir());
  await storage.writeFile(path, serializeExportQueueState(tasks));
}

export function installExportQueuePersistence(
  storage: ExportQueueStateStorage = { getAppDataDir, readFile, writeFile },
): () => void {
  let previousSignature = buildPersistenceSignature(useExportQueueStore.getState().tasks);
  return useExportQueueStore.subscribe((state) => {
    const nextTasks = state.tasks;
    const nextSignature = buildPersistenceSignature(nextTasks);
    if (nextSignature === previousSignature) {
      return;
    }
    previousSignature = nextSignature;
    void persistExportQueueState(nextTasks, storage).catch((error) => {
      console.warn('Unable to persist export queue state', error);
    });
  });
}

function normalizeRecoveredTask(task: unknown, interruptedMessage: string): ExportTask[] {
  if (!isExportTaskLike(task)) {
    return [];
  }
  if (task.status === 'pending') {
    return [
      sanitizeStoredTask({
        ...task,
        progress: 0,
        startedAt: undefined,
        finishedAt: undefined,
        error: undefined,
        report: undefined,
        segments: undefined,
      }),
    ];
  }
  if (task.status === 'interrupted') {
    return [
      sanitizeStoredTask({
        ...task,
        progress: Math.min(1, Math.max(0, task.progress)),
        finishedAt: undefined,
        report: undefined,
        segments: undefined,
      }),
    ];
  }
  if (task.status === 'running') {
    return [
      sanitizeStoredTask({
        ...task,
        status: 'interrupted',
        error: interruptedMessage,
        finishedAt: undefined,
        report: undefined,
        segments: undefined,
      }),
    ];
  }
  return [];
}

function isStoredExportQueueTask(task: ExportTask): boolean {
  return task.status === 'pending' || task.status === 'running' || task.status === 'interrupted';
}

function sanitizeStoredTask(task: ExportTask): ExportTask {
  return {
    ...task,
    progress: Math.min(1, Math.max(0, task.progress)),
    report: undefined,
    segments: task.status === 'running' || task.status === 'interrupted' ? undefined : task.segments,
    finishedAt: undefined,
  };
}

function isExportTaskLike(value: unknown): value is ExportTask {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<ExportTask>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.outputPath === 'string' &&
    Boolean(item.plan) &&
    (item.priority === 'high' || item.priority === 'normal' || item.priority === 'low') &&
    (item.status === 'pending' || item.status === 'running' || item.status === 'interrupted') &&
    typeof item.progress === 'number' &&
    typeof item.createdAt === 'string'
  );
}

function buildPersistenceSignature(tasks: ExportTask[]): string {
  return JSON.stringify(
    tasks.filter(isStoredExportQueueTask).map((task) => ({
      id: task.id,
      name: task.name,
      projectName: task.projectName,
      outputPath: task.outputPath,
      plan: task.plan,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      scheduledStartAt: task.scheduledStartAt,
      startedAt: task.startedAt,
      logPath: task.logPath,
      error: task.error,
      renderFarm: task.renderFarm,
      progressive: task.progressive,
      versionedBatch: task.versionedBatch,
    })),
  );
}
