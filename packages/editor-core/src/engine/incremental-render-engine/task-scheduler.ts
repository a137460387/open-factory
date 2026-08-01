/**
 * Render task scheduler with priority and dependency management
 */

import type {
  RenderTask,
  RenderTaskType,
  RenderRegion,
  RenderPriority,
  RenderResult,
  IncrementalRenderConfig,
  IncrementalRenderStats,
} from './types';
import { DEFAULT_INCREMENTAL_CONFIG } from './types';

export class RenderTaskScheduler {
  private config: IncrementalRenderConfig;
  private taskQueue: RenderTask[] = [];
  private activeTasks: Map<string, RenderTask> = new Map();
  private completedTasks: Map<string, RenderTask> = new Map();
  private taskIdCounter: number = 0;

  constructor(config?: Partial<IncrementalRenderConfig>) {
    this.config = { ...DEFAULT_INCREMENTAL_CONFIG, ...config };
  }

  /**
   * Add a render task
   */
  addTask(
    type: RenderTaskType,
    region: RenderRegion,
    frame: number,
    priority: RenderPriority = 'normal',
    dependencies: string[] = []
  ): RenderTask {
    const task: RenderTask = {
      id: this.generateTaskId(),
      type,
      priority,
      status: 'pending',
      region,
      frame,
      timestamp: Date.now(),
      estimatedDurationMs: this.estimateDuration(type, region),
      actualDurationMs: 0,
      progress: 0,
      dependencies,
      createdAt: Date.now(),
    };

    this.taskQueue.push(task);
    this.sortQueue();

    return task;
  }

  /**
   * Get next executable task
   */
  getNextTask(): RenderTask | null {
    // Check if we can run more tasks
    if (this.activeTasks.size >= this.config.maxConcurrentRenders) {
      return null;
    }

    // Find first task with satisfied dependencies
    for (const task of this.taskQueue) {
      if (task.status !== 'pending') continue;

      const dependenciesSatisfied = task.dependencies.every(
        depId => this.completedTasks.has(depId)
      );

      if (dependenciesSatisfied) {
        task.status = 'queued';
        return task;
      }
    }

    return null;
  }

  /**
   * Start executing a task
   */
  startTask(task: RenderTask): void {
    task.status = 'rendering';
    task.startedAt = Date.now();
    this.activeTasks.set(task.id, task);
    this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
  }

  /**
   * Complete a task
   */
  completeTask(task: RenderTask, result: RenderResult): void {
    task.status = 'completed';
    task.completedAt = Date.now();
    task.actualDurationMs = task.completedAt - (task.startedAt || task.completedAt);
    task.progress = 1;
    task.result = result;

    this.activeTasks.delete(task.id);
    this.completedTasks.set(task.id, task);
  }

  /**
   * Mark task as failed
   */
  failTask(task: RenderTask, error: Error): void {
    task.status = 'failed';
    task.completedAt = Date.now();
    task.actualDurationMs = task.completedAt - (task.startedAt || task.completedAt);
    task.error = error;

    this.activeTasks.delete(task.id);
    this.completedTasks.set(task.id, task);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    // Check queue
    const queuedIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queuedIndex !== -1) {
      this.taskQueue[queuedIndex].status = 'cancelled';
      this.taskQueue.splice(queuedIndex, 1);
      return true;
    }

    // Check active tasks
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      activeTask.status = 'cancelled';
      this.activeTasks.delete(taskId);
      this.completedTasks.set(taskId, activeTask);
      return true;
    }

    return false;
  }

  /**
   * Cancel all tasks
   */
  cancelAllTasks(): void {
    for (const task of this.taskQueue) {
      task.status = 'cancelled';
    }
    this.taskQueue = [];

    for (const task of this.activeTasks.values()) {
      task.status = 'cancelled';
      this.completedTasks.set(task.id, task);
    }
    this.activeTasks.clear();
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.progress = Math.max(0, Math.min(1, progress));
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): RenderTask | undefined {
    return (
      this.taskQueue.find(t => t.id === taskId) ||
      this.activeTasks.get(taskId) ||
      this.completedTasks.get(taskId)
    );
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    queued: number;
    rendering: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const allTasks = [
      ...this.taskQueue,
      ...this.activeTasks.values(),
      ...this.completedTasks.values(),
    ];

    return {
      pending: allTasks.filter(t => t.status === 'pending').length,
      queued: allTasks.filter(t => t.status === 'queued').length,
      rendering: allTasks.filter(t => t.status === 'rendering').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
    };
  }

  /**
   * Get stats
   */
  getStats(): IncrementalRenderStats {
    const allTasks = [
      ...this.taskQueue,
      ...this.activeTasks.values(),
      ...this.completedTasks.values(),
    ];

    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const failedTasks = allTasks.filter(t => t.status === 'failed');
    const cancelledTasks = allTasks.filter(t => t.status === 'cancelled');

    const totalRenderTime = completedTasks.reduce(
      (sum, t) => sum + t.actualDurationMs,
      0
    );

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      cancelledTasks: cancelledTasks.length,
      averageRenderTimeMs: completedTasks.length > 0 ? totalRenderTime / completedTasks.length : 0,
      cacheHitRate: 0, // TODO: track cache hits
      queueLength: this.taskQueue.length,
      activeRenderers: this.activeTasks.size,
      framesRendered: completedTasks.filter(t => t.type === 'frame').length,
      regionsRendered: completedTasks.length,
    };
  }

  /**
   * Cleanup old completed tasks
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    for (const [id, task] of this.completedTasks) {
      if (task.completedAt && now - task.completedAt > maxAge) {
        this.completedTasks.delete(id);
      }
    }
  }

  /**
   * Reset
   */
  reset(): void {
    this.taskQueue = [];
    this.activeTasks.clear();
    this.completedTasks.clear();
    this.taskIdCounter = 0;
  }

  private generateTaskId(): string {
    return `render_task_${++this.taskIdCounter}`;
  }

  private estimateDuration(type: RenderTaskType, region: RenderRegion): number {
    const pixelCount = region.width * region.height;
    const baseMs = pixelCount / 1000000; // 1ms per megapixel

    switch (type) {
      case 'frame':
        return baseMs * 10;
      case 'effect':
        return baseMs * 20;
      case 'transition':
        return baseMs * 30;
      case 'export':
        return baseMs * 50;
      case 'thumbnail':
        return baseMs * 5;
      default:
        return baseMs * 10;
    }
  }

  private sortQueue(): void {
    const priorityOrder: Record<RenderPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    this.taskQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by frame number
      return a.frame - b.frame;
    });
  }
}
