/**
 * Visual feature extraction and sync
 */

import type { ImageData, VisualFeature } from './types';

/**
 * Extract visual features from an image frame
 */
export function extractVisualFeature(
  angleId: string,
  frame: ImageData,
  frameIndex: number,
  timestamp: number,
): VisualFeature {
  const { data, width, height } = frame;
  const pixelCount = width * height;

  // Color histogram (RGB 16 bins each)
  const colorHistogram = new Float32Array(16 * 3);
  for (let i = 0; i < data.length; i += 4) {
    colorHistogram[data[i] >> 4]++;
    colorHistogram[16 + (data[i + 1] >> 4)]++;
    colorHistogram[32 + (data[i + 2] >> 4)]++;
  }
  // Normalize
  for (let i = 0; i < colorHistogram.length; i++) {
    colorHistogram[i] /= pixelCount;
  }

  // Edge orientation histogram (simplified Sobel)
  const edgeHistogram = new Float32Array(8); // 8 direction bins
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumR =
        0.299 * data[(y * width + x + 1) * 4] +
        0.587 * data[(y * width + x + 1) * 4 + 1] +
        0.114 * data[(y * width + x + 1) * 4 + 2];
      const lumB =
        0.299 * data[((y + 1) * width + x) * 4] +
        0.587 * data[((y + 1) * width + x) * 4 + 1] +
        0.114 * data[((y + 1) * width + x) * 4 + 2];
      const gx = lumR - lum;
      const gy = lumB - lum;
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > 20) {
        const angle = Math.atan2(gy, gx);
        const bin = (((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
        edgeHistogram[Math.floor(bin)] += mag;
      }
    }
  }
  const edgeSum = edgeHistogram.reduce((s, v) => s + v, 0);
  if (edgeSum > 0) {
    for (let i = 0; i < edgeHistogram.length; i++) edgeHistogram[i] /= edgeSum;
  }

  // Brightness
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const brightness = totalBrightness / pixelCount / 255;

  // Scene complexity (based on edge density and color diversity)
  const edgeDensity = edgeSum / (pixelCount / 4);
  const colorVariance = computeColorVariance(data, pixelCount);
  const complexity = Math.min(1, (edgeDensity / 50 + colorVariance) / 2);

  return {
    angleId,
    frameIndex,
    timestamp,
    colorHistogram,
    edgeHistogram,
    motionScore: 0, // requires comparison with adjacent frames
    brightness,
    complexity,
  };
}

function computeColorVariance(data: Uint8ClampedArray, pixelCount: number): number {
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;

  let varR = 0,
    varG = 0,
    varB = 0;
  for (let i = 0; i < data.length; i += 16) {
    // sampled
    varR += (data[i] - avgR) ** 2;
    varG += (data[i + 1] - avgG) ** 2;
    varB += (data[i + 2] - avgB) ** 2;
  }
  const sampled = pixelCount / 4;
  return Math.min(1, (Math.sqrt(varR / sampled) + Math.sqrt(varG / sampled) + Math.sqrt(varB / sampled)) / 384);
}

/**
 * Compute visual similarity between two features (0-1)
 */
export function computeVisualSimilarity(a: VisualFeature, b: VisualFeature): number {
  // Color histogram similarity (chi-squared distance)
  let chiSq = 0;
  for (let i = 0; i < a.colorHistogram.length; i++) {
    const sum = a.colorHistogram[i] + b.colorHistogram[i];
    if (sum > 0) {
      const diff = a.colorHistogram[i] - b.colorHistogram[i];
      chiSq += (diff * diff) / sum;
    }
  }
  const colorSimilarity = Math.exp(-chiSq * 2);

  // Edge histogram similarity
  let edgeDiff = 0;
  for (let i = 0; i < a.edgeHistogram.length; i++) {
    edgeDiff += Math.abs(a.edgeHistogram[i] - b.edgeHistogram[i]);
  }
  const edgeSimilarity = 1 - Math.min(1, edgeDiff);

  // Brightness similarity
  const brightnessSimilarity = 1 - Math.abs(a.brightness - b.brightness);

  return colorSimilarity * 0.5 + edgeSimilarity * 0.3 + brightnessSimilarity * 0.2;
}

/**
 * Align two angles using visual features.
 * Uses cross-correlation of color histograms and edge features.
 */
export function syncByVisualFeature(
  referenceFeatures: VisualFeature[],
  candidateFeatures: VisualFeature[],
  fps: number,
): { offset: number; confidence: number } {
  if (referenceFeatures.length === 0 || candidateFeatures.length === 0) {
    return { offset: 0, confidence: 0 };
  }

  // Search for best offset (frame-level)
  const maxOffsetFrames = Math.min(Math.floor(referenceFeatures.length / 2), Math.floor(candidateFeatures.length / 2));

  let bestOffset = 0;
  let bestScore = 0;

  for (let offset = -maxOffsetFrames; offset <= maxOffsetFrames; offset++) {
    let totalSimilarity = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(referenceFeatures.length / 100));

    for (let i = 0; i < referenceFeatures.length; i += step) {
      const j = i + offset;
      if (j < 0 || j >= candidateFeatures.length) continue;
      totalSimilarity += computeVisualSimilarity(referenceFeatures[i], candidateFeatures[j]);
      count++;
    }

    const avgSimilarity = count > 0 ? totalSimilarity / count : 0;
    if (avgSimilarity > bestScore) {
      bestScore = avgSimilarity;
      bestOffset = offset;
    }
  }

  return {
    offset: bestOffset / fps,
    confidence: bestScore,
  };
}
