/**
 * 自动化工作流 Worker Hook
 * 管理 Worker 生命周期，提供类型安全的通信接口
 *
 * 所有自动化任务在 Worker 中执行，不阻塞 UI 线程。
 */

import { useRef, useCallback, useEffect, useState } from 'react';

// ============================================================
// 类型定义
// ============================================================

interface WorkerRequest {
  id: string;
  type: string;
  payload?: unknown;
}

interface WorkerResponse {
  id: string;
  type: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface AutomationWorkerState {
  ready: boolean;
  error: string | null;
}

// ============================================================
// Hook
// ============================================================

let _requestId = 0;
function nextRequestId(): string {
  return `req_${++_requestId}`;
}

/**
 * 自动化 Worker Hook
 *
 * 使用示例：
 * ```tsx
 * const { ready, executeWorkflow, analyzeScene } = useAutomationWorker();
 * const ctx = await executeWorkflow('workflow-id', { foo: 'bar' });
 * ```
 */
export function useAutomationWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const [state, setState] = useState<AutomationWorkerState>({ ready: false, error: null });

  // 初始化 Worker
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const worker = new Worker(
          new URL('../workers/automation.worker.ts', import.meta.url),
          { type: 'module' },
        );

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { id, success, data, error } = event.data;
          const pending = pendingRef.current.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingRef.current.delete(id);
            if (success) {
              pending.resolve(data);
            } else {
              pending.reject(new Error(error || 'Worker 执行失败'));
            }
          }
        };

        worker.onerror = (event) => {
          const msg = event.message || 'Worker 错误';
          setState((s) => ({ ...s, error: msg }));
          // 拒绝所有待处理请求
          for (const [, pending] of pendingRef.current) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(msg));
          }
          pendingRef.current.clear();
        };

        workerRef.current = worker;

        // 发送 init 消息确认 Worker 就绪
        await new Promise<void>((resolve, reject) => {
          const id = nextRequestId();
          const timeout = setTimeout(() => reject(new Error('Worker 初始化超时')), 10000);
          pendingRef.current.set(id, {
            resolve: () => { clearTimeout(timeout); resolve(); },
            reject: (err) => { clearTimeout(timeout); reject(err); },
            timeout,
          });
          worker.postMessage({ id, type: 'init' });
        });

        if (!cancelled) {
          setState({ ready: true, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ ready: false, error: String(err) });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // 清理所有待处理请求
      for (const [, pending] of pendingRef.current) {
        clearTimeout(pending.timeout);
      }
      pendingRef.current.clear();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // 通用发送函数 —— 通过 pendingRef 追踪请求
  const send = useCallback(async <T = unknown>(type: string, payload?: unknown): Promise<T> => {
    const worker = workerRef.current;
    if (!worker) throw new Error('Worker 未初始化');

    return new Promise<T>((resolve, reject) => {
      const id = nextRequestId();
      const timeout = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error(`Worker 请求超时: ${type}`));
      }, 60000);

      pendingRef.current.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout,
      });

      const msg: WorkerRequest = { id, type, payload };
      worker.postMessage(msg);
    });
  }, []);

  // ------ 工作流操作 ------

  const registerWorkflow = useCallback(async (workflow: unknown) => {
    return send<{ workflowId: string }>('register-workflow', workflow);
  }, [send]);

  const executeWorkflow = useCallback(async (workflowId: string, triggerData?: Record<string, unknown>) => {
    return send<{
      executionId: string;
      status: string;
      logs: unknown[];
      startTime: number;
      endTime: number;
    }>('execute-workflow', { workflowId, triggerData });
  }, [send]);

  const pauseExecution = useCallback(async (executionId: string) => {
    return send<{ paused: boolean }>('pause-execution', { executionId });
  }, [send]);

  const resumeExecution = useCallback(async (executionId: string) => {
    return send<{ resumed: boolean }>('resume-execution', { executionId });
  }, [send]);

  const cancelExecution = useCallback(async (executionId: string) => {
    return send<{ cancelled: boolean }>('cancel-execution', { executionId });
  }, [send]);

  const getWorkflows = useCallback(async () => {
    return send<unknown[]>('get-workflows');
  }, [send]);

  const getTemplates = useCallback(async () => {
    return send<unknown[]>('get-templates');
  }, [send]);

  const createFromTemplate = useCallback(async (templateId: string, name?: string) => {
    return send<unknown>('create-workflow-from-template', { templateId, name });
  }, [send]);

  const importWorkflow = useCallback(async (json: string) => {
    return send<unknown>('import-workflow', { json });
  }, [send]);

  const exportWorkflow = useCallback(async (workflowId: string) => {
    return send<{ json: string }>('export-workflow', { workflowId });
  }, [send]);

  // ------ 场景分析操作 ------

  const analyzeScene = useCallback(async (
    mediaPath: string,
    startTime: number,
    endTime: number,
    frameData?: { brightness?: number[]; motionVectors?: number[]; audioLevels?: number[] },
  ) => {
    return send<unknown>('analyze-scene', { mediaPath, startTime, endTime, frameData });
  }, [send]);

  const analyzeBatch = useCallback(async (
    mediaItems: Array<{
      path: string;
      duration: number;
      frameData?: { brightness?: number[]; motionVectors?: number[]; audioLevels?: number[] };
    }>,
  ) => {
    return send<unknown>('analyze-batch', { mediaItems });
  }, [send]);

  // ------ 规则操作 ------

  const evaluateRules = useCallback(async (data: Record<string, unknown>) => {
    return send<unknown[]>('evaluate-rules', { data });
  }, [send]);

  const getRules = useCallback(async () => {
    return send<unknown[]>('get-rules');
  }, [send]);

  const registerRule = useCallback(async (rule: unknown) => {
    return send<{ ruleId: string }>('register-rule', rule);
  }, [send]);

  // ------ 自动剪辑操作 ------

  const autoEditInWorker = useCallback(async (params: {
    report: unknown;
    templateId: string;
    config?: Record<string, unknown>;
    weights?: Record<string, unknown>;
    trackId?: string;
  }) => {
    return send<unknown>('auto-edit', params);
  }, [send]);

  return {
    ...state,
    send,
    // 工作流
    registerWorkflow,
    executeWorkflow,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    getWorkflows,
    getTemplates,
    createFromTemplate,
    importWorkflow,
    exportWorkflow,
    // 场景分析
    analyzeScene,
    analyzeBatch,
    // 规则
    evaluateRules,
    getRules,
    registerRule,
    // 自动剪辑
    autoEditInWorker,
  };
}
