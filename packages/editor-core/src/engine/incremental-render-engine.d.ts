/**
 * 增量渲染引擎
 *
 * 核心功能：
 * 1. 差异渲染算法 - 仅重新渲染修改部分
 * 2. 渲染任务调度 - 支持后台渲染队列
 * 3. 渲染进度预估与完成通知
 * 4. 渲染优先级管理
 */
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
    progress: number;
    dependencies: string[];
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
export declare const DEFAULT_INCREMENTAL_CONFIG: IncrementalRenderConfig;
/**
 * 渲染缓存管理器
 */
export declare class RenderCacheManager {
    private cache;
    private accessOrder;
    private totalBytes;
    private readonly maxBytes;
    private hits;
    private misses;
    constructor(maxBytes?: number);
    /**
     * 获取缓存的渲染结果
     */
    get(key: string): RenderResult | undefined;
    /**
     * 存储渲染结果
     */
    put(key: string, result: RenderResult, estimatedBytes: number): void;
    /**
     * 移除缓存项
     */
    remove(key: string): void;
    /**
     * 清除所有缓存
     */
    clear(): void;
    /**
     * 获取缓存统计
     */
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        sizeMB: number;
    };
    private touchKey;
}
/**
 * 差异检测器
 *
 * 检测渲染区域的变化，生成渲染差异
 */
export declare class DiffDetector {
    private previousRegions;
    private previousFrame;
    /**
     * 检测差异
     */
    detectDiff(currentFrame: number, currentRegions: RenderRegion[], reason: string): RenderDiff;
    /**
     * 标记区域为脏
     */
    markDirty(region: RenderRegion, reason: string): RenderDiff;
    /**
     * 重置
     */
    reset(): void;
    private regionToKey;
    private regionsDifferent;
}
/**
 * 渲染任务调度器
 *
 * 管理渲染任务的优先级和执行顺序
 */
export declare class RenderTaskScheduler {
    private config;
    private taskQueue;
    private activeTasks;
    private completedTasks;
    private taskIdCounter;
    constructor(config?: Partial<IncrementalRenderConfig>);
    /**
     * 添加渲染任务
     */
    addTask(type: RenderTaskType, region: RenderRegion, frame: number, priority?: RenderPriority, dependencies?: string[]): RenderTask;
    /**
     * 获取下一个可执行的任务
     */
    getNextTask(): RenderTask | null;
    /**
     * 开始执行任务
     */
    startTask(task: RenderTask): void;
    /**
     * 完成任务
     */
    completeTask(task: RenderTask, result: RenderResult): void;
    /**
     * 任务失败
     */
    failTask(task: RenderTask, error: Error): void;
    /**
     * 取消任务
     */
    cancelTask(taskId: string): boolean;
    /**
     * 取消所有任务
     */
    cancelAllTasks(): void;
    /**
     * 更新任务进度
     */
    updateTaskProgress(taskId: string, progress: number): void;
    /**
     * 获取任务状态
     */
    getTask(taskId: string): RenderTask | undefined;
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
    };
    /**
     * 获取统计信息
     */
    getStats(): IncrementalRenderStats;
    /**
     * 清理已完成的任务
     */
    cleanup(maxAge?: number): void;
    /**
     * 重置
     */
    reset(): void;
    private generateTaskId;
    private estimateDuration;
    private sortQueue;
}
/**
 * 增量渲染引擎
 *
 * 整合差异检测、任务调度和缓存管理
 */
export declare class IncrementalRenderEngine {
    private config;
    private cacheManager;
    private diffDetector;
    private taskScheduler;
    private renderCallback;
    private isRendering;
    private animationFrameId;
    constructor(config?: Partial<IncrementalRenderConfig>);
    /**
     * Get current config
     */
    getConfig(): IncrementalRenderConfig;
    /**
     * 设置渲染回调
     */
    setRenderCallback(callback: (task: RenderTask) => Promise<RenderResult>): void;
    /**
     * 提交渲染请求
     */
    submitRenderRequest(type: RenderTaskType, region: RenderRegion, frame: number, priority?: RenderPriority, dependencies?: string[]): RenderTask;
    /**
     * 标记区域为脏
     */
    markDirty(region: RenderRegion, reason: string): void;
    /**
     * 检测差异并提交渲染请求
     */
    detectAndRender(currentFrame: number, currentRegions: RenderRegion[], reason: string): RenderDiff;
    /**
     * 开始渲染循环
     */
    startRendering(): void;
    /**
     * 停止渲染循环
     */
    stopRendering(): void;
    /**
     * 渲染循环
     */
    private renderLoop;
    /**
     * 处理渲染任务
     */
    private processTasks;
    /**
     * 构建缓存键
     */
    private buildCacheKey;
    /**
     * 获取渲染统计
     */
    getStats(): {
        render: IncrementalRenderStats;
        cache: {
            hits: number;
            misses: number;
            hitRate: number;
            sizeMB: number;
        };
        queue: ReturnType<RenderTaskScheduler['getQueueStatus']>;
    };
    /**
     * 获取任务状态
     */
    getTask(taskId: string): RenderTask | undefined;
    /**
     * 取消任务
     */
    cancelTask(taskId: string): boolean;
    /**
     * 取消所有任务
     */
    cancelAllTasks(): void;
    /**
     * 清理缓存
     */
    clearCache(): void;
    /**
     * 重置
     */
    reset(): void;
    /**
     * 销毁引擎
     */
    destroy(): void;
}
/**
 * 渲染进度预估器
 *
 * 基于历史数据预估渲染完成时间
 */
export declare class RenderProgressEstimator {
    private history;
    private readonly maxHistorySize;
    /**
     * 记录渲染时间
     */
    recordRenderTime(type: RenderTaskType, durationMs: number): void;
    /**
     * 预估渲染时间
     */
    estimateRenderTime(type: RenderTaskType, region: RenderRegion): number;
    /**
     * 预估剩余时间
     */
    estimateRemainingTime(tasks: RenderTask[]): number;
    /**
     * 获取默认估计
     */
    private getDefaultEstimate;
    /**
     * 重置历史
     */
    reset(): void;
}
/**
 * 创建增量渲染引擎实例
 */
export declare function createIncrementalRenderEngine(config?: Partial<IncrementalRenderConfig>): IncrementalRenderEngine;
/**
 * 创建渲染进度预估器实例
 */
export declare function createRenderProgressEstimator(): RenderProgressEstimator;
//# sourceMappingURL=incremental-render-engine.d.ts.map