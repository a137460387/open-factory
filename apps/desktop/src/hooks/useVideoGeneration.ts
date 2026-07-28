import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  saveTaskProgress,
  deleteTaskProgress,
  markActiveTasksAsFailed,
  type TaskProgressEntry,
} from '../lib/generation-history-db';
import { showToast } from '../lib/toast';

/** Video generation request parameters */
export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  imagePath?: string;
  numFrames: number;
  resolution: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed?: number;
}

/** Video generation status */
export type GenerationStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled';

/** Progress event from the sidecar */
export interface LtxProgressPayload {
  taskId: string;
  progress: number;
  progressPct: number;
  stage: string;
}

/** Completion event from the sidecar */
export interface LtxCompletedPayload {
  taskId: string;
  status: string;
  videoPath?: string;
}

/** Specific error types for generation failures */
export type GenerationErrorType =
  | 'model_not_found'
  | 'gpu_unavailable'
  | 'sidecar_crash'
  | 'inference_timeout'
  | 'unknown';

/** Video generation state */
export interface VideoGenerationState {
  status: GenerationStatus;
  taskId: string | null;
  progress: number;
  stage: string;
  videoPath: string | null;
  error: string | null;
  errorType: GenerationErrorType | null;
  durationMs: number | null;
}

const INITIAL_STATE: VideoGenerationState = {
  status: 'idle',
  taskId: null,
  progress: 0,
  stage: '',
  videoPath: null,
  error: null,
  errorType: null,
  durationMs: null,
};

/** Maps error messages to error types */
function classifyError(message: string): GenerationErrorType {
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

/** User-friendly error messages */
export function getErrorHint(errorType: GenerationErrorType): string {
  switch (errorType) {
    case 'model_not_found':
      return 'The AI model is not installed. Please download it from the Model Manager first.';
    case 'gpu_unavailable':
      return 'No compatible GPU detected or GPU memory is insufficient. Close other GPU-intensive applications and try again.';
    case 'inference_timeout':
      return 'The generation process took too long. Try reducing the resolution or number of frames.';
    case 'sidecar_crash':
      return 'The inference process crashed. This may be due to insufficient memory or a model error.';
    case 'unknown':
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Hook for managing LTX-Video generation lifecycle.
 */
export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>(INITIAL_STATE);
  const startTimeRef = useRef<number | null>(null);

  // Listen for progress events
  useEffect(() => {
    // Crash recovery: mark orphaned running tasks as failed
    markActiveTasksAsFailed().then((orphaned) => {
      for (const task of orphaned) {
        showToast({
          kind: 'warning',
          title: 'Generation interrupted',
          message: `Task "${task.prompt.slice(0, 50)}" was interrupted. Please try again.`,
        });
      }
    }).catch(() => {
      // DB errors are non-critical
    });

    const unlistenProgress = listen<LtxProgressPayload>('ltx-video-progress', (event) => {
      const { progress, stage } = event.payload;
      setState((prev) => ({
        ...prev,
        progress,
        stage,
        status: 'running',
      }));

      // Persist progress to IndexedDB
      const taskId = event.payload.taskId;
      if (taskId) {
        saveTaskProgress({
          taskId,
          status: 'running',
          progress,
          stage,
          prompt: '',
          startedAt: startTimeRef.current ?? Date.now(),
          updatedAt: Date.now(),
        }).catch(() => {
          // Non-critical
        });
      }
    });

    const unlistenCompleted = listen<LtxCompletedPayload>('ltx-video-completed', (event) => {
      const { status, videoPath, taskId } = event.payload;
      const durationMs = startTimeRef.current
        ? Date.now() - startTimeRef.current
        : null;

      if (status === 'completed') {
        setState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 1,
          stage: 'completed',
          videoPath: videoPath ?? null,
          durationMs,
        }));
      } else if (status === 'failed') {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: 'Generation failed',
          errorType: 'unknown',
          durationMs,
        }));
      } else if (status === 'canceled') {
        setState((prev) => ({
          ...prev,
          status: 'canceled',
          durationMs,
        }));
      }

      // Clean up task progress from IndexedDB on terminal state
      if (taskId) {
        deleteTaskProgress(taskId).catch(() => {
          // Non-critical
        });
      }
    });

    return () => {
      void unlistenProgress.then((fn) => fn());
      void unlistenCompleted.then((fn) => fn());
    };
  }, []);

  const startGeneration = useCallback(async (params: VideoGenerationParams) => {
    setState({
      ...INITIAL_STATE,
      status: 'starting',
    });
    startTimeRef.current = Date.now();

    try {
      const response = await invoke<{ taskId: string; status: string }>(
        'generate_video',
        {
          request: {
            prompt: params.prompt,
            negativePrompt: params.negativePrompt ?? null,
            imagePath: params.imagePath ?? null,
            numFrames: params.numFrames,
            resolution: params.resolution,
            fps: params.fps,
            steps: params.steps,
            cfgScale: params.cfgScale,
            seed: params.seed ?? null,
          },
        },
      );

      setState((prev) => ({
        ...prev,
        taskId: response.taskId,
        status: 'running',
      }));

      // Persist initial task progress
      saveTaskProgress({
        taskId: response.taskId,
        status: 'running',
        progress: 0,
        stage: 'starting',
        prompt: params.prompt,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      }).catch(() => {
        // Non-critical
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const errorType = classifyError(message);
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: message,
        errorType,
      }));
    }
  }, []);

  const cancelGeneration = useCallback(async () => {
    if (!state.taskId) return;

    try {
      await invoke('cancel_generation', { taskId: state.taskId });
      setState((prev) => ({
        ...prev,
        status: 'canceled',
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        error: message,
      }));
    }
  }, [state.taskId]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    startTimeRef.current = null;
  }, []);

  const isRunning = state.status === 'starting' || state.status === 'running';
  const isCompleted = state.status === 'completed';
  const isFailed = state.status === 'failed';
  const isCanceled = state.status === 'canceled';

  return {
    state,
    startGeneration,
    cancelGeneration,
    reset,
    isRunning,
    isCompleted,
    isFailed,
    isCanceled,
  };
}
