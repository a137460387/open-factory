import { useCallback, useEffect } from 'react';
import { useVideoGenQueueStore, type VideoGenTask } from './video-gen-store';
import {
  submitVideoGenTask,
  cancelVideoGenTask,
  startVideoGenRunner,
  stopVideoGenRunner,
} from './video-gen-runner';
import type { VideoGenerationParams } from '../hooks/useVideoGeneration';

/** Hook return type */
export interface UseVideoGenQueueReturn {
  /** All tasks in the queue */
  tasks: VideoGenTask[];
  /** Currently active (running) task */
  activeTask: VideoGenTask | undefined;
  /** Queued tasks waiting to run */
  queuedTasks: VideoGenTask[];
  /** Whether a task is currently running */
  isRunning: boolean;
  /** Submit a new video generation task */
  submit: (params: VideoGenerationParams) => Promise<string>;
  /** Cancel a task by ID */
  cancel: (taskId: string) => Promise<void>;
  /** Remove a finished task from the list */
  remove: (taskId: string) => void;
  /** Clear all completed/failed/canceled tasks */
  clearCompleted: () => void;
}

/**
 * Hook for managing the video generation task queue.
 * Starts the runner on mount and cleans up on unmount.
 */
export function useVideoGenQueue(): UseVideoGenQueueReturn {
  const tasks = useVideoGenQueueStore((s) => s.tasks);
  const activeTaskId = useVideoGenQueueStore((s) => s.activeTaskId);
  const removeTask = useVideoGenQueueStore((s) => s.removeTask);
  const clearCompleted = useVideoGenQueueStore((s) => s.clearCompleted);
  const init = useVideoGenQueueStore((s) => s.init);

  useEffect(() => {
    let cancelled = false;
    void init().then(() => {
      if (!cancelled) {
        void startVideoGenRunner();
      }
    });
    return () => {
      cancelled = true;
      stopVideoGenRunner();
    };
  }, [init]);

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const queuedTasks = tasks.filter((t) => t.status === 'queued');
  const isRunning = activeTask != null;

  const submit = useCallback(
    async (params: VideoGenerationParams) => submitVideoGenTask(params),
    [],
  );

  const cancel = useCallback(
    async (taskId: string) => cancelVideoGenTask(taskId),
    [],
  );

  const remove = useCallback(
    (taskId: string) => removeTask(taskId),
    [removeTask],
  );

  return {
    tasks,
    activeTask,
    queuedTasks,
    isRunning,
    submit,
    cancel,
    remove,
    clearCompleted,
  };
}
