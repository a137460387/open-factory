// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/renderer.ts
// 覆盖目标：PreviewRenderer 编排核心（render 2d/WebGL 路径 + 转场透明度 + 嵌套序列 +
//          调整层 + 音频频谱叠加 + 硬解码开关 + 纹理预载 + 委托方法）及纯计算私有函数经公开路径覆盖
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clip, MediaAsset, Timeline, Track } from '@open-factory/editor-core';
import { DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM } from '@open-factory/editor-core';

vi.mock('./webgl-compositor', () => ({
  WebGlPreviewCompositor: vi.fn(),
}));

vi.mock('./audio-renderer', () => ({
  PreviewAudioRenderer: vi.fn(),
}));

vi.mock('./hw-decode-manager', () => ({
  HardwareDecodeManager: vi.fn(),
}));

vi.mock('./media-elements', () => ({
  createVideoElement: vi.fn(() => ({})),
  loadImage: vi.fn(),
  loadThumbnail: vi.fn(),
  seekVideo: vi.fn(async () => undefined),
}));

vi.mock('./image-renderer', () => ({
  drawImage2d: vi.fn(),
  drawImage2dBypass: vi.fn(),
  drawImageWebGl: vi.fn(),
}));

vi.mock('./text-renderer', () => ({
  drawCreditsRoll2d: vi.fn(),
  drawCreditsRollWebGl: vi.fn(),
  drawMissing2d: vi.fn(),
  drawMissingWebGl: vi.fn(),
  drawText2d: vi.fn(),
  drawTextWebGl: vi.fn(),
}));

vi.mock('./video-renderer', () => ({
  drawVideo2d: vi.fn(async () => undefined),
  drawVideoWebGl: vi.fn(async () => undefined),
}));

vi.mock('./transform-2d', () => ({
  drawTransformedSource2d: vi.fn(),
}));

vi.mock('./debug', () => ({
  recordPreviewError: vi.fn(),
  recordPreviewGpuMetrics: vi.fn(),
  recordPreviewMode: vi.fn(),
  recordPreviewReadback: vi.fn(),
}));

import { PreviewRenderer } from './renderer';
import { WebGlPreviewCompositor } from './webgl-compositor';
import { PreviewAudioRenderer } from './audio-renderer';
import { HardwareDecodeManager } from './hw-decode-manager';
import { createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';
import { drawImage2d, drawImage2dBypass } from './image-renderer';
import { drawCreditsRoll2d, drawMissing2d, drawText2d, drawTextWebGl } from './text-renderer';
import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { recordPreviewError, recordPreviewReadback } from './debug';

const WebGlCtor = vi.mocked(WebGlPreviewCompositor);
const AudioRendererCtor = vi.mocked(PreviewAudioRenderer);
const HwManagerCtor = vi.mocked(HardwareDecodeManager);

// ---------- mock 实例 ----------

function makeWebglInstance() {
  return {
    begin: vi.fn(),
    finish: vi.fn(),
    drawSource: vi.fn(),
    drawSourceWithColorNodeGraph: vi.fn(),
    applyColorNodeGraph: vi.fn(),
    applyAdjustmentLayer: vi.fn(),
    preloadSourceTexture: vi.fn(() => true),
    getMetrics: vi.fn(() => ({
      gpuFrameMs: 1,
      textureBytes: 10,
      textureCount: 1,
      drawCalls: 1,
      instancedDrawCalls: 0,
      offscreenWorkerSupported: false,
      offscreenWorkerActive: false,
      timerQuerySupported: false,
    })),
    readCenterPixel: vi.fn(() => [20, 24, 32, 255]),
    readFramePixels: vi.fn(() => ({ width: 2, height: 2, data: new Uint8Array(16) })),
  };
}

function makeAudioRendererInstance() {
  return {
    syncAudio: vi.fn(),
    getLevels: vi.fn(() => ({
      trackLevels: {},
      masterLevel: { levelDb: -60, peakDb: -60 },
      trackFrequencyBands: {},
      trackAnalysisFrames: {},
    })),
    pauseAllAudio: vi.fn(),
    readAnalysisFrame: vi.fn<() => Uint8Array | undefined>(() => undefined),
  };
}

function makeHwManagerInstance() {
  return {
    hasHardwareAcceleration: vi.fn(async () => true),
    initialize: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
    isInitialized: vi.fn(() => true),
  };
}

let webglInstance: ReturnType<typeof makeWebglInstance>;
let audioRendererInstance: ReturnType<typeof makeAudioRendererInstance>;
let hwManagerInstance: ReturnType<typeof makeHwManagerInstance>;

// ---------- 2d context mock ----------

function make2dContext() {
  return {
    filter: 'none',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: '',
    textBaseline: '',
    font: '',
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getImageData: vi.fn(() => ({ data: [20, 24, 32, 255] })),
  };
}

let context2d: ReturnType<typeof make2dContext>;
let getContextSpy: { mockRestore(): void };

// ---------- fixture ----------

function makeClip(overrides: Record<string, unknown> = {}): Clip {
  return {
    id: 'clip-1',
    type: 'text',
    trackId: 'track-1',
    name: 'clip',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    transform: { ...DEFAULT_TRANSFORM },
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    text: '文本',
    style: {
      fontSize: 42,
      color: '#fff',
      backgroundColor: '#000',
      backgroundOpacity: 0,
      fontFamily: 'Inter',
      bold: false,
      italic: false,
    },
    ...overrides,
  } as unknown as Clip;
}

function makeTrack(clips: Clip[], overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'video',
    name: 'V1',
    clips,
    muted: false,
    solo: false,
    locked: false,
    ...overrides,
  } as Track;
}

function makeTimeline(clips: Clip[], transitions: Timeline['transitions'] = []): Timeline {
  return {
    tracks: [makeTrack(clips)],
    transitions,
    markers: [],
  } as unknown as Timeline;
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

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  return canvas;
}

beforeEach(() => {
  vi.clearAllMocks();
  webglInstance = makeWebglInstance();
  audioRendererInstance = makeAudioRendererInstance();
  hwManagerInstance = makeHwManagerInstance();
  // 默认 WebGL 不可用：render 走 2d 路径；WebGL 用例内单独启用
  WebGlCtor.mockImplementation(() => {
    throw new Error('webgl unavailable');
  });
  AudioRendererCtor.mockImplementation(() => audioRendererInstance as unknown as PreviewAudioRenderer);
  HwManagerCtor.mockImplementation(() => hwManagerInstance as unknown as HardwareDecodeManager);
  context2d = make2dContext();
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context2d as unknown as CanvasRenderingContext2D);
});

/** 启用 WebGL 合成器 mock（供 WebGL 路径用例调用） */
function enableWebGl(): void {
  WebGlCtor.mockImplementation(() => webglInstance as unknown as WebGlPreviewCompositor);
}

afterEach(() => {
  getContextSpy.mockRestore();
});

describe('PreviewRenderer.render 2d 路径', () => {
  it('绘制背景后按可见 clip 委托子渲染器', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({ type: 'text', text: '标题' });

    const result = await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    expect(context2d.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(context2d.fillStyle).toBe('#141820');
    expect(context2d.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(drawText2d).toHaveBeenCalledTimes(1);
    expect(result.frame).toBeUndefined();
    expect(recordPreviewReadback).toHaveBeenCalledWith([20, 24, 32, 255]);
  });

  it('captureFrame 时读取整帧（top-left 原点）', async () => {
    const renderer = new PreviewRenderer();
    context2d.getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(16).fill(9) })) as unknown as typeof context2d.getImageData;

    const result = await renderer.render(makeCanvas(), makeTimeline([]), [], 0, { captureFrame: true });

    expect(result.frame).toMatchObject({ width: 400, height: 300, origin: 'top-left' });
  });

  it('getImageData 抛错时记录错误不中断', async () => {
    const renderer = new PreviewRenderer();
    context2d.getImageData = vi.fn(() => {
      throw new Error('tainted canvas');
    });

    const result = await renderer.render(makeCanvas(), makeTimeline([]), [], 0);

    expect(recordPreviewReadback).toHaveBeenCalledWith(undefined, 'tainted canvas');
    expect(result.frame).toBeUndefined();
  });

  it('2d 上下文不可用（getContext null）时返回空结果', async () => {
    const nullSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const renderer = new PreviewRenderer();

    const result = await renderer.render(makeCanvas(), makeTimeline([makeClip()]), [], 1);

    nullSpy.mockRestore();
    expect(result).toEqual({});
    expect(drawText2d).not.toHaveBeenCalled();
  });

  it('视频/图片 clip 缺资产或资产缺失时绘制缺失提示', async () => {
    const renderer = new PreviewRenderer();
    const videoClip = makeClip({ type: 'video', id: 'clip-v', mediaId: 'media-x' });
    const imageClip = makeClip({ type: 'image', id: 'clip-i', mediaId: 'media-missing' });
    const missingAsset = makeAsset({ id: 'media-missing', missing: true });

    await renderer.render(makeCanvas(), makeTimeline([videoClip, imageClip]), [missingAsset], 1);

    expect(drawMissing2d).toHaveBeenCalledTimes(2);
    expect(drawVideo2d).not.toHaveBeenCalled();
    expect(drawImage2d).not.toHaveBeenCalled();
  });

  it('视频与图片 clip 正常资产时委托对应子渲染器', async () => {
    const renderer = new PreviewRenderer();
    const videoClip = makeClip({ type: 'video', id: 'clip-v', mediaId: 'media-1' });
    const imageClip = makeClip({ type: 'image', id: 'clip-i', mediaId: 'media-2' });
    vi.mocked(loadImage).mockResolvedValue({} as HTMLImageElement);

    await renderer.render(
      makeCanvas(),
      makeTimeline([videoClip, imageClip]),
      [makeAsset({ id: 'media-1' }), makeAsset({ id: 'media-2', type: 'image' })],
      1,
    );

    expect(drawVideo2d).toHaveBeenCalledTimes(1);
    expect(drawImage2d).toHaveBeenCalledTimes(1);
  });

  it('图片 clip 在 bypassProcessing 下走 bypass 绘制', async () => {
    const renderer = new PreviewRenderer();
    const imageClip = makeClip({ type: 'image', id: 'clip-i', mediaId: 'media-2' });
    vi.mocked(loadImage).mockResolvedValue({} as HTMLImageElement);

    await renderer.render(makeCanvas(), makeTimeline([imageClip]), [makeAsset({ id: 'media-2', type: 'image' })], 1, {
      bypassProcessing: true,
    });

    expect(drawImage2dBypass).toHaveBeenCalledTimes(1);
    expect(drawImage2d).not.toHaveBeenCalled();
  });

  it('credits clip 委托滚动字幕绘制并传入本地时间', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({ type: 'credits', id: 'clip-c', start: 1 });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 3);

    expect(drawCreditsRoll2d).toHaveBeenCalledWith(
      context2d,
      expect.anything(),
      expect.objectContaining({ id: 'clip-c' }),
      false,
      2,
    );
  });

  it('调整层 clip 对全画布应用滤镜（含 blur 效果）', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({
      type: 'adjustment',
      id: 'clip-adj',
      effects: [{ id: 'fx-blur', type: 'blur', enabled: true, params: { radius: 6 } }],
    });
    // 捕获 drawImage 执行时刻的 filter（snapshot 拷贝 + 调整层回绘两次）
    const filtersAtDraw: string[] = [];
    const originalDrawImage = context2d.drawImage;
    context2d.drawImage = ((...args: unknown[]) => {
      filtersAtDraw.push(context2d.filter);
      originalDrawImage(...(args as []));
    }) as unknown as typeof context2d.drawImage;

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    expect(filtersAtDraw[0]).toBe('none');
    expect(filtersAtDraw[1]).toContain('blur(6px)');
    expect(filtersAtDraw[1]).toContain('brightness(1)');
  });

  it('调整层在 bypassProcessing 下跳过滤镜', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({
      type: 'adjustment',
      id: 'clip-adj',
      effects: [{ id: 'fx-blur', type: 'blur', enabled: true, params: { radius: 6 } }],
    });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1, { bypassProcessing: true });

    expect(context2d.filter).toBe('none');
  });

  it('clip 透明度低于阈值时不绘制', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({ transform: { ...DEFAULT_TRANSFORM, opacity: 0.0005 } });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    expect(drawText2d).not.toHaveBeenCalled();
  });

  it('转场中点处两 clip 透明度互补（dissolve）', async () => {
    const renderer = new PreviewRenderer();
    const clipA = makeClip({ type: 'text', id: 'clip-a', start: 0, duration: 4, text: 'A' });
    const clipB = makeClip({ type: 'text', id: 'clip-b', start: 4, duration: 4, text: 'B' });
    const timeline = makeTimeline([clipA, clipB], [
      { id: 'trans-1', type: 'dissolve', duration: 2, fromClipId: 'clip-a', toClipId: 'clip-b' },
    ]);

    // 转场窗口 [B.playbackStart=2, 4)：中点 3 处两 clip 透明度各 0.5
    await renderer.render(makeCanvas(), timeline, [], 3);

    expect(drawText2d).toHaveBeenCalledTimes(2);
    const opacities = vi
      .mocked(drawText2d)
      .mock.calls.map((call) => (call[2] as Clip).transform.opacity)
      .sort();
    expect(opacities[0]).toBeCloseTo(0.5, 5);
    expect(opacities[1]).toBeCloseTo(0.5, 5);
  });

  it('fade-black 转场前半程隐藏入点 clip', async () => {
    const renderer = new PreviewRenderer();
    const clipA = makeClip({ type: 'text', id: 'clip-a', start: 0, duration: 4, text: 'A' });
    const clipB = makeClip({ type: 'text', id: 'clip-b', start: 4, duration: 4, text: 'B' });
    const timeline = makeTimeline([clipA, clipB], [
      { id: 'trans-1', type: 'fade-black', duration: 2, fromClipId: 'clip-a', toClipId: 'clip-b' },
    ]);

    // 窗口 [2,4)：进度 0.25 → fromClip opacity 0.5；toClip opacity 0 → 低于阈值不绘制
    await renderer.render(makeCanvas(), timeline, [], 2.5);

    const drawn = vi
      .mocked(drawText2d)
      .mock.calls.map((call) => [(call[2] as Clip).id, (call[2] as Clip).transform.opacity]);
    expect(drawn).toEqual([['clip-a', 0.5]]);
  });

  it('关键帧定位（keyframes.x/y）将归一化坐标映射为画布像素', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({
      transform: { ...DEFAULT_TRANSFORM, x: 0.5, y: -0.5 },
      keyframes: { x: [{}], y: [{}] },
    });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    const drawn = vi.mocked(drawText2d).mock.calls[0]?.[2] as Clip;
    expect(drawn.transform.x).toBeCloseTo(100, 5);
    expect(drawn.transform.y).toBeCloseTo(-75, 5);
  });
});

describe('PreviewRenderer.render 嵌套序列', () => {
  function nestedFixture() {
    const innerClip = makeClip({ type: 'text', id: 'clip-inner', text: '内层' });
    return {
      timeline: makeTimeline([makeClip({ type: 'nested-sequence', id: 'clip-nest', sequenceId: 'seq-1' })]),
      sequences: [{ id: 'seq-1', timeline: makeTimeline([innerClip]) }],
    };
  }

  it('递归渲染内层时间线并绘制嵌套画布', async () => {
    const renderer = new PreviewRenderer();
    const { timeline, sequences } = nestedFixture();

    await renderer.render(makeCanvas(), timeline, [], 1, { sequences: sequences as never });

    expect(drawText2d).toHaveBeenCalledTimes(1);
    expect(drawTransformedSource2d).toHaveBeenCalledTimes(1);
  });

  it('序列缺失时绘制缺失提示', async () => {
    const renderer = new PreviewRenderer();
    const timeline = makeTimeline([makeClip({ type: 'nested-sequence', id: 'clip-nest', sequenceId: 'seq-x' })]);

    await renderer.render(makeCanvas(), timeline, [], 1);

    expect(drawMissing2d).toHaveBeenCalledTimes(1);
    expect(drawTransformedSource2d).not.toHaveBeenCalled();
  });

  it('深度达到 3 层时不再递归（绘制缺失提示）', async () => {
    const renderer = new PreviewRenderer();
    const { timeline, sequences } = nestedFixture();

    await renderer.render(makeCanvas(), timeline, [], 1, { sequences: sequences as never, depth: 3 });

    expect(drawMissing2d).toHaveBeenCalledTimes(1);
    expect(drawTransformedSource2d).not.toHaveBeenCalled();
  });
});

describe('PreviewRenderer.render 音频频谱叠加', () => {
  const spectrumClip = () =>
    makeClip({
      effects: [
        { id: 'fx-spectrum', type: 'audio-spectrum', enabled: true, params: { style: 'bars', height: 20, position: 'bottom' } },
      ],
    });

  it('无频谱 effect 时不叠加', async () => {
    const renderer = new PreviewRenderer();

    await renderer.render(makeCanvas(), makeTimeline([]), [], 0);

    expect(context2d.drawImage).not.toHaveBeenCalled();
  });

  it('活跃频谱 effect 且有分析数据时叠加 overlay', async () => {
    audioRendererInstance.readAnalysisFrame = vi.fn(() => new Uint8Array(64).fill(128));
    const renderer = new PreviewRenderer();

    await renderer.render(makeCanvas(), makeTimeline([spectrumClip()]), [], 1);

    expect(audioRendererInstance.readAnalysisFrame).toHaveBeenCalledWith('frequency');
    expect(context2d.drawImage).toHaveBeenCalledTimes(1);
  });

  it('bypassProcessing 时不叠加频谱', async () => {
    audioRendererInstance.readAnalysisFrame = vi.fn(() => new Uint8Array(64).fill(128));
    const renderer = new PreviewRenderer();

    await renderer.render(makeCanvas(), makeTimeline([spectrumClip()]), [], 1, { bypassProcessing: true });

    expect(context2d.drawImage).not.toHaveBeenCalled();
  });

  it('分析数据缺失时不叠加', async () => {
    audioRendererInstance.readAnalysisFrame = vi.fn(() => undefined);
    const renderer = new PreviewRenderer();

    await renderer.render(makeCanvas(), makeTimeline([spectrumClip()]), [], 1);

    expect(context2d.drawImage).not.toHaveBeenCalled();
  });
});

describe('PreviewRenderer.render WebGL 路径', () => {
  it('WebGL 可用时走合成器流程并返回 gpuMetrics', async () => {
    enableWebGl();
    const renderer = new PreviewRenderer();
    const clip = makeClip({ type: 'text', text: 'GL' });

    const result = await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1, { captureFrame: true });

    expect(webglInstance.begin).toHaveBeenCalledWith(400, 300);
    expect(webglInstance.finish).toHaveBeenCalledTimes(1);
    expect(drawTextWebGl).toHaveBeenCalledTimes(1);
    expect(result.frame).toMatchObject({ width: 2, height: 2, origin: 'bottom-left' });
    expect(result.gpuMetrics).toMatchObject({ gpuFrameMs: 1 });
  });

  it('WebGL 构造失败时回退 2d 路径', async () => {
    const renderer = new PreviewRenderer();
    const clip = makeClip({ type: 'text' });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    expect(recordPreviewError).toHaveBeenCalledWith('webgl unavailable');
    expect(drawText2d).toHaveBeenCalledTimes(1);
    expect(webglInstance.begin).not.toHaveBeenCalled();
  });

  it('嵌套序列 WebGL 路径委托 drawSourceWithColorNodeGraph', async () => {
    enableWebGl();
    const renderer = new PreviewRenderer();
    const innerClip = makeClip({ type: 'text', id: 'clip-inner', text: '内层' });
    const timeline = makeTimeline([makeClip({ type: 'nested-sequence', id: 'clip-nest', sequenceId: 'seq-1' })]);
    const sequences = [{ id: 'seq-1', timeline: makeTimeline([innerClip]) }];

    await renderer.render(makeCanvas(), timeline, [], 1, { sequences: sequences as never });

    expect(drawTextWebGl).toHaveBeenCalledTimes(1);
    expect(webglInstance.drawSourceWithColorNodeGraph).toHaveBeenCalledTimes(1);
  });

  it('调整层 WebGL 路径：有节点图走 applyColorNodeGraph，无节点图走 applyAdjustmentLayer', async () => {
    enableWebGl();
    const renderer = new PreviewRenderer();
    const withGraph = makeClip({
      type: 'adjustment',
      id: 'adj-1',
      colorNodeGraph: { nodes: [], connections: [] },
    });
    const withoutGraph = makeClip({ type: 'adjustment', id: 'adj-2' });

    await renderer.render(makeCanvas(), makeTimeline([withGraph]), [], 1);
    expect(webglInstance.applyColorNodeGraph).toHaveBeenCalledTimes(1);
    expect(webglInstance.applyAdjustmentLayer).not.toHaveBeenCalled();

    await renderer.render(makeCanvas(), makeTimeline([withoutGraph]), [], 1);
    expect(webglInstance.applyAdjustmentLayer).toHaveBeenCalledTimes(1);
  });

  it('调整层在 bypassProcessing 下跳过合成器处理', async () => {
    enableWebGl();
    const renderer = new PreviewRenderer();
    const clip = makeClip({ type: 'adjustment', id: 'adj-1' });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1, { bypassProcessing: true });

    expect(webglInstance.applyAdjustmentLayer).not.toHaveBeenCalled();
    expect(webglInstance.applyColorNodeGraph).not.toHaveBeenCalled();
  });

  it('频谱叠加经合成器 drawSource 以 bypass 模式绘制', async () => {
    enableWebGl();
    audioRendererInstance.readAnalysisFrame = vi.fn(() => new Uint8Array(64).fill(128));
    const renderer = new PreviewRenderer();
    const clip = makeClip({
      effects: [
        { id: 'fx-spectrum', type: 'audio-spectrum', enabled: true, params: { style: 'bars', height: 20, position: 'bottom' } },
      ],
    });

    await renderer.render(makeCanvas(), makeTimeline([clip]), [], 1);

    const args = webglInstance.drawSource.mock.calls[0];
    // drawSource(source, width, height, transform, cc?, effects?, key?, masks?, options)
    expect(args?.[3]).toBe(DEFAULT_TRANSFORM);
    expect(args?.[8]).toEqual({ bypassProcessing: true });
  });

  it('渲染令牌失效时中止后续 clip 绘制', async () => {
    enableWebGl();
    const renderer = new PreviewRenderer();
    let releaseFirst: (() => void) | undefined;
    vi.mocked(drawVideoWebGl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    // 两个 clip：第一个挂起，恢复后第二个 clip 前的令牌检查触发中止
    const videoA = makeClip({ type: 'video', id: 'clip-v', mediaId: 'media-1' });
    const videoB = makeClip({ type: 'video', id: 'clip-v2', mediaId: 'media-1' });

    const first = renderer.render(makeCanvas(), makeTimeline([videoA, videoB]), [makeAsset()], 1);
    // 让首个 render 进入 drawVideoWebGl 等待
    await Promise.resolve();
    await Promise.resolve();
    // 第二次 render 使令牌失效
    await renderer.render(makeCanvas(), makeTimeline([]), [], 1);
    releaseFirst?.();

    const result = await first;
    expect(result).toEqual({});
  });
});

describe('PreviewRenderer 委托与工具方法', () => {
  it('syncAudio/getAudioLevels/pauseAllAudio 委托音频渲染器', () => {
    const renderer = new PreviewRenderer();
    const timeline = makeTimeline([]);

    renderer.syncAudio(timeline, [], 1, true, 0.8);
    renderer.getAudioLevels(123);
    renderer.pauseAllAudio();

    expect(audioRendererInstance.syncAudio).toHaveBeenCalledWith(timeline, [], 1, true, 0.8, undefined);
    expect(audioRendererInstance.getLevels).toHaveBeenCalledWith(123);
    expect(audioRendererInstance.pauseAllAudio).toHaveBeenCalledTimes(1);
  });

  it('getDuration 返回时间线播放时长', () => {
    const renderer = new PreviewRenderer();
    const timeline = makeTimeline([makeClip({ start: 0, duration: 5 }), makeClip({ start: 10, duration: 3, id: 'clip-2' })]);

    expect(renderer.getDuration(timeline)).toBe(13);
  });

  it('getGpuMetrics 无合成器时返回 undefined', () => {
    const renderer = new PreviewRenderer();
    expect(renderer.getGpuMetrics()).toBeUndefined();
  });

  it('drawCachedFrame 2d 路径绘制位图', () => {
    const renderer = new PreviewRenderer();
    const bitmap = { width: 400, height: 300 } as ImageBitmap;

    renderer.drawCachedFrame(makeCanvas(), bitmap);

    expect(context2d.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 400, 300);
  });
});

describe('PreviewRenderer 硬件解码开关', () => {
  it('无硬件加速时启用失败且不初始化', async () => {
    hwManagerInstance.hasHardwareAcceleration = vi.fn(async () => false);
    const renderer = new PreviewRenderer();

    const enabled = await renderer.enableHardwareDecode({ path: 'D:/media/A.mp4' });

    expect(enabled).toBe(false);
    expect(hwManagerInstance.initialize).not.toHaveBeenCalled();
    expect(renderer.isHardwareDecodeEnabled()).toBe(false);
  });

  it('有硬件加速时初始化成功并置位', async () => {
    const renderer = new PreviewRenderer();

    const enabled = await renderer.enableHardwareDecode({ path: 'D:/media/A.mp4', preferredBackend: 'Cuda' });

    expect(enabled).toBe(true);
    expect(hwManagerInstance.initialize).toHaveBeenCalledWith({ path: 'D:/media/A.mp4', preferredBackend: 'Cuda' });
    expect(renderer.isHardwareDecodeEnabled()).toBe(true);
    expect(renderer.getHardwareDecodeManager()).toBeDefined();
  });

  it('初始化抛错时记录错误并返回 false', async () => {
    hwManagerInstance.initialize = vi.fn(async () => {
      throw new Error('init failed');
    });
    const renderer = new PreviewRenderer();

    const enabled = await renderer.enableHardwareDecode({ path: 'D:/media/A.mp4' });

    expect(enabled).toBe(false);
    expect(recordPreviewError).toHaveBeenCalledWith('init failed');
  });

  it('禁用时释放管理器', async () => {
    const renderer = new PreviewRenderer();
    await renderer.enableHardwareDecode({ path: 'D:/media/A.mp4' });

    await renderer.disableHardwareDecode();

    expect(hwManagerInstance.release).toHaveBeenCalledTimes(1);
    expect(renderer.isHardwareDecodeEnabled()).toBe(false);
  });

  it('能力查询抛错时启用失败且保持 false', async () => {
    hwManagerInstance.hasHardwareAcceleration = vi.fn(async () => {
      throw new Error('caps failed');
    });
    const renderer = new PreviewRenderer();

    await renderer.enableHardwareDecode({ path: 'D:/media/A.mp4' });

    expect(renderer.isHardwareDecodeEnabled()).toBe(false);
  });
});

describe('PreviewRenderer.preloadMediaTexture', () => {
  it('缺失资产与非视频/图片类型直接返回 false', async () => {
    const renderer = new PreviewRenderer();
    const canvas = makeCanvas();

    expect(await renderer.preloadMediaTexture(canvas, makeAsset({ missing: true }))).toBe(false);
    expect(await renderer.preloadMediaTexture(canvas, makeAsset({ type: 'audio' }))).toBe(false);
  });

  it('WebGL 不可用时返回 false', async () => {
    const renderer = new PreviewRenderer();

    expect(await renderer.preloadMediaTexture(makeCanvas(), makeAsset())).toBe(false);
  });

  it('图片资产经 loadImage 预载纹理', async () => {
    enableWebGl();
    const image = {} as HTMLImageElement;
    vi.mocked(loadImage).mockResolvedValue(image);
    const renderer = new PreviewRenderer();

    const result = await renderer.preloadMediaTexture(makeCanvas(), makeAsset({ type: 'image', path: 'D:/img/a.png' }));

    expect(result).toBe(true);
    expect(webglInstance.preloadSourceTexture).toHaveBeenCalledWith(image, 1920, 1080, 'D:/img/a.png');
  });

  it('视频资产经 seekVideo 预载纹理（默认尺寸回退）', async () => {
    enableWebGl();
    const video = {} as HTMLVideoElement;
    vi.mocked(createVideoElement).mockReturnValue(video);
    const renderer = new PreviewRenderer();
    const asset = makeAsset({ width: undefined, height: undefined });

    const result = await renderer.preloadMediaTexture(makeCanvas(), asset);

    expect(result).toBe(true);
    expect(seekVideo).toHaveBeenCalledWith(video, 0);
    expect(webglInstance.preloadSourceTexture).toHaveBeenCalledWith(video, 1280, 720, 'D:/media/A.mp4');
  });

  it('预载失败时回退缩略图', async () => {
    enableWebGl();
    vi.mocked(loadImage).mockRejectedValue(new Error('load failed'));
    const thumbnail = {} as HTMLImageElement;
    vi.mocked(loadThumbnail).mockResolvedValue(thumbnail);
    const renderer = new PreviewRenderer();

    const result = await renderer.preloadMediaTexture(makeCanvas(), makeAsset({ type: 'image' }));

    expect(result).toBe(true);
    expect(recordPreviewError).toHaveBeenCalledWith('load failed');
    expect(webglInstance.preloadSourceTexture).toHaveBeenCalledWith(thumbnail, 1920, 1080, 'D:/media/A.mp4:thumbnail');
  });

  it('预载失败且无缩略图时返回 false', async () => {
    enableWebGl();
    vi.mocked(loadImage).mockRejectedValue(new Error('load failed'));
    vi.mocked(loadThumbnail).mockResolvedValue(undefined);
    const renderer = new PreviewRenderer();

    expect(await renderer.preloadMediaTexture(makeCanvas(), makeAsset({ type: 'image' }))).toBe(false);
  });
});
