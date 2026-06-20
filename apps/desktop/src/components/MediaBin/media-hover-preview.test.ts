import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { computeMediaPreviewDelay, isMediaPreviewable, type MediaPreviewInput } from './media-hover-preview';

describe('media hover preview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays preview activation by 500ms', () => {
    const onActivate = vi.fn();
    const { schedule, cancel } = computeMediaPreviewDelay(500);
    const timerId = schedule(onActivate);
    expect(onActivate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(onActivate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onActivate).toHaveBeenCalledTimes(1);
    cancel(timerId);
  });

  it('cancels pending preview on mouse leave', () => {
    const onActivate = vi.fn();
    const { schedule, cancel } = computeMediaPreviewDelay(500);
    const timerId = schedule(onActivate);
    vi.advanceTimersByTime(200);
    cancel(timerId);
    vi.advanceTimersByTime(500);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('identifies video and audio as previewable', () => {
    expect(isMediaPreviewable('video')).toBe(true);
    expect(isMediaPreviewable('audio')).toBe(true);
    expect(isMediaPreviewable('image')).toBe(false);
  });
});
