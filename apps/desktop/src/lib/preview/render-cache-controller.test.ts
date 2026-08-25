// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/render-cache-controller.ts
// 覆盖目标：TimelineRenderCacheController 全路径——
//          本地缓存路径（Worker 不可用回退）+ Worker 消息路径（get/put/retain/invalidate/clear + 消息回传）
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 默认 jsdom 无 Worker 实现：getWorker() 构造失败后置 workerUnavailable，走本地缓存路径；
// Worker describe 内用 FakeWorker stub 覆盖消息路径

interface FakeBitmap {
  closed: boolean;
  close(): void;
}

function makeBitmap(): FakeBitmap {
  return {
    closed: false,
    close() {
      this.closed = true;
    },
  };
}

let createImageBitmapMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  createImageBitmapMock = vi.fn(async (bitmap: FakeBitmap) => ({ source: bitmap }));
  vi.stubGlobal('createImageBitmap', createImageBitmapMock);
});

async function loadController() {
  const { getTimelineRenderCacheController } = await import('./render-cache-controller');
  const { useRenderCacheStore } = await import('../../store/renderCacheStore');
  return { controller: getTimelineRenderCacheController(), useRenderCacheStore };
}

describe('TimelineRenderCacheController 本地缓存路径', () => {
  it('putFrame 更新 store 快照（数量/字节/范围）', async () => {
    const { controller, useRenderCacheStore } = await loadController();

    controller.putFrame({
      key: 'frame-1',
      bitmap: makeBitmap() as unknown as ImageBitmap,
      time: 1,
      duration: 0.5,
      bytes: 100,
      playheadTime: 1,
    });

    const state = useRenderCacheStore.getState();
    expect(state.count).toBe(1);
    expect(state.bytes).toBe(100);
    expect(state.ranges).toEqual([{ start: 1, end: 1.5 }]);
  });

  it('getFrame 命中时经 createImageBitmap 返回副本，未命中返回 undefined', async () => {
    const { controller } = await loadController();
    const bitmap = makeBitmap();

    controller.putFrame({
      key: 'frame-1',
      bitmap: bitmap as unknown as ImageBitmap,
      time: 0,
      duration: 1,
      bytes: 10,
      playheadTime: 0,
    });

    const hit = await controller.getFrame('frame-1');
    expect(hit).toEqual({ source: bitmap });
    expect(createImageBitmapMock).toHaveBeenCalledWith(bitmap);

    const miss = await controller.getFrame('frame-missing');
    expect(miss).toBeUndefined();
  });

  it('retainAround 清理窗口外帧并关闭其 bitmap', async () => {
    const { controller, useRenderCacheStore } = await loadController();
    const near = makeBitmap();
    const far = makeBitmap();

    controller.putFrame({
      key: 'near',
      bitmap: near as unknown as ImageBitmap,
      time: 10,
      duration: 1,
      bytes: 10,
      playheadTime: 10,
    });
    controller.putFrame({
      key: 'far',
      bitmap: far as unknown as ImageBitmap,
      time: 100,
      duration: 1,
      bytes: 10,
      playheadTime: 10,
    });

    controller.retainAround(10);

    expect(useRenderCacheStore.getState().count).toBe(1);
    expect(useRenderCacheStore.getState().ranges).toEqual([{ start: 10, end: 11 }]);
    expect(near.closed).toBe(false);
    expect(far.closed).toBe(true);
  });

  it('invalidateRanges 空数组早退不更新快照', async () => {
    const { controller, useRenderCacheStore } = await loadController();

    controller.putFrame({
      key: 'frame-1',
      bitmap: makeBitmap() as unknown as ImageBitmap,
      time: 2,
      duration: 1,
      bytes: 10,
      playheadTime: 2,
    });
    const before = useRenderCacheStore.getState().count;

    controller.invalidateRanges([]);

    expect(useRenderCacheStore.getState().count).toBe(before);
  });

  it('invalidateRanges 清理与范围相交的帧', async () => {
    const { controller, useRenderCacheStore } = await loadController();
    const inside = makeBitmap();
    const outside = makeBitmap();

    // 两帧都在 retainAround(8) 的 [0,18] 窗口内，确保不被 putFrame 附带的保留清理干扰
    controller.putFrame({
      key: 'inside',
      bitmap: inside as unknown as ImageBitmap,
      time: 5,
      duration: 1,
      bytes: 10,
      playheadTime: 8,
    });
    controller.putFrame({
      key: 'outside',
      bitmap: outside as unknown as ImageBitmap,
      time: 12,
      duration: 1,
      bytes: 10,
      playheadTime: 8,
    });

    controller.invalidateRanges([{ start: 4, end: 7 }]);

    expect(useRenderCacheStore.getState().count).toBe(1);
    expect(useRenderCacheStore.getState().ranges).toEqual([{ start: 12, end: 13 }]);
    expect(inside.closed).toBe(true);
    expect(outside.closed).toBe(false);
  });

  it('clear 清空缓存并关闭全部 bitmap', async () => {
    const { controller, useRenderCacheStore } = await loadController();
    const first = makeBitmap();
    const second = makeBitmap();

    controller.putFrame({
      key: 'a',
      bitmap: first as unknown as ImageBitmap,
      time: 0,
      duration: 1,
      bytes: 10,
      playheadTime: 0,
    });
    controller.putFrame({
      key: 'b',
      bitmap: second as unknown as ImageBitmap,
      time: 2,
      duration: 1,
      bytes: 10,
      playheadTime: 2,
    });

    controller.clear();

    const state = useRenderCacheStore.getState();
    expect(state.count).toBe(0);
    expect(state.bytes).toBe(0);
    expect(state.ranges).toEqual([]);
    expect(first.closed).toBe(true);
    expect(second.closed).toBe(true);
  });

  it('getTimelineRenderCacheController 在同一模块图内返回单例', async () => {
    const { getTimelineRenderCacheController } = await import('./render-cache-controller');

    expect(getTimelineRenderCacheController()).toBe(getTimelineRenderCacheController());
  });
});

/** 可控 FakeWorker：捕获 postMessage 并允许手动派发 onmessage/onerror */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  postMessages: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.postMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  lastPostMessage(): Record<string, unknown> {
    return this.postMessages.at(-1) as Record<string, unknown>;
  }
}

describe('TimelineRenderCacheController Worker 消息路径', () => {
  let worker: FakeWorker;

  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  async function loadControllerWithWorker() {
    const loaded = await loadController();
    // 触发 getWorker 构造：warmup get 请求立即以 miss 回复闭环，并清空消息基准
    const warmup = loaded.controller.getFrame('__warmup__');
    worker = FakeWorker.instances.at(-1) as FakeWorker;
    const warmupRequestId = worker.lastPostMessage().requestId as string;
    worker.onmessage?.({ data: { type: 'frame', requestId: warmupRequestId, hit: false, bitmap: undefined } });
    await warmup;
    worker.postMessages.length = 0;
    return loaded;
  }

  it('getFrame 经 Worker 发送 get 消息并按 frame 回复解析', async () => {
    const { controller } = await loadControllerWithWorker();
    const bitmap = makeBitmap();
    const pending = controller.getFrame('frame-1');

    expect(worker.lastPostMessage()).toMatchObject({ type: 'get', key: 'frame-1' });
    const requestId = worker.lastPostMessage().requestId as string;
    worker.onmessage?.({
      data: { type: 'frame', requestId, hit: true, bitmap },
    });

    await expect(pending).resolves.toBe(bitmap);
  });

  it('getFrame 未命中时解析为 undefined', async () => {
    const { controller } = await loadControllerWithWorker();
    const pending = controller.getFrame('frame-miss');

    const requestId = worker.lastPostMessage().requestId as string;
    worker.onmessage?.({ data: { type: 'frame', requestId, hit: false, bitmap: undefined } });

    await expect(pending).resolves.toBeUndefined();
  });

  it('未知 requestId 的 frame 回复关闭位图', async () => {
    const { controller } = await loadControllerWithWorker();
    const bitmap = makeBitmap();

    worker.onmessage?.({ data: { type: 'frame', requestId: 'render-cache-unknown', hit: true, bitmap } });

    expect(bitmap.closed).toBe(true);
    void controller;
  });

  it('putFrame / retainAround / invalidateRanges / clear 均转发 Worker 消息', async () => {
    const { controller } = await loadControllerWithWorker();
    const bitmap = makeBitmap();

    controller.putFrame({
      key: 'frame-1',
      bitmap: bitmap as unknown as ImageBitmap,
      time: 1,
      duration: 1,
      bytes: 10,
      playheadTime: 1,
    });
    expect(worker.lastPostMessage()).toMatchObject({ type: 'put', key: 'frame-1' });

    controller.retainAround(5);
    expect(worker.lastPostMessage()).toMatchObject({ type: 'retain-around', playheadTime: 5 });

    controller.invalidateRanges([{ start: 0, end: 1 }]);
    expect(worker.lastPostMessage()).toMatchObject({ type: 'invalidate-ranges', ranges: [{ start: 0, end: 1 }] });

    controller.clear();
    expect(worker.lastPostMessage()).toMatchObject({ type: 'clear' });
  });

  it('snapshot 回复更新 store 快照', async () => {
    const { controller, useRenderCacheStore } = await loadControllerWithWorker();

    worker.onmessage?.({
      data: { type: 'snapshot', snapshot: { ranges: [{ start: 0, end: 2 }], bytes: 42, count: 1 } },
    });

    expect(useRenderCacheStore.getState()).toMatchObject({ count: 1, bytes: 42 });
    void controller;
  });

  it('错误回复拒绝挂起的 getFrame 请求', async () => {
    const { controller } = await loadControllerWithWorker();
    const pending = controller.getFrame('frame-1');
    const requestId = worker.lastPostMessage().requestId as string;

    worker.onmessage?.({ data: { type: 'error', requestId, message: 'worker boom' } });

    await expect(pending).rejects.toThrow('worker boom');
  });

  it('Worker onerror 终止实例并拒绝全部挂起请求', async () => {
    const { controller } = await loadControllerWithWorker();
    const first = controller.getFrame('frame-1');
    const second = controller.getFrame('frame-2');

    worker.onerror?.({ message: 'worker crashed' });

    await expect(first).rejects.toThrow('worker crashed');
    await expect(second).rejects.toThrow('worker crashed');
    expect(worker.terminated).toBe(true);
  });
});
