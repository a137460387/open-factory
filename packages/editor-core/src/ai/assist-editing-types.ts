/**
 * AI 辅助剪辑 - 类型定义
 *
 * 从 assist-editing.ts 拆分出的共享类型，
 * 供 assist-editing.ts 和 assist-editing-analysis.ts 共用，
 * 消除循环依赖。
 */

/**
 * 场景类型枚举
 */
export type SceneType =
  | 'intro' // 开场
  | 'action' // 动作
  | 'dialogue' // 对话
  | 'transition' // 过渡
  | 'climax' // 高潮
  | 'outro' // 结尾
  | 'montage' // 蒙太奇
  | 'b-roll'; // B-Roll 补充镜头

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
  | 'quick-cut' // 快速剪辑
  | 'rhythm-match' // 节奏匹配
  | 'emotion-driven' // 情绪驱动
  | 'content-aware' // 内容感知
  | 'custom'; // 自定义

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
