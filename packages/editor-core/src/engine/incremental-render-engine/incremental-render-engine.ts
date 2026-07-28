/**
 * Incremental render engine
 *
 * Integrates diff detection, task scheduling, and cache management
 */

import type {
  RenderTask,
  RenderTaskType,
  RenderRegion,
  RenderPriority,
  RenderResult,
  RenderDiff,
  IncrementalRenderConfig,
  IncrementalRenderStats,
} from './types';
import { DEFAULT_INCREMENTAL_CONFIG } from './types';
import { RenderCacheManager } from './render-cache-manager';
import { DiffDetector } from './diff-detector';
import { RenderTaskScheduler } from './task-scheduler';
import { RenderProgressEstimator } from './progress-estimator';

export class IncrementalRenderEngine {
  private config: IncrementalRenderConfig;
  private cacheManager: RenderCacheManager;
  private diffDetector: DiffDetector;
  private taskScheduler: RenderTaskScheduler;
  private renderCallback: ((task: RenderTask) => Promise<RenderResult>) | null = null;
  private isRendering: boolean = false;
  private animationFrameId: number | null = null;

  constructor(config?: Partial<IncrementalRenderConfig>) {
    this.config = { ...DEFAULT_INCREMENTAL_CONFIG, ...config };
    this.cacheManager = new RenderCacheManager(this.config.renderCacheSizeMB * 1024 * 1024);
    this.diffDetector = new DiffDetector();
    this.taskScheduler = new RenderTaskScheduler(this.config);
  }

  /**
   * Get current config
   */
  getConfig(): IncrementalRenderConfig {
    return { ...this.config };
  }

  /**
   * Set render callback
   */
  setRenderCallback(callback: (task: RenderTask) => Promise<RenderResult>): void {
    this.renderCallback = callback;
  }

  /**
   * Submit render request
   */
  submitRenderRequest(
    type: RenderTaskType,
    region: RenderRegion,
    frame: number,
    priority: RenderPriority = 'normal',
    dependencies: string[] = []
  ): RenderTask {
    return this.taskScheduler.addTask(type, region, frame, priority, dependencies);
  }

  /**
   * Mark region as dirty
   */
  markDirty(region: RenderRegion, reason: string): void {
    const diff = this.diffDetector.markDirty(region, reason);

    // Create render tasks for dirty regions
    for (const dirtyRegion of diff.regions) {
      this.submitRenderRequest('frame', dirtyRegion, 0, diff.priority);
    }
  }

  /**
   * Detect diff and submit render requests
   */
  detectAndRender(
    currentFrame: number,
    currentRegions: RenderRegion[],
    reason: string
  ): RenderDiff {
    const diff = this.diffDetector.detectDiff(currentFrame, currentRegions, reason);

    // Create render tasks for changed regions
    for (const region of diff.regions) {
      this.submitRenderRequest('frame', region, currentFrame, diff.priority);
    }

    return diff;
  }

  /**
   * Start render loop
   */
  startRendering(): void {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this.renderLoop();
  }

  /**
   * Stop render loop
   */
  stopRendering(): void {
    this.isRendering = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Render loop
   */
  private renderLoop(): void {
    if (!this.isRendering) {
      return;
    }

    // Process tasks
    this.processTasks();

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  /**
   * Process render tasks
   */
  private async processTasks(): Promise<void> {
    while (true) {
      const task = this.taskScheduler.getNextTask();
      if (!task) {
        break;
      }

      // Check cache first
      const cacheKey = this.buildCacheKey(task);
      const cached = this.cacheManager.get(cacheKey);

      if (cached) {
        this.taskScheduler.completeTask(task, cached);
        continue;
      }

      // Start rendering
      this.taskScheduler.startTask(task);

      // Execute render
      if (this.renderCallback) {
        try {
          const result = await this.renderCallback(task);

          // Cache result
          if (this.config.enableRenderCache && result) {
            const estimatedBytes = task.region.width * task.region.height * 4;
            this.cacheManager.put(cacheKey, result, estimatedBytes);
          }

          this.taskScheduler.completeTask(task, result);
        } catch (error) {
          this.taskScheduler.failTask(task, error as Error);
        }
      } else {
        this.taskScheduler.failTask(task, new Error('No render callback set'));
      }
    }
  }

  /**
   * Build cache key
   */
  private buildCacheKey(task: RenderTask): string {
    return `${task.type}_${task.frame}_${task.region.x}_${task.region.y}_${task.region.width}_${task.region.height}`;
  }

  /**
   * Get render stats
   */
  getStats(): {
    render: IncrementalRenderStats;
    cache: { hits: number; misses: number; hitRate: number; sizeMB: number };
    queue: ReturnType<RenderTaskScheduler['getQueueStatus']>;
  } {
    return {
      render: this.taskScheduler.getStats(),
      cache: this.cacheManager.getStats(),
      queue: this.taskScheduler.getQueueStatus(),
    };
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): RenderTask | undefined {
    return this.taskScheduler.getTask(taskId);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    return this.taskScheduler.cancelTask(taskId);
  }

  /**
   * Cancel all tasks
   */
  cancelAllTasks(): void {
    this.taskScheduler.cancelAllTasks();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * Reset
   */
  reset(): void {
    this.stopRendering();
    this.cacheManager.clear();
    this.diffDetector.reset();
    this.taskScheduler.reset();
  }

  /**
   * Destroy engine
   */
  destroy(): void {
    this.reset();
    this.renderCallback = null;
  }
}

/**
 * Create incremental render engine instance
 */
export function createIncrementalRenderEngine(
  config?: Partial<IncrementalRenderConfig>
): IncrementalRenderEngine {
  return new IncrementalRenderEngine(config);
}

/**
 * Create render progress estimator instance
 */
export function createRenderProgressEstimator(): RenderProgressEstimator {
  return new RenderProgressEstimator();
}
