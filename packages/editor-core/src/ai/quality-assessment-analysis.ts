/**
 * Quality assessment - low-level analysis functions and core evaluation.
 *
 * Contains pixel-level image analysis (sharpness, noise, exposure, color balance),
 * grade mapping utilities, and the three main evaluation entry points:
 * assessVideoQuality, assessAudioQuality, assessFrameQuality.
 */

import {clamp} from '../utils/math';

import type {
  VideoQualityMetrics,
  AudioQualityMetrics,
  FrameQualityScore,
  QualityAssessmentConfig,
  EnhancedQualityGrade,
} from './quality-assessment-types.js';

// ==================== Private Helpers ====================

/**
 * Extract RGB components from a flat RGBA array.
 * @param frame - flat RGBA pixel array
 * @param pixelIndex - pixel index (0-based)
 * @returns [r, g, b] components
 */
function getRGB(frame: Uint8Array, pixelIndex: number): [number, number, number] {
  const offset = pixelIndex * 4;
  return [frame[offset], frame[offset + 1], frame[offset + 2]];
}

/**
 * Compute pixel luminance (ITU-R BT.601).
 * @param r - red component (0-255)
 * @param g - green component (0-255)
 * @param b - blue component (0-255)
 * @returns luminance value (0-255)
 */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Clamp dB value to common audio range.
 * @param db - input dB value
 * @returns clamped dB value
 */
function clampDb(db: number): number {
  return clamp(db, -100, 0);
}

// ==================== Low-level Analysis ====================

/**
 * Compute image sharpness using Laplacian variance.
 *
 * Applies a 3x3 Laplacian kernel to the luminance channel, then computes variance.
 * Higher variance means richer edges and sharper image.
 *
 * @param frame - flat RGBA pixel array
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @returns sharpness value (0-100)
 */
export function computeImageSharpness(frame: Uint8Array, width: number, height: number): number {
  if (frame.length < width * height * 4 || width < 3 || height < 3) {
    return 0;
  }

  // 3x3 Laplacian kernel
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];

  // Convert to luminance map
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = getRGB(frame, i);
    gray[i] = luminance(r, g, b);
  }

  // Convolve inner pixels (skip 1-pixel border)
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let conv = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          conv += gray[(y + ky) * width + (x + kx)] * kernel[ki];
          ki++;
        }
      }
      sum += conv;
      sumSq += conv * conv;
      count++;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  // Empirical mapping: variance 0~2000 maps to 0~100
  const normalized = clamp(variance / 2000, 0, 1);
  return Math.round(normalized * 100);
}

/**
 * Estimate noise level using Laplacian MAD.
 *
 * Uses the Median Absolute Deviation of high-frequency components
 * to robustly estimate Gaussian noise standard deviation.
 *
 * @param frame - flat RGBA pixel array
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @returns noise level (0-100), higher means noisier
 */
export function estimateNoiseLevel(frame: Uint8Array, width: number, height: number): number {
  if (frame.length < width * height * 4 || width < 3 || height < 3) {
    return 0;
  }

  // Convert to luminance map
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = getRGB(frame, i);
    gray[i] = luminance(r, g, b);
  }

  // Extract high-frequency components using Laplacian
  const highFreq: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = gray[y * width + x];
      const laplacian =
        -4 * center +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] +
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)];
      highFreq.push(Math.abs(laplacian));
    }
  }

  if (highFreq.length === 0) return 0;

  // Compute MAD (Median Absolute Deviation)
  highFreq.sort((a, b) => a - b);
  const median = highFreq[Math.floor(highFreq.length / 2)];
  const absDeviations = highFreq.map((v) => Math.abs(v - median));
  absDeviations.sort((a, b) => a - b);
  const mad = absDeviations[Math.floor(absDeviations.length / 2)];

  // sigma = 1.4826 * MAD (robust noise estimate)
  const sigma = 1.4826 * mad;

  // Empirical mapping: sigma 0~50 maps to 0~100
  const normalized = clamp(sigma / 50, 0, 1);
  return Math.round(normalized * 100);
}

/**
 * Analyze exposure.
 *
 * Computes mean luminance, overexposed pixel ratio, and underexposed pixel ratio.
 * Overexposed: luminance > 245; underexposed: luminance < 10.
 *
 * @param frame - flat RGBA pixel array
 * @returns { mean, overexposed, underexposed }
 */
export function analyzeExposure(frame: Uint8Array): {
  mean: number;
  overexposed: number;
  underexposed: number;
} {
  const pixelCount = Math.floor(frame.length / 4);
  if (pixelCount === 0) {
    return { mean: 0, overexposed: 0, underexposed: 0 };
  }

  let sumLum = 0;
  let overCount = 0;
  let underCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const [r, g, b] = getRGB(frame, i);
    const lum = luminance(r, g, b);
    sumLum += lum;
    if (lum > 245) overCount++;
    if (lum < 10) underCount++;
  }

  return {
    mean: sumLum / pixelCount,
    overexposed: overCount / pixelCount,
    underexposed: underCount / pixelCount,
  };
}

/**
 * Compute color balance (white balance).
 *
 * Computes average channel values in the center 60% of the image.
 * Ideal white balance has R/G/B means close to equal.
 *
 * @param frame - flat RGBA pixel array
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @returns { r, g, b } average channel values (0-255)
 */
export function computeColorBalance(
  frame: Uint8Array,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const pixelCount = Math.floor(frame.length / 4);
  if (pixelCount === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  // Use center 60% to avoid border interference
  const marginX = Math.floor(width * 0.2);
  const marginY = Math.floor(height * 0.2);
  const innerWidth = width - marginX * 2;
  const innerHeight = height - marginY * 2;

  if (innerWidth <= 0 || innerHeight <= 0) {
    // Fallback: use full image
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let i = 0; i < pixelCount; i++) {
      const [r, g, b] = getRGB(frame, i);
      sumR += r;
      sumG += g;
      sumB += b;
    }
    return {
      r: sumR / pixelCount,
      g: sumG / pixelCount,
      b: sumB / pixelCount,
    };
  }

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = marginY; y < height - marginY; y++) {
    for (let x = marginX; x < width - marginX; x++) {
      const [r, g, b] = getRGB(frame, y * width + x);
      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0 };

  return {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
  };
}

/**
 * Map score to enhanced quality grade.
 *
 * @param score - overall score (0-100)
 * @returns quality grade S/A/B/C/D/F
 */
export function mapScoreToEnhancedGrade(score: number): EnhancedQualityGrade {
  const s = clamp(score, 0, 100);
  if (s >= 95) return 'S';
  if (s >= 85) return 'A';
  if (s >= 70) return 'B';
  if (s >= 55) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

/**
 * Map dimension score to grade text.
 *
 * @param score - dimension score (0-100)
 * @returns grade text
 */
export function dimensionScoreToGrade(score: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'excellent';
  if (s >= 75) return 'good';
  if (s >= 60) return 'acceptable';
  return 'poor';
}

// ==================== Core Evaluation ====================

/**
 * Evaluate video quality.
 *
 * Samples multiple frames, computes sharpness, noise, exposure, contrast,
 * saturation, color balance, and stability. Each metric is averaged across frames.
 *
 * @param frames - list of flat RGBA pixel arrays (one per frame)
 * @param config - quality assessment configuration
 * @returns video quality metrics
 */
export function assessVideoQuality(frames: Uint8Array[], config: QualityAssessmentConfig): VideoQualityMetrics {
  if (frames.length === 0) {
    return {
      sharpness: 0,
      noise: 0,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      colorBalance: 0,
      stability: 0,
      bitrate: 0,
      resolution: { width: 0, height: 0 },
      frameRate: 0,
    };
  }

  // Sample: pick up to sampleCount frames uniformly
  const sampleCount = clamp(config.sampleCount, 1, frames.length);
  const step = Math.max(1, Math.floor(frames.length / sampleCount));
  const sampledFrames: Uint8Array[] = [];
  for (let i = 0; i < frames.length && sampledFrames.length < sampleCount; i += step) {
    sampledFrames.push(frames[i]);
  }

  // Infer dimensions from first frame (assume 16:9 aspect ratio)
  const firstFrame = sampledFrames[0];
  const pixelCount = Math.floor(firstFrame.length / 4);
  const aspectRatio = 16 / 9;
  const height = Math.round(Math.sqrt(pixelCount / aspectRatio));
  const width = Math.round(pixelCount / Math.max(height, 1));

  // Per-frame metric computation
  const sharpnessValues: number[] = [];
  const noiseValues: number[] = [];
  const exposureValues: number[] = [];
  const contrastValues: number[] = [];
  const saturationValues: number[] = [];
  const colorBalanceScores: number[] = [];

  for (const frame of sampledFrames) {
    // Sharpness
    sharpnessValues.push(computeImageSharpness(frame, width, height));

    // Noise
    noiseValues.push(estimateNoiseLevel(frame, width, height));

    // Exposure
    const exposureResult = analyzeExposure(frame);
    const meanDist = Math.abs(exposureResult.mean - 128) / 128;
    const overPenalty = exposureResult.overexposed * 50;
    const underPenalty = exposureResult.underexposed * 50;
    const exposureScore = clamp(100 - meanDist * 30 - overPenalty - underPenalty, 0, 100);
    exposureValues.push(exposureScore);

    // Contrast (luminance standard deviation)
    const grayValues: number[] = [];
    const pc = Math.floor(frame.length / 4);
    for (let p = 0; p < pc; p++) {
      const [r, g, b] = getRGB(frame, p);
      grayValues.push(luminance(r, g, b));
    }
    const lumMean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;
    const lumVariance = grayValues.reduce((a, b) => a + (b - lumMean) * (b - lumMean), 0) / grayValues.length;
    const lumStd = Math.sqrt(lumVariance);
    const contrastScore = clamp((lumStd / 80) * 100, 0, 100);
    contrastValues.push(contrastScore);

    // Saturation (HSV saturation mean)
    let satSum = 0;
    for (let p = 0; p < pc; p++) {
      const [r, g, b] = getRGB(frame, p);
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const maxC = Math.max(rn, gn, bn);
      const minC = Math.min(rn, gn, bn);
      const delta = maxC - minC;
      satSum += maxC > 0 ? delta / maxC : 0;
    }
    const avgSat = satSum / pc;
    const satScore =
      avgSat < 0.2
        ? clamp(avgSat / 0.2, 0, 1) * 70 + 15
        : avgSat > 0.5
          ? clamp(1 - (avgSat - 0.5) / 0.5, 0, 1) * 70 + 15
          : 85;
    saturationValues.push(satScore);

    // Color balance
    const balance = computeColorBalance(frame, width, height);
    const avgChannel = (balance.r + balance.g + balance.b) / 3;
    if (avgChannel > 0) {
      const rDev = Math.abs(balance.r - avgChannel) / avgChannel;
      const gDev = Math.abs(balance.g - avgChannel) / avgChannel;
      const bDev = Math.abs(balance.b - avgChannel) / avgChannel;
      const avgDev = (rDev + gDev + bDev) / 3;
      colorBalanceScores.push(clamp(100 - avgDev * 200, 0, 100));
    } else {
      colorBalanceScores.push(50);
    }
  }

  // Stability: based on inter-frame difference
  let stabilityScore = 100;
  if (sampledFrames.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < sampledFrames.length; i++) {
      const prev = sampledFrames[i - 1];
      const curr = sampledFrames[i];
      const len = Math.min(prev.length, curr.length);
      let diffSum = 0;
      const samplePixels = Math.min(len, 10000);
      const pixelStep = Math.max(1, Math.floor(len / samplePixels));
      let diffCount = 0;
      for (let j = 0; j < len; j += pixelStep) {
        diffSum += Math.abs(curr[j] - prev[j]);
        diffCount++;
      }
      diffs.push(diffSum / diffCount);
    }
    const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    stabilityScore = clamp(100 - (meanDiff / 30) * 100, 0, 100);
  }

  // Aggregate: take mean
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return {
    sharpness: Math.round(avg(sharpnessValues)),
    noise: Math.round(avg(noiseValues)),
    exposure: Math.round(avg(exposureValues)),
    contrast: Math.round(avg(contrastValues)),
    saturation: Math.round(avg(saturationValues)),
    colorBalance: Math.round(avg(colorBalanceScores)),
    stability: Math.round(stabilityScore),
    bitrate: 0,
    resolution: { width, height },
    frameRate: 0,
  };
}

/**
 * Evaluate audio quality.
 *
 * Analyzes RMS level, peak, noise floor, dynamic range, clipping, and distortion.
 *
 * @param audioData - audio sample data (-1.0 ~ 1.0)
 * @param sampleRate - sample rate (Hz)
 * @param config - quality assessment configuration
 * @returns audio quality metrics
 */
export function assessAudioQuality(
  audioData: Float32Array,
  sampleRate: number,
  config: QualityAssessmentConfig,
): AudioQualityMetrics {
  if (audioData.length === 0) {
    return {
      rmsLevel: -100,
      peakLevel: -100,
      noiseFloor: -100,
      dynamicRange: 0,
      clipping: false,
      distortion: 0,
      frequencyBalance: 50,
    };
  }

  const sr = clamp(sampleRate, 8000, 192000);

  // --- RMS Level ---
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < audioData.length; i++) {
    const sample = audioData[i];
    sumSq += sample * sample;
    const absSample = Math.abs(sample);
    if (absSample > peak) peak = absSample;
  }
  const rms = Math.sqrt(sumSq / audioData.length);
  const rmsDb = rms > 0 ? clampDb(20 * Math.log10(rms)) : -100;
  const peakDb = peak > 0 ? clampDb(20 * Math.log10(peak)) : -100;

  // --- Clipping Detection ---
  let clipCount = 0;
  let maxClipRun = 0;
  let currentClipRun = 0;
  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) > 0.99) {
      currentClipRun++;
      clipCount++;
      if (currentClipRun > maxClipRun) maxClipRun = currentClipRun;
    } else {
      currentClipRun = 0;
    }
  }
  const clipping = maxClipRun >= 3 || clipCount > audioData.length * 0.001;

  // --- Noise Floor Estimation ---
  const frameSize = Math.max(Math.round(sr * 0.02), 64); // 20ms frames
  const frameRmsValues: number[] = [];
  for (let i = 0; i + frameSize <= audioData.length; i += frameSize) {
    let frameSumSq = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = audioData[i + j];
      frameSumSq += s * s;
    }
    const frameRms = Math.sqrt(frameSumSq / frameSize);
    if (frameRms > 0) {
      frameRmsValues.push(20 * Math.log10(frameRms));
    }
  }

  let noiseFloorDb = -100;
  if (frameRmsValues.length > 0) {
    frameRmsValues.sort((a, b) => a - b);
    const noiseFrameCount = Math.max(1, Math.floor(frameRmsValues.length * 0.1));
    const noiseFrames = frameRmsValues.slice(0, noiseFrameCount);
    noiseFloorDb = clampDb(noiseFrames[Math.floor(noiseFrames.length / 2)]);
  }

  // --- Dynamic Range ---
  const dynamicRange = clamp(peakDb - noiseFloorDb, 0, 120);

  // --- Distortion Estimation ---
  let distortion = 0;
  if (clipping) {
    distortion = clamp((clipCount / audioData.length) * 1000, 10, 100);
  }
  const crestFactor = rms > 0 ? 20 * Math.log10(peak / rms) : 0;
  if (crestFactor > 25) {
    distortion = Math.max(distortion, clamp((crestFactor - 25) * 5, 0, 50));
  }

  // --- Frequency Balance ---
  const fftSize = 2048;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;

  const segCount = Math.min(Math.floor(audioData.length / fftSize), 20);
  let freqBalanceScore: number;
  if (segCount > 0) {
    const segStep = Math.floor(audioData.length / segCount);
    for (let seg = 0; seg < segCount; seg++) {
      const offset = seg * segStep;
      for (let i = 0; i < fftSize && offset + i < audioData.length; i++) {
        const sample = audioData[offset + i];
        const energy = sample * sample;
        const normalizedPos = i / fftSize;
        const freq = normalizedPos * sr;
        if (freq < 300) {
          lowEnergy += energy;
        } else if (freq < 4000) {
          midEnergy += energy;
        } else {
          highEnergy += energy;
        }
      }
    }

    const totalEnergy = lowEnergy + midEnergy + highEnergy;
    if (totalEnergy > 0) {
      const lowRatio = lowEnergy / totalEnergy;
      const midRatio = midEnergy / totalEnergy;
      const highRatio = highEnergy / totalEnergy;
      const lowPenalty = Math.abs(lowRatio - 0.3) * 100;
      const midPenalty = Math.abs(midRatio - 0.5) * 100;
      const highPenalty = Math.abs(highRatio - 0.2) * 100;
      freqBalanceScore = clamp(100 - (lowPenalty + midPenalty + highPenalty) * 0.8, 0, 100);
    } else {
      freqBalanceScore = 50;
    }
  } else {
    freqBalanceScore = 50;
  }

  return {
    rmsLevel: Math.round(rmsDb * 10) / 10,
    peakLevel: Math.round(peakDb * 10) / 10,
    noiseFloor: Math.round(noiseFloorDb * 10) / 10,
    dynamicRange: Math.round(dynamicRange * 10) / 10,
    clipping,
    distortion: Math.round(distortion),
    frequencyBalance: Math.round(freqBalanceScore),
  };
}

/**
 * Evaluate single frame quality.
 *
 * Computes sharpness, noise cleanliness, and exposure score, then produces
 * a weighted overall score.
 *
 * @param frame - flat RGBA pixel array
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @returns frame quality score
 */
export function assessFrameQuality(frame: Uint8Array, width: number, height: number): FrameQualityScore {
  const sharpness = computeImageSharpness(frame, width, height);

  // Noise cleanliness: invert raw noise (higher raw = worse, higher clean = better)
  const rawNoise = estimateNoiseLevel(frame, width, height);
  const noiseCleanliness = clamp(100 - rawNoise, 0, 100);

  // Exposure score
  const exposureResult = analyzeExposure(frame);
  const meanDist = Math.abs(exposureResult.mean - 128) / 128;
  const overPenalty = exposureResult.overexposed * 50;
  const underPenalty = exposureResult.underexposed * 50;
  const exposureScore = clamp(100 - meanDist * 30 - overPenalty - underPenalty, 0, 100);

  // Overall: sharpness 40%, cleanliness 30%, exposure 30%
  const overallScore = Math.round(sharpness * 0.4 + noiseCleanliness * 0.3 + exposureScore * 0.3);

  return {
    frameIndex: 0,
    timestamp: 0,
    sharpness,
    noise: noiseCleanliness,
    exposure: Math.round(exposureScore),
    overallScore: clamp(overallScore, 0, 100),
  };
}
