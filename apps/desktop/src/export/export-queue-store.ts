import {
  cancelExportTask,
  clampExportConcurrency,
  createExportTask,
  createExportTaskHistoryEntry,
  failExportTask,
  finishExportTask,
  interruptExportTask,
  setExportTaskLogPath,
  setExportTaskSegments,
  sortExportQueueByPriority,
  startExportTaskSlots,
  activateScheduledExportTasks,
  updateExportTaskSegment,
  updateExportTaskProgress,
  updateExportTaskProgressive,
  type ExportTask,
  type ExportTaskHistoryEntry,
  type ExportTaskPriority,
  type ExportReport,
  type FfmpegExportPlan,
  type ProgressiveExportState,
  type VersionedExportTaskMetadata,
  type RenderFarmSegmentStatus,
  type RenderFarmTaskConfig
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface ExportQueueState {
  tasks: ExportTask[];
  history: ExportTaskHistoryEntry[];
  runnerActive: boolean;
  resourcePaused: boolean;
  queuePaused: boolean;
  maxConcurrent: number;
  lastCompletedPath?: string;
  addTask: (input: { name: string; projectName?: string; outputPath: string; plan: FfmpegExportPlan; priority?: ExportTaskPriority; renderFarm?: RenderFarmTaskConfig; progressive?: ProgressiveExportState; versionedBatch?: VersionedExportTaskMetadata; scheduledStartAt?: string }) => ExportTask;
  activateScheduledTasks: (now?: string) => void;
  startNextTasks: () => string[];
  updateTaskProgress: (taskId: string, progress: number) => void;
  updateTaskProgressive: (taskId: string, patch: Partial<ProgressiveExportState>) => void;
  setTaskSegments: (taskId: string, segments: RenderFarmSegmentStatus[]) => void;
  updateTaskSegment: (taskId: string, segmentId: string, patch: Partial<RenderFarmSegmentStatus>) => void;
  setTaskLogPath: (taskId: string, logPath: string) => void;
  finishTask: (taskId: string, report?: ExportReport) => void;
  failTask: (taskId: string, error: string, report?: ExportReport) => void;
  cancelTask: (taskId: string) => void;
  interruptTask: (taskId: string, error?: string) => void;
  retryTask: (taskId: string) => void;
  restoreTasks: (tasks: ExportTask[]) => void;
  setMaxConcurrent: (maxConcurrent: number) => void;
  setRunnerActive: (runnerActive: boolean) => void;
  setResourcePaused: (resourcePaused: boolean) => void;
  setQueuePaused: (queuePaused: boolean) => void;
  setHistory: (history: ExportTaskHistoryEntry[]) => void;
  appendHistory: (entry: ExportTaskHistoryEntry) => void;
  clearFinishedTasks: () => void;
  cancelAllTasks: () => string[];
}

export const useExportQueueStore = create<ExportQueueState>((set, get) => ({
  tasks: [],
  history: [],
  runnerActive: false,
  resourcePaused: false,
  queuePaused: false,
  maxConcurrent: 2,
  addTask: (input) => {
    const task = createExportTask(input);
    set((state) => ({ tasks: sortExportQueueByPriority([...state.tasks, task]) }));
    return task;
  },
  activateScheduledTasks: (now) => {
    set((state) => ({ tasks: sortExportQueueByPriority(activateScheduledExportTasks(state.tasks, now)) }));
  },
  startNextTasks: () => {
    const before = get().tasks;
    const startedAt = new Date().toISOString();
    const after = startExportTaskSlots(before, get().maxConcurrent, startedAt);
    const startedIds = after
      .filter((task) => task.status === 'running' && before.find((previous) => previous.id === task.id)?.status === 'pending')
      .map((task) => task.id);
    set({ tasks: after });
    return startedIds;
  },
  updateTaskProgress: (taskId, progress) => {
    set((state) => ({ tasks: updateExportTaskProgress(state.tasks, taskId, progress) }));
  },
  updateTaskProgressive: (taskId, patch) => {
    set((state) => ({ tasks: updateExportTaskProgressive(state.tasks, taskId, patch) }));
  },
  setTaskSegments: (taskId, segments) => {
    set((state) => ({ tasks: setExportTaskSegments(state.tasks, taskId, segments) }));
  },
  updateTaskSegment: (taskId, segmentId, patch) => {
    set((state) => ({ tasks: updateExportTaskSegment(state.tasks, taskId, segmentId, patch) }));
  },
  setTaskLogPath: (taskId, logPath) => {
    set((state) => ({ tasks: setExportTaskLogPath(state.tasks, taskId, logPath) }));
  },
  finishTask: (taskId, report) => {
    const task = get().tasks.find((item) => item.id === taskId);
    set((state) => ({
      tasks: finishExportTask(state.tasks, taskId, report),
      lastCompletedPath: task?.outputPath ?? state.lastCompletedPath
    }));
  },
  failTask: (taskId, error, report) => {
    set((state) => ({ tasks: failExportTask(state.tasks, taskId, error, undefined, report) }));
  },
  cancelTask: (taskId) => {
    set((state) => ({ tasks: cancelExportTask(state.tasks, taskId) }));
  },
  interruptTask: (taskId, error) => {
    set((state) => ({ tasks: interruptExportTask(state.tasks, taskId, error) }));
  },
  retryTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId && (task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted')
          ? {
              ...task,
              status: 'pending',
              progress: task.progressive ? Math.min(0.999, Math.max(0, task.progressive.completedDuration / Math.max(0.001, task.plan.duration))) : 0,
              error: undefined,
              report: undefined,
              segments: undefined,
              startedAt: undefined,
              finishedAt: undefined
            }
          : task
      )
    }));
    set((state) => ({ tasks: sortExportQueueByPriority(state.tasks) }));
  },
  restoreTasks: (tasks) => {
    set((state) => {
      const restoredById = new Map(tasks.map((task) => [task.id, task]));
      const kept = state.tasks.filter((task) => !restoredById.has(task.id));
      return { tasks: sortExportQueueByPriority([...kept, ...restoredById.values()]) };
    });
  },
  setMaxConcurrent: (maxConcurrent) => {
    set({ maxConcurrent: clampExportConcurrency(maxConcurrent) });
  },
  setRunnerActive: (runnerActive) => set({ runnerActive }),
  setResourcePaused: (resourcePaused) => set({ resourcePaused }),
  setQueuePaused: (queuePaused) => set({ queuePaused }),
  setHistory: (history) => set({ history }),
  appendHistory: (entry) => {
    set((state) => ({ history: [entry, ...state.history.filter((item) => item.id !== entry.id)].slice(0, 100) }));
  },
  clearFinishedTasks: () => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status === 'scheduled' || task.status === 'pending' || task.status === 'running' || task.status === 'interrupted')
    }));
  },
  cancelAllTasks: () => {
    const cancelableIds = get()
      .tasks.filter((task) => task.status === 'scheduled' || task.status === 'pending' || task.status === 'running' || task.status === 'interrupted')
      .map((task) => task.id);
    set((state) => ({
      tasks: cancelableIds.reduce((tasks, taskId) => cancelExportTask(tasks, taskId), state.tasks)
    }));
    return cancelableIds;
  }
}));

export function createHistoryEntryForTask(taskId: string): ExportTaskHistoryEntry | undefined {
  const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
  return task ? createExportTaskHistoryEntry(task) : undefined;
}
