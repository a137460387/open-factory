// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/media-elements.ts
// 覆盖目标：createVideoElement / createAudioElement / seekVideo / loadImage / loadThumbnail / once 事件等待
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import { createAudioElement, createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'media-1',
    type: 'video',
    name: 'A.mp4',
    path: 'D:/media/A.mp4',
    duration: 30,
    ...overrides,
  } as MediaAsset;
}

/** stub 全局 Image 构造器：记录实例并允许手动触发 onload/onerror */
function stubImage() {
  const instances: Array<{
    src: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  }> = [];
  class FakeImage {
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      instances.push(this);
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return instances;
}

describe('createVideoElement', () => {
  it('设置静音内联跨域属性并以源路径为 src', () => {
    const video = createVideoElement(makeAsset());

    expect(video.tagName).toBe('VIDEO');
    expect(video.preload).toBe('auto');
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.crossOrigin).toBe('anonymous');
    // jsdom 将盘符路径规范化为小写盘符
    expect(video.src).toBe('d:/media/A.mp4');
  });

  it('代理就绪时优先使用代理路径', () => {
    const video = createVideoElement(
      makeAsset({ proxyStatus: 'ready', proxyPath: 'D:/cache/A_proxy.mp4' }),
    );

    expect(video.src).toBe('d:/cache/A_proxy.mp4');
  });
});

describe('createAudioElement', () => {
  it('设置自动预加载并以音频预览路径为 src', () => {
    const audio = createAudioElement(makeAsset());

    expect(audio.tagName).toBe('AUDIO');
    expect(audio.preload).toBe('auto');
    expect(audio.src).toBe('d:/media/A.mp4');
  });
});

/** readyState 为 getter-only，需 defineProperty 覆盖 */
function setReadyState(video: HTMLVideoElement, value: number): void {
  Object.defineProperty(video, 'readyState', { value, configurable: true });
}

describe('seekVideo', () => {
  it('时间差小于 35ms 时直接返回不触发 seeked', async () => {
    const video = document.createElement('video');
    setReadyState(video, HTMLMediaElement.HAVE_METADATA);
    video.currentTime = 1.02;

    await seekVideo(video, 1);

    expect(video.currentTime).toBe(1.02);
  });

  it('目标时间超过时长时钳制到 duration 并等待 seeked 事件', async () => {
    const video = document.createElement('video');
    setReadyState(video, HTMLMediaElement.HAVE_METADATA);
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });

    const pending = seekVideo(video, 15);
    expect(video.currentTime).toBe(10);
    video.dispatchEvent(new Event('seeked'));
    await pending;

    expect(video.currentTime).toBe(10);
  });

  it('元数据未就绪时先等待 loadedmetadata', async () => {
    const video = document.createElement('video');
    setReadyState(video, 0);
    Object.defineProperty(video, 'duration', { value: 20, configurable: true });

    const pending = seekVideo(video, 5);
    video.dispatchEvent(new Event('loadedmetadata'));
    // 等微任务推进：loadedmetadata 的 await 返回后才注册 seeked 监听
    await new Promise((resolve) => setTimeout(resolve, 0));
    video.dispatchEvent(new Event('seeked'));
    await pending;

    expect(video.currentTime).toBe(5);
  });

  it('等待事件期间收到 error 事件时拒绝', async () => {
    const video = document.createElement('video');
    setReadyState(video, 0);

    const pending = seekVideo(video, 5);
    video.dispatchEvent(new Event('error'));

    await expect(pending).rejects.toThrow('媒体事件失败：loadedmetadata');
  });
});

describe('loadImage', () => {
  it('加载成功时解析为图片元素', async () => {
    const instances = stubImage();
    const promise = loadImage(makeAsset({ name: 'pic.png', path: 'D:/media/pic.png' }));

    expect(instances).toHaveLength(1);
    expect(instances[0].src).toBe('D:/media/pic.png');
    instances[0].onload?.();

    await expect(promise).resolves.toBe(instances[0] as unknown as HTMLImageElement);
  });

  it('加载失败时拒绝并带资产名', async () => {
    const instances = stubImage();
    const promise = loadImage(makeAsset({ name: 'broken.png' }));

    instances[0].onerror?.();

    await expect(promise).rejects.toThrow('无法加载图片 broken.png');
  });
});

describe('loadThumbnail', () => {
  it('无缩略图时直接解析为 undefined', async () => {
    await expect(loadThumbnail(makeAsset())).resolves.toBeUndefined();
  });

  it('缩略图加载成功时解析为图片元素', async () => {
    const instances = stubImage();
    const promise = loadThumbnail(makeAsset({ thumbnail: 'data:image/png;base64,xxx' }));

    expect(instances[0].src).toBe('data:image/png;base64,xxx');
    instances[0].onload?.();

    await expect(promise).resolves.toBe(instances[0] as unknown as HTMLImageElement);
  });

  it('缩略图加载失败时解析为 undefined', async () => {
    const instances = stubImage();
    const promise = loadThumbnail(makeAsset({ thumbnail: 'data:image/png;base64,bad' }));

    instances[0].onerror?.();

    await expect(promise).resolves.toBeUndefined();
  });
});
