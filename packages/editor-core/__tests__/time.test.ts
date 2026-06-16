import { describe, expect, it } from 'vitest';
import {
  clamp,
  frameNumberToTimecode,
  framesToSeconds,
  normalizeProjectFps,
  parseFrameJumpQuery,
  parseTimecodeToSeconds,
  round,
  secondsToFrames,
  secondsToTicks,
  secondsToTimecode,
  snap,
  ticksToSeconds,
  ticksToTimecode
} from '../src';

describe('time helpers', () => {
  it('clamps values and validates ranges', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(() => clamp(1, 2, 1)).toThrow(RangeError);
  });

  it('rounds, snaps, and converts frames', () => {
    expect(round(1.2345678, 3)).toBe(1.235);
    expect(snap(0.049, 1 / 30)).toBeCloseTo(1 / 30);
    expect(snap(1.2345678, 0)).toBe(1.234568);
    expect(secondsToFrames(1.5, 30)).toBe(45);
    expect(framesToSeconds(45, 30)).toBe(1.5);
    expect(() => secondsToFrames(1, 0)).toThrow(RangeError);
    expect(() => framesToSeconds(1, 0)).toThrow(RangeError);
  });

  it('normalizes supported project frame rates', () => {
    expect(normalizeProjectFps(23.98)).toBe(23.976);
    expect(normalizeProjectFps(59.9)).toBe(59.94);
    expect(normalizeProjectFps(undefined)).toBe(30);
  });

  it('formats non-drop-frame timecode from ticks across supported rates', () => {
    expect(secondsToTicks(1)).toBe(600);
    expect(secondsToTicks(Number.POSITIVE_INFINITY)).toBe(0);
    expect(ticksToSeconds(150)).toBe(0.25);
    expect(ticksToSeconds(Number.NaN)).toBe(0);
    expect(ticksToTimecode(600, 24, 'ndf')).toBe('00:00:01:00');
    expect(secondsToTimecode(Number.NaN, 30, 'ndf')).toBe('00:00:00:00');
    expect(secondsToTimecode(10, 25, 'ndf')).toBe('00:00:10:00');
    expect(secondsToTimecode(1, 23.976, 'ndf')).toBe('00:00:01:00');
    expect(secondsToTimecode(1, 59.94, 'ndf')).toBe('00:00:01:00');
  });

  it('formats drop-frame timecode by skipping labels at minute boundaries', () => {
    expect(secondsToTimecode(framesToSeconds(1800, 29.97), 29.97, 'df')).toBe('00:01:00:02');
    expect(secondsToTimecode(framesToSeconds(17982, 29.97), 29.97, 'df')).toBe('00:10:00:00');
    expect(secondsToTimecode(framesToSeconds(3600, 59.94), 59.94, 'df')).toBe('00:01:00:04');
    expect(secondsToTimecode(60, 24, 'df')).toBe('00:01:00:00');
  });

  it('parses frame-accurate timecode and validates boundaries', () => {
    expect(parseTimecodeToSeconds('00:00:02:12', { fps: 24 })).toEqual({
      ok: true,
      value: { seconds: 2.5, totalFrames: 60, hours: 0, minutes: 0, secondsPart: 2, frames: 12 }
    });
    expect(parseTimecodeToSeconds('00:00:01:29', { fps: 29.97 })).toMatchObject({ ok: true, value: { totalFrames: 59 } });
    expect(parseTimecodeToSeconds('00:00:01:30', { fps: 29.97 })).toEqual({ ok: false, error: 'frames' });
    expect(parseTimecodeToSeconds('00:00:60:00', { fps: 30 })).toEqual({ ok: false, error: 'seconds' });
    expect(parseTimecodeToSeconds('00:60:00:00', { fps: 30 })).toEqual({ ok: false, error: 'minutes' });
    expect(parseTimecodeToSeconds('0:00:00:00', { fps: 30 })).toEqual({ ok: false, error: 'format' });
    expect(parseTimecodeToSeconds('00:00:04:00', { fps: 30, duration: 3 })).toEqual({ ok: false, error: 'duration' });
    expect(parseTimecodeToSeconds('00:00:02:00', { fps: 30, duration: -1 })).toEqual({ ok: false, error: 'duration' });
    expect(parseTimecodeToSeconds('00:00:02:00', { fps: 30, duration: Number.NaN })).toMatchObject({ ok: true, value: { seconds: 2 } });
  });

  it('parses direct frame jump queries and rejects out-of-range frames', () => {
    expect(parseFrameJumpQuery('f36', { fps: 24, duration: 3 })).toEqual({
      ok: true,
      value: { kind: 'frame', seconds: 1.5, totalFrames: 36, timecode: '00:00:01:12', frameNumber: 36 }
    });
    expect(parseFrameJumpQuery('F0000', { fps: 30 })).toMatchObject({ ok: true, value: { seconds: 0, totalFrames: 0 } });
    expect(parseFrameJumpQuery('f1800', { fps: 29.97, timecodeFormat: 'df' })).toMatchObject({ ok: true, value: { timecode: '00:01:00:02' } });
    expect(parseFrameJumpQuery('f9007199254740992', { fps: 30 })).toEqual({ ok: false, error: 'frame-number' });
    expect(parseFrameJumpQuery('f999', { fps: 30, duration: 1 })).toEqual({ ok: false, error: 'duration' });
  });

  it('parses timecode jump queries through the frame search parser', () => {
    expect(parseFrameJumpQuery('00:00:01:12', { fps: 24, timecodeFormat: 'ndf' })).toEqual({
      ok: true,
      value: { kind: 'timecode', seconds: 1.5, totalFrames: 36, timecode: '00:00:01:12' }
    });
    expect(parseFrameJumpQuery('not-a-timecode', { fps: 30 })).toEqual({ ok: false, error: 'format' });
  });

  it('converts frame numbers to timecode', () => {
    expect(frameNumberToTimecode(1234, 24)).toBe('00:00:51:10');
    expect(frameNumberToTimecode(1.9, 30)).toBe('00:00:00:01');
    expect(frameNumberToTimecode(60, 29.97)).toBe('00:00:02:00');
    expect(() => frameNumberToTimecode(-1, 30)).toThrow(RangeError);
    expect(() => frameNumberToTimecode(Number.NaN, 30)).toThrow(RangeError);
  });
});
