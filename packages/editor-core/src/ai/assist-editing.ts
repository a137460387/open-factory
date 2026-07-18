/**
 * AI 辅助剪辑模块
 *
 * 在 smart-editing.ts 的基础算法之上，提供更高级的"自动剪辑建议"功能。
 * 基于内容分析（场景、情绪、节奏、说话人、关键帧）自动生成剪辑方案。
 *
 * 所有函数均为纯计算，无副作用。
 */

import type { AiModuleResult, TranslateFn } from '../ai-module-types';
import { identityTranslator } from '../ai-module-types';

// ==================== 类型定义 ====================

/**
 * 场景类型枚举
 */
export type SceneType =
  | 'intro'       // 开场
  | 'action'      // 动作
  | 'dialogue'    // 对话
  | 'transition'  // 过渡
  | 'climax'      // 高潮
  | 'outro'       // 结尾
  | 'montage'     // 蒙太奇
  | 'b-roll';     // B-Roll 补充镜头

/**
 * 场景信息
 */
export interface SceneInfo {
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 场景类型 */
  sceneType: SceneType;
  /** 场景描述 */
  description: string;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 节奏配置
 */
export interface RhythmProfile {
  /** BPM（每分钟节拍数） */
  bpm: number;
  /** 节拍时间点数组（秒） */
  beatTimes: number[];
  /** 能量曲线（归一化 0-1，每秒一个采样点） */
  energyCurve: number[];
  /** 速度变化点数组，包含时间和新 BPM */
  tempoChanges: Array<{ time: number; bpm: number }>;
}

/**
 * 说话人片段
 */
export interface SpeakerSegment {
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 说话人 ID */
  speakerId: string;
  /** 说话文本（可选，由语音识别提供） */
  text: string;
  /** 情绪标签 */
  emotion: string;
}

/**
 * 内容分析结果
 */
export interface ContentAnalysisResult {
  /** 检测到的场景列表 */
  scenes: SceneInfo[];
  /** 情绪曲线（每秒一个采样点，归一化 0-1，0=消极，1=积极） */
  emotionCurve: number[];
  /** 节奏配置 */
  rhythmProfile: RhythmProfile;
  /** 说话人片段列表 */
  speakerSegments: SpeakerSegment[];
  /** 关键帧时间点数组（秒） */
  keyFrames: number[];
}

/**
 * 辅助剪辑配置
 */
export interface AssistEditingConfig {
  /** 是否启用自动剪切 */
  enableAutoCut: boolean;
  /** 是否启用节奏同步 */
  enableRhythmSync: boolean;
  /** 是否启用情绪感知 */
  enableEmotionAware: boolean;
  /** 是否启用内容分析 */
  enableContentAnalysis: boolean;
  /** 目标总时长（秒），可选 */
  targetDuration?: number;
  /** 最大剪切数量，可选 */
  maxCutCount?: number;
  /** 最小片段时长（秒） */
  minSegmentDuration: number;
  /** 最大片段时长（秒） */
  maxSegmentDuration: number;
  /** 偏好剪切类型列表 */
  preferredCutTypes: string[];
  /** 过渡偏好 */
  transitionPreference: string;
}

/**
 * 辅助剪辑建议
 */
export interface AssistEditingSuggestion {
  /** 建议 ID */
  id: string;
  /** 剪切开始时间（秒） */
  startTime: number;
  /** 剪切结束时间（秒） */
  endTime: number;
  /** 剪切类型 */
  cutType: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 建议原因 */
  reason: string;
  /** 来源分析类型 */
  sourceAnalysis: 'scene' | 'rhythm' | 'emotion' | 'speaker' | 'keyframe' | 'combined';
  /** 建议的过渡效果 */
  suggestedTransition: string;
  /** 优先级 (1-10，10 最高) */
  priority: number;
}

/**
 * 辅助剪辑结果
 */
export interface AssistEditingResult {
  /** 剪辑建议列表 */
  suggestions: AssistEditingSuggestion[];
  /** 内容分析结果 */
  analysisResult: ContentAnalysisResult;
  /** 节奏配置 */
  rhythmProfile: RhythmProfile;
  /** 预估总时长（秒） */
  totalEstimatedDuration: number;
  /** 质量评分 (0-1) */
  qualityScore: number;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
}

/**
 * 辅助剪辑预设
 */
export type AssistEditingPreset =
  | 'quick-cut'      // 快速剪辑
  | 'rhythm-match'   // 节奏匹配
  | 'emotion-driven' // 情绪驱动
  | 'content-aware'  // 内容感知
  | 'custom';        // 自定义

/**
 * 辅助剪辑进度事件
 */
export interface AssistEditingProgressEvent {
  /** 当前阶段 */
  phase: 'analysis' | 'suggestion' | 'ranking' | 'complete';
  /** 进度 (0-1) */
  progress: number;
  /** 进度消息 */
  message: string;
}

// ==================== 辅助工具函数 ====================

/**
 * 将数值限制在指定范围内
 *
 * @param value - 输入值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的值
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 生成唯一 ID（基于时间戳和随机数）
 *
 * @returns 唯一 ID 字符串
 */
function generateId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

/**
 * 计算数组的均值
 *
 * @param arr - 数值数组
 * @returns 均值，空数组返回 0
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * 计算数组的标准差
 *
 * @param arr - 数值数组
 * @returns 标准差，空数组返回 0
 */
function stddev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length);
}

/**
 * 对数组进行移动平均平滑
 *
 * @param arr - 输入数组
 * @param windowSize - 窗口大小（奇数），默认 5
 * @returns 平滑后的数组
 */
function smooth(arr: number[], windowSize: number = 5): number[] {
  const half = Math.floor(windowSize / 2);
  const result: number[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length) {
        sum += arr[j];
        count++;
      }
    }
    result[i] = sum / count;
  }
  return result;
}

/**
 * 检测数组中的局部峰值索引
 *
 * @param arr - 输入数组
 * @param threshold - 峰值最小阈值，默认 0
 * @returns 峰值索引数组
 */
function findPeaks(arr: number[], threshold: number = 0): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1] && arr[i] >= threshold) {
      peaks.push(i);
    }
  }
  return peaks;
}

// ==================== 场景类型推断辅助 ====================

/**
 * 根据时间位置和相邻场景推断场景类型
 *
 * @param startTime - 场景开始时间
 * @param endTime - 场景结束时间
 * @param totalDuration - 总时长
 * @param prevType - 前一个场景类型
 * @param motionLevel - 运动水平 (0-1)
 * @returns 推断的场景类型
 */
function inferSceneType(
  startTime: number,
  endTime: number,
  totalDuration: number,
  prevType: SceneType | null,
  motionLevel: number,
): SceneType {
  const relativeStart = totalDuration > 0 ? startTime / totalDuration : 0;
  const relativeEnd = totalDuration > 0 ? endTime / totalDuration : 0;
  const duration = endTime - startTime;

  // 根据相对位置推断
  if (relativeStart < 0.05) return 'intro';
  if (relativeEnd > 0.95) return 'outro';

  // 根据运动水平推断
  if (motionLevel > 0.7) return 'action';
  if (motionLevel > 0.4 && duration < 3) return 'montage';

  // 根据前后关系推断
  if (prevType === 'action' && motionLevel < 0.3) return 'transition';
  if (prevType === 'dialogue' && motionLevel > 0.5) return 'b-roll';

  return 'dialogue';
}

// ==================== 核心函数 ====================

/**
 * 分析视频内容，检测场景、情绪、节奏
 *
 * 基于帧间差异检测场景转换，基于音频能量和过零率分析情绪和节奏。
 * 所有计算在本地完成，无副作用。
 *
 * @param frames - 视频帧数据数组（每帧为 Uint8Array，假设 RGBA 格式）
 * @param audioData - 音频采样数据（单声道浮点，范围 -1 到 1）
 * @param sampleRate - 音频采样率（Hz）
 * @returns 内容分析结果
 */
export function analyzeContent(
  frames: Uint8Array[],
  audioData: Float32Array,
  sampleRate: number,
): ContentAnalysisResult {
  const frameCount = frames.length;
  const audioDuration = audioData.length / sampleRate;

  // 估算视频帧率（假设帧均匀分布覆盖音频时长）
  const fps = frameCount > 0 && audioDuration > 0 ? frameCount / audioDuration : 30;

  // --- 场景转换检测 ---
  const transitionIndices = detectSceneTransitions(frames, 0.35);
  const transitionTimes = transitionIndices.map((idx) => idx / fps);

  // 构建场景列表
  const scenes = buildScenesFromTransitions(transitionTimes, audioDuration, frames, fps);

  // --- 情绪曲线分析（基于音频能量） ---
  const emotionCurve = computeEmotionCurve(audioData, sampleRate, audioDuration);

  // --- 节奏分析 ---
  const rhythmProfile = computeRhythmProfile(audioData, sampleRate);

  // --- 说话人片段检测（基于静音段分割） ---
  const speakerSegments = detectSpeakerSegments(audioData, sampleRate);

  // --- 关键帧检测（基于帧间差异峰值） ---
  const keyFrames = detectKeyFrameTimes(frames, fps);

  return {
    scenes,
    emotionCurve,
    rhythmProfile,
    speakerSegments,
    keyFrames,
  };
}

/**
 * 基于内容分析结果生成剪辑建议
 *
 * 根据配置中的开关，分别从场景、节奏、情绪、说话人、关键帧等维度
 * 生成剪辑建议，然后合并去重、评估优先级。
 *
 * @param analysis - 内容分析结果
 * @param config - 辅助剪辑配置
 * @returns 剪辑建议列表（已排序）
 */
export function generateAssistEditingSuggestions(
  analysis: ContentAnalysisResult,
  config: AssistEditingConfig,
): AssistEditingSuggestion[] {
  const suggestions: AssistEditingSuggestion[] = [];

  // 1. 基于场景的剪辑建议
  if (config.enableContentAnalysis) {
    for (const scene of analysis.scenes) {
      const duration = scene.endTime - scene.startTime;
      if (duration < config.minSegmentDuration) continue;

      // 在场景边界处建议剪切
      if (scene.confidence > 0.4) {
        suggestions.push({
          id: generateId(),
          startTime: scene.startTime,
          endTime: scene.endTime,
          cutType: determineCutTypeForScene(scene.sceneType, config),
          confidence: scene.confidence,
          reason: `场景变化: ${scene.description}`,
          sourceAnalysis: 'scene',
          suggestedTransition: determineTransitionForScene(scene.sceneType, config.transitionPreference),
          priority: computeScenePriority(scene),
        });
      }
    }
  }

  // 2. 基于节奏的剪辑建议
  if (config.enableRhythmSync && analysis.rhythmProfile.beatTimes.length > 0) {
    const beatSuggestions = generateRhythmSuggestions(analysis.rhythmProfile, config);
    suggestions.push(...beatSuggestions);
  }

  // 3. 基于情绪的剪辑建议
  if (config.enableEmotionAware) {
    const emotionSuggestions = generateEmotionSuggestions(analysis.emotionCurve, config);
    suggestions.push(...emotionSuggestions);
  }

  // 4. 基于说话人的剪辑建议
  if (config.enableContentAnalysis && analysis.speakerSegments.length > 0) {
    const speakerSuggestions = generateSpeakerSuggestions(analysis.speakerSegments, config);
    suggestions.push(...speakerSuggestions);
  }

  // 5. 基于关键帧的剪辑建议
  if (config.enableAutoCut && analysis.keyFrames.length > 0) {
    const kfSuggestions = generateKeyFrameSuggestions(analysis.keyFrames, config);
    suggestions.push(...kfSuggestions);
  }

  // 合并相近的剪辑点
  const merged = mergeNearbyCuts(suggestions, config.minSegmentDuration);

  // 过滤和排序
  const maxCount = config.maxCutCount ?? merged.length;
  return filterAndRankSuggestions(merged, maxCount);
}

/**
 * 应用预设配置
 *
 * 根据预设名称返回对应的配置对象。
 *
 * @param preset - 预设名称
 * @returns 辅助剪辑配置
 */
export function applyAssistEditingPreset(preset: AssistEditingPreset): AssistEditingConfig {
  switch (preset) {
    case 'quick-cut':
      return {
        enableAutoCut: true,
        enableRhythmSync: false,
        enableEmotionAware: false,
        enableContentAnalysis: false,
        minSegmentDuration: 0.5,
        maxSegmentDuration: 5,
        preferredCutTypes: ['hard-cut'],
        transitionPreference: 'none',
      };

    case 'rhythm-match':
      return {
        enableAutoCut: false,
        enableRhythmSync: true,
        enableEmotionAware: false,
        enableContentAnalysis: false,
        minSegmentDuration: 1,
        maxSegmentDuration: 8,
        preferredCutTypes: ['hard-cut', 'beat-cut'],
        transitionPreference: 'none',
      };

    case 'emotion-driven':
      return {
        enableAutoCut: false,
        enableRhythmSync: true,
        enableEmotionAware: true,
        enableContentAnalysis: false,
        minSegmentDuration: 2,
        maxSegmentDuration: 15,
        preferredCutTypes: ['cross-dissolve', 'cutaway'],
        transitionPreference: 'cross-dissolve',
      };

    case 'content-aware':
      return {
        enableAutoCut: true,
        enableRhythmSync: true,
        enableEmotionAware: true,
        enableContentAnalysis: true,
        minSegmentDuration: 1,
        maxSegmentDuration: 20,
        preferredCutTypes: ['hard-cut', 'match-cut', 'cutaway'],
        transitionPreference: 'cross-dissolve',
      };

    case 'custom':
    default:
      return createDefaultAssistEditingConfig();
  }
}

/**
 * 评估单条剪辑建议的质量分数
 *
 * 综合考虑置信度、来源分析可信度、与情绪曲线的匹配度、
 * 时长合理性等因素。
 *
 * @param suggestion - 剪辑建议
 * @param context - 内容分析上下文
 * @returns 质量评分 (0-1)
 */
export function scoreSuggestionQuality(
  suggestion: AssistEditingSuggestion,
  context: ContentAnalysisResult,
): number {
  let score = 0;

  // 1. 基础置信度 (权重 0.3)
  score += suggestion.confidence * 0.3;

  // 2. 来源分析可信度 (权重 0.15)
  const sourceWeights: Record<string, number> = {
    combined: 1.0,
    scene: 0.85,
    speaker: 0.8,
    emotion: 0.75,
    rhythm: 0.7,
    keyframe: 0.6,
  };
  score += (sourceWeights[suggestion.sourceAnalysis] ?? 0.5) * 0.15;

  // 3. 情绪匹配度 (权重 0.2)
  const midTime = (suggestion.startTime + suggestion.endTime) / 2;
  const emotionIdx = Math.min(
    Math.floor(midTime),
    context.emotionCurve.length - 1,
  );
  if (emotionIdx >= 0 && emotionIdx < context.emotionCurve.length) {
    // 如果在情绪高点或低点剪切，加分
    const emotionVal = context.emotionCurve[emotionIdx];
    const isExtreme = emotionVal > 0.75 || emotionVal < 0.25;
    score += (isExtreme ? 0.8 : 0.5) * 0.2;
  } else {
    score += 0.5 * 0.2;
  }

  // 4. 节奏对齐度 (权重 0.15)
  if (context.rhythmProfile.beatTimes.length > 0) {
    const nearestBeatDist = findNearestBeatDistance(
      suggestion.startTime,
      context.rhythmProfile.beatTimes,
    );
    // 距离节拍越近分数越高，阈值 0.1 秒内为满分
    const rhythmScore = clamp(1 - nearestBeatDist / 0.5, 0, 1);
    score += rhythmScore * 0.15;
  } else {
    score += 0.5 * 0.15;
  }

  // 5. 片段时长合理性 (权重 0.2)
  const segDuration = suggestion.endTime - suggestion.startTime;
  if (segDuration >= 1 && segDuration <= 10) {
    score += 1.0 * 0.2;
  } else if (segDuration >= 0.5 && segDuration <= 20) {
    score += 0.6 * 0.2;
  } else {
    score += 0.2 * 0.2;
  }

  return clamp(score, 0, 1);
}

/**
 * 过滤和排序剪辑建议
 *
 * 按优先级和质量评分排序，去除超出 maxCount 的低质量建议。
 *
 * @param suggestions - 原始建议列表
 * @param maxCount - 最大返回数量
 * @returns 排序和过滤后的建议列表
 */
export function filterAndRankSuggestions(
  suggestions: AssistEditingSuggestion[],
  maxCount: number,
): AssistEditingSuggestion[] {
  // 按优先级降序，相同优先级按置信度降序
  const sorted = [...suggestions].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.confidence - a.confidence;
  });

  // 限制数量
  return sorted.slice(0, Math.max(1, Math.floor(maxCount)));
}

/**
 * 创建默认辅助剪辑配置
 *
 * @returns 默认配置对象
 */
export function createDefaultAssistEditingConfig(): AssistEditingConfig {
  return {
    enableAutoCut: true,
    enableRhythmSync: true,
    enableEmotionAware: true,
    enableContentAnalysis: true,
    minSegmentDuration: 1,
    maxSegmentDuration: 15,
    preferredCutTypes: ['hard-cut', 'cross-dissolve'],
    transitionPreference: 'cross-dissolve',
  };
}

/**
 * 验证辅助剪辑配置的合法性
 *
 * 检查所有必填字段的类型和数值范围。
 *
 * @param config - 待验证的配置
 * @returns 配置是否合法
 */
export function validateAssistEditingConfig(config: AssistEditingConfig): boolean {
  if (typeof config.enableAutoCut !== 'boolean') return false;
  if (typeof config.enableRhythmSync !== 'boolean') return false;
  if (typeof config.enableEmotionAware !== 'boolean') return false;
  if (typeof config.enableContentAnalysis !== 'boolean') return false;

  if (config.targetDuration !== undefined) {
    if (typeof config.targetDuration !== 'number' || config.targetDuration <= 0) return false;
  }
  if (config.maxCutCount !== undefined) {
    if (typeof config.maxCutCount !== 'number' || config.maxCutCount < 1) return false;
  }

  if (typeof config.minSegmentDuration !== 'number' || config.minSegmentDuration < 0) return false;
  if (typeof config.maxSegmentDuration !== 'number' || config.maxSegmentDuration < 0) return false;
  if (config.minSegmentDuration > config.maxSegmentDuration) return false;

  if (!Array.isArray(config.preferredCutTypes)) return false;
  if (typeof config.transitionPreference !== 'string') return false;

  return true;
}

/**
 * 构建 AI 辅助剪辑的系统提示
 *
 * 用于调用 LLM 生成剪辑方案时的 system prompt。
 *
 * @returns 系统提示字符串
 */
export function buildAssistEditingSystemPrompt(): string {
  return [
    '你是一个专业的视频剪辑助手。根据提供的视频内容分析结果（场景、情绪、节奏、说话人、关键帧），',
    '生成最优的剪辑方案。',
    '',
    '你需要返回一个 JSON 对象，结构如下：',
    '{',
    '  "suggestions": [',
    '    {',
    '      "startTime": 开始时间（秒）,',
    '      "endTime": 结束时间（秒）,',
    '      "cutType": "剪切类型（hard-cut|soft-cut|jump-cut|match-cut|cross-dissolve|cutaway|insert）",',
    '      "confidence": 置信度（0-1）,',
    '      "reason": "建议原因（中文）",',
    '      "suggestedTransition": "过渡效果（none|fade-in|fade-out|cross-dissolve|wipe|zoom|blur|slide|dip-to-black）",',
    '      "priority": 优先级（1-10，10最高）',
    '    }',
    '  ]',
    '}',
    '',
    '要求：',
    '1. 每个建议的 startTime 和 endTime 必须合理，endTime > startTime',
    '2. 片段时长需在配置的 minSegmentDuration 和 maxSegmentDuration 之间',
    '3. 优先在场景转换、情绪变化、节拍点、说话人切换处设置剪切点',
    '4. 如果配置了 targetDuration，需确保剪辑后总时长接近目标',
    '5. cutType 应优先使用配置中的 preferredCutTypes',
    '6. confidence 基于分析数据的可靠性给出',
    '7. reason 用中文简述剪辑理由',
  ].join('\n');
}

/**
 * 构建 AI 辅助剪辑的用户提示
 *
 * 将内容分析结果和配置序列化为 LLM 可理解的文本。
 *
 * @param analysis - 内容分析结果
 * @param config - 辅助剪辑配置
 * @returns 用户提示字符串
 */
export function buildAssistEditingUserPrompt(
  analysis: ContentAnalysisResult,
  config: AssistEditingConfig,
): string {
  const parts: string[] = [];

  // 配置信息
  parts.push('## 剪辑配置');
  if (config.targetDuration) {
    parts.push(`- 目标时长: ${config.targetDuration} 秒`);
  }
  if (config.maxCutCount) {
    parts.push(`- 最大剪切数: ${config.maxCutCount}`);
  }
  parts.push(`- 片段时长范围: ${config.minSegmentDuration}~${config.maxSegmentDuration} 秒`);
  parts.push(`- 偏好剪切类型: ${config.preferredCutTypes.join(', ')}`);
  parts.push(`- 过渡偏好: ${config.transitionPreference}`);
  parts.push(`- 启用功能: ${[
    config.enableAutoCut && '自动剪切',
    config.enableRhythmSync && '节奏同步',
    config.enableEmotionAware && '情绪感知',
    config.enableContentAnalysis && '内容分析',
  ]
    .filter(Boolean)
    .join(', ')}`);

  // 场景信息
  parts.push('\n## 场景列表');
  for (const scene of analysis.scenes) {
    parts.push(
      `- [${scene.startTime.toFixed(2)}s ~ ${scene.endTime.toFixed(2)}s] ${scene.sceneType} (${(scene.confidence * 100).toFixed(0)}%) - ${scene.description}`,
    );
  }

  // 节奏信息
  parts.push('\n## 节奏信息');
  parts.push(`- BPM: ${analysis.rhythmProfile.bpm}`);
  parts.push(`- 节拍数: ${analysis.rhythmProfile.beatTimes.length}`);
  if (analysis.rhythmProfile.tempoChanges.length > 0) {
    parts.push(
      `- 速度变化: ${analysis.rhythmProfile.tempoChanges.map((tc) => `${tc.time.toFixed(1)}s->${tc.bpm}bpm`).join(', ')}`,
    );
  }

  // 情绪曲线摘要
  parts.push('\n## 情绪曲线');
  const emotionSummary = summarizeCurve(analysis.emotionCurve);
  parts.push(`- 整体趋势: ${emotionSummary.trend}`);
  parts.push(`- 高潮点时间: ${emotionSummary.peaks.map((p) => p.toFixed(1) + 's').join(', ') || '无'}`);
  parts.push(`- 低谷点时间: ${emotionSummary.valleys.map((v) => v.toFixed(1) + 's').join(', ') || '无'}`);

  // 说话人信息
  if (analysis.speakerSegments.length > 0) {
    parts.push('\n## 说话人片段');
    for (const seg of analysis.speakerSegments) {
      const textPreview = seg.text.length > 30 ? seg.text.substring(0, 30) + '...' : seg.text;
      parts.push(
        `- [${seg.startTime.toFixed(2)}s ~ ${seg.endTime.toFixed(2)}s] ${seg.speakerId} (${seg.emotion}): ${textPreview}`,
      );
    }
  }

  // 关键帧
  if (analysis.keyFrames.length > 0) {
    parts.push('\n## 关键帧时间点');
    parts.push(`- ${analysis.keyFrames.map((t) => t.toFixed(2) + 's').join(', ')}`);
  }

  parts.push('\n请根据以上分析结果生成剪辑方案，返回 JSON。');
  return parts.join('\n');
}

/**
 * 解析 AI 响应为辅助剪辑结果
 *
 * 严格解析，失败时抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @returns 辅助剪辑结果
 * @throws 解析失败时抛出错误
 */
export function parseAssistEditingResponse(json: unknown): AssistEditingResult {
  const emptyResult: AssistEditingResult = {
    suggestions: [],
    analysisResult: {
      scenes: [],
      emotionCurve: [],
      rhythmProfile: { bpm: 120, beatTimes: [], energyCurve: [], tempoChanges: [] },
      speakerSegments: [],
      keyFrames: [],
    },
    rhythmProfile: { bpm: 120, beatTimes: [], energyCurve: [], tempoChanges: [] },
    totalEstimatedDuration: 0,
    qualityScore: 0,
    processingTimeMs: 0,
  };

  if (!json || typeof json !== 'object') {
    throw new Error('AI 响应不是有效的 JSON 对象');
  }

  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.suggestions)) {
    throw new Error('AI 响应缺少 suggestions 数组');
  }

  const suggestions: AssistEditingSuggestion[] = [];
  for (const item of obj.suggestions) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;

    const startTime = typeof s.startTime === 'number' ? s.startTime : null;
    const endTime = typeof s.endTime === 'number' ? s.endTime : null;
    const cutType = typeof s.cutType === 'string' ? s.cutType : null;
    const confidence = typeof s.confidence === 'number' ? s.confidence : null;
    const reason = typeof s.reason === 'string' ? s.reason : '';
    const suggestedTransition =
      typeof s.suggestedTransition === 'string' ? s.suggestedTransition : 'none';
    const priority = typeof s.priority === 'number' ? s.priority : 5;

    if (startTime === null || endTime === null || cutType === null || confidence === null) {
      continue; // 跳过不完整的建议
    }

    if (endTime <= startTime) continue;

    suggestions.push({
      id: generateId(),
      startTime,
      endTime,
      cutType,
      confidence: clamp(confidence, 0, 1),
      reason,
      sourceAnalysis: 'combined',
      suggestedTransition,
      priority: clamp(Math.round(priority), 1, 10),
    });
  }

  // 计算预估总时长
  const totalEstimatedDuration = suggestions.reduce(
    (sum, s) => sum + (s.endTime - s.startTime),
    0,
  );

  return {
    ...emptyResult,
    suggestions,
    totalEstimatedDuration,
    qualityScore: suggestions.length > 0 ? mean(suggestions.map((s) => s.confidence)) : 0,
  };
}

/**
 * 安全解析 AI 响应
 *
 * 包装 parseAssistEditingResponse，捕获异常并返回 AiModuleResult。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param t - 翻译函数，默认使用 identityTranslator
 * @returns 包含数据或错误信息的 AiModuleResult
 */
export async function parseAssistEditingResponseSafe(
  json: unknown,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<AssistEditingResult>> {
  const emptyResult: AssistEditingResult = {
    suggestions: [],
    analysisResult: {
      scenes: [],
      emotionCurve: [],
      rhythmProfile: { bpm: 120, beatTimes: [], energyCurve: [], tempoChanges: [] },
      speakerSegments: [],
      keyFrames: [],
    },
    rhythmProfile: { bpm: 120, beatTimes: [], energyCurve: [], tempoChanges: [] },
    totalEstimatedDuration: 0,
    qualityScore: 0,
    processingTimeMs: 0,
  };

  try {
    const data = parseAssistEditingResponse(json);
    return { data, error: null };
  } catch {
    return { data: emptyResult, error: t('aiModules.error.parseFailed') };
  }
}

// ==================== 辅助函数 ====================

/**
 * 检测场景转换点
 *
 * 通过计算相邻帧之间的像素差异来检测场景切换。
 * 使用 RGB 三通道的平均绝对差作为帧间距离度量。
 *
 * @param frames - 视频帧数据数组（Uint8Array，假设 RGBA 格式）
 * @param threshold - 转换阈值 (0-1)，默认 0.35
 * @returns 场景转换点对应的帧索引数组
 */
export function detectSceneTransitions(
  frames: Uint8Array[],
  threshold: number = 0.35,
): number[] {
  if (frames.length < 2) return [];

  const clampedThreshold = clamp(threshold, 0, 1);
  const transitions: number[] = [];
  const diffs: number[] = [];

  // 计算相邻帧的差异
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4; // RGBA
    if (pixelCount === 0) {
      diffs.push(0);
      continue;
    }

    let totalDiff = 0;
    // 采样计算：每 4 个像素采样一次以提高性能
    const sampleStep = Math.max(1, Math.floor(pixelCount / 1000));
    let sampleCount = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      // 只比较 RGB 通道，忽略 Alpha
      totalDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      sampleCount++;
    }

    // 归一化到 0-1（每个通道最大差值 255，3 个通道）
    const normalizedDiff = sampleCount > 0 ? totalDiff / (sampleCount * 255 * 3) : 0;
    diffs.push(normalizedDiff);
  }

  // 使用自适应阈值检测转换点
  const smoothedDiffs = smooth(diffs, 3);
  const meanDiff = mean(smoothedDiffs);
  const stdDiff = stddev(smoothedDiffs);
  const adaptiveThreshold = Math.max(clampedThreshold, meanDiff + stdDiff * 1.5);

  for (let i = 0; i < smoothedDiffs.length; i++) {
    if (smoothedDiffs[i] > adaptiveThreshold) {
      // 避免连续帧重复检测
      if (transitions.length === 0 || i - transitions[transitions.length - 1] > 2) {
        transitions.push(i + 1); // 转换发生在第 i+1 帧
      }
    }
  }

  return transitions;
}

/**
 * 检测音频起音点（onset detection）
 *
 * 基于短时能量变化率检测音频中的起音点。
 * 起音点通常对应声音的开始（如打击乐、语音起始等）。
 *
 * @param audioData - 音频采样数据（单声道浮点）
 * @param sampleRate - 音频采样率（Hz）
 * @returns 起音点时间数组（秒）
 */
export function computeAudioOnsets(
  audioData: Float32Array,
  sampleRate: number,
): number[] {
  if (audioData.length === 0 || sampleRate <= 0) return [];

  const frameSize = Math.floor(sampleRate * 0.02); // 20ms 帧
  const hopSize = Math.floor(frameSize / 2);        // 10ms 跳跃
  const energyEnvelope: number[] = [];

  // 计算短时能量包络
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const sample = audioData[i + j];
      energy += sample * sample;
    }
    energyEnvelope.push(energy / frameSize);
  }

  // 计算能量变化率（一阶差分）
  const diff: number[] = [];
  for (let i = 1; i < energyEnvelope.length; i++) {
    diff.push(Math.max(0, energyEnvelope[i] - energyEnvelope[i - 1]));
  }

  if (diff.length === 0) return [];

  // 平滑
  const smoothed = smooth(diff, 3);

  // 检测峰值
  const meanVal = mean(smoothed);
  const stdVal = stddev(smoothed);
  const onsetThreshold = meanVal + stdVal * 2;

  const peakIndices = findPeaks(smoothed, onsetThreshold);

  // 转换为时间
  return peakIndices.map((idx) => ((idx + 1) * hopSize) / sampleRate);
}

/**
 * 合并相近的剪辑点
 *
 * 当两个剪辑建议的时间间隔小于 minGap 时，保留优先级更高的那个。
 *
 * @param suggestions - 剪辑建议列表
 * @param minGap - 最小间隔（秒）
 * @returns 合并后的建议列表
 */
export function mergeNearbyCuts(
  suggestions: AssistEditingSuggestion[],
  minGap: number,
): AssistEditingSuggestion[] {
  if (suggestions.length === 0) return [];

  const clampedGap = Math.max(0, minGap);

  // 按开始时间排序
  const sorted = [...suggestions].sort((a, b) => a.startTime - b.startTime);
  const merged: AssistEditingSuggestion[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.startTime - last.startTime < clampedGap) {
      // 间隔过小，保留优先级更高的
      if (
        current.priority > last.priority ||
        (current.priority === last.priority && current.confidence > last.confidence)
      ) {
        merged[merged.length - 1] = current;
      }
      // 否则保持原有的
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// ==================== 内部辅助函数 ====================

/**
 * 根据场景转换时间点构建场景列表
 */
function buildScenesFromTransitions(
  transitionTimes: number[],
  totalDuration: number,
  frames: Uint8Array[],
  fps: number,
): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  const boundaries = [0, ...transitionTimes, totalDuration];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTime = boundaries[i];
    const endTime = boundaries[i + 1];
    if (endTime <= startTime) continue;

    // 计算该场景内的运动水平
    const startFrame = Math.floor(startTime * fps);
    const endFrame = Math.min(Math.floor(endTime * fps), frames.length - 1);
    const motionLevel = computeMotionLevel(frames, startFrame, endFrame);

    const prevType = scenes.length > 0 ? scenes[scenes.length - 1].sceneType : null;
    const sceneType = inferSceneType(startTime, endTime, totalDuration, prevType, motionLevel);

    scenes.push({
      startTime,
      endTime,
      sceneType,
      description: generateSceneDescription(sceneType, motionLevel, endTime - startTime),
      confidence: clamp(0.6 + motionLevel * 0.3, 0.5, 0.95),
    });
  }

  return scenes;
}

/**
 * 计算帧范围内的运动水平
 */
function computeMotionLevel(frames: Uint8Array[], startIdx: number, endIdx: number): number {
  if (endIdx <= startIdx || endIdx >= frames.length) return 0.5;

  let totalDiff = 0;
  let count = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
    let frameDiff = 0;
    let samples = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      frameDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      samples++;
    }

    if (samples > 0) {
      totalDiff += frameDiff / (samples * 255 * 3);
      count++;
    }
  }

  return count > 0 ? clamp(totalDiff / count * 10, 0, 1) : 0.5;
}

/**
 * 生成场景描述文本
 */
function generateSceneDescription(sceneType: SceneType, motionLevel: number, duration: number): string {
  const motionDesc =
    motionLevel > 0.7 ? '高动态' : motionLevel > 0.4 ? '中等动态' : '低动态';
  const durationDesc =
    duration < 2 ? '短' : duration < 10 ? '中' : '长';

  const typeNames: Record<SceneType, string> = {
    intro: '开场',
    action: '动作',
    dialogue: '对话',
    transition: '过渡',
    climax: '高潮',
    outro: '结尾',
    montage: '蒙太奇',
    'b-roll': 'B-Roll',
  };

  return `${typeNames[sceneType]}场景，${motionDesc}，${durationDesc}片段`;
}

/**
 * 计算情绪曲线（基于音频能量和过零率）
 */
function computeEmotionCurve(
  audioData: Float32Array,
  sampleRate: number,
  duration: number,
): number[] {
  const samplesPerSecond = 1; // 每秒一个采样点
  const totalSamples = Math.max(1, Math.ceil(duration * samplesPerSecond));
  const curve: number[] = new Array(totalSamples);
  const frameSize = Math.floor(sampleRate / samplesPerSecond);

  for (let i = 0; i < totalSamples; i++) {
    const start = i * frameSize;
    const end = Math.min(start + frameSize, audioData.length);

    if (start >= audioData.length) {
      curve[i] = 0.5;
      continue;
    }

    // 计算短时能量
    let energy = 0;
    let crossings = 0;
    const len = end - start;

    for (let j = start; j < end; j++) {
      energy += audioData[j] * audioData[j];
      if (j > start) {
        if (
          (audioData[j] >= 0 && audioData[j - 1] < 0) ||
          (audioData[j] < 0 && audioData[j - 1] >= 0)
        ) {
          crossings++;
        }
      }
    }

    const normalizedEnergy = len > 0 ? Math.sqrt(energy / len) : 0;
    const zcr = len > 1 ? crossings / (len - 1) : 0;

    // 组合能量和过零率作为情绪指标
    // 高能量 + 低过零率 = 激昂（值高）
    // 低能量 + 高过零率 = 平静/悲伤（值低）
    const emotion = clamp(normalizedEnergy * 3 - zcr * 0.5 + 0.3, 0, 1);
    curve[i] = emotion;
  }

  return smooth(curve, 3);
}

/**
 * 计算节奏配置
 */
function computeRhythmProfile(audioData: Float32Array, sampleRate: number): RhythmProfile {
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms
  const hopSize = Math.floor(frameSize / 2);
  const energyEnvelope: number[] = [];

  // 计算能量包络
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = audioData[i + j];
      energy += s * s;
    }
    energyEnvelope.push(energy / frameSize);
  }

  // 平滑能量包络
  const smoothed = smooth(energyEnvelope, 5);

  // 检测峰值作为节拍候选
  const meanEnergy = mean(smoothed);
  const peakIndices = findPeaks(smoothed, meanEnergy * 1.2);

  // 计算 BPM
  const beatTimes: number[] = [];
  const intervals: number[] = [];

  for (let i = 0; i < peakIndices.length; i++) {
    const time = (peakIndices[i] * hopSize) / sampleRate;
    beatTimes.push(time);
    if (i > 0) {
      intervals.push(time - beatTimes[beatTimes.length - 2]);
    }
  }

  const avgInterval = intervals.length > 0 ? mean(intervals) : 0.5;
  const bpm = avgInterval > 0 ? Math.round(clamp(60 / avgInterval, 40, 240)) : 120;

  // 生成能量曲线（每秒一个采样点）
  const duration = audioData.length / sampleRate;
  const curveLen = Math.max(1, Math.ceil(duration));
  const energyCurve: number[] = new Array(curveLen);
  for (let i = 0; i < curveLen; i++) {
    const envelopeIdx = Math.floor((i / duration) * smoothed.length);
    energyCurve[i] = clamp(
      smoothed[Math.min(envelopeIdx, smoothed.length - 1)] / (meanEnergy * 3 + 0.001),
      0,
      1,
    );
  }

  // 检测速度变化点
  const tempoChanges = detectTempoChanges(beatTimes, hopSize, sampleRate);

  return {
    bpm,
    beatTimes,
    energyCurve,
    tempoChanges,
  };
}

/**
 * 检测速度变化点
 */
function detectTempoChanges(
  beatTimes: number[],
  hopSize: number,
  sampleRate: number,
): Array<{ time: number; bpm: number }> {
  if (beatTimes.length < 8) return [];

  const changes: Array<{ time: number; bpm: number }> = [];
  const windowSize = 4;

  for (let i = windowSize; i < beatTimes.length - windowSize; i++) {
    // 计算前半窗口的平均间隔
    const prevIntervals: number[] = [];
    for (let j = i - windowSize; j < i; j++) {
      prevIntervals.push(beatTimes[j + 1] - beatTimes[j]);
    }
    const prevAvg = mean(prevIntervals);

    // 计算后半窗口的平均间隔
    const nextIntervals: number[] = [];
    for (let j = i; j < i + windowSize; j++) {
      nextIntervals.push(beatTimes[j + 1] - beatTimes[j]);
    }
    const nextAvg = mean(nextIntervals);

    // 如果间隔变化超过 20%，认为有速度变化
    if (prevAvg > 0 && Math.abs(nextAvg - prevAvg) / prevAvg > 0.2) {
      const newBpm = nextAvg > 0 ? Math.round(clamp(60 / nextAvg, 40, 240)) : 120;
      changes.push({ time: beatTimes[i], bpm: newBpm });
    }
  }

  return changes;
}

/**
 * 检测说话人片段（基于静音段分割）
 */
function detectSpeakerSegments(
  audioData: Float32Array,
  sampleRate: number,
): SpeakerSegment[] {
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms
  const hopSize = Math.floor(frameSize / 2);
  const silenceThreshold = 0.005;
  const minSpeechDuration = 0.3; // 最小语音段 300ms
  const minSilenceDuration = 0.2; // 最小静音段 200ms

  // 计算每帧能量
  const frameEnergies: number[] = [];
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = audioData[i + j];
      energy += s * s;
    }
    frameEnergies.push(energy / frameSize);
  }

  // 检测语音段和静音段
  const segments: SpeakerSegment[] = [];
  let inSpeech = false;
  let speechStart = 0;
  let silenceCount = 0;
  const silenceFramesNeeded = Math.ceil((minSilenceDuration * sampleRate) / hopSize);

  for (let i = 0; i < frameEnergies.length; i++) {
    const time = (i * hopSize) / sampleRate;

    if (frameEnergies[i] > silenceThreshold) {
      if (!inSpeech) {
        inSpeech = true;
        speechStart = time;
        silenceCount = 0;
      } else {
        silenceCount = 0;
      }
    } else {
      if (inSpeech) {
        silenceCount++;
        if (silenceCount >= silenceFramesNeeded) {
          const speechEnd = time - (silenceCount * hopSize) / sampleRate;
          const duration = speechEnd - speechStart;

          if (duration >= minSpeechDuration) {
            // 使用能量特征简单区分不同说话人
            const speakerId = estimateSpeakerId(
              audioData,
              sampleRate,
              speechStart,
              speechEnd,
            );

            segments.push({
              startTime: speechStart,
              endTime: speechEnd,
              speakerId,
              text: '',
              emotion: estimateSpeechEmotion(frameEnergies, i - silenceCount, i),
            });
          }

          inSpeech = false;
          silenceCount = 0;
        }
      }
    }
  }

  // 处理最后一个语音段
  if (inSpeech) {
    const speechEnd = audioData.length / sampleRate;
    const duration = speechEnd - speechStart;

    if (duration >= minSpeechDuration) {
      segments.push({
        startTime: speechStart,
        endTime: speechEnd,
        speakerId: 'speaker_0',
        text: '',
        emotion: 'neutral',
      });
    }
  }

  return segments;
}

/**
 * 简单估算说话人 ID（基于音高特征区分）
 */
function estimateSpeakerId(
  audioData: Float32Array,
  sampleRate: number,
  startTime: number,
  _endTime: number,
): string {
  const startSample = Math.floor(startTime * sampleRate);
  const analysisLength = Math.min(Math.floor(sampleRate * 0.5), audioData.length - startSample);

  if (analysisLength <= 0) return 'speaker_0';

  // 计算平均能量作为简单的说话人区分特征
  let energy = 0;
  for (let i = 0; i < analysisLength; i++) {
    const s = audioData[startSample + i];
    energy += s * s;
  }
  const avgEnergy = energy / analysisLength;

  // 基于能量水平粗略分类（高能量 -> speaker_0，低能量 -> speaker_1）
  return avgEnergy > 0.01 ? 'speaker_0' : 'speaker_1';
}

/**
 * 估算语音段情绪
 */
function estimateSpeechEmotion(
  frameEnergies: number[],
  startIdx: number,
  endIdx: number,
): string {
  const segmentEnergies = frameEnergies.slice(
    Math.max(0, startIdx),
    Math.min(frameEnergies.length, endIdx),
  );

  if (segmentEnergies.length === 0) return 'neutral';

  const avgEnergy = mean(segmentEnergies);
  const energyStd = stddev(segmentEnergies);

  if (avgEnergy > 0.05 && energyStd > 0.02) return 'excited';
  if (avgEnergy > 0.03) return 'happy';
  if (avgEnergy < 0.005) return 'sad';
  return 'neutral';
}

/**
 * 检测关键帧时间点
 */
function detectKeyFrameTimes(frames: Uint8Array[], fps: number): number[] {
  if (frames.length < 2) return [];

  const diffs: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
    let totalDiff = 0;
    let samples = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      totalDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      samples++;
    }

    diffs.push(samples > 0 ? totalDiff / (samples * 255 * 3) : 0);
  }

  // 检测差异峰值作为关键帧
  const smoothed = smooth(diffs, 3);
  const meanDiff = mean(smoothed);
  const stdDiff = stddev(smoothed);
  const threshold = meanDiff + stdDiff * 1.5;

  const peakIndices = findPeaks(smoothed, threshold);

  // 转换为时间
  return peakIndices.map((idx) => (idx + 1) / fps);
}

/**
 * 查找最近的节拍距离
 */
function findNearestBeatDistance(time: number, beatTimes: number[]): number {
  if (beatTimes.length === 0) return Infinity;

  let minDist = Infinity;
  for (let i = 0; i < beatTimes.length; i++) {
    const dist = Math.abs(beatTimes[i] - time);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

/**
 * 根据场景类型确定剪切类型
 */
function determineCutTypeForScene(sceneType: SceneType, config: AssistEditingConfig): string {
  const sceneCutMap: Record<SceneType, string> = {
    intro: 'fade-in',
    action: 'hard-cut',
    dialogue: 'soft-cut',
    transition: 'cross-dissolve',
    climax: 'hard-cut',
    outro: 'fade-out',
    montage: 'jump-cut',
    'b-roll': 'cutaway',
  };

  const preferred = sceneCutMap[sceneType] ?? 'hard-cut';

  // 如果偏好列表中包含该类型，直接使用
  if (config.preferredCutTypes.includes(preferred)) {
    return preferred;
  }

  // 否则返回偏好列表中的第一个
  return config.preferredCutTypes[0] ?? 'hard-cut';
}

/**
 * 根据场景类型确定过渡效果
 */
function determineTransitionForScene(sceneType: SceneType, preference: string): string {
  const sceneTransitionMap: Record<SceneType, string> = {
    intro: 'fade-in',
    action: 'none',
    dialogue: 'cross-dissolve',
    transition: 'cross-dissolve',
    climax: 'none',
    outro: 'fade-out',
    montage: 'wipe',
    'b-roll': 'cross-dissolve',
  };

  return sceneTransitionMap[sceneType] ?? preference;
}

/**
 * 计算场景建议的优先级
 */
function computeScenePriority(scene: SceneInfo): number {
  const typePriorities: Record<SceneType, number> = {
    climax: 9,
    intro: 7,
    outro: 7,
    action: 6,
    dialogue: 5,
    montage: 5,
    'b-roll': 4,
    transition: 3,
  };

  const basePriority = typePriorities[scene.sceneType] ?? 5;
  const confidenceBonus = scene.confidence > 0.8 ? 1 : 0;

  return clamp(basePriority + confidenceBonus, 1, 10);
}

/**
 * 生成基于节奏的剪辑建议
 */
function generateRhythmSuggestions(
  rhythmProfile: RhythmProfile,
  config: AssistEditingConfig,
): AssistEditingSuggestion[] {
  const suggestions: AssistEditingSuggestion[] = [];
  const beatTimes = rhythmProfile.beatTimes;

  // 使用强拍（每 4 拍）作为主要剪切点
  for (let i = 0; i < beatTimes.length; i++) {
    const isDownbeat = i % 4 === 0;
    if (!isDownbeat && beatTimes.length > 8) continue; // 优先使用强拍

    const time = beatTimes[i];

    suggestions.push({
      id: generateId(),
      startTime: time,
      endTime: time + config.minSegmentDuration,
      cutType: config.preferredCutTypes.includes('beat-cut') ? 'beat-cut' : 'hard-cut',
      confidence: isDownbeat ? 0.85 : 0.65,
      reason: isDownbeat ? '强拍节奏对齐' : '节拍节奏对齐',
      sourceAnalysis: 'rhythm',
      suggestedTransition: 'none',
      priority: isDownbeat ? 7 : 5,
    });
  }

  // 在速度变化点也添加剪切建议
  for (const tc of rhythmProfile.tempoChanges) {
    suggestions.push({
      id: generateId(),
      startTime: tc.time,
      endTime: tc.time + config.minSegmentDuration,
      cutType: 'hard-cut',
      confidence: 0.8,
      reason: `速度变化: ${tc.bpm} BPM`,
      sourceAnalysis: 'rhythm',
      suggestedTransition: 'cross-dissolve',
      priority: 7,
    });
  }

  return suggestions;
}

/**
 * 生成基于情绪的剪辑建议
 */
function generateEmotionSuggestions(
  emotionCurve: number[],
  config: AssistEditingConfig,
): AssistEditingSuggestion[] {
  const suggestions: AssistEditingSuggestion[] = [];
  if (emotionCurve.length < 3) return suggestions;

  // 检测情绪峰值和谷值
  const peaks = findPeaks(emotionCurve, 0.6);
  const valleys = findPeaks(emotionCurve.map((v) => 1 - v), 0.6);

  // 峰值处建议切换（情绪高涨，适合切入新画面）
  for (const idx of peaks) {
    suggestions.push({
      id: generateId(),
      startTime: idx,
      endTime: idx + config.minSegmentDuration,
      cutType: 'cutaway',
      confidence: clamp(emotionCurve[idx], 0.5, 0.95),
      reason: `情绪高点 (值: ${emotionCurve[idx].toFixed(2)})`,
      sourceAnalysis: 'emotion',
      suggestedTransition: config.transitionPreference,
      priority: 6,
    });
  }

  // 谷值处也建议切换（情绪低落，适合过渡）
  for (const idx of valleys) {
    suggestions.push({
      id: generateId(),
      startTime: idx,
      endTime: idx + config.minSegmentDuration,
      cutType: 'cross-dissolve',
      confidence: clamp(1 - emotionCurve[idx], 0.5, 0.9),
      reason: `情绪低点 (值: ${emotionCurve[idx].toFixed(2)})`,
      sourceAnalysis: 'emotion',
      suggestedTransition: 'cross-dissolve',
      priority: 5,
    });
  }

  return suggestions;
}

/**
 * 生成基于说话人的剪辑建议
 */
function generateSpeakerSuggestions(
  speakerSegments: SpeakerSegment[],
  config: AssistEditingConfig,
): AssistEditingSuggestion[] {
  const suggestions: AssistEditingSuggestion[] = [];

  for (let i = 0; i < speakerSegments.length; i++) {
    const seg = speakerSegments[i];
    const duration = seg.endTime - seg.startTime;

    // 说话人切换点是天然的剪切点
    if (i > 0) {
      const prevSeg = speakerSegments[i - 1];
      if (prevSeg.speakerId !== seg.speakerId) {
        suggestions.push({
          id: generateId(),
          startTime: seg.startTime,
          endTime: seg.startTime + Math.min(duration, config.maxSegmentDuration),
          cutType: 'soft-cut',
          confidence: 0.85,
          reason: `说话人切换: ${prevSeg.speakerId} -> ${seg.speakerId}`,
          sourceAnalysis: 'speaker',
          suggestedTransition: 'cross-dissolve',
          priority: 7,
        });
      }
    }

    // 情绪激动的说话段优先级更高
    if (seg.emotion === 'excited') {
      suggestions.push({
        id: generateId(),
        startTime: seg.startTime,
        endTime: seg.startTime + Math.min(duration, config.maxSegmentDuration),
        cutType: 'hard-cut',
        confidence: 0.75,
        reason: `情绪激动的说话段 (${seg.speakerId})`,
        sourceAnalysis: 'speaker',
        suggestedTransition: 'none',
        priority: 6,
      });
    }
  }

  return suggestions;
}

/**
 * 生成基于关键帧的剪辑建议
 */
function generateKeyFrameSuggestions(
  keyFrames: number[],
  config: AssistEditingConfig,
): AssistEditingSuggestion[] {
  const suggestions: AssistEditingSuggestion[] = [];

  for (const kfTime of keyFrames) {
    suggestions.push({
      id: generateId(),
      startTime: kfTime,
      endTime: kfTime + config.minSegmentDuration,
      cutType: 'match-cut',
      confidence: 0.7,
      reason: '视觉关键帧',
      sourceAnalysis: 'keyframe',
      suggestedTransition: config.transitionPreference,
      priority: 4,
    });
  }

  return suggestions;
}

/**
 * 汇总情绪曲线信息
 */
function summarizeCurve(curve: number[]): {
  trend: string;
  peaks: number[];
  valleys: number[];
} {
  if (curve.length === 0) {
    return { trend: '无数据', peaks: [], valleys: [] };
  }

  // 整体趋势
  const firstHalf = mean(curve.slice(0, Math.floor(curve.length / 2)));
  const secondHalf = mean(curve.slice(Math.floor(curve.length / 2)));
  const diff = secondHalf - firstHalf;

  let trend: string;
  if (diff > 0.1) trend = '上升';
  else if (diff < -0.1) trend = '下降';
  else trend = '平稳';

  // 峰值和谷值
  const peaks = findPeaks(curve, 0.6);
  const valleys = findPeaks(curve.map((v) => 1 - v), 0.6);

  return { trend, peaks, valleys };
}
