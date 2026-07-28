/**
 * AI 推理 Worker 线程模块
 *
 * 在后台线程执行 AI 模型推理，保持主线程 60fps。
 * 支持 Worker 池管理、任务提交与取消、进度回报。
 *
 * Worker 内部通过 self.onmessage 接收推理请求，
 * 模拟推理延迟后返回结果。
 */
/**
 * Worker 消息类型
 */
export type AIWorkerMessageType = 'init' | 'infer' | 'cancel' | 'result' | 'error' | 'progress';
/**
 * Worker 请求接口
 *
 * 由主线程发送给 Worker 线程的推理任务请求。
 */
export interface AIWorkerRequest {
    /** 任务唯一 ID */
    id: string;
    /** 消息类型 */
    type: AIWorkerMessageType;
    /** 模型类型标识 */
    modelType: string;
    /** 输入数据（序列化后的张量或特征向量） */
    inputData: Float32Array | number[];
    /** 推理配置参数 */
    config?: {
        /** 批量大小 */
        batchSize?: number;
        /** 精度（fp16 / fp32） */
        precision?: 'fp16' | 'fp32';
        /** 最大推理耗时（毫秒），超时则中止 */
        timeoutMs?: number;
        /** 自定义参数 */
        customParams?: Record<string, unknown>;
    };
}
/**
 * Worker 响应接口
 *
 * 由 Worker 线程返回给主线程的推理结果。
 */
export interface AIWorkerResponse {
    /** 对应请求的任务 ID */
    id: string;
    /** 响应类型 */
    type: AIWorkerMessageType;
    /** 推理结果数据 */
    result?: Float32Array | number[] | Record<string, unknown>;
    /** 错误信息 */
    error?: string;
    /** 进度信息 (0-1) */
    progress?: number;
}
/**
 * AI Worker 池
 *
 * 管理一组 Worker 线程，支持并发推理任务调度。
 * 自动将任务分配给空闲 Worker，所有 Worker 忙碌时任务排队等待。
 */
export declare class AIWorkerPool {
    /** Worker 槽位列表 */
    private slots;
    /** 待处理任务队列 */
    private queue;
    /** 正在执行的任务映射（taskId -> PendingTask） */
    private activeTasks;
    /** 是否已终止 */
    private terminated;
    /**
     * 创建 Worker 池
     *
     * @param poolSize - Worker 池大小（并发数），默认为 navigator.hardwareConcurrency 或 4
     */
    constructor(poolSize: number);
    /**
     * 提交推理任务
     *
     * 将任务分配给空闲 Worker 或排队等待。
     *
     * @param request - 推理任务请求
     * @returns 推理结果的 Promise
     */
    submit(request: AIWorkerRequest): Promise<AIWorkerResponse>;
    /**
     * 取消指定任务
     *
     * 向对应 Worker 发送取消消息，并从活跃任务中移除。
     * 如果任务在队列中尚未执行，直接从队列移除。
     *
     * @param id - 任务 ID
     */
    cancel(id: string): void;
    /**
     * 获取当前活跃任务数
     *
     * @returns 正在执行的任务数量
     */
    getActiveCount(): number;
    /**
     * 获取队列中等待的任务数
     *
     * @returns 等待中的任务数量
     */
    getQueueSize(): number;
    /**
     * 终止所有 Worker
     *
     * 清理所有活跃任务和队列任务，终止 Worker 线程。
     */
    terminate(): void;
    /**
     * 查找空闲 Worker 槽位
     *
     * @returns 空闲槽位索引，无空闲则返回 -1
     */
    private findIdleSlot;
    /**
     * 将任务分发给指定 Worker
     *
     * @param slotIndex - Worker 槽位索引
     * @param task - 待执行任务
     * @param request - 推理请求
     */
    private dispatchToWorker;
    /**
     * 处理 Worker 完成任务后的调度
     *
     * 尝试从队列中取出下一个任务分配给空闲 Worker。
     *
     * @param slotIndex - 刚完成任务的 Worker 槽位索引
     */
    private scheduleNext;
    /**
     * 创建单个 Worker 实例
     *
     * 通过 Blob URL 创建内联 Worker，避免外部文件依赖。
     *
     * @param workerIndex - Worker 索引（用于日志）
     * @returns Worker 实例
     */
    private createWorkerInstance;
}
/**
 * 创建默认大小的 Worker 池
 *
 * Worker 数量取硬件并发数的一半（至少 1，最多 8），
 * 避免占用全部 CPU 核心导致主线程卡顿。
 *
 * @returns AIWorkerPool 实例
 */
export declare function createDefaultWorkerPool(): AIWorkerPool;
/**
 * 检测当前环境是否支持 Web Worker
 *
 * @returns 支持返回 true，不支持返回 false
 */
export declare function isWorkerSupported(): boolean;
//# sourceMappingURL=ai-worker.d.ts.map