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
import { normalizeExportProgressPayload, type ExportProgressEvent } from './export-progress';
import { useExportQueueStore } from './export-queue-store';

let runnerPromise: Promise<void> | undefined;

export async function enqueueExport(project: Project, outputPath: string, settings?: Partial<Omit<ExportSettings, 'outputPath'>>): Promise<ExportTask> {
  if (!timelineHasExportableVideo(project.timeline)) {
    throw new Error(zhCN.errors.exportNeedsVideo);
  }
  const capabilities = await getFfmpegCapabilities();
  if (!capabilities.available) {
    throw new Error(zhCN.errors.ffmpegMissing);
  }
  const exportProject = buildExportProjectFromProject(project, { outputPath, settings });
  const plan = buildFfmpegExportPlan(exportProject, capabilities);
  const task = useExportQueueStore.getState().addTask({
    name: fileNameFromPath(outputPath) || `${project.name} 导出`,
    outputPath,
    plan
  });
  ensureExportQueueRunner();
  return task;
}

export function retryQueuedExportTask(taskId: string): void {
  useExportQueueStore.getState().retryTask(taskId);
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
    await bridgeCancelExport();
  }
}

async function runQueue(): Promise<void> {
  while (true) {
    const pending = useExportQueueStore.getState().tasks.find((task) => task.status === 'pending');
    if (!pending) {
      return;
    }

    useExportQueueStore.getState().startNextTask();
    const runningTask = useExportQueueStore.getState().tasks.find((task) => task.id === pending.id && task.status === 'running');
    if (!runningTask) {
      continue;
    }

    const unlisten = await listenBridge<ExportProgressEvent>('export-progress', (progress) => {
      const normalized = normalizeExportProgressPayload(progress);
      const latest = useExportQueueStore.getState().tasks.find((task) => task.id === runningTask.id);
      if (latest?.status === 'running') {
        useExportQueueStore.getState().updateTaskProgress(runningTask.id, normalized);
      }
    });

    try {
      await runExport(runningTask.plan);
      const latest = useExportQueueStore.getState().tasks.find((task) => task.id === runningTask.id);
      if (latest?.status === 'running') {
        useExportQueueStore.getState().finishTask(runningTask.id);
      }
    } catch (error) {
      const latest = useExportQueueStore.getState().tasks.find((task) => task.id === runningTask.id);
      if (latest?.status === 'running') {
        useExportQueueStore.getState().failTask(runningTask.id, error instanceof Error ? error.message : zhCN.errors.exportFailed);
      }
    } finally {
      unlisten();
    }
  }
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
