// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSafeTimeout } from './useSafeTimeout';

describe('useSafeTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('返回一个函数', () => {
    const { result } = renderHook(() => useSafeTimeout());
    expect(typeof result.current).toBe('function');
  });

  it('延迟后执行回调', () => {
    const { result } = renderHook(() => useSafeTimeout());
    const fn = vi.fn();

    act(() => {
      result.current(fn, 100);
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('卸载时清理所有定时器', () => {
    const { result, unmount } = renderHook(() => useSafeTimeout());
    const fn = vi.fn();

    act(() => {
      result.current(fn, 100);
      result.current(fn, 200);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('返回定时器 ID', () => {
    const { result } = renderHook(() => useSafeTimeout());
    let id: ReturnType<typeof setTimeout>;

    act(() => {
      id = result.current(() => {}, 100);
    });

    expect(id!).toBeDefined();
  });
});
