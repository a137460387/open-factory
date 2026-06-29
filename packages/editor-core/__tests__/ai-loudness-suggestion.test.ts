import { describe, it, expect } from 'vitest';
import {
  applyKWeighting,
  calculateBlockRms,
  estimateLoudness,
  calculateGainDelta,
  shouldSuggestGain,
  createLoudnessSuggestion,
  normalizeLoudnessSuggestion,
  PLATFORM_TARGETS
} from '../src/ai-loudness-suggestion';

function generateSine(samples: number, sampleRate: number, freq: number, amplitude = 0.5): Float32Array {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * (i / sampleRate));
  }
  return buf;
}

function generateNoise(samples: number, amplitude = 0.1): Float32Array {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buf[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return buf;
}

describe('applyKWeighting', () => {
  it('returns empty for empty input', () => {
    expect(applyKWeighting(new Float32Array(0), 44100)).toEqual(new Float32Array(0));
  });

  it('returns empty for invalid sampleRate', () => {
    expect(applyKWeighting(new Float32Array(100), 0)).toEqual(new Float32Array(0));
  });

  it('processes samples without error', () => {
    const input = generateSine(4096, 44100, 1000, 0.5);
    const output = applyKWeighting(input, 44100);
    expect(output.length).toBe(input.length);
    const hasEnergy = Array.from(output).some((v) => Math.abs(v) > 0.01);
    expect(hasEnergy).toBe(true);
  });

  it('preserves output length', () => {
    const input = generateNoise(8192, 0.3);
    const output = applyKWeighting(input, 48000);
    expect(output.length).toBe(8192);
  });
});

describe('calculateBlockRms', () => {
  it('returns 0 for empty input', () => {
    expect(calculateBlockRms(new Float32Array(0))).toBe(0);
  });

  it('calculates correct RMS for constant signal', () => {
    const samples = new Float32Array(100).fill(0.5);
    expect(calculateBlockRms(samples)).toBeCloseTo(0.5, 5);
  });

  it('calculates RMS for sine wave', () => {
    const samples = generateSine(4096, 44100, 1000, 0.8);
    const rms = calculateBlockRms(samples);
    expect(rms).toBeGreaterThan(0.4);
    expect(rms).toBeLessThan(0.7);
  });
});

describe('estimateLoudness', () => {
  it('returns -70 for empty input', () => {
    expect(estimateLoudness(new Float32Array(0), 44100)).toBe(-70);
  });

  it('returns -70 for invalid sampleRate', () => {
    expect(estimateLoudness(new Float32Array(100), 0)).toBe(-70);
  });

  it('returns a finite LUFS value for valid audio', () => {
    const samples = generateSine(44100 * 2, 44100, 1000, 0.5);
    const lufs = estimateLoudness(samples, 44100);
    expect(Number.isFinite(lufs)).toBe(true);
    expect(lufs).toBeGreaterThan(-70);
    expect(lufs).toBeLessThan(0);
  });

  it('returns louder value for higher amplitude', () => {
    const quiet = generateSine(44100, 44100, 1000, 0.1);
    const loud = generateSine(44100, 44100, 1000, 0.8);
    const quietLufs = estimateLoudness(quiet, 44100);
    const loudLufs = estimateLoudness(loud, 44100);
    expect(loudLufs).toBeGreaterThan(quietLufs);
  });

  it('returns approx label compatible value', () => {
    const samples = generateNoise(44100, 0.3);
    const lufs = estimateLoudness(samples, 44100);
    expect(lufs).toBeGreaterThan(-50);
    expect(lufs).toBeLessThan(0);
  });
});

describe('calculateGainDelta', () => {
  it('calculates correct gain', () => {
    expect(calculateGainDelta(-20, -14)).toBe(6);
  });

  it('returns negative gain when measured is too loud', () => {
    expect(calculateGainDelta(-10, -14)).toBe(-4);
  });

  it('returns 0 when measured equals target', () => {
    expect(calculateGainDelta(-14, -14)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    const result = calculateGainDelta(-20.123, -14.456);
    expect(result).toBe(5.67);
  });
});

describe('shouldSuggestGain', () => {
  it('returns true when gain exceeds threshold', () => {
    expect(shouldSuggestGain(2)).toBe(true);
    expect(shouldSuggestGain(-2)).toBe(true);
  });

  it('returns false when gain is at threshold', () => {
    expect(shouldSuggestGain(1)).toBe(false);
    expect(shouldSuggestGain(-1)).toBe(false);
  });

  it('returns false when gain is below threshold', () => {
    expect(shouldSuggestGain(0.5)).toBe(false);
  });

  it('uses custom threshold', () => {
    expect(shouldSuggestGain(0.5, 0.3)).toBe(true);
    expect(shouldSuggestGain(0.2, 0.3)).toBe(false);
  });
});

describe('PLATFORM_TARGETS', () => {
  it('has correct values', () => {
    expect(PLATFORM_TARGETS.tiktok).toBe(-14);
    expect(PLATFORM_TARGETS.youtube).toBe(-14);
    expect(PLATFORM_TARGETS.broadcast).toBe(-23);
    expect(PLATFORM_TARGETS.podcast).toBe(-16);
  });
});

describe('createLoudnessSuggestion', () => {
  it('creates suggestion with correct structure', () => {
    const result = createLoudnessSuggestion(-20, 'youtube', 6);
    expect(result.measuredLUFS).toBe(-20);
    expect(result.targetPlatform).toBe('youtube');
    expect(result.targetLUFS).toBe(-14);
    expect(result.suggestedGainDb).toBe(6);
    expect(result.appliedAt).toBeNull();
  });
});

describe('normalizeLoudnessSuggestion', () => {
  it('returns undefined for null', () => {
    expect(normalizeLoudnessSuggestion(null)).toBeUndefined();
  });

  it('returns undefined for non-object', () => {
    expect(normalizeLoudnessSuggestion(42)).toBeUndefined();
  });

  it('returns undefined for missing measuredLUFS', () => {
    expect(normalizeLoudnessSuggestion({ targetPlatform: 'youtube' })).toBeUndefined();
  });

  it('returns undefined for invalid platform', () => {
    expect(normalizeLoudnessSuggestion({ measuredLUFS: -20, targetPlatform: 'invalid' })).toBeUndefined();
  });

  it('normalizes valid input', () => {
    const input = { measuredLUFS: -20, targetPlatform: 'youtube', suggestedGainDb: 6 };
    const result = normalizeLoudnessSuggestion(input);
    expect(result).toBeDefined();
    expect(result!.measuredLUFS).toBe(-20);
    expect(result!.targetLUFS).toBe(-14);
    expect(result!.suggestedGainDb).toBe(6);
    expect(result!.appliedAt).toBeNull();
  });
});
