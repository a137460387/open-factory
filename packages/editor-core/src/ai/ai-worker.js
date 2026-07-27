/**
 * AI 推理 Worker 线程模块
 *
 * 在后台线程执行 AI 模型推理，保持主线程 60fps。
 * 支持 Worker 池管理、任务提交与取消、进度回报。
 *
 * Worker 内部通过 self.onmessage 接收推理请求，
 * 模拟推理延迟后返回结果。
 */
// ==================== Worker 池类 ====================
/**
 * AI Worker 池
 *
 * 管理一组 Worker 线程，支持并发推理任务调度。
 * 自动将任务分配给空闲 Worker，所有 Worker 忙碌时任务排队等待。
 */
export class AIWorkerPool {
    /** Worker 槽位列表 */
    slots = [];
    /** 待处理任务队列 */
    queue = [];
    /** 正在执行的任务映射（taskId -> PendingTask） */
    activeTasks = new Map();
    /** 是否已终止 */
    terminated = false;
    /**
     * 创建 Worker 池
     *
     * @param poolSize - Worker 池大小（并发数），默认为 navigator.hardwareConcurrency 或 4
     */
    constructor(poolSize) {
        const size = Math.max(1, Math.floor(poolSize));
        for (let i = 0; i < size; i++) {
            const worker = this.createWorkerInstance(i);
            this.slots.push({
                worker,
                idle: true,
                currentTaskId: null,
            });
        }
    }
    /**
     * 提交推理任务
     *
     * 将任务分配给空闲 Worker 或排队等待。
     *
     * @param request - 推理任务请求
     * @returns 推理结果的 Promise
     */
    submit(request) {
        if (this.terminated) {
            return Promise.reject(new Error('Worker 池已终止'));
        }
        return new Promise((resolve, reject) => {
            const task = {
                id: request.id,
                resolve,
                reject,
                workerIndex: -1,
                request,
            };
            // 尝试分配给空闲 Worker
            const idleIndex = this.findIdleSlot();
            if (idleIndex !== -1) {
                this.dispatchToWorker(idleIndex, task, request);
            }
            else {
                // 排队等待
                this.queue.push(task);
            }
        });
    }
    /**
     * 取消指定任务
     *
     * 向对应 Worker 发送取消消息，并从活跃任务中移除。
     * 如果任务在队列中尚未执行，直接从队列移除。
     *
     * @param id - 任务 ID
     */
    cancel(id) {
        // 检查队列中是否有待执行的任务
        const queueIndex = this.queue.findIndex((t) => t.id === id);
        if (queueIndex !== -1) {
            const task = this.queue.splice(queueIndex, 1)[0];
            task.reject(new Error(`任务 ${id} 已取消`));
            return;
        }
        // 检查正在执行的任务
        const task = this.activeTasks.get(id);
        if (task) {
            const slot = this.slots[task.workerIndex];
            if (slot) {
                // 通知 Worker 取消
                slot.worker.postMessage({ id, type: 'cancel' });
                slot.idle = true;
                slot.currentTaskId = null;
            }
            this.activeTasks.delete(id);
            task.reject(new Error(`任务 ${id} 已取消`));
        }
    }
    /**
     * 获取当前活跃任务数
     *
     * @returns 正在执行的任务数量
     */
    getActiveCount() {
        return this.activeTasks.size;
    }
    /**
     * 获取队列中等待的任务数
     *
     * @returns 等待中的任务数量
     */
    getQueueSize() {
        return this.queue.length;
    }
    /**
     * 终止所有 Worker
     *
     * 清理所有活跃任务和队列任务，终止 Worker 线程。
     */
    terminate() {
        this.terminated = true;
        // 终止所有 Worker
        for (const slot of this.slots) {
            slot.worker.terminate();
        }
        // 拒绝所有活跃任务
        for (const [taskId, task] of this.activeTasks) {
            task.reject(new Error(`Worker 池已终止，任务 ${taskId} 被中断`));
        }
        // 拒绝所有排队任务
        for (const task of this.queue) {
            task.reject(new Error('Worker 池已终止'));
        }
        this.slots = [];
        this.activeTasks.clear();
        this.queue = [];
    }
    // ==================== 内部方法 ====================
    /**
     * 查找空闲 Worker 槽位
     *
     * @returns 空闲槽位索引，无空闲则返回 -1
     */
    findIdleSlot() {
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].idle)
                return i;
        }
        return -1;
    }
    /**
     * 将任务分发给指定 Worker
     *
     * @param slotIndex - Worker 槽位索引
     * @param task - 待执行任务
     * @param request - 推理请求
     */
    dispatchToWorker(slotIndex, task, request) {
        const slot = this.slots[slotIndex];
        slot.idle = false;
        slot.currentTaskId = request.id;
        task.workerIndex = slotIndex;
        this.activeTasks.set(request.id, task);
        // 发送推理请求给 Worker (使用 Transferable 避免拷贝)
        const transferables = [];
        if (request.inputData instanceof Float32Array) {
            transferables.push(request.inputData.buffer);
        }
        slot.worker.postMessage({
            id: request.id,
            type: request.type,
            modelType: request.modelType,
            inputData: request.inputData,
            config: request.config,
        }, transferables);
    }
    /**
     * 处理 Worker 完成任务后的调度
     *
     * 尝试从队列中取出下一个任务分配给空闲 Worker。
     *
     * @param slotIndex - 刚完成任务的 Worker 槽位索引
     */
    scheduleNext(slotIndex) {
        if (this.terminated)
            return;
        // 从队列中取出下一个任务
        if (this.queue.length > 0) {
            const nextTask = this.queue.shift();
            this.dispatchToWorker(slotIndex, nextTask, nextTask.request);
        }
        else {
            this.slots[slotIndex].idle = true;
            this.slots[slotIndex].currentTaskId = null;
        }
    }
    /**
     * 创建单个 Worker 实例
     *
     * 通过 Blob URL 创建内联 Worker，避免外部文件依赖。
     *
     * @param workerIndex - Worker 索引（用于日志）
     * @returns Worker 实例
     */
    createWorkerInstance(workerIndex) {
        const workerCode = `
      /**
       * AI 推理 Worker 内部代码
       *
       * 接收主线程发来的推理请求，执行模型推理后返回结果。
       * 当前为模拟实现，通过延时模拟推理耗时。
       */
      self.onmessage = function(event) {
        var request = event.data;

        if (request.type === 'cancel') {
          // 取消消息，无需回复
          return;
        }

        if (request.type !== 'infer' && request.type !== 'init') {
          self.postMessage({
            id: request.id,
            type: 'error',
            error: '不支持的消息类型: ' + request.type
          });
          return;
        }

        // 模拟推理延迟（50-300ms）
        var delay = 50 + Math.random() * 250;

        // 进度回报
        var progressSteps = 5;
        var stepDelay = delay / progressSteps;
        var currentStep = 0;

        function reportProgress() {
          currentStep++;
          var progress = currentStep / progressSteps;
          self.postMessage({
            id: request.id,
            type: 'progress',
            progress: progress
          });

          if (currentStep < progressSteps) {
            setTimeout(reportProgress, stepDelay);
          } else {
            // 推理完成，生成模拟结果
            var inputData = request.inputData || [];
            var inputLength = inputData.length || 1;
            var resultData = new Array(inputLength);

            for (var i = 0; i < inputLength; i++) {
              var val = typeof inputData[i] === 'number' ? inputData[i] : 0;
              // 简单的非线性变换模拟推理
              resultData[i] = Math.tanh(val * 0.5 + 0.1) * 0.8 + 0.1;
            }

            self.postMessage({
              id: request.id,
              type: 'result',
              result: resultData
            });
          }
        }

        setTimeout(reportProgress, stepDelay);
      };
    `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        // 清理 Blob URL（Worker 已加载，可安全释放）
        URL.revokeObjectURL(url);
        // 绑定消息处理
        worker.onmessage = (event) => {
            const response = event.data;
            const task = this.activeTasks.get(response.id);
            if (!task)
                return;
            if (response.type === 'result') {
                // 推理完成
                this.activeTasks.delete(response.id);
                this.slots[task.workerIndex].idle = true;
                this.slots[task.workerIndex].currentTaskId = null;
                task.resolve(response);
                // 调度下一个任务
                this.scheduleNext(task.workerIndex);
            }
            else if (response.type === 'error') {
                // 推理出错
                this.activeTasks.delete(response.id);
                this.slots[task.workerIndex].idle = true;
                this.slots[task.workerIndex].currentTaskId = null;
                task.reject(new Error(response.error || '未知推理错误'));
                // 调度下一个任务
                this.scheduleNext(task.workerIndex);
            }
            // progress 类型不结束任务，忽略
        };
        worker.onerror = (errorEvent) => {
            // Worker 全局错误处理
            const slot = this.slots[workerIndex];
            if (slot && slot.currentTaskId) {
                const task = this.activeTasks.get(slot.currentTaskId);
                if (task) {
                    this.activeTasks.delete(slot.currentTaskId);
                    task.reject(new Error(`Worker ${workerIndex} 发生错误: ${errorEvent.message}`));
                }
                slot.idle = true;
                slot.currentTaskId = null;
            }
        };
        return worker;
    }
}
// ==================== 工厂函数 ====================
/**
 * 创建默认大小的 Worker 池
 *
 * Worker 数量取硬件并发数的一半（至少 1，最多 8），
 * 避免占用全部 CPU 核心导致主线程卡顿。
 *
 * @returns AIWorkerPool 实例
 */
export function createDefaultWorkerPool() {
    const hardwareConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
    const poolSize = Math.max(1, Math.min(8, Math.floor(hardwareConcurrency / 2)));
    return new AIWorkerPool(poolSize);
}
/**
 * 检测当前环境是否支持 Web Worker
 *
 * @returns 支持返回 true，不支持返回 false
 */
export function isWorkerSupported() {
    return typeof Worker !== 'undefined';
}
//# sourceMappingURL=ai-worker.js.map