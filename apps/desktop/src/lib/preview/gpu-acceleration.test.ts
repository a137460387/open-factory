import { describe, expect, it } from 'vitest';
import type { MediaAsset, Timeline } from '@open-factory/editor-core';
import {
  GPU_TEXTURE_POOL_MAX_BYTES,
  GpuTexturePool,
  buildGpuPrefetchFrameRequests,
  calculateInstancedDrawCallCount,
  detectGpuPreviewCapabilities,
  estimateTextureBytes,
  formatTextureMemoryMiB,
  resolveGpuPreviewCapabilities,
} from './gpu-acceleration';

const timeline: Timeline = {
  tracks: [
    {
      id: 'track-video',
      name: 'Video',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
    },
  ],
  transitions: [],
  markers: [],
};

const media: MediaAsset[] = [
  {
    id: 'media-a',
    type: 'video',
    name: 'A.mp4',
    path: 'D:/media/A.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
  },
];

describe('gpu preview acceleration helpers', () => {
  it('evicts least-recently-used textures when the 512MB pool budget is exceeded', () => {
    const disposed: string[] = [];
    const pool = new GpuTexturePool<string>({ maxBytes: 10, disposeTexture: (texture) => disposed.push(texture) });

    expect(pool.put({ key: 'old', texture: 'texture-old', bytes: 4 })).toBe(true);
    expect(pool.put({ key: 'middle', texture: 'texture-middle', bytes: 4 })).toBe(true);
    expect(pool.get('old')).toBe('texture-old');
    expect(pool.put({ key: 'new', texture: 'texture-new', bytes: 4 })).toBe(true);

    expect(pool.has('old')).toBe(true);
    expect(pool.has('middle')).toBe(false);
    expect(pool.has('new')).toBe(true);
    expect(pool.snapshot()).toMatchObject({ bytes: 8, count: 2, maxBytes: 10 });
    expect(disposed).toEqual(['texture-middle']);
  });

  it('skips oversized textures without crashing or evicting valid entries', () => {
    const disposed: string[] = [];
    const pool = new GpuTexturePool<string>({ maxBytes: 10, disposeTexture: (texture) => disposed.push(texture) });

    expect(pool.put({ key: 'valid', texture: 'texture-valid', bytes: 4 })).toBe(true);
    expect(pool.put({ key: 'too-large', texture: 'texture-large', bytes: 11 })).toBe(false);

    expect(pool.has('valid')).toBe(true);
    expect(pool.has('too-large')).toBe(false);
    expect(disposed).toEqual([]);
  });

  it('calculates the playback prefetch window from playhead to playhead plus three seconds', () => {
    const requests = buildGpuPrefetchFrameRequests({
      timeline,
      media,
      playheadTime: 10,
      duration: 20,
      fps: 2,
      width: 1280,
      height: 720,
    });

    expect(requests[0]).toMatchObject({ frame: 20, time: 10 });
    expect(requests.at(-1)).toMatchObject({ frame: 26, time: 13 });
    expect(new Set(requests.map((request) => request.key)).size).toBe(requests.length);
  });

  it('plans one instanced draw call for multiple clips when instancing is available', () => {
    expect(calculateInstancedDrawCallCount(0, true)).toBe(0);
    expect(calculateInstancedDrawCallCount(12, true)).toBe(1);
    expect(calculateInstancedDrawCallCount(12, false)).toBe(12);
  });

  it('detects OffscreenCanvas fallback conditions explicitly', () => {
    expect(
      resolveGpuPreviewCapabilities({
        hasOffscreenCanvas: true,
        hasCanvasTransfer: true,
        hasWorker: true,
        hasCreateImageBitmap: true,
        hasWebGl: true,
        hasTimerQuery: true,
      }),
    ).toEqual({
      offscreenCanvasWorkerSupported: true,
      texturePreloadSupported: true,
      timerQuerySupported: true,
      fallbackReason: undefined,
    });

    expect(
      resolveGpuPreviewCapabilities({
        hasOffscreenCanvas: false,
        hasCanvasTransfer: true,
        hasWorker: true,
        hasCreateImageBitmap: true,
        hasWebGl: true,
      }),
    ).toMatchObject({
      offscreenCanvasWorkerSupported: false,
      texturePreloadSupported: true,
      fallbackReason: 'offscreen-canvas-worker-unavailable',
    });
  });

  it('normalizes texture memory estimates for the metrics panel', () => {
    expect(estimateTextureBytes(1920, 1080)).toBe(8294400);
    expect(formatTextureMemoryMiB(512 * 1024 * 1024)).toBe(512);
  });

  it('exposes the default pool budget and clamps degenerate inputs', () => {
    expect(GPU_TEXTURE_POOL_MAX_BYTES).toBe(512 * 1024 * 1024);
    // 非法字节/尺寸归一化为 1，不产生 0 或 NaN
    expect(estimateTextureBytes(0, 0, 0)).toBe(1);
    expect(estimateTextureBytes(Number.NaN, 10)).toBe(1);
    expect(formatTextureMemoryMiB(-1)).toBe(0);
    expect(formatTextureMemoryMiB(1.5 * 1024 * 1024)).toBe(1.5);
    expect(calculateInstancedDrawCallCount(Number.NaN, true)).toBe(0);
    expect(calculateInstancedDrawCallCount(-3, false)).toBe(0);
  });
});

describe('GpuTexturePool 边缘路径（四期-B 补充）', () => {
  it('替换同 key 纹理时释放旧纹理并修正字节占用', () => {
    const disposed: string[] = [];
    const pool = new GpuTexturePool<string>({ maxBytes: 100, disposeTexture: (t) => disposed.push(t) });

    pool.put({ key: 'k', texture: 't1', bytes: 10 });
    expect(pool.put({ key: 'k', texture: 't2', bytes: 20 })).toBe(true);

    expect(pool.get('k')).toBe('t2');
    expect(pool.sizeBytes).toBe(20);
    expect(disposed).toEqual(['t1']);

    // 同一纹理重复 put 不触发释放
    pool.put({ key: 'k', texture: 't2', bytes: 20 });
    expect(disposed).toEqual(['t1']);
  });

  it('空 key、NaN 字节被拒绝；未知 key 删除返回 false', () => {
    const pool = new GpuTexturePool<string>({ maxBytes: 100 });
    expect(pool.put({ key: '   ', texture: 't', bytes: 1 })).toBe(false);
    expect(pool.put({ key: 'nan', texture: 't', bytes: Number.NaN })).toBe(true);
    // NaN 归一化为 1 字节
    expect(pool.sizeBytes).toBe(1);
    expect(pool.delete('missing')).toBe(false);
    expect(pool.get('missing')).toBeUndefined();
  });

  it('delete 释放纹理并回收字节；clear 释放全部并清零快照', () => {
    const disposed: string[] = [];
    const pool = new GpuTexturePool<string>({ maxBytes: 100, disposeTexture: (t) => disposed.push(t) });
    pool.put({ key: 'a', texture: 'ta', bytes: 30 });
    pool.put({ key: 'b', texture: 'tb', bytes: 30 });

    expect(pool.delete('a')).toBe(true);
    expect(pool.has('a')).toBe(false);
    expect(pool.sizeBytes).toBe(30);

    const snapshot = pool.clear();
    expect(snapshot).toMatchObject({ bytes: 0, count: 0, maxBytes: 100, keys: [] });
    expect(disposed).toEqual(['ta', 'tb']);
    expect(pool.size).toBe(0);
  });

  it('默认预算为 512MB 且非法 maxBytes 回退为 1', () => {
    const pool = new GpuTexturePool<string>();
    expect(pool.snapshot().maxBytes).toBe(GPU_TEXTURE_POOL_MAX_BYTES);
    const tiny = new GpuTexturePool<string>({ maxBytes: 0 });
    expect(tiny.snapshot().maxBytes).toBe(1);
  });
});

describe('buildGpuPrefetchFrameRequests 边界（四期-B 补充）', () => {
  it('fps 非法回退 30；playhead 超出时长钳制到末帧', () => {
    const requests = buildGpuPrefetchFrameRequests({
      timeline,
      media,
      playheadTime: 100,
      duration: 10,
      fps: 0,
      width: 1280,
      height: 720,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ frame: 300, time: 10 });
  });

  it('lookaheadSeconds 0 时仅预取当前帧；时长 0 时输出第 0 帧', () => {
    const single = buildGpuPrefetchFrameRequests({
      timeline,
      media,
      playheadTime: 5,
      duration: 20,
      fps: 2,
      width: 1280,
      height: 720,
      lookaheadSeconds: 0,
    });
    expect(single).toHaveLength(1);
    expect(single[0].frame).toBe(10);

    const zero = buildGpuPrefetchFrameRequests({
      timeline,
      media,
      playheadTime: 3,
      duration: 0,
      fps: 2,
      width: 1280,
      height: 720,
    });
    expect(zero).toHaveLength(1);
    expect(zero[0].frame).toBe(0);
  });
});

describe('detectGpuPreviewCapabilities 探测（node 环境）', () => {
  it('传入探测画布：WebGL/timer query 可用时报告 timerQuerySupported', () => {
    const gl = { getExtension: (name: string) => (name === 'EXT_disjoint_timer_query' ? {} : null) };
    const canvas = {
      getContext: () => gl,
      transferControlToOffscreen: () => ({}),
    } as unknown as HTMLCanvasElement;

    const capabilities = detectGpuPreviewCapabilities(canvas);

    // node 环境无 OffscreenCanvas/createImageBitmap → 走回退
    expect(capabilities.offscreenCanvasWorkerSupported).toBe(false);
    expect(capabilities.texturePreloadSupported).toBe(false);
    expect(capabilities.timerQuerySupported).toBe(true);
    expect(capabilities.fallbackReason).toBe('offscreen-canvas-worker-unavailable');
  });

  it('无画布探测时保持 WebGL 可用性初值并报告回退原因', () => {
    const capabilities = detectGpuPreviewCapabilities();

    expect(capabilities.offscreenCanvasWorkerSupported).toBe(false);
    expect(capabilities.fallbackReason).toBe('offscreen-canvas-worker-unavailable');
  });
});
