/**
 * Color analysis and repair: white balance, exposure compensation, contrast enhancement
 */

import type { ColorProfile, ImageData } from './types';

/**
 * 分析帧的色彩特征
 */
export function analyzeColorProfile(data: Uint8ClampedArray, width: number, height: number): ColorProfile {
  const pixelCount = width * height;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalLum = 0;
  let shadowCount = 0;
  let highlightCount = 0;

  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalR += r;
    totalG += g;
    totalB += b;
    totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
    histR[r]++;
    histG[g]++;
    histB[b]++;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 16) shadowCount++;
    if (lum > 240) highlightCount++;
  }

  const avgR = totalR / pixelCount;
  const avgG = totalG / pixelCount;
  const avgB = totalB / pixelCount;
  const avgLum = totalLum / pixelCount / 255;
  const avgGray = (avgR + avgG + avgB) / 3;

  // 色温估计（基于 R/B 比率）
  const colorTemperature = (avgR - avgB) / 128;

  // 色调偏移（基于 G 与 RB 均值的差异）
  const tint = (avgG - avgGray) / 64;

  // 对比度（标准差）
  let lumVariance = 0;
  for (let i = 0; i < data.length; i += 16) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lumVariance += (lum - avgLum * 255) ** 2;
  }
  const contrast = Math.min(1, Math.sqrt(lumVariance / (pixelCount / 4)) / 128);

  // 饱和度
  const saturation = Math.min(
    1,
    Math.max(Math.abs(avgR - avgGray), Math.abs(avgG - avgGray), Math.abs(avgB - avgGray)) / 64,
  );

  return {
    averageBrightness: avgLum,
    colorTemperature: Math.max(-1, Math.min(1, colorTemperature)),
    tint: Math.max(-1, Math.min(1, tint)),
    contrast,
    saturation,
    histogram: { red: histR, green: histG, blue: histB },
    shadowClipping: shadowCount / pixelCount,
    highlightClipping: highlightCount / pixelCount,
  };
}

/**
 * 自动白平衡
 * 基于灰色世界假设
 */
export function autoWhiteBalance(frame: ImageData, strength: number): ImageData {
  if (strength <= 0) return frame;
  const { data, width, height } = frame;
  const outData = new Uint8ClampedArray(data.length);
  const profile = analyzeColorProfile(data, width, height);

  // 灰色世界假设：各通道平均值应相等
  const avgGray = profile.averageBrightness * 255;
  const pixelCount = width * height;
  const avgR = data.reduce((s, v, i) => (i % 4 === 0 ? s + v : s), 0) / pixelCount;
  const avgG = data.reduce((s, v, i) => (i % 4 === 1 ? s + v : s), 0) / pixelCount;
  const avgB = data.reduce((s, v, i) => (i % 4 === 2 ? s + v : s), 0) / pixelCount;

  const scaleR = avgGray / Math.max(1, avgR);
  const scaleG = avgGray / Math.max(1, avgG);
  const scaleB = avgGray / Math.max(1, avgB);

  // 应用强度插值
  const finalScaleR = 1 + (scaleR - 1) * strength;
  const finalScaleG = 1 + (scaleG - 1) * strength;
  const finalScaleB = 1 + (scaleB - 1) * strength;

  for (let i = 0; i < data.length; i += 4) {
    outData[i] = Math.max(0, Math.min(255, Math.round(data[i] * finalScaleR)));
    outData[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * finalScaleG)));
    outData[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * finalScaleB)));
    outData[i + 3] = data[i + 3];
  }

  return { data: outData, width, height };
}

/**
 * 曝光补偿
 */
export function exposureCompensation(frame: ImageData, strength: number): ImageData {
  if (strength <= 0) return frame;
  const { data, width, height } = frame;
  const outData = new Uint8ClampedArray(data.length);
  const profile = analyzeColorProfile(data, width, height);

  // 目标亮度 0.5（中灰）
  const targetBrightness = 0.5;
  const brightnessDiff = targetBrightness - profile.averageBrightness;
  const compensation = brightnessDiff * strength;

  // 使用 gamma 校正而非线性偏移，更自然
  const gamma = compensation > 0 ? 1 / (1 + compensation * 2) : 1 + Math.abs(compensation) * 2;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const normalized = data[i + c] / 255;
      const corrected = Math.pow(normalized, gamma);
      outData[i + c] = Math.max(0, Math.min(255, Math.round(corrected * 255)));
    }
    outData[i + 3] = data[i + 3];
  }

  return { data: outData, width, height };
}

/**
 * 色彩修复（综合）
 * 结合白平衡、曝光补偿、对比度增强
 */
export function repairColor(frame: ImageData, strength: number): { output: ImageData; profile: ColorProfile } {
  let result = frame;

  // 1. 白平衡
  result = autoWhiteBalance(result, strength * 0.6);

  // 2. 曝光补偿
  result = exposureCompensation(result, strength * 0.5);

  // 3. 对比度增强（CLAHE 简化版）
  if (strength > 0.3) {
    result = enhanceContrast(result, strength * 0.3);
  }

  const profile = analyzeColorProfile(result.data, result.width, result.height);
  return { output: result, profile };
}

/**
 * 自适应对比度增强
 */
function enhanceContrast(frame: ImageData, strength: number): ImageData {
  const { data, width, height } = frame;
  const outData = new Uint8ClampedArray(data.length);

  // 计算亮度直方图
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[lum]++;
  }

  // 计算 CDF
  const totalPixels = width * height;
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + histogram[i];

  // 应用直方图均衡化（混合强度）
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const equalized = Math.round((cdf[data[i + c]] / totalPixels) * 255);
      outData[i + c] = Math.round(data[i + c] * (1 - strength) + equalized * strength);
    }
    outData[i + 3] = data[i + 3];
  }

  return { data: outData, width, height };
}
