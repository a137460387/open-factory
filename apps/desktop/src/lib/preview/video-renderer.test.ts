// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/video-renderer.ts
// 覆盖目标：drawVideo2d / drawVideoWebGl（硬件解码优先路径 + 回退路径 + 全景投影 + 缩略图兜底 + 源时间计算）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { DEFAULT_TRANSFORM } from '@open-factory/editor-core';
import type { HardwareDecodeManager } from './hw-decode-manager';

vi.mock('./transform-2d', () => ({
  drawTransformedSource2d: vi.fn(),
}));

vi.mock('./debug', () => ({
  recordPreviewDraw: vi.fn(),
  recordPreviewError: vi.fn(),
}));

import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { recordPreviewDraw, recordPreviewError } from './debug';

const drawTransformedSource2dMock = vi.mocked(drawTransformedSource2d);
const recordPreviewDrawMock = vi.mocked(recordPreviewDraw);
const recordPreviewErrorMock = vi.mocked(recordPreviewError);

type VideoClip = Extract<Clip, { type: 'video' }>;

function makeClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: 'clip-video-1',
    type: 'video',
    trackId: 'track-1',
    name: 'video-clip',
    start: 1,
    duration: 5,
    trimStart: 0.5,
    trimEnd: 0,
    transform: DEFAULT_TRANSFORM,
    mediaId: 'media-1',
    speed: 1,
    ...overrides,
  } as VideoClip;
}

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'media-1',
    type: 'video',
    name: 'A.mp4',
    path: 'D:/media/A.mp4',
    duration: 30,
    width: 1920,
    height: 1080,
    ...overrides,
  } as MediaAsset;
}

function makeHwManager(options: { initialized?: boolean; frame?: unknown; error?: Error } = {}) {
  return {
    isInitialized: vi.fn(() => options.initialized ?? false),
    decodeFrame: vi.fn(
      options.error
        ? () => Promise.reject(options.error)
        : () => Promise.resolve(options.frame ?? { imageData: {}, timestamp: 1, decodeTimeMs: 2 }),
    ),
  };
}

const context = {} as CanvasRenderingContext2D;
const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
const video = {} as HTMLVideoElement;
const thumbnail = {} as HTMLImageElement;
const seekVideo = vi.fn(async () => undefined);
const loadThumbnail = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ closed: false, close: vi.fn() })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drawVideo2d', () => {
  it('硬件解码可用时经 createImageBitmap 绘制并关闭位图', async () => {
    const bitmap = { closed: false, close: vi.fn() };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const clip = makeClip();
    const asset = makeAsset();
    const manager = makeHwManager({ initialized: true });

    await drawVideo2d(
      context,
      canvas,
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
      false,
      [],
      manager as unknown as HardwareDecodeManager,
    );

    expect(manager.decodeFrame).toHaveBeenCalledWith(2.5);
    expect(drawTransformedSource2dMock).toHaveBeenCalledTimes(1);
    expect(bitmap.close).toHaveBeenCalled();
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'hw-decode');
    expect(seekVideo).not.toHaveBeenCalled();
  });

  it('硬件解码失败时回退到视频元素并记录错误', async () => {
    const clip = makeClip();
    const asset = makeAsset();
    const manager = makeHwManager({ initialized: true, error: new Error('hw boom') });

    await drawVideo2d(
      context,
      canvas,
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
      false,
      [],
      manager as unknown as HardwareDecodeManager,
    );

    expect(recordPreviewErrorMock).toHaveBeenCalledWith('hw boom');
    expect(seekVideo).toHaveBeenCalledWith(video, 2.5);
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'video');
  });

  it('playheadTime 早于 clip 起点时源时间钳制为 trimStart', async () => {
    const clip = makeClip();
    const asset = makeAsset();

    await drawVideo2d(context, canvas, clip, asset, video, 0.5, seekVideo, loadThumbnail);

    expect(seekVideo).toHaveBeenCalledWith(video, 0.5);
    expect(drawTransformedSource2dMock).toHaveBeenCalledTimes(1);
  });

  it('seek 失败且有缩略图时绘制缩略图兜底', async () => {
    const clip = makeClip();
    const asset = makeAsset();
    const failingSeek = vi.fn(async () => {
      throw new Error('seek failed');
    });
    const withThumb = vi.fn(async () => thumbnail);

    await drawVideo2d(context, canvas, clip, asset, video, 3, failingSeek, withThumb);

    expect(recordPreviewErrorMock).toHaveBeenCalledWith('seek failed');
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'thumbnail');
    expect(drawTransformedSource2dMock).toHaveBeenCalledTimes(1);
  });

  it('seek 失败且无缩略图时不绘制', async () => {
    const clip = makeClip();
    const asset = makeAsset();
    const failingSeek = vi.fn(async () => {
      throw new Error('seek failed');
    });

    await drawVideo2d(context, canvas, clip, asset, video, 3, failingSeek, loadThumbnail);

    expect(recordPreviewDrawMock).not.toHaveBeenCalled();
    expect(drawTransformedSource2dMock).not.toHaveBeenCalled();
  });
});

describe('drawVideoWebGl', () => {
  function makeCompositor() {
    return {
      drawSourceWithColorNodeGraph: vi.fn(),
      drawPanoramaSource: vi.fn(() => true),
    };
  }

  it('硬件解码成功时绘制位图并使用 :hw 纹理缓存键', async () => {
    const bitmap = { closed: false, close: vi.fn() };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const compositor = makeCompositor();
    const clip = makeClip();
    const asset = makeAsset({ path: 'D:/media/A.mp4' });
    const manager = makeHwManager({ initialized: true });

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
      false,
      [],
      undefined,
      manager as unknown as HardwareDecodeManager,
    );

    expect(compositor.drawSourceWithColorNodeGraph).toHaveBeenCalledTimes(1);
    const args = compositor.drawSourceWithColorNodeGraph.mock.calls[0];
    expect(args?.[9]).toMatchObject({ textureCacheKey: 'D:/media/A.mp4:hw' });
    expect(bitmap.close).toHaveBeenCalled();
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'hw-decode');
  });

  it('硬件解码 + 全景投影成功时走 drawPanoramaSource', async () => {
    const compositor = makeCompositor();
    const clip = makeClip({
      projection: 'equirectangular',
      panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    });
    const asset = makeAsset();
    const manager = makeHwManager({ initialized: true });

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
      false,
      [],
      undefined,
      manager as unknown as HardwareDecodeManager,
    );

    expect(compositor.drawPanoramaSource).toHaveBeenCalledTimes(1);
    expect(compositor.drawSourceWithColorNodeGraph).not.toHaveBeenCalled();
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'hw-decode');
  });

  it('全景投影被拒绝时回退到普通绘制', async () => {
    const compositor = makeCompositor();
    compositor.drawPanoramaSource = vi.fn(() => false);
    const clip = makeClip({
      projection: 'equirectangular',
      panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    });
    const asset = makeAsset();
    const manager = makeHwManager({ initialized: true });

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
      false,
      [],
      undefined,
      manager as unknown as HardwareDecodeManager,
    );

    expect(compositor.drawPanoramaSource).toHaveBeenCalledTimes(1);
    expect(compositor.drawSourceWithColorNodeGraph).toHaveBeenCalledTimes(1);
  });

  it('标准路径绘制视频元素并以资产路径为缓存键', async () => {
    const compositor = makeCompositor();
    const clip = makeClip();
    const asset = makeAsset({ path: 'D:/media/B.mp4' });

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
    );

    expect(seekVideo).toHaveBeenCalledWith(video, 2.5);
    const args = compositor.drawSourceWithColorNodeGraph.mock.calls[0];
    expect(args?.[0]).toBe(video);
    expect(args?.[9]).toMatchObject({ textureCacheKey: 'D:/media/B.mp4' });
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'video');
  });

  it('标准路径全景投影成功时不走普通绘制', async () => {
    const compositor = makeCompositor();
    const clip = makeClip({
      projection: 'equirectangular',
      panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    });
    const asset = makeAsset();

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
    );

    expect(compositor.drawPanoramaSource).toHaveBeenCalledTimes(1);
    expect(compositor.drawSourceWithColorNodeGraph).not.toHaveBeenCalled();
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'video');
  });

  it('seek 失败且有缩略图时以 :thumbnail 键兜底绘制', async () => {
    const compositor = makeCompositor();
    const clip = makeClip();
    const asset = makeAsset({ path: 'D:/media/C.mp4' });
    const failingSeek = vi.fn(async () => {
      throw new Error('seek failed');
    });
    const withThumb = vi.fn(async () => thumbnail);

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      failingSeek,
      withThumb,
    );

    const args = compositor.drawSourceWithColorNodeGraph.mock.calls[0];
    expect(args?.[0]).toBe(thumbnail);
    expect(args?.[9]).toMatchObject({ textureCacheKey: 'D:/media/C.mp4:thumbnail' });
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'thumbnail');
  });

  it('seek 失败 + 全景缩略图兜底成功时记录 thumbnail', async () => {
    const compositor = makeCompositor();
    const clip = makeClip({
      projection: 'equirectangular',
      panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    });
    const asset = makeAsset();
    const failingSeek = vi.fn(async () => {
      throw new Error('seek failed');
    });
    const withThumb = vi.fn(async () => thumbnail);

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      failingSeek,
      withThumb,
    );

    expect(compositor.drawPanoramaSource).toHaveBeenCalledTimes(1);
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'thumbnail');
  });

  it('seek 失败且无缩略图时不绘制', async () => {
    const compositor = makeCompositor();
    const clip = makeClip();
    const asset = makeAsset();
    const failingSeek = vi.fn(async () => {
      throw new Error('seek failed');
    });

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      failingSeek,
      loadThumbnail,
    );

    expect(compositor.drawSourceWithColorNodeGraph).not.toHaveBeenCalled();
    expect(recordPreviewDrawMock).not.toHaveBeenCalled();
  });

  it('2 倍速时源时间按速度曲线折算', async () => {
    const compositor = makeCompositor();
    const clip = makeClip({ speed: 2 });
    const asset = makeAsset();

    await drawVideoWebGl(
      compositor as unknown as Parameters<typeof drawVideoWebGl>[0],
      clip,
      asset,
      video,
      3,
      seekVideo,
      loadThumbnail,
    );

    // localTime = 3 - 1 = 2，2 倍速 → sourceOffset 4，加 trimStart 0.5
    expect(seekVideo).toHaveBeenCalledWith(video, 4.5);
  });
});
