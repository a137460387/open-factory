import { createId } from '../model';
import type { ExportReport, FfmpegExportPlan } from './export-types';
import type { ProgressiveExportState } from './progressive';
import { calculateRenderFarmProgress, type RenderFarmSegmentStatus, type RenderFarmTaskConfig } from './render-farm';
import { startResourceAwareExportTaskSlots } from './scheduling';
import type {
  ExportTask,
  ExportTaskPriority,
  ExportTaskStatus,
  ExportUploadState,
  ExportUploadStatus,
  ExportUploadTargetType,
  VersionedExportTaskMetadata,
} from './queue-types';

export type {
  ExportTask,
  ExportTaskPriority,
  ExportTaskStatus,
  ExportUploadState,
  ExportUploadStatus,
  ExportUploadTargetType,
  VersionedExportTaskMetadata,
} from './queue-types';

export interface ExportTaskHistoryEntry {
  id: string;
  name: string;
  outputPath: string;
  sourcePath?: string;
  status: Extract<ExportTaskStatus, 'success' | 'error'>;
  priority: ExportTaskPriority;
  createdAt: string;
  startedAt?: string;
  finishedAt: string;
  logPath?: string;
  error?: string;
  report?: ExportReport;
  upload?: ExportUploadState;
}

export function createExportTask(input: {
  name: string;
  projectName?: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  priority?: ExportTaskPriority;
  renderFarm?: RenderFarmTaskConfig;
  progressive?: ProgressiveExportState;
  versionedBatch?: VersionedExportTaskMetadata;
  scheduledStartAt?: string;
  id?: string;
  now?: string;
}): ExportTask {
  const now = input.now ?? new Date().toISOString();
  const scheduledStartAt = normalizeScheduledStartAt(input.scheduledStartAt, now);
  const versionedBatch = normalizeVersionedExportTaskMetadata(input.versionedBatch);
  return {
    id: input.id ?? createId('export-task'),
    name: input.name,
    projectName:
      typeof input.projectName === 'string' && input.projectName.trim() ? input.projectName.trim() : undefined,
    outputPath: input.outputPath,
    plan: input.plan,
    priority: normalizeExportTaskPriority(input.priority),
    renderFarm: normalizeRenderFarmTaskConfig(input.renderFarm),
    progressive: normalizeProgressiveExportState(input.progressive),
    ...(versionedBatch ? { versionedBatch } : {}),
    status: scheduledStartAt ? 'scheduled' : 'pending',
    progress: 0,
    createdAt: now,
    scheduledStartAt,
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

export function startExportTaskSlots(
  tasks: ExportTask[],
  maxConcurrent = 2,
  now = new Date().toISOString(),
): ExportTask[] {
  return startResourceAwareExportTaskSlots(tasks, clampExportConcurrency(maxConcurrent), now);
}

function normalizeVersionedExportTaskMetadata(
  metadata: VersionedExportTaskMetadata | undefined,
): VersionedExportTaskMetadata | undefined {
  if (!metadata?.batchId?.trim() || !metadata.versionId?.trim() || !metadata.versionName?.trim()) {
    return undefined;
  }
  return {
    batchId: metadata.batchId.trim(),
    versionId: metadata.versionId.trim(),
    versionName: metadata.versionName.trim(),
    ...(metadata.platform?.trim() ? { platform: metadata.platform.trim() } : {}),
    ...(metadata.language?.trim() ? { language: metadata.language.trim() } : {}),
  };
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

export function updateExportTaskProgressive(
  tasks: ExportTask[],
  taskId: string,
  patch: Partial<ProgressiveExportState>,
): ExportTask[] {
  return tasks.map((task) => {
    if (task.id !== taskId || !task.progressive) {
      return task;
    }
    return {
      ...task,
      progressive: normalizeProgressiveExportState({ ...task.progressive, ...patch }),
    };
  });
}

export function setExportTaskSegments(
  tasks: ExportTask[],
  taskId: string,
  segments: RenderFarmSegmentStatus[],
): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, segments, progress: calculateRenderFarmProgress(segments) } : task,
  );
}

export function updateExportTaskSegment(
  tasks: ExportTask[],
  taskId: string,
  segmentId: string,
  patch: Partial<RenderFarmSegmentStatus>,
): ExportTask[] {
  return tasks.map((task) => {
    if (task.id !== taskId || !task.segments) {
      return task;
    }
    const segments = task.segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment));
    return { ...task, segments, progress: calculateRenderFarmProgress(segments) };
  });
}

export function finishExportTask(
  tasks: ExportTask[],
  taskId: string,
  report?: ExportReport,
  now = new Date().toISOString(),
): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, status: 'success', progress: 1, report, finishedAt: now } : task,
  );
}

export function failExportTask(
  tasks: ExportTask[],
  taskId: string,
  error: string,
  now = new Date().toISOString(),
  report?: ExportReport,
): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, status: 'error', error, report, finishedAt: now } : task,
  );
}

export function cancelExportTask(tasks: ExportTask[], taskId: string, now = new Date().toISOString()): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId &&
    (task.status === 'scheduled' ||
      task.status === 'pending' ||
      task.status === 'running' ||
      task.status === 'interrupted')
      ? { ...task, status: 'canceled', finishedAt: now }
      : task,
  );
}

export function interruptExportTask(
  tasks: ExportTask[],
  taskId: string,
  error?: string,
  now = new Date().toISOString(),
): ExportTask[] {
  return tasks.map((task) =>
    task.id === taskId && task.status === 'running'
      ? {
          ...task,
          status: 'interrupted',
          error,
          finishedAt: now,
        }
      : task,
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
  const sourcePath = task.plan.inputs.find((input) => input.path.trim())?.path;
  return {
    id: task.id,
    name: task.name,
    outputPath: task.outputPath,
    ...(sourcePath ? { sourcePath } : {}),
    status: task.status,
    priority: task.priority,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt ?? new Date().toISOString(),
    logPath: task.logPath,
    error: task.error,
    ...(task.report ? { report: task.report } : {}),
  };
}

export function updateExportTaskHistoryUpload(
  history: ExportTaskHistoryEntry[],
  entryId: string,
  patch: {
    targetType: ExportUploadTargetType;
    status: ExportUploadStatus;
    destination?: string;
    error?: string;
    progress?: number;
  },
  now = new Date().toISOString(),
): ExportTaskHistoryEntry[] {
  return history.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }
    const previous = entry.upload;
    const startingAttempt = patch.status === 'running' && previous?.status !== 'running';
    const progress = patch.progress ?? defaultUploadProgress(patch.status);
    const nextUpload: ExportUploadState = {
      targetType: patch.targetType,
      status: patch.status,
      progress: Math.min(1, Math.max(0, progress)),
      attempts: startingAttempt
        ? (previous?.attempts ?? 0) + 1
        : (previous?.attempts ?? (patch.status === 'running' ? 1 : 0)),
      updatedAt: now,
      ...(patch.destination
        ? { destination: patch.destination }
        : previous?.destination
          ? { destination: previous.destination }
          : {}),
      ...(patch.error ? { error: patch.error } : {}),
    };
    return { ...entry, upload: nextUpload };
  });
}

export function normalizeExportTaskPriority(priority: ExportTaskPriority | undefined): ExportTaskPriority {
  return priority === 'high' || priority === 'low' ? priority : 'normal';
}

export function normalizeRenderFarmTaskConfig(
  config: RenderFarmTaskConfig | undefined,
): RenderFarmTaskConfig | undefined {
  if (!config?.enabled) {
    return undefined;
  }
  return {
    enabled: true,
    maxInstances: Math.min(4, Math.max(1, Math.round(Number.isFinite(config.maxInstances) ? config.maxInstances : 1))),
  };
}

export function normalizeProgressiveExportState(
  state: ProgressiveExportState | undefined,
): ProgressiveExportState | undefined {
  if (!state?.enabled || !state.supported || !state.partialPath.trim()) {
    return undefined;
  }
  return {
    enabled: true,
    supported: true,
    partialPath: state.partialPath,
    completedDuration: Math.max(
      0,
      Number.isFinite(state.completedDuration) ? Math.round(state.completedDuration * 1000) / 1000 : 0,
    ),
    ...(state.fallbackReason ? { fallbackReason: state.fallbackReason } : {}),
  };
}

function comparePendingExportTasks(
  left: { task: ExportTask; index: number },
  right: { task: ExportTask; index: number },
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

function defaultUploadProgress(status: ExportUploadStatus): number {
  if (status === 'success' || status === 'error') {
    return 1;
  }
  if (status === 'running') {
    return 0.25;
  }
  return 0;
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
