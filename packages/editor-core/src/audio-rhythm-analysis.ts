/**
 * Audio Rhythm Analysis System
 *
 * Provides real-time audio spectrum analysis and beat detection:
 * - FFT-based frequency analysis
 * - Onset detection (beat tracking)
 * - Tempo estimation
 * - Rhythm pattern classification
 *
 * All computations are local-only, no external AI calls.
 */

import { round } from './time';

// ==================== Types ====================

export interface AudioRhythmConfig {
  /** FFT window size (must be power of 2) */
  fftSize: number;
  /** Hop size between FFT windows (samples) */
  hopSize: number;
  /** Sample rate (Hz) */
  sampleRate: number;
  /** Onset detection threshold (0-1) */
  onsetThreshold: number;
  /** Minimum tempo BPM */
  minBpm: number;
  /** Maximum tempo BPM */
  maxBpm: number;
  /** Minimum gap between onsets (seconds) */
  minOnsetGap: number;
}

export const DEFAULT_AUDIO_RHYTHM_CONFIG: AudioRhythmConfig = {
  fftSize: 2048,
  hopSize: 512,
  sampleRate: 44100,
  onsetThreshold: 0.3,
  minBpm: 60,
  maxBpm: 200,
  minOnsetGap: 0.05,
};

export interface SpectrumFrame {
  /** Time in seconds */
  time: number;
  /** Frequency bins magnitudes (normalized 0-1) */
  magnitudes: number[];
  /** Spectral centroid (brightness) */
  centroid: number;
  /** Spectral flux (change from previous frame) */
  flux: number;
  /** Band energy: sub-bass, bass, low-mid, mid, high-mid, high */
  bandEnergies: [number, number, number, number, number, number];
}

export interface OnsetEvent {
  /** Time in seconds */
  time: number;
  /** Onset strength 0-1 */
  strength: number;
  /** Frequency band where onset was detected */
  band: 'sub-bass' | 'bass' | 'low-mid' | 'mid' | 'high-mid' | 'high';
}

export interface TempoEstimate {
  /** Estimated BPM */
  bpm: number;
  /** Confidence 0-1 */
  confidence: number;
  /** Beat phase offset (seconds) */
  phase: number;
}

export interface RhythmPattern {
  /** Pattern type */
  type: 'steady' | 'syncopated' | 'buildup' | 'breakdown' | 'irregular';
  /** Confidence 0-1 */
  confidence: number;
  /** Average inter-onset interval */
  avgInterval: number;
  /** Interval variance (regularity metric) */
  intervalVariance: number;
}

export interface AudioRhythmResult {
  /** Spectrum analysis per frame */
  spectrumFrames: SpectrumFrame[];
  /** Detected onsets */
  onsets: OnsetEvent[];
  /** Tempo estimation */
  tempo: TempoEstimate | null;
  /** Rhythm pattern classification */
  pattern: RhythmPattern;
  /** Beat-aligned timestamps */
  beatTimes: number[];
  /** Energy curve for timeline display */
  energyCurve: Array<{ time: number; value: number }>;
  /** Statistics */
  stats: {
    totalFrames: number;
    onsetCount: number;
    avgSpectralCentroid: number;
    avgEnergy: number;
  };
}

// ==================== FFT Utilities ====================

/**
 * Simple DFT for small arrays (no external FFT library needed).
 * For production, would use Web Audio API's AnalyserNode.
 */
export function computeMagnitudes(realInput: number[]): number[] {
  const n = realInput.length;
  if (n === 0) return [];
  const magnitudes: number[] = [];
  const halfN = Math.floor(n / 2);

  for (let k = 0; k < halfN; k += 1) {
    let sumReal = 0;
    let sumImag = 0;
    for (let i = 0; i < n; i += 1) {
      const angle = (2 * Math.PI * k * i) / n;
      sumReal += realInput[i] * Math.cos(angle);
      sumImag -= realInput[i] * Math.sin(angle);
    }
    magnitudes.push(Math.sqrt(sumReal * sumReal + sumImag * sumImag) / n);
  }

  return magnitudes;
}

/**
 * Apply Hanning window to a signal frame.
 */
export function applyHanningWindow(signal: number[]): number[] {
  const n = signal.length;
  return signal.map((val, i) => val * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
}

/**
 * Calculate spectral centroid from magnitude spectrum.
 * Returns normalized value 0-1 (0=dark, 1=bright).
 */
export function calculateSpectralCentroid(magnitudes: number[]): number {
  if (magnitudes.length === 0) return 0;
  let weightedSum = 0;
  let totalMag = 0;
  for (let i = 0; i < magnitudes.length; i += 1) {
    weightedSum += i * magnitudes[i];
    totalMag += magnitudes[i];
  }
  if (totalMag === 0) return 0;
  return Math.min(1, weightedSum / (totalMag * magnitudes.length));
}

/**
 * Calculate spectral flux between two magnitude frames.
 * Returns normalized change 0-1.
 */
export function calculateSpectralFlux(prev: number[], curr: number[]): number {
  const len = Math.min(prev.length, curr.length);
  if (len === 0) return 0;
  let flux = 0;
  for (let i = 0; i < len; i += 1) {
    const diff = curr[i] - prev[i];
    flux += diff > 0 ? diff : 0; // Half-wave rectified
  }
  return Math.min(1, flux / len);
}

/**
 * Split magnitude spectrum into 6 frequency bands.
 */
export function calculateBandEnergies(
  magnitudes: number[],
  sampleRate: number,
  fftSize: number,
): [number, number, number, number, number, number] {
  const binFreq = sampleRate / fftSize;
  const bands: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const bandRanges: [number, number][] = [
    [20, 60],     // sub-bass
    [60, 250],    // bass
    [250, 500],   // low-mid
    [500, 2000],  // mid
    [2000, 4000], // high-mid
    [4000, 20000], // high
  ];
  const bandCounts = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < magnitudes.length; i += 1) {
    const freq = i * binFreq;
    for (let b = 0; b < 6; b += 1) {
      if (freq >= bandRanges[b][0] && freq < bandRanges[b][1]) {
        bands[b] += magnitudes[i];
        bandCounts[b] += 1;
      }
    }
  }

  // Normalize each band
  const maxBand = Math.max(0.0001, ...bands);
  for (let b = 0; b < 6; b += 1) {
    bands[b] = bandCounts[b] > 0 ? Math.min(1, bands[b] / maxBand) : 0;
  }

  return bands;
}

// ==================== Onset Detection ====================

/**
 * Detect onsets from spectrum frames using spectral flux peaks.
 */
export function detectOnsets(
  spectrumFrames: SpectrumFrame[],
  threshold: number,
  minGapSeconds: number,
): OnsetEvent[] {
  if (spectrumFrames.length < 3) return [];

  const fluxes = spectrumFrames.map((f) => f.flux);
  const maxFlux = Math.max(0.0001, ...fluxes);
  const normalizedFluxes = fluxes.map((f) => f / maxFlux);

  const onsets: OnsetEvent[] = [];
  let lastOnsetTime = -Infinity;

  for (let i = 1; i < normalizedFluxes.length - 1; i += 1) {
    const isPeak =
      normalizedFluxes[i] > normalizedFluxes[i - 1] &&
      normalizedFluxes[i] >= normalizedFluxes[i + 1] &&
      normalizedFluxes[i] >= threshold;

    if (isPeak && spectrumFrames[i].time - lastOnsetTime >= minGapSeconds) {
      // Determine dominant band
      const bands = spectrumFrames[i].bandEnergies;
      const bandNames: OnsetEvent['band'][] = ['sub-bass', 'bass', 'low-mid', 'mid', 'high-mid', 'high'];
      let maxBandIdx = 0;
      for (let b = 1; b < 6; b += 1) {
        if (bands[b] > bands[maxBandIdx]) maxBandIdx = b;
      }

      onsets.push({
        time: spectrumFrames[i].time,
        strength: round(normalizedFluxes[i]),
        band: bandNames[maxBandIdx],
      });
      lastOnsetTime = spectrumFrames[i].time;
    }
  }

  return onsets;
}

// ==================== Tempo Estimation ====================

/**
 * Estimate tempo from onset times using autocorrelation of inter-onset intervals.
 */
export function estimateTempo(onsets: OnsetEvent[], minBpm: number, maxBpm: number): TempoEstimate | null {
  if (onsets.length < 4) return null;

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    intervals.push(onsets[i].time - onsets[i - 1].time);
  }

  if (intervals.length === 0) return null;

  // Build interval histogram
  const minInterval = 60 / maxBpm;
  const maxInterval = 60 / minBpm;
  const binWidth = 0.005; // 5ms resolution
  const numBins = Math.ceil((maxInterval - minInterval) / binWidth);
  const histogram = new Float64Array(numBins);

  for (const interval of intervals) {
    if (interval >= minInterval && interval <= maxInterval) {
      const bin = Math.floor((interval - minInterval) / binWidth);
      if (bin >= 0 && bin < numBins) {
        histogram[bin] += 1;
      }
      // Also count double and half intervals
      const halfBin = Math.floor((interval / 2 - minInterval) / binWidth);
      if (halfBin >= 0 && halfBin < numBins) histogram[halfBin] += 0.5;
      const doubleBin = Math.floor((interval * 2 - minInterval) / binWidth);
      if (doubleBin >= 0 && doubleBin < numBins) histogram[doubleBin] += 0.3;
    }
  }

  // Find peak
  let peakBin = 0;
  let peakValue = 0;
  for (let i = 0; i < numBins; i += 1) {
    if (histogram[i] > peakValue) {
      peakValue = histogram[i];
      peakBin = i;
    }
  }

  if (peakValue === 0) return null;

  const bestInterval = minInterval + peakBin * binWidth;
  const bpm = round(60 / bestInterval);
  const confidence = round(Math.min(1, peakValue / (intervals.length * 0.5)));

  // Estimate phase: find the best alignment
  let bestPhase = 0;
  let bestPhaseScore = 0;
  for (let phase = 0; phase < bestInterval; phase += binWidth) {
    let score = 0;
    for (const onset of onsets) {
      const beatPos = ((onset.time - phase) % bestInterval + bestInterval) % bestInterval;
      if (beatPos < binWidth * 2 || beatPos > bestInterval - binWidth * 2) {
        score += onset.strength;
      }
    }
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phase;
    }
  }

  return { bpm, confidence, phase: round(bestPhase) };
}

/**
 * Generate beat timestamps from tempo estimate.
 */
export function generateBeatTimes(
  tempo: TempoEstimate,
  duration: number,
): number[] {
  if (!tempo || tempo.bpm <= 0) return [];
  const interval = 60 / tempo.bpm;
  const beats: number[] = [];
  for (let t = tempo.phase; t < duration; t += interval) {
    beats.push(round(t));
  }
  return beats;
}

// ==================== Rhythm Pattern Classification ====================

/**
 * Classify rhythm pattern from onset intervals.
 */
export function classifyRhythmPattern(onsets: OnsetEvent[]): RhythmPattern {
  if (onsets.length < 3) {
    return { type: 'irregular', confidence: 0, avgInterval: 0, intervalVariance: 1 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    intervals.push(onsets[i].time - onsets[i - 1].time);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((acc, v) => acc + (v - avgInterval) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgInterval > 0 ? stdDev / avgInterval : 1; // Coefficient of variation

  // Check for buildup (decreasing intervals)
  let decreasingCount = 0;
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i] < intervals[i - 1] * 0.95) decreasingCount += 1;
  }
  const decreasingRatio = decreasingCount / Math.max(1, intervals.length - 1);

  // Check for breakdown (increasing intervals)
  let increasingCount = 0;
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i] > intervals[i - 1] * 1.05) increasingCount += 1;
  }
  const increasingRatio = increasingCount / Math.max(1, intervals.length - 1);

  if (decreasingRatio > 0.6) {
    return { type: 'buildup', confidence: round(decreasingRatio), avgInterval: round(avgInterval), intervalVariance: round(variance) };
  }
  if (increasingRatio > 0.6) {
    return { type: 'breakdown', confidence: round(increasingRatio), avgInterval: round(avgInterval), intervalVariance: round(variance) };
  }
  if (cv < 0.15) {
    return { type: 'steady', confidence: round(1 - cv), avgInterval: round(avgInterval), intervalVariance: round(variance) };
  }
  if (cv < 0.4) {
    return { type: 'syncopated', confidence: round(1 - cv * 2), avgInterval: round(avgInterval), intervalVariance: round(variance) };
  }

  return { type: 'irregular', confidence: round(cv), avgInterval: round(avgInterval), intervalVariance: round(variance) };
}

// ==================== Full Analysis Pipeline ====================

/**
 * Run full audio rhythm analysis on raw audio samples.
 *
 * @param audioSamples - Mono audio samples (-1 to 1)
 * @param sampleRate - Sample rate in Hz
 * @param config - Analysis configuration
 */
export function analyzeAudioRhythm(
  audioSamples: ArrayLike<number>,
  sampleRate: number,
  config: Partial<AudioRhythmConfig> = {},
): AudioRhythmResult {
  const cfg = { ...DEFAULT_AUDIO_RHYTHM_CONFIG, ...config, sampleRate };
  const samples = typeof audioSamples.length === 'number' ? audioSamples : { length: 0 };
  const totalSamples = samples.length;

  if (totalSamples < cfg.fftSize) {
    return {
      spectrumFrames: [],
      onsets: [],
      tempo: null,
      pattern: { type: 'irregular', confidence: 0, avgInterval: 0, intervalVariance: 0 },
      beatTimes: [],
      energyCurve: [],
      stats: { totalFrames: 0, onsetCount: 0, avgSpectralCentroid: 0, avgEnergy: 0 },
    };
  }

  // Compute spectrum frames
  const spectrumFrames: SpectrumFrame[] = [];
  let prevMagnitudes: number[] = [];

  for (let offset = 0; offset + cfg.fftSize <= totalSamples; offset += cfg.hopSize) {
    const time = round(offset / sampleRate);

    // Extract window
    const window: number[] = [];
    for (let i = 0; i < cfg.fftSize; i += 1) {
      window.push(audioSamples[offset + i]);
    }

    // Apply Hanning window
    const windowed = applyHanningWindow(window);

    // Compute magnitudes
    const magnitudes = computeMagnitudes(windowed);

    // Normalize magnitudes
    const maxMag = Math.max(0.0001, ...magnitudes);
    const normalizedMags = magnitudes.map((m) => m / maxMag);

    const centroid = calculateSpectralCentroid(normalizedMags);
    const flux = calculateSpectralFlux(prevMagnitudes, normalizedMags);
    const bandEnergies = calculateBandEnergies(normalizedMags, sampleRate, cfg.fftSize);

    spectrumFrames.push({ time, magnitudes: normalizedMags, centroid, flux, bandEnergies });
    prevMagnitudes = normalizedMags;
  }

  // Detect onsets
  const onsets = detectOnsets(spectrumFrames, cfg.onsetThreshold, cfg.minOnsetGap);

  // Estimate tempo
  const tempo = estimateTempo(onsets, cfg.minBpm, cfg.maxBpm);

  // Classify rhythm pattern
  const pattern = classifyRhythmPattern(onsets);

  // Generate beat times
  const duration = totalSamples / sampleRate;
  const beatTimes = tempo ? generateBeatTimes(tempo, duration) : [];

  // Build energy curve
  const energyCurve = spectrumFrames.map((f) => ({
    time: f.time,
    value: round(f.bandEnergies.reduce((a, b) => a + b, 0) / 6),
  }));

  // Stats
  const totalCentroid = spectrumFrames.reduce((s, f) => s + f.centroid, 0);
  const totalEnergy = energyCurve.reduce((s, e) => s + e.value, 0);

  return {
    spectrumFrames,
    onsets,
    tempo,
    pattern,
    beatTimes,
    energyCurve,
    stats: {
      totalFrames: spectrumFrames.length,
      onsetCount: onsets.length,
      avgSpectralCentroid: spectrumFrames.length > 0 ? round(totalCentroid / spectrumFrames.length) : 0,
      avgEnergy: energyCurve.length > 0 ? round(totalEnergy / energyCurve.length) : 0,
    },
  };
}

/**
 * Align visual highlights with audio rhythm markers.
 * Returns combined markers with boosted scores for audio-visual alignment.
 */
export function alignHighlightsWithRhythm(
  visualTimes: number[],
  audioBeatTimes: number[],
  toleranceSeconds = 0.2,
): Array<{ time: number; aligned: boolean; visualNearby: boolean; beatNearby: boolean }> {
  const allTimes = new Set<number>();
  for (const t of visualTimes) allTimes.add(round(t, 4));
  for (const t of audioBeatTimes) allTimes.add(round(t, 4));

  return [...allTimes].sort((a, b) => a - b).map((time) => {
    const visualNearby = visualTimes.some((vt) => Math.abs(vt - time) <= toleranceSeconds);
    const beatNearby = audioBeatTimes.some((bt) => Math.abs(bt - time) <= toleranceSeconds);
    return { time, aligned: visualNearby && beatNearby, visualNearby, beatNearby };
  });
}
