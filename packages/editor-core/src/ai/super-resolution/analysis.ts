/**
 * Image feature analysis for model selection and parameter optimization
 */

import type { ImageData, SuperResolutionModel, UpscaleFactor } from './types';

interface ImageFeatures {
  averageBrightness: number;
  contrast: number;
  sharpness: number;
  noiseLevel: number;
  isAnimeStyle: boolean;
  edgeDensity: number;
  colorComplexity: number;
}

/**
 * 分析图像特征，用于模型选择和参数优化
 */
export function analyzeImageFeatures(data: Uint8ClampedArray, width: number, height: number): ImageFeatures {
  let totalBrightness = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  const pixelCount = width * height;

  // 亮度统计
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalBrightness += lum;
    if (lum < minBrightness) minBrightness = lum;
    if (lum > maxBrightness) maxBrightness = lum;
  }
  const averageBrightness = totalBrightness / pixelCount / 255;
  const contrast = (maxBrightness - minBrightness) / 255;

  // 边缘密度（Sobel 简化）
  let edgeSum = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const idxR = (y * width + x + 1) * 4;
      const idxB = ((y + 1) * width + x) * 4;
      const lumC = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      const lumB = 0.299 * data[idxB] + 0.587 * data[idxB + 1] + 0.114 * data[idxB + 2];
      edgeSum += Math.abs(lumR - lumC) + Math.abs(lumB - lumC);
    }
  }
  const sampledPixels = Math.ceil((width - 2) / 2) * Math.ceil((height - 2) / 2);
  const edgeDensity = Math.min(1, edgeSum / sampledPixels / 255);

  // 噪声估计（局部方差）
  let noiseSum = 0;
  let noiseCount = 0;
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const neighbors: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          neighbors.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        }
      }
      const mean = neighbors.reduce((s, v) => s + v, 0) / 9;
      const variance = neighbors.reduce((s, v) => s + (v - mean) ** 2, 0) / 9;
      noiseSum += Math.sqrt(variance);
      noiseCount++;
    }
  }
  const noiseLevel = noiseCount > 0 ? Math.min(1, noiseSum / noiseCount / 64) : 0;

  // 色彩复杂度
  const colorSet = new Set<number>();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] >> 4;
    const g = data[i + 1] >> 4;
    const b = data[i + 2] >> 4;
    colorSet.add((r << 8) | (g << 4) | b);
  }
  const colorComplexity = Math.min(1, colorSet.size / 4096);

  // 动漫风格检测（基于边缘锐度和色彩纯度）
  const isAnimeStyle = edgeDensity > 0.15 && colorComplexity < 0.4 && contrast > 0.6;

  return {
    averageBrightness,
    contrast,
    sharpness: edgeDensity,
    noiseLevel,
    isAnimeStyle,
    edgeDensity,
    colorComplexity,
  };
}

/**
 * 根据图像特征自动选择最优模型
 */
export function selectOptimalModel(imageData: ImageData, scaleFactor: UpscaleFactor): SuperResolutionModel {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  // 分析图像特征
  const features = analyzeImageFeatures(data, width, height);

  // 小图像使用更强的模型
  if (totalPixels < 640 * 480) {
    return scaleFactor === 2 ? 'realesrgan-x2plus' : 'esrgan-x4';
  }

  // 动漫/插画风格使用动漫优化模型
  if (features.isAnimeStyle) {
    return 'realesrgan-x4-anime';
  }

  // 默认使用 Real-ESRGAN
  return scaleFactor === 2 ? 'realesrgan-x2plus' : 'realesrgan-x4plus';
}
