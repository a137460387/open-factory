import { describe, expect, it } from 'vitest';
import { buildTimelineGridLines, findTimelineGridSnapTarget, findTimelineSnapTargetWithGrid, normalizeTimelineGridSettings, snapTimelineTimeToGrid } from '../src';

describe('timeline grid snapping', () => {
  it('builds frame grid timestamps with adaptive density', () => {
    expect(
      buildTimelineGridLines({
        unit: 'frame',
        fps: 30,
        duration: 1,
        visibleStart: 0,
        visibleEnd: 0.2,
        zoom: 300,
        viewportWidth: 200,
        minPixelSpacing: 8
      }).map((line) => line.time)
    ).toEqual([0, 0.033333, 0.066667, 0.1, 0.133333, 0.166667, 0.2]);

    expect(
      buildTimelineGridLines({
        unit: 'frame',
        fps: 30,
        duration: 1,
        visibleStart: 0,
        visibleEnd: 0.2,
        zoom: 90,
        viewportWidth: 200,
        minPixelSpacing: 8
      }).map((line) => line.time)
    ).toEqual([0, 0.1, 0.2]);
  });

  it('builds second and measure grid timestamps', () => {
    expect(
      buildTimelineGridLines({
        unit: 'second',
        fps: 24,
        duration: 6,
        visibleStart: 1.2,
        visibleEnd: 4.4,
        zoom: 40,
        viewportWidth: 400
      }).map((line) => line.time)
    ).toEqual([2, 3, 4]);

    expect(
      buildTimelineGridLines({
        unit: 'measure',
        fps: 30,
        duration: 10,
        visibleStart: 0,
        visibleEnd: 10,
        zoom: 120,
        viewportWidth: 800,
        beatTimes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]
      }).map((line) => line.time)
    ).toEqual([0, 2, 4]);
  });

  it('snaps clip edges to the nearest enabled grid point', () => {
    const target = findTimelineGridSnapTarget({
      clipStart: 1.97,
      clipDuration: 1,
      unit: 'second',
      fps: 30,
      pixelsPerSecond: 100,
      thresholdPx: 8,
      edges: ['start']
    });

    expect(target).toMatchObject({
      edge: 'start',
      candidate: { time: 2, kind: 'grid' },
      snappedStart: 2
    });
  });

  it('snaps standalone timeline times to the nearest grid point', () => {
    expect(
      snapTimelineTimeToGrid({
        time: 2.04,
        unit: 'second',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8
      })
    ).toBe(2);
    expect(
      snapTimelineTimeToGrid({
        time: 2.12,
        unit: 'second',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8
      })
    ).toBe(2.12);
  });

  it('keeps grid snap lower priority than existing timeline snap candidates', () => {
    const target = findTimelineSnapTargetWithGrid({
      clipStart: 1.97,
      clipDuration: 1,
      candidates: [{ time: 2.04, kind: 'clip-start' }],
      pixelsPerSecond: 100,
      thresholdPx: 8,
      edges: ['start'],
      grid: { enabled: true, unit: 'second', fps: 30 }
    });

    expect(target).toMatchObject({
      candidate: { time: 2.04, kind: 'clip-start' },
      snappedStart: 2.04
    });
  });

  it('normalizes persisted timeline grid settings', () => {
    expect(normalizeTimelineGridSettings({ enabled: true, unit: '10-frames' })).toEqual({ enabled: true, unit: '10-frames' });
    expect(normalizeTimelineGridSettings({ enabled: true, unit: 'bad' })).toEqual({ enabled: true, unit: 'frame' });
    expect(normalizeTimelineGridSettings(undefined)).toEqual({ enabled: false, unit: 'frame' });
  });
});
