import {
  cancelExportTask,
  createExportTask,
  failExportTask,
  finishExportTask,
  startNextExportTask,
  updateExportTaskProgress,
  type ExportTask,
  type FfmpegExportPlan
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface ExportQueueState {
  tasks: ExportTask[];
  runnerActive: boolean;
  lastCompletedPath?: string;
  addTask: (input: { name: string; outputPath: string; plan: FfmpegExportPlan }) => ExportTask;
  startNextTask: () => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  finishTask: (taskId: string) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  setRunnerActive: (runnerActive: boolean) => void;
  clearFinishedTasks: () => void;
}

export const useExportQueueStore = create<ExportQueueState>((set, get) => ({
  tasks: [],
  runnerActive: false,
  addTask: (input) => {
    const task = createExportTask(input);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },
  startNextTask: () => {
    set((state) => ({ tasks: startNextExportTask(state.tasks) }));
  },
  updateTaskProgress: (taskId, progress) => {
    set((state) => ({ tasks: updateExportTaskProgress(state.tasks, taskId, progress) }));
  },
  finishTask: (taskId) => {
    const task = get().tasks.find((item) => item.id === taskId);
    set((state) => ({
      tasks: finishExportTask(state.tasks, taskId),
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
          ? { ...task, status: 'pending', progress: 0, error: undefined, startedAt: undefined, finishedAt: undefined }
          : task
      )
    }));
  },
  setRunnerActive: (runnerActive) => set({ runnerActive }),
  clearFinishedTasks: () => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status === 'pending' || task.status === 'running')
    }));
  }
}));
