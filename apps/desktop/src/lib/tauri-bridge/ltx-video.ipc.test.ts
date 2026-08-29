// @vitest-environment jsdom
// 源文件：
//   apps/desktop/src/lib/tauri-bridge/ltx-video.ts（112 可执行行，五期前覆盖 20.54%）
//   apps/desktop/src/lib/tauri-bridge/video-gen.ts（46 可执行行，五期前覆盖 2.17%）
// 覆盖目标：≥75%。模式：mockIPC 拦截 invoke（含 listen 走 plugin:event）+ __TAURI_MOCKS__ + 浏览器回退。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

import {
  detectGpu,
  listLocalModels,
  listRemoteModels,
  downloadModel,
  deleteModel,
  generateVideo,
  cancelVideoGeneration,
  listenLtxProgress,
  listenLtxCompleted,
  listenModelDownloadProgress,
  listenModelDownloadCompleted,
} from './ltx-video';
import {
  saveVideoGenTask,
  listVideoGenTasks,
  updateVideoGenTaskStatus,
  deleteVideoGenTask,
  cleanupVideoGenTasks,
} from './video-gen';

type WindowWithTauri = Window & {
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __TAURI_MOCKS__?: Record<string, unknown>;
};

function resetBrowserEnv() {
  delete (window as WindowWithTauri).__TAURI_INTERNALS__;
  delete (window as WindowWithTauri).__TAURI_MOCKS__;
}

beforeEach(() => {
  resetBrowserEnv();
});

afterEach(() => {
  clearMocks();
  resetBrowserEnv();
});

describe('ltx-video bridge：Tauri invoke 路径', () => {
  it('GPU/模型/生成命令透传参数', async () => {
    const handler = vi.fn(async (cmd: string) => {
      if (cmd === 'detect_gpu') return { available: true };
      if (cmd === 'list_local_models') return { models: [], totalSize: 0 };
      if (cmd === 'list_remote_models') return { models: [] };
      return undefined;
    });
    mockIPC(handler);
    await detectGpu();
    await listLocalModels();
    await listRemoteModels();
    await downloadModel('Lightricks/LTX-Video');
    await deleteModel('Lightricks/LTX-Video');
    await generateVideo({ prompt: '一只猫', numFrames: 96, resolution: 512, fps: 24, steps: 30, cfgScale: 3 });
    await cancelVideoGeneration('task-1');
    expect(handler).toHaveBeenNthCalledWith(1, 'detect_gpu', {});
    expect(handler).toHaveBeenNthCalledWith(2, 'list_local_models', {});
    expect(handler).toHaveBeenNthCalledWith(3, 'list_remote_models', {});
    expect(handler).toHaveBeenNthCalledWith(4, 'download_model', { request: { repoId: 'Lightricks/LTX-Video' } });
    expect(handler).toHaveBeenNthCalledWith(5, 'delete_model', { repoId: 'Lightricks/LTX-Video' });
    expect(handler).toHaveBeenNthCalledWith(6, 'generate_video', {
      request: { prompt: '一只猫', numFrames: 96, resolution: 512, fps: 24, steps: 30, cfgScale: 3 },
    });
    expect(handler).toHaveBeenNthCalledWith(7, 'cancel_generation', { taskId: 'task-1' });
  });

  it('事件监听走 plugin:event|listen 且事件名正确', async () => {
    const handler = vi.fn(async (_cmd: string, _args?: unknown) => 1);
    mockIPC(handler);
    const noop = vi.fn();
    await listenLtxProgress(noop);
    await listenLtxCompleted(noop);
    await listenModelDownloadProgress(noop);
    await listenModelDownloadCompleted(noop);
    const events = handler.mock.calls.map((call) => (call[1] as { event: string }).event);
    expect(events).toEqual([
      'ltx-video-progress',
      'ltx-video-completed',
      'model-download-progress',
      'model-download-completed',
    ]);
  });

  it('invoke 抛错向上传播（generateVideo）', async () => {
    mockIPC(async () => {
      throw new Error('cuda oom');
    });
    await expect(
      generateVideo({ prompt: 'x', numFrames: 1, resolution: 64, fps: 8, steps: 1, cfgScale: 1 }),
    ).rejects.toThrow('cuda oom');
  });
});

describe('ltx-video bridge：__TAURI_MOCKS__ 路径', () => {
  it('mock 短路 invoke（同步返回包装为 Promise）', async () => {
    const gpuInfo = {
      available: true,
      gpuName: 'RTX',
      driverVersion: '555',
      cudaVersion: '12.4',
      vramTotalMb: 24576,
      vramFreeMb: 20000,
      recommendedPrecision: 'fp16' as const,
      pytorchCompatible: true,
      errorMessage: null,
    };
    const detectGpuMock = vi.fn(() => gpuInfo);
    const generateVideoMock = vi.fn(() => ({ taskId: 't', status: 'queued' }));
    const cancelMock = vi.fn(() => undefined);
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      detectGpu: detectGpuMock,
      generateVideo: generateVideoMock,
      cancelVideoGeneration: cancelMock,
    };
    await expect(detectGpu()).resolves.toBe(gpuInfo);
    await expect(generateVideo({ prompt: 'x', numFrames: 1, resolution: 64, fps: 8, steps: 1, cfgScale: 1 })).resolves.toEqual({
      taskId: 't',
      status: 'queued',
    });
    await expect(cancelVideoGeneration('t')).resolves.toBeUndefined();
  });

  it('listen 走 mock 的 listen 通道并转发事件名', async () => {
    const listenMock = vi.fn(() => vi.fn());
    (window as WindowWithTauri).__TAURI_MOCKS__ = { listen: listenMock };
    const noop = vi.fn();
    await listenLtxProgress(noop);
    expect(listenMock).toHaveBeenCalledWith('ltx-video-progress', noop);
  });
});

describe('ltx-video bridge：浏览器回退路径', () => {
  it('detectGpu 返回不可用默认结构', async () => {
    await expect(detectGpu()).resolves.toMatchObject({
      available: false,
      gpuName: null,
      recommendedPrecision: 'fp32',
      errorMessage: expect.any(String),
    });
  });

  it('listLocalModels/listRemoteModels 返回空集合', async () => {
    await expect(listLocalModels()).resolves.toEqual({ models: [], totalSize: 0 });
    await expect(listRemoteModels()).resolves.toEqual({ models: [] });
  });

  it('downloadModel/deleteModel 无 Tauri 运行时以明确错误拒绝（写操作不可静默成功）', async () => {
    await expect(downloadModel('r')).rejects.toThrow('Tauri 运行时不可用');
    await expect(deleteModel('r')).rejects.toThrow('Tauri 运行时不可用');
  });
});

describe('video-gen bridge：invoke 参数构造', () => {
  it('save/list/delete/cleanup 透传', async () => {
    const handler = vi.fn(async (cmd: string) => (cmd === 'list_video_gen_tasks' ? [] : undefined));
    mockIPC(handler);
    const task = { id: 't1' } as never;
    await saveVideoGenTask(task);
    await listVideoGenTasks();
    await listVideoGenTasks('running');
    await deleteVideoGenTask('t1');
    await cleanupVideoGenTasks();
    await cleanupVideoGenTasks(10);
    expect(handler).toHaveBeenNthCalledWith(1, 'save_video_gen_task', { task });
    expect(handler).toHaveBeenNthCalledWith(2, 'list_video_gen_tasks', { statusFilter: null });
    expect(handler).toHaveBeenNthCalledWith(3, 'list_video_gen_tasks', { statusFilter: 'running' });
    expect(handler).toHaveBeenNthCalledWith(4, 'delete_video_gen_task', { id: 't1' });
    expect(handler).toHaveBeenNthCalledWith(5, 'cleanup_video_gen_tasks', { keepCompleted: null });
    expect(handler).toHaveBeenNthCalledWith(6, 'cleanup_video_gen_tasks', { keepCompleted: 10 });
  });

  it('updateVideoGenTaskStatus 省略参数补 null、seq 默认 0', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await updateVideoGenTaskStatus('t1');
    await updateVideoGenTaskStatus('t1', 'success', 1, 'render', '/out.mp4', undefined, undefined, '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', 3);
    expect(handler).toHaveBeenNthCalledWith(1, 'update_video_gen_task_status', {
      id: 't1',
      status: null,
      progress: null,
      stage: null,
      outputPath: null,
      errorMessage: null,
      errorType: null,
      startedAt: null,
      completedAt: null,
      seq: 0,
    });
    expect(handler).toHaveBeenNthCalledWith(2, 'update_video_gen_task_status', {
      id: 't1',
      status: 'success',
      progress: 1,
      stage: 'render',
      outputPath: '/out.mp4',
      errorMessage: null,
      errorType: null,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      seq: 3,
    });
  });

  it('listVideoGenTasks 返回后端任务数组', async () => {
    mockIPC(async () => [{ id: 't1' }, { id: 't2' }]);
    await expect(listVideoGenTasks()).resolves.toEqual([{ id: 't1' }, { id: 't2' }]);
  });

  it('invoke 抛错向上传播（deleteVideoGenTask）', async () => {
    mockIPC(async () => {
      throw new Error('db locked');
    });
    await expect(deleteVideoGenTask('t1')).rejects.toThrow('db locked');
  });
});
