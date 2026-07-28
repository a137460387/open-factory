// Types and interfaces for quality assessment

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
