import { describe, expect, it } from 'vitest';
import { clampDb, createVuMeterState, readVuMeter, type AnalyserLike } from '../src';

function makeAnalyser(values: number[]): AnalyserLike {
  return {
    fftSize: values.length,
    getByteTimeDomainData(data: Uint8Array) {
      data.set(values);
    }
  };
}

describe('VU meter analyser reader', () => {
  it('clamps silence and full-scale samples to the supported dB range', () => {
    expect(readVuMeter(makeAnalyser([128, 128, 128, 128]), createVuMeterState(), 0).levelDb).toBe(-60);
    expect(readVuMeter(makeAnalyser([0, 255, 0, 255]), createVuMeterState(), 0).levelDb).toBe(0);
  });

  it('holds peak levels for two seconds before decaying', () => {
    let state = createVuMeterState();
    const loud = readVuMeter(makeAnalyser([0, 255, 0, 255]), state, 100);
    state = { peakDb: loud.peakDb, peakHeldAtMs: loud.peakHeldAtMs };

    const held = readVuMeter(makeAnalyser([128, 128, 128, 128]), state, 1900);
    expect(held.levelDb).toBe(-60);
    expect(held.peakDb).toBe(0);

    const decayed = readVuMeter(makeAnalyser([128, 128, 128, 128]), { peakDb: held.peakDb, peakHeldAtMs: held.peakHeldAtMs }, 2200);
    expect(decayed.peakDb).toBe(-60);
  });

  it('falls back to the floor for non-finite dB input', () => {
    expect(clampDb(Number.NaN)).toBe(-60);
  });
});
