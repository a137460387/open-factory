import { createId } from '../model';
import type { FfmpegExportPlan } from './export-types';

export type ExportTaskStatus = 'pending' | 'running' | 'canceled' | 'error' | 'success';

export interface ExportTask {
  id: string;
  name: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  status: ExportTaskStatus;
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export function createExportTask(input: { name: string; outputPath: string; plan: FfmpegExportPlan; id?: string; now?: string }): ExportTask {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id ?? createId('export-task'),
    name: input.name,
    outputPath: input.outputPath,
    plan: input.plan,
    status: 'pending',
    progress: 0,
    createdAt: now
  };
}

export function startNextExportTask(tasks: ExportTask[], now = new Date().toISOString()): ExportTask[] {
  if (tasks.some((task) => task.status === 'running')) {
    return tasks;
  }
  let started = false;
  return tasks.map((task) => {
    if (!started && task.status === 'pending') {
      started = true;
      return { ...task, status: 'running', startedAt: now };
    }
    return task;
  });
}

export function updateExportTaskProgress(tasks: ExportTask[], taskId: string, progress: number): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.min(1, Math.max(0, progress)) } : task));
}

export function finishExportTask(tasks: ExportTask[], taskId: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'success', progress: 1, finishedAt: now } : task));
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
