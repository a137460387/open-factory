/**
 * Plugin AI API
 *
 * Provides plugins with access to AI capabilities:
 * transcription, TTS, color grading, and custom model inference.
 */

// ─── AI API Types ────────────────────────────────────────────

export type AITaskType =
  | 'transcription'
  | 'tts'
  | 'color-grading'
  | 'super-resolution'
  | 'speaker-diarization'
  | 'video-repair'
  | 'custom';

export interface AITaskOptions {
  /** Task type */
  type: AITaskType;
  /** Input data (file path or buffer reference) */
  input: string;
  /** Model identifier (for custom tasks) */
  model?: string;
  /** Task-specific parameters */
  params?: Record<string, unknown>;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

export interface AITaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface PluginAIAPI {
  /** Submit an AI task for processing */
  submitTask(options: AITaskOptions): Promise<string>;
  /** Get task status */
  getTaskStatus(taskId: string): Promise<{ status: string; progress: number }>;
  /** Cancel a running task */
  cancelTask(taskId: string): Promise<void>;
  /** Wait for a task to complete */
  awaitTask(taskId: string): Promise<AITaskResult>;
  /** List available AI models */
  listModels(): Promise<{ id: string; name: string; type: AITaskType }[]>;
}

// ─── AI API Implementation ────────────────────────────────────────────

interface AITaskState {
  id: string;
  type: AITaskType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  result?: AITaskResult;
}

export class PluginAIAPIImpl implements PluginAIAPI {
  private tasks = new Map<string, AITaskState>();
  private nextTaskId = 1;

  async submitTask(options: AITaskOptions): Promise<string> {
    const taskId = `ai-task-${this.nextTaskId++}`;
    this.tasks.set(taskId, {
      id: taskId,
      type: options.type,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    });

    // Simulate async processing
    setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (task && task.status !== 'cancelled') {
        task.status = 'running';
      }
    }, 100);

    return taskId;
  }

  async getTaskStatus(taskId: string): Promise<{ status: string; progress: number }> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    return { status: task.status, progress: task.progress };
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'cancelled';
  }

  async awaitTask(taskId: string): Promise<AITaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Poll until complete (simplified - real impl would use events)
    while (task.status === 'pending' || task.status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (task.result) return task.result;

    return {
      taskId,
      status: task.status === 'cancelled' ? 'cancelled' : 'failed',
      error: task.status === 'cancelled' ? 'Task was cancelled' : 'Task failed',
      durationMs: Date.now() - task.startTime,
    };
  }

  async listModels(): Promise<{ id: string; name: string; type: AITaskType }[]> {
    return [
      { id: 'whisper-base', name: 'Whisper Base', type: 'transcription' },
      { id: 'tts-v1', name: 'TTS v1', type: 'tts' },
      { id: 'color-enhance', name: 'Color Enhancement', type: 'color-grading' },
      { id: 'super-res-x2', name: 'Super Resolution 2x', type: 'super-resolution' },
    ];
  }
}
