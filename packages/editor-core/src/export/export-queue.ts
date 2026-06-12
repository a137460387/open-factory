import { createId } from '../model';
import type { ExportReport, FfmpegExportPlan } from './export-types';

export type ExportTaskStatus = 'pending' | 'running' | 'canceled' | 'error' | 'success';
export type ExportTaskPriority = 'high' | 'normal' | 'low';

export interface ExportTask {
  id: string;
  name: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  priority: ExportTaskPriority;
  status: ExportTaskStatus;
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  logPath?: string;
  error?: string;
  report?: ExportReport;
}

export interface ExportTaskHistoryEntry {
  id: string;
  name: string;
  outputPath: string;
  status: Extract<ExportTaskStatus, 'success' | 'error'>;
  priority: ExportTaskPriority;
  createdAt: string;
  startedAt?: string;
  finishedAt: string;
  logPath?: string;
  error?: string;
}

export function createExportTask(input: { name: string; outputPath: string; plan: FfmpegExportPlan; priority?: ExportTaskPriority; id?: string; now?: string }): ExportTask {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id ?? createId('export-task'),
    name: input.name,
    outputPath: input.outputPath,
    plan: input.plan,
    priority: normalizeExportTaskPriority(input.priority),
    status: 'pending',
    progress: 0,
    createdAt: now
  };
}

export function startNextExportTask(tasks: ExportTask[], now = new Date().toISOString()): ExportTask[] {
  return startExportTaskSlots(tasks, 1, now);
}

export function clampExportConcurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 2;
  }
  return Math.min(4, Math.max(1, Math.round(value)));
}

export function startExportTaskSlots(tasks: ExportTask[], maxConcurrent = 2, now = new Date().toISOString()): ExportTask[] {
  const limit = clampExportConcurrency(maxConcurrent);
  let availableSlots = Math.max(0, limit - tasks.filter((task) => task.status === 'running').length);
  if (availableSlots === 0) {
    return tasks;
  }
  const startIds = new Set(
    tasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.status === 'pending')
      .sort(comparePendingExportTasks)
      .slice(0, availableSlots)
      .map(({ task }) => task.id)
  );
  return tasks.map((task) => {
    if (availableSlots > 0 && startIds.has(task.id)) {
      availableSlots -= 1;
      return { ...task, status: 'running', startedAt: now };
    }
    return task;
  });
}

export function updateExportTaskProgress(tasks: ExportTask[], taskId: string, progress: number): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.min(1, Math.max(0, progress)) } : task));
}

export function finishExportTask(tasks: ExportTask[], taskId: string, report?: ExportReport, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'success', progress: 1, report, finishedAt: now } : task));
}

export function failExportTask(tasks: ExportTask[], taskId: string, error: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'error', error, finishedAt: now } : task));
}

export function cancelExportTask(tasks: ExportTask[], taskId: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId && (task.status === 'pending' || task.status === 'running')
      ? { ...task, status: 'canceled', finishedAt: now }
      : task
  );
}

export function setExportTaskLogPath(tasks: ExportTask[], taskId: string, logPath: string): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, logPath } : task));
}

export function sortExportQueueByPriority(tasks: ExportTask[]): ExportTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      if (left.task.status === 'pending' && right.task.status === 'pending') {
        return comparePendingExportTasks(left, right);
      }
      return left.index - right.index;
    })
    .map(({ task }) => task);
}

export function createExportTaskHistoryEntry(task: ExportTask): ExportTaskHistoryEntry | undefined {
  if (task.status !== 'success' && task.status !== 'error') {
    return undefined;
  }
  return {
    id: task.id,
    name: task.name,
    outputPath: task.outputPath,
    status: task.status,
    priority: task.priority,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt ?? new Date().toISOString(),
    logPath: task.logPath,
    error: task.error
  };
}

export function normalizeExportTaskPriority(priority: ExportTaskPriority | undefined): ExportTaskPriority {
  return priority === 'high' || priority === 'low' ? priority : 'normal';
}

function comparePendingExportTasks(
  left: { task: ExportTask; index: number },
  right: { task: ExportTask; index: number }
): number {
  const priorityDelta = priorityWeight(right.task.priority) - priorityWeight(left.task.priority);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  const createdDelta = left.task.createdAt.localeCompare(right.task.createdAt);
  return createdDelta || left.index - right.index;
}

function priorityWeight(priority: ExportTaskPriority): number {
  return priority === 'high' ? 2 : priority === 'normal' ? 1 : 0;
}
