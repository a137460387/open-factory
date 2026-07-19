/**
 * 智能场景分析模块
 * 实现自动场景检测、内容标签生成、质量评估
 * 本地优先：所有分析在本地完成
 */

// ============================================================
// 类型定义
// ============================================================

/** 自动化场景类型 */
export type AutomationSceneType =
  | 'dialogue'      // 对话场景
  | 'action'        // 动作场景
  | 'landscape'     // 风景场景
  | 'close-up'      // 特写镜头
  | 'wide-shot'     // 广角镜头
  | 'montage'       // 蒙太奇
  | 'transition'    // 过渡场景
  | 'title'         // 标题/字幕场景
  | 'black'         // 黑场
  | 'unknown';      // 未知

/** 内容标签 */
export interface ContentTag {
  id: string;
  name: string;
  category: string;
  confidence: number; // 0-1
}

/** 场景质量指标 */
export interface SceneQualityMetrics {
  /** 综合质量分 0-100 */
  overall: number;
  /** 清晰度 0-100 */
  sharpness: number;
  /** 曝光 0-100 */
  exposure: number;
  /** 色彩饱和度 0-100 */
  colorSaturation: number;
  /** 稳定性 0-100 */
  stability: number;
  /** 音频质量 0-100 */
  audioQuality: number;
  /** 噪点水平 0-100 (越低越好) */
  noiseLevel: number;
}

/** 场景分析结果 */
export interface SceneAnalysis {
  id: string;
  /** 媒体文件路径 */
  mediaPath: string;
  /** 场景开始时间（秒） */
  startTime: number;
  /** 场景结束时间（秒） */
  endTime: number;
  /** 场景时长（秒） */
  duration: number;
  /** 场景类型 */
  sceneType: AutomationSceneType;
  /** 场景类型置信度 */
  sceneTypeConfidence: number;
  /** 内容标签 */
  tags: ContentTag[];
  /** 质量指标 */
  quality: SceneQualityMetrics;
  /** 关键帧时间点 */
  keyframes: number[];
  /** 场景描述（本地生成） */
  description?: string;
  /** 分析时间戳 */
  analyzedAt: number;
}

/** 批量分析报告 */
export interface AnalysisReport {
  id: string;
  /** 分析的媒体文件列表 */
  mediaPaths: string[];
  /** 各场景分析结果 */
  scenes: SceneAnalysis[];
  /** 总体统计 */
  stats: AnalysisStats;
  /** 生成时间 */
  generatedAt: number;
}

/** 分析统计 */
export interface AnalysisStats {
  /** 总场景数 */
  totalScenes: number;
  /** 各类型场景数量 */
  sceneTypeCounts: Record<AutomationSceneType, number>;
  /** 平均质量分 */
  averageQuality: number;
  /** 最低质量分 */
  minQuality: number;
  /** 最高质量分 */
  maxQuality: number;
  /** 低质量场景列表 */
  lowQualityScenes: string[];
  /** 总时长（秒） */
  totalDuration: number;
  /** 最常见标签 */
  topTags: Array<{ tag: string; count: number }>;
}

/** 场景检测配置 */
export interface SceneDetectionConfig {
  /** 场景切换阈值 0-1，越高越不敏感 */
  threshold: number;
  /** 最小场景时长（秒） */
  minSceneDuration: number;
  /** 是否检测黑场 */
  detectBlackFrames: boolean;
  /** 黑场亮度阈值 */
  blackFrameThreshold: number;
  /** 是否检测静态帧 */
  detectStaticFrames: boolean;
  /** 静态帧相似度阈值 */
  staticFrameThreshold: number;
}

/** 质量评估配置 */
export interface AutomationQualityAssessmentConfig {
  /** 是否评估清晰度 */
  assessSharpness: boolean;
  /** 是否评估曝光 */
  assessExposure: boolean;
  /** 是否评估色彩 */
  assessColor: boolean;
  /** 是否评估稳定性 */
  assessStability: boolean;
  /** 是否评估音频 */
  assessAudio: boolean;
  /** 低质量阈值 */
  lowQualityThreshold: number;
}

/** 分析器配置 */
export interface SceneAnalyzerConfig {
  sceneDetection: SceneDetectionConfig;
  qualityAssessment: AutomationQualityAssessmentConfig;
  /** 是否生成标签 */
  generateTags: boolean;
  /** 是否生成描述 */
  generateDescriptions: boolean;
  /** 最大并发分析数 */
  maxConcurrent: number;
}

// ============================================================
// 工厂函数
// ============================================================

let _analysisId = 1;
function genAnalysisId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_analysisId++}`;
}

/** 创建默认场景检测配置 */
export function createDefaultSceneDetectionConfig(): SceneDetectionConfig {
  return {
    threshold: 0.3,
    minSceneDuration: 0.5,
    detectBlackFrames: true,
    blackFrameThreshold: 10,
    detectStaticFrames: true,
    staticFrameThreshold: 0.95,
  };
}

/** 创建默认质量评估配置 */
export function createDefaultAutomationQualityAssessmentConfig(): AutomationQualityAssessmentConfig {
  return {
    assessSharpness: true,
    assessExposure: true,
    assessColor: true,
    assessStability: true,
    assessAudio: true,
    lowQualityThreshold: 60,
  };
}

/** 创建默认分析器配置 */
export function createDefaultAnalyzerConfig(): SceneAnalyzerConfig {
  return {
    sceneDetection: createDefaultSceneDetectionConfig(),
    qualityAssessment: createDefaultAutomationQualityAssessmentConfig(),
    generateTags: true,
    generateDescriptions: false,
    maxConcurrent: 2,
  };
}

/** 创建默认质量指标 */
export function createDefaultQualityMetrics(): SceneQualityMetrics {
  return {
    overall: 0,
    sharpness: 0,
    exposure: 0,
    colorSaturation: 0,
    stability: 0,
    audioQuality: 0,
    noiseLevel: 0,
  };
}

/** 创建空的分析结果 */
export function createEmptySceneAnalysis(mediaPath: string): SceneAnalysis {
  return {
    id: genAnalysisId('scene'),
    mediaPath,
    startTime: 0,
    endTime: 0,
    duration: 0,
    sceneType: 'unknown',
    sceneTypeConfidence: 0,
    tags: [],
    quality: createDefaultQualityMetrics(),
    keyframes: [],
    analyzedAt: Date.now(),
  };
}

// ============================================================
// 质量计算工具
// ============================================================

/** 计算综合质量分 */
export function calculateOverallQuality(metrics: Omit<SceneQualityMetrics, 'overall'>): number {
  const weights = {
    sharpness: 0.25,
    exposure: 0.2,
    colorSaturation: 0.15,
    stability: 0.2,
    audioQuality: 0.1,
    noiseLevel: 0.1,
  };

  // 噪点是反向指标，需要反转
  const noiseScore = 100 - metrics.noiseLevel;

  const weighted =
    metrics.sharpness * weights.sharpness +
    metrics.exposure * weights.exposure +
    metrics.colorSaturation * weights.colorSaturation +
    metrics.stability * weights.stability +
    metrics.audioQuality * weights.audioQuality +
    noiseScore * weights.noiseLevel;

  return Math.round(Math.max(0, Math.min(100, weighted)));
}

/** 判断是否为低质量场景 */
export function isLowQuality(quality: SceneQualityMetrics, threshold: number = 60): boolean {
  return quality.overall < threshold;
}

/** 生成质量等级 */
export function getQualityGrade(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'terrible' {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'terrible';
}

/** 质量等级中文名 */
export function getQualityGradeLabel(grade: ReturnType<typeof getQualityGrade>): string {
  const labels: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',
    terrible: '很差',
  };
  return labels[grade] || grade;
}

// ============================================================
// 标签生成
// ============================================================

/** 预定义标签类别 */
export const TAG_CATEGORIES = {
  mood: ['欢乐', '悲伤', '紧张', '平静', '激动', '浪漫', '严肃', '幽默'],
  content: ['人物', '动物', '自然', '建筑', '交通', '食物', '文字', '图标'],
  lighting: ['明亮', '暗淡', '逆光', '侧光', '自然光', '人工光', '暖色调', '冷色调'],
  motion: ['静态', '缓慢', '快速', '跟踪', '摇移', '变焦'],
} as const;

/** 根据场景类型生成默认标签 */
export function generateDefaultTags(sceneType: AutomationSceneType): ContentTag[] {
  const tagMap: Record<AutomationSceneType, Array<{ name: string; category: string }>> = {
    'dialogue': [{ name: '人物', category: 'content' }, { name: '对话', category: 'content' }],
    'action': [{ name: '动作', category: 'content' }, { name: '快速', category: 'motion' }],
    'landscape': [{ name: '自然', category: 'content' }, { name: '风景', category: 'content' }],
    'close-up': [{ name: '特写', category: 'content' }, { name: '人物', category: 'content' }],
    'wide-shot': [{ name: '广角', category: 'content' }, { name: '全景', category: 'content' }],
    'montage': [{ name: '蒙太奇', category: 'content' }, { name: '快速', category: 'motion' }],
    'transition': [{ name: '过渡', category: 'content' }],
    'title': [{ name: '文字', category: 'content' }, { name: '标题', category: 'content' }],
    'black': [{ name: '黑场', category: 'lighting' }, { name: '暗淡', category: 'lighting' }],
    'unknown': [],
  };

  return (tagMap[sceneType] || []).map((t, i) => ({
    id: `tag_${i}`,
    name: t.name,
    category: t.category,
    confidence: 0.7,
  }));
}

// ============================================================
// 分析报告生成
// ============================================================

/** 从场景分析结果生成统计 */
export function generateAnalysisStats(scenes: SceneAnalysis[]): AnalysisStats {
  if (scenes.length === 0) {
    return {
      totalScenes: 0,
      sceneTypeCounts: {} as Record<AutomationSceneType, number>,
      averageQuality: 0,
      minQuality: 0,
      maxQuality: 0,
      lowQualityScenes: [],
      totalDuration: 0,
      topTags: [],
    };
  }

  // 统计场景类型
  const sceneTypeCounts: Record<string, number> = {};
  for (const scene of scenes) {
    sceneTypeCounts[scene.sceneType] = (sceneTypeCounts[scene.sceneType] || 0) + 1;
  }

  // 质量统计
  const qualities = scenes.map((s) => s.quality.overall);
  const averageQuality = Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length);
  const minQuality = Math.min(...qualities);
  const maxQuality = Math.max(...qualities);

  // 低质量场景
  const lowQualityScenes = scenes
    .filter((s) => isLowQuality(s.quality))
    .map((s) => s.id);

  // 总时长
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  // 标签统计
  const tagCounts: Record<string, number> = {};
  for (const scene of scenes) {
    for (const tag of scene.tags) {
      tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalScenes: scenes.length,
    sceneTypeCounts: sceneTypeCounts as Record<AutomationSceneType, number>,
    averageQuality,
    minQuality,
    maxQuality,
    lowQualityScenes,
    totalDuration,
    topTags,
  };
}

/** 生成分析报告 */
export function generateAnalysisReport(
  mediaPaths: string[],
  scenes: SceneAnalysis[],
): AnalysisReport {
  return {
    id: genAnalysisId('report'),
    mediaPaths,
    scenes,
    stats: generateAnalysisStats(scenes),
    generatedAt: Date.now(),
  };
}

// ============================================================
// 场景分析器类
// ============================================================

/** 分析进度回调 */
export type AnalysisProgressCallback = (progress: {
  current: number;
  total: number;
  currentFile: string;
  phase: 'detecting' | 'analyzing' | 'tagging' | 'complete';
}) => void;

/**
 * 智能场景分析器
 * 提供场景检测、质量评估、标签生成等功能
 */
export class SceneAnalyzer {
  private config: SceneAnalyzerConfig;
  private analysisHistory: Map<string, SceneAnalysis[]> = new Map();

  constructor(config: Partial<SceneAnalyzerConfig> = {}) {
    this.config = { ...createDefaultAnalyzerConfig(), ...config };
  }

  /** 更新配置 */
  updateConfig(config: Partial<SceneAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取配置 */
  getConfig(): SceneAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * 分析单个场景
   * 注意：实际的帧分析需要通过 Worker 或外部工具完成
   * 这里提供分析流程编排和结果处理
   */
  async analyzeScene(
    mediaPath: string,
    startTime: number,
    endTime: number,
    frameData?: {
      brightness?: number[];
      motionVectors?: number[];
      audioLevels?: number[];
    },
  ): Promise<SceneAnalysis> {
    const duration = endTime - startTime;
    const analysis = createEmptySceneAnalysis(mediaPath);
    analysis.startTime = startTime;
    analysis.endTime = endTime;
    analysis.duration = duration;

    // 检测场景类型
    analysis.sceneType = this.detectAutomationSceneType(frameData);
    analysis.sceneTypeConfidence = 0.75;

    // 评估质量
    if (frameData) {
      analysis.quality = this.assessQuality(frameData);
    }

    // 生成标签
    if (this.config.generateTags) {
      analysis.tags = generateDefaultTags(analysis.sceneType);
    }

    // 检测关键帧
    analysis.keyframes = this.detectKeyframes(startTime, endTime, frameData);

    analysis.analyzedAt = Date.now();

    // 存储历史
    const history = this.analysisHistory.get(mediaPath) || [];
    history.push(analysis);
    this.analysisHistory.set(mediaPath, history);

    return analysis;
  }

  /**
   * 批量分析媒体文件
   */
  async analyzeBatch(
    mediaItems: Array<{
      path: string;
      duration: number;
      frameData?: {
        brightness?: number[];
        motionVectors?: number[];
        audioLevels?: number[];
      };
    }>,
    onProgress?: AnalysisProgressCallback,
  ): Promise<AnalysisReport> {
    const allScenes: SceneAnalysis[] = [];

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];

      onProgress?.({
        current: i + 1,
        total: mediaItems.length,
        currentFile: item.path,
        phase: 'detecting',
      });

      // 场景检测：将媒体分割为场景
      const sceneBounds = this.detectSceneBoundaries(item.duration, item.frameData);

      onProgress?.({
        current: i + 1,
        total: mediaItems.length,
        currentFile: item.path,
        phase: 'analyzing',
      });

      // 分析每个场景
      for (const bounds of sceneBounds) {
        const scene = await this.analyzeScene(
          item.path,
          bounds.start,
          bounds.end,
          item.frameData,
        );
        allScenes.push(scene);
      }

      onProgress?.({
        current: i + 1,
        total: mediaItems.length,
        currentFile: item.path,
        phase: 'tagging',
      });
    }

    onProgress?.({
      current: mediaItems.length,
      total: mediaItems.length,
      currentFile: '',
      phase: 'complete',
    });

    return generateAnalysisReport(
      mediaItems.map((i) => i.path),
      allScenes,
    );
  }

  /** 获取媒体的分析历史 */
  getAnalysisHistory(mediaPath: string): SceneAnalysis[] {
    return this.analysisHistory.get(mediaPath) || [];
  }

  /** 清除分析历史 */
  clearHistory(mediaPath?: string): void {
    if (mediaPath) {
      this.analysisHistory.delete(mediaPath);
    } else {
      this.analysisHistory.clear();
    }
  }

  // ------ 内部方法 ------

  /** 检测场景类型 */
  private detectAutomationSceneType(
    frameData?: { brightness?: number[]; motionVectors?: number[] },
  ): AutomationSceneType {
    if (!frameData) return 'unknown';

    const { brightness, motionVectors } = frameData;

    // 黑场检测
    if (brightness && brightness.length > 0) {
      const avgBrightness = brightness.reduce((a, b) => a + b, 0) / brightness.length;
      if (avgBrightness < this.config.sceneDetection.blackFrameThreshold) {
        return 'black';
      }
    }

    // 运动检测
    if (motionVectors && motionVectors.length > 0) {
      const avgMotion = motionVectors.reduce((a, b) => a + b, 0) / motionVectors.length;
      if (avgMotion < 0.1) return 'wide-shot';
      if (avgMotion > 0.7) return 'action';
    }

    // 亮度变化检测（可能是蒙太奇或过渡）
    if (brightness && brightness.length > 2) {
      const variance = this.calculateVariance(brightness);
      if (variance > 500) return 'montage';
    }

    return 'unknown';
  }

  /** 评估质量 */
  private assessQuality(
    frameData: {
      brightness?: number[];
      motionVectors?: number[];
      audioLevels?: number[];
    },
  ): SceneQualityMetrics {
    const { brightness, motionVectors, audioLevels } = frameData;
    const config = this.config.qualityAssessment;

    let sharpness = 75;
    let exposure = 75;
    let colorSaturation = 75;
    let stability = 75;
    let audioQuality = 75;
    let noiseLevel = 20;

    // 基于亮度评估曝光
    if (config.assessExposure && brightness && brightness.length > 0) {
      const avg = brightness.reduce((a, b) => a + b, 0) / brightness.length;
      // 理想亮度在 100-150 之间
      const deviation = Math.abs(avg - 125);
      exposure = Math.max(0, 100 - deviation * 0.8);
    }

    // 基于运动向量评估稳定性和清晰度
    if (motionVectors && motionVectors.length > 0) {
      const avgMotion = motionVectors.reduce((a, b) => a + b, 0) / motionVectors.length;
      if (config.assessStability) {
        stability = Math.max(0, 100 - avgMotion * 100);
      }
      // 运动越大，清晰度可能越低
      if (config.assessSharpness) {
        sharpness = Math.max(0, 100 - avgMotion * 50);
      }
    }

    // 基于音频电平评估音频质量
    if (config.assessAudio && audioLevels && audioLevels.length > 0) {
      const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
      // 理想音频电平在 -20 到 -6 dB 之间
      if (avgLevel < -40) audioQuality = 40; // 太安静
      else if (avgLevel > 0) audioQuality = 30; // 削波
      else audioQuality = 85;
    }

    // 基于亮度方差估算噪点
    if (brightness && brightness.length > 1) {
      const variance = this.calculateVariance(brightness);
      noiseLevel = Math.min(100, Math.max(0, variance / 10));
    }

    const overall = calculateOverallQuality({
      sharpness,
      exposure,
      colorSaturation,
      stability,
      audioQuality,
      noiseLevel,
    });

    return { overall, sharpness, exposure, colorSaturation, stability, audioQuality, noiseLevel };
  }

  /** 检测场景边界 */
  private detectSceneBoundaries(
    totalDuration: number,
    frameData?: { brightness?: number[] },
  ): Array<{ start: number; end: number }> {
    const { threshold, minSceneDuration } = this.config.sceneDetection;
    const boundaries: Array<{ start: number; end: number }> = [];

    if (!frameData?.brightness || frameData.brightness.length === 0) {
      // 无帧数据时，按固定间隔分割
      const segmentDuration = Math.max(minSceneDuration, 10);
      let start = 0;
      while (start < totalDuration) {
        const end = Math.min(start + segmentDuration, totalDuration);
        boundaries.push({ start, end });
        start = end;
      }
      return boundaries;
    }

    const { brightness } = frameData;
    const timePerFrame = totalDuration / brightness.length;

    let sceneStart = 0;
    for (let i = 1; i < brightness.length; i++) {
      const diff = Math.abs(brightness[i] - brightness[i - 1]);
      const normalizedDiff = diff / 255;

      if (normalizedDiff > threshold) {
        const sceneEnd = i * timePerFrame;
        if (sceneEnd - sceneStart >= minSceneDuration) {
          boundaries.push({ start: sceneStart, end: sceneEnd });
          sceneStart = sceneEnd;
        }
      }
    }

    // 最后一个场景
    if (totalDuration - sceneStart >= minSceneDuration * 0.5) {
      boundaries.push({ start: sceneStart, end: totalDuration });
    }

    // 确保至少有一个场景
    if (boundaries.length === 0) {
      boundaries.push({ start: 0, end: totalDuration });
    }

    return boundaries;
  }

  /** 检测关键帧 */
  private detectKeyframes(
    startTime: number,
    endTime: number,
    frameData?: { brightness?: number[]; motionVectors?: number[] },
  ): number[] {
    const duration = endTime - startTime;
    const keyframes: number[] = [startTime]; // 首帧总是关键帧

    if (!frameData?.brightness) {
      // 无帧数据时，均匀分布关键帧
      const interval = Math.max(duration / 4, 1);
      for (let t = startTime + interval; t < endTime; t += interval) {
        keyframes.push(t);
      }
    } else {
      const { brightness } = frameData;
      const timePerFrame = duration / brightness.length;

      // 检测亮度突变点作为关键帧
      for (let i = 1; i < brightness.length - 1; i++) {
        const prevDiff = Math.abs(brightness[i] - brightness[i - 1]);
        const nextDiff = Math.abs(brightness[i + 1] - brightness[i]);

        if (prevDiff > 30 && nextDiff < prevDiff) {
          keyframes.push(startTime + i * timePerFrame);
        }
      }
    }

    // 末帧
    if (keyframes[keyframes.length - 1] !== endTime) {
      keyframes.push(endTime);
    }

    return keyframes;
  }

  /** 计算方差 */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }
}
