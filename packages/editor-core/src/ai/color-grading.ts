/**
 * AI色彩分级模块
 *
 * 功能：
 * 1. 智能色彩匹配 - 分析参考图像的色彩特征，匹配到目标图像
 * 2. AI自动色彩分级 - 基于场景内容自动调整色彩参数
 * 3. 风格迁移 - 将参考图像的风格应用到目标图像
 * 4. 色彩分析 - 分析图像的色彩分布、对比度、饱和度等
 */

// ==================== 类型定义 ====================

import { clamp, lerp } from '../utils/math';

/**
 * 色彩分析结果
 */
export interface ColorAnalysis {
  /** 平均亮度 (0-1) */
  averageBrightness: number;
  /** 对比度 (0-1) */
  contrast: number;
  /** 饱和度 (0-1) */
  saturation: number;
  /** 色温 (冷-暖, -1到1) */
  colorTemperature: number;
  /** 色调 (绿-品红, -1到1) */
  tint: number;
  /** 主色调分布 */
  dominantColors: RGBColor[];
  /** 直方图数据 */
  histogram: {
    red: number[];
    green: number[];
    blue: number[];
    luminance: number[];
  };
  /** 动态范围 (0-1) */
  dynamicRange: number;
  /** 色彩分布均匀性 (0-1) */
  colorUniformity: number;
}

/**
 * RGB颜色
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL颜色
 */
export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * LAB颜色
 */
export interface LABColor {
  l: number;
  a: number;
  b: number;
}

/**
 * 色彩匹配选项
 */
export interface ColorMatchOptions {
  /** 匹配强度 (0-1) */
  intensity: number;
  /** 是否匹配亮度 */
  matchLuminance: boolean;
  /** 是否匹配对比度 */
  matchContrast: boolean;
  /** 是否匹配饱和度 */
  matchSaturation: boolean;
  /** 是否匹配色温 */
  matchColorTemperature: boolean;
  /** 是否匹配色调 */
  matchTint: boolean;
  /** 是否匹配直方图 */
  matchHistogram: boolean;
  /** 区域掩码 (可选) */
  regionMask?: Uint8Array;
}

/**
 * 色彩匹配结果
 */
export interface ColorMatchResult {
  /** 色彩校正参数 */
  correction: ColorCorrectionParams;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 匹配的色彩特征 */
  matchedFeatures: string[];
}

/**
 * 色彩校正参数
 */
export interface ColorCorrectionParams {
  /** 亮度调整 (-1到1) */
  brightness: number;
  /** 对比度调整 (-1到1) */
  contrast: number;
  /** 饱和度调整 (-1到1) */
  saturation: number;
  /** 色温调整 (-1到1) */
  temperature: number;
  /** 色调调整 (-1到1) */
  tint: number;
  /** 色相旋转 (-180到180度) */
  hueRotation: number;
  /** 伽马调整 (0.1到3.0) */
  gamma: number;
  /** 提升 (阴影调整, -1到1) */
  lift: RGBColor;
  /** 伽马 (中间调调整, -1到1) */
  gammaRGB: RGBColor;
  /** 增益 (高光调整, -1到1) */
  gain: RGBColor;
}

/**
 * AI自动分级选项
 */
export interface AIAutoGradingOptions {
  /** 目标风格 */
  targetStyle: GradingStyle;
  /** 内容感知强度 (0-1) */
  contentAwareStrength: number;
  /** 是否保留肤色 */
  preserveSkinTones: boolean;
  /** 是否应用电影色调 */
  applyCinematicTones: boolean;
  /** 场景类型提示 */
  sceneTypeHint?: SceneType;
}

/**
 * 分级风格
 */
export type GradingStyle =
  | 'natural' // 自然
  | 'cinematic' // 电影感
  | 'vintage' // 复古
  | 'modern' // 现代
  | 'dramatic' // 戏剧性
  | 'soft' // 柔和
  | 'vibrant' // 鲜艳
  | 'muted' // 柔和
  | 'cold' // 冷色调
  | 'warm'; // 暖色调

/**
 * 场景类型
 */
export type SceneType =
  | 'indoor' // 室内
  | 'outdoor' // 室外
  | 'portrait' // 人像
  | 'landscape' // 风景
  | 'action' // 动作
  | 'night' // 夜景
  | 'sunset' // 日落
  | 'studio'; // 影棚

/**
 * AI自动分级结果
 */
export interface AIAutoGradingResult {
  /** 色彩校正参数 */
  correction: ColorCorrectionParams;
  /** 检测到的场景类型 */
  detectedSceneType: SceneType;
  /** 应用的风格 */
  appliedStyle: GradingStyle;
  /** 肤色区域掩码 (如果保留肤色) */
  skinToneMask?: Uint8Array;
  /** 处理置信度 (0-1) */
  confidence: number;
}

/**
 * 风格迁移选项
 */
export interface StyleTransferOptions {
  /** 迁移强度 (0-1) */
  strength: number;
  /** 是否保留内容结构 */
  preserveContent: boolean;
  /** 是否匹配直方图 */
  matchHistogram: boolean;
  /** 是否应用色彩映射 */
  applyColorMapping: boolean;
  /** 风格图像区域掩码 (可选) */
  styleRegionMask?: Uint8Array;
  /** 内容图像区域掩码 (可选) */
  contentRegionMask?: Uint8Array;
}

/**
 * 风格迁移结果
 */
export interface StyleTransferResult {
  /** 迁移后的图像数据 */
  transferredImageData: Uint8ClampedArray;
  /** 应用的色彩映射 */
  colorMapping: ColorMapping;
  /** 迁移质量评分 (0-1) */
  qualityScore: number;
}

/**
 * 色彩映射
 */
export interface ColorMapping {
  /** 源颜色 */
  sourceColors: RGBColor[];
  /** 目标颜色 */
  targetColors: RGBColor[];
  /** 映射强度 */
  strength: number;
}

/**
 * 图像数据
 */
export interface ImageData {
  /** 像素数据 */
  data: Uint8ClampedArray;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/**
 * 色彩分级预设
 */
export interface ColorGradingPreset {
  /** 预设ID */
  id: string;
  /** 预设名称 */
  name: string;
  /** 预设描述 */
  description: string;
  /** 色彩校正参数 */
  correction: ColorCorrectionParams;
  /** 预设标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: number;
}

// ==================== 辅助函数 ====================

/**
 * 将RGB转换为HSL
 */
export function rgbToHsl(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s, l };
}

/**
 * 将HSL转换为RGB
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s;
  const l = hsl.l;

  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * 将RGB转换为LAB
 */
export function rgbToLab(rgb: RGBColor): LABColor {
  // 简化的RGB到LAB转换
  // 实际应用中应使用更精确的转换
  const hsl = rgbToHsl(rgb);
  return {
    l: hsl.l * 100,
    a: (hsl.s - 0.5) * 200,
    b: ((hsl.h - 180) * 200) / 360,
  };
}

/**
 * 计算两个颜色之间的距离
 */
export function colorDistance(color1: RGBColor, color2: RGBColor): number {
  const rDiff = color1.r - color2.r;
  const gDiff = color1.g - color2.g;
  const bDiff = color1.b - color2.b;
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * 计算两个LAB颜色之间的Delta E
 */
export function deltaE(lab1: LABColor, lab2: LABColor): number {
  const lDiff = lab1.l - lab2.l;
  const aDiff = lab1.a - lab2.a;
  const bDiff = lab1.b - lab2.b;
  return Math.sqrt(lDiff * lDiff + aDiff * aDiff + bDiff * bDiff);
}

/**
 * 计算直方图
 */
export function computeHistogram(imageData: ImageData): ColorAnalysis['histogram'] {
  const { data, width, height } = imageData;
  const histogram = {
    red: new Array(256).fill(0),
    green: new Array(256).fill(0),
    blue: new Array(256).fill(0),
    luminance: new Array(256).fill(0),
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    histogram.red[r]++;
    histogram.green[g]++;
    histogram.blue[b]++;
    histogram.luminance[lum]++;
  }

  // 归一化
  const totalPixels = width * height;
  for (let i = 0; i < 256; i++) {
    histogram.red[i] /= totalPixels;
    histogram.green[i] /= totalPixels;
    histogram.blue[i] /= totalPixels;
    histogram.luminance[i] /= totalPixels;
  }

  return histogram;
}

/**
 * 提取主色调
 */
export function extractDominantColors(imageData: ImageData, count: number = 5): RGBColor[] {
  const { data } = imageData;
  const colorMap = new Map<string, { color: RGBColor; count: number }>();

  // 采样像素（每4个像素采样一次以提高性能）
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  // 按计数排序并返回前N个颜色
  const sortedColors = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((item) => item.color);

  return sortedColors;
}

/**
 * 计算图像对比度
 */
export function computeContrast(imageData: ImageData): number {
  const { data } = imageData;
  let minLum = 1;
  let maxLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    minLum = Math.min(minLum, lum);
    maxLum = Math.max(maxLum, lum);
  }

  return maxLum - minLum;
}

/**
 * 计算图像饱和度
 */
export function computeSaturation(imageData: ImageData): number {
  const { data } = imageData;
  let totalSaturation = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    totalSaturation += d;
  }

  return totalSaturation / pixelCount;
}

/**
 * 计算色温和色调
 */
export function computeColorTemperatureAndTint(imageData: ImageData): { temperature: number; tint: number } {
  const { data } = imageData;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }

  const avgR = totalR / pixelCount;
  const avgG = totalG / pixelCount;
  const avgB = totalB / pixelCount;

  // 色温：红色与蓝色的平衡
  const temperature = (avgR - avgB) / 255;

  // 色调：绿色与品红的平衡
  const tint = (avgG - (avgR + avgB) / 2) / 255;

  return { temperature, tint };
}

// ==================== 核心功能 ====================

/**
 * 分析图像色彩特征
 */
export function analyzeImageColors(imageData: ImageData): ColorAnalysis {
  const histogram = computeHistogram(imageData);
  const dominantColors = extractDominantColors(imageData);
  const contrast = computeContrast(imageData);
  const saturation = computeSaturation(imageData);
  const { temperature, tint } = computeColorTemperatureAndTint(imageData);

  // 计算平均亮度
  let totalBrightness = 0;
  const pixelCount = imageData.data.length / 4;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i] / 255;
    const g = imageData.data[i + 1] / 255;
    const b = imageData.data[i + 2] / 255;
    totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const averageBrightness = totalBrightness / pixelCount;

  // 计算动态范围（基于直方图）
  const lumHist = histogram.luminance;
  let lowPercentile = 0;
  let highPercentile = 0;
  let cumulative = 0;
  for (let i = 0; i < 256; i++) {
    cumulative += lumHist[i];
    if (cumulative >= 0.05 && lowPercentile === 0) {
      lowPercentile = i / 255;
    }
    if (cumulative >= 0.95) {
      highPercentile = i / 255;
      break;
    }
  }
  const dynamicRange = highPercentile - lowPercentile;

  // 计算色彩分布均匀性
  const colorUniformity = computeColorUniformity(imageData);

  return {
    averageBrightness,
    contrast,
    saturation,
    colorTemperature: temperature,
    tint,
    dominantColors,
    histogram,
    dynamicRange,
    colorUniformity,
  };
}

/**
 * 计算色彩分布均匀性
 */
function computeColorUniformity(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const blockSize = 16;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  if (blocksX === 0 || blocksY === 0) return 1;

  const blockColors: RGBColor[] = [];

  // 计算每个块的平均颜色
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let count = 0;

      for (let y = by * blockSize; y < (by + 1) * blockSize && y < height; y++) {
        for (let x = bx * blockSize; x < (bx + 1) * blockSize && x < width; x++) {
          const idx = (y * width + x) * 4;
          totalR += data[idx];
          totalG += data[idx + 1];
          totalB += data[idx + 2];
          count++;
        }
      }

      blockColors.push({
        r: totalR / count,
        g: totalG / count,
        b: totalB / count,
      });
    }
  }

  // 计算块之间的颜色差异
  let totalDifference = 0;
  let comparisons = 0;

  for (let i = 0; i < blockColors.length; i++) {
    for (let j = i + 1; j < blockColors.length; j++) {
      totalDifference += colorDistance(blockColors[i], blockColors[j]);
      comparisons++;
    }
  }

  const averageDifference = comparisons > 0 ? totalDifference / comparisons : 0;
  // 归一化到0-1，差异越小均匀性越高
  return 1 - Math.min(averageDifference / 441.67, 1); // 441.67 = sqrt(255^2 * 3)
}

/**
 * 智能色彩匹配
 * 分析参考图像的色彩特征，生成匹配目标图像的校正参数
 */
export function matchColors(
  referenceImage: ImageData,
  targetImage: ImageData,
  options: Partial<ColorMatchOptions> = {},
): ColorMatchResult {
  const defaultOptions: ColorMatchOptions = {
    intensity: 0.8,
    matchLuminance: true,
    matchContrast: true,
    matchSaturation: true,
    matchColorTemperature: true,
    matchTint: true,
    matchHistogram: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // 分析参考图像和目标图像
  const refAnalysis = analyzeImageColors(referenceImage);
  const targetAnalysis = analyzeImageColors(targetImage);

  const correction: ColorCorrectionParams = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    hueRotation: 0,
    gamma: 1,
    lift: { r: 0, g: 0, b: 0 },
    gammaRGB: { r: 0, g: 0, b: 0 },
    gain: { r: 0, g: 0, b: 0 },
  };

  const matchedFeatures: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  // 匹配亮度
  if (mergedOptions.matchLuminance) {
    const brightnessDiff = refAnalysis.averageBrightness - targetAnalysis.averageBrightness;
    correction.brightness = brightnessDiff * mergedOptions.intensity;
    matchedFeatures.push('brightness');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 匹配对比度
  if (mergedOptions.matchContrast) {
    const contrastDiff = refAnalysis.contrast - targetAnalysis.contrast;
    correction.contrast = contrastDiff * mergedOptions.intensity;
    matchedFeatures.push('contrast');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 匹配饱和度
  if (mergedOptions.matchSaturation) {
    const saturationDiff = refAnalysis.saturation - targetAnalysis.saturation;
    correction.saturation = saturationDiff * mergedOptions.intensity;
    matchedFeatures.push('saturation');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 匹配色温
  if (mergedOptions.matchColorTemperature) {
    const tempDiff = refAnalysis.colorTemperature - targetAnalysis.colorTemperature;
    correction.temperature = tempDiff * mergedOptions.intensity;
    matchedFeatures.push('colorTemperature');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 匹配色调
  if (mergedOptions.matchTint) {
    const tintDiff = refAnalysis.tint - targetAnalysis.tint;
    correction.tint = tintDiff * mergedOptions.intensity;
    matchedFeatures.push('tint');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 匹配直方图
  if (mergedOptions.matchHistogram) {
    const histogramCorrection = matchHistograms(refAnalysis.histogram, targetAnalysis.histogram);
    correction.brightness += histogramCorrection.brightness * mergedOptions.intensity * 0.3;
    correction.contrast += histogramCorrection.contrast * mergedOptions.intensity * 0.3;
    correction.saturation += histogramCorrection.saturation * mergedOptions.intensity * 0.3;
    matchedFeatures.push('histogram');
    totalWeight += 1;
    matchedWeight += 1;
  }

  // 计算匹配置信度
  const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    correction,
    confidence,
    matchedFeatures,
  };
}

/**
 * 直方图匹配
 */
function matchHistograms(
  refHistogram: ColorAnalysis['histogram'],
  targetHistogram: ColorAnalysis['histogram'],
): { brightness: number; contrast: number; saturation: number } {
  // 计算直方图的统计特性
  const refStats = computeHistogramStats(refHistogram.luminance);
  const targetStats = computeHistogramStats(targetHistogram.luminance);

  return {
    brightness: refStats.mean - targetStats.mean,
    contrast: refStats.stdDev - targetStats.stdDev,
    saturation: 0, // 饱和度需要从色度直方图计算
  };
}

/**
 * 计算直方图统计特性
 */
function computeHistogramStats(histogram: number[]): { mean: number; stdDev: number } {
  let mean = 0;
  for (let i = 0; i < histogram.length; i++) {
    mean += i * histogram[i];
  }

  let variance = 0;
  for (let i = 0; i < histogram.length; i++) {
    const diff = i - mean;
    variance += diff * diff * histogram[i];
  }

  return {
    mean: mean / 255, // 归一化到0-1
    stdDev: Math.sqrt(variance) / 255,
  };
}

/**
 * AI自动色彩分级
 * 基于场景内容自动调整色彩参数
 */
export function autoGradeImage(imageData: ImageData, options: Partial<AIAutoGradingOptions> = {}): AIAutoGradingResult {
  const defaultOptions: AIAutoGradingOptions = {
    targetStyle: 'natural',
    contentAwareStrength: 0.7,
    preserveSkinTones: true,
    applyCinematicTones: false,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // 分析图像内容
  const analysis = analyzeImageColors(imageData);

  // 检测场景类型
  const detectedSceneType = mergedOptions.sceneTypeHint || detectSceneType(analysis);

  // 检测肤色区域
  let skinToneMask: Uint8Array | undefined;
  if (mergedOptions.preserveSkinTones) {
    skinToneMask = detectSkinTones(imageData);
  }

  // 基于场景类型和目标风格生成校正参数
  const correction = generateCorrectionForScene(
    analysis,
    detectedSceneType,
    mergedOptions.targetStyle,
    mergedOptions.contentAwareStrength,
  );

  // 应用电影色调
  if (mergedOptions.applyCinematicTones) {
    applyCinematicToneCorrection(correction);
  }

  return {
    correction,
    detectedSceneType,
    appliedStyle: mergedOptions.targetStyle,
    skinToneMask,
    confidence: 0.85, // 基于算法复杂度的置信度
  };
}

/**
 * 检测场景类型
 */
function detectSceneType(analysis: ColorAnalysis): SceneType {
  const { averageBrightness, saturation, colorTemperature, contrast } = analysis;

  // 基于亮度和色彩特征判断场景类型
  if (averageBrightness < 0.2) {
    return 'night';
  }

  if (averageBrightness > 0.8 && saturation < 0.3) {
    return 'studio';
  }

  if (colorTemperature > 0.3 && averageBrightness > 0.4 && averageBrightness < 0.8) {
    return 'sunset';
  }

  if (contrast > 0.6 && saturation > 0.4) {
    return 'action';
  }

  if (saturation < 0.2 && contrast < 0.4) {
    return 'portrait';
  }

  if (averageBrightness > 0.5 && saturation > 0.3) {
    return 'landscape';
  }

  if (colorTemperature < -0.1) {
    return 'indoor';
  }

  return 'outdoor';
}

/**
 * 检测肤色区域
 */
function detectSkinTones(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // 肤色检测算法（基于YCbCr色彩空间）
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 0.564 * (b - y) + 0.5;
    const cr = 0.713 * (r - y) + 0.5;

    // 肤色范围阈值
    const isSkin = y > 0.2 && y < 0.9 && cb > 0.35 && cb < 0.55 && cr > 0.45 && cr < 0.65;

    mask[i / 4] = isSkin ? 255 : 0;
  }

  return mask;
}

/**
 * 为场景生成校正参数
 */
function generateCorrectionForScene(
  analysis: ColorAnalysis,
  sceneType: SceneType,
  style: GradingStyle,
  contentAwareStrength: number,
): ColorCorrectionParams {
  // 基础校正参数
  const correction: ColorCorrectionParams = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    hueRotation: 0,
    gamma: 1,
    lift: { r: 0, g: 0, b: 0 },
    gammaRGB: { r: 0, g: 0, b: 0 },
    gain: { r: 0, g: 0, b: 0 },
  };

  // 基于场景类型的调整
  switch (sceneType) {
    case 'night':
      correction.brightness = 0.15 * contentAwareStrength;
      correction.contrast = 0.1 * contentAwareStrength;
      correction.saturation = -0.1 * contentAwareStrength;
      break;
    case 'sunset':
      correction.temperature = 0.3 * contentAwareStrength;
      correction.saturation = 0.15 * contentAwareStrength;
      correction.contrast = 0.05 * contentAwareStrength;
      break;
    case 'portrait':
      correction.contrast = 0.05 * contentAwareStrength;
      correction.saturation = -0.05 * contentAwareStrength;
      correction.brightness = 0.02 * contentAwareStrength;
      break;
    case 'landscape':
      correction.saturation = 0.2 * contentAwareStrength;
      correction.contrast = 0.1 * contentAwareStrength;
      break;
    case 'action':
      correction.contrast = 0.15 * contentAwareStrength;
      correction.saturation = 0.1 * contentAwareStrength;
      break;
    case 'studio':
      correction.contrast = 0.05 * contentAwareStrength;
      correction.brightness = 0.02 * contentAwareStrength;
      break;
    case 'indoor':
      correction.temperature = 0.1 * contentAwareStrength;
      correction.brightness = 0.05 * contentAwareStrength;
      break;
    case 'outdoor':
      correction.saturation = 0.1 * contentAwareStrength;
      correction.contrast = 0.05 * contentAwareStrength;
      break;
  }

  // 基于风格的调整
  switch (style) {
    case 'cinematic':
      correction.contrast += 0.1;
      correction.saturation -= 0.1;
      correction.temperature += 0.05;
      correction.lift.r = -0.02;
      correction.lift.b = 0.02;
      correction.gain.r = 0.02;
      correction.gain.b = -0.02;
      break;
    case 'vintage':
      correction.saturation -= 0.2;
      correction.contrast += 0.05;
      correction.temperature += 0.1;
      correction.lift.r = 0.05;
      correction.lift.g = 0.02;
      break;
    case 'modern':
      correction.contrast += 0.1;
      correction.saturation += 0.05;
      break;
    case 'dramatic':
      correction.contrast += 0.2;
      correction.saturation += 0.1;
      correction.brightness -= 0.05;
      break;
    case 'soft':
      correction.contrast -= 0.1;
      correction.saturation -= 0.1;
      correction.brightness += 0.05;
      break;
    case 'vibrant':
      correction.saturation += 0.3;
      correction.contrast += 0.05;
      break;
    case 'muted':
      correction.saturation -= 0.3;
      correction.contrast -= 0.05;
      break;
    case 'cold':
      correction.temperature -= 0.2;
      correction.tint -= 0.05;
      break;
    case 'warm':
      correction.temperature += 0.2;
      correction.tint += 0.05;
      break;
    case 'natural':
    default:
      // 自然风格不做额外调整
      break;
  }

  // 钳制值到合理范围
  correction.brightness = clamp(correction.brightness, -1, 1);
  correction.contrast = clamp(correction.contrast, -1, 1);
  correction.saturation = clamp(correction.saturation, -1, 1);
  correction.temperature = clamp(correction.temperature, -1, 1);
  correction.tint = clamp(correction.tint, -1, 1);
  correction.gamma = clamp(correction.gamma, 0.1, 3.0);

  return correction;
}

/**
 * 应用电影色调校正
 */
function applyCinematicToneCorrection(correction: ColorCorrectionParams): void {
  // 添加电影色调特征
  correction.lift.r = clamp(correction.lift.r - 0.02, -1, 1);
  correction.lift.b = clamp(correction.lift.b + 0.02, -1, 1);
  correction.gain.r = clamp(correction.gain.r + 0.02, -1, 1);
  correction.gain.b = clamp(correction.gain.b - 0.02, -1, 1);
  correction.contrast = clamp(correction.contrast + 0.05, -1, 1);
  correction.saturation = clamp(correction.saturation - 0.05, -1, 1);
}

/**
 * 风格迁移
 * 将参考图像的风格应用到目标图像
 */
export function transferStyle(
  styleImage: ImageData,
  contentImage: ImageData,
  options: Partial<StyleTransferOptions> = {},
): StyleTransferResult {
  const defaultOptions: StyleTransferOptions = {
    strength: 0.7,
    preserveContent: true,
    matchHistogram: true,
    applyColorMapping: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // 分析风格图像和内容图像
  const styleAnalysis = analyzeImageColors(styleImage);
  const contentAnalysis = analyzeImageColors(contentImage);

  // 提取色彩映射
  const colorMapping = extractColorMapping(styleImage, contentImage);

  // 应用风格迁移
  const transferredImageData = new Uint8ClampedArray(contentImage.data);
  const { width, height } = contentImage;

  if (mergedOptions.applyColorMapping) {
    // 应用色彩映射
    applyColorMappingToImage(transferredImageData, width, height, colorMapping, mergedOptions.strength);
  }

  if (mergedOptions.matchHistogram) {
    // 应用直方图匹配
    applyHistogramMatching(transferredImageData, width, height, styleAnalysis.histogram, mergedOptions.strength);
  }

  // 计算质量评分
  const qualityScore = computeTransferQuality(contentImage, { data: transferredImageData, width, height });

  return {
    transferredImageData,
    colorMapping,
    qualityScore,
  };
}

/**
 * 提取色彩映射
 */
function extractColorMapping(styleImage: ImageData, contentImage: ImageData): ColorMapping {
  const styleColors = extractDominantColors(styleImage, 8);
  const contentColors = extractDominantColors(contentImage, 8);

  return {
    sourceColors: contentColors,
    targetColors: styleColors.slice(0, contentColors.length),
    strength: 0.7,
  };
}

/**
 * 应用色彩映射到图像
 */
function applyColorMappingToImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mapping: ColorMapping,
  strength: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const pixel: RGBColor = { r: data[i], g: data[i + 1], b: data[i + 2] };

    // 找到最接近的源颜色
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let j = 0; j < mapping.sourceColors.length; j++) {
      const distance = colorDistance(pixel, mapping.sourceColors[j]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = j;
      }
    }

    // 应用目标颜色
    const targetColor = mapping.targetColors[closestIndex];
    const influence = Math.exp(-minDistance / 100) * strength;

    data[i] = clamp(lerp(pixel.r, targetColor.r, influence), 0, 255);
    data[i + 1] = clamp(lerp(pixel.g, targetColor.g, influence), 0, 255);
    data[i + 2] = clamp(lerp(pixel.b, targetColor.b, influence), 0, 255);
  }
}

/**
 * 应用直方图匹配
 */
function applyHistogramMatching(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetHistogram: ColorAnalysis['histogram'],
  strength: number,
): void {
  // 计算当前直方图
  const currentHistogram = computeHistogram({ data, width, height });

  // 计算累积分布函数
  const cdfCurrent = computeCDF(currentHistogram.luminance);
  const cdfTarget = computeCDF(targetHistogram.luminance);

  // 创建映射表
  const mapping = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let j = 0;
    while (j < 255 && cdfTarget[j] < cdfCurrent[i]) {
      j++;
    }
    mapping[i] = j;
  }

  // 应用映射
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const newLum = mapping[lum];
    const diff = newLum - lum;

    data[i] = clamp(data[i] + diff * strength, 0, 255);
    data[i + 1] = clamp(data[i + 1] + diff * strength, 0, 255);
    data[i + 2] = clamp(data[i + 2] + diff * strength, 0, 255);
  }
}

/**
 * 计算累积分布函数
 */
function computeCDF(histogram: number[]): number[] {
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }
  // 归一化
  const max = cdf[255];
  for (let i = 0; i < 256; i++) {
    cdf[i] /= max;
  }
  return cdf;
}

/**
 * 计算风格迁移质量
 */
function computeTransferQuality(original: ImageData, transferred: ImageData): number {
  // 计算结构相似性（简化的SSIM）
  const { width, height } = original;
  let totalSimilarity = 0;
  const pixelCount = width * height;

  for (let i = 0; i < original.data.length; i += 4) {
    const origLum = 0.299 * original.data[i] + 0.587 * original.data[i + 1] + 0.114 * original.data[i + 2];
    const transLum = 0.299 * transferred.data[i] + 0.587 * transferred.data[i + 1] + 0.114 * transferred.data[i + 2];

    const similarity = 1 - Math.abs(origLum - transLum) / 255;
    totalSimilarity += similarity;
  }

  return totalSimilarity / pixelCount;
}

/**
 * 应用色彩校正到图像
 */
export function applyColorCorrection(imageData: ImageData, correction: ColorCorrectionParams): ImageData {
  const { data, width, height } = imageData;
  const result = new Uint8ClampedArray(data);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    // 应用亮度
    r += correction.brightness;
    g += correction.brightness;
    b += correction.brightness;

    // 应用对比度
    const contrastFactor = (1 + correction.contrast) / (1 - correction.contrast);
    r = (r - 0.5) * contrastFactor + 0.5;
    g = (g - 0.5) * contrastFactor + 0.5;
    b = (b - 0.5) * contrastFactor + 0.5;

    // 应用伽马
    r = Math.pow(Math.max(0, r), 1 / correction.gamma);
    g = Math.pow(Math.max(0, g), 1 / correction.gamma);
    b = Math.pow(Math.max(0, b), 1 / correction.gamma);

    // 应用Lift/Gamma/Gain
    r = r * (1 + correction.gain.r) + correction.lift.r;
    g = g * (1 + correction.gain.g) + correction.lift.g;
    b = b * (1 + correction.gain.b) + correction.lift.b;

    // 应用饱和度
    const hsl = rgbToHsl({ r: r * 255, g: g * 255, b: b * 255 });
    hsl.s = clamp(hsl.s + correction.saturation, 0, 1);
    const saturated = hslToRgb(hsl);
    r = saturated.r / 255;
    g = saturated.g / 255;
    b = saturated.b / 255;

    // 应用色温
    r += correction.temperature * 0.1;
    b -= correction.temperature * 0.1;

    // 应用色调
    g += correction.tint * 0.1;

    // 钳制并写入结果
    result[i] = clamp(Math.round(r * 255), 0, 255);
    result[i + 1] = clamp(Math.round(g * 255), 0, 255);
    result[i + 2] = clamp(Math.round(b * 255), 0, 255);
    result[i + 3] = data[i + 3]; // 保持alpha不变
  }

  return { data: result, width, height };
}

/**
 * 创建默认色彩校正参数
 */
export function createDefaultColorCorrection(): ColorCorrectionParams {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    hueRotation: 0,
    gamma: 1,
    lift: { r: 0, g: 0, b: 0 },
    gammaRGB: { r: 0, g: 0, b: 0 },
    gain: { r: 0, g: 0, b: 0 },
  };
}

/**
 * 验证色彩校正参数
 */
export function validateColorCorrection(params: ColorCorrectionParams): boolean {
  return (
    typeof params.brightness === 'number' &&
    typeof params.contrast === 'number' &&
    typeof params.saturation === 'number' &&
    typeof params.temperature === 'number' &&
    typeof params.tint === 'number' &&
    typeof params.hueRotation === 'number' &&
    typeof params.gamma === 'number' &&
    typeof params.lift === 'object' &&
    typeof params.gammaRGB === 'object' &&
    typeof params.gain === 'object'
  );
}

/**
 * 归一化色彩校正参数
 */
export function normalizeColorCorrection(params: ColorCorrectionParams): ColorCorrectionParams {
  return {
    brightness: clamp(params.brightness, -1, 1),
    contrast: clamp(params.contrast, -1, 1),
    saturation: clamp(params.saturation, -1, 1),
    temperature: clamp(params.temperature, -1, 1),
    tint: clamp(params.tint, -1, 1),
    hueRotation: clamp(params.hueRotation, -180, 180),
    gamma: clamp(params.gamma, 0.1, 3.0),
    lift: {
      r: clamp(params.lift.r, -1, 1),
      g: clamp(params.lift.g, -1, 1),
      b: clamp(params.lift.b, -1, 1),
    },
    gammaRGB: {
      r: clamp(params.gammaRGB.r, -1, 1),
      g: clamp(params.gammaRGB.g, -1, 1),
      b: clamp(params.gammaRGB.b, -1, 1),
    },
    gain: {
      r: clamp(params.gain.r, -1, 1),
      g: clamp(params.gain.g, -1, 1),
      b: clamp(params.gain.b, -1, 1),
    },
  };
}
