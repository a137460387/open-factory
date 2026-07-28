/**
 * Quality assessment - low-level analysis functions and grade mapping.
 *
 * Contains pixel-level image analysis (sharpness, noise, exposure, color balance)
 * and grade mapping utilities.
 */

import {clamp} from '../utils/math';

import type {
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

