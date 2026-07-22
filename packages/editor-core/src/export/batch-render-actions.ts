/**
 * Export Queue Completion Actions
 *
 * Supports system notification and auto-shutdown after batch rendering.
 * Pure functions for state management.
 */

import { createId } from '../model';

// ─── Types ──────────────────────────────────────────────

export type CompletionActionType = 'notify' | 'shutdown' | 'sleep' | 'hibernate' | 'open_folder';

export interface CompletionAction {
  id: string;
  type: CompletionActionType;
  enabled: boolean;
  delaySeconds?: number;
  /** For notify: custom message template */
  messageTemplate?: string;
}

export interface BatchRenderConfig {
  id: string;
  name: string;
  taskIds: string[];
  completionActions: CompletionAction[];
  createdAt: string;
  status: 'pending' | 'running' | 'completed' | 'canceled';
  startedAt?: string;
  finishedAt?: string;
}

export interface BatchRenderProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskId?: string;
  currentTaskName?: string;
  overallProgress: number;
  estimatedRemainingSeconds?: number;
}

// ─── Constants ──────────────────────────────────────────

export const COMPLETION_ACTION_LABELS: Record<CompletionActionType, string> = {
  notify: '系统通知',
  shutdown: '自动关机',
  sleep: '休眠',
  hibernate: '睡眠',
  open_folder: '打开输出目录',
};

export const DEFAULT_COMPLETION_ACTIONS: CompletionAction[] = [
  { id: 'default-notify', type: 'notify', enabled: true },
];

// ─── Batch Render Management ────────────────────────────

export function createBatchRender(input: {
  name?: string;
  taskIds: string[];
  completionActions?: CompletionAction[];
}): BatchRenderConfig {
  return {
    id: createId('batch'),
    name: input.name ?? `批量渲染 ${new Date().toLocaleString('zh-CN')}`,
    taskIds: [...input.taskIds],
    completionActions: input.completionActions ?? [...DEFAULT_COMPLETION_ACTIONS],
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

export function startBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig {
  return {
    ...batch,
    status: 'running',
    startedAt: now ?? new Date().toISOString(),
  };
}

export function completeBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig {
  return {
    ...batch,
    status: 'completed',
    finishedAt: now ?? new Date().toISOString(),
  };
}

export function cancelBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig {
  return {
    ...batch,
    status: 'canceled',
    finishedAt: now ?? new Date().toISOString(),
  };
}

export function calculateBatchProgress(
  batch: BatchRenderConfig,
  taskStatuses: Map<string, { status: string; progress: number; name?: string }>,
): BatchRenderProgress {
  let completed = 0;
  let failed = 0;
  let totalProgress = 0;
  let currentTaskId: string | undefined;
  let currentTaskName: string | undefined;

  for (const taskId of batch.taskIds) {
    const task = taskStatuses.get(taskId);
    if (!task) continue;

    if (task.status === 'success') {
      completed++;
      totalProgress += 1;
    } else if (task.status === 'error') {
      failed++;
      totalProgress += 1;
    } else if (task.status === 'running') {
      totalProgress += task.progress;
      currentTaskId = taskId;
      currentTaskName = task.name;
    }
  }

  const totalTasks = batch.taskIds.length;
  const overallProgress = totalTasks > 0 ? totalProgress / totalTasks : 0;

  return {
    totalTasks,
    completedTasks: completed,
    failedTasks: failed,
    currentTaskId,
    currentTaskName,
    overallProgress: Math.round(overallProgress * 1000) / 1000,
  };
}

// ─── Completion Action Management ──────────────────────

export function addCompletionAction(
  actions: CompletionAction[],
  type: CompletionActionType,
): CompletionAction[] {
  const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return [...actions, { id, type, enabled: true }];
}

export function removeCompletionAction(
  actions: CompletionAction[],
  actionId: string,
): CompletionAction[] {
  return actions.filter((a) => a.id !== actionId);
}

export function toggleCompletionAction(
  actions: CompletionAction[],
  actionId: string,
): CompletionAction[] {
  return actions.map((a) => (a.id === actionId ? { ...a, enabled: !a.enabled } : a));
}

export function updateCompletionAction(
  actions: CompletionAction[],
  actionId: string,
  patch: Partial<Omit<CompletionAction, 'id'>>,
): CompletionAction[] {
  return actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a));
}

export function getEnabledActions(actions: CompletionAction[]): CompletionAction[] {
  return actions.filter((a) => a.enabled);
}

export function buildCompletionNotificationMessage(
  template: string,
  context: {
    batchName: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    durationSeconds?: number;
  },
): string {
  return template
    .replace(/\{batchName\}/g, context.batchName)
    .replace(/\{total\}/g, String(context.totalTasks))
    .replace(/\{completed\}/g, String(context.completedTasks))
    .replace(/\{failed\}/g, String(context.failedTasks))
    .replace(/\{duration\}/g, context.durationSeconds ? formatDuration(context.durationSeconds) : '—');
}

export const DEFAULT_NOTIFY_TEMPLATE = '「{batchName}」渲染完成：{completed}/{total} 成功';

// ─── Helpers ──────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
