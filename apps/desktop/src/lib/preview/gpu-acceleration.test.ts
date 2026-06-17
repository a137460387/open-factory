import { describe, expect, it } from 'vitest';
import type { MediaAsset, Timeline } from '@open-factory/editor-core';
import {
  GpuTexturePool,
  buildGpuPrefetchFrameRequests,
  calculateInstancedDrawCallCount,
  estimateTextureBytes,
  formatTextureMemoryMiB,
  resolveGpuPreviewCapabilities
} from './gpu-acceleration';

const timeline: Timeline = {
  tracks: [
    {
      id: 'track-video',
      name: 'Video',
      type: 'video',
      clips: [],
      muted: false,
      locked: false
    }
  ],
  transitions: [],
  markers: []
};

const media: MediaAsset[] = [
  {
    id: 'media-a',
    type: 'video',
    name: 'A.mp4',
    path: 'D:/media/A.mp4',
    duration: 12,
    width: 1920,
    height: 1080
  }
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
      height: 720
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
        hasTimerQuery: true
      })
    ).toEqual({
      offscreenCanvasWorkerSupported: true,
      texturePreloadSupported: true,
      timerQuerySupported: true,
      fallbackReason: undefined
    });

    expect(
      resolveGpuPreviewCapabilities({
        hasOffscreenCanvas: false,
        hasCanvasTransfer: true,
        hasWorker: true,
        hasCreateImageBitmap: true,
        hasWebGl: true
      })
    ).toMatchObject({
      offscreenCanvasWorkerSupported: false,
      texturePreloadSupported: true,
      fallbackReason: 'offscreen-canvas-worker-unavailable'
    });
  });

  it('normalizes texture memory estimates for the metrics panel', () => {
    expect(estimateTextureBytes(1920, 1080)).toBe(8294400);
    expect(formatTextureMemoryMiB(512 * 1024 * 1024)).toBe(512);
  });
});
