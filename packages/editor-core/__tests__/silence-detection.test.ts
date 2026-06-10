import { describe, expect, it } from 'vitest';
import { amplitudeToDb, applySilenceMargins, calculateRms, findSilentRanges, mergeCloseSilentRanges, normalizeSilenceDetectionOptions } from '../src';

describe('silence detection', () => {
  it('calculates RMS across channels', () => {
    const left = new Float32Array([1, -1, 1, -1]);
    const right = new Float32Array([0, 0, 0, 0]);

    expect(calculateRms([left, right])).toBeCloseTo(Math.sqrt(0.5), 6);
    expect(calculateRms([])).toBe(0);
    expect(calculateRms([left], 2, 2)).toBe(0);
  });

  it('converts amplitudes to decibels defensively', () => {
    expect(amplitudeToDb(1)).toBe(0);
    expect(amplitudeToDb(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(amplitudeToDb(Number.NaN)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('normalizes detection options with defaults and lower bounds', () => {
    expect(normalizeSilenceDetectionOptions({ minSilenceDuration: -1, marginDuration: -2, frameDuration: 0 })).toEqual({
      thresholdDb: -40,
      minSilenceDuration: 0,
      marginDuration: 0,
      frameDuration: 0.001
    });
  });

  it('detects silent ranges below the threshold', () => {
    const samples = new Float32Array([
      ...Array.from({ length: 100 }, () => 0.5),
      ...Array.from({ length: 50 }, () => 0),
      ...Array.from({ length: 100 }, () => 0.5)
    ]);

    const ranges = findSilentRanges(
      { channels: [samples], sampleRate: 100, duration: 2.5 },
      { thresholdDb: -40, minSilenceDuration: 0.5, marginDuration: 0, frameDuration: 0.1 }
    );

    expect(ranges).toEqual([{ start: 1, end: 1.5, duration: 0.5 }]);
  });

  it('returns no ranges for empty audio and detects trailing silence', () => {
    expect(findSilentRanges({ channels: [new Float32Array()], sampleRate: 44_100 })).toEqual([]);
    expect(findSilentRanges({ channels: [new Float32Array([0.5, 0.5, 0, 0])], sampleRate: 2 }, { minSilenceDuration: 1, marginDuration: 0, frameDuration: 0.5 })).toEqual([
      { start: 1, end: 2, duration: 1 }
    ]);
  });

  it('merges adjacent silent ranges when the gap is smaller than the margin', () => {
    const merged = mergeCloseSilentRanges(
      [
        { start: 0.2, end: 0.8, duration: 0.6 },
        { start: 0.85, end: 1.2, duration: 0.35 },
        { start: 2, end: 2.5, duration: 0.5 }
      ],
      0.1
    );

    expect(merged).toEqual([
      { start: 0.2, end: 1.2, duration: 1 },
      { start: 2, end: 2.5, duration: 0.5 }
    ]);
  });

  it('clamps margins and drops fully protected silent ranges', () => {
    const ranges = applySilenceMargins(
      [
        { start: 0.2, end: 0.5, duration: 0.3 },
        { start: 1, end: 2, duration: 1 }
      ],
      3,
      0.2
    );

    expect(ranges).toEqual([{ start: 1.2, end: 1.8, duration: 0.6 }]);
  });
});
