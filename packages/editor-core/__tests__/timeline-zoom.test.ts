import { describe, expect, it } from 'vitest';
import {
  BASE_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  calculateAnchoredScrollLeft,
  clampTimelineZoom,
  ensurePlayheadVisible,
  fitTimelineZoomToWindow,
  zoomTimelineByWheel,
  zoomTimelineByGesture,
  LONG_PRESS_PAN_THRESHOLD_MS
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

  it('defines a long-press pan threshold of 300ms', () => {
    expect(LONG_PRESS_PAN_THRESHOLD_MS).toBe(300);
  });

  it('zooms by Safari gesture scale factor', () => {
    expect(zoomTimelineByGesture(80, 1.5)).toBe(120);
    expect(zoomTimelineByGesture(80, 0.5)).toBe(40);
    expect(zoomTimelineByGesture(80, 0)).toBe(BASE_TIMELINE_ZOOM);
    expect(zoomTimelineByGesture(80, -1)).toBe(BASE_TIMELINE_ZOOM);
    expect(zoomTimelineByGesture(80, Number.NaN)).toBe(BASE_TIMELINE_ZOOM);
    expect(zoomTimelineByGesture(80, 100)).toBe(MAX_TIMELINE_ZOOM);
  });

  it('keeps the anchor viewport position stable when zooming via gesture', () => {
    const anchorViewportX = 400;
    const oldZoom = 80;
    const newZoom = zoomTimelineByGesture(oldZoom, 2);

    const nextScrollLeft = calculateAnchoredScrollLeft({
      scrollLeft: 200,
      anchorViewportX,
      oldZoom,
      newZoom,
      labelWidth: 138
    });

    const anchorTimelineX = 200 + anchorViewportX - 138;
    const anchorTime = anchorTimelineX / oldZoom;
    const expectedScrollLeft = 138 + anchorTime * newZoom - anchorViewportX;
    expect(nextScrollLeft).toBeCloseTo(expectedScrollLeft, 5);
  });
});
