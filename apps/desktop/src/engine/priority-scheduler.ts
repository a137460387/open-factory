/**
 * AI Task Priority Scheduler
 *
 * Sprint AU: Manages all local AI tasks with priority scheduling.
 * When the user is interacting with the timeline (drag, playback, scrub),
 * background AI inference tasks are automatically suspended or downgraded
 * to ensure UI interaction and rendering engine have absolute CPU/GPU priority.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AITaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export type AITaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface AITask {
  id: string;
  name: string;
  priority: AITaskPriority;
  status: AITaskStatus;
  /** AbortController for cancelling the task */
  abortController: AbortController;
  /** The async work function */
  execute: (signal: AbortSignal) => Promise<void>;
  /** Called when task completes */
  onComplete?: () => void;
  /** Called when task is cancelled */
  onCancel?: () => void;
  /** Called when task fails */
  onError?: (error: Error) => void;
  /** Timestamp when task was created */
  createdAt: number;
  /** Timestamp when task was last resumed */
  resumedAt: number;
  /** Total time spent running (excluding pauses) */
  runningTimeMs: number;
}

export interface SchedulerState {
  /** Whether the user is currently interacting with the UI */
  userInteracting: boolean;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Currently running tasks by priority */
  runningByPriority: Record<AITaskPriority, number>;
  /** Maximum concurrent tasks by priority */
  maxConcurrent: Record<AITaskPriority, number>;
}

// ---------------------------------------------------------------------------
// Priority levels (higher number = higher priority)
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<AITaskPriority, number> = {
  background: 0,
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_MAX_CONCURRENT: Record<AITaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
  background: 1,
};

const USER_INTERACTION_MAX_CONCURRENT: Record<AITaskPriority, number> = {
  critical: 4,
  high: 2,
  normal: 1,
  low: 0,
  background: 0,
};

const PLAYBACK_MAX_CONCURRENT: Record<AITaskPriority, number> = {
  critical: 4,
  high: 2,
  normal: 1,
  low: 0,
  background: 0,
};

// ---------------------------------------------------------------------------
// PriorityScheduler
// ---------------------------------------------------------------------------

export class PriorityScheduler {
  private tasks = new Map<string, AITask>();
  private queue: string[] = [];
  private state: SchedulerState = {
    userInteracting: false,
    isPlaying: false,
    runningByPriority: {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    },
    maxConcurrent: { ...DEFAULT_MAX_CONCURRENT },
  };
  private listeners = new Set<(state: SchedulerState) => void>();

  /**
   * Submit a new AI task to the scheduler.
   * Returns the task ID for later reference.
   */
  submit(
    name: string,
    priority: AITaskPriority,
    execute: (signal: AbortSignal) => Promise<void>,
    callbacks?: {
      onComplete?: () => void;
      onCancel?: () => void;
      onError?: (error: Error) => void;
    },
  ): string {
    const id = `ai-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();

    const task: AITask = {
      id,
      name,
      priority,
      status: 'pending',
      abortController,
      execute,
      onComplete: callbacks?.onComplete,
      onCancel: callbacks?.onCancel,
      onError: callbacks?.onError,
      createdAt: Date.now(),
      resumedAt: 0,
      runningTimeMs: 0,
    };

    this.tasks.set(id, task);
    this.enqueue(id);
    this.processQueue();

    return id;
  }

  /**
   * Cancel a running or pending task.
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running' || task.status === 'pending') {
      task.abortController.abort();
      task.status = 'cancelled';
      this.state.runningByPriority[task.priority]--;
      this.removeFromQueue(taskId);
      task.onCancel?.();
      this.tasks.delete(taskId);
      this.notifyListeners();
      this.processQueue();
    }

    return true;
  }

  /**
   * Cancel all tasks of a specific priority or lower.
   */
  cancelByPriority(maxPriority: AITaskPriority): number {
    let cancelled = 0;
    const maxOrder = PRIORITY_ORDER[maxPriority];

    for (const [id, task] of this.tasks) {
      if (PRIORITY_ORDER[task.priority] <= maxOrder && (task.status === 'running' || task.status === 'pending')) {
        this.cancel(id);
        cancelled++;
      }
    }

    return cancelled;
  }

  /**
   * Cancel all tasks.
   */
  cancelAll(): void {
    for (const [id] of this.tasks) {
      this.cancel(id);
    }
  }

  /**
   * Notify the scheduler that the user is interacting with the UI.
   * This will pause low-priority tasks.
   */
  setUserInteracting(interacting: boolean): void {
    if (this.state.userInteracting === interacting) return;
    this.state.userInteracting = interacting;
    this.updateMaxConcurrent();
    this.processQueue();
    this.notifyListeners();
  }

  /**
   * Notify the scheduler that playback is active.
   * This will pause low-priority tasks.
   */
  setPlaying(playing: boolean): void {
    if (this.state.isPlaying === playing) return;
    this.state.isPlaying = playing;
    this.updateMaxConcurrent();
    this.processQueue();
    this.notifyListeners();
  }

  /**
   * Get the current scheduler state.
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Get all tasks (for debugging/monitoring).
   */
  getTasks(): AITask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: (state: SchedulerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private enqueue(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Insert into queue sorted by priority (highest first)
    const taskOrder = PRIORITY_ORDER[task.priority];
    let insertIdx = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuedTask = this.tasks.get(this.queue[i]);
      if (queuedTask && PRIORITY_ORDER[queuedTask.priority] < taskOrder) {
        insertIdx = i;
        break;
      }
    }
    this.queue.splice(insertIdx, 0, taskId);
  }

  private removeFromQueue(taskId: string): void {
    const idx = this.queue.indexOf(taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
    }
  }

  private updateMaxConcurrent(): void {
    if (this.state.userInteracting) {
      this.state.maxConcurrent = { ...USER_INTERACTION_MAX_CONCURRENT };
    } else if (this.state.isPlaying) {
      this.state.maxConcurrent = { ...PLAYBACK_MAX_CONCURRENT };
    } else {
      this.state.maxConcurrent = { ...DEFAULT_MAX_CONCURRENT };
    }
  }

  private processQueue(): void {
    // Pause tasks that exceed the new concurrency limits
    for (const [id, task] of this.tasks) {
      if (task.status === 'running') {
        const maxForPriority = this.state.maxConcurrent[task.priority];
        if (this.state.runningByPriority[task.priority] > maxForPriority) {
          this.pauseTask(task);
        }
      }
    }

    // Start tasks from the queue
    for (const taskId of [...this.queue]) {
      const task = this.tasks.get(taskId);
      if (!task || task.status !== 'pending') continue;

      const maxForPriority = this.state.maxConcurrent[task.priority];
      if (this.state.runningByPriority[task.priority] < maxForPriority) {
        this.startTask(task);
      }
    }
  }

  private startTask(task: AITask): void {
    task.status = 'running';
    task.resumedAt = Date.now();
    this.state.runningByPriority[task.priority]++;
    this.removeFromQueue(task.id);

    // Execute the task
    task.execute(task.abortController.signal).then(
      () => {
        if (task.status === 'cancelled') return;
        task.status = 'completed';
        task.runningTimeMs += Date.now() - task.resumedAt;
        this.state.runningByPriority[task.priority]--;
        task.onComplete?.();
        this.tasks.delete(task.id);
        this.notifyListeners();
        this.processQueue();
      },
      (error) => {
        if (task.status === 'cancelled') return;
        if (task.abortController.signal.aborted) {
          task.status = 'cancelled';
          task.onCancel?.();
        } else {
          task.status = 'cancelled';
          task.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
        this.state.runningByPriority[task.priority]--;
        this.tasks.delete(task.id);
        this.notifyListeners();
        this.processQueue();
      },
    );

    this.notifyListeners();
  }

  private pauseTask(task: AITask): void {
    if (task.status !== 'running') return;
    task.status = 'paused';
    task.runningTimeMs += Date.now() - task.resumedAt;
    this.state.runningByPriority[task.priority]--;
    // Abort the current execution - the task will be re-queued
    task.abortController.abort();
    // Create a new AbortController for when the task is resumed
    task.abortController = new AbortController();
    this.enqueue(task.id);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const aiScheduler = new PriorityScheduler();
