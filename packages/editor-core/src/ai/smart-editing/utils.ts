/**
 * Smart editing utility functions
 */

import type { SmartEditingConfig, TransitionType } from './types';

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Compute array average
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0;
  return array.reduce((a, b) => a + b, 0) / array.length;
}

/**
 * Compute array standard deviation
 */
export function standardDeviation(array: number[]): number {
  if (array.length === 0) return 0;
  const avg = average(array);
  const squareDiffs = array.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Smooth array with sliding window
 */
export function smoothArray(array: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  for (let i = 0; i < array.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(array.length, i + Math.floor(windowSize / 2) + 1);
    const window = array.slice(start, end);
    result.push(average(window));
  }
  return result;
}

/**
 * Detect peaks in array
 */
export function detectPeaks(array: number[], threshold: number = 0.5): number[] {
  const peaks: number[] = [];
  const smoothed = smoothArray(array);

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) {
      if (smoothed[i] >= threshold) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

/**
 * Compute cosine similarity between two arrays
 */
export function computeSimilarity(array1: number[], array2: number[]): number {
  if (array1.length !== array2.length) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < array1.length; i++) {
    dotProduct += array1[i] * array2[i];
    norm1 += array1[i] * array1[i];
    norm2 += array2[i] * array2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Compute audio energy (RMS)
 */
export function computeAudioEnergy(audioData: Float32Array): number {
  let energy = 0;
  for (let i = 0; i < audioData.length; i++) {
    energy += audioData[i] * audioData[i];
  }
  return energy / audioData.length;
}

/**
 * Compute zero crossing rate
 */
export function computeZeroCrossingRate(audioData: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i] >= 0 && audioData[i - 1] < 0) || (audioData[i] < 0 && audioData[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (audioData.length - 1);
}

/**
 * Detect silence segments in audio
 */
export function detectSilence(
  audioData: Float32Array,
  sampleRate: number,
  threshold: number = 0.01,
  minDuration: number = 0.1,
): Array<{ start: number; end: number }> {
  const silenceSegments: Array<{ start: number; end: number }> = [];
  const frameSize = Math.floor(sampleRate * 0.025);
  const hopSize = Math.floor(frameSize / 2);

  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    const energy = computeAudioEnergy(frame);

    if (energy < threshold) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = i / sampleRate;
      }
    } else {
      if (inSilence) {
        const silenceEnd = i / sampleRate;
        const duration = silenceEnd - silenceStart;

        if (duration >= minDuration) {
          silenceSegments.push({ start: silenceStart, end: silenceEnd });
        }

        inSilence = false;
      }
    }
  }

  if (inSilence) {
    const silenceEnd = audioData.length / sampleRate;
    const duration = silenceEnd - silenceStart;

    if (duration >= minDuration) {
      silenceSegments.push({ start: silenceStart, end: silenceEnd });
    }
  }

  return silenceSegments;
}

/**
 * Default smart editing configuration
 * @internal
 */
export const DEFAULT_SMART_EDITING_CONFIG: SmartEditingConfig = {
  enableRhythmMatching: true,
  enableEmotionAwareness: true,
  enableAutoTrailer: true,
  enableSmartSorting: true,
  rhythmMatchPrecision: 0.8,
  emotionAnalysisPrecision: 0.7,
  minCutInterval: 0.5,
  maxCutInterval: 10,
  defaultTransition: 'cross-dissolve',
};

/**
 * Create default smart editing config
 */
export function createDefaultSmartEditingConfig(): SmartEditingConfig {
  return { ...DEFAULT_SMART_EDITING_CONFIG };
}

/**
 * Validate smart editing config
 */
export function validateSmartEditingConfig(config: SmartEditingConfig): boolean {
  return (
    typeof config.enableRhythmMatching === 'boolean' &&
    typeof config.enableEmotionAwareness === 'boolean' &&
    typeof config.enableAutoTrailer === 'boolean' &&
    typeof config.enableSmartSorting === 'boolean' &&
    typeof config.rhythmMatchPrecision === 'number' &&
    typeof config.emotionAnalysisPrecision === 'number' &&
    typeof config.minCutInterval === 'number' &&
    typeof config.maxCutInterval === 'number' &&
    typeof config.defaultTransition === 'string'
  );
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
