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
    expect(getTimelineLargeProjectMode({ clipCount: 201 })).toEqual({
      enabled: true,
      disableAnimations: true,
      virtualOverscanScreens: 0.5,
      waveformResolutionScale: 0.5,
      previewFrameStep: 2,
      minimapClipLimit: 160
    });
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
});
