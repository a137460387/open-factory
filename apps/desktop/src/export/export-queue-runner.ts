import {
  buildExportProjectFromProject,
  buildFfmpegExportPlan,
  timelineHasExportableVideo,
  type ExportSettings,
  type ExportTask,
  type Project
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { cancelExport as bridgeCancelExport, getFfmpegCapabilities, listenBridge, runExport } from '../lib/tauri-bridge';
import { runExportBeforePlugins } from '../plugins/plugin-manager';
import { normalizeExportProgressPayload, type ExportProgressEvent } from './export-progress';
import { useExportQueueStore } from './export-queue-store';

let runnerPromise: Promise<void> | undefined;
const activeRuns = new Map<string, Promise<void>>();
let wakeRunner: (() => void) | undefined;

export async function enqueueExport(project: Project, outputPath: string, settings?: Partial<Omit<ExportSettings, 'outputPath'>>): Promise<ExportTask> {
  if (!timelineHasExportableVideo(project.timeline)) {
    throw new Error(zhCN.errors.exportNeedsVideo);
  }
  const capabilities = await getFfmpegCapabilities();
  if (!capabilities.available) {
    throw new Error(zhCN.errors.ffmpegMissing);
  }
  await runExportBeforePlugins(project, outputPath, settings);
  const exportProject = buildExportProjectFromProject(project, { outputPath, settings });
  const plan = buildFfmpegExportPlan(exportProject, capabilities);
  const task = useExportQueueStore.getState().addTask({
    name: fileNameFromPath(outputPath) || `${project.name} 导出`,
    outputPath,
    plan
  });
  signalRunner();
  ensureExportQueueRunner();
  return task;
}

export function retryQueuedExportTask(taskId: string): void {
  useExportQueueStore.getState().retryTask(taskId);
  signalRunner();
  ensureExportQueueRunner();
}

export function setExportQueueMaxConcurrent(maxConcurrent: number): void {
  useExportQueueStore.getState().setMaxConcurrent(maxConcurrent);
  signalRunner();
  ensureExportQueueRunner();
}

export function ensureExportQueueRunner(): Promise<void> {
  if (runnerPromise) {
    return runnerPromise;
  }
  useExportQueueStore.getState().setRunnerActive(true);
  runnerPromise = runQueue().finally(() => {
    runnerPromise = undefined;
    useExportQueueStore.getState().setRunnerActive(false);
  });
  return runnerPromise;
}

export async function cancelQueuedExportTask(taskId: string): Promise<void> {
  const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
  if (!task || task.status === 'success' || task.status === 'error' || task.status === 'canceled') {
    return;
  }
  useExportQueueStore.getState().cancelTask(taskId);
  if (task.status === 'running') {
    await bridgeCancelExport(taskId);
  }
  signalRunner();
}

async function runQueue(): Promise<void> {
  const unlisten = await listenBridge<ExportProgressEvent>('export-progress', (progress) => {
    const normalized = normalizeExportProgressPayload(progress);
    const taskId = getProgressTaskId(progress) ?? (activeRuns.size === 1 ? Array.from(activeRuns.keys())[0] : undefined);
    if (!taskId) {
      return;
    }
    const latest = useExportQueueStore.getState().tasks.find((task) => task.id === taskId);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().updateTaskProgress(taskId, normalized);
    }
  });

  try {
    while (true) {
      startAvailableTasks();
      const hasPending = useExportQueueStore.getState().tasks.some((task) => task.status === 'pending');
      if (!hasPending && activeRuns.size === 0) {
        return;
      }
      if (hasPending && activeRuns.size === 0) {
        continue;
      }
      await waitForRunnerWake();
    }
  } finally {
    unlisten();
  }
}

function startAvailableTasks(): void {
  for (const taskId of useExportQueueStore.getState().startNextTasks()) {
    const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
    if (!task || activeRuns.has(task.id)) {
      continue;
    }
    const promise = runSingleTask(task).finally(() => {
      activeRuns.delete(task.id);
      signalRunner();
    });
    activeRuns.set(task.id, promise);
  }
}

async function runSingleTask(task: ExportTask): Promise<void> {
  try {
    await runExport(task.plan, task.id);
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().finishTask(task.id);
    }
  } catch (error) {
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().failTask(task.id, error instanceof Error ? error.message : zhCN.errors.exportFailed);
    }
  }
}

function getProgressTaskId(progress: ExportProgressEvent): string | undefined {
  return typeof progress === 'object' && progress !== null && typeof progress.taskId === 'string' ? progress.taskId : undefined;
}

function signalRunner(): void {
  wakeRunner?.();
  wakeRunner = undefined;
}

function waitForRunnerWake(): Promise<void> {
  return new Promise((resolve) => {
    wakeRunner = resolve;
  });
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
