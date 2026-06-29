import { describe, it, expect } from 'vitest';
import {
  analyzeFrequencyBand,
  analyzeBroadbandEnergy,
  estimateSNR,
  classifyNoiseProfile,
  recommendDenoiseFilters,
  parseDenoiseAiResponse,
  buildDenoiseFilterChain,
  buildDenoiseFfmpegArgs,
  createDenoiseRecommendation,
  normalizeAIDenoiseRecommendation,
  type NoiseProfile,
  type DenoiseFilterRecommendation,
  type AIDenoiseResponse
} from '../src/ai-denoise-recommendation';

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

describe('analyzeFrequencyBand', () => {
  it('returns zero for empty samples', () => {
    expect(analyzeFrequencyBand(new Float32Array(0), 44100, 1000)).toBe(0);
  });

  it('returns zero for invalid sampleRate', () => {
    expect(analyzeFrequencyBand(new Float32Array(100), 0, 1000)).toBe(0);
  });

  it('returns zero for invalid freqHz', () => {
    expect(analyzeFrequencyBand(new Float32Array(100), 44100, 0)).toBe(0);
  });

  it('detects energy at matching frequency', () => {
    const samples = generateSine(4096, 44100, 1000, 0.8);
    const energy = analyzeFrequencyBand(samples, 44100, 1000);
    expect(energy).toBeGreaterThan(0.1);
  });

  it('returns low energy at non-matching frequency', () => {
    const samples = generateSine(4096, 44100, 1000, 0.8);
    const energy = analyzeFrequencyBand(samples, 44100, 5000);
    expect(energy).toBeLessThan(0.1);
  });
});

describe('analyzeBroadbandEnergy', () => {
  it('returns zero for empty samples', () => {
    expect(analyzeBroadbandEnergy(new Float32Array(0), 44100, 100, 200)).toBe(0);
  });

  it('returns zero for invalid range', () => {
    expect(analyzeBroadbandEnergy(new Float32Array(100), 44100, 200, 100)).toBe(0);
  });

  it('detects energy in frequency range', () => {
    const samples = generateSine(4096, 44100, 100, 0.8);
    const energy = analyzeBroadbandEnergy(samples, 44100, 80, 120, 4);
    expect(energy).toBeGreaterThan(0);
  });
});

describe('estimateSNR', () => {
  it('returns high SNR for strong signal with weak noise', () => {
    const signal = generateSine(4096, 44100, 1000, 0.8);
    const noise = generateNoise(4096, 0.001);
    const snr = estimateSNR(signal, noise);
    expect(snr).toBeGreaterThan(30);
  });

  it('returns low SNR for weak signal with strong noise', () => {
    const signal = generateSine(4096, 44100, 1000, 0.01);
    const noise = generateNoise(4096, 0.5);
    const snr = estimateSNR(signal, noise);
    expect(snr).toBeLessThan(10);
  });
});

describe('classifyNoiseProfile', () => {
  it('returns zero profile for empty samples', () => {
    const profile = classifyNoiseProfile(new Float32Array(0), 44100);
    expect(profile.humScore).toBe(0);
    expect(profile.hissScore).toBe(0);
    expect(profile.windScore).toBe(0);
    expect(profile.snrEstimate).toBe(60);
  });

  it('returns zero profile for invalid sampleRate', () => {
    const profile = classifyNoiseProfile(new Float32Array(100), 0);
    expect(profile.humScore).toBe(0);
  });

  it('detects hum noise at 50Hz', () => {
    const humSamples = generateSine(4096, 44100, 50, 0.6);
    const profile = classifyNoiseProfile(humSamples, 44100);
    expect(profile.humScore).toBeGreaterThan(0.3);
  });

  it('detects hum noise at 60Hz', () => {
    const humSamples = generateSine(4096, 44100, 60, 0.6);
    const profile = classifyNoiseProfile(humSamples, 44100);
    expect(profile.humScore).toBeGreaterThan(0.3);
  });

  it('detects hiss noise (high frequency broadband)', () => {
    const samples = new Float32Array(4096);
    for (let freq = 6000; freq < 18000; freq += 1000) {
      const sine = generateSine(4096, 44100, freq, 0.8);
      for (let i = 0; i < 4096; i++) samples[i] += sine[i];
    }
    const profile = classifyNoiseProfile(samples, 44100);
    expect(profile.hissScore).toBeGreaterThan(0.1);
  });

  it('detects wind noise (low frequency broadband)', () => {
    const samples = new Float32Array(4096);
    for (let freq = 20; freq < 150; freq += 10) {
      const sine = generateSine(4096, 44100, freq, 0.2);
      for (let i = 0; i < 4096; i++) samples[i] += sine[i];
    }
    const profile = classifyNoiseProfile(samples, 44100);
    expect(profile.windScore).toBeGreaterThan(0.1);
  });

  it('estimates SNR when signal samples provided', () => {
    const noise = generateNoise(4096, 0.01);
    const signal = generateSine(4096, 44100, 1000, 0.5);
    const profile = classifyNoiseProfile(noise, 44100, signal);
    expect(profile.snrEstimate).toBeGreaterThan(0);
  });
});

describe('recommendDenoiseFilters', () => {
  it('returns empty for clean profile', () => {
    const profile: NoiseProfile = { humScore: 0.1, hissScore: 0.05, windScore: 0.05, snrEstimate: 40 };
    const filters = recommendDenoiseFilters(profile);
    expect(filters).toHaveLength(0);
  });

  it('recommends highpass for strong hum', () => {
    const profile: NoiseProfile = { humScore: 0.8, hissScore: 0, windScore: 0, snrEstimate: 30 };
    const filters = recommendDenoiseFilters(profile);
    const hp = filters.find((f) => f.filter === 'highpass');
    expect(hp).toBeDefined();
    expect(hp!.params.f).toBe(100);
    expect(hp!.params.poles).toBe(2);
  });

  it('recommends highpass with lower cutoff for moderate hum', () => {
    const profile: NoiseProfile = { humScore: 0.5, hissScore: 0, windScore: 0, snrEstimate: 30 };
    const filters = recommendDenoiseFilters(profile);
    const hp = filters.find((f) => f.filter === 'highpass');
    expect(hp).toBeDefined();
    expect(hp!.params.f).toBe(80);
  });

  it('recommends afftdn for hiss', () => {
    const profile: NoiseProfile = { humScore: 0, hissScore: 0.6, windScore: 0, snrEstimate: 30 };
    const filters = recommendDenoiseFilters(profile);
    const afftdn = filters.find((f) => f.filter === 'afftdn');
    expect(afftdn).toBeDefined();
    expect(afftdn!.params.om).toBe('o');
  });

  it('recommends lowpass for strong wind', () => {
    const profile: NoiseProfile = { humScore: 0, hissScore: 0, windScore: 0.7, snrEstimate: 30 };
    const filters = recommendDenoiseFilters(profile);
    const lp = filters.find((f) => f.filter === 'lowpass');
    expect(lp).toBeDefined();
    expect(lp!.params.f).toBe(120);
  });

  it('recommends lowpass with higher cutoff for moderate wind', () => {
    const profile: NoiseProfile = { humScore: 0, hissScore: 0, windScore: 0.4, snrEstimate: 30 };
    const filters = recommendDenoiseFilters(profile);
    const lp = filters.find((f) => f.filter === 'lowpass');
    expect(lp).toBeDefined();
    expect(lp!.params.f).toBe(150);
  });

  it('recommends anlmdn for low SNR when no other noise detected', () => {
    const profile: NoiseProfile = { humScore: 0.1, hissScore: 0.05, windScore: 0.05, snrEstimate: 10 };
    const filters = recommendDenoiseFilters(profile);
    const anlmdn = filters.find((f) => f.filter === 'anlmdn');
    expect(anlmdn).toBeDefined();
  });

  it('does not recommend anlmdn when other filters already recommended', () => {
    const profile: NoiseProfile = { humScore: 0.8, hissScore: 0.6, windScore: 0, snrEstimate: 10 };
    const filters = recommendDenoiseFilters(profile);
    const anlmdn = filters.find((f) => f.filter === 'anlmdn');
    expect(anlmdn).toBeUndefined();
  });

  it('detects combined hum+hiss noise', () => {
    const profile: NoiseProfile = { humScore: 0.5, hissScore: 0.4, windScore: 0, snrEstimate: 25 };
    const filters = recommendDenoiseFilters(profile);
    expect(filters.length).toBeGreaterThanOrEqual(2);
    expect(filters.some((f) => f.filter === 'highpass')).toBe(true);
    expect(filters.some((f) => f.filter === 'afftdn')).toBe(true);
  });
});

describe('parseDenoiseAiResponse', () => {
  it('returns empty for null input', () => {
    const result = parseDenoiseAiResponse(null);
    expect(result.recommendedFilters).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it('returns empty for non-object input', () => {
    expect(parseDenoiseAiResponse('string')).toEqual({ recommendedFilters: [], confidence: 0 });
  });

  it('parses valid response', () => {
    const input = {
      recommendedFilters: [
        { filter: 'afftdn', params: { nr: 0.5 }, reason: '高频噪声' },
        { filter: 'highpass', params: { f: 80, poles: 2 }, reason: '低频嗡声' }
      ],
      confidence: 0.85
    };
    const result = parseDenoiseAiResponse(input);
    expect(result.recommendedFilters).toHaveLength(2);
    expect(result.recommendedFilters[0].filter).toBe('afftdn');
    expect(result.recommendedFilters[1].filter).toBe('highpass');
    expect(result.confidence).toBe(0.85);
  });

  it('filters out invalid filter names', () => {
    const input = {
      recommendedFilters: [
        { filter: 'invalid_filter', params: {}, reason: 'test' },
        { filter: 'lowpass', params: { f: 200 }, reason: 'wind noise' }
      ],
      confidence: 0.7
    };
    const result = parseDenoiseAiResponse(input);
    expect(result.recommendedFilters).toHaveLength(1);
    expect(result.recommendedFilters[0].filter).toBe('lowpass');
  });

  it('clamps confidence to 0-1 range', () => {
    expect(parseDenoiseAiResponse({ recommendedFilters: [], confidence: 1.5 }).confidence).toBe(1);
    expect(parseDenoiseAiResponse({ recommendedFilters: [], confidence: -0.5 }).confidence).toBe(0);
  });

  it('handles missing recommendedFilters array', () => {
    const result = parseDenoiseAiResponse({ confidence: 0.5 });
    expect(result.recommendedFilters).toHaveLength(0);
    expect(result.confidence).toBe(0.5);
  });
});

describe('buildDenoiseFilterChain', () => {
  it('returns empty string for no filters', () => {
    expect(buildDenoiseFilterChain([])).toBe('');
  });

  it('builds single filter string', () => {
    const filters: DenoiseFilterRecommendation[] = [
      { filter: 'highpass', params: { f: 80, poles: 2 }, reason: 'test' }
    ];
    expect(buildDenoiseFilterChain(filters)).toBe('highpass=f=80:poles=2');
  });

  it('builds multi-filter chain', () => {
    const filters: DenoiseFilterRecommendation[] = [
      { filter: 'highpass', params: { f: 80, poles: 2 }, reason: 'test' },
      { filter: 'afftdn', params: { nr: 0.5 }, reason: 'test' }
    ];
    const chain = buildDenoiseFilterChain(filters);
    expect(chain).toBe('highpass=f=80:poles=2,afftdn=nr=0.5');
  });

  it('handles filter with no params', () => {
    const filters: DenoiseFilterRecommendation[] = [
      { filter: 'afftdn', params: {}, reason: 'test' }
    ];
    expect(buildDenoiseFilterChain(filters)).toBe('afftdn');
  });
});

describe('buildDenoiseFfmpegArgs', () => {
  it('returns empty for no filters', () => {
    expect(buildDenoiseFfmpegArgs([])).toEqual([]);
  });

  it('builds -af args for each filter', () => {
    const filters: DenoiseFilterRecommendation[] = [
      { filter: 'highpass', params: { f: 80 }, reason: 'test' },
      { filter: 'afftdn', params: { nr: 0.5 }, reason: 'test' }
    ];
    const args = buildDenoiseFfmpegArgs(filters);
    expect(args).toEqual(['-af', 'highpass=f=80', '-af', 'afftdn=nr=0.5']);
  });
});

describe('createDenoiseRecommendation', () => {
  it('creates recommendation with correct structure', () => {
    const profile: NoiseProfile = { humScore: 0.5, hissScore: 0.3, windScore: 0, snrEstimate: 25 };
    const filters: DenoiseFilterRecommendation[] = [
      { filter: 'highpass', params: { f: 80 }, reason: 'hum' }
    ];
    const rec = createDenoiseRecommendation(profile, filters);
    expect(rec.noiseProfile).toEqual(profile);
    expect(rec.recommendedFilters).toEqual(filters);
    expect(rec.appliedFilters).toEqual([]);
    expect(rec.generatedAt).toBeTruthy();
  });
});

describe('normalizeAIDenoiseRecommendation', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeAIDenoiseRecommendation(undefined)).toBeUndefined();
  });

  it('returns undefined for input without noiseProfile', () => {
    expect(normalizeAIDenoiseRecommendation({ appliedFilters: [] })).toBeUndefined();
  });

  it('normalizes valid input', () => {
    const input = {
      noiseProfile: { humScore: 0.5, hissScore: 'bad' as unknown, windScore: 0.3, snrEstimate: 20 },
      recommendedFilters: [{ filter: 'highpass' as const, params: { f: 80 }, reason: 'test' }],
      appliedFilters: ['highpass']
    };
    const result = normalizeAIDenoiseRecommendation(input);
    expect(result).toBeDefined();
    expect(result!.noiseProfile.humScore).toBe(0.5);
    expect(result!.noiseProfile.hissScore).toBe(0);
    expect(result!.appliedFilters).toEqual(['highpass']);
  });
});
