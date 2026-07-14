import { describe, expect, it } from 'vitest';
import {
  filterTimelineVirtualClips,
  filterTimelineVirtualTracks,
  getTimelineIncrementalRenderPlan,
  getTimelineLargeProjectMode,
  getTimelineVirtualRenderWindow,
  getTimelineVirtualTrackWindow,
  shouldLoadTimelineClipAssets
} from '../src';

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

  it('virtualizes complete timeline rows with before and after spacer heights', () => {
    const tracks = Array.from({ length: 24 }, (_, index) => ({ id: `track-${index}` }));
    const window = getTimelineVirtualTrackWindow({ scrollTop: 270, viewportHeight: 162, rowHeight: 54, trackCount: tracks.length, overscanRows: 1 });

    expect(window).toEqual({
      startIndex: 4,
      endIndex: 9,
      beforeHeight: 216,
      afterHeight: 810,
      totalHeight: 1296,
      renderedCount: 5
    });
    expect(filterTimelineVirtualTracks(tracks, window).map((track) => track.id)).toEqual(['track-4', 'track-5', 'track-6', 'track-7', 'track-8']);
  });

  it('plans incremental clip renders only for changed clip references', () => {
    const clipA = { id: 'a', start: 0, duration: 1 };
    const clipB = { id: 'b', start: 1, duration: 1 };
    const clipC = { id: 'c', start: 2, duration: 1 };
    const nextClipB = { ...clipB, start: 1.5 };

    expect(getTimelineIncrementalRenderPlan([clipA, clipB, clipC], [clipA, nextClipB, clipC]).changedClipIds).toEqual(['b']);
  });

  it('preloads waveform and thumbnail assets only within the 100px viewport threshold', () => {
    expect(
      shouldLoadTimelineClipAssets({
        clipStart: 16,
        clipDuration: 2,
        zoom: 10,
        scrollLeft: 0,
        viewportWidth: 60,
        preloadPx: 100
      })
    ).toBe(true);
    expect(
      shouldLoadTimelineClipAssets({
        clipStart: 16.1,
        clipDuration: 2,
        zoom: 10,
        scrollLeft: 0,
        viewportWidth: 60,
        preloadPx: 100
      })
    ).toBe(false);
  });

  it('enables large project mode after the clip threshold', () => {
    expect(getTimelineLargeProjectMode({ clipCount: 200 }).enabled).toBe(false);
    const mode = getTimelineLargeProjectMode({ clipCount: 201 });
    expect(mode.enabled).toBe(true);
    expect(mode.disableAnimations).toBe(true);
    expect(mode.virtualOverscanScreens).toBe(0.5);
    expect(mode.waveformResolutionScale).toBe(0.5);
    expect(mode.previewFrameStep).toBe(2);
    expect(mode.minimapClipLimit).toBe(160);
    expect(mode.extremeMode).toBe(false);
    expect(mode.thumbnailLoadDelayMs).toBe(1200);
    expect(mode.waveformSampleDensity).toBe(0.6);
  });

  it('enables extreme mode for very large projects (1000+ clips)', () => {
    const mode = getTimelineLargeProjectMode({ clipCount: 1500 });
    expect(mode.enabled).toBe(true);
    expect(mode.extremeMode).toBe(true);
    expect(mode.virtualOverscanScreens).toBe(0.25);
    expect(mode.waveformResolutionScale).toBe(0.25);
    expect(mode.previewFrameStep).toBe(4);
    expect(mode.minimapClipLimit).toBe(80);
    expect(mode.thumbnailLoadDelayMs).toBe(2400);
    expect(mode.waveformSampleDensity).toBe(0.3);
  });

  it('uses tighter horizontal overscan for large project mode', () => {
    const largeProjectMode = getTimelineLargeProjectMode({ clipCount: 500 });
    const window = getTimelineVirtualRenderWindow({
      scrollLeft: 138,
      viewportWidth: 960,
      zoom: 80,
      labelWidth: 138,
      overscanScreens: largeProjectMode.virtualOverscanScreens
    });

    expect(window.end).toBe(18);
  });

  it('efficiently filters clips using binary search for large arrays', () => {
    // 创建一个包含 100 个片段的大数组，按 start 升序排列
    const clips = Array.from({ length: 100 }, (_, i) => ({
      id: `clip-${i}`,
      start: i * 10,
      duration: 5
    }));
    const window = { start: 250, end: 750 };
    const result = filterTimelineVirtualClips(clips, window);
    // 验证结果正确性：所有返回的片段都与窗口有交集
    for (const clip of result) {
      expect(clip.start).toBeLessThan(window.end);
      expect(clip.start + clip.duration).toBeGreaterThan(window.start);
    }
    // 验证不会遗漏：检查窗口外的片段确实不在结果中
    expect(result.some((c) => c.id === 'clip-0')).toBe(false);
    expect(result.some((c) => c.id === 'clip-99')).toBe(false);
    // 验证窗口内的片段被包含
    expect(result.some((c) => c.id === 'clip-30')).toBe(true);
    expect(result.some((c) => c.id === 'clip-70')).toBe(true);
  });
});
