/**
 * 智能剪辑增强模块
 *
 * 功能：
 * 1. 节奏匹配剪辑 - 根据音频节奏剪辑画面
 * 2. 情绪感知剪辑 - 根据内容情绪建议剪辑点
 * 3. 自动预告片生成 - 自动生成预告片
 * 4. 智能片段排序 - 智能排列视频片段
 */

// ==================== 类型定义 ====================

import { clamp } from '../utils/math';

/**
 * 时间点
 */
export interface TimePoint {
  /** 时间 (秒) */
  time: number;
  /** 置信度 (0-1) */
  confidence: number;
  /** 类型 */
  type: TimePointType;
  /** 描述 */
  description?: string;
}

/**
 * 时间点类型
 */
export type TimePointType =
  | 'beat' // 节拍点
  | 'downbeat' // 强拍点
  | 'silence' // 静音点
  | 'scene-change' // 场景变化点
  | 'motion-change' // 运动变化点
  | 'emotion-peak' // 情绪高点
  | 'narrative-turn' // 叙事转折点
  | 'highlight' // 精彩瞬间
  | 'cut-point'; // 剪辑点

/**
 * 音频节拍信息
 */
export interface BeatInfo {
  /** BPM (每分钟节拍数) */
  bpm: number;
  /** 节拍时间点数组 */
  beats: number[];
  /** 强拍时间点数组 */
  downbeats: number[];
  /** 节拍强度 */
  beatStrength: number[];
  /** 节拍置信度 */
  confidence: number;
}

/**
 * 情绪分析结果
 */
export interface EmotionAnalysis {
  /** 情绪时间线 */
  timeline: EmotionPoint[];
  /** 整体情绪 */
  overallEmotion: EmotionType;
  /** 情绪变化强度 (0-1) */
  emotionalIntensity: number;
  /** 情绪高潮点 */
  peaks: TimePoint[];
}

/**
 * 情绪点
 */
export interface EmotionPoint {
  /** 时间 (秒) */
  time: number;
  /** 情绪类型 */
  emotion: EmotionType;
  /** 情绪强度 (0-1) */
  intensity: number;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 情绪类型
 */
export type EmotionType =
  'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted' | 'excited' | 'calm' | 'tense';

/**
 * 剪辑建议
 */
export interface CutSuggestion {
  /** 建议ID */
  id: string;
  /** 剪辑点时间 (秒) */
  time: number;
  /** 剪辑类型 */
  type: CutType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 原因 */
  reason: string;
  /** 相关时间点 */
  relatedTimePoints: TimePoint[];
  /** 建议的过渡效果 */
  suggestedTransition?: TransitionType;
}

/**
 * 剪辑类型
 */
export type CutType =
  | 'hard-cut' // 硬切
  | 'soft-cut' // 软切
  | 'jump-cut' // 跳切
  | 'match-cut' // 匹配剪辑
  | 'cross-cut' // 交叉剪辑
  | 'cutaway' // 切出
  | 'reaction-shot' // 反应镜头
  | 'insert' // 插入镜头
  | 'transition'; // 过渡

/**
 * 过渡类型
 */
export type TransitionType =
  | 'fade-in'
  | 'fade-out'
  | 'cross-dissolve'
  | 'wipe'
  | 'zoom'
  | 'blur'
  | 'slide'
  | 'dip-to-black'
  | 'dip-to-white'
  | 'none';

/**
 * 预告片配置
 */
export interface TrailerConfig {
  /** 目标时长 (秒) */
  targetDuration: number;
  /** 风格 */
  style: TrailerStyle;
  /** 节奏 */
  tempo: TrailerTempo;
  /** 是否包含对话 */
  includeDialogue: boolean;
  /** 是否包含音乐 */
  includeMusic: boolean;
  /** 是否包含旁白 */
  includeNarration: boolean;
  /** 情绪曲线 */
  emotionCurve: EmotionType[];
  /** 高潮点数量 */
  climaxCount: number;
}

/**
 * 预告片风格
 */
export type TrailerStyle =
  | 'action' // 动作片
  | 'drama' // 剧情片
  | 'comedy' // 喜剧片
  | 'horror' // 恐怖片
  | 'romance' // 爱情片
  | 'documentary' // 纪录片
  | 'teaser' // 预告
  | 'official'; // 官方预告

/**
 * 预告片节奏
 */
export type TrailerTempo = 'slow' | 'medium' | 'fast' | 'dynamic';

/**
 * 预告片片段
 */
export interface TrailerSegment {
  /** 片段ID */
  id: string;
  /** 源视频ID */
  sourceId: string;
  /** 开始时间 (秒) */
  startTime: number;
  /** 结束时间 (秒) */
  endTime: number;
  /** 片段类型 */
  type: TrailerSegmentType;
  /** 情绪 */
  emotion: EmotionType;
  /** 重要性 (0-1) */
  importance: number;
  /** 过渡效果 */
  transition: TransitionType;
}

/**
 * 预告片片段类型
 */
export type TrailerSegmentType =
  | 'opening' // 开场
  | 'setup' // 铺垫
  | 'buildup' // 发展
  | 'climax' // 高潮
  | 'resolution' // 解决
  | 'closing' // 结尾
  | 'title-card' // 标题卡
  | 'quote'; // 引用

/**
 * 预告片结果
 */
export interface TrailerResult {
  /** 片段列表 */
  segments: TrailerSegment[];
  /** 总时长 (秒) */
  totalDuration: number;
  /** 情绪曲线 */
  emotionCurve: EmotionPoint[];
  /** 节奏信息 */
  beatInfo: BeatInfo;
  /** 质量评分 (0-1) */
  qualityScore: number;
}

/**
 * 片段排序选项
 */
export interface SegmentSortOptions {
  /** 排序策略 */
  strategy: SortStrategy;
  /** 是否保持原始顺序 */
  preserveOriginalOrder: boolean;
  /** 是否考虑情绪连贯性 */
  considerEmotionContinuity: boolean;
  /** 是否考虑节奏 */
  considerRhythm: boolean;
  /** 是否考虑内容相关性 */
  considerContentRelevance: boolean;
  /** 自定义权重 */
  weights?: SortWeights;
}

/**
 * 排序策略
 */
export type SortStrategy =
  | 'chronological' // 按时间顺序
  | 'importance' // 按重要性
  | 'emotion' // 按情绪
  | 'rhythm' // 按节奏
  | 'narrative' // 按叙事结构
  | 'random' // 随机
  | 'custom'; // 自定义

/**
 * 排序权重
 */
export interface SortWeights {
  /** 时间顺序权重 */
  chronological: number;
  /** 重要性权重 */
  importance: number;
  /** 情绪连贯性权重 */
  emotionContinuity: number;
  /** 节奏匹配权重 */
  rhythmMatch: number;
  /** 内容相关性权重 */
  contentRelevance: number;
}

/**
 * 视频片段
 */
export interface VideoSegment {
  /** 片段ID */
  id: string;
  /** 开始时间 (秒) */
  startTime: number;
  /** 结束时间 (秒) */
  endTime: number;
  /** 持续时间 (秒) */
  duration: number;
  /** 情绪 */
  emotion: EmotionType;
  /** 重要性 (0-1) */
  importance: number;
  /** 内容标签 */
  tags: string[];
  /** 场景类型 */
  sceneType: string;
  /** 运动强度 (0-1) */
  motionIntensity: number;
  /** 音频特征 */
  audioFeatures: AudioFeatures;
}

/**
 * 音频特征
 */
export interface AudioFeatures {
  /** 音量 (0-1) */
  volume: number;
  /** 是否有语音 */
  hasSpeech: boolean;
  /** 是否有音乐 */
  hasMusic: boolean;
  /** 节奏BPM */
  bpm?: number;
  /** 频谱特征 */
  spectralFeatures: SpectralFeatures;
}

/**
 * 频谱特征
 */
export interface SpectralFeatures {
  /** 低频能量 (0-1) */
  lowEnergy: number;
  /** 中频能量 (0-1) */
  midEnergy: number;
  /** 高频能量 (0-1) */
  highEnergy: number;
  /** 频谱质心 */
  spectralCentroid: number;
  /** 频谱滚降点 */
  spectralRolloff: number;
}

/**
 * 智能剪辑配置
 */
export interface SmartEditingConfig {
  /** 是否启用节奏匹配 */
  enableRhythmMatching: boolean;
  /** 是否启用情绪感知 */
  enableEmotionAwareness: boolean;
  /** 是否启用自动预告片生成 */
  enableAutoTrailer: boolean;
  /** 是否启用智能排序 */
  enableSmartSorting: boolean;
  /** 节奏匹配精度 */
  rhythmMatchPrecision: number;
  /** 情绪分析精度 */
  emotionAnalysisPrecision: number;
  /** 最小剪辑点间隔 (秒) */
  minCutInterval: number;
  /** 最大剪辑点间隔 (秒) */
  maxCutInterval: number;
  /** 默认过渡效果 */
  defaultTransition: TransitionType;
}

// ==================== 辅助函数 ====================

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 计算数组平均值
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0;
  return array.reduce((a, b) => a + b, 0) / array.length;
}

/**
 * 计算数组标准差
 */
export function standardDeviation(array: number[]): number {
  if (array.length === 0) return 0;
  const avg = average(array);
  const squareDiffs = array.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * 平滑数组
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
 * 检测峰值
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
 * 计算两个数组的相似度
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
 * 计算音频能量
 */
export function computeAudioEnergy(audioData: Float32Array): number {
  let energy = 0;
  for (let i = 0; i < audioData.length; i++) {
    energy += audioData[i] * audioData[i];
  }
  return energy / audioData.length;
}

/**
 * 计算音频过零率
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
 * 检测静音段
 */
export function detectSilence(
  audioData: Float32Array,
  sampleRate: number,
  threshold: number = 0.01,
  minDuration: number = 0.1,
): Array<{ start: number; end: number }> {
  const silenceSegments: Array<{ start: number; end: number }> = [];
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms帧
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

  // 处理最后一个静音段
  if (inSilence) {
    const silenceEnd = audioData.length / sampleRate;
    const duration = silenceEnd - silenceStart;

    if (duration >= minDuration) {
      silenceSegments.push({ start: silenceStart, end: silenceEnd });
    }
  }

  return silenceSegments;
}

// ==================== 核心功能 ====================

/**
 * 默认智能剪辑配置
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
 * 检测音频节拍
 */
export function detectBeats(audioData: Float32Array, sampleRate: number): BeatInfo {
  // 计算音频能量包络
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms帧
  const hopSize = Math.floor(frameSize / 2);
  const energyEnvelope: number[] = [];

  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    energyEnvelope.push(computeAudioEnergy(frame));
  }

  // 平滑能量包络
  const smoothedEnergy = smoothArray(energyEnvelope, 5);

  // 检测峰值作为节拍点
  const peaks = detectPeaks(smoothedEnergy, 0.3);

  // 计算BPM
  const peakTimes = peaks.map((p) => (p * hopSize) / sampleRate);
  const intervals: number[] = [];

  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }

  const avgInterval = intervals.length > 0 ? average(intervals) : 0.5;
  const bpm = avgInterval > 0 ? 60 / avgInterval : 120;

  // 检测强拍（每隔4个节拍）
  const downbeats: number[] = [];
  for (let i = 0; i < peakTimes.length; i += 4) {
    downbeats.push(peakTimes[i]);
  }

  // 计算节拍强度
  const beatStrength = peaks.map((p) => smoothedEnergy[p] || 0);

  return {
    bpm: Math.round(bpm),
    beats: peakTimes,
    downbeats,
    beatStrength,
    confidence: 0.8,
  };
}

/**
 * 分析情绪
 */
export function analyzeEmotion(
  audioData: Float32Array,
  sampleRate: number,
  videoFeatures?: Array<{ brightness: number; motion: number; color: number }>,
): EmotionAnalysis {
  const timeline: EmotionPoint[] = [];
  const frameSize = Math.floor(sampleRate * 0.1); // 100ms帧
  const hopSize = Math.floor(frameSize / 2);

  // 分析音频特征
  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    const time = i / sampleRate;

    const energy = computeAudioEnergy(frame);
    const zcr = computeZeroCrossingRate(frame);

    // 基于音频特征推断情绪
    let emotion: EmotionType = 'neutral';
    let intensity = 0;

    if (energy > 0.1 && zcr > 0.1) {
      emotion = 'excited';
      intensity = Math.min(energy * 5, 1);
    } else if (energy > 0.05 && zcr < 0.05) {
      emotion = 'calm';
      intensity = Math.min(energy * 3, 1);
    } else if (energy < 0.01) {
      emotion = 'sad';
      intensity = Math.min((0.01 - energy) * 100, 1);
    } else {
      emotion = 'neutral';
      intensity = 0.5;
    }

    // 如果有视频特征，结合视觉信息
    if (videoFeatures && videoFeatures.length > 0) {
      const frameIndex = Math.floor((i / audioData.length) * videoFeatures.length);
      const visual = videoFeatures[Math.min(frameIndex, videoFeatures.length - 1)];

      if (visual.motion > 0.5) {
        emotion = 'excited';
        intensity = Math.max(intensity, visual.motion);
      } else if (visual.brightness < 0.3) {
        emotion = 'sad';
        intensity = Math.max(intensity, 1 - visual.brightness);
      }
    }

    timeline.push({
      time,
      emotion,
      intensity,
      confidence: 0.7,
    });
  }

  // 检测情绪高潮点
  const peaks = detectEmotionPeaks(timeline);

  // 计算整体情绪
  const emotionCounts: Record<EmotionType, number> = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    surprised: 0,
    disgusted: 0,
    excited: 0,
    calm: 0,
    tense: 0,
  };

  for (const point of timeline) {
    emotionCounts[point.emotion]++;
  }

  const overallEmotion = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0][0] as EmotionType;

  // 计算情绪变化强度
  const intensities = timeline.map((p) => p.intensity);
  const emotionalIntensity = standardDeviation(intensities);

  return {
    timeline,
    overallEmotion,
    emotionalIntensity,
    peaks,
  };
}

/**
 * 检测情绪高潮点
 */
function detectEmotionPeaks(timeline: EmotionPoint[]): TimePoint[] {
  const peaks: TimePoint[] = [];
  const windowSize = 10;

  for (let i = windowSize; i < timeline.length - windowSize; i++) {
    const window = timeline.slice(i - windowSize, i + windowSize + 1);
    const avgIntensity = average(window.map((p) => p.intensity));
    const currentIntensity = timeline[i].intensity;

    if (currentIntensity > avgIntensity * 1.5 && currentIntensity > 0.6) {
      peaks.push({
        time: timeline[i].time,
        confidence: currentIntensity,
        type: 'emotion-peak',
        description: `情绪高潮: ${timeline[i].emotion}`,
      });
    }
  }

  return peaks;
}

/**
 * 生成剪辑建议
 */
export function generateCutSuggestions(
  beatInfo: BeatInfo,
  emotionAnalysis: EmotionAnalysis,
  sceneChanges: TimePoint[],
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  // 基于节拍的剪辑点
  if (mergedConfig.enableRhythmMatching) {
    for (const beat of beatInfo.beats) {
      const nearbyEmotion = findNearestEmotion(emotionAnalysis.timeline, beat);

      suggestions.push({
        id: generateId(),
        time: beat,
        type: 'hard-cut',
        confidence: 0.8 * mergedConfig.rhythmMatchPrecision,
        reason: '节拍匹配',
        relatedTimePoints: [
          {
            time: beat,
            confidence: 0.8,
            type: 'beat',
          },
        ],
        suggestedTransition: 'none',
      });
    }
  }

  // 基于情绪的剪辑点
  if (mergedConfig.enableEmotionAwareness) {
    for (const peak of emotionAnalysis.peaks) {
      suggestions.push({
        id: generateId(),
        time: peak.time,
        type: 'cutaway',
        confidence: peak.confidence * mergedConfig.emotionAnalysisPrecision,
        reason: `情绪变化: ${peak.description}`,
        relatedTimePoints: [peak],
        suggestedTransition: 'cross-dissolve',
      });
    }
  }

  // 基于场景变化的剪辑点
  for (const change of sceneChanges) {
    suggestions.push({
      id: generateId(),
      time: change.time,
      type: 'match-cut',
      confidence: change.confidence,
      reason: '场景变化',
      relatedTimePoints: [change],
      suggestedTransition: 'cross-dissolve',
    });
  }

  // 去重和排序
  const uniqueSuggestions = deduplicateSuggestions(suggestions, mergedConfig.minCutInterval);
  uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

  return uniqueSuggestions;
}

/**
 * 查找最近的情绪点
 */
function findNearestEmotion(timeline: EmotionPoint[], time: number): EmotionPoint | null {
  if (timeline.length === 0) return null;

  let nearest = timeline[0];
  let minDistance = Math.abs(timeline[0].time - time);

  for (const point of timeline) {
    const distance = Math.abs(point.time - time);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

/**
 * 去重剪辑建议
 */
function deduplicateSuggestions(suggestions: CutSuggestion[], minInterval: number): CutSuggestion[] {
  const sorted = [...suggestions].sort((a, b) => a.time - b.time);
  const unique: CutSuggestion[] = [];

  for (const suggestion of sorted) {
    const lastUnique = unique[unique.length - 1];

    if (!lastUnique || suggestion.time - lastUnique.time >= minInterval) {
      unique.push(suggestion);
    } else if (suggestion.confidence > lastUnique.confidence) {
      unique[unique.length - 1] = suggestion;
    }
  }

  return unique;
}

/**
 * 生成预告片
 */
export function generateTrailer(segments: VideoSegment[], config: Partial<TrailerConfig> = {}): TrailerResult {
  const defaultConfig: TrailerConfig = {
    targetDuration: 120, // 2分钟
    style: 'official',
    tempo: 'dynamic',
    includeDialogue: true,
    includeMusic: true,
    includeNarration: false,
    emotionCurve: ['excited', 'calm', 'excited', 'tense', 'excited'],
    climaxCount: 3,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  // 按重要性排序
  const sortedSegments = [...segments].sort((a, b) => b.importance - a.importance);

  // 选择高潮片段
  const climaxSegments = sortedSegments
    .filter((s) => s.emotion === 'excited' || s.emotion === 'tense')
    .slice(0, mergedConfig.climaxCount);

  // 选择铺垫片段
  const setupSegments = sortedSegments.filter((s) => s.emotion === 'calm' || s.emotion === 'neutral').slice(0, 3);

  // 组装预告片
  const trailerSegments: TrailerSegment[] = [];
  let currentDuration = 0;

  // 开场
  if (setupSegments.length > 0) {
    const opening = setupSegments[0];
    trailerSegments.push({
      id: generateId(),
      sourceId: opening.id,
      startTime: opening.startTime,
      endTime: Math.min(opening.endTime, opening.startTime + 10),
      type: 'opening',
      emotion: opening.emotion,
      importance: opening.importance,
      transition: 'fade-in',
    });
    currentDuration += 10;
  }

  // 高潮部分
  for (let i = 0; i < climaxSegments.length && currentDuration < mergedConfig.targetDuration; i++) {
    const climax = climaxSegments[i];
    const segmentDuration = Math.min(climax.duration, 15);

    trailerSegments.push({
      id: generateId(),
      sourceId: climax.id,
      startTime: climax.startTime,
      endTime: climax.startTime + segmentDuration,
      type: 'climax',
      emotion: climax.emotion,
      importance: climax.importance,
      transition: i === 0 ? 'cross-dissolve' : 'none',
    });

    currentDuration += segmentDuration;
  }

  // 结尾
  if (setupSegments.length > 1) {
    const closing = setupSegments[setupSegments.length - 1];
    trailerSegments.push({
      id: generateId(),
      sourceId: closing.id,
      startTime: closing.startTime,
      endTime: Math.min(closing.endTime, closing.startTime + 10),
      type: 'closing',
      emotion: closing.emotion,
      importance: closing.importance,
      transition: 'fade-out',
    });
    currentDuration += 10;
  }

  // 生成情绪曲线
  const emotionCurve: EmotionPoint[] = trailerSegments.map((segment, index) => ({
    time: index * 10,
    emotion: segment.emotion,
    intensity: segment.importance,
    confidence: 0.8,
  }));

  // 生成节拍信息
  const beatInfo: BeatInfo = {
    bpm: 120,
    beats: trailerSegments.map((_, index) => index * 0.5),
    downbeats: trailerSegments.filter((_, index) => index % 4 === 0).map((_, index) => index * 2),
    beatStrength: trailerSegments.map((s) => s.importance),
    confidence: 0.8,
  };

  // 计算质量评分
  const qualityScore = computeTrailerQuality(trailerSegments, mergedConfig);

  return {
    segments: trailerSegments,
    totalDuration: currentDuration,
    emotionCurve,
    beatInfo,
    qualityScore,
  };
}

/**
 * 计算预告片质量
 */
function computeTrailerQuality(segments: TrailerSegment[], config: TrailerConfig): number {
  let score = 0;

  // 时长匹配度
  const durationRatio = (segments.length * 10) / config.targetDuration;
  score += 1 - Math.abs(1 - durationRatio);

  // 情绪多样性
  const emotions = new Set(segments.map((s) => s.emotion));
  score += emotions.size / 5;

  // 结构完整性
  const hasOpening = segments.some((s) => s.type === 'opening');
  const hasClosing = segments.some((s) => s.type === 'closing');
  const hasClimax = segments.some((s) => s.type === 'climax');

  if (hasOpening) score += 0.2;
  if (hasClosing) score += 0.2;
  if (hasClimax) score += 0.2;

  return Math.min(score / 2, 1);
}

/**
 * 智能排序片段
 */
export function sortSegments(segments: VideoSegment[], options: Partial<SegmentSortOptions> = {}): VideoSegment[] {
  const defaultOptions: SegmentSortOptions = {
    strategy: 'narrative',
    preserveOriginalOrder: false,
    considerEmotionContinuity: true,
    considerRhythm: true,
    considerContentRelevance: true,
    weights: {
      chronological: 0.2,
      importance: 0.3,
      emotionContinuity: 0.2,
      rhythmMatch: 0.15,
      contentRelevance: 0.15,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  switch (mergedOptions.strategy) {
    case 'chronological':
      return [...segments].sort((a, b) => a.startTime - b.startTime);

    case 'importance':
      return [...segments].sort((a, b) => b.importance - a.importance);

    case 'emotion':
      return sortByEmotion(segments);

    case 'rhythm':
      return sortByRhythm(segments);

    case 'narrative':
      return sortByNarrative(segments, mergedOptions);

    case 'random':
      return shuffleArray([...segments]);

    default:
      return segments;
  }
}

/**
 * 按情绪排序
 */
function sortByEmotion(segments: VideoSegment[]): VideoSegment[] {
  const emotionOrder: EmotionType[] = ['calm', 'neutral', 'happy', 'excited', 'tense', 'angry', 'sad'];

  return [...segments].sort((a, b) => {
    const aIndex = emotionOrder.indexOf(a.emotion);
    const bIndex = emotionOrder.indexOf(b.emotion);
    return aIndex - bIndex;
  });
}

/**
 * 按节奏排序
 */
function sortByRhythm(segments: VideoSegment[]): VideoSegment[] {
  return [...segments].sort((a, b) => {
    // 按运动强度排序
    return b.motionIntensity - a.motionIntensity;
  });
}

/**
 * 按叙事结构排序
 */
function sortByNarrative(segments: VideoSegment[], options: SegmentSortOptions): VideoSegment[] {
  const weights = options.weights || {
    chronological: 0.2,
    importance: 0.3,
    emotionContinuity: 0.2,
    rhythmMatch: 0.15,
    contentRelevance: 0.15,
  };

  // 计算每个片段的综合得分
  const scoredSegments = segments.map((segment, index) => {
    let score = 0;

    // 时间顺序得分
    score += (1 - index / segments.length) * weights.chronological;

    // 重要性得分
    score += segment.importance * weights.importance;

    // 情绪连贯性得分（与前后片段的情绪相似度）
    const prevSegment = index > 0 ? segments[index - 1] : null;
    const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;

    let emotionContinuity = 0;
    if (prevSegment && prevSegment.emotion === segment.emotion) {
      emotionContinuity += 0.5;
    }
    if (nextSegment && nextSegment.emotion === segment.emotion) {
      emotionContinuity += 0.5;
    }
    score += emotionContinuity * weights.emotionContinuity;

    // 节奏匹配得分
    score += segment.motionIntensity * weights.rhythmMatch;

    // 内容相关性得分
    score += (segment.tags.length / 10) * weights.contentRelevance;

    return { segment, score };
  });

  // 按得分排序
  scoredSegments.sort((a, b) => b.score - a.score);

  return scoredSegments.map((item) => item.segment);
}

/**
 * 打乱数组
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 节奏匹配剪辑
 */
export function rhythmMatchEdit(
  videoSegments: VideoSegment[],
  beatInfo: BeatInfo,
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  let currentBeatIndex = 0;
  let currentVideoIndex = 0;
  let currentTime = 0;

  while (currentVideoIndex < videoSegments.length && currentBeatIndex < beatInfo.beats.length) {
    const beatTime = beatInfo.beats[currentBeatIndex];
    const videoSegment = videoSegments[currentVideoIndex];

    // 如果当前视频片段包含节拍点
    if (beatTime >= videoSegment.startTime && beatTime <= videoSegment.endTime) {
      suggestions.push({
        id: generateId(),
        time: beatTime,
        type: 'hard-cut',
        confidence: 0.9,
        reason: '节奏匹配',
        relatedTimePoints: [
          {
            time: beatTime,
            confidence: 0.9,
            type: 'beat',
          },
        ],
        suggestedTransition: 'none',
      });

      currentBeatIndex++;
    } else {
      // 移动到下一个视频片段
      currentVideoIndex++;
      currentTime = videoSegments[currentVideoIndex]?.startTime || 0;
    }
  }

  return suggestions;
}

/**
 * 情绪感知剪辑
 */
export function emotionAwareEdit(
  videoSegments: VideoSegment[],
  emotionAnalysis: EmotionAnalysis,
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  // 在情绪变化点创建剪辑建议
  for (let i = 1; i < emotionAnalysis.timeline.length; i++) {
    const prev = emotionAnalysis.timeline[i - 1];
    const curr = emotionAnalysis.timeline[i];

    // 检测情绪变化
    if (prev.emotion !== curr.emotion) {
      const intensityChange = Math.abs(curr.intensity - prev.intensity);

      if (intensityChange > 0.3) {
        suggestions.push({
          id: generateId(),
          time: curr.time,
          type: 'cutaway',
          confidence: intensityChange,
          reason: `情绪变化: ${prev.emotion} -> ${curr.emotion}`,
          relatedTimePoints: [
            {
              time: curr.time,
              confidence: intensityChange,
              type: 'emotion-peak',
              description: `情绪从${prev.emotion}变为${curr.emotion}`,
            },
          ],
          suggestedTransition: 'cross-dissolve',
        });
      }
    }
  }

  return suggestions;
}

/**
 * 创建默认智能剪辑配置
 */
export function createDefaultSmartEditingConfig(): SmartEditingConfig {
  return { ...DEFAULT_SMART_EDITING_CONFIG };
}

/**
 * 验证智能剪辑配置
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
