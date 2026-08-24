// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/image-renderer.ts
// 覆盖目标：drawImage2d / drawImage2dBypass / drawImageWebGl（参数透传 + 默认尺寸回退 + 记录调用）
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { DEFAULT_TRANSFORM } from '@open-factory/editor-core';

vi.mock('./transform-2d', () => ({
  drawTransformedSource2d: vi.fn(),
}));

vi.mock('./debug', () => ({
  recordPreviewDraw: vi.fn(),
}));

import { drawImage2d, drawImage2dBypass, drawImageWebGl } from './image-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { recordPreviewDraw } from './debug';

const drawTransformedSource2dMock = vi.mocked(drawTransformedSource2d);
const recordPreviewDrawMock = vi.mocked(recordPreviewDraw);

type ImageClip = Extract<Clip, { type: 'image' }>;

function makeClip(overrides: Partial<ImageClip> = {}): ImageClip {
  return {
    id: 'clip-image-1',
    type: 'image',
    trackId: 'track-1',
    name: 'image-clip',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    transform: DEFAULT_TRANSFORM,
    mediaId: 'media-1',
    ...overrides,
  } as ImageClip;
}

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'media-1',
    type: 'image',
    name: 'pic.png',
    path: 'D:/media/pic.png',
    ...overrides,
  } as MediaAsset;
}

const context = {} as CanvasRenderingContext2D;
const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
const img = {} as HTMLImageElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('drawImage2d', () => {
  it('透传图片尺寸与变换，并记录绘制', () => {
    const clip = makeClip({ transform: { ...DEFAULT_TRANSFORM, x: 5, opacity: 0.9 } });
    const asset = makeAsset({ width: 320, height: 240 });

    drawImage2d(context, canvas, clip, asset, img);

    expect(drawTransformedSource2dMock).toHaveBeenCalledWith(
      context,
      canvas,
      img,
      { width: 320, height: 240 },
      clip.transform,
      clip.colorCorrection,
    );
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('image', 'image');
  });

  it('资产无尺寸时回退到画布尺寸', () => {
    const clip = makeClip();
    const asset = makeAsset({ width: undefined, height: undefined });

    drawImage2d(context, canvas, clip, asset, img);

    expect(drawTransformedSource2dMock).toHaveBeenCalledWith(
      context,
      canvas,
      img,
      { width: 800, height: 600 },
      clip.transform,
      clip.colorCorrection,
    );
  });
});

describe('drawImage2dBypass', () => {
  it('不传色彩校正（undefined）实现旁路处理', () => {
    const clip = makeClip();
    const asset = makeAsset({ width: 100, height: 50 });

    drawImage2dBypass(context, canvas, clip, asset, img);

    // bypass 路径不传色彩校正参数（第 6 参缺失）
    expect(drawTransformedSource2dMock).toHaveBeenCalledTimes(1);
    const call = drawTransformedSource2dMock.mock.calls[0];
    expect(call?.slice(0, 5)).toEqual([context, canvas, img, { width: 100, height: 50 }, clip.transform]);
    expect(call?.[5]).toBeUndefined();
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('image', 'image');
  });
});

describe('drawImageWebGl', () => {
  it('透传合成器参数（含纹理缓存键与混合模式）', () => {
    const compositor = {
      drawSourceWithColorNodeGraph: vi.fn(),
    } as unknown as Parameters<typeof drawImageWebGl>[0];
    const clip = makeClip({ blendMode: 'screen' });
    const asset = makeAsset({ width: 1280, height: 720, path: 'D:/img/a.png' });

    drawImageWebGl(compositor, clip, asset, img, true, ['blur'], 'aces');

    expect(compositor.drawSourceWithColorNodeGraph).toHaveBeenCalledWith(
      img,
      1280,
      720,
      clip.transform,
      clip.colorNodeGraph,
      clip.colorCorrection,
      clip.effects,
      clip.chromaKey,
      clip.masks,
      {
        bypassProcessing: true,
        disabledEffectTypes: ['blur'],
        colorPipeline: 'aces',
        blendMode: 'screen',
        textureCacheKey: 'D:/img/a.png',
      },
    );
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('image', 'image');
  });

  it('资产无尺寸时回退到 1280x720 默认值', () => {
    const compositor = {
      drawSourceWithColorNodeGraph: vi.fn(),
    } as unknown as Parameters<typeof drawImageWebGl>[0];
    const clip = makeClip();
    const asset = makeAsset({ width: undefined, height: undefined });

    drawImageWebGl(compositor, clip, asset, img);

    const args = vi.mocked(compositor.drawSourceWithColorNodeGraph).mock.calls[0];
    expect(args?.[1]).toBe(1280);
    expect(args?.[2]).toBe(720);
    expect(args?.[9]).toMatchObject({ bypassProcessing: false, disabledEffectTypes: [] });
  });
});
