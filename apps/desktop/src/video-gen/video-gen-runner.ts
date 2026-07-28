import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useVideoGenQueueStore } from './video-gen-store';
import {
  saveTaskProgress,
  deleteTaskProgress,
} from '../lib/generation-history-db';
import { updateVideoGenTaskStatus } from '../lib/tauri-bridge/video-gen';
import type { LtxProgressPayload, LtxCompletedPayload } from '../hooks/useVideoGeneration';

let unlistenProgress: UnlistenFn | null = null;
let unlistenCompleted: UnlistenFn | null = null;
let runnerActive = false;

/**
 * Start the video generation queue runner.
 * Recovers any tasks that were 'running' when the app last exited,
 * then listens for Tauri events and processes queued tasks one at a time.
 */
export async function startVideoGenRunner(): Promise<void> {
  if (runnerActive) return;
  runnerActive = true;

  // Crash recovery: handle tasks that were 'running' when app exited
  const store = useVideoGenQueueStore.getState();
  const runningTasks = store.tasks.filter((t) => t.status === 'running');
  if (runningTasks.length > 0) {
    for (const task of runningTasks) {
      if (task.videoPath) {
        // Task has outputPath → it completed but completedAt didn't persist.
        // Mark as completed instead of re-queuing.
        store.completeTask(task.id, task.videoPath);
      } else {
        // Task has no outputPath → it was truly interrupted. Reset to queued.
        useVideoGenQueueStore.setState((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === task.id
              ? { ...t, status: 'queued' as const, startedAt: null, stage: 'queued' }
              : t,
          ),
          activeTaskId: s.activeTaskId === task.id ? null : s.activeTaskId,
        }));
        const seq = (store.taskSeqMap.get(task.id) || 0) + 1;
        store.taskSeqMap.set(task.id, seq);
        updateVideoGenTaskStatus(
          task.id,
          'queued',
          0,
          'queued',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          seq,
        ).catch((e) =>
          console.error('[video-gen-runner] reset running task failed:', e),
        );
      }
    }
    // Clear activeTaskId if it was one of the running tasks
    const activeId = useVideoGenQueueStore.getState().activeTaskId;
    if (activeId && runningTasks.some((t) => t.id === activeId)) {
      useVideoGenQueueStore.setState({ activeTaskId: null });
    }
  }

  unlistenProgress = await listen<LtxProgressPayload>('ltx-video-progress', (event) => {
    const { taskId, progress, stage } = event.payload;
    const store = useVideoGenQueueStore.getState();
    store.updateTaskProgress(taskId, progress, stage);

    saveTaskProgress({
      taskId,
      status: 'running',
      progress,
      stage,
      prompt: store.getTask(taskId)?.params.prompt ?? '',
      startedAt: store.getTask(taskId)?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    }).catch(() => {});
  });

  unlistenCompleted = await listen<LtxCompletedPayload>('ltx-video-completed', (event) => {
    const { taskId, status, videoPath } = event.payload;
    const store = useVideoGenQueueStore.getState();

    if (status === 'completed') {
      store.completeTask(taskId, videoPath ?? '');
    } else if (status === 'canceled') {
      store.cancelTask(taskId);
    } else {
      store.failTask(taskId, 'Generation failed');
    }

    deleteTaskProgress(taskId).catch(() => {});
    // Process next queued task
    processNextTask();
  });
}

/** Stop the runner and clean up event listeners */
export function stopVideoGenRunner(): void {
  unlistenProgress?.();
  unlistenCompleted?.();
  unlistenProgress = null;
  unlistenCompleted = null;
  runnerActive = false;
}

/** Process the next queued task if no task is currently active */
async function processNextTask(): Promise<void> {
  const store = useVideoGenQueueStore.getState();
  const taskId = store.startNextTask();
  if (!taskId) return;

  const task = store.getTask(taskId);
  if (!task) return;

  try {
    const response = await invoke<{ taskId: string; status: string }>(
      'generate_video',
      {
        request: {
          prompt: task.params.prompt,
          negativePrompt: task.params.negativePrompt ?? null,
          imagePath: task.params.imagePath ?? null,
          numFrames: task.params.numFrames,
          resolution: task.params.resolution,
          fps: task.params.fps,
          steps: task.params.steps,
          cfgScale: task.params.cfgScale,
          seed: task.params.seed ?? null,
        },
      },
    );

    // Persist initial task progress
    saveTaskProgress({
      taskId: response.taskId,
      status: 'running',
      progress: 0,
      stage: 'starting',
      prompt: task.params.prompt,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }).catch(() => {});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const store = useVideoGenQueueStore.getState();
    store.failTask(taskId, message, classifyError(message));
    processNextTask();
  }
}

/**
 * Submit a video generation task to the queue.
 * Returns the task ID. If no task is running, starts immediately.
 */
export async function submitVideoGenTask(
  params: import('../hooks/useVideoGeneration').VideoGenerationParams,
): Promise<string> {
  const store = useVideoGenQueueStore.getState();
  const task = store.addTask(params);

  // If no active task, start processing immediately
  if (!store.activeTaskId) {
    await processNextTask();
  }

  return task.id;
}

/**
 * Cancel a video generation task.
 * If it's the active task, cancels via Tauri; otherwise just removes from queue.
 */
export async function cancelVideoGenTask(taskId: string): Promise<void> {
  const store = useVideoGenQueueStore.getState();
  const task = store.getTask(taskId);
  if (!task) return;

  if (task.status === 'running') {
    try {
      await invoke('cancel_generation', { taskId });
    } catch {
      // If cancel fails, still mark as canceled locally
    }
    store.cancelTask(taskId);
    processNextTask();
  } else if (task.status === 'queued') {
    store.cancelTask(taskId);
  }
}

/** Classify error message to error type */
function classifyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('missing'))) {
    return 'model_not_found';
  }
  if (lower.includes('gpu') || lower.includes('cuda') || lower.includes('out of memory')) {
    return 'gpu_unavailable';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'inference_timeout';
  }
  if (lower.includes('crash') || lower.includes('exit') || lower.includes('signal')) {
    return 'sidecar_crash';
  }
  return 'unknown';
}
