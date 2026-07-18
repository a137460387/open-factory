/**
 * AI多机位智能同步模块
 *
 * 功能：
 * 1. 音频指纹同步 - 基于音频指纹的精确对齐
 * 2. 视觉特征同步 - 基于画面特征的帧级对齐
 * 3. 内容感知切换建议 - 基于场景内容自动生成切换点
 * 4. 混合同步策略 - 综合多种信号的最优同步
 *
 * 与 v4.37.0 的多机位系统深度集成
 * 本地优先：所有分析在本地完成，不依赖云端 API
 */

// ==================== 类型定义 ====================

/**
 * 图像数据（RGBA 扁平数组）
 */
export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * 音频指纹特征
 */
export interface AudioFingerprint {
  /** 角度 ID */
  angleId: string;
  /** 指纹哈希序列（每秒一个哈希） */
  hashes: Uint32Array;
  /** 指纹采样率（每秒哈希数） */
  hashRate: number;
  /** 音频时长（秒） */
  duration: number;
  /** 能量包络 */
  energyEnvelope: Float32Array;
}

/**
 * 视觉特征
 */
export interface VisualFeature {
  /** 角度 ID */
  angleId: string;
  /** 帧索引 */
  frameIndex: number;
  /** 时间戳（秒） */
  timestamp: number;
  /** 颜色直方图（RGB 各 16 bin） */
  colorHistogram: Float32Array;
  /** 边缘方向直方图 */
  edgeHistogram: Float32Array;
  /** 运动幅度 (0-1) */
  motionScore: number;
  /** 亮度 (0-1) */
  brightness: number;
  /** 场景复杂度 (0-1) */
  complexity: number;
}

/**
 * 同步方法
 */
export type SyncMethod = 'audio-fingerprint' | 'visual-feature' | 'hybrid' | 'timecode' | 'manual';

/**
 * 同步配置
 */
export interface IntelligentSyncConfig {
  /** 同步方法 */
  method: SyncMethod;
  /** 音频指纹权重（混合模式） */
  audioWeight: number;
  /** 视觉特征权重（混合模式） */
  visualWeight: number;
  /** 最大允许偏移（秒） */
  maxOffset: number;
  /** 置信度阈值 (0-1) */
  confidenceThreshold: number;
  /** 是否启用漂移检测 */
  enableDriftDetection: boolean;
  /** 漂移检测窗口（秒） */
  driftWindow: number;
  /** 内容分析窗口（秒） */
  contentWindow: number;
  /** 切换最小间隔（秒） */
  minSwitchInterval: number;
}

/**
 * 同步结果
 */
export interface IntelligentSyncResult {
  /** 各角度的偏移量（秒），相对于参考角度 */
  offsets: Map<string, number>;
  /** 同步置信度 (0-1) */
  confidence: number;
  /** 使用的同步方法 */
  usedMethod: SyncMethod;
  /** 各角度的同步质量 */
  angleQualities: Map<string, SyncQuality>;
  /** 漂移信息 */
  drift: DriftInfo;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
}

/**
 * 同步质量
 */
export interface SyncQuality {
  /** 质量等级 */
  level: 'excellent' | 'good' | 'fair' | 'poor';
  /** 偏移误差（毫秒） */
  offsetErrorMs: number;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 漂移信息
 */
export interface DriftInfo {
  /** 是否检测到漂移 */
  detected: boolean;
  /** 漂移速率（毫秒/分钟） */
  rateMsPerMin: number;
  /** 漂移方向 */
  direction: 'ahead' | 'behind' | 'none';
  /** 预测的未来偏移（秒） */
  predictedOffset?: number;
}

/**
 * 切换建议
 */
export interface SwitchSuggestion {
  /** 切换时间（秒） */
  time: number;
  /** 目标角度 ID */
  targetAngleId: string;
  /** 当前角度 ID */
  currentAngleId: string;
  /** 切换原因 */
  reason: SwitchReason;
  /** 置信度 (0-1) */
  confidence: number;
  /** 优先级 (1-10) */
  priority: number;
}

/**
 * 切换原因
 */
export type SwitchReason =
  | 'active-speaker'      // 活跃说话人
  | 'scene-change'        // 场景变化
  | 'motion-focus'        // 运动焦点
  | 'composition'         // 构图优化
  | 'energy-peak'         // 能量峰值
  | 'content-variety'     // 内容多样性
  | 'manual-trigger';     // 手动触发

/**
 * 内容分析结果
 */
export interface ContentAnalysis {
  /** 时间窗口开始（秒） */
  windowStart: number;
  /** 时间窗口结束（秒） */
  windowEnd: number;
  /** 各角度的分析 */
  angles: AngleContentAnalysis[];
  /** 推荐的活跃角度 */
  recommendedAngleId: string;
  /** 推荐理由 */
  recommendationReason: SwitchReason;
}

/**
 * 单角度内容分析
 */
export interface AngleContentAnalysis {
  /** 角度 ID */
  angleId: string;
  /** 音频能量 (0-1) */
  audioEnergy: number;
  /** 视觉活跃度 (0-1) */
  visualActivity: number;
  /** 人脸检测 */
  faceCount: number;
  /** 场景变化分数 (0-1) */
  sceneChangeScore: number;
  /** 综合评分 (0-1) */
  overallScore: number;
}

// ==================== 默认配置 ====================

/**
 * 创建默认智能同步配置
 */
export function createDefaultIntelligentSyncConfig(): IntelligentSyncConfig {
  return {
    method: 'hybrid',
    audioWeight: 0.6,
    visualWeight: 0.4,
    maxOffset: 10,
    confidenceThreshold: 0.5,
    enableDriftDetection: true,
    driftWindow: 60,
    contentWindow: 1,
    minSwitchInterval: 1.5,
  };
}

/**
 * 验证智能同步配置
 */
export function validateIntelligentSyncConfig(config: IntelligentSyncConfig): string[] {
  const errors: string[] = [];
  if (config.audioWeight < 0 || config.visualWeight < 0) {
    errors.push('权重不能为负数');
  }
  if (Math.abs(config.audioWeight + config.visualWeight - 1) > 0.01 &&
    config.audioWeight + config.visualWeight > 0) {
    errors.push('音频和视觉权重之和应为 1');
  }
  if (config.maxOffset < 0 || config.maxOffset > 60) {
    errors.push('最大偏移必须在 0-60 秒之间');
  }
  if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    errors.push('置信度阈值必须在 0-1 之间');
  }
  if (config.contentWindow < 0.1 || config.contentWindow > 10) {
    errors.push('内容分析窗口必须在 0.1-10 秒之间');
  }
  if (config.minSwitchInterval < 0.5 || config.minSwitchInterval > 10) {
    errors.push('切换最小间隔必须在 0.5-10 秒之间');
  }
  return errors;
}

// ==================== 音频指纹 ====================

/**
 * 从音频采样数据生成音频指纹
 * 使用频谱特征的简化哈希算法（类似 Shazam）
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

  // 能量包络
  const envelopeLength = Math.floor(duration * 10); // 10Hz 采样
  const energyEnvelope = new Float32Array(envelopeLength);
  const samplesPerEnvelope = Math.floor(sampleRate / 10);

  for (let i = 0; i < hashCount; i++) {
    const start = i * samplesPerHash;
    const end = Math.min(start + samplesPerHash, samples.length);

    // 计算频谱特征
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
 * 计算频段能量
 * 将信号分为 6 个频段：sub-bass, bass, low-mid, mid, high-mid, high
 */
function computeFrequencyBands(
  samples: Float32Array,
  start: number,
  end: number,
  sampleRate: number,
): number[] {
  const bandCount = 6;
  const bands = new Array(bandCount).fill(0);
  const fftSize = Math.min(end - start, 1024);
  if (fftSize < 16) return bands;

  // 简化的频谱分析（不使用 FFT，基于过零率和能量分布）
  let zeroCrossings = 0;
  let totalEnergy = 0;
  let lowEnergy = 0;
  let highEnergy = 0;

  for (let i = start; i < end - 1; i++) {
    const sample = samples[i];
    const nextSample = samples[i + 1];
    totalEnergy += sample * sample;
    if (sample * nextSample < 0) zeroCrossings++;

    // 低频能量（平滑信号）
    const idx = i - start;
    if (idx % 4 === 0) lowEnergy += sample * sample;
    // 高频能量（差分信号）
    highEnergy += (sample - nextSample) * (sample - nextSample);
  }

  const normalizedZCR = zeroCrossings / (end - start);
  const energyRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0.5;

  // 基于过零率和能量分布分配到频段
  bands[0] = totalEnergy * (1 - normalizedZCR) * 0.3;  // sub-bass
  bands[1] = totalEnergy * energyRatio * 0.3;           // bass
  bands[2] = totalEnergy * 0.15;                         // low-mid
  bands[3] = totalEnergy * 0.1;                          // mid
  bands[4] = highEnergy * 0.05;                          // high-mid
  bands[5] = highEnergy * normalizedZCR * 0.02;         // high

  return bands;
}

/**
 * 将频段特征哈希为 32 位整数
 */
function hashFrequencyBands(bands: number[]): number {
  // 量化每个频段为 4 级
  const maxBand = Math.max(...bands, 1);
  let hash = 0;
  for (let i = 0; i < bands.length; i++) {
    const quantized = Math.min(3, Math.floor((bands[i] / maxBand) * 4));
    hash |= quantized << (i * 4);
  }
  // 添加时间扰动
  hash ^= (hash >>> 16);
  hash *= 0x45d9f3b;
  hash ^= (hash >>> 16);
  return hash >>> 0;
}

// ==================== 音频指纹同步 ====================

/**
 * 基于音频指纹对齐两个角度
 * 使用哈希序列的互相关找到最佳偏移
 */
export function syncByAudioFingerprint(
  reference: AudioFingerprint,
  candidate: AudioFingerprint,
): { offset: number; confidence: number } {
  const maxOffsetHashes = Math.floor(Math.max(reference.duration, candidate.duration) * reference.hashRate);
  const searchRange = Math.min(maxOffsetHashes, reference.hashes.length, candidate.hashes.length);

  let bestOffset = 0;
  let bestScore = 0;
  const step = Math.max(1, Math.floor(searchRange / 1000)); // 采样搜索

  for (let offset = -searchRange; offset <= searchRange; offset += step) {
    let matches = 0;
    let total = 0;

    for (let i = 0; i < reference.hashes.length; i++) {
      const j = i + offset;
      if (j < 0 || j >= candidate.hashes.length) continue;
      total++;
      // 汉明距离
      const xor = reference.hashes[i] ^ candidate.hashes[j];
      const hammingDist = popcount(xor);
      if (hammingDist <= 8) matches++; // 允许部分匹配
    }

    const score = total > 0 ? matches / total : 0;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  // 精细化搜索
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
 * 计算 32 位整数的 popcount（置位数）
 */
function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// ==================== 视觉特征同步 ====================

/**
 * 从图像帧提取视觉特征
 */
export function extractVisualFeature(
  angleId: string,
  frame: ImageData,
  frameIndex: number,
  timestamp: number,
): VisualFeature {
  const { data, width, height } = frame;
  const pixelCount = width * height;

  // 颜色直方图（RGB 各 16 bin）
  const colorHistogram = new Float32Array(16 * 3);
  for (let i = 0; i < data.length; i += 4) {
    colorHistogram[data[i] >> 4]++;
    colorHistogram[16 + (data[i + 1] >> 4)]++;
    colorHistogram[32 + (data[i + 2] >> 4)]++;
  }
  // 归一化
  for (let i = 0; i < colorHistogram.length; i++) {
    colorHistogram[i] /= pixelCount;
  }

  // 边缘方向直方图（简化 Sobel）
  const edgeHistogram = new Float32Array(8); // 8 方向 bin
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumR = 0.299 * data[(y * width + x + 1) * 4] + 0.587 * data[(y * width + x + 1) * 4 + 1] + 0.114 * data[(y * width + x + 1) * 4 + 2];
      const lumB = 0.299 * data[((y + 1) * width + x) * 4] + 0.587 * data[((y + 1) * width + x) * 4 + 1] + 0.114 * data[((y + 1) * width + x) * 4 + 2];
      const gx = lumR - lum;
      const gy = lumB - lum;
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > 20) {
        const angle = Math.atan2(gy, gx);
        const bin = ((angle + Math.PI) / (2 * Math.PI) * 8) % 8;
        edgeHistogram[Math.floor(bin)] += mag;
      }
    }
  }
  const edgeSum = edgeHistogram.reduce((s, v) => s + v, 0);
  if (edgeSum > 0) {
    for (let i = 0; i < edgeHistogram.length; i++) edgeHistogram[i] /= edgeSum;
  }

  // 亮度
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const brightness = totalBrightness / pixelCount / 255;

  // 场景复杂度（基于边缘密度和色彩多样性）
  const edgeDensity = edgeSum / (pixelCount / 4);
  const colorVariance = computeColorVariance(data, pixelCount);
  const complexity = Math.min(1, (edgeDensity / 50 + colorVariance) / 2);

  return {
    angleId,
    frameIndex,
    timestamp,
    colorHistogram,
    edgeHistogram,
    motionScore: 0, // 需要前后帧比较
    brightness,
    complexity,
  };
}

function computeColorVariance(data: Uint8ClampedArray, pixelCount: number): number {
  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;

  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < data.length; i += 16) { // 采样
    varR += (data[i] - avgR) ** 2;
    varG += (data[i + 1] - avgG) ** 2;
    varB += (data[i + 2] - avgB) ** 2;
  }
  const sampled = pixelCount / 4;
  return Math.min(1, (Math.sqrt(varR / sampled) + Math.sqrt(varG / sampled) + Math.sqrt(varB / sampled)) / 384);
}

/**
 * 计算两个视觉特征的相似度 (0-1)
 */
export function computeVisualSimilarity(a: VisualFeature, b: VisualFeature): number {
  // 颜色直方图相似度（卡方距离）
  let chiSq = 0;
  for (let i = 0; i < a.colorHistogram.length; i++) {
    const sum = a.colorHistogram[i] + b.colorHistogram[i];
    if (sum > 0) {
      const diff = a.colorHistogram[i] - b.colorHistogram[i];
      chiSq += (diff * diff) / sum;
    }
  }
  const colorSimilarity = Math.exp(-chiSq * 2);

  // 边缘直方图相似度
  let edgeDiff = 0;
  for (let i = 0; i < a.edgeHistogram.length; i++) {
    edgeDiff += Math.abs(a.edgeHistogram[i] - b.edgeHistogram[i]);
  }
  const edgeSimilarity = 1 - Math.min(1, edgeDiff);

  // 亮度相似度
  const brightnessSimilarity = 1 - Math.abs(a.brightness - b.brightness);

  return colorSimilarity * 0.5 + edgeSimilarity * 0.3 + brightnessSimilarity * 0.2;
}

/**
 * 基于视觉特征对齐两个角度
 * 使用颜色直方图和边缘特征的互相关
 */
export function syncByVisualFeature(
  referenceFeatures: VisualFeature[],
  candidateFeatures: VisualFeature[],
  fps: number,
): { offset: number; confidence: number } {
  if (referenceFeatures.length === 0 || candidateFeatures.length === 0) {
    return { offset: 0, confidence: 0 };
  }

  // 搜索最佳偏移（帧级别）
  const maxOffsetFrames = Math.min(
    Math.floor(referenceFeatures.length / 2),
    Math.floor(candidateFeatures.length / 2),
  );

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

// ==================== 混合同步 ====================

/**
 * 混合同步：综合音频指纹和视觉特征
 */
export function intelligentSync(
  angles: Array<{
    id: string;
    audioFingerprint?: AudioFingerprint;
    visualFeatures?: VisualFeature[];
    fps: number;
  }>,
  config: IntelligentSyncConfig,
): IntelligentSyncResult {
  const startTime = performance.now();
  const offsets = new Map<string, number>();
  const angleQualities = new Map<string, SyncQuality>();

  if (angles.length === 0) {
    return {
      offsets,
      confidence: 0,
      usedMethod: config.method,
      angleQualities,
      drift: { detected: false, rateMsPerMin: 0, direction: 'none' },
      processingTimeMs: performance.now() - startTime,
    };
  }

  // 参考角度（第一个）
  const reference = angles[0];
  offsets.set(reference.id, 0);

  if (angles.length === 1) {
    angleQualities.set(reference.id, {
      level: 'excellent',
      offsetErrorMs: 0,
      confidence: 1,
    });
    return {
      offsets,
      confidence: 1,
      usedMethod: config.method,
      angleQualities,
      drift: { detected: false, rateMsPerMin: 0, direction: 'none' },
      processingTimeMs: performance.now() - startTime,
    };
  }

  let totalConfidence = 1; // 参考角度置信度为 1

  for (let i = 1; i < angles.length; i++) {
    const candidate = angles[i];
    let offset = 0;
    let confidence = 0;

    if (config.method === 'audio-fingerprint' || config.method === 'hybrid') {
      if (reference.audioFingerprint && candidate.audioFingerprint) {
        const audioResult = syncByAudioFingerprint(
          reference.audioFingerprint,
          candidate.audioFingerprint,
        );
        if (config.method === 'audio-fingerprint') {
          offset = audioResult.offset;
          confidence = audioResult.confidence;
        } else {
          // 混合模式：存储音频偏移
          offset = audioResult.offset * config.audioWeight;
          confidence = audioResult.confidence * config.audioWeight;
        }
      }
    }

    if (config.method === 'visual-feature' || config.method === 'hybrid') {
      if (reference.visualFeatures && candidate.visualFeatures) {
        const visualResult = syncByVisualFeature(
          reference.visualFeatures,
          candidate.visualFeatures,
          candidate.fps,
        );
        if (config.method === 'visual-feature') {
          offset = visualResult.offset;
          confidence = visualResult.confidence;
        } else {
          // 混合模式：加权合并
          offset += visualResult.offset * config.visualWeight;
          confidence += visualResult.confidence * config.visualWeight;
        }
      }
    }

    // 限制最大偏移
    offset = Math.max(-config.maxOffset, Math.min(config.maxOffset, offset));

    offsets.set(candidate.id, offset);
    totalConfidence += confidence;

    // 计算同步质量
    const offsetMs = Math.abs(offset * 1000);
    let level: SyncQuality['level'];
    if (offsetMs < 10) level = 'excellent';
    else if (offsetMs < 30) level = 'good';
    else if (offsetMs < 100) level = 'fair';
    else level = 'poor';

    angleQualities.set(candidate.id, {
      level,
      offsetErrorMs: offsetMs,
      confidence,
    });
  }

  const avgConfidence = totalConfidence / angles.length;

  // 漂移检测
  const drift = config.enableDriftDetection
    ? detectDriftFromOffsets(angles, offsets)
    : { detected: false, rateMsPerMin: 0, direction: 'none' as const };

  return {
    offsets,
    confidence: avgConfidence,
    usedMethod: config.method,
    angleQualities,
    drift,
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * 从偏移量检测漂移
 */
function detectDriftFromOffsets(
  angles: Array<{ id: string }>,
  offsets: Map<string, number>,
): DriftInfo {
  if (angles.length < 2) {
    return { detected: false, rateMsPerMin: 0, direction: 'none' };
  }

  // 简化：使用偏移量作为漂移指标
  const offsetValues = Array.from(offsets.values());
  const maxOffset = Math.max(...offsetValues.map(Math.abs));

  // 如果偏移超过 50ms/分钟阈值，认为有漂移
  const driftThreshold = 0.05; // 50ms
  const detected = maxOffset > driftThreshold;

  return {
    detected,
    rateMsPerMin: detected ? maxOffset * 1000 : 0,
    direction: detected
      ? (offsetValues[1] > 0 ? 'ahead' : 'behind')
      : 'none',
    predictedOffset: detected ? maxOffset * 1.1 : undefined,
  };
}

// ==================== 内容分析与切换建议 ====================

/**
 * 分析单个时间窗口的内容
 */
export function analyzeWindowContent(
  angles: Array<{
    id: string;
    audioSamples?: Float32Array;
    audioSampleRate?: number;
    frame?: ImageData;
    prevFrame?: ImageData;
  }>,
  windowStart: number,
  windowEnd: number,
): ContentAnalysis {
  const angleAnalyses: AngleContentAnalysis[] = [];

  for (const angle of angles) {
    // 音频能量分析
    let audioEnergy = 0;
    if (angle.audioSamples && angle.audioSampleRate) {
      const startIdx = Math.floor(windowStart * angle.audioSampleRate);
      const endIdx = Math.min(
        angle.audioSamples.length,
        Math.floor(windowEnd * angle.audioSampleRate),
      );
      let sumSq = 0;
      let count = 0;
      for (let i = startIdx; i < endIdx; i++) {
        sumSq += angle.audioSamples[i] * angle.audioSamples[i];
        count++;
      }
      audioEnergy = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }

    // 视觉活跃度分析
    let visualActivity = 0;
    let faceCount = 0;
    let sceneChangeScore = 0;

    if (angle.frame) {
      const { data, width, height } = angle.frame;

      // 简化的运动检测
      if (angle.prevFrame) {
        let motionSum = 0;
        let motionCount = 0;
        for (let i = 0; i < data.length; i += 16) {
          motionSum += Math.abs(data[i] - angle.prevFrame.data[i]);
          motionCount++;
        }
        visualActivity = motionCount > 0 ? Math.min(1, motionSum / motionCount / 64) : 0;
      }

      // 简化的人脸检测（基于肤色区域）
      faceCount = detectSimpleFaces(data, width, height);

      // 场景变化（基于颜色直方图差异）
      if (angle.prevFrame) {
        sceneChangeScore = computeSceneChange(angle.prevFrame.data, data);
      }
    }

    // 综合评分
    const overallScore = audioEnergy * 0.4 + visualActivity * 0.3 +
      (faceCount > 0 ? 0.2 : 0) + sceneChangeScore * 0.1;

    angleAnalyses.push({
      angleId: angle.id,
      audioEnergy,
      visualActivity,
      faceCount,
      sceneChangeScore,
      overallScore,
    });
  }

  // 选择推荐角度
  const sorted = [...angleAnalyses].sort((a, b) => b.overallScore - a.overallScore);
  const recommended = sorted[0];
  if (!recommended) {
    return {
      windowStart,
      windowEnd,
      angles: angleAnalyses,
      recommendedAngleId: '',
      recommendationReason: 'content-variety',
    };
  }

  // 确定推荐理由
  let reason: SwitchReason = 'content-variety';
  if (recommended.audioEnergy > 0.3) reason = 'active-speaker';
  else if (recommended.sceneChangeScore > 0.5) reason = 'scene-change';
  else if (recommended.visualActivity > 0.3) reason = 'motion-focus';
  else if (recommended.faceCount > 0) reason = 'composition';

  return {
    windowStart,
    windowEnd,
    angles: angleAnalyses,
    recommendedAngleId: recommended.angleId,
    recommendationReason: reason,
  };
}

/**
 * 简化的人脸检测（基于肤色区域检测）
 */
function detectSimpleFaces(data: Uint8ClampedArray, width: number, height: number): number {
  let skinPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // YCbCr 肤色检测
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.169 * r - 0.331 * g + 0.500 * b;
    const cr = 128 + 0.500 * r - 0.419 * g - 0.081 * b;

    if (y > 80 && cb > 85 && cb < 135 && cr > 135 && cr < 180) {
      skinPixels++;
    }
  }

  const skinRatio = skinPixels / totalPixels;
  // 肤色区域占比超过 5% 可能有人脸
  return skinRatio > 0.05 ? Math.min(3, Math.floor(skinRatio * 20)) : 0;
}

/**
 * 计算场景变化分数
 */
function computeSceneChange(prevData: Uint8ClampedArray, currData: Uint8ClampedArray): number {
  let diffSum = 0;
  let count = 0;
  for (let i = 0; i < prevData.length; i += 16) {
    diffSum += Math.abs(prevData[i] - currData[i]);
    count++;
  }
  return count > 0 ? Math.min(1, diffSum / count / 128) : 0;
}

/**
 * 生成切换建议序列
 * 分析整个视频并生成最优切换点
 */
export function generateSwitchSuggestions(
  angles: Array<{
    id: string;
    audioSamples?: Float32Array;
    audioSampleRate?: number;
    frames?: ImageData[];
    fps: number;
  }>,
  duration: number,
  config: IntelligentSyncConfig,
): SwitchSuggestion[] {
  const suggestions: SwitchSuggestion[] = [];
  const windowSize = config.contentWindow;
  const windowCount = Math.ceil(duration / windowSize);
  let currentAngleId = angles[0]?.id ?? '';

  for (let w = 0; w < windowCount; w++) {
    const windowStart = w * windowSize;
    const windowEnd = Math.min(duration, windowStart + windowSize);

    // 准备角度数据
    const angleData = angles.map(angle => {
      const frameIdx = Math.floor((windowStart + windowSize / 2) * angle.fps);
      const prevFrameIdx = Math.max(0, frameIdx - 1);
      return {
        id: angle.id,
        audioSamples: angle.audioSamples,
        audioSampleRate: angle.audioSampleRate,
        frame: angle.frames?.[frameIdx],
        prevFrame: angle.frames?.[prevFrameIdx],
      };
    });

    const analysis = analyzeWindowContent(angleData, windowStart, windowEnd);

    // 如果推荐角度与当前不同，且间隔足够
    if (analysis.recommendedAngleId !== currentAngleId) {
      const lastSuggestion = suggestions[suggestions.length - 1];
      const timeSinceLastSwitch = lastSuggestion
        ? windowStart - lastSuggestion.time
        : Infinity;

      if (timeSinceLastSwitch >= config.minSwitchInterval) {
        const recommended = analysis.angles.find(a => a.angleId === analysis.recommendedAngleId);
        const confidence = recommended?.overallScore ?? 0.5;

        if (confidence >= config.confidenceThreshold) {
          suggestions.push({
            time: windowStart,
            targetAngleId: analysis.recommendedAngleId,
            currentAngleId,
            reason: analysis.recommendationReason,
            confidence,
            priority: Math.round(confidence * 10),
          });
          currentAngleId = analysis.recommendedAngleId;
        }
      }
    }
  }

  return suggestions;
}

// ==================== 集成接口 ====================

/**
 * 与 v4.37.0 多机位系统的集成接口
 * 将智能同步结果转换为现有系统可接受的格式
 */
export interface MulticamSyncIntegration {
  /** 角度偏移映射 */
  offsets: Record<string, number>;
  /** 切换点列表 */
  switchPoints: Array<{
    time: number;
    angleId: string;
    transition: 'cut' | 'dissolve';
  }>;
  /** 同步质量摘要 */
  qualitySummary: {
    overall: SyncQuality['level'];
    details: Array<{
      angleId: string;
      quality: SyncQuality;
    }>;
  };
}

/**
 * 将智能同步结果转换为集成格式
 */
export function toIntegrationFormat(
  syncResult: IntelligentSyncResult,
  suggestions: SwitchSuggestion[],
): MulticamSyncIntegration {
  const offsets: Record<string, number> = {};
  syncResult.offsets.forEach((v, k) => { offsets[k] = v; });

  const switchPoints = suggestions.map(s => ({
    time: s.time,
    angleId: s.targetAngleId,
    transition: s.confidence > 0.8 ? 'cut' as const : 'dissolve' as const,
  }));

  const details: Array<{ angleId: string; quality: SyncQuality }> = [];
  syncResult.angleQualities.forEach((quality, angleId) => {
    details.push({ angleId, quality });
  });

  const overallLevels = details.map(d => d.quality.level);
  const overall: SyncQuality['level'] = overallLevels.includes('poor')
    ? 'poor'
    : overallLevels.includes('fair')
      ? 'fair'
      : overallLevels.includes('good')
        ? 'good'
        : 'excellent';

  return {
    offsets,
    switchPoints,
    qualitySummary: { overall, details },
  };
}
