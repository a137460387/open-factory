import { describe, expect, it } from 'vitest';
import { filterTimelineVirtualClips, getTimelineVirtualRenderWindow } from '../src';

describe('timeline virtualization', () => {
  it('returns the overscanned time window for a horizontal viewport', () => {
    expect(getTimelineVirtualRenderWindow({ scrollLeft: 438, viewportWidth: 100, zoom: 10, labelWidth: 138 })).toEqual({
      start: 10,
      end: 60
    });
  });

  it('filters clips to the visible range plus overscan', () => {
    const clips = [
      { id: 'before', start: 1, duration: 2 },
      { id: 'left-edge', start: 9, duration: 2 },
      { id: 'inside', start: 30, duration: 5 },
      { id: 'right-edge', start: 59, duration: 2 },
      { id: 'after', start: 62, duration: 2 }
    ];

    expect(filterTimelineVirtualClips(clips, { start: 10, end: 60 }).map((clip) => clip.id)).toEqual(['left-edge', 'inside', 'right-edge']);
  });

  it('keeps the virtual window finite for invalid zoom and viewport input', () => {
    const window = getTimelineVirtualRenderWindow({ scrollLeft: -100, viewportWidth: 0, zoom: 0, labelWidth: 138 });
    expect(window.start).toBe(0);
    expect(Number.isFinite(window.end)).toBe(true);
    expect(window.end).toBeGreaterThan(0);
  });
});
