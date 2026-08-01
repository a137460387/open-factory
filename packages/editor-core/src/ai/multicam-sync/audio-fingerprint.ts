/**
 * Audio fingerprint generation and sync
 */

import type { AudioFingerprint } from './types';

/**
 * Generate audio fingerprint from audio sample data.
 * Uses a simplified hash algorithm based on spectral features (similar to Shazam).
 */
export function generateAudioFingerprint(
  angleId: string,
  samples: Float32Array,
  sampleRate: number,
  hashRate: number = 10,
): AudioFingerprint {
  const duration = samples.length / sampleRate;
  const hashCount = Math.floor(duration * hashRate);
  const hashes = new Uint32Array(hashCount);
  const samplesPerHash = Math.floor(sampleRate / hashRate);

  // Energy envelope
  const envelopeLength = Math.floor(duration * 10); // 10Hz sampling
  const energyEnvelope = new Float32Array(envelopeLength);
  const samplesPerEnvelope = Math.floor(sampleRate / 10);

  for (let i = 0; i < hashCount; i++) {
    const start = i * samplesPerHash;
    const end = Math.min(start + samplesPerHash, samples.length);

    const bands = computeFrequencyBands(samples, start, end, sampleRate);
    hashes[i] = hashFrequencyBands(bands);
  }

  for (let i = 0; i < envelopeLength; i++) {
    const start = i * samplesPerEnvelope;
    const end = Math.min(start + samplesPerEnvelope, samples.length);
    let energy = 0;
    for (let j = start; j < end; j++) {
      energy += samples[j] * samples[j];
    }
    energyEnvelope[i] = Math.sqrt(energy / (end - start));
  }

  return { angleId, hashes, hashRate, duration, energyEnvelope };
}

/**
 * Compute frequency band energies.
 * Splits signal into 6 bands: sub-bass, bass, low-mid, mid, high-mid, high
 */
function computeFrequencyBands(samples: Float32Array, start: number, end: number, sampleRate: number): number[] {
  const bandCount = 6;
  const bands = new Array(bandCount).fill(0);
  const fftSize = Math.min(end - start, 1024);
  if (fftSize < 16) return bands;

  // Simplified spectral analysis (no FFT, based on zero-crossing rate and energy distribution)
  let zeroCrossings = 0;
  let totalEnergy = 0;
  let lowEnergy = 0;
  let highEnergy = 0;

  for (let i = start; i < end - 1; i++) {
    const sample = samples[i];
    const nextSample = samples[i + 1];
    totalEnergy += sample * sample;
    if (sample * nextSample < 0) zeroCrossings++;

    // Low frequency energy (smoothed signal)
    const idx = i - start;
    if (idx % 4 === 0) lowEnergy += sample * sample;
    // High frequency energy (differential signal)
    highEnergy += (sample - nextSample) * (sample - nextSample);
  }

  const normalizedZCR = zeroCrossings / (end - start);
  const energyRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0.5;

  // Assign to bands based on zero-crossing rate and energy distribution
  bands[0] = totalEnergy * (1 - normalizedZCR) * 0.3; // sub-bass
  bands[1] = totalEnergy * energyRatio * 0.3; // bass
  bands[2] = totalEnergy * 0.15; // low-mid
  bands[3] = totalEnergy * 0.1; // mid
  bands[4] = highEnergy * 0.05; // high-mid
  bands[5] = highEnergy * normalizedZCR * 0.02; // high

  return bands;
}

/**
 * Hash frequency band features into a 32-bit integer
 */
function hashFrequencyBands(bands: number[]): number {
  // Quantize each band into 4 levels
  const maxBand = Math.max(...bands, 1);
  let hash = 0;
  for (let i = 0; i < bands.length; i++) {
    const quantized = Math.min(3, Math.floor((bands[i] / maxBand) * 4));
    hash |= quantized << (i * 4);
  }
  // Add time perturbation
  hash ^= hash >>> 16;
  hash *= 0x45d9f3b;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Align two angles using audio fingerprints.
 * Uses cross-correlation of hash sequences to find optimal offset.
 */
export function syncByAudioFingerprint(
  reference: AudioFingerprint,
  candidate: AudioFingerprint,
): { offset: number; confidence: number } {
  const maxOffsetHashes = Math.floor(Math.max(reference.duration, candidate.duration) * reference.hashRate);
  const searchRange = Math.min(maxOffsetHashes, reference.hashes.length, candidate.hashes.length);

  let bestOffset = 0;
  let bestScore = 0;
  const step = Math.max(1, Math.floor(searchRange / 1000)); // sampled search

  for (let offset = -searchRange; offset <= searchRange; offset += step) {
    let matches = 0;
    let total = 0;

    for (let i = 0; i < reference.hashes.length; i++) {
      const j = i + offset;
      if (j < 0 || j >= candidate.hashes.length) continue;
      total++;
      // Hamming distance
      const xor = reference.hashes[i] ^ candidate.hashes[j];
      const hammingDist = popcount(xor);
      if (hammingDist <= 8) matches++; // allow partial match
    }

    const score = total > 0 ? matches / total : 0;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  // Fine-grained search
  const fineRange = step * 2;
  for (let offset = bestOffset - fineRange; offset <= bestOffset + fineRange; offset++) {
    let matches = 0;
    let total = 0;
    for (let i = 0; i < reference.hashes.length; i++) {
      const j = i + offset;
      if (j < 0 || j >= candidate.hashes.length) continue;
      total++;
      const xor = reference.hashes[i] ^ candidate.hashes[j];
      if (popcount(xor) <= 8) matches++;
    }
    const score = total > 0 ? matches / total : 0;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  const offsetSeconds = bestOffset / reference.hashRate;
  return { offset: offsetSeconds, confidence: bestScore };
}

/**
 * Compute popcount (number of set bits) of a 32-bit integer
 */
function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
