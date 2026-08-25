// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/hw-decode-manager.ts
// 覆盖目标：HardwareDecodeManager 全公开方法（能力检测/初始化/单帧与批量解码缓存/预解码/释放）
import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom 29 不提供全局 ImageData：stub 最小实现（beforeEach 内注册，防止 unstub 后丢失）
class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

vi.mock('../tauri-bridge', () => ({
  getHwDecodeCapabilities: vi.fn(),
  getHwDecodeSettings: vi.fn(),
  initHardwareDecoder: vi.fn(),
  releaseDecoder: vi.fn(),
  decodeVideoFrame: vi.fn(),
  decodeVideoFrames: vi.fn(),
  getDecoderVideoInfo: vi.fn(),
}));

import {
  decodeVideoFrame,
  decodeVideoFrames,
  getDecoderVideoInfo,
  getHwDecodeCapabilities,
  getHwDecodeSettings,
  initHardwareDecoder,
  releaseDecoder,
} from '../tauri-bridge';
import { HardwareDecodeManager } from './hw-decode-manager';

const capabilitiesMock = vi.mocked(getHwDecodeCapabilities);
const settingsMock = vi.mocked(getHwDecodeSettings);
const initMock = vi.mocked(initHardwareDecoder);
const releaseMock = vi.mocked(releaseDecoder);
const decodeFrameMock = vi.mocked(decodeVideoFrame);
const decodeFramesMock = vi.mocked(decodeVideoFrames);
const videoInfoMock = vi.mocked(getDecoderVideoInfo);

/** 2x2 RGBA 帧（16 字节）的 Base64 数据 */
function makeFrameBase64(): string {
  const bytes = new Uint8Array(16).fill(200);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const FRAME = {
  width: 2,
  height: 2,
  dataBase64: makeFrameBase64(),
  timestamp: 0,
  format: 'rgba',
};

function makeCapabilities(available: boolean) {
  return {
    availableBackends: [
      { backend: available ? ('Cuda' as const) : ('Software' as const), available, supportedCodecs: ['h264'] },
    ],
    recommendedBackend: available ? ('Cuda' as const) : ('Software' as const),
    supportedCodecs: ['h264'],
  };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'auto',
    preferredBackend: 'Cuda' as const,
    enableFrameCache: true,
    frameCacheSize: 30,
    enablePreDecode: true,
    preDecodeFrameCount: 5,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ImageData', FakeImageData);
  capabilitiesMock.mockResolvedValue(makeCapabilities(true));
  settingsMock.mockResolvedValue(makeSettings());
  initMock.mockResolvedValue({ 0: 1 });
  releaseMock.mockResolvedValue(undefined);
  videoInfoMock.mockResolvedValue({ width: 1920, height: 1080 } as never);
  decodeFrameMock.mockImplementation(async (_handle, timestamp: number) => ({
    ...FRAME,
    timestamp,
  }));
  decodeFramesMock.mockImplementation(async (_handle, timestamps: number[]) =>
    timestamps.map((timestamp) => ({ ...FRAME, timestamp })),
  );
});

describe('HardwareDecodeManager 能力与设置', () => {
  it('缓存能力查询结果', async () => {
    const manager = new HardwareDecodeManager();

    await manager.getCapabilities();
    await manager.getCapabilities();

    expect(capabilitiesMock).toHaveBeenCalledTimes(1);
  });

  it('有可用硬件后端时 hasHardwareAcceleration 为 true', async () => {
    const manager = new HardwareDecodeManager();
    expect(await manager.hasHardwareAcceleration()).toBe(true);
  });

  it('仅 Software 后端时 hasHardwareAcceleration 为 false', async () => {
    capabilitiesMock.mockResolvedValue(makeCapabilities(false));
    const manager = new HardwareDecodeManager();

    expect(await manager.hasHardwareAcceleration()).toBe(false);
  });

  it('返回推荐后端', async () => {
    const manager = new HardwareDecodeManager();
    expect(await manager.getRecommendedBackend()).toBe('Cuda');
  });

  it('加载设置并同步帧缓存容量', async () => {
    settingsMock.mockResolvedValue(makeSettings({ frameCacheSize: 2 }));
    const manager = new HardwareDecodeManager();

    const settings = await manager.loadSettings();

    expect(settings.frameCacheSize).toBe(2);
  });
});

describe('HardwareDecodeManager 初始化与释放', () => {
  it('初始化后记录配置与视频信息', async () => {
    const manager = new HardwareDecodeManager();

    await manager.initialize({ path: 'D:/media/A.mp4', preferredBackend: 'Cuda' });

    expect(manager.isInitialized()).toBe(true);
    expect(manager.getConfig()).toMatchObject({ path: 'D:/media/A.mp4' });
    expect(manager.getVideoInfo()).toMatchObject({ width: 1920, height: 1080 });
    expect(manager.getCacheSize()).toBe(0);
  });

  it('视频信息获取失败不影响初始化', async () => {
    videoInfoMock.mockRejectedValue(new Error('no info'));
    const manager = new HardwareDecodeManager();

    await manager.initialize({ path: 'D:/media/A.mp4' });

    expect(manager.isInitialized()).toBe(true);
    expect(manager.getVideoInfo()).toBeNull();
  });

  it('重复初始化先释放旧解码器', async () => {
    const manager = new HardwareDecodeManager();

    await manager.initialize({ path: 'D:/media/A.mp4' });
    await manager.initialize({ path: 'D:/media/B.mp4' });

    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(manager.getConfig()).toMatchObject({ path: 'D:/media/B.mp4' });
  });

  it('释放后清理句柄与缓存', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });
    await manager.decodeFrame(1);

    await manager.release();

    expect(releaseMock).toHaveBeenCalledWith({ 0: 1 });
    expect(manager.isInitialized()).toBe(false);
    expect(manager.getConfig()).toBeNull();
    expect(manager.getVideoInfo()).toBeNull();
    expect(manager.getCacheSize()).toBe(0);
  });
});

describe('HardwareDecodeManager 单帧解码', () => {
  it('未初始化时抛出错误', async () => {
    const manager = new HardwareDecodeManager();

    await expect(manager.decodeFrame(0)).rejects.toThrow('解码器未初始化');
  });

  it('解码帧并转换 Base64 为 ImageData', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    const frame = await manager.decodeFrame(1.5);

    expect(decodeFrameMock).toHaveBeenCalledWith({ 0: 1 }, 1.5);
    expect(frame.timestamp).toBe(1.5);
    expect(frame.imageData.width).toBe(2);
    expect(frame.imageData.height).toBe(2);
    expect(frame.imageData.data).toHaveLength(16);
    expect(frame.imageData.data[0]).toBe(200);
  });

  it('相同时间戳命中缓存不再请求后端', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await manager.decodeFrame(2);
    await manager.decodeFrame(2);

    expect(decodeFrameMock).toHaveBeenCalledTimes(1);
    expect(manager.getCacheSize()).toBe(1);
  });

  it('设置禁用帧缓存时不缓存', async () => {
    settingsMock.mockResolvedValue(makeSettings({ enableFrameCache: false }));
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await manager.decodeFrame(2);
    await manager.decodeFrame(2);

    expect(decodeFrameMock).toHaveBeenCalledTimes(2);
    expect(manager.getCacheSize()).toBe(0);
  });

  it('缓存容量满时淘汰最早帧', async () => {
    settingsMock.mockResolvedValue(makeSettings({ frameCacheSize: 2 }));
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await manager.decodeFrame(1);
    await manager.decodeFrame(2);
    await manager.decodeFrame(3);

    expect(manager.getCacheSize()).toBe(2);
    // 帧 1 被淘汰：再次请求需重新解码
    await manager.decodeFrame(1);
    expect(decodeFrameMock).toHaveBeenCalledTimes(4);
  });
});

describe('HardwareDecodeManager 批量解码', () => {
  it('未初始化时抛出错误', async () => {
    const manager = new HardwareDecodeManager();

    await expect(manager.decodeFrames([0])).rejects.toThrow('解码器未初始化');
  });

  it('批量解码未缓存时间戳并按序返回', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    const frames = await manager.decodeFrames([1, 2]);

    expect(decodeFramesMock).toHaveBeenCalledWith({ 0: 1 }, [1, 2]);
    expect(frames.map((frame) => frame.timestamp)).toEqual([1, 2]);
    expect(manager.getCacheSize()).toBe(2);
  });

  it('命中缓存的时间戳不进入批量请求', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });
    await manager.decodeFrame(1);

    const frames = await manager.decodeFrames([1, 2]);

    expect(decodeFramesMock).toHaveBeenCalledWith({ 0: 1 }, [2]);
    expect(frames.map((frame) => frame.timestamp)).toEqual([1, 2]);
  });

  it('禁用帧缓存时全部时间戳进入批量请求', async () => {
    settingsMock.mockResolvedValue(makeSettings({ enableFrameCache: false }));
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });
    await manager.decodeFrame(1);

    await manager.decodeFrames([1, 2]);

    expect(decodeFramesMock).toHaveBeenCalledWith({ 0: 1 }, [1, 2]);
  });
});

describe('HardwareDecodeManager 预解码', () => {
  it('按帧率预解码后续帧', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await manager.preDecode(0, 25, 2);
    // 异步触发不等待：flush 微任务
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(decodeFrameMock).toHaveBeenCalledTimes(2);
    expect(decodeFrameMock.mock.calls[0]?.[1]).toBeCloseTo(1 / 25, 5);
    expect(decodeFrameMock.mock.calls[1]?.[1]).toBeCloseTo(2 / 25, 5);
  });

  it('设置禁用预解码时不触发', async () => {
    settingsMock.mockResolvedValue(makeSettings({ enablePreDecode: false }));
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await manager.preDecode(0, 25, 2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(decodeFrameMock).not.toHaveBeenCalled();
  });

  it('预解码失败仅记录日志不抛出', async () => {
    decodeFrameMock.mockRejectedValue(new Error('decode failed'));
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });

    await expect(manager.preDecode(0, 25, 1)).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('HardwareDecodeManager 缓存管理', () => {
  it('clearCache 清空缓存且不影响初始化状态', async () => {
    const manager = new HardwareDecodeManager();
    await manager.initialize({ path: 'D:/media/A.mp4' });
    await manager.decodeFrame(1);

    manager.clearCache();

    expect(manager.getCacheSize()).toBe(0);
    expect(manager.isInitialized()).toBe(true);
  });
});
