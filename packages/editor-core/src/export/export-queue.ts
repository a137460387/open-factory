import { createId } from '../model';
import type { ExportReport, FfmpegExportPlan } from './export-types';
import { calculateRenderFarmProgress, type RenderFarmSegmentStatus, type RenderFarmTaskConfig } from './render-farm';

export type ExportTaskStatus = 'scheduled' | 'pending' | 'running' | 'canceled' | 'error' | 'success';
export type ExportTaskPriority = 'high' | 'normal' | 'low';

export interface ExportTask {
  id: string;
  name: string;
  projectName?: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  priority: ExportTaskPriority;
  status: ExportTaskStatus;
  progress: number;
  createdAt: string;
  scheduledStartAt?: string;
  startedAt?: string;
  finishedAt?: string;
  logPath?: string;
  error?: string;
  report?: ExportReport;
  renderFarm?: RenderFarmTaskConfig;
  segments?: RenderFarmSegmentStatus[];
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

export function createExportTask(input: {
  name: string;
  projectName?: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  priority?: ExportTaskPriority;
  renderFarm?: RenderFarmTaskConfig;
  scheduledStartAt?: string;
  id?: string;
  now?: string;
}): ExportTask {
  const now = input.now ?? new Date().toISOString();
  const scheduledStartAt = normalizeScheduledStartAt(input.scheduledStartAt, now);
  return {
    id: input.id ?? createId('export-task'),
    name: input.name,
    projectName: typeof input.projectName === 'string' && input.projectName.trim() ? input.projectName.trim() : undefined,
    outputPath: input.outputPath,
    plan: input.plan,
    priority: normalizeExportTaskPriority(input.priority),
    renderFarm: normalizeRenderFarmTaskConfig(input.renderFarm),
    status: scheduledStartAt ? 'scheduled' : 'pending',
    progress: 0,
    createdAt: now,
    scheduledStartAt
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

export function activateScheduledExportTasks(tasks: ExportTask[], now = new Date().toISOString()): ExportTask[] {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    return tasks;
  }
  return tasks.map((task) => {
    if (task.status !== 'scheduled' || !task.scheduledStartAt) {
      return task;
    }
    const scheduledMs = Date.parse(task.scheduledStartAt);
    return Number.isFinite(scheduledMs) && scheduledMs <= nowMs ? { ...task, status: 'pending' } : task;
  });
}

export function updateExportTaskProgress(tasks: ExportTask[], taskId: string, progress: number): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.min(1, Math.max(0, progress)) } : task));
}

export function setExportTaskSegments(tasks: ExportTask[], taskId: string, segments: RenderFarmSegmentStatus[]): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, segments, progress: calculateRenderFarmProgress(segments) } : task));
}

export function updateExportTaskSegment(tasks: ExportTask[], taskId: string, segmentId: string, patch: Partial<RenderFarmSegmentStatus>): ExportTask[] {
  return tasks.map((task) => {
    if (task.id !== taskId || !task.segments) {
      return task;
    }
    const segments = task.segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment));
    return { ...task, segments, progress: calculateRenderFarmProgress(segments) };
  });
}

export function finishExportTask(tasks: ExportTask[], taskId: string, report?: ExportReport, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'success', progress: 1, report, finishedAt: now } : task));
}

export function failExportTask(tasks: ExportTask[], taskId: string, error: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'error', error, finishedAt: now } : task));
}

export function cancelExportTask(tasks: ExportTask[], taskId: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId && (task.status === 'scheduled' || task.status === 'pending' || task.status === 'running')
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

export function normalizeRenderFarmTaskConfig(config: RenderFarmTaskConfig | undefined): RenderFarmTaskConfig | undefined {
  if (!config?.enabled) {
    return undefined;
  }
  return {
    enabled: true,
    maxInstances: Math.min(4, Math.max(1, Math.round(Number.isFinite(config.maxInstances) ? config.maxInstances : 1)))
  };
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

function normalizeScheduledStartAt(value: string | undefined, now: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const scheduledMs = Date.parse(value);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(scheduledMs) || !Number.isFinite(nowMs) || scheduledMs <= nowMs) {
    return undefined;
  }
  return new Date(scheduledMs).toISOString();
}
