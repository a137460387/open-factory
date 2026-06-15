import { describe, expect, it } from 'vitest';
import {
  buildTimelineGridLines,
  findTimelineGridSnapTarget,
  findTimelineSnapTargetWithGrid,
  getTimelineGridIntervalSeconds,
  normalizeTimelineGridSettings,
  normalizeTimelineGridUnit,
  snapTimelineTimeToGrid
} from '../src';

describe('timeline grid snapping', () => {
  it('returns grid intervals for all fixed units', () => {
    expect(getTimelineGridIntervalSeconds('frame', 24)).toBeCloseTo(1 / 24);
    expect(getTimelineGridIntervalSeconds('5-frames', 25)).toBeCloseTo(0.2);
    expect(getTimelineGridIntervalSeconds('10-frames', 20)).toBeCloseTo(0.5);
    expect(getTimelineGridIntervalSeconds('second', 0)).toBe(1);
    expect(getTimelineGridIntervalSeconds('5-seconds', 30)).toBe(5);
    expect(getTimelineGridIntervalSeconds('measure', 30)).toBeUndefined();
  });

  it('normalizes every valid grid unit and falls back for invalid values', () => {
    expect(normalizeTimelineGridUnit('frame')).toBe('frame');
    expect(normalizeTimelineGridUnit('5-frames')).toBe('5-frames');
    expect(normalizeTimelineGridUnit('10-frames')).toBe('10-frames');
    expect(normalizeTimelineGridUnit('second')).toBe('second');
    expect(normalizeTimelineGridUnit('5-seconds')).toBe('5-seconds');
    expect(normalizeTimelineGridUnit('measure')).toBe('measure');
    expect(normalizeTimelineGridUnit('bar')).toBe('frame');
  });

  it('returns no grid lines for invalid view ranges', () => {
    const base = {
      unit: 'second' as const,
      fps: 30,
      duration: 10,
      visibleStart: 0,
      visibleEnd: 5,
      zoom: 100,
      viewportWidth: 400
    };

    expect(buildTimelineGridLines({ ...base, duration: 0 })).toEqual([]);
    expect(buildTimelineGridLines({ ...base, zoom: 0 })).toEqual([]);
    expect(buildTimelineGridLines({ ...base, viewportWidth: 0 })).toEqual([]);
    expect(buildTimelineGridLines({ ...base, visibleStart: 6, visibleEnd: 5 })).toEqual([]);
  });

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

  it('builds dense-filtered measure lines from sorted non-negative beats', () => {
    expect(
      buildTimelineGridLines({
        unit: 'measure',
        fps: 30,
        duration: 12,
        visibleStart: 0.5,
        visibleEnd: 8,
        zoom: 2,
        viewportWidth: 800,
        minPixelSpacing: 6,
        beatTimes: [4, 0, 3, 2, 1, -1, Number.NaN, 8, 7, 6, 5]
      }).map((line) => line.time)
    ).toEqual([4, 8]);
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

  it('snaps by end edge and ignores candidates outside the threshold', () => {
    expect(
      findTimelineGridSnapTarget({
        clipStart: 1.26,
        clipDuration: 0.72,
        unit: 'second',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8,
        edges: ['end']
      })
    ).toMatchObject({
      edge: 'end',
      candidate: { time: 2, kind: 'grid' },
      snappedStart: 1.28
    });

    expect(
      findTimelineGridSnapTarget({
        clipStart: 1.2,
        clipDuration: 1,
        unit: 'second',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8,
        edges: ['start']
      })
    ).toBeNull();
  });

  it('returns no clip snap when disabled or when geometry is invalid', () => {
    const base = {
      clipStart: 1.97,
      clipDuration: 1,
      unit: 'second' as const,
      fps: 30,
      pixelsPerSecond: 100
    };
    expect(findTimelineGridSnapTarget({ ...base, disabled: true })).toBeNull();
    expect(findTimelineGridSnapTarget({ ...base, pixelsPerSecond: 0 })).toBeNull();
    expect(findTimelineGridSnapTarget({ ...base, clipDuration: 0 })).toBeNull();
  });

  it('snaps clips and standalone times to measure grid points', () => {
    expect(
      findTimelineGridSnapTarget({
        clipStart: 3.96,
        clipDuration: 1,
        unit: 'measure',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8,
        edges: ['start'],
        beatTimes: [0, 1, 2, 3, 4, 5, 6, 7]
      })
    ).toMatchObject({
      candidate: { time: 4, kind: 'grid' },
      snappedStart: 4
    });

    expect(
      snapTimelineTimeToGrid({
        time: 4.04,
        unit: 'measure',
        fps: 30,
        pixelsPerSecond: 100,
        thresholdPx: 8,
        beatTimes: [0, 1, 2, 3, 4, 5, 6, 7]
      })
    ).toBe(4);
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

  it('keeps standalone times unchanged when disabled or no grid candidate is available', () => {
    expect(
      snapTimelineTimeToGrid({
        time: 2.0444444,
        unit: 'second',
        fps: 30,
        pixelsPerSecond: 100,
        disabled: true
      })
    ).toBe(2.044444);
    expect(
      snapTimelineTimeToGrid({
        time: 2.04,
        unit: 'measure',
        fps: 30,
        pixelsPerSecond: 100
      })
    ).toBe(2.04);
  });

  it('uses grid snapping only when enabled and no higher-priority target exists', () => {
    expect(
      findTimelineSnapTargetWithGrid({
        clipStart: 1.97,
        clipDuration: 1,
        candidates: [],
        pixelsPerSecond: 100,
        thresholdPx: 8,
        edges: ['start'],
        grid: { enabled: true, unit: 'second', fps: 30 }
      })
    ).toMatchObject({
      candidate: { time: 2, kind: 'grid' },
      snappedStart: 2
    });

    expect(
      findTimelineSnapTargetWithGrid({
        clipStart: 1.97,
        clipDuration: 1,
        candidates: [],
        pixelsPerSecond: 100,
        thresholdPx: 8,
        edges: ['start'],
        grid: { enabled: false, unit: 'second', fps: 30 }
      })
    ).toBeNull();
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
