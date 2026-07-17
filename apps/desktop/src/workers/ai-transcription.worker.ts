/**
 * AI 语音转录 Worker
 *
 * 在独立线程中执行 Whisper 推理，避免阻塞主线程。
 * 支持两种模式：
 * 1. Tauri 原生 whisper.cpp（通过桥接调用）
 * 2. WebAssembly transformers.js（前端推理，预留）
 */

import type { TranscriptionProgressEvent } from '@open-factory/editor-core';

// -- Worker 消息类型 --

export interface AITranscriptionWorkerInput {
  type: 'transcribe' | 'cancel';
  /** Tauri whisper 请求参数 */
  request?: {
    executablePath: string;
    modelPath: string;
    audioPath: string;
    clipId: string;
  };
  /** 预处理后的 SRT 内容（用于后处理模式） */
  srtContent?: string;
  /** 语言配置 */
  language?: string;
}

export interface AITranscriptionWorkerOutput {
  type: 'progress' | 'result' | 'error' | 'cancelled';
  /** 进度事件 */
  event?: TranscriptionProgressEvent;
  /** 转录结果（SRT 内容） */
  srtContent?: string;
  /** 处理耗时（毫秒） */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
}

// -- Worker 主逻辑 --

let cancelled = false;

self.onmessage = async (event: MessageEvent<AITranscriptionWorkerInput>) => {
  const input = event.data;

  if (input.type === 'cancel') {
    cancelled = true;
    postMessage({ type: 'cancelled' } satisfies AITranscriptionWorkerOutput);
    return;
  }

  if (input.type !== 'transcribe') {
    postMessage({
      type: 'error',
      error: `未知消息类型: ${input.type}`,
    } satisfies AITranscriptionWorkerOutput);
    return;
  }

  cancelled = false;
  const startTime = performance.now();

  try {
    // 阶段 1：模型加载
    postMessage({
      type: 'progress',
      event: {
        phase: 'loading-model',
        progress: 0,
      },
    } satisfies AITranscriptionWorkerOutput);

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AITranscriptionWorkerOutput);
      return;
    }

    // 阶段 2：执行推理
    postMessage({
      type: 'progress',
      event: {
        phase: 'decoding',
        progress: 0.1,
      },
    } satisfies AITranscriptionWorkerOutput);

    let srtContent: string;

    if (input.srtContent) {
      // 已有 SRT 内容，直接使用（后处理模式）
      srtContent = input.srtContent;
    } else if (input.request) {
      // 通过 Tauri 桥接调用 whisper.cpp
      srtContent = await callWhisperViaBridge(input.request);
    } else {
      throw new Error('缺少转录请求参数或 SRT 内容');
    }

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AITranscriptionWorkerOutput);
      return;
    }

    // 阶段 3：后处理
    postMessage({
      type: 'progress',
      event: {
        phase: 'post-processing',
        progress: 0.9,
      },
    } satisfies AITranscriptionWorkerOutput);

    const durationMs = performance.now() - startTime;

    // 返回结果
    postMessage({
      type: 'result',
      srtContent,
      durationMs,
    } satisfies AITranscriptionWorkerOutput);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postMessage({
      type: 'error',
      error: errorMessage,
    } satisfies AITranscriptionWorkerOutput);
  }
};

/**
 * 通过 Tauri 桥接调用 whisper.cpp
 * Worker 中无法直接使用 Tauri invoke，通过 postMessage 与主线程通信
 */
async function callWhisperViaBridge(request: {
  executablePath: string;
  modelPath: string;
  audioPath: string;
  clipId: string;
}): Promise<string> {
  // 在 Worker 中，我们需要通过消息与主线程通信来调用 Tauri 命令
  // 这里返回一个 Promise，等待主线程的响应
  return new Promise((resolve, reject) => {
    const requestId = `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.requestId === requestId) {
        self.removeEventListener('message', handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.srtContent);
        }
      }
    };

    self.addEventListener('message', handler);

    // 请求主线程执行 Tauri 调用
    self.postMessage({
      type: 'tauri-request',
      requestId,
      command: 'runWhisper',
      args: request,
    });

    // 超时保护（5 分钟）
    setTimeout(() => {
      self.removeEventListener('message', handler);
      reject(new Error('Whisper 调用超时（5分钟）'));
    }, 5 * 60 * 1000);
  });
}
