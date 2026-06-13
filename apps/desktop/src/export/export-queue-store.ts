import {
  cancelExportTask,
  clampExportConcurrency,
  createExportTask,
  createExportTaskHistoryEntry,
  failExportTask,
  finishExportTask,
  setExportTaskLogPath,
  setExportTaskSegments,
  sortExportQueueByPriority,
  startExportTaskSlots,
  updateExportTaskSegment,
  updateExportTaskProgress,
  type ExportTask,
  type ExportTaskHistoryEntry,
  type ExportTaskPriority,
  type ExportReport,
  type FfmpegExportPlan,
  type RenderFarmSegmentStatus,
  type RenderFarmTaskConfig
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface ExportQueueState {
  tasks: ExportTask[];
  history: ExportTaskHistoryEntry[];
  runnerActive: boolean;
  resourcePaused: boolean;
  maxConcurrent: number;
  lastCompletedPath?: string;
  addTask: (input: { name: string; outputPath: string; plan: FfmpegExportPlan; priority?: ExportTaskPriority; renderFarm?: RenderFarmTaskConfig }) => ExportTask;
  startNextTasks: () => string[];
  updateTaskProgress: (taskId: string, progress: number) => void;
  setTaskSegments: (taskId: string, segments: RenderFarmSegmentStatus[]) => void;
  updateTaskSegment: (taskId: string, segmentId: string, patch: Partial<RenderFarmSegmentStatus>) => void;
  setTaskLogPath: (taskId: string, logPath: string) => void;
  finishTask: (taskId: string, report?: ExportReport) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  setMaxConcurrent: (maxConcurrent: number) => void;
  setRunnerActive: (runnerActive: boolean) => void;
  setResourcePaused: (resourcePaused: boolean) => void;
  setHistory: (history: ExportTaskHistoryEntry[]) => void;
  appendHistory: (entry: ExportTaskHistoryEntry) => void;
  clearFinishedTasks: () => void;
}

export const useExportQueueStore = create<ExportQueueState>((set, get) => ({
  tasks: [],
  history: [],
  runnerActive: false,
  resourcePaused: false,
  maxConcurrent: 2,
  addTask: (input) => {
    const task = createExportTask(input);
    set((state) => ({ tasks: sortExportQueueByPriority([...state.tasks, task]) }));
    return task;
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
  failTask: (taskId, error) => {
    set((state) => ({ tasks: failExportTask(state.tasks, taskId, error) }));
  },
  cancelTask: (taskId) => {
    set((state) => ({ tasks: cancelExportTask(state.tasks, taskId) }));
  },
  retryTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId && (task.status === 'error' || task.status === 'canceled')
          ? { ...task, status: 'pending', progress: 0, error: undefined, report: undefined, segments: undefined, startedAt: undefined, finishedAt: undefined }
          : task
      )
    }));
    set((state) => ({ tasks: sortExportQueueByPriority(state.tasks) }));
  },
  setMaxConcurrent: (maxConcurrent) => {
    set({ maxConcurrent: clampExportConcurrency(maxConcurrent) });
  },
  setRunnerActive: (runnerActive) => set({ runnerActive }),
  setResourcePaused: (resourcePaused) => set({ resourcePaused }),
  setHistory: (history) => set({ history }),
  appendHistory: (entry) => {
    set((state) => ({ history: [entry, ...state.history.filter((item) => item.id !== entry.id)].slice(0, 100) }));
  },
  clearFinishedTasks: () => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status === 'pending' || task.status === 'running')
    }));
  }
}));

export function createHistoryEntryForTask(taskId: string): ExportTaskHistoryEntry | undefined {
  const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
  return task ? createExportTaskHistoryEntry(task) : undefined;
}
