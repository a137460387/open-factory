import {
  buildExportProjectFromProject,
  buildFfmpegExportPlan,
  runRenderFarmWithFallback,
  timelineHasExportableVideo,
  type ExportSettings,
  type ExportTaskPriority,
  type ExportTask,
  type Project,
  type RenderFarmTaskConfig
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { cancelExport as bridgeCancelExport, getAvailableMemoryBytes, getFfmpegCapabilities, getTempSegmentsDir, listenBridge, removeFile, runExport, writeFile } from '../lib/tauri-bridge';
import { runExportBeforePlugins } from '../plugins/plugin-manager';
import { getExportLogPath, persistFinishedTaskToHistory } from './export-history';
import { normalizeExportProgressPayload, type ExportProgressEvent } from './export-progress';
import { useExportQueueStore } from './export-queue-store';

export const EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;
const RESOURCE_RECHECK_DELAY_MS = 500;
let runnerPromise: Promise<void> | undefined;
const activeRuns = new Map<string, Promise<void>>();
let wakeRunner: (() => void) | undefined;

export async function enqueueExport(
  project: Project,
  outputPath: string,
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>,
  priority?: ExportTaskPriority,
  renderFarm?: RenderFarmTaskConfig
): Promise<ExportTask> {
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
    plan,
    priority,
    renderFarm
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
    const progressTaskId = getProgressTaskId(progress);
    const childTask = progressTaskId ? parseRenderFarmChildTaskId(progressTaskId) : undefined;
    if (childTask?.kind === 'segment') {
      useExportQueueStore.getState().updateTaskSegment(childTask.parentTaskId, childTask.segmentId, { progress: normalized });
      return;
    }
    if (childTask?.kind === 'concat') {
      useExportQueueStore.getState().updateTaskProgress(childTask.parentTaskId, 0.95 + normalized * 0.05);
      return;
    }
    const taskId = progressTaskId ?? (activeRuns.size === 1 ? Array.from(activeRuns.keys())[0] : undefined);
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
      await startAvailableTasks();
      const hasPending = useExportQueueStore.getState().tasks.some((task) => task.status === 'pending');
      if (!hasPending && activeRuns.size === 0) {
        useExportQueueStore.getState().setResourcePaused(false);
        return;
      }
      if (hasPending && activeRuns.size === 0) {
        await waitForRunnerWake(RESOURCE_RECHECK_DELAY_MS);
        continue;
      }
      await waitForRunnerWake();
    }
  } finally {
    unlisten();
  }
}

async function startAvailableTasks(): Promise<void> {
  const hasPending = useExportQueueStore.getState().tasks.some((task) => task.status === 'pending');
  if (!hasPending) {
    useExportQueueStore.getState().setResourcePaused(false);
    return;
  }
  if (await shouldPauseForMemory()) {
    useExportQueueStore.getState().setResourcePaused(true);
    return;
  }
  useExportQueueStore.getState().setResourcePaused(false);
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
  const logPath = await getExportLogPath(task.id).catch(() => undefined);
  if (logPath) {
    useExportQueueStore.getState().setTaskLogPath(task.id, logPath);
  }
  try {
    const result = task.renderFarm?.enabled
      ? await runRenderFarmWithFallback({
          taskId: task.id,
          outputPath: task.outputPath,
          plan: task.plan,
          config: task.renderFarm,
          tempSegmentsDir: await getTempSegmentsDir(),
          runPlan: (plan, taskId) => runExport(plan, taskId),
          writeFile,
          removeFile,
          onSegments: (segments) => useExportQueueStore.getState().setTaskSegments(task.id, segments),
          onSegmentUpdate: (segment) => useExportQueueStore.getState().updateTaskSegment(task.id, segment.id, segment),
          onProgress: (progress) => useExportQueueStore.getState().updateTaskProgress(task.id, progress)
        })
      : await runExport(task.plan, task.id);
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().finishTask(task.id, result.report);
      await persistFinishedTaskToHistory(task.id);
    }
  } catch (error) {
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().failTask(task.id, error instanceof Error ? error.message : zhCN.errors.exportFailed);
      await persistFinishedTaskToHistory(task.id);
    }
  }
}

async function shouldPauseForMemory(): Promise<boolean> {
  const availableMemoryBytes = await getAvailableMemoryBytes().catch(() => EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES);
  return availableMemoryBytes < EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES;
}

function getProgressTaskId(progress: ExportProgressEvent): string | undefined {
  return typeof progress === 'object' && progress !== null && typeof progress.taskId === 'string' ? progress.taskId : undefined;
}

function parseRenderFarmChildTaskId(taskId: string): { parentTaskId: string; kind: 'segment'; segmentId: string } | { parentTaskId: string; kind: 'concat' } | undefined {
  const segment = taskId.match(/^(.+):(segment-\d+)$/);
  if (segment) {
    return { parentTaskId: segment[1], kind: 'segment', segmentId: segment[2] };
  }
  const concat = taskId.match(/^(.+):concat$/);
  if (concat) {
    return { parentTaskId: concat[1], kind: 'concat' };
  }
  return undefined;
}

function signalRunner(): void {
  wakeRunner?.();
  wakeRunner = undefined;
}

function waitForRunnerWake(timeoutMs?: number): Promise<void> {
  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const complete = () => {
      if (wakeRunner === complete) {
        wakeRunner = undefined;
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve();
    };
    wakeRunner = complete;
    if (timeoutMs !== undefined) {
      timeout = setTimeout(complete, timeoutMs);
    }
  });
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
