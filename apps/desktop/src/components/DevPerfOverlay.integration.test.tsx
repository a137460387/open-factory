// @vitest-environment jsdom
/**
 * 集成回归测试（issue #114）：不 mock usePerfMonitor / trackRender，
 * 走真实的"渲染计数 → 通知订阅者"回路。
 *
 * 背景：DevPerfOverlay.test.tsx 把 usePerfMonitor 整体 mock 掉，
 * 无法覆盖"trackRender 同步通知订阅者 → 订阅者重渲染 → 再次 trackRender"
 * 这条真实闭环路径（dev/e2e 下曾导致主线程无限渲染循环，全部 e2e spec 系统性超时）。
 *
 * 用例 1（机制级，毫秒级完成）：断言 trackRender 不同步触发订阅者重渲染——
 *   这是闭环被切断的直接契约，修复前会立即失败且不会挂死。
 * 用例 2（组件级）：挂载真实 DevPerfOverlay，断言渲染次数随时间收敛——
 *   健康节奏由 500ms FPS 心跳驱动（每秒约 2 次重渲染）；
 *   若闭环回归，计数会爆炸（此用例在 bug 代码上会挂起而非快速失败，
 *   由用例 1 作为快速防线）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.stubGlobal('__DEV_PERF_MONITOR__', true);

import { render, cleanup, act } from '@testing-library/react';
import { DevPerfOverlay } from './DevPerfOverlay';
import { getRenderCounts, resetRenderCounts, trackRender, usePerfMonitor } from '../hooks/usePerfMonitor';

afterEach(() => {
  cleanup();
  resetRenderCounts();
});

/** 最小订阅者探针：真实使用 usePerfMonitor，记录自身渲染次数，不调用 trackRender（无自反馈）。 */
function RenderProbe({ counter }: { counter: { current: number } }) {
  usePerfMonitor();
  counter.current += 1;
  return null;
}

describe('DevPerfOverlay render-loop regression (#114)', () => {
  it('trackRender 不同步触发订阅者重渲染（闭环切断契约）', () => {
    const counter = { current: 0 };
    render(<RenderProbe counter={counter} />);
    const afterMount = counter.current;
    expect(afterMount).toBeGreaterThan(0);

    // 修复前：trackRender 同步 notifyRenderListeners → 订阅者在 act 内立即重渲染；
    // 修复后：计数只入脏标记，由 FPS 心跳统一 flush，此处不应触发任何重渲染。
    act(() => {
      trackRender('SomeInstrumentedComponent');
    });
    expect(counter.current).toBe(afterMount);

    // 计数本身仍然生效（数据不丢，只是通知被延迟）
    expect(getRenderCounts().get('SomeInstrumentedComponent')).toBe(1);
  });

  it('挂载后渲染次数收敛，不产生无限自触发重渲染', async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    try {
      render(<DevPerfOverlay />);

      // 让 500ms FPS 心跳跑几轮。若存在渲染闭环，此处计数会冲到数千以上，
      // 或 render() 阶段直接抛 Maximum update depth exceeded。
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1600));
      });
      const mid = getRenderCounts().get('DevPerfOverlay') ?? 0;

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });
      const late = getRenderCounts().get('DevPerfOverlay') ?? 0;

      // 健康上限：心跳每 500ms 一轮，1.6s 内应只有个位数次渲染（放宽到 30）
      expect(mid).toBeLessThan(30);
      // 后续窗口增量同样收敛（1.1s 内放宽到 15）
      expect(late - mid).toBeLessThan(15);
      // 不允许出现 React 渲染循环类错误/警告
      const loopErrors = errors.filter((message) => /Maximum update depth|Cannot update a component/i.test(message));
      expect(loopErrors).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
