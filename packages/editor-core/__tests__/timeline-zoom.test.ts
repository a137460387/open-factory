import { describe, expect, it } from 'vitest';
import {
  BASE_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  calculateAnchoredScrollLeft,
  clampTimelineZoom,
  ensurePlayheadVisible,
  fitTimelineZoomToWindow,
  zoomTimelineByWheel
} from '../src';

describe('timeline zoom calculations', () => {
  it('zooms in and out by a configurable wheel step', () => {
    expect(zoomTimelineByWheel(BASE_TIMELINE_ZOOM, -1, 1.25)).toBe(100);
    expect(zoomTimelineByWheel(BASE_TIMELINE_ZOOM, 1, 1.25)).toBe(64);
    expect(zoomTimelineByWheel(BASE_TIMELINE_ZOOM, 0, 1.25)).toBe(BASE_TIMELINE_ZOOM);
    expect(zoomTimelineByWheel(BASE_TIMELINE_ZOOM, -1, 0)).toBeCloseTo(BASE_TIMELINE_ZOOM * 1.2);
  });

  it('clamps zoom to the 0.1x to 20x range', () => {
    expect(clampTimelineZoom(0)).toBe(MIN_TIMELINE_ZOOM);
    expect(clampTimelineZoom(Number.POSITIVE_INFINITY)).toBe(BASE_TIMELINE_ZOOM);
    expect(clampTimelineZoom(10_000)).toBe(MAX_TIMELINE_ZOOM);
  });

  it('keeps the mouse anchor over the same timeline time after zoom', () => {
    const nextScrollLeft = calculateAnchoredScrollLeft({
      scrollLeft: 200,
      anchorViewportX: 300,
      oldZoom: 80,
      newZoom: 160,
      labelWidth: 138
    });

    expect(nextScrollLeft).toBe(562);
  });

  it('adjusts scroll when the playhead would leave the visible viewport', () => {
    expect(
      ensurePlayheadVisible({
        scrollLeft: 0,
        viewportWidth: 500,
        playheadTime: 8,
        zoom: 80,
        labelWidth: 138
      })
    ).toBe(318);
    expect(
      ensurePlayheadVisible({
        scrollLeft: 300,
        viewportWidth: 500,
        playheadTime: 1,
        zoom: 80,
        labelWidth: 138
      })
    ).toBe(40);
    expect(
      ensurePlayheadVisible({
        scrollLeft: 100,
        viewportWidth: 500,
        playheadTime: 4,
        zoom: 80,
        labelWidth: 138
      })
    ).toBe(100);
  });

  it('fits timeline duration to the available viewport width', () => {
    expect(fitTimelineZoomToWindow(10, 938, 138)).toBe(80);
    expect(fitTimelineZoomToWindow(0, 100, 138)).toBe(MIN_TIMELINE_ZOOM);
  });
});
