import { describe, expect, it } from 'vitest';
import { computeColorScopes, computeRgbHistogram, computeVectorscope, computeWaveform, rgbToCbCrPoint } from '../src';

describe('color scopes', () => {
  it('counts RGB histogram buckets from RGBA pixels', () => {
    const histogram = computeRgbHistogram({
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 12, 34, 56, 255])
    });

    expect(histogram.r[255]).toBe(1);
    expect(histogram.r[12]).toBe(1);
    expect(histogram.g[0]).toBe(1);
    expect(histogram.g[34]).toBe(1);
    expect(histogram.b[0]).toBe(1);
    expect(histogram.b[56]).toBe(1);
  });

  it('samples waveform columns into IRE buckets', () => {
    const waveform = computeWaveform(
      {
        width: 2,
        height: 1,
        data: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255])
      },
      2
    );

    expect(waveform.columns[0][0]).toBe(1);
    expect(waveform.columns[1][100]).toBe(1);
  });

  it('computes vectorscope Cb/Cr coordinates for saturated red', () => {
    const red = rgbToCbCrPoint(255, 0, 0);
    const points = computeVectorscope({
      width: 1,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255])
    });

    expect(red.x).toBeLessThan(-0.3);
    expect(red.y).toBeGreaterThan(0.9);
    expect(points).toEqual([expect.objectContaining({ x: Number(red.x.toFixed(3)), y: Number(red.y.toFixed(3)), count: 1 })]);
  });

  it('computes all scopes together and aggregates matching vectorscope points', () => {
    const scopes = computeColorScopes(
      {
        width: 2,
        height: 1,
        data: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255])
      },
      1
    );

    expect(scopes.histogram.r[255]).toBe(2);
    expect(scopes.waveform.columns[0].reduce((total, count) => total + count, 0)).toBe(2);
    expect(scopes.vectorscope).toEqual([expect.objectContaining({ count: 2 })]);
  });

  it('rejects empty or incomplete frames', () => {
    expect(() => computeRgbHistogram({ width: 1, height: 1, data: new Uint8Array([]) })).toThrow('empty or incomplete');
    expect(() => computeWaveform({ width: 0, height: 1, data: new Uint8Array([]) })).toThrow('empty or incomplete');
  });
});
