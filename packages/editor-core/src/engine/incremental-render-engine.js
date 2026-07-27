/**
 * 增量渲染引擎
 *
 * 核心功能：
 * 1. 差异渲染算法 - 仅重新渲染修改部分
 * 2. 渲染任务调度 - 支持后台渲染队列
 * 3. 渲染进度预估与完成通知
 * 4. 渲染优先级管理
 */
/** 默认配置 */
export const DEFAULT_INCREMENTAL_CONFIG = {
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
    cache = new Map();
    accessOrder = [];
    totalBytes = 0;
    maxBytes;
    hits = 0;
    misses = 0;
    constructor(maxBytes = 512 * 1024 * 1024) {
        this.maxBytes = maxBytes;
    }
    /**
     * 获取缓存的渲染结果
     */
    get(key) {
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
    put(key, result, estimatedBytes) {
        if (this.cache.has(key)) {
            this.remove(key);
        }
        while (this.totalBytes + estimatedBytes > this.maxBytes) {
            if (this.accessOrder.length === 0)
                break;
            this.remove(this.accessOrder[0]);
        }
        this.cache.set(key, result);
        this.accessOrder.push(key);
        this.totalBytes += estimatedBytes;
    }
    /**
     * 移除缓存项
     */
    remove(key) {
        const result = this.cache.get(key);
        if (!result)
            return;
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        if (result.texture) {
            result.texture.destroy();
        }
        if (result.bitmap) {
            try {
                result.bitmap.close();
            }
            catch {
                // Ignore
            }
        }
    }
    /**
     * 清除所有缓存
     */
    clear() {
        for (const result of this.cache.values()) {
            if (result.texture) {
                result.texture.destroy();
            }
            if (result.bitmap) {
                try {
                    result.bitmap.close();
                }
                catch {
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
    getStats() {
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
            sizeMB: this.totalBytes / (1024 * 1024),
        };
    }
    touchKey(key) {
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
    previousRegions = new Map();
    previousFrame = -1;
    /**
     * 检测差异
     */
    detectDiff(currentFrame, currentRegions, reason) {
        const diff = {
            regions: [],
            reason,
            affectedFrames: [currentFrame],
            priority: 'normal',
        };
        // If frame changed, render all regions
        if (currentFrame !== this.previousFrame) {
            diff.regions = currentRegions;
            diff.priority = 'high';
        }
        else {
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
    markDirty(region, reason) {
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
    reset() {
        this.previousRegions.clear();
        this.previousFrame = -1;
    }
    regionToKey(region) {
        return `${region.x}_${region.y}_${region.width}_${region.height}`;
    }
    regionsDifferent(a, b) {
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
    config;
    taskQueue = [];
    activeTasks = new Map();
    completedTasks = new Map();
    taskIdCounter = 0;
    constructor(config) {
        this.config = { ...DEFAULT_INCREMENTAL_CONFIG, ...config };
    }
    /**
     * 添加渲染任务
     */
    addTask(type, region, frame, priority = 'normal', dependencies = []) {
        const task = {
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
    getNextTask() {
        // Check if we can run more tasks
        if (this.activeTasks.size >= this.config.maxConcurrentRenders) {
            return null;
        }
        // Find first task with satisfied dependencies
        for (const task of this.taskQueue) {
            if (task.status !== 'pending')
                continue;
            const dependenciesSatisfied = task.dependencies.every(depId => this.completedTasks.has(depId));
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
    startTask(task) {
        task.status = 'rendering';
        task.startedAt = Date.now();
        this.activeTasks.set(task.id, task);
        this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
    }
    /**
     * 完成任务
     */
    completeTask(task, result) {
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
    failTask(task, error) {
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
    cancelTask(taskId) {
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
    cancelAllTasks() {
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
    updateTaskProgress(taskId, progress) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.progress = Math.max(0, Math.min(1, progress));
        }
    }
    /**
     * 获取任务状态
     */
    getTask(taskId) {
        return (this.taskQueue.find(t => t.id === taskId) ||
            this.activeTasks.get(taskId) ||
            this.completedTasks.get(taskId));
    }
    /**
     * 获取队列状态
     */
    getQueueStatus() {
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
    getStats() {
        const allTasks = [
            ...this.taskQueue,
            ...this.activeTasks.values(),
            ...this.completedTasks.values(),
        ];
        const completedTasks = allTasks.filter(t => t.status === 'completed');
        const failedTasks = allTasks.filter(t => t.status === 'failed');
        const cancelledTasks = allTasks.filter(t => t.status === 'cancelled');
        const totalRenderTime = completedTasks.reduce((sum, t) => sum + t.actualDurationMs, 0);
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
    cleanup(maxAge = 60000) {
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
    reset() {
        this.taskQueue = [];
        this.activeTasks.clear();
        this.completedTasks.clear();
        this.taskIdCounter = 0;
    }
    generateTaskId() {
        return `render_task_${++this.taskIdCounter}`;
    }
    estimateDuration(type, region) {
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
    sortQueue() {
        const priorityOrder = {
            critical: 0,
            high: 1,
            normal: 2,
            low: 3,
        };
        this.taskQueue.sort((a, b) => {
            // First by priority
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
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
    config;
    cacheManager;
    diffDetector;
    taskScheduler;
    renderCallback = null;
    isRendering = false;
    animationFrameId = null;
    constructor(config) {
        this.config = { ...DEFAULT_INCREMENTAL_CONFIG, ...config };
        this.cacheManager = new RenderCacheManager(this.config.renderCacheSizeMB * 1024 * 1024);
        this.diffDetector = new DiffDetector();
        this.taskScheduler = new RenderTaskScheduler(this.config);
    }
    /**
     * Get current config
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 设置渲染回调
     */
    setRenderCallback(callback) {
        this.renderCallback = callback;
    }
    /**
     * 提交渲染请求
     */
    submitRenderRequest(type, region, frame, priority = 'normal', dependencies = []) {
        return this.taskScheduler.addTask(type, region, frame, priority, dependencies);
    }
    /**
     * 标记区域为脏
     */
    markDirty(region, reason) {
        const diff = this.diffDetector.markDirty(region, reason);
        // Create render tasks for dirty regions
        for (const dirtyRegion of diff.regions) {
            this.submitRenderRequest('frame', dirtyRegion, 0, diff.priority);
        }
    }
    /**
     * 检测差异并提交渲染请求
     */
    detectAndRender(currentFrame, currentRegions, reason) {
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
    startRendering() {
        if (this.isRendering) {
            return;
        }
        this.isRendering = true;
        this.renderLoop();
    }
    /**
     * 停止渲染循环
     */
    stopRendering() {
        this.isRendering = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    /**
     * 渲染循环
     */
    renderLoop() {
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
    async processTasks() {
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
                }
                catch (error) {
                    this.taskScheduler.failTask(task, error);
                }
            }
            else {
                this.taskScheduler.failTask(task, new Error('No render callback set'));
            }
        }
    }
    /**
     * 构建缓存键
     */
    buildCacheKey(task) {
        return `${task.type}_${task.frame}_${task.region.x}_${task.region.y}_${task.region.width}_${task.region.height}`;
    }
    /**
     * 获取渲染统计
     */
    getStats() {
        return {
            render: this.taskScheduler.getStats(),
            cache: this.cacheManager.getStats(),
            queue: this.taskScheduler.getQueueStatus(),
        };
    }
    /**
     * 获取任务状态
     */
    getTask(taskId) {
        return this.taskScheduler.getTask(taskId);
    }
    /**
     * 取消任务
     */
    cancelTask(taskId) {
        return this.taskScheduler.cancelTask(taskId);
    }
    /**
     * 取消所有任务
     */
    cancelAllTasks() {
        this.taskScheduler.cancelAllTasks();
    }
    /**
     * 清理缓存
     */
    clearCache() {
        this.cacheManager.clear();
    }
    /**
     * 重置
     */
    reset() {
        this.stopRendering();
        this.cacheManager.clear();
        this.diffDetector.reset();
        this.taskScheduler.reset();
    }
    /**
     * 销毁引擎
     */
    destroy() {
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
    history = new Map();
    maxHistorySize = 100;
    /**
     * 记录渲染时间
     */
    recordRenderTime(type, durationMs) {
        if (!this.history.has(type)) {
            this.history.set(type, []);
        }
        const times = this.history.get(type);
        times.push(durationMs);
        if (times.length > this.maxHistorySize) {
            times.shift();
        }
    }
    /**
     * 预估渲染时间
     */
    estimateRenderTime(type, region) {
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
    estimateRemainingTime(tasks) {
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
            }
            else {
                // Not started
                totalMs += this.estimateRenderTime(task.type, task.region);
            }
        }
        return totalMs;
    }
    /**
     * 获取默认估计
     */
    getDefaultEstimate(type, region) {
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
    reset() {
        this.history.clear();
    }
}
// ==================== 工厂函数 ====================
/**
 * 创建增量渲染引擎实例
 */
export function createIncrementalRenderEngine(config) {
    return new IncrementalRenderEngine(config);
}
/**
 * 创建渲染进度预估器实例
 */
export function createRenderProgressEstimator() {
    return new RenderProgressEstimator();
}
//# sourceMappingURL=incremental-render-engine.js.map