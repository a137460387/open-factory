import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';
import type {
  LtxProgressPayload,
  LtxCompletedPayload,
} from '../../hooks/useVideoGeneration';
import type { GpuInfo } from '../../hooks/useGpuDetect';
import type {
  LocalModelInfo,
  ModelDownloadCompletedPayload,
  ModelDownloadProgressPayload,
  RemoteModelInfo,
} from '../../hooks/useModelManager';

// ========== GPU 检测 ==========

export function detectGpu(): Promise<GpuInfo> {
  const mock = getTauriMocks()?.detectGpu;
  if (mock) {
    return Promise.resolve(mock());
  }
  if (!isTauriRuntime()) {
    return Promise.resolve({
      available: false,
      gpuName: null,
      driverVersion: null,
      cudaVersion: null,
      vramTotalMb: null,
      vramFreeMb: null,
      recommendedPrecision: 'fp32',
      pytorchCompatible: false,
      errorMessage: 'Tauri 运行时不可用',
    });
  }
  return invoke<GpuInfo>('detect_gpu');
}

// ========== 模型管理 ==========

export interface ListLocalModelsResult {
  models: LocalModelInfo[];
  totalSize: number;
}

export interface ListRemoteModelsResult {
  models: RemoteModelInfo[];
}

export function listLocalModels(): Promise<ListLocalModelsResult> {
  const mock = getTauriMocks()?.listLocalModels;
  if (mock) {
    return Promise.resolve(mock());
  }
  if (!isTauriRuntime()) {
    return Promise.resolve({ models: [], totalSize: 0 });
  }
  return invoke<ListLocalModelsResult>('list_local_models');
}

export function listRemoteModels(): Promise<ListRemoteModelsResult> {
  const mock = getTauriMocks()?.listRemoteModels;
  if (mock) {
    return Promise.resolve(mock());
  }
  if (!isTauriRuntime()) {
    return Promise.resolve({ models: [] });
  }
  return invoke<ListRemoteModelsResult>('list_remote_models');
}

export function downloadModel(repoId: string): Promise<void> {
  const mock = getTauriMocks()?.downloadModel;
  if (mock) {
    return Promise.resolve(mock(repoId));
  }
  // 写操作不可静默成功：浏览器环境（无 Tauri 运行时）以明确错误拒绝，
  // 调用方（useModelManager）经 try-catch 展示 state.error
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('Tauri 运行时不可用'));
  }
  return invoke<void>('download_model', { request: { repoId } });
}

export function deleteModel(repoId: string): Promise<void> {
  const mock = getTauriMocks()?.deleteModel;
  if (mock) {
    return Promise.resolve(mock(repoId));
  }
  // 写操作不可静默成功：浏览器环境（无 Tauri 运行时）以明确错误拒绝
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('Tauri 运行时不可用'));
  }
  return invoke<void>('delete_model', { repoId });
}

// ========== 视频生成 ==========

export interface GenerateVideoRequest {
  prompt: string;
  negativePrompt?: string | null;
  imagePath?: string | null;
  numFrames: number;
  resolution: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed?: number | null;
}

export interface GenerateVideoResponse {
  taskId: string;
  status: string;
}

export function generateVideo(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
  const mock = getTauriMocks()?.generateVideo;
  if (mock) {
    return Promise.resolve(mock(request));
  }
  return invoke<GenerateVideoResponse>('generate_video', { request });
}

export function cancelVideoGeneration(taskId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelVideoGeneration;
  if (mock) {
    return Promise.resolve(mock(taskId));
  }
  return invoke<void>('cancel_generation', { taskId });
}

// ========== 事件监听 ==========

export function listenLtxProgress(handler: (payload: LtxProgressPayload) => void): Promise<UnlistenFn> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    const unlisten = mock('ltx-video-progress', handler);
    return Promise.resolve(unlisten as unknown as UnlistenFn);
  }
  return listen<LtxProgressPayload>('ltx-video-progress', (event) => handler(event.payload));
}

export function listenLtxCompleted(handler: (payload: LtxCompletedPayload) => void): Promise<UnlistenFn> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    const unlisten = mock('ltx-video-completed', handler);
    return Promise.resolve(unlisten as unknown as UnlistenFn);
  }
  return listen<LtxCompletedPayload>('ltx-video-completed', (event) => handler(event.payload));
}

export function listenModelDownloadProgress(
  handler: (payload: ModelDownloadProgressPayload) => void,
): Promise<UnlistenFn> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    const unlisten = mock('model-download-progress', handler);
    return Promise.resolve(unlisten as unknown as UnlistenFn);
  }
  return listen<ModelDownloadProgressPayload>('model-download-progress', (event) =>
    handler(event.payload),
  );
}

export function listenModelDownloadCompleted(
  handler: (payload: ModelDownloadCompletedPayload) => void,
): Promise<UnlistenFn> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    const unlisten = mock('model-download-completed', handler);
    return Promise.resolve(unlisten as unknown as UnlistenFn);
  }
  return listen<ModelDownloadCompletedPayload>('model-download-completed', (event) =>
    handler(event.payload),
  );
}
