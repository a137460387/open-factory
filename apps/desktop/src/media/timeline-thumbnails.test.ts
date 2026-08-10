// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVideo } from './timeline-thumbnails';

/**
 * getVideo 缓存语义回归测试（cover-frames:4 根因）。
 *
 * 根因：getVideo 曾在 `await once(video,'loadedmetadata')` 之前就把裸 video
 * 元素写入缓存。一旦加载失败（媒体不可播放），坏 video 滞留缓存，后续调用
 * 直接拿到它在 seekVideo 等待永不触发的 'seeked' 而永久挂起，占满
 * uiFeedbackPool 并饿死同池任务（封面帧提取等）。
 *
 * 修复后语义：缓存的是"加载 Promise"；加载失败即清缓存并 reject，绝不挂起。
 */
describe('getVideo load caching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockVideoCreation() {
    const created: EventTarget[] = [];
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      expect(tag).toBe('video');
      const el = new EventTarget();
      created.push(el);
      return el;
    }) as typeof document.createElement);
    return created;
  }

  it('rejects without hanging when the video fails to load, and caches the failure (no retry storm)', async () => {
    const created = mockVideoCreation();
    const path = 'media://unit-test-failing-video';

    const first = getVideo(path);
    expect(created).toHaveLength(1);

    // 模拟媒体加载失败：触发 error 事件（等价于 e2e 中不可播放的 mock 媒体）
    created[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow();

    // 失败结果同样缓存：再次调用复用同一被拒 Promise——不创建新 video、不挂起、
    // 不对不可播放媒体反复重试（避免刷加载错误）。这正是 cover-frames:4 根因修复语义。
    const second = getVideo(path);
    expect(created).toHaveLength(1);
    await expect(second).rejects.toThrow();
  });

  it('caches a successful load so concurrent callers share one video', async () => {
    const created = mockVideoCreation();
    const path = 'media://unit-test-ok-video';

    const a = getVideo(path);
    const b = getVideo(path);
    expect(created).toHaveLength(1); // 并发调用共享同一次加载，不重复创建

    created[0].dispatchEvent(new Event('loadedmetadata'));
    await expect(a).resolves.toBe(created[0]);
    await expect(b).resolves.toBe(created[0]);
  });
});
