import { describe, it, expect } from 'vitest';
import {
  average,
  standardDeviation,
  smoothArray,
  detectPeaks,
  computeSimilarity,
  computeAudioEnergy,
  computeZeroCrossingRate,
  detectSilence,
  createDefaultSmartEditingConfig,
  validateSmartEditingConfig,
  DEFAULT_SMART_EDITING_CONFIG,
  detectBeats,
  analyzeEmotion,
  sortSegments,
  generateCutSuggestions,
  generateTrailer,
} from './smart-editing';
import type { VideoSegment, EmotionType } from './smart-editing';

describe('average', () => {
  it('returns 0 for empty array', () => {
    expect(average([])).toBe(0);
  });

  it('computes average', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3);
  });

  it('handles single element', () => {
    expect(average([10])).toBe(10);
  });

  it('handles negative numbers', () => {
    expect(average([-2, 2])).toBe(0);
  });
});

describe('standardDeviation', () => {
  it('returns 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0);
  });

  it('returns 0 for identical values', () => {
    expect(standardDeviation([5, 5, 5])).toBe(0);
  });

  it('computes std dev', () => {
    const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2, 0);
  });
});

describe('smoothArray', () => {
  it('returns empty for empty input', () => {
    expect(smoothArray([])).toEqual([]);
  });

  it('preserves length', () => {
    const result = smoothArray([1, 2, 3, 4, 5], 3);
    expect(result.length).toBe(5);
  });

  it('smooths values', () => {
    const result = smoothArray([0, 0, 10, 0, 0], 3);
    expect(result[2]).toBeCloseTo(10 / 3, 1);
  });

  it('uses default window size', () => {
    const result = smoothArray([1, 2, 3]);
    expect(result.length).toBe(3);
  });
});

describe('detectPeaks', () => {
  it('returns empty for flat signal', () => {
    expect(detectPeaks([1, 1, 1, 1, 1])).toEqual([]);
  });

  it('detects peak', () => {
    const peaks = detectPeaks([0, 0.2, 0.5, 0.8, 1.0, 0.8, 0.5, 0.2, 0]);
    expect(peaks.length).toBeGreaterThan(0);
  });

  it('respects threshold', () => {
    const peaks = detectPeaks([0, 0.2, 0.3, 0.2, 0], 0.5);
    expect(peaks.length).toBe(0);
  });
});

describe('computeSimilarity', () => {
  it('returns 0 for different length arrays', () => {
    expect(computeSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for zero-norm arrays', () => {
    expect(computeSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('returns 1 for identical arrays', () => {
    expect(computeSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns -1 for opposite arrays', () => {
    expect(computeSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it('returns 0 for orthogonal arrays', () => {
    expect(computeSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('computeAudioEnergy', () => {
  it('returns 0 for silence', () => {
    expect(computeAudioEnergy(new Float32Array([0, 0, 0, 0]))).toBe(0);
  });

  it('returns positive for signal', () => {
    expect(computeAudioEnergy(new Float32Array([1, -1, 1, -1]))).toBe(1);
  });

  it('computes RMS energy', () => {
    const energy = computeAudioEnergy(new Float32Array([0.5, -0.5]));
    expect(energy).toBeCloseTo(0.25);
  });
});

describe('computeZeroCrossingRate', () => {
  it('returns 0 for constant signal', () => {
    expect(computeZeroCrossingRate(new Float32Array([1, 1, 1, 1, 1]))).toBe(0);
  });

  it('returns 1 for alternating signal', () => {
    expect(computeZeroCrossingRate(new Float32Array([1, -1, 1, -1, 1]))).toBe(1);
  });
});

describe('detectSilence', () => {
  it('returns empty for empty audio', () => {
    expect(detectSilence(new Float32Array(0), 44100)).toEqual([]);
  });

  it('detects silence in silent audio', () => {
    const silence = new Float32Array(44100 * 2);
    const result = detectSilence(silence, 44100, 0.01, 0.1);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty for loud audio', () => {
    const loud = new Float32Array(44100 * 2);
    loud.fill(0.9);
    const result = detectSilence(loud, 44100, 0.01, 0.1);
    expect(result.length).toBe(0);
  });
});

describe('DEFAULT_SMART_EDITING_CONFIG', () => {
  it('has expected fields', () => {
    expect(DEFAULT_SMART_EDITING_CONFIG.enableRhythmMatching).toBe(true);
    expect(typeof DEFAULT_SMART_EDITING_CONFIG.rhythmMatchPrecision).toBe('number');
  });
});

describe('createDefaultSmartEditingConfig', () => {
  it('returns default config', () => {
    const config = createDefaultSmartEditingConfig();
    expect(config.enableRhythmMatching).toBe(true);
  });
});

describe('validateSmartEditingConfig', () => {
  it('returns true for valid config', () => {
    expect(validateSmartEditingConfig(createDefaultSmartEditingConfig())).toBe(true);
  });

  it('returns false for empty object', () => {
    expect(validateSmartEditingConfig({} as any)).toBe(false);
  });

  it('returns false for wrong types', () => {
    expect(validateSmartEditingConfig({ ...createDefaultSmartEditingConfig(), enableRhythmMatching: 'yes' as any })).toBe(false);
  });
});

// ==================== Test helpers ====================

function makeSineWave(frequency: number, sampleRate: number, durationSec: number, amplitude = 0.5): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return data;
}

function makeSegment(overrides: Partial<VideoSegment> = {}): VideoSegment {
  return {
    id: 'seg-1',
    startTime: 0,
    endTime: 10,
    duration: 10,
    emotion: 'neutral' as EmotionType,
    importance: 0.5,
    tags: [],
    sceneType: 'default',
    motionIntensity: 0.3,
    audioFeatures: {
      volume: 0.5,
      hasSpeech: false,
      hasMusic: false,
      spectralFeatures: {
        centroid: 0,
        rolloff: 0,
        flatness: 0,
      },
    },
    ...overrides,
  };
}

// ==================== detectBeats ====================

describe('detectBeats', () => {
  it('returns BeatInfo with bpm', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.5);
    const result = detectBeats(audio, 44100);
    expect(result.bpm).toBeGreaterThan(0);
    expect(Array.isArray(result.beats)).toBe(true);
    expect(Array.isArray(result.downbeats)).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('handles short audio', () => {
    const audio = makeSineWave(440, 44100, 0.1, 0.5);
    const result = detectBeats(audio, 44100);
    expect(result.bpm).toBeGreaterThan(0);
  });

  it('handles silent audio', () => {
    const audio = new Float32Array(44100);
    const result = detectBeats(audio, 44100);
    expect(result.bpm).toBeGreaterThan(0);
  });
});

// ==================== analyzeEmotion ====================

describe('analyzeEmotion', () => {
  it('returns emotion analysis', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.5);
    const result = analyzeEmotion(audio, 44100);
    expect(result.overallEmotion).toBeDefined();
    expect(result.emotionalIntensity).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.timeline)).toBe(true);
  });

  it('handles video features', () => {
    const audio = makeSineWave(440, 44100, 1.0, 0.5);
    const features = [
      { brightness: 0.8, motion: 0.3, color: 0.5 },
      { brightness: 0.2, motion: 0.7, color: 0.6 },
    ];
    const result = analyzeEmotion(audio, 44100, features);
    expect(result.overallEmotion).toBeDefined();
  });

  it('handles short audio', () => {
    const audio = makeSineWave(440, 44100, 0.05, 0.5);
    const result = analyzeEmotion(audio, 44100);
    expect(result.overallEmotion).toBeDefined();
  });
});

// ==================== sortSegments ====================

describe('sortSegments - all strategies', () => {
  const segments: VideoSegment[] = [
    makeSegment({ id: 'a', startTime: 10, importance: 0.3, emotion: 'sad', motionIntensity: 0.1 }),
    makeSegment({ id: 'b', startTime: 0, importance: 0.9, emotion: 'happy', motionIntensity: 0.8 }),
    makeSegment({ id: 'c', startTime: 5, importance: 0.6, emotion: 'calm', motionIntensity: 0.5 }),
  ];

  it('sorts chronologically', () => {
    const result = sortSegments(segments, { strategy: 'chronological' });
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('c');
    expect(result[2].id).toBe('a');
  });

  it('sorts by importance', () => {
    const result = sortSegments(segments, { strategy: 'importance' });
    expect(result[0].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('sorts by emotion', () => {
    const result = sortSegments(segments, { strategy: 'emotion' });
    expect(result.length).toBe(3);
  });

  it('sorts by rhythm', () => {
    const result = sortSegments(segments, { strategy: 'rhythm' });
    expect(result[0].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('sorts by narrative (default)', () => {
    const result = sortSegments(segments, { strategy: 'narrative' });
    expect(result.length).toBe(3);
  });

  it('sorts randomly', () => {
    const result = sortSegments(segments, { strategy: 'random' });
    expect(result.length).toBe(3);
  });

  it('returns original for unknown strategy', () => {
    const result = sortSegments(segments, { strategy: 'custom' as any });
    expect(result.length).toBe(3);
  });

  it('uses default options when empty', () => {
    const result = sortSegments(segments);
    expect(result.length).toBe(3);
  });
});

// ==================== generateTrailer ====================

describe('generateTrailer', () => {
  const segments: VideoSegment[] = [
    makeSegment({ id: 'a', startTime: 0, endTime: 10, duration: 10, importance: 0.9, emotion: 'excited' }),
    makeSegment({ id: 'b', startTime: 10, endTime: 20, duration: 10, importance: 0.3, emotion: 'calm' }),
    makeSegment({ id: 'c', startTime: 20, endTime: 30, duration: 10, importance: 0.7, emotion: 'happy' }),
  ];

  it('generates trailer with default config', () => {
    const result = generateTrailer(segments);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('generates trailer with custom duration', () => {
    const result = generateTrailer(segments, { targetDuration: 15 });
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('generates trailer with custom style', () => {
    const result = generateTrailer(segments, { style: 'energetic' });
    expect(result.segments.length).toBeGreaterThan(0);
  });

  it('handles empty segments', () => {
    const result = generateTrailer([]);
    expect(result.segments.length).toBe(0);
  });
});
