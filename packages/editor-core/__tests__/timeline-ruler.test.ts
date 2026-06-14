import { describe, expect, it } from 'vitest';
import { buildTimelineRulerTicks, calculateTimelineRulerScale, formatTimelineRulerTickLabel } from '../src';

describe('timeline ruler scale', () => {
  it('keeps tick spacing readable across zoom levels', () => {
    expect(calculateTimelineRulerScale({ zoom: 8, viewportWidth: 800, fps: 30 })).toMatchObject({
      unit: 'seconds',
      stepSeconds: 10,
      tickSpacingPx: 80
    });

    expect(calculateTimelineRulerScale({ zoom: 240, viewportWidth: 800, fps: 30 })).toMatchObject({
      unit: 'ten-frames',
      stepFrames: 10,
      tickSpacingPx: 80
    });

    expect(calculateTimelineRulerScale({ zoom: 2400, viewportWidth: 800, fps: 30 })).toMatchObject({
      unit: 'frame',
      stepFrames: 1,
      tickSpacingPx: 80
    });
  });

  it('falls back to minute ticks when zoom is too low for readable seconds', () => {
    expect(calculateTimelineRulerScale({ zoom: 0.05, viewportWidth: 800, fps: 30 })).toMatchObject({
      unit: 'minutes',
      stepSeconds: 600,
      tickSpacingPx: 30
    });
  });

  it('normalizes invalid duration and viewport inputs without emitting ticks', () => {
    expect(buildTimelineRulerTicks({ duration: Number.NaN, zoom: Number.NaN, viewportWidth: 0, fps: 30 })).toEqual([]);
    expect(calculateTimelineRulerScale({ zoom: 0, viewportWidth: 0, fps: 30, minTickSpacingPx: Number.NaN })).toMatchObject({
      unit: 'minutes',
      stepSeconds: 120,
      tickSpacingPx: 120
    });
  });

  it('marks second ticks as major only on ten-second boundaries', () => {
    const ticks = buildTimelineRulerTicks({
      duration: 12,
      zoom: 80,
      viewportWidth: 800,
      fps: 30
    });

    expect(ticks.find((tick) => tick.time === 10)?.major).toBe(true);
    expect(ticks.find((tick) => tick.time === 5)?.major).toBe(false);
  });

  it('formats frame and ten-frame tick labels as frame counts', () => {
    expect(formatTimelineRulerTickLabel(10 / 30, 'ten-frames', 30, 'ndf')).toBe('10f');
    expect(formatTimelineRulerTickLabel(1 / 24, 'frame', 24, 'ndf')).toBe('1f');
  });

  it('builds only visible ticks with frame labels at high zoom', () => {
    const ticks = buildTimelineRulerTicks({
      duration: 60,
      visibleStart: 10,
      visibleEnd: 11,
      zoom: 2400,
      viewportWidth: 800,
      fps: 30
    });

    expect(ticks[0].label.endsWith('f')).toBe(true);
    expect(ticks.every((tick) => tick.time >= 9.9 && tick.time <= 11.1)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(40);
  });

  it('formats current timecode as HH:MM:SS:FF', () => {
    expect(formatTimelineRulerTickLabel(3661 + 5 / 30, 'seconds', 30, 'ndf')).toBe('01:01:01:05');
  });
});
