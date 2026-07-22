/**
 * 增量渲染引擎
 *
 * 核心功能：
 * 1. 差异渲染算法 - 仅重新渲染修改部分
 * 2. 渲染任务调度 - 支持后台渲染队列
 * 3. 渲染进度预估与完成通知
 * 4. 渲染优先级管理
 */

// ==================== 类型定义 ====================

/** 渲染任务状态 */
export type RenderTaskStatus = 'pending' | 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';

/** 渲染优先级 */
export type RenderPriority = 'low' | 'normal' | 'high' | 'critical';

/** 渲染任务类型 */
export type RenderTaskType = 'frame' | 'effect' | 'transition' | 'export' | 'thumbnail';

/** 渲染区域 */
export interface RenderRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 渲染任务 */
export interface RenderTask {
  id: string;
  type: RenderTaskType;
  priority: RenderPriority;
  status: RenderTaskStatus;
  region: RenderRegion;
  frame: number;
  timestamp: number;
  estimatedDurationMs: number;
  actualDurationMs: number;
  progress: number; // 0-1
  dependencies: string[]; // task IDs
  result?: RenderResult;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** 渲染结果 */
export interface RenderResult {
  taskId: string;
  frame: number;
  region: RenderRegion;
  texture?: GPUTexture;
  bitmap?: ImageBitmap;
  renderTimeMs: number;
  fromCache: boolean;
  cacheKey?: string;
}

/** 渲染差异 */
export interface RenderDiff {
  regions: RenderRegion[];
  reason: string;
  affectedFrames: number[];
  priority: RenderPriority;
}

/** 渲染统计 */
export interface IncrementalRenderStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageRenderTimeMs: number;
  cacheHitRate: number;
  queueLength: number;
  activeRenderers: number;
  framesRendered: number;
  regionsRendered: number;
}

/** 渲染器配置 */
export interface IncrementalRenderConfig {
  /** 最大并发渲染数 */
  maxConcurrentRenders: number;
  /** 渲染队列最大长度 */
  maxQueueLength: number;
  /** 是否启用差异渲染 */
  enableDiffRendering: boolean;
  /** 是否启用渲染缓存 */
  enableRenderCache: boolean;
  /** 渲染缓存大小（MB） */
  renderCacheSizeMB: number;
  /** 渲染超时时间（ms） */
  renderTimeoutMs: number;
  /** 是否启用后台渲染 */
  enableBackgroundRendering: boolean;
  /** 后台渲染帧率限制 */
  backgroundRenderFPS: number;
  /** 渲染质量 */
  renderQuality: 'low' | 'medium' | 'high' | 'ultra';
}

/** 默认配置 */
export const DEFAULT_INCREMENTAL_CONFIG: IncrementalRenderConfig = {
  maxConcurrentRenders: 4,
  maxQueueLength: 100,
  enableDiffRendering: true,
  enableRenderCache: true,
  renderCacheSizeMB: 512,
  renderTimeoutMs: 30000,
  enableBackgroundRendering: true,
  backgroundRenderFPS: 30,
  renderQuality: 'high',
};

// ==================== 渲染缓存 ====================

/**
 * 渲染缓存管理器
 */
export class RenderCacheManager {
  private cache: Map<string, RenderResult> = new Map();
  private accessOrder: string[] = [];
  private totalBytes: number = 0;
  private readonly maxBytes: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxBytes: number = 512 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  /**
   * 获取缓存的渲染结果
   */
  get(key: string): RenderResult | undefined {
    const result = this.cache.get(key);
    if (result) {
      this.touchKey(key);
      this.hits++;
      return result;
    }
    this.misses++;
    return undefined;
  }

  /**
   * 存储渲染结果
   */
  put(key: string, result: RenderResult, estimatedBytes: number): void {
    if (this.cache.has(key)) {
      this.remove(key);
    }

    while (this.totalBytes + estimatedBytes > this.maxBytes) {
      if (this.accessOrder.length === 0) break;
      this.remove(this.accessOrder[0]);
    }

    this.cache.set(key, result);
    this.accessOrder.push(key);
    this.totalBytes += estimatedBytes;
  }

  /**
   * 移除缓存项
   */
  remove(key: string): void {
    const result = this.cache.get(key);
    if (!result) return;

    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);

    if (result.texture) {
      result.texture.destroy();
    }
    if (result.bitmap) {
      try {
        result.bitmap.close();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    for (const result of this.cache.values()) {
      if (result.texture) {
        result.texture.destroy();
      }
      if (result.bitmap) {
        try {
          result.bitmap.close();
        } catch {
          // Ignore
        }
      }
    }
    this.cache.clear();
    this.accessOrder = [];
    this.totalBytes = 0;
  }

  /**
   * 获取缓存统计
   */
  getStats(): { hits: number; misses: number; hitRate: number; sizeMB: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      sizeMB: this.totalBytes / (1024 * 1024),
    };
  }

  private touchKey(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
}

// ==================== 差异检测器 ====================

/**
 * 差异检测器
 *
 * 检测渲染区域的变化，生成渲染差异
 */
export class DiffDetector {
  private previousRegions: Map<string, RenderRegion> = new Map();
  private previousFrame: number = -1;

  /**
   * 检测差异
   */
  detectDiff(
    currentFrame: number,
    currentRegions: RenderRegion[],
    reason: string
  ): RenderDiff {
    const diff: RenderDiff = {
      regions: [],
      reason,
      affectedFrames: [currentFrame],
      priority: 'normal',
    };

    // If frame changed, render all regions
    if (currentFrame !== this.previousFrame) {
      diff.regions = currentRegions;
      diff.priority = 'high';
    } else {
      // Compare regions
      for (const region of currentRegions) {
        const key = this.regionToKey(region);
        const previous = this.previousRegions.get(key);

        if (!previous || this.regionsDifferent(previous, region)) {
          diff.regions.push(region);
        }
      }
    }

    // Update previous state
    this.previousRegions.clear();
    for (const region of currentRegions) {
      const key = this.regionToKey(region);
      this.previousRegions.set(key, { ...region });
    }
    this.previousFrame = currentFrame;

    return diff;
  }

  /**
   * 标记区域为脏
   */
  markDirty(region: RenderRegion, reason: string): RenderDiff {
    return {
      regions: [region],
      reason,
      affectedFrames: [],
      priority: 'normal',
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.previousRegions.clear();
    this.previousFrame = -1;
  }

  private regionToKey(region: RenderRegion): string {
    return `${region.x}_${region.y}_${region.width}_${region.height}`;
  }

  private regionsDifferent(a: RenderRegion, b: RenderRegion): boolean {
    return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
  }
}

// ==================== 渲染任务调度器 ====================

/**
 * 渲染任务调度器
 *
 * 管理渲染任务的优先级和执行顺序
 */
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
   * 添加渲染任务
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
   * 获取下一个可执行的任务
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
   * 开始执行任务
   */
  startTask(task: RenderTask): void {
    task.status = 'rendering';
    task.startedAt = Date.now();
    this.activeTasks.set(task.id, task);
    this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
  }

  /**
   * 完成任务
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
   * 任务失败
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
   * 取消任务
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
   * 取消所有任务
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
   * 更新任务进度
   */
  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.progress = Math.max(0, Math.min(1, progress));
    }
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): RenderTask | undefined {
    return (
      this.taskQueue.find(t => t.id === taskId) ||
      this.activeTasks.get(taskId) ||
      this.completedTasks.get(taskId)
    );
  }

  /**
   * 获取队列状态
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
   * 获取统计信息
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
   * 清理已完成的任务
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
   * 重置
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

// ==================== 增量渲染引擎 ====================

/**
 * 增量渲染引擎
 *
 * 整合差异检测、任务调度和缓存管理
 */
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
   * 设置渲染回调
   */
  setRenderCallback(callback: (task: RenderTask) => Promise<RenderResult>): void {
    this.renderCallback = callback;
  }

  /**
   * 提交渲染请求
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
   * 标记区域为脏
   */
  markDirty(region: RenderRegion, reason: string): void {
    const diff = this.diffDetector.markDirty(region, reason);

    // Create render tasks for dirty regions
    for (const dirtyRegion of diff.regions) {
      this.submitRenderRequest('frame', dirtyRegion, 0, diff.priority);
    }
  }

  /**
   * 检测差异并提交渲染请求
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
   * 开始渲染循环
   */
  startRendering(): void {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this.renderLoop();
  }

  /**
   * 停止渲染循环
   */
  stopRendering(): void {
    this.isRendering = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 渲染循环
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
   * 处理渲染任务
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
   * 构建缓存键
   */
  private buildCacheKey(task: RenderTask): string {
    return `${task.type}_${task.frame}_${task.region.x}_${task.region.y}_${task.region.width}_${task.region.height}`;
  }

  /**
   * 获取渲染统计
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
   * 获取任务状态
   */
  getTask(taskId: string): RenderTask | undefined {
    return this.taskScheduler.getTask(taskId);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    return this.taskScheduler.cancelTask(taskId);
  }

  /**
   * 取消所有任务
   */
  cancelAllTasks(): void {
    this.taskScheduler.cancelAllTasks();
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * 重置
   */
  reset(): void {
    this.stopRendering();
    this.cacheManager.clear();
    this.diffDetector.reset();
    this.taskScheduler.reset();
  }

  /**
   * 销毁引擎
   */
  destroy(): void {
    this.reset();
    this.renderCallback = null;
  }
}

// ==================== 渲染进度预估器 ====================

/**
 * 渲染进度预估器
 *
 * 基于历史数据预估渲染完成时间
 */
export class RenderProgressEstimator {
  private history: Map<RenderTaskType, number[]> = new Map();
  private readonly maxHistorySize: number = 100;

  /**
   * 记录渲染时间
   */
  recordRenderTime(type: RenderTaskType, durationMs: number): void {
    if (!this.history.has(type)) {
      this.history.set(type, []);
    }

    const times = this.history.get(type)!;
    times.push(durationMs);

    if (times.length > this.maxHistorySize) {
      times.shift();
    }
  }

  /**
   * 预估渲染时间
   */
  estimateRenderTime(type: RenderTaskType, region: RenderRegion): number {
    const times = this.history.get(type);
    if (!times || times.length === 0) {
      return this.getDefaultEstimate(type, region);
    }

    // Calculate average
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    // Scale by region size
    const pixelCount = region.width * region.height;
    const scaleFactor = pixelCount / (1920 * 1080); // Relative to 1080p

    return avg * scaleFactor;
  }

  /**
   * 预估剩余时间
   */
  estimateRemainingTime(tasks: RenderTask[]): number {
    let totalMs = 0;

    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        continue;
      }

      if (task.status === 'rendering' && task.progress > 0) {
        // Partial progress
        const elapsed = task.actualDurationMs || 0;
        const estimated = this.estimateRenderTime(task.type, task.region);
        totalMs += estimated * (1 - task.progress);
      } else {
        // Not started
        totalMs += this.estimateRenderTime(task.type, task.region);
      }
    }

    return totalMs;
  }

  /**
   * 获取默认估计
   */
  private getDefaultEstimate(type: RenderTaskType, region: RenderRegion): number {
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

  /**
   * 重置历史
   */
  reset(): void {
    this.history.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建增量渲染引擎实例
 */
export function createIncrementalRenderEngine(
  config?: Partial<IncrementalRenderConfig>
): IncrementalRenderEngine {
  return new IncrementalRenderEngine(config);
}

/**
 * 创建渲染进度预估器实例
 */
export function createRenderProgressEstimator(): RenderProgressEstimator {
  return new RenderProgressEstimator();
}
