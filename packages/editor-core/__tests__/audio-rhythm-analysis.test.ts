import { describe, it, expect } from 'vitest';
import {
  computeMagnitudes,
  applyHanningWindow,
  calculateSpectralCentroid,
  calculateSpectralFlux,
  calculateBandEnergies,
  detectOnsets,
  estimateTempo,
  generateBeatTimes,
  classifyRhythmPattern,
  analyzeAudioRhythm,
  alignHighlightsWithRhythm,
} from '../src/audio-rhythm-analysis';

describe('computeMagnitudes', () => {
  it('returns half the input length', () => {
    const result = computeMagnitudes([1, 0, 0, 0]);
    expect(result.length).toBe(2);
  });

  it('returns empty for empty input', () => {
    expect(computeMagnitudes([])).toEqual([]);
  });

  it('DC component equals sum of input', () => {
    const input = [1, 1, 1, 1];
    const mags = computeMagnitudes(input);
    // DC component (k=0) should be |sum/n| = 1
    expect(mags[0]).toBeCloseTo(1, 1);
  });
});

describe('applyHanningWindow', () => {
  it('attenuates edges', () => {
    const signal = [1, 1, 1, 1, 1];
    const windowed = applyHanningWindow(signal);
    expect(windowed[0]).toBeCloseTo(0, 1);
    expect(windowed[4]).toBeCloseTo(0, 1);
    expect(windowed[2]).toBeGreaterThan(windowed[0]);
  });

  it('returns same length', () => {
    expect(applyHanningWindow([1, 2, 3]).length).toBe(3);
  });
});

describe('calculateSpectralCentroid', () => {
  it('returns 0 for empty', () => {
    expect(calculateSpectralCentroid([])).toBe(0);
  });

  it('returns low value for low-frequency content', () => {
    const mags = [1, 0.5, 0, 0, 0];
    expect(calculateSpectralCentroid(mags)).toBeLessThan(0.3);
  });

  it('returns high value for high-frequency content', () => {
    const mags = [0, 0, 0, 0.5, 1];
    expect(calculateSpectralCentroid(mags)).toBeGreaterThan(0.5);
  });
});

describe('calculateSpectralFlux', () => {
  it('returns 0 for identical spectra', () => {
    const mags = [0.5, 0.5, 0.5];
    expect(calculateSpectralFlux(mags, mags)).toBe(0);
  });

  it('returns positive for increasing magnitudes', () => {
    const prev = [0, 0, 0];
    const curr = [0.5, 0.5, 0.5];
    expect(calculateSpectralFlux(prev, curr)).toBeGreaterThan(0);
  });

  it('ignores decreases (half-wave rectified)', () => {
    const prev = [0.5, 0.5, 0.5];
    const curr = [0, 0, 0];
    expect(calculateSpectralFlux(prev, curr)).toBe(0);
  });
});

describe('calculateBandEnergies', () => {
  it('returns 6 bands', () => {
    const mags = new Array(100).fill(1);
    const bands = calculateBandEnergies(mags, 44100, 2048);
    expect(bands.length).toBe(6);
  });

  it('normalizes to 0-1', () => {
    const mags = new Array(100).fill(1);
    const bands = calculateBandEnergies(mags, 44100, 2048);
    for (const b of bands) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});

describe('detectOnsets', () => {
  it('returns empty for < 3 frames', () => {
    expect(detectOnsets([], 0.3, 0.05)).toEqual([]);
  });

  it('detects onset at flux peak', () => {
    const frames = [
      { time: 0, magnitudes: [], centroid: 0.5, flux: 0.1, bandEnergies: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
      { time: 0.05, magnitudes: [], centroid: 0.5, flux: 0.8, bandEnergies: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
      { time: 0.1, magnitudes: [], centroid: 0.5, flux: 0.2, bandEnergies: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    ];
    const onsets = detectOnsets(frames, 0.3, 0.01);
    expect(onsets.length).toBe(1);
    expect(onsets[0].time).toBe(0.05);
  });
});

describe('estimateTempo', () => {
  it('returns null for < 4 onsets', () => {
    expect(estimateTempo([
      { time: 0, strength: 1, band: 'bass' },
      { time: 0.5, strength: 1, band: 'bass' },
    ], 60, 200)).toBeNull();
  });

  it('estimates tempo from regular onsets', () => {
    const onsets = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.5, // 120 BPM
      strength: 1,
      band: 'bass' as const,
    }));
    const tempo = estimateTempo(onsets, 60, 200);
    expect(tempo).not.toBeNull();
    if (tempo) {
      expect(tempo.bpm).toBeCloseTo(120, -1);
      expect(tempo.confidence).toBeGreaterThan(0);
    }
  });
});

describe('generateBeatTimes', () => {
  it('generates evenly spaced beats', () => {
    const tempo = { bpm: 120, confidence: 1, phase: 0 };
    const beats = generateBeatTimes(tempo, 2);
    expect(beats.length).toBe(4); // 0, 0.5, 1, 1.5
    expect(beats[0]).toBe(0);
    expect(beats[1]).toBeCloseTo(0.5, 1);
  });

  it('returns empty for invalid tempo', () => {
    expect(generateBeatTimes(null, 10)).toEqual([]);
    expect(generateBeatTimes({ bpm: 0, confidence: 0, phase: 0 }, 10)).toEqual([]);
  });
});

describe('classifyRhythmPattern', () => {
  it('returns irregular for < 3 onsets', () => {
    const pattern = classifyRhythmPattern([
      { time: 0, strength: 1, band: 'bass' },
    ]);
    expect(pattern.type).toBe('irregular');
  });

  it('classifies steady rhythm', () => {
    const onsets = Array.from({ length: 10 }, (_, i) => ({
      time: i * 0.5,
      strength: 1,
      band: 'bass' as const,
    }));
    const pattern = classifyRhythmPattern(onsets);
    expect(pattern.type).toBe('steady');
    expect(pattern.confidence).toBeGreaterThan(0.5);
  });

  it('classifies buildup pattern', () => {
    // Decreasing intervals: 1.0, 0.8, 0.6, 0.4, 0.2
    const onsets = [
      { time: 0, strength: 1, band: 'bass' as const },
      { time: 1.0, strength: 1, band: 'bass' as const },
      { time: 1.8, strength: 1, band: 'bass' as const },
      { time: 2.4, strength: 1, band: 'bass' as const },
      { time: 2.8, strength: 1, band: 'bass' as const },
      { time: 3.0, strength: 1, band: 'bass' as const },
    ];
    const pattern = classifyRhythmPattern(onsets);
    expect(pattern.type).toBe('buildup');
  });
});

describe('analyzeAudioRhythm', () => {
  it('returns empty result for too-short audio', () => {
    const samples = new Float32Array(100);
    const result = analyzeAudioRhythm(samples, 44100);
    expect(result.spectrumFrames).toEqual([]);
    expect(result.onsets).toEqual([]);
    expect(result.tempo).toBeNull();
  });

  it('processes longer audio and produces spectrum frames', () => {
    // Generate a simple sine wave
    const sampleRate = 8000;
    const duration = 2; // 2 seconds
    const samples = new Float32Array(sampleRate * duration);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
    }
    const result = analyzeAudioRhythm(samples, sampleRate, {
      fftSize: 256,
      hopSize: 128,
      sampleRate: 8000,
    });
    expect(result.spectrumFrames.length).toBeGreaterThan(0);
    expect(result.stats.totalFrames).toBeGreaterThan(0);
  });
});

describe('alignHighlightsWithRhythm', () => {
  it('marks aligned points', () => {
    const visualTimes = [1, 2, 3];
    const beatTimes = [1.05, 3.02];
    const result = alignHighlightsWithRhythm(visualTimes, beatTimes, 0.2);
    // Times 1 and 3 should be aligned
    const at1 = result.find((r) => Math.abs(r.time - 1) < 0.01);
    expect(at1?.aligned).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(alignHighlightsWithRhythm([], [])).toEqual([]);
  });
});
