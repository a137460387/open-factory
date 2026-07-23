/**
 * 任务调度器 - 基于优先级的抢占式任务队列
 *
 * 核心优化策略：
 * 1. 优先级调度 - UI 响应永远高于后台 AI 任务
 * 2. 抢占式中断 - 高优先级任务可中断低优先级任务
 * 3. 时间片调度 - 避免长时间占用主线程
 * 4. Worker 亲和性 - 尽量将任务调度到同一 Worker
 */

// ==================== 类型定义 ====================

export type TaskPriority = 'immediate' | 'high' | 'normal' | 'low' | 'background';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface Task<T = unknown> {
  id: string;
  priority: TaskPriority;
  execute: () => Promise<T>;
  onComplete?: (result: T) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  estimatedDurationMs?: number;
  canInterrupt?: boolean;
  resumeAfterInterrupt?: () => Promise<void>;
}

export interface TaskEntry<T = unknown> {
  task: Task<T>;
  status: TaskStatus;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  result: T | null;
  error: Error | null;
  retryCount: number;
}

export interface SchedulerConfig {
  maxConcurrent: number;
  timeSliceMs: number;
  enablePreemption: boolean;
  enablePriorityAging: boolean;
  agingThresholdMs: number;
  maxRetries: number;
  starvationPreventionMs: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrent: 4,
  timeSliceMs: 16, // ~1 frame at 60fps
  enablePreemption: true,
  enablePriorityAging: true,
  agingThresholdMs: 5000,
  maxRetries: 3,
  starvationPreventionMs: 10000,
};

// Priority weights for scheduling
const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  immediate: 1000,
  high: 100,
  normal: 10,
  low: 1,
  background: 0,
};

// ==================== 任务调度器实现 ====================

export class TaskScheduler {
  private config: SchedulerConfig;
  private queue: Map<string, TaskEntry> = new Map();
  private running: Map<string, TaskEntry> = new Map();
  private completed: Map<string, TaskEntry> = new Map();
  private scheduling = false;
  private starvationPrevention = new Map<string, number>();

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  // Public API

  submit<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: TaskEntry<T> = {
        task: {
          ...task,
          onComplete: (result) => {
            task.onComplete?.(result);
            resolve(result);
          },
          onError: (error) => {
            task.onError?.(error);
            reject(error);
          },
          onCancel: () => {
            task.onCancel?.();
            reject(new Error('Task cancelled'));
          },
        },
        status: 'pending',
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
        retryCount: 0,
      };

      this.queue.set(task.id, entry as TaskEntry);
      this.schedule();
    });
  }

  cancel(taskId: string): boolean {
    const entry = this.queue.get(taskId);
    if (entry && entry.status === 'pending') {
      this.queue.delete(taskId);
      entry.status = 'cancelled';
      entry.task.onCancel?.();
      return true;
    }

    const runningEntry = this.running.get(taskId);
    if (runningEntry && runningEntry.status === 'running') {
      runningEntry.status = 'cancelled';
      runningEntry.task.onCancel?.();
      this.running.delete(taskId);
      this.schedule();
      return true;
    }

    return false;
  }

  pause(taskId: string): boolean {
    const entry = this.running.get(taskId);
    if (entry && entry.status === 'running') {
      entry.status = 'paused';
      return true;
    }
    return false;
  }

  resume(taskId: string): boolean {
    const entry = this.running.get(taskId);
    if (entry && entry.status === 'paused') {
      entry.status = 'running';
      return true;
    }
    return false;
  }

  getTaskStatus(taskId: string): TaskStatus | null {
    return this.queue.get(taskId)?.status ||
           this.running.get(taskId)?.status ||
           this.completed.get(taskId)?.status ||
           null;
  }

  getStats() {
    return {
      queued: this.queue.size,
      running: this.running.size,
      completed: this.completed.size,
      total: this.queue.size + this.running.size + this.completed.size,
    };
  }

  clear(): void {
    for (const entry of this.queue.values()) {
      entry.status = 'cancelled';
      entry.task.onCancel?.();
    }
    this.queue.clear();

    for (const entry of this.running.values()) {
      entry.status = 'cancelled';
      entry.task.onCancel?.();
    }
    this.running.clear();

    this.completed.clear();
    this.starvationPrevention.clear();
  }

  // Scheduling internals

  private async schedule(): Promise<void> {
    if (this.scheduling) return;
    this.scheduling = true;

    try {
      while (this.running.size < this.config.maxConcurrent && this.queue.size > 0) {
        const nextTask = this.selectNextTask();
        if (!nextTask) break;

        this.queue.delete(nextTask.task.id);
        nextTask.status = 'running';
        nextTask.startedAt = Date.now();
        this.running.set(nextTask.task.id, nextTask);

        this.executeTask(nextTask);
      }
    } finally {
      this.scheduling = false;
    }
  }

  private selectNextTask(): TaskEntry | null {
    if (this.queue.size === 0) return null;

    let bestTask: TaskEntry | null = null;
    let bestScore = -Infinity;

    const now = Date.now();

    for (const entry of this.queue.values()) {
      if (entry.status !== 'pending') continue;

      let score = PRIORITY_WEIGHTS[entry.task.priority];

      // Priority aging: increase score for long-waiting tasks
      if (this.config.enablePriorityAging) {
        const waitTime = now - entry.createdAt;
        if (waitTime > this.config.agingThresholdMs) {
          score += Math.floor(waitTime / 100);
        }
      }

      // Starvation prevention
      if (entry.task.priority === 'background' || entry.task.priority === 'low') {
        const starvationTime = this.starvationPrevention.get(entry.task.id) || 0;
        if (now - starvationTime > this.config.starvationPreventionMs) {
          score += PRIORITY_WEIGHTS.normal;
          this.starvationPrevention.set(entry.task.id, now);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTask = entry;
      }
    }

    return bestTask;
  }

  private async executeTask(entry: TaskEntry): Promise<void> {
    const timeSlice = this.config.timeSliceMs;

    try {
      // Check for preemption
      if (this.config.enablePreemption && entry.task.canInterrupt) {
        const higherPriorityTask = this.findHigherPriorityTask(entry.task.priority);
        if (higherPriorityTask) {
          // Pause current task and boost its priority for next attempt
          entry.status = 'paused';
          this.boostPriorityForPreemptedTask(entry);
          if (entry.task.resumeAfterInterrupt) {
            await entry.task.resumeAfterInterrupt();
          }
          // Re-queue
          this.running.delete(entry.task.id);
          this.queue.set(entry.task.id, entry);
          this.schedule();
          return;
        }
      }

      // Execute with time slicing
      const result = await this.executeWithTimeSlice(entry.task.execute, timeSlice);

      if (entry.status === 'cancelled') return;

      entry.status = 'completed';
      entry.completedAt = Date.now();
      entry.result = result;
      this.running.delete(entry.task.id);
      this.completed.set(entry.task.id, entry);
      entry.task.onComplete?.(result);

      // Continue scheduling
      this.schedule();
    } catch (error) {
      if (entry.status === 'cancelled') return;

      // Time slice exceeded is a scheduling signal, not a task failure
      // Don't count it as a retry - just re-queue the task
      if (this.isTimeSliceExceeded(error)) {
        entry.status = 'pending';
        this.running.delete(entry.task.id);
        this.queue.set(entry.task.id, entry);
        this.schedule();
        return;
      }

      if (entry.retryCount < this.config.maxRetries) {
        entry.retryCount++;
        entry.status = 'pending';
        this.running.delete(entry.task.id);
        this.queue.set(entry.task.id, entry);
        this.schedule();
      } else {
        entry.status = 'failed';
        entry.error = error as Error;
        this.running.delete(entry.task.id);
        this.completed.set(entry.task.id, entry);
        entry.task.onError?.(error as Error);
      }
    }
  }

  private async executeWithTimeSlice<T>(
    execute: () => Promise<T>,
    timeSliceMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timerPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('TIME_SLICE_EXCEEDED');
        error.name = 'TimeSliceExceeded';
        reject(error);
      }, timeSliceMs);
    });

    try {
      return await Promise.race([execute(), timerPromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private isTimeSliceExceeded(error: unknown): boolean {
    return error instanceof Error && error.name === 'TimeSliceExceeded';
  }

  private findHigherPriorityTask(currentPriority: TaskPriority): TaskEntry | null {
    const currentWeight = PRIORITY_WEIGHTS[currentPriority];

    for (const entry of this.queue.values()) {
      if (entry.status === 'pending' &&
          PRIORITY_WEIGHTS[entry.task.priority] > currentWeight) {
        return entry;
      }
    }

    return null;
  }

  private boostPriorityForPreemptedTask(entry: TaskEntry): void {
    // Track how many times this task has been preempted
    const preemptCount = (entry.task as any).__preemptCount ?? 0;
    (entry.task as any).__preemptCount = preemptCount + 1;

    // After 3 preemptions, temporarily boost priority to 'normal'
    // This prevents starvation of low/background priority tasks
    if (preemptCount >= 3 && (entry.task.priority === 'low' || entry.task.priority === 'background')) {
      (entry.task as any).__originalPriority = entry.task.priority;
      entry.task.priority = 'normal';
    }
  }
}

// ==================== UI 任务调度器 ====================

export class UITaskScheduler {
  private scheduler: TaskScheduler;
  private pendingUIUpdates: Map<string, () => void> = new Map();
  private frameRequested = false;

  constructor() {
    this.scheduler = new TaskScheduler({
      maxConcurrent: 1, // UI tasks are single-threaded
      timeSliceMs: 16,
      enablePreemption: true,
      enablePriorityAging: true,
    });
  }

  scheduleUIUpdate(id: string, update: () => void): void {
    this.pendingUIUpdates.set(id, update);

    if (!this.frameRequested) {
      this.frameRequested = true;
      requestAnimationFrame(() => this.flushUIUpdates());
    }
  }

  cancelUIUpdate(id: string): void {
    this.pendingUIUpdates.delete(id);
  }

  private flushUIUpdates(): void {
    const startTime = performance.now();

    while (this.pendingUIUpdates.size > 0) {
      const entry = this.pendingUIUpdates.entries().next();
      if (entry.done) break;

      const [id, update] = entry.value;
      this.pendingUIUpdates.delete(id);

      update();

      // Yield if we've exceeded time slice
      if (performance.now() - startTime > 16) {
        break;
      }
    }

    if (this.pendingUIUpdates.size > 0) {
      requestAnimationFrame(() => this.flushUIUpdates());
    } else {
      this.frameRequested = false;
    }
  }
}

// ==================== Worker 任务调度器 ====================

export class WorkerTaskScheduler {
  private scheduler: TaskScheduler;
  private workerAffinity = new Map<string, number>(); // taskId -> preferred worker

  constructor(maxWorkers: number) {
    this.scheduler = new TaskScheduler({
      maxConcurrent: maxWorkers,
      timeSliceMs: 100, // Longer for Worker tasks
      enablePreemption: true,
      enablePriorityAging: true,
    });
  }

  submitToWorker<T>(
    taskId: string,
    workerIndex: number,
    execute: () => Promise<T>,
    priority: TaskPriority = 'normal',
  ): Promise<T> {
    this.workerAffinity.set(taskId, workerIndex);

    return this.scheduler.submit({
      id: taskId,
      priority,
      execute,
      canInterrupt: priority !== 'immediate',
    });
  }

  getPreferredWorker(taskId: string): number | null {
    return this.workerAffinity.get(taskId) ?? null;
  }

  getStats() {
    return this.scheduler.getStats();
  }

  clear(): void {
    this.scheduler.clear();
    this.workerAffinity.clear();
  }
}

// ==================== 工厂函数 ====================

export function createTaskScheduler(config?: Partial<SchedulerConfig>): TaskScheduler {
  return new TaskScheduler(config);
}

export function createUITaskScheduler(): UITaskScheduler {
  return new UITaskScheduler();
}

export function createWorkerTaskScheduler(maxWorkers: number): WorkerTaskScheduler {
  return new WorkerTaskScheduler(maxWorkers);
}
