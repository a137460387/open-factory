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
