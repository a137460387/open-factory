import { describe, expect, it } from 'vitest';
import {
  LOG_INPUT_COLOR_SPACES,
  LOG_TO_REC709_LUTS,
  LOG_TO_REC709_LUT_SIZE,
  normalizeInputColorSpace,
  serializeLogToRec709Cube
} from '../src';

describe('camera log to Rec.709 LUTs', () => {
  it('contains a complete 17 point 3D LUT for each built-in camera log format', () => {
    expect(LOG_INPUT_COLOR_SPACES).toEqual(['slog2', 'slog3', 'clog', 'clog3', 'llog', 'vlog']);
    for (const colorSpace of LOG_INPUT_COLOR_SPACES) {
      const lut = LOG_TO_REC709_LUTS[colorSpace];
      expect(lut.size).toBe(LOG_TO_REC709_LUT_SIZE);
      expect(lut.points).toHaveLength(LOG_TO_REC709_LUT_SIZE ** 3);
      expect(lut.points[0]).toEqual([0, 0, 0]);
      for (const point of lut.points) {
        expect(point).toHaveLength(3);
        for (const channel of point) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('serializes LUT data as cube text without external files', () => {
    const cube = serializeLogToRec709Cube('slog2');
    const lines = cube.split('\n');

    expect(lines[0]).toContain('S-Log2 to Rec.709');
    expect(lines).toContain(`LUT_3D_SIZE ${LOG_TO_REC709_LUT_SIZE}`);
    expect(lines.filter((line) => /^(\d|0\.)/.test(line))).toHaveLength(LOG_TO_REC709_LUT_SIZE ** 3);
  });

  it('normalizes unknown input color spaces to Rec.709', () => {
    expect(normalizeInputColorSpace('slog3')).toBe('slog3');
    expect(normalizeInputColorSpace('aces')).toBe('rec709');
    expect(normalizeInputColorSpace(undefined)).toBe('rec709');
  });
});
