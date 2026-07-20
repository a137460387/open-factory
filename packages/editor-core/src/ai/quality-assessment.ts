/**
 * AI 视频质量评估模块
 *
 * 功能：
 * 1. 视频质量评估 - 基于拉普拉斯方差的锐度检测、噪声估计、曝光分析、色彩平衡
 * 2. 音频质量评估 - RMS 电平、峰值检测、噪声底、动态范围、削波与失真检测
 * 3. 单帧质量评分 - 逐帧分析锐度、噪声、曝光并给出综合评分
 * 4. 综合评分与分级 - 多维度加权评分，S/A/B/C/D/F 等级映射
 * 5. 优化建议生成 - 基于评分维度自动生成可操作的优化建议
 * 6. 质量对比 - 两组评估结果的逐维度对比，识别改善与退化
 * 7. 质量配置文件 - broadcast/web/social/cinema/archive 预设
 * 8. AI 提示构建与响应解析 - 构建系统/用户提示并安全解析 AI 返回的 JSON
 *
 * 所有函数均为纯计算，无副作用。
 */

import type { AiModuleResult, TranslateFn } from '../ai-module-types';
import { identityTranslator } from '../ai-module-types';

// ==================== 类型定义 ====================

/**
 * 视频质量指标
 */
export interface VideoQualityMetrics {
  /** 锐度 (0-100)，值越高越清晰 */
  sharpness: number;
  /** 噪声水平 (0-100)，值越低越干净 */
  noise: number;
  /** 曝光质量 (0-100)，值越高曝光越合理 */
  exposure: number;
  /** 对比度 (0-100) */
  contrast: number;
  /** 饱和度 (0-100) */
  saturation: number;
  /** 色彩平衡 (0-100)，值越高白平衡越准确 */
  colorBalance: number;
  /** 稳定性 (0-100)，值越高画面越稳定 */
  stability: number;
  /** 码率 (kbps) */
  bitrate: number;
  /** 分辨率宽度 (像素) */
  resolution: { width: number; height: number };
  /** 帧率 (fps) */
  frameRate: number;
}

/**
 * 音频质量指标
 */
export interface AudioQualityMetrics {
  /** RMS 电平 (dB) */
  rmsLevel: number;
  /** 峰值电平 (dB) */
  peakLevel: number;
  /** 噪声底 (dB)，值越低越安静 */
  noiseFloor: number;
  /** 动态范围 (dB) */
  dynamicRange: number;
  /** 是否存在削波 */
  clipping: boolean;
  /** 失真程度 (0-100)，0 表示无失真 */
  distortion: number;
  /** 频率平衡评分 (0-100) */
  frequencyBalance: number;
}

/**
 * 单帧质量评分
 */
export interface FrameQualityScore {
  /** 帧序号 */
  frameIndex: number;
  /** 时间戳 (秒) */
  timestamp: number;
  /** 锐度评分 (0-100) */
  sharpness: number;
  /** 噪声评分 (0-100)，值越高表示越干净 */
  noise: number;
  /** 曝光评分 (0-100) */
  exposure: number;
  /** 综合评分 (0-100) */
  overallScore: number;
}

/**
 * 质量评估维度
 */
export type QualityDimension =
  | 'sharpness'
  | 'noise'
  | 'exposure'
  | 'contrast'
  | 'saturation'
  | 'color-balance'
  | 'stability'
  | 'audio-level'
  | 'audio-noise'
  | 'bitrate';

/**
 * 维度评分
 */
export interface QualityDimensionScore {
  /** 评估维度 */
  dimension: QualityDimension;
  /** 评分 (0-100) */
  score: number;
  /** 权重 (0-1) */
  weight: number;
  /** 该维度存在的问题列表 */
  issues: string[];
  /** 优化建议 */
  suggestion: string;
}

/**
 * 质量阈值配置
 */
export interface QualityThresholds {
  /** 优秀阈值 (默认 90) */
  excellent: number;
  /** 良好阈值 (默认 75) */
  good: number;
  /** 可接受阈值 (默认 60) */
  acceptable: number;
  /** 较差阈值 (默认 40) */
  poor: number;
}

/**
 * 质量评估配置
 */
export interface QualityAssessmentConfig {
  /** 需要评估的维度列表 */
  dimensions: QualityDimension[];
  /** 各维度权重，键为维度名，值为权重 (0-1) */
  weights: Partial<Record<QualityDimension, number>>;
  /** 采样帧数 (默认 10) */
  sampleCount: number;
  /** 是否启用逐帧分析 */
  enableFrameAnalysis: boolean;
  /** 是否启用音频分析 */
  enableAudioAnalysis: boolean;
  /** 是否启用 GPU 加速 */
  gpuAccelerated: boolean;
  /** 质量阈值配置 */
  qualityThresholds: QualityThresholds;
}

/**
 * 质量等级
 */
export type EnhancedQualityGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * 质量问题
 */
export interface QualityIssue {
  /** 问题类型 */
  type: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 所属维度 */
  dimension: QualityDimension;
  /** 问题描述 */
  description: string;
  /** 受影响的时间范围 (秒)，[start, end] */
  affectedRange?: [number, number];
  /** 建议的修复方式 */
  suggestedFix: string;
}

/**
 * 优化建议
 */
export interface QualitySuggestion {
  /** 建议 ID */
  id: string;
  /** 所属维度 */
  dimension: QualityDimension;
  /** 操作描述 */
  action: string;
  /** 预期改善 (0-100) */
  expectedImprovement: number;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** 是否可自动应用 */
  autoApplicable: boolean;
  /** 自动应用时的参数 */
  params?: Record<string, number | boolean>;
}

/**
 * 质量评估结果
 */
export interface EnhancedQualityAssessmentResult {
  /** 综合评分 (0-100) */
  overallScore: number;
  /** 视频质量指标 */
  videoMetrics: VideoQualityMetrics;
  /** 音频质量指标 */
  audioMetrics: AudioQualityMetrics;
  /** 各维度评分 */
  dimensionScores: QualityDimensionScore[];
  /** 逐帧质量评分 */
  frameScores: FrameQualityScore[];
  /** 检测到的问题 */
  issues: QualityIssue[];
  /** 优化建议 */
  suggestions: QualitySuggestion[];
  /** 质量等级 */
  grade: EnhancedQualityGrade;
  /** 处理耗时 (毫秒) */
  processingTimeMs: number;
}

/**
 * 质量对比结果
 */
export interface QualityComparisonResult {
  /** 基准评估结果 */
  baseline: EnhancedQualityAssessmentResult;
  /** 对比评估结果 */
  comparison: EnhancedQualityAssessmentResult;
  /** 改善的维度列表 */
  improvements: Array<{ dimension: QualityDimension; before: number; after: number; delta: number }>;
  /** 退化的维度列表 */
  regressions: Array<{ dimension: QualityDimension; before: number; after: number; delta: number }>;
  /** 综合改善幅度 (正数为改善，负数为退化) */
  overallImprovement: number;
  /** 建议文案 */
  recommendation: string;
}

/**
 * 质量配置文件类型
 */
export type QualityProfile = 'broadcast' | 'web' | 'social' | 'cinema' | 'archive';

// ==================== 工具函数 ====================

/**
 * 将数值限制在指定范围内
 * @param value - 输入值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的值
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 安全地将 RGB 分量从 RGBA 扁平数组中提取
 * @param frame - RGBA 扁平像素数组
 * @param pixelIndex - 像素索引 (从 0 开始)
 * @returns [r, g, b] 分量
 */
function getRGB(frame: Uint8Array, pixelIndex: number): [number, number, number] {
  const offset = pixelIndex * 4;
  return [frame[offset], frame[offset + 1], frame[offset + 2]];
}

/**
 * 计算像素的亮度 (ITU-R BT.601)
 * @param r - 红色分量 (0-255)
 * @param g - 绿色分量 (0-255)
 * @param b - 蓝色分量 (0-255)
 * @returns 亮度值 (0-255)
 */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 将 dB 值限制在音频常用范围内
 * @param db - 输入 dB 值
 * @returns 限制后的 dB 值
 */
function clampDb(db: number): number {
  return clamp(db, -100, 0);
}

// ==================== 辅助函数 ====================

/**
 * 计算图像锐度（拉普拉斯方差法）
 *
 * 使用 3x3 拉普拉斯算子对亮度通道做卷积，然后计算方差。
 * 方差越大表示图像边缘越丰富、越清晰。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 锐度值 (0-100)
 */
export function computeImageSharpness(frame: Uint8Array, width: number, height: number): number {
  if (frame.length < width * height * 4 || width < 3 || height < 3) {
    return 0;
  }

  // 3x3 拉普拉斯算子
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];

  // 转换为亮度图
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = getRGB(frame, i);
    gray[i] = luminance(r, g, b);
  }

  // 对内部像素做卷积（跳过边缘 1 像素）
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

  // 经验映射：方差在 0~2000 范围内映射到 0~100
  // 大多数清晰图像方差在 200-1500 之间
  const normalized = clamp(variance / 2000, 0, 1);
  return Math.round(normalized * 100);
}

/**
 * 估计噪声水平
 *
 * 使用拉普拉斯算子的 MAD（中值绝对偏差）估计高斯噪声标准差。
 * 噪声越高表示画面越不干净。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 噪声水平 (0-100)，值越高噪声越大
 */
export function estimateNoiseLevel(frame: Uint8Array, width: number, height: number): number {
  if (frame.length < width * height * 4 || width < 3 || height < 3) {
    return 0;
  }

  // 转换为亮度图
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = getRGB(frame, i);
    gray[i] = luminance(r, g, b);
  }

  // 使用拉普拉斯算子提取高频分量
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

  // 计算 MAD（中值绝对偏差）
  highFreq.sort((a, b) => a - b);
  const median = highFreq[Math.floor(highFreq.length / 2)];
  const absDeviations = highFreq.map((v) => Math.abs(v - median));
  absDeviations.sort((a, b) => a - b);
  const mad = absDeviations[Math.floor(absDeviations.length / 2)];

  // sigma = 1.4826 * MAD (鲁棒噪声估计)
  const sigma = 1.4826 * mad;

  // 经验映射：sigma 在 0~50 范围内映射到 0~100
  const normalized = clamp(sigma / 50, 0, 1);
  return Math.round(normalized * 100);
}

/**
 * 分析曝光
 *
 * 计算图像的平均亮度、过曝像素比例和欠曝像素比例。
 * 过曝定义为亮度 > 245，欠曝定义为亮度 < 10。
 *
 * @param frame - RGBA 扁平像素数组
 * @returns { mean, overexposed, underexposed } 平均亮度 (0-255)、过曝比例 (0-1)、欠曝比例 (0-1)
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
 * 计算色彩平衡（白平衡）
 *
 * 计算图像各颜色通道的平均值，用于判断白平衡是否偏移。
 * 理想白平衡下 R/G/B 均值应接近相等。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns { r, g, b } 各通道平均亮度 (0-255)
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

  // 使用中心 60% 区域避免边框干扰
  const marginX = Math.floor(width * 0.2);
  const marginY = Math.floor(height * 0.2);
  const innerWidth = width - marginX * 2;
  const innerHeight = height - marginY * 2;

  if (innerWidth <= 0 || innerHeight <= 0) {
    // 回退：使用全图
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
 * 分数转质量等级
 *
 * @param score - 综合评分 (0-100)
 * @returns 质量等级 S/A/B/C/D/F
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
 * 维度分数转等级文字
 *
 * @param score - 维度评分 (0-100)
 * @returns 等级文字
 */
export function dimensionScoreToGrade(score: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'excellent';
  if (s >= 75) return 'good';
  if (s >= 60) return 'acceptable';
  return 'poor';
}

// ==================== 核心函数 ====================

/**
 * 评估视频质量
 *
 * 从多帧中采样，计算锐度、噪声、曝光、对比度、饱和度、色彩平衡和稳定性。
 * 每个指标取多帧的平均值或统计值。
 *
 * @param frames - RGBA 扁平像素数组的列表，每个元素为一帧
 * @param config - 质量评估配置
 * @returns 视频质量指标
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

  // 采样：均匀选取不超过 sampleCount 帧
  const sampleCount = clamp(config.sampleCount, 1, frames.length);
  const step = Math.max(1, Math.floor(frames.length / sampleCount));
  const sampledFrames: Uint8Array[] = [];
  for (let i = 0; i < frames.length && sampledFrames.length < sampleCount; i += step) {
    sampledFrames.push(frames[i]);
  }

  // 假设所有帧尺寸相同，推断宽高（假设为正方形或 16:9 常见比例）
  // 实际使用中可从外部传入，此处通过像素数推算
  const firstFrame = sampledFrames[0];
  const pixelCount = Math.floor(firstFrame.length / 4);
  const aspectRatio = 16 / 9;
  const height = Math.round(Math.sqrt(pixelCount / aspectRatio));
  const width = Math.round(pixelCount / Math.max(height, 1));

  // 逐帧计算各指标
  const sharpnessValues: number[] = [];
  const noiseValues: number[] = [];
  const exposureValues: number[] = [];
  const contrastValues: number[] = [];
  const saturationValues: number[] = [];
  const colorBalanceScores: number[] = [];

  for (const frame of sampledFrames) {
    // 锐度
    sharpnessValues.push(computeImageSharpness(frame, width, height));

    // 噪声
    noiseValues.push(estimateNoiseLevel(frame, width, height));

    // 曝光
    const exposureResult = analyzeExposure(frame);
    // 曝光质量：理想平均亮度在 100-160 之间，过曝/欠曝越少越好
    const meanDist = Math.abs(exposureResult.mean - 128) / 128;
    const overPenalty = exposureResult.overexposed * 50;
    const underPenalty = exposureResult.underexposed * 50;
    const exposureScore = clamp(100 - meanDist * 30 - overPenalty - underPenalty, 0, 100);
    exposureValues.push(exposureScore);

    // 对比度（用亮度标准差估计）
    const grayValues: number[] = [];
    const pc = Math.floor(frame.length / 4);
    for (let p = 0; p < pc; p++) {
      const [r, g, b] = getRGB(frame, p);
      grayValues.push(luminance(r, g, b));
    }
    const lumMean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;
    const lumVariance = grayValues.reduce((a, b) => a + (b - lumMean) * (b - lumMean), 0) / grayValues.length;
    const lumStd = Math.sqrt(lumVariance);
    // 标准差在 0-80 范围内映射到 0-100，理想对比度标准差约 50-65
    const contrastScore = clamp((lumStd / 80) * 100, 0, 100);
    contrastValues.push(contrastScore);

    // 饱和度（HSV 饱和度均值）
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
    // 理想饱和度在 0.2-0.5 之间
    const satScore =
      avgSat < 0.2
        ? clamp(avgSat / 0.2, 0, 1) * 70 + 15
        : avgSat > 0.5
          ? clamp(1 - (avgSat - 0.5) / 0.5, 0, 1) * 70 + 15
          : 85;
    saturationValues.push(satScore);

    // 色彩平衡
    const balance = computeColorBalance(frame, width, height);
    const avgChannel = (balance.r + balance.g + balance.b) / 3;
    if (avgChannel > 0) {
      const rDev = Math.abs(balance.r - avgChannel) / avgChannel;
      const gDev = Math.abs(balance.g - avgChannel) / avgChannel;
      const bDev = Math.abs(balance.b - avgChannel) / avgChannel;
      const avgDev = (rDev + gDev + bDev) / 3;
      // 偏差越小，色彩平衡越好
      colorBalanceScores.push(clamp(100 - avgDev * 200, 0, 100));
    } else {
      colorBalanceScores.push(50);
    }
  }

  // 稳定性：基于帧间差异
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
    // 帧间差异均值在 0-30 范围内映射到 100-0
    stabilityScore = clamp(100 - (meanDiff / 30) * 100, 0, 100);
  }

  // 汇总：取均值
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
 * 评估音频质量
 *
 * 分析音频信号的 RMS 电平、峰值、噪声底、动态范围、削波检测和失真估计。
 *
 * @param audioData - 音频采样数据 (-1.0 ~ 1.0)
 * @param sampleRate - 采样率 (Hz)
 * @param config - 质量评估配置
 * @returns 音频质量指标
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

  // --- RMS 电平 ---
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

  // --- 削波检测 ---
  // 连续采样接近满幅 (>0.99) 超过阈值则认为削波
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

  // --- 噪声底估计 ---
  // 将信号分为短帧，取 RMS 最低的 10% 帧的中位数作为噪声底
  const frameSize = Math.max(Math.round(sr * 0.02), 64); // 20ms 帧
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
    // 取最低 10% 帧的中位数
    const noiseFrameCount = Math.max(1, Math.floor(frameRmsValues.length * 0.1));
    const noiseFrames = frameRmsValues.slice(0, noiseFrameCount);
    noiseFloorDb = clampDb(noiseFrames[Math.floor(noiseFrames.length / 2)]);
  }

  // --- 动态范围 ---
  const dynamicRange = clamp(peakDb - noiseFloorDb, 0, 120);

  // --- 失真估计 ---
  // 基于 THD 近似：检测整数谐波能量占比
  // 简化方案：检测削波比例 + 信号峰均比异常
  let distortion = 0;
  if (clipping) {
    distortion = clamp((clipCount / audioData.length) * 1000, 10, 100);
  }
  // 峰均比过高也暗示失真（正常语音/音乐约 10-20 dB）
  const crestFactor = rms > 0 ? 20 * Math.log10(peak / rms) : 0;
  if (crestFactor > 25) {
    distortion = Math.max(distortion, clamp((crestFactor - 25) * 5, 0, 50));
  }

  // --- 频率平衡 ---
  // 简化方案：将信号分为低/中/高频段，比较各段能量
  // 使用短时能量分布近似
  const fftSize = 2048;
  const halfFft = fftSize / 2;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;

  // 分帧计算能量分布（简化版 DFT 能量估计）
  const segCount = Math.min(Math.floor(audioData.length / fftSize), 20);
  if (segCount > 0) {
    const segStep = Math.floor(audioData.length / segCount);
    for (let seg = 0; seg < segCount; seg++) {
      const offset = seg * segStep;
      // 简化频谱分析：使用自相关近似各频段能量
      // 低频 (20-300Hz)、中频 (300-4000Hz)、高频 (4000-20000Hz)
      const lowBinEnd = Math.round((300 / sr) * fftSize);
      const midBinEnd = Math.round((4000 / sr) * fftSize);

      for (let i = 0; i < fftSize && offset + i < audioData.length; i++) {
        const sample = audioData[offset + i];
        const energy = sample * sample;
        // 简化的频段分配：基于采样位置近似（实际应用中应使用 FFT）
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
      // 理想分布：低频 20-40%，中频 40-60%，高频 10-30%
      const lowPenalty = Math.abs(lowRatio - 0.3) * 100;
      const midPenalty = Math.abs(midRatio - 0.5) * 100;
      const highPenalty = Math.abs(highRatio - 0.2) * 100;
      var freqBalanceScore = clamp(100 - (lowPenalty + midPenalty + highPenalty) * 0.8, 0, 100);
    } else {
      var freqBalanceScore = 50;
    }
  } else {
    var freqBalanceScore = 50;
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
 * 评估单帧质量
 *
 * 计算单帧的锐度、噪声和曝光质量，并给出综合评分。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 单帧质量评分
 */
export function assessFrameQuality(frame: Uint8Array, width: number, height: number): FrameQualityScore {
  const sharpness = computeImageSharpness(frame, width, height);

  // 噪声评分：原始噪声越高表示越差，取反得到"干净度"
  const rawNoise = estimateNoiseLevel(frame, width, height);
  const noiseCleanliness = clamp(100 - rawNoise, 0, 100);

  // 曝光评分
  const exposureResult = analyzeExposure(frame);
  const meanDist = Math.abs(exposureResult.mean - 128) / 128;
  const overPenalty = exposureResult.overexposed * 50;
  const underPenalty = exposureResult.underexposed * 50;
  const exposureScore = clamp(100 - meanDist * 30 - overPenalty - underPenalty, 0, 100);

  // 综合评分：锐度 40%，干净度 30%，曝光 30%
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

/**
 * 综合评分
 *
 * 根据视频指标、音频指标和配置，计算各维度加权得分并生成评估结果。
 *
 * @param metrics - 视频质量指标
 * @param audioMetrics - 音频质量指标
 * @param config - 质量评估配置
 * @returns 质量评估结果
 */
export function computeQualityScore(
  metrics: VideoQualityMetrics,
  audioMetrics: AudioQualityMetrics,
  config: QualityAssessmentConfig,
): EnhancedQualityAssessmentResult {
  const startTime = Date.now();

  // 维度到指标的映射
  const dimensionValueMap: Record<QualityDimension, number> = {
    sharpness: metrics.sharpness,
    noise: clamp(100 - metrics.noise, 0, 100), // 噪声取反：越低越好 -> 越高评分越好
    exposure: metrics.exposure,
    contrast: metrics.contrast,
    saturation: metrics.saturation,
    'color-balance': metrics.colorBalance,
    stability: metrics.stability,
    'audio-level': clamp(100 - Math.abs(audioMetrics.rmsLevel + 14) * 3, 0, 100), // -14dB 附近最佳
    'audio-noise': clamp(audioMetrics.noiseFloor < -60 ? 100 : 100 + (audioMetrics.noiseFloor + 60) * 1.5, 0, 100),
    bitrate: metrics.bitrate > 0 ? clamp(metrics.bitrate / 50, 0, 100) : 50,
  };

  // 默认权重
  const defaultWeights: Record<QualityDimension, number> = {
    sharpness: 0.15,
    noise: 0.12,
    exposure: 0.12,
    contrast: 0.1,
    saturation: 0.08,
    'color-balance': 0.08,
    stability: 0.1,
    'audio-level': 0.08,
    'audio-noise': 0.07,
    bitrate: 0.1,
  };

  // 构建维度评分
  const dimensionScores: QualityDimensionScore[] = [];
  const issues: QualityIssue[] = [];
  const suggestions: QualitySuggestion[] = [];

  for (const dim of config.dimensions) {
    const score = dimensionValueMap[dim];
    const weight = config.weights[dim] ?? defaultWeights[dim] ?? 0.1;
    const grade = dimensionScoreToGrade(score);

    const dimIssues: string[] = [];
    let dimSuggestion = '';

    // 根据维度和分数生成问题和建议
    if (grade === 'poor') {
      switch (dim) {
        case 'sharpness':
          dimIssues.push('画面模糊，细节丢失严重');
          dimSuggestion = '建议应用锐化滤镜或检查对焦';
          break;
        case 'noise':
          dimIssues.push('画面噪点明显，影响观看体验');
          dimSuggestion = '建议启用降噪功能';
          break;
        case 'exposure':
          dimIssues.push('曝光严重不准确');
          dimSuggestion = '建议调整亮度和曝光补偿';
          break;
        case 'contrast':
          dimIssues.push('对比度不足，画面灰蒙');
          dimSuggestion = '建议增加对比度';
          break;
        case 'saturation':
          dimIssues.push('色彩饱和度过低或过高');
          dimSuggestion = '建议调整饱和度';
          break;
        case 'color-balance':
          dimIssues.push('白平衡偏移明显');
          dimSuggestion = '建议进行白平衡校正';
          break;
        case 'stability':
          dimIssues.push('画面抖动严重');
          dimSuggestion = '建议启用防抖功能';
          break;
        case 'audio-level':
          dimIssues.push('音频电平异常');
          dimSuggestion = '建议调整音量到 -14dB 左右';
          break;
        case 'audio-noise':
          dimIssues.push('音频底噪过高');
          dimSuggestion = '建议启用音频降噪';
          break;
        case 'bitrate':
          dimIssues.push('码率偏低，画质受限');
          dimSuggestion = '建议提高输出码率';
          break;
      }
    } else if (grade === 'acceptable') {
      switch (dim) {
        case 'sharpness':
          dimIssues.push('画面锐度尚可，有提升空间');
          dimSuggestion = '可轻微增强锐化';
          break;
        case 'noise':
          dimIssues.push('存在一定噪点');
          dimSuggestion = '可轻微降噪';
          break;
        case 'exposure':
          dimIssues.push('曝光略有偏差');
          dimSuggestion = '可微调亮度';
          break;
        default:
          dimIssues.push(`${dim} 质量一般`);
          dimSuggestion = `可优化 ${dim} 参数`;
      }
    }

    // 生成质量问题
    for (const issueDesc of dimIssues) {
      const severity: QualityIssue['severity'] = grade === 'poor' ? 'high' : grade === 'acceptable' ? 'medium' : 'low';
      issues.push({
        type: dim,
        severity,
        dimension: dim,
        description: issueDesc,
        suggestedFix: dimSuggestion,
      });
    }

    // 生成优化建议
    if (score < 75) {
      const priority: QualitySuggestion['priority'] =
        score < 40 ? 'critical' : score < 55 ? 'high' : score < 65 ? 'medium' : 'low';
      const expectedImprovement = Math.round((75 - score) * 0.6);

      const suggestionParams: Record<string, Record<string, number | boolean>> = {
        sharpness: { sharpness: 1.5 },
        noise: { denoise: true },
        exposure: { brightness: 0.2 },
        contrast: { contrast: 1.2 },
        saturation: { saturation: 1.15 },
        'color-balance': { colorTemperature: 0 },
        stability: { stabilization: true },
        'audio-level': { volume: 1.3 },
        'audio-noise': { noiseReduction: true },
        bitrate: { bitrate: 8000 },
      };

      suggestions.push({
        id: `sug-${dim}-${Date.now()}`,
        dimension: dim,
        action: dimSuggestion,
        expectedImprovement,
        priority,
        autoApplicable: score >= 55,
        params: suggestionParams[dim],
      });
    }

    dimensionScores.push({
      dimension: dim,
      score: Math.round(score),
      weight,
      issues: dimIssues,
      suggestion: dimSuggestion,
    });
  }

  // 计算加权综合分
  let totalWeight = 0;
  let weightedSum = 0;
  for (const ds of dimensionScores) {
    weightedSum += ds.score * ds.weight;
    totalWeight += ds.weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const processingTimeMs = Date.now() - startTime;

  return {
    overallScore: clamp(overallScore, 0, 100),
    videoMetrics: metrics,
    audioMetrics: audioMetrics,
    dimensionScores,
    frameScores: [],
    issues,
    suggestions,
    grade: mapScoreToEnhancedGrade(overallScore),
    processingTimeMs,
  };
}

/**
 * 生成优化建议
 *
 * 根据评估结果，为每个低分维度生成具体的优化建议。
 *
 * @param result - 质量评估结果
 * @returns 优化建议列表，按优先级排序
 */
export function generateOptimizationSuggestions(result: EnhancedQualityAssessmentResult): QualitySuggestion[] {
  const allSuggestions: QualitySuggestion[] = [...result.suggestions];

  // 检查音频问题
  if (result.audioMetrics.clipping) {
    allSuggestions.push({
      id: `sug-clip-fix-${Date.now()}`,
      dimension: 'audio-level',
      action: '音频存在削波失真，建议降低录音电平或使用限制器',
      expectedImprovement: 15,
      priority: 'critical',
      autoApplicable: false,
      params: { volume: 0.7 },
    });
  }

  if (result.audioMetrics.distortion > 30) {
    allSuggestions.push({
      id: `sug-dist-fix-${Date.now()}`,
      dimension: 'audio-noise',
      action: '音频存在明显失真，建议检查录音设备或重新录制',
      expectedImprovement: 20,
      priority: 'high',
      autoApplicable: false,
    });
  }

  // 检查视频指标中的极端值
  if (result.videoMetrics.noise > 70) {
    allSuggestions.push({
      id: `sug-heavy-denoise-${Date.now()}`,
      dimension: 'noise',
      action: '噪点非常严重，建议使用强降噪滤镜',
      expectedImprovement: 25,
      priority: 'high',
      autoApplicable: true,
      params: { denoise: true, denoiseStrength: 0.8 },
    });
  }

  if (result.videoMetrics.stability < 30) {
    allSuggestions.push({
      id: `sug-heavy-stab-${Date.now()}`,
      dimension: 'stability',
      action: '画面抖动非常严重，建议使用强防抖或重新拍摄',
      expectedImprovement: 30,
      priority: 'high',
      autoApplicable: true,
      params: { stabilization: true, stabilizationStrength: 0.9 },
    });
  }

  // 去重并按优先级排序
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const seen = new Set<string>();
  const deduped: QualitySuggestion[] = [];

  for (const sug of allSuggestions.sort(
    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4),
  )) {
    const key = `${sug.dimension}-${sug.action}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(sug);
    }
  }

  return deduped;
}

/**
 * 质量对比
 *
 * 对比两组评估结果，识别改善和退化的维度，给出综合建议。
 *
 * @param baseline - 基准评估结果
 * @param comparison - 对比评估结果
 * @returns 质量对比结果
 */
export function compareQuality(
  baseline: EnhancedQualityAssessmentResult,
  comparison: EnhancedQualityAssessmentResult,
): QualityComparisonResult {
  const improvements: QualityComparisonResult['improvements'] = [];
  const regressions: QualityComparisonResult['regressions'] = [];

  // 建立基准维度分数映射
  const baselineMap = new Map<QualityDimension, number>();
  for (const ds of baseline.dimensionScores) {
    baselineMap.set(ds.dimension, ds.score);
  }

  // 逐维度对比
  for (const compDs of comparison.dimensionScores) {
    const baseScore = baselineMap.get(compDs.dimension) ?? 0;
    const delta = compDs.score - baseScore;

    if (delta > 2) {
      improvements.push({
        dimension: compDs.dimension,
        before: baseScore,
        after: compDs.score,
        delta: Math.round(delta),
      });
    } else if (delta < -2) {
      regressions.push({
        dimension: compDs.dimension,
        before: baseScore,
        after: compDs.score,
        delta: Math.round(delta),
      });
    }
  }

  const overallImprovement = comparison.overallScore - baseline.overallScore;

  // 生成建议文案
  let recommendation: string;
  if (overallImprovement > 10) {
    recommendation = '质量有显著提升，建议保存当前优化设置';
  } else if (overallImprovement > 3) {
    recommendation = '质量有所改善，可继续微调以获得更好效果';
  } else if (overallImprovement > -3) {
    recommendation = '质量基本持平，建议关注具体维度的细微差异';
  } else if (overallImprovement > -10) {
    recommendation = '质量略有下降，建议检查退化维度的参数设置';
  } else {
    recommendation = '质量明显下降，建议回退到基准设置并重新调整';
  }

  return {
    baseline,
    comparison,
    improvements,
    regressions,
    overallImprovement: Math.round(overallImprovement),
    recommendation,
  };
}

/**
 * 应用质量配置文件
 *
 * 根据预设的使用场景（广播、网络、社交媒体、影院、归档）生成对应的评估配置。
 *
 * @param profile - 质量配置文件类型
 * @returns 质量评估配置
 */
export function applyQualityProfile(profile: QualityProfile): QualityAssessmentConfig {
  const base = createDefaultQualityAssessmentConfig();

  switch (profile) {
    case 'broadcast':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.15,
          noise: 0.1,
          exposure: 0.12,
          contrast: 0.1,
          saturation: 0.05,
          'color-balance': 0.12,
          stability: 0.1,
          'audio-level': 0.1,
          'audio-noise': 0.08,
          bitrate: 0.08,
        },
        qualityThresholds: {
          excellent: 92,
          good: 80,
          acceptable: 65,
          poor: 45,
        },
      };

    case 'web':
      return {
        ...base,
        dimensions: ['sharpness', 'noise', 'exposure', 'contrast', 'saturation', 'bitrate'],
        weights: {
          sharpness: 0.2,
          noise: 0.15,
          exposure: 0.15,
          contrast: 0.15,
          saturation: 0.15,
          bitrate: 0.2,
        },
        qualityThresholds: {
          excellent: 85,
          good: 70,
          acceptable: 55,
          poor: 35,
        },
      };

    case 'social':
      return {
        ...base,
        dimensions: ['sharpness', 'exposure', 'contrast', 'saturation', 'stability'],
        weights: {
          sharpness: 0.15,
          exposure: 0.2,
          contrast: 0.2,
          saturation: 0.25,
          stability: 0.2,
        },
        qualityThresholds: {
          excellent: 80,
          good: 65,
          acceptable: 50,
          poor: 30,
        },
      };

    case 'cinema':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'saturation',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.12,
          noise: 0.12,
          exposure: 0.12,
          contrast: 0.12,
          saturation: 0.08,
          'color-balance': 0.14,
          stability: 0.1,
          'audio-level': 0.08,
          'audio-noise': 0.06,
          bitrate: 0.06,
        },
        qualityThresholds: {
          excellent: 95,
          good: 85,
          acceptable: 70,
          poor: 50,
        },
        sampleCount: 20,
        enableFrameAnalysis: true,
        enableAudioAnalysis: true,
      };

    case 'archive':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'saturation',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.1,
          noise: 0.1,
          exposure: 0.1,
          contrast: 0.08,
          saturation: 0.08,
          'color-balance': 0.1,
          stability: 0.08,
          'audio-level': 0.1,
          'audio-noise': 0.1,
          bitrate: 0.16,
        },
        qualityThresholds: {
          excellent: 90,
          good: 75,
          acceptable: 60,
          poor: 40,
        },
        sampleCount: 30,
        enableFrameAnalysis: true,
        enableAudioAnalysis: true,
      };

    default:
      return base;
  }
}

/**
 * 创建默认质量评估配置
 *
 * @returns 默认配置
 */
export function createDefaultQualityAssessmentConfig(): QualityAssessmentConfig {
  return {
    dimensions: [
      'sharpness',
      'noise',
      'exposure',
      'contrast',
      'saturation',
      'color-balance',
      'stability',
      'audio-level',
      'audio-noise',
      'bitrate',
    ],
    weights: {
      sharpness: 0.15,
      noise: 0.12,
      exposure: 0.12,
      contrast: 0.1,
      saturation: 0.08,
      'color-balance': 0.08,
      stability: 0.1,
      'audio-level': 0.08,
      'audio-noise': 0.07,
      bitrate: 0.1,
    },
    sampleCount: 10,
    enableFrameAnalysis: true,
    enableAudioAnalysis: true,
    gpuAccelerated: false,
    qualityThresholds: {
      excellent: 90,
      good: 75,
      acceptable: 60,
      poor: 40,
    },
  };
}

/**
 * 验证质量评估配置
 *
 * 检查配置的合法性：维度非空、权重范围正确、采样数合理、阈值单调递减。
 *
 * @param config - 待验证的配置
 * @returns 是否合法
 */
export function validateQualityAssessmentConfig(config: QualityAssessmentConfig): boolean {
  // 维度不能为空
  if (!config.dimensions || config.dimensions.length === 0) return false;

  // 检查维度值是否合法
  const validDimensions: QualityDimension[] = [
    'sharpness',
    'noise',
    'exposure',
    'contrast',
    'saturation',
    'color-balance',
    'stability',
    'audio-level',
    'audio-noise',
    'bitrate',
  ];
  for (const dim of config.dimensions) {
    if (!validDimensions.includes(dim)) return false;
  }

  // 权重必须在 0-1 之间
  if (config.weights) {
    for (const [_key, value] of Object.entries(config.weights)) {
      if (value !== undefined && (value < 0 || value > 1)) return false;
    }
  }

  // 采样数必须为正整数且合理
  if (config.sampleCount < 1 || config.sampleCount > 100) return false;

  // 阈值必须单调递减
  const t = config.qualityThresholds;
  if (t.excellent <= t.good || t.good <= t.acceptable || t.acceptable <= t.poor) return false;

  // 阈值必须在 0-100 范围内
  if (
    t.excellent < 0 ||
    t.excellent > 100 ||
    t.good < 0 ||
    t.good > 100 ||
    t.acceptable < 0 ||
    t.acceptable > 100 ||
    t.poor < 0 ||
    t.poor > 100
  ) {
    return false;
  }

  return true;
}

/**
 * 构建 AI 质量评估系统提示
 *
 * 生成指导 AI 进行视频质量评估的系统提示词，包含评估维度、
 * 评分标准和输出格式说明。
 *
 * @param profile - 可选的质量配置文件，影响评估侧重点
 * @returns 系统提示字符串
 */
export function buildEnhancedQualitySystemPrompt(profile?: QualityProfile): string {
  const profileGuidance: Record<QualityProfile, string> = {
    broadcast: '广播级评估：重点关注信号合规性、色彩精度、音频电平标准化和码率达标。',
    web: '网络发布评估：重点关注压缩效率、加载友好性、清晰度和色彩吸引力。',
    social: '社交媒体评估：重点关注移动端观看体验、色彩鲜艳度、曝光合理性和内容稳定性。',
    cinema: '影院级评估：重点关注动态范围、色彩精度、噪点控制、音频纯净度和整体艺术品质。',
    archive: '归档级评估：重点关注长期保存质量、码率充足性、元数据完整性和信号无损程度。',
  };

  const guidance = profile ? profileGuidance[profile] : '通用质量评估：综合考量各维度。';

  return [
    '你是一个专业的视频质量评估助手。请根据提供的视频帧数据和音频指标，',
    '对视频素材进行全面的质量评估。',
    '',
    `评估场景：${guidance}`,
    '',
    '评估维度包括：',
    '- sharpness (锐度): 画面清晰度，使用拉普拉斯方差法衡量',
    '- noise (噪声): 画面噪点水平，值越低越好',
    '- exposure (曝光): 亮度合理性，避免过曝和欠曝',
    '- contrast (对比度): 明暗层次丰富度',
    '- saturation (饱和度): 色彩鲜艳程度',
    '- color-balance (色彩平衡): 白平衡准确性',
    '- stability (稳定性): 画面抖动程度',
    '- audio-level (音频电平): 响度合理性，推荐 -14 LUFS 附近',
    '- audio-noise (音频噪声): 底噪水平',
    '- bitrate (码率): 压缩质量',
    '',
    '评分标准：0-100 分，等级映射：',
    '- S (95+): 完美品质',
    '- A (85-94): 优秀品质',
    '- B (70-84): 良好品质',
    '- C (55-69): 一般品质',
    '- D (40-54): 较差品质',
    '- F (<40): 不合格',
    '',
    '返回格式必须是 JSON 对象，结构如下：',
    '{"overallScore":0-100,"grade":"S|A|B|C|D|F","dimensionScores":[{"dimension":"维度名","score":0-100,"issues":["问题"],"suggestion":"建议"}],"issues":[{"type":"类型","severity":"low|medium|high|critical","dimension":"维度","description":"描述","suggestedFix":"修复建议"}],"suggestions":[{"id":"ID","dimension":"维度","action":"操作","expectedImprovement":0-100,"priority":"low|medium|high|critical","autoApplicable":true/false}]}',
  ].join('\n');
}

/**
 * 构建 AI 质量评估用户提示
 *
 * 将视频和音频指标格式化为用户提示，供 AI 分析。
 *
 * @param metrics - 视频质量指标
 * @param audioMetrics - 音频质量指标
 * @returns 用户提示字符串
 */
export function buildEnhancedQualityUserPrompt(
  metrics: VideoQualityMetrics,
  audioMetrics: AudioQualityMetrics,
): string {
  const parts: string[] = [
    '请对以下视频素材进行质量评估，返回 JSON 格式的评估结果。',
    '',
    '--- 视频指标 ---',
    `锐度: ${metrics.sharpness}/100`,
    `噪声水平: ${metrics.noise}/100 (越低越好)`,
    `曝光质量: ${metrics.exposure}/100`,
    `对比度: ${metrics.contrast}/100`,
    `饱和度: ${metrics.saturation}/100`,
    `色彩平衡: ${metrics.colorBalance}/100`,
    `稳定性: ${metrics.stability}/100`,
    `分辨率: ${metrics.resolution.width}x${metrics.resolution.height}`,
    `帧率: ${metrics.frameRate} fps`,
    `码率: ${metrics.bitrate} kbps`,
    '',
    '--- 音频指标 ---',
    `RMS 电平: ${audioMetrics.rmsLevel} dB`,
    `峰值电平: ${audioMetrics.peakLevel} dB`,
    `噪声底: ${audioMetrics.noiseFloor} dB`,
    `动态范围: ${audioMetrics.dynamicRange} dB`,
    `削波: ${audioMetrics.clipping ? '是' : '否'}`,
    `失真度: ${audioMetrics.distortion}/100`,
    `频率平衡: ${audioMetrics.frequencyBalance}/100`,
    '',
    '请根据以上指标给出综合评估，包括各维度评分、发现的问题和优化建议。',
  ];

  return parts.join('\n');
}

/**
 * 解析增强型质量评估 AI 响应
 *
 * 从 AI 返回的 JSON 中提取并校验质量评估结果。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @returns 质量评估结果
 */
export function parseEnhancedQualityResponse(json: unknown): EnhancedQualityAssessmentResult {
  const emptyResult: EnhancedQualityAssessmentResult = {
    overallScore: 0,
    videoMetrics: {
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
    },
    audioMetrics: {
      rmsLevel: -100,
      peakLevel: -100,
      noiseFloor: -100,
      dynamicRange: 0,
      clipping: false,
      distortion: 0,
      frequencyBalance: 0,
    },
    dimensionScores: [],
    frameScores: [],
    issues: [],
    suggestions: [],
    grade: 'F',
    processingTimeMs: 0,
  };

  if (!json || typeof json !== 'object') return emptyResult;
  const obj = json as Record<string, unknown>;

  // 解析综合分数
  const overallScore = clamp(
    typeof obj.overallScore === 'number' && !Number.isNaN(obj.overallScore) ? Math.round(obj.overallScore) : 0,
    0,
    100,
  );

  // 解析等级
  const validGrades: EnhancedQualityGrade[] = ['S', 'A', 'B', 'C', 'D', 'F'];
  const grade = validGrades.includes(obj.grade as EnhancedQualityGrade)
    ? (obj.grade as EnhancedQualityGrade)
    : mapScoreToEnhancedGrade(overallScore);

  // 解析维度评分
  const dimensionScores: QualityDimensionScore[] = [];
  if (Array.isArray(obj.dimensionScores)) {
    const validDimensions: QualityDimension[] = [
      'sharpness',
      'noise',
      'exposure',
      'contrast',
      'saturation',
      'color-balance',
      'stability',
      'audio-level',
      'audio-noise',
      'bitrate',
    ];
    for (const item of obj.dimensionScores) {
      if (item && typeof item === 'object') {
        const ds = item as Record<string, unknown>;
        if (
          typeof ds.dimension === 'string' &&
          validDimensions.includes(ds.dimension as QualityDimension) &&
          typeof ds.score === 'number'
        ) {
          dimensionScores.push({
            dimension: ds.dimension as QualityDimension,
            score: clamp(Math.round(ds.score), 0, 100),
            weight: typeof ds.weight === 'number' ? clamp(ds.weight, 0, 1) : 0.1,
            issues: Array.isArray(ds.issues) ? ds.issues.filter((i: unknown) => typeof i === 'string') : [],
            suggestion: typeof ds.suggestion === 'string' ? ds.suggestion : '',
          });
        }
      }
    }
  }

  // 解析问题
  const issues: QualityIssue[] = [];
  if (Array.isArray(obj.issues)) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    for (const item of obj.issues) {
      if (item && typeof item === 'object') {
        const issue = item as Record<string, unknown>;
        if (
          typeof issue.type === 'string' &&
          validSeverities.includes(issue.severity as string) &&
          typeof issue.description === 'string'
        ) {
          issues.push({
            type: issue.type,
            severity: issue.severity as QualityIssue['severity'],
            dimension: typeof issue.dimension === 'string' ? (issue.dimension as QualityDimension) : 'sharpness',
            description: issue.description,
            suggestedFix: typeof issue.suggestedFix === 'string' ? issue.suggestedFix : '',
          });
        }
      }
    }
  }

  // 解析建议
  const suggestions: QualitySuggestion[] = [];
  if (Array.isArray(obj.suggestions)) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    for (const item of obj.suggestions) {
      if (item && typeof item === 'object') {
        const sug = item as Record<string, unknown>;
        if (typeof sug.id === 'string' && typeof sug.action === 'string' && typeof sug.dimension === 'string') {
          suggestions.push({
            id: sug.id,
            dimension: sug.dimension as QualityDimension,
            action: sug.action,
            expectedImprovement:
              typeof sug.expectedImprovement === 'number' ? clamp(Math.round(sug.expectedImprovement), 0, 100) : 0,
            priority: validPriorities.includes(sug.priority as string)
              ? (sug.priority as QualitySuggestion['priority'])
              : 'medium',
            autoApplicable: typeof sug.autoApplicable === 'boolean' ? sug.autoApplicable : false,
            params:
              typeof sug.params === 'object' && sug.params !== null
                ? (sug.params as Record<string, number | boolean>)
                : undefined,
          });
        }
      }
    }
  }

  return {
    overallScore,
    videoMetrics: emptyResult.videoMetrics,
    audioMetrics: emptyResult.audioMetrics,
    dimensionScores,
    frameScores: [],
    issues,
    suggestions,
    grade,
    processingTimeMs: typeof obj.processingTimeMs === 'number' ? obj.processingTimeMs : 0,
  };
}

/**
 * 安全解析增强型质量评估 AI 响应
 *
 * 包装 parseEnhancedQualityResponse，在解析失败时返回错误信息而非抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的质量评估结果
 */
export async function parseEnhancedQualityResponseSafe(
  json: unknown,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<EnhancedQualityAssessmentResult>> {
  try {
    const data = parseEnhancedQualityResponse(json);
    return { data, error: null };
  } catch {
    const emptyResult: EnhancedQualityAssessmentResult = {
      overallScore: 0,
      videoMetrics: {
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
      },
      audioMetrics: {
        rmsLevel: -100,
        peakLevel: -100,
        noiseFloor: -100,
        dynamicRange: 0,
        clipping: false,
        distortion: 0,
        frequencyBalance: 0,
      },
      dimensionScores: [],
      frameScores: [],
      issues: [],
      suggestions: [],
      grade: 'F',
      processingTimeMs: 0,
    };
    return { data: emptyResult, error: t('aiModules.error.parseFailed') };
  }
}
