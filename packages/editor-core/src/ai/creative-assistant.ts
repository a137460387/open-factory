/**
 * AI 创意辅助系统
 *
 * 功能：
 * 1. 创意构思 - 基于关键词生成创意概念、标题、描述
 * 2. 脚本生成 - 根据主题和风格生成视频脚本
 * 3. 视频结构优化 - 叙事节奏分析、情绪曲线建议
 * 4. 智能配乐推荐 - 基于内容匹配音乐风格和节奏
 *
 * 所有函数均为纯计算，无副作用。
 */

import type { AiModuleResult, TranslateFn } from '../ai-module-types';
import { identityTranslator } from '../ai-module-types';

// ==================== 类型定义 ====================

/** 创意主题类别 */
export type CreativeTheme =
  | 'storytelling'
  | 'tutorial'
  | 'review'
  | 'vlog'
  | 'documentary'
  | 'advertisement'
  | 'music-video'
  | 'short-form'
  | 'presentation'
  | 'interview';

/** 情绪类型 */
export type EmotionType =
  | 'happy'
  | 'sad'
  | 'excited'
  | 'calm'
  | 'tense'
  | 'mysterious'
  | 'romantic'
  | 'humorous'
  | 'inspirational'
  | 'dramatic';

/** 叙事节奏 */
export type NarrativePacing = 'slow' | 'medium' | 'fast' | 'dynamic';

/** 脚本段落类型 */
export type ScriptSegmentType =
  | 'hook'
  | 'intro'
  | 'body'
  | 'climax'
  | 'transition'
  | 'call-to-action'
  | 'outro'
  | 'summary';

/** 创意构思结果 */
export interface CreativeConcept {
  /** 概念 ID */
  id: string;
  /** 标题建议 */
  title: string;
  /** 描述建议 */
  description: string;
  /** 标签建议 */
  tags: string[];
  /** 创意角度 */
  angle: string;
  /** 预期情绪曲线 */
  emotionCurve: EmotionType[];
  /** 适用平台 */
  platforms: string[];
  /** 创意评分 (0-100) */
  creativityScore: number;
}

/** 脚本段落 */
export interface ScriptSegment {
  /** 段落类型 */
  type: ScriptSegmentType;
  /** 段落内容 */
  content: string;
  /** 预估时长（秒） */
  estimatedDuration: number;
  /** 情绪 */
  emotion: EmotionType;
  /** 画面建议 */
  visualSuggestion: string;
  /** 配乐建议 */
  musicSuggestion: string;
}

/** 视频脚本 */
export interface VideoScript {
  /** 脚本 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 总时长（秒） */
  totalDuration: number;
  /** 段落列表 */
  segments: ScriptSegment[];
  /** 概述 */
  summary: string;
  /** 目标受众 */
  targetAudience: string;
  /** 创作风格 */
  style: CreativeTheme;
}

/** 情绪曲线点 */
export interface EmotionCurvePoint {
  /** 时间点（秒） */
  time: number;
  /** 情绪类型 */
  emotion: EmotionType;
  /** 情绪强度 (0-1) */
  intensity: number;
  /** 叙事节奏 */
  pacing: NarrativePacing;
}

/** 结构优化建议 */
export interface StructureOptimization {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: 'pacing' | 'emotion' | 'length' | 'hook' | 'climax' | 'transition';
  /** 建议描述 */
  description: string;
  /** 优先级 (1-5) */
  priority: number;
  /** 涉及的时间范围 */
  timeRange?: [number, number];
  /** 预期效果 */
  expectedEffect: string;
}

/** 配乐推荐 */
export interface MusicRecommendation {
  /** 推荐 ID */
  id: string;
  /** 音乐风格 */
  genre: string;
  /** 情绪标签 */
  mood: EmotionType[];
  /** 推荐 BPM 范围 */
  bpmRange: [number, number];
  /** 推荐理由 */
  reason: string;
  /** 适用段落 */
  applicableSegments: ScriptSegmentType[];
  /** 匹配度 (0-1) */
  matchScore: number;
  /** 乐器建议 */
  instruments: string[];
}

/** 创意辅助配置 */
export interface CreativeAssistantConfig {
  /** 目标主题 */
  theme: CreativeTheme;
  /** 目标时长（秒） */
  targetDuration: number;
  /** 目标平台 */
  targetPlatforms: string[];
  /** 目标语言 */
  language: string;
  /** 创作风格强度 (0-1) */
  creativityLevel: number;
  /** 是否包含配乐推荐 */
  includeMusicRecommendations: boolean;
  /** 最大概念数 */
  maxConcepts: number;
  /** 最大配乐推荐数 */
  maxMusicRecommendations: number;
}

/** 创意辅助完整结果 */
export interface CreativeAssistanceResult {
  /** 创意概念列表 */
  concepts: CreativeConcept[];
  /** 生成的脚本 */
  script: VideoScript | null;
  /** 情绪曲线 */
  emotionCurve: EmotionCurvePoint[];
  /** 结构优化建议 */
  optimizations: StructureOptimization[];
  /** 配乐推荐 */
  musicRecommendations: MusicRecommendation[];
  /** 生成耗时（毫秒） */
  generationTimeMs: number;
}

// ==================== 常量 ====================

/** 主题对应的默认情绪序列 */
const THEME_EMOTION_SEQUENCES: Record<CreativeTheme, EmotionType[]> = {
  storytelling: ['calm', 'tense', 'excited', 'dramatic', 'happy'],
  tutorial: ['calm', 'calm', 'excited', 'calm', 'happy'],
  review: ['excited', 'calm', 'tense', 'excited', 'happy'],
  vlog: ['happy', 'excited', 'calm', 'happy', 'happy'],
  documentary: ['calm', 'mysterious', 'tense', 'inspirational', 'calm'],
  advertisement: ['excited', 'happy', 'excited', 'inspirational', 'happy'],
  'music-video': ['excited', 'dramatic', 'excited', 'dramatic', 'excited'],
  'short-form': ['excited', 'happy', 'excited'],
  presentation: ['calm', 'excited', 'calm', 'inspirational', 'calm'],
  interview: ['calm', 'calm', 'excited', 'calm', 'calm'],
};

/** 主题对应的默认叙事节奏 */
const THEME_PACING: Record<CreativeTheme, NarrativePacing> = {
  storytelling: 'dynamic',
  tutorial: 'slow',
  review: 'medium',
  vlog: 'medium',
  documentary: 'slow',
  advertisement: 'fast',
  'music-video': 'fast',
  'short-form': 'fast',
  presentation: 'medium',
  interview: 'slow',
};

/** 主题对应的脚本段落模板 */
const THEME_SCRIPT_TEMPLATES: Record<CreativeTheme, ScriptSegmentType[]> = {
  storytelling: ['hook', 'intro', 'body', 'climax', 'body', 'outro'],
  tutorial: ['hook', 'intro', 'body', 'body', 'summary', 'call-to-action'],
  review: ['hook', 'intro', 'body', 'body', 'body', 'summary', 'call-to-action'],
  vlog: ['hook', 'intro', 'body', 'body', 'outro'],
  documentary: ['hook', 'intro', 'body', 'body', 'body', 'climax', 'outro'],
  advertisement: ['hook', 'body', 'call-to-action'],
  'music-video': ['intro', 'body', 'climax', 'body', 'outro'],
  'short-form': ['hook', 'body', 'call-to-action'],
  presentation: ['hook', 'intro', 'body', 'body', 'summary', 'call-to-action'],
  interview: ['hook', 'intro', 'body', 'body', 'summary', 'outro'],
};

/** 情绪对应的 BPM 范围 */
const EMOTION_BPM_RANGE: Record<EmotionType, [number, number]> = {
  happy: [110, 140],
  sad: [60, 80],
  excited: [130, 160],
  calm: [60, 90],
  tense: [100, 130],
  mysterious: [70, 100],
  romantic: [70, 100],
  humorous: [100, 130],
  inspirational: [90, 120],
  dramatic: [80, 110],
};

/** 情绪对应的乐器建议 */
const EMOTION_INSTRUMENTS: Record<EmotionType, string[]> = {
  happy: ['ukulele', 'acoustic-guitar', 'piano', 'handclaps', 'whistle'],
  sad: ['piano', 'strings', 'cello', 'acoustic-guitar', 'rain-sounds'],
  excited: ['drums', 'electric-guitar', 'synth', 'bass', 'brass'],
  calm: ['piano', 'pad', 'acoustic-guitar', 'flute', 'nature-sounds'],
  tense: ['strings-tremolo', 'timpani', 'low-brass', 'synth-bass', 'percussion'],
  mysterious: ['pad', 'bells', 'harp', 'choir', 'reverb-fx'],
  romantic: ['piano', 'violin', 'strings', 'acoustic-guitar', 'saxophone'],
  humorous: ['xylophone', 'ukulele', 'tuba', 'slide-whistle', 'kazoo'],
  inspirational: ['piano', 'strings', 'drums', 'choir', 'brass'],
  dramatic: ['strings', 'brass', 'timpani', 'choir', 'piano'],
};

/** 段落类型对应的默认时长比例 */
const SEGMENT_DURATION_RATIO: Record<ScriptSegmentType, number> = {
  hook: 0.05,
  intro: 0.1,
  body: 0.25,
  climax: 0.15,
  transition: 0.05,
  'call-to-action': 0.1,
  outro: 0.08,
  summary: 0.1,
};

/** 平台对应的推荐时长（秒） */
const PLATFORM_RECOMMENDED_DURATION: Record<string, [number, number]> = {
  tiktok: [15, 60],
  youtube: [300, 900],
  instagram: [15, 60],
  weibo: [15, 300],
  bilibili: [180, 1200],
  douyin: [15, 60],
  default: [60, 600],
};

// ==================== 工具函数 ====================

/** 将数值限制在指定范围 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 生成唯一 ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** 简单哈希函数 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

// ==================== 核心函数 ====================

/**
 * 创建默认创意辅助配置
 *
 * @param theme - 创意主题
 * @returns 默认配置
 */
export function createDefaultCreativeAssistantConfig(theme: CreativeTheme): CreativeAssistantConfig {
  return {
    theme,
    targetDuration: 180,
    targetPlatforms: ['default'],
    language: 'zh-CN',
    creativityLevel: 0.7,
    includeMusicRecommendations: true,
    maxConcepts: 5,
    maxMusicRecommendations: 5,
  };
}

/**
 * 生成创意概念
 *
 * 基于关键词和主题生成多个创意概念。
 *
 * @param keywords - 关键词列表
 * @param config - 创意辅助配置
 * @returns 创意概念列表
 */
export function generateCreativeConcepts(
  keywords: string[],
  config: CreativeAssistantConfig,
): CreativeConcept[] {
  if (keywords.length === 0) return [];

  const maxCount = clamp(config.maxConcepts, 1, 10);
  const concepts: CreativeConcept[] = [];
  const themeEmotions = THEME_EMOTION_SEQUENCES[config.theme];

  // 基于关键词生成多个创意角度
  const angles = generateCreativeAngles(keywords, config.theme, config.creativityLevel);

  for (let i = 0; i < Math.min(maxCount, angles.length); i++) {
    const angle = angles[i];
    const primaryKeyword = keywords[0];

    // 生成标题
    const title = generateTitle(primaryKeyword, angle, config.theme);

    // 生成描述
    const description = generateDescription(keywords, angle, config.theme, config.targetDuration);

    // 生成标签
    const tags = [...keywords, ...generateTags(config.theme, angle)];

    // 选择适用平台
    const platforms = selectPlatforms(config.targetPlatforms, config.targetDuration);

    // 计算创意评分
    const creativityScore = computeCreativityScore(angle, config.creativityLevel, i);

    concepts.push({
      id: generateId('concept'),
      title,
      description,
      tags: [...new Set(tags)],
      angle,
      emotionCurve: [...themeEmotions],
      platforms,
      creativityScore,
    });
  }

  return concepts.sort((a, b) => b.creativityScore - a.creativityScore);
}

/**
 * 生成视频脚本
 *
 * 基于创意概念和配置生成完整的视频脚本。
 *
 * @param concept - 创意概念（可选，若无则基于关键词生成）
 * @param keywords - 关键词列表
 * @param config - 创意辅助配置
 * @returns 视频脚本
 */
export function generateVideoScript(
  concept: CreativeConcept | null,
  keywords: string[],
  config: CreativeAssistantConfig,
): VideoScript {
  const theme = config.theme;
  const segmentTypes = THEME_SCRIPT_TEMPLATES[theme];
  const primaryKeyword = keywords[0] ?? '内容';
  const targetDuration = config.targetDuration;

  // 分配各段落时长
  const segments: ScriptSegment[] = [];
  const totalRatio = segmentTypes.reduce((sum, type) => sum + (SEGMENT_DURATION_RATIO[type] ?? 0.1), 0);
  let currentTime = 0;

  for (const segmentType of segmentTypes) {
    const ratio = (SEGMENT_DURATION_RATIO[segmentType] ?? 0.1) / totalRatio;
    const duration = Math.round(targetDuration * ratio);
    const emotion = selectSegmentEmotion(segmentType, theme, segments.length, segmentTypes.length);

    segments.push({
      type: segmentType,
      content: generateSegmentContent(segmentType, primaryKeyword, keywords, concept, theme),
      estimatedDuration: duration,
      emotion,
      visualSuggestion: generateVisualSuggestion(segmentType, emotion, theme),
      musicSuggestion: generateMusicSuggestion(segmentType, emotion, theme),
    });

    currentTime += duration;
  }

  const title = concept?.title ?? `${primaryKeyword} - ${getThemeLabel(theme)}`;
  const summary = concept?.description ?? `关于${keywords.join('、')}的${getThemeLabel(theme)}视频`;

  return {
    id: generateId('script'),
    title,
    totalDuration: currentTime,
    segments,
    summary,
    targetAudience: inferTargetAudience(theme, keywords),
    style: theme,
  };
}

/**
 * 生成情绪曲线
 *
 * 基于脚本和主题生成完整的情绪曲线。
 *
 * @param script - 视频脚本
 * @param config - 创意辅助配置
 * @returns 情绪曲线点列表
 */
export function generateEmotionCurve(
  script: VideoScript,
  config: CreativeAssistantConfig,
): EmotionCurvePoint[] {
  const points: EmotionCurvePoint[] = [];
  const pacing = THEME_PACING[config.theme];
  let currentTime = 0;

  for (const segment of script.segments) {
    const segmentPoints = Math.max(2, Math.round(segment.estimatedDuration / 5));

    for (let i = 0; i < segmentPoints; i++) {
      const t = i / (segmentPoints - 1);
      const time = currentTime + t * segment.estimatedDuration;
      const intensity = computeEmotionIntensity(segment.emotion, t, segment.type);

      points.push({
        time: Math.round(time * 10) / 10,
        emotion: segment.emotion,
        intensity: Math.round(intensity * 100) / 100,
        pacing: adjustPacing(pacing, t, segment.type),
      });
    }

    currentTime += segment.estimatedDuration;
  }

  return points;
}

/**
 * 生成结构优化建议
 *
 * 分析脚本结构，生成优化建议。
 *
 * @param script - 视频脚本
 * @param emotionCurve - 情绪曲线
 * @param config - 创意辅助配置
 * @returns 优化建议列表
 */
export function generateStructureOptimizations(
  script: VideoScript,
  emotionCurve: EmotionCurvePoint[],
  config: CreativeAssistantConfig,
): StructureOptimization[] {
  const optimizations: StructureOptimization[] = [];

  // 检查 hook 质量
  const hookSegment = script.segments.find((s) => s.type === 'hook');
  if (!hookSegment || hookSegment.estimatedDuration < 3) {
    optimizations.push({
      id: generateId('opt'),
      type: 'hook',
      description: '开头 Hook 不够强或时长过短，建议增加悬念或冲突元素',
      priority: 5,
      timeRange: hookSegment ? [0, hookSegment.estimatedDuration] : undefined,
      expectedEffect: '提高前 3 秒留存率',
    });
  }

  // 检查节奏变化
  const pacingChanges = countPacingChanges(emotionCurve);
  if (pacingChanges < 2) {
    optimizations.push({
      id: generateId('opt'),
      type: 'pacing',
      description: '叙事节奏变化不足，建议增加快慢交替以保持观众注意力',
      priority: 4,
      expectedEffect: '降低观众疲劳感',
    });
  }

  // 检查情绪多样性
  const uniqueEmotions = new Set(emotionCurve.map((p) => p.emotion));
  if (uniqueEmotions.size < 3) {
    optimizations.push({
      id: generateId('opt'),
      type: 'emotion',
      description: '情绪变化较为单一，建议丰富情绪层次',
      priority: 3,
      expectedEffect: '增强情感共鸣',
    });
  }

  // 检查高潮位置
  const climaxSegment = script.segments.find((s) => s.type === 'climax');
  if (climaxSegment) {
    const climaxIndex = script.segments.indexOf(climaxSegment);
    const totalSegments = script.segments.length;
    const climaxPosition = climaxIndex / totalSegments;

    if (climaxPosition < 0.3 || climaxPosition > 0.8) {
      optimizations.push({
        id: generateId('opt'),
        type: 'climax',
        description: '高潮点位置不够理想，建议放在视频中后段（约 60-70% 位置）',
        priority: 4,
        expectedEffect: '最大化情绪冲击力',
      });
    }
  }

  // 检查总时长适配
  const platformKey = config.targetPlatforms[0] ?? 'default';
  const recommendedDuration = PLATFORM_RECOMMENDED_DURATION[platformKey] ?? PLATFORM_RECOMMENDED_DURATION.default;
  if (script.totalDuration < recommendedDuration[0]) {
    optimizations.push({
      id: generateId('opt'),
      type: 'length',
      description: `视频时长偏短，${platformKey} 平台推荐 ${recommendedDuration[0]}-${recommendedDuration[1]} 秒`,
      priority: 2,
      expectedEffect: '提升平台推荐权重',
    });
  } else if (script.totalDuration > recommendedDuration[1]) {
    optimizations.push({
      id: generateId('opt'),
      type: 'length',
      description: `视频时长偏长，${platformKey} 平台推荐 ${recommendedDuration[0]}-${recommendedDuration[1]} 秒`,
      priority: 2,
      expectedEffect: '降低观众流失率',
    });
  }

  // 检查过渡自然度
  for (let i = 1; i < script.segments.length; i++) {
    const prev = script.segments[i - 1];
    const curr = script.segments[i];
    const emotionJump = Math.abs(getEmotionValence(prev.emotion) - getEmotionValence(curr.emotion));

    if (emotionJump > 1.5) {
      optimizations.push({
        id: generateId('opt'),
        type: 'transition',
        description: `${prev.type} 到 ${curr.type} 的情绪跳跃过大，建议增加过渡段`,
        priority: 3,
        timeRange: [getSegmentStartTime(script, i - 1), getSegmentStartTime(script, i)],
        expectedEffect: '使叙事更流畅',
      });
    }
  }

  return optimizations.sort((a, b) => b.priority - a.priority);
}

/**
 * 生成配乐推荐
 *
 * 基于脚本和情绪曲线推荐合适的配乐。
 *
 * @param script - 视频脚本
 * @param emotionCurve - 情绪曲线
 * @param config - 创意辅助配置
 * @returns 配乐推荐列表
 */
export function generateMusicRecommendations(
  script: VideoScript,
  emotionCurve: EmotionCurvePoint[],
  config: CreativeAssistantConfig,
): MusicRecommendation[] {
  if (!config.includeMusicRecommendations) return [];

  const maxCount = clamp(config.maxMusicRecommendations, 1, 10);
  const recommendations: MusicRecommendation[] = [];

  // 分析主导情绪
  const dominantEmotions = analyzeDominantEmotions(emotionCurve);

  // 为每个主导情绪生成推荐
  for (let i = 0; i < Math.min(maxCount, dominantEmotions.length); i++) {
    const { emotion, weight } = dominantEmotions[i];
    const bpmRange = EMOTION_BPM_RANGE[emotion];
    const instruments = EMOTION_INSTRUMENTS[emotion];

    // 找到适用的段落
    const applicableSegments = script.segments
      .filter((s) => s.emotion === emotion || getEmotionValence(s.emotion) === getEmotionValence(emotion))
      .map((s) => s.type);

    const matchScore = weight * 0.8 + (applicableSegments.length / script.segments.length) * 0.2;

    recommendations.push({
      id: generateId('music-rec'),
      genre: inferGenreFromEmotion(emotion, config.theme),
      mood: [emotion, ...getComplementaryEmotions(emotion)],
      bpmRange,
      reason: generateMusicRecommendationReason(emotion, applicableSegments, config.theme),
      applicableSegments: [...new Set(applicableSegments)],
      matchScore: Math.round(matchScore * 100) / 100,
      instruments,
    });
  }

  // 添加一个综合推荐
  if (recommendations.length > 0) {
    const allEmotions = dominantEmotions.map((d) => d.emotion);
    recommendations.push({
      id: generateId('music-rec'),
      genre: inferGenreFromTheme(config.theme),
      mood: allEmotions.slice(0, 3),
      bpmRange: [70, 130],
      reason: '贯穿全片的背景音乐，适合整体氛围',
      applicableSegments: script.segments.map((s) => s.type),
      matchScore: 0.75,
      instruments: [...new Set(dominantEmotions.flatMap((d) => EMOTION_INSTRUMENTS[d.emotion]).slice(0, 6))],
    });
  }

  return recommendations.sort((a, b) => b.matchScore - a.matchScore).slice(0, maxCount);
}

/**
 * 执行完整的创意辅助
 *
 * @param keywords - 关键词列表
 * @param config - 创意辅助配置
 * @returns 完整的创意辅助结果
 */
export function executeCreativeAssistance(
  keywords: string[],
  config: CreativeAssistantConfig,
): CreativeAssistanceResult {
  const startTime = performance.now();

  // 生成创意概念
  const concepts = generateCreativeConcepts(keywords, config);

  // 使用最佳概念生成脚本
  const bestConcept = concepts[0] ?? null;
  const script = generateVideoScript(bestConcept, keywords, config);

  // 生成情绪曲线
  const emotionCurve = generateEmotionCurve(script, config);

  // 生成结构优化建议
  const optimizations = generateStructureOptimizations(script, emotionCurve, config);

  // 生成配乐推荐
  const musicRecommendations = generateMusicRecommendations(script, emotionCurve, config);

  const generationTimeMs = performance.now() - startTime;

  return {
    concepts,
    script,
    emotionCurve,
    optimizations,
    musicRecommendations,
    generationTimeMs,
  };
}

/**
 * 验证创意辅助配置
 *
 * @param config - 待验证的配置
 * @returns 是否合法
 */
export function validateCreativeAssistantConfig(config: CreativeAssistantConfig): boolean {
  if (config.targetDuration < 5 || config.targetDuration > 7200) return false;
  if (config.creativityLevel < 0 || config.creativityLevel > 1) return false;
  if (config.maxConcepts < 1 || config.maxConcepts > 20) return false;
  if (config.maxMusicRecommendations < 0 || config.maxMusicRecommendations > 20) return false;
  if (!Array.isArray(config.targetPlatforms)) return false;
  return true;
}

// ==================== 内部辅助函数 ====================

/** 生成创意角度 */
function generateCreativeAngles(
  keywords: string[],
  theme: CreativeTheme,
  creativityLevel: number,
): string[] {
  const baseAngles: Record<CreativeTheme, string[]> = {
    storytelling: ['个人成长故事', '挑战与突破', '意想不到的转折', '情感共鸣', '幽默趣事'],
    tutorial: ['从零开始', '进阶技巧', '常见误区', '效率提升', '实战案例'],
    review: ['深度测评', '对比分析', '真实体验', '性价比', '专业视角'],
    vlog: ['日常生活', '旅行见闻', '美食探索', '挑战体验', '幕后故事'],
    documentary: ['历史揭秘', '人物传记', '社会现象', '自然探索', '科技前沿'],
    advertisement: ['痛点切入', '场景展示', '情感诉求', '对比效果', '用户证言'],
    'music-video': ['视觉叙事', '抽象概念', '舞蹈编排', '场景转换', '色彩表达'],
    'short-form': ['反转剧情', '实用技巧', '搞笑段子', '视觉冲击', '情感共鸣'],
    presentation: ['问题驱动', '数据说话', '案例分析', '互动参与', '行动号召'],
    interview: ['深度对话', '快速问答', '观点碰撞', '故事分享', '经验传授'],
  };

  const angles = baseAngles[theme] ?? baseAngles.storytelling;

  // 基于创造力级别选择角度数量
  const count = Math.max(2, Math.round(angles.length * clamp(creativityLevel, 0.3, 1)));

  // 基于关键词哈希选择角度（确定性）
  const keywordHash = keywords.reduce((sum, kw) => sum + hashCode(kw), 0);
  const startIndex = Math.abs(keywordHash) % angles.length;

  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    selected.push(angles[(startIndex + i) % angles.length]);
  }

  return [...new Set(selected)];
}

/** 生成标题 */
function generateTitle(keyword: string, angle: string, theme: CreativeTheme): string {
  const templates: Record<CreativeTheme, string[]> = {
    storytelling: [`${keyword}的故事`, `我和${keyword}的那些事`, `${angle}：${keyword}篇`],
    tutorial: [`${keyword}完全指南`, `如何${angle}：${keyword}教程`, `${keyword}入门到精通`],
    review: [`${keyword}深度测评`, `${keyword}值不值得买？`, `${angle}：${keyword}体验`],
    vlog: [`我的${keyword}日常`, `${keyword}vlog`, `${angle}记录`],
    documentary: [`揭秘${keyword}`, `${keyword}的背后`, `${angle}：${keyword}`],
    advertisement: [`${keyword}，改变你的生活`, `为什么选择${keyword}`, `${angle}${keyword}`],
    'music-video': [`${keyword} MV`, `${keyword}音乐视频`, `${angle}视觉之旅`],
    'short-form': [`${keyword}挑战`, `${keyword}小技巧`, `30秒${angle}${keyword}`],
    presentation: [`${keyword}深度解析`, `${angle}：${keyword}专题`, `${keyword}方法论`],
    interview: [`对话${keyword}专家`, `${keyword}访谈`, `${angle}：${keyword}对话`],
  };

  const options = templates[theme] ?? templates.storytelling;
  const index = Math.abs(hashCode(keyword + angle)) % options.length;
  return options[index];
}

/** 生成描述 */
function generateDescription(
  keywords: string[],
  angle: string,
  theme: CreativeTheme,
  duration: number,
): string {
  const keywordStr = keywords.join('、');
  const durationMin = Math.round(duration / 60);
  return `本视频以${angle}为切入点，深入探讨${keywordStr}相关内容。适合对${keywordStr}感兴趣的观众观看。预计时长约${durationMin}分钟。`;
}

/** 生成标签 */
function generateTags(theme: CreativeTheme, angle: string): string[] {
  const themeTags: Record<CreativeTheme, string[]> = {
    storytelling: ['故事', '叙事', '情感'],
    tutorial: ['教程', '教学', '学习'],
    review: ['测评', '评测', '体验'],
    vlog: ['vlog', '日常', '生活'],
    documentary: ['纪录片', '探索', '揭秘'],
    advertisement: ['广告', '推荐', '种草'],
    'music-video': ['MV', '音乐', '视觉'],
    'short-form': ['短视频', '创意', '有趣'],
    presentation: ['演讲', '分享', '知识'],
    interview: ['访谈', '对话', '交流'],
  };

  return [...(themeTags[theme] ?? []), angle];
}

/** 选择适用平台 */
function selectPlatforms(targetPlatforms: string[], duration: number): string[] {
  return targetPlatforms.filter((platform) => {
    const range = PLATFORM_RECOMMENDED_DURATION[platform] ?? PLATFORM_RECOMMENDED_DURATION.default;
    return duration >= range[0] * 0.5 && duration <= range[1] * 1.5;
  });
}

/** 计算创意评分 */
function computeCreativityScore(angle: string, creativityLevel: number, index: number): number {
  const baseScore = 80 - index * 5;
  const creativityBonus = creativityLevel * 20;
  const hashBonus = Math.abs(hashCode(angle)) % 10;
  return clamp(Math.round(baseScore + creativityBonus + hashBonus), 0, 100);
}

/** 获取主题标签 */
function getThemeLabel(theme: CreativeTheme): string {
  const labels: Record<CreativeTheme, string> = {
    storytelling: '故事',
    tutorial: '教程',
    review: '测评',
    vlog: 'Vlog',
    documentary: '纪录片',
    advertisement: '广告',
    'music-video': 'MV',
    'short-form': '短视频',
    presentation: '演讲',
    interview: '访谈',
  };
  return labels[theme] ?? '视频';
}

/** 推断目标受众 */
function inferTargetAudience(theme: CreativeTheme, keywords: string[]): string {
  const audienceMap: Record<CreativeTheme, string> = {
    storytelling: '全年龄段观众',
    tutorial: '学习者和初学者',
    review: '消费者和决策者',
    vlog: '年轻观众和粉丝',
    documentary: '知识爱好者',
    advertisement: '潜在消费者',
    'music-video': '音乐爱好者',
    'short-form': '碎片化时间用户',
    presentation: '专业人士和学生',
    interview: '行业关注者',
  };
  return audienceMap[theme] ?? '通用观众';
}

/** 选择段落情绪 */
function selectSegmentEmotion(
  segmentType: ScriptSegmentType,
  theme: CreativeTheme,
  index: number,
  totalSegments: number,
): EmotionType {
  const themeEmotions = THEME_EMOTION_SEQUENCES[theme];
  const position = index / Math.max(1, totalSegments - 1);
  const emotionIndex = Math.round(position * (themeEmotions.length - 1));
  return themeEmotions[clamp(emotionIndex, 0, themeEmotions.length - 1)];
}

/** 生成段落内容 */
function generateSegmentContent(
  segmentType: ScriptSegmentType,
  primaryKeyword: string,
  keywords: string[],
  concept: CreativeConcept | null,
  theme: CreativeTheme,
): string {
  const templates: Record<ScriptSegmentType, string> = {
    hook: `[开场 Hook] 以悬念或冲突抓住观众注意力，引出${primaryKeyword}主题`,
    intro: `[介绍] 简要介绍${primaryKeyword}的背景和本次内容的价值`,
    body: `[主体] 深入探讨${keywords.join('、')}的核心内容，结合案例和数据`,
    climax: `[高潮] 展示${primaryKeyword}最精彩或最有价值的部分`,
    transition: `[过渡] 自然过渡到下一个话题`,
    'call-to-action': `[行动号召] 邀请观众点赞、关注、评论或访问相关链接`,
    outro: `[结尾] 总结要点，感谢观看`,
    summary: `[总结] 回顾${primaryKeyword}的关键要点`,
  };

  return templates[segmentType] ?? `[${segmentType}] ${primaryKeyword}相关内容`;
}

/** 生成视觉建议 */
function generateVisualSuggestion(
  segmentType: ScriptSegmentType,
  emotion: EmotionType,
  theme: CreativeTheme,
): string {
  const visualMap: Record<ScriptSegmentType, string> = {
    hook: '快速剪辑、特写镜头、悬念画面',
    intro: '全景建立镜头、标题动画、主讲人出镜',
    body: '中景对话、屏幕录制、B-Roll 素材',
    climax: '慢动作、特写、高对比色彩、戏剧性灯光',
    transition: '转场动画、黑场过渡、画面淡入淡出',
    'call-to-action': '文字叠加、按钮动画、二维码展示',
    outro: 'Logo 展示、推荐内容卡片、结束动画',
    summary: '要点列表、关键画面回顾、文字总结',
  };

  return visualMap[segmentType] ?? '标准画面';
}

/** 生成音乐建议 */
function generateMusicSuggestion(
  segmentType: ScriptSegmentType,
  emotion: EmotionType,
  theme: CreativeTheme,
): string {
  const bpmRange = EMOTION_BPM_RANGE[emotion];
  const instruments = EMOTION_INSTRUMENTS[emotion].slice(0, 3);

  const segmentMusicStyle: Record<ScriptSegmentType, string> = {
    hook: '短促有力的音效或音乐片段',
    intro: '渐入的背景音乐',
    body: '持续的背景配乐',
    climax: '音乐高潮或突然静默',
    transition: '简短的音乐过渡',
    'call-to-action': '积极向上的音乐',
    outro: '渐出的音乐',
    summary: '与开头呼应的音乐',
  };

  return `${segmentMusicStyle[segmentType]}，BPM ${bpmRange[0]}-${bpmRange[1]}，使用${instruments.join('、')}`;
}

/** 计算情绪强度 */
function computeEmotionIntensity(
  emotion: EmotionType,
  t: number,
  segmentType: ScriptSegmentType,
): number {
  // 基础强度
  const baseIntensity: Record<EmotionType, number> = {
    happy: 0.6,
    sad: 0.5,
    excited: 0.8,
    calm: 0.3,
    tense: 0.7,
    mysterious: 0.5,
    romantic: 0.6,
    humorous: 0.7,
    inspirational: 0.7,
    dramatic: 0.8,
  };

  const base = baseIntensity[emotion];

  // 段落类型调整
  const segmentMultiplier: Record<ScriptSegmentType, number> = {
    hook: 1.2,
    intro: 0.8,
    body: 1.0,
    climax: 1.5,
    transition: 0.6,
    'call-to-action': 1.1,
    outro: 0.7,
    summary: 0.9,
  };

  const multiplier = segmentMultiplier[segmentType] ?? 1.0;

  // 段落内变化（开头和结尾略低，中间高）
  const segmentVariation = 0.8 + 0.4 * Math.sin(t * Math.PI);

  return clamp(base * multiplier * segmentVariation, 0, 1);
}

/** 调整叙事节奏 */
function adjustPacing(
  basePacing: NarrativePacing,
  t: number,
  segmentType: ScriptSegmentType,
): NarrativePacing {
  if (segmentType === 'hook' || segmentType === 'climax') return 'fast';
  if (segmentType === 'transition' || segmentType === 'outro') return 'slow';
  return basePacing;
}

/** 统计节奏变化次数 */
function countPacingChanges(points: EmotionCurvePoint[]): number {
  let changes = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].pacing !== points[i - 1].pacing) changes++;
  }
  return changes;
}

/** 获取情绪效价（正/负） */
function getEmotionValence(emotion: EmotionType): number {
  const valence: Record<EmotionType, number> = {
    happy: 1,
    sad: -1,
    excited: 1,
    calm: 0,
    tense: -0.5,
    mysterious: -0.3,
    romantic: 0.5,
    humorous: 1,
    inspirational: 0.8,
    dramatic: 0,
  };
  return valence[emotion] ?? 0;
}

/** 获取段落起始时间 */
function getSegmentStartTime(script: VideoScript, index: number): number {
  let time = 0;
  for (let i = 0; i < index; i++) {
    time += script.segments[i].estimatedDuration;
  }
  return time;
}

/** 分析主导情绪 */
function analyzeDominantEmotions(
  curve: EmotionCurvePoint[],
): Array<{ emotion: EmotionType; weight: number }> {
  const emotionCounts = new Map<EmotionType, number>();

  for (const point of curve) {
    emotionCounts.set(point.emotion, (emotionCounts.get(point.emotion) ?? 0) + point.intensity);
  }

  const total = Array.from(emotionCounts.values()).reduce((a, b) => a + b, 0);

  return Array.from(emotionCounts.entries())
    .map(([emotion, count]) => ({ emotion, weight: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.weight - a.weight);
}

/** 获取互补情绪 */
function getComplementaryEmotions(emotion: EmotionType): EmotionType[] {
  const complementary: Record<EmotionType, EmotionType[]> = {
    happy: ['excited', 'inspirational'],
    sad: ['calm', 'mysterious'],
    excited: ['happy', 'dramatic'],
    calm: ['romantic', 'mysterious'],
    tense: ['dramatic', 'mysterious'],
    mysterious: ['tense', 'calm'],
    romantic: ['calm', 'happy'],
    humorous: ['happy', 'excited'],
    inspirational: ['happy', 'dramatic'],
    dramatic: ['tense', 'inspirational'],
  };
  return complementary[emotion] ?? ['calm'];
}

/** 从情绪推断音乐风格 */
function inferGenreFromEmotion(emotion: EmotionType, theme: CreativeTheme): string {
  const emotionGenre: Record<EmotionType, string> = {
    happy: 'pop',
    sad: 'ambient',
    excited: 'electronic',
    calm: 'ambient',
    tense: 'cinematic',
    mysterious: 'ambient',
    romantic: 'jazz',
    humorous: 'pop',
    inspirational: 'cinematic',
    dramatic: 'cinematic',
  };
  return emotionGenre[emotion] ?? 'pop';
}

/** 从主题推断音乐风格 */
function inferGenreFromTheme(theme: CreativeTheme): string {
  const themeGenre: Record<CreativeTheme, string> = {
    storytelling: 'cinematic',
    tutorial: 'lo-fi',
    review: 'pop',
    vlog: 'pop',
    documentary: 'ambient',
    advertisement: 'pop',
    'music-video': 'electronic',
    'short-form': 'electronic',
    presentation: 'ambient',
    interview: 'lo-fi',
  };
  return themeGenre[theme] ?? 'pop';
}

/** 生成配乐推荐理由 */
function generateMusicRecommendationReason(
  emotion: EmotionType,
  segments: ScriptSegmentType[],
  theme: CreativeTheme,
): string {
  const emotionLabel: Record<EmotionType, string> = {
    happy: '欢快',
    sad: '忧伤',
    excited: '激动',
    calm: '平静',
    tense: '紧张',
    mysterious: '神秘',
    romantic: '浪漫',
    humorous: '幽默',
    inspirational: '励志',
    dramatic: '戏剧性',
  };

  const segmentNames = segments.length > 0 ? `适用于${segments.join('、')}段落` : '通用配乐';
  return `${emotionLabel[emotion]}风格，${segmentNames}，与${getThemeLabel(theme)}主题契合`;
}

/**
 * 安全执行创意辅助
 *
 * @param keywords - 关键词列表
 * @param config - 创意辅助配置
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的创意辅助结果
 */
export async function executeCreativeAssistanceSafe(
  keywords: string[],
  config: CreativeAssistantConfig,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<CreativeAssistanceResult>> {
  try {
    if (!validateCreativeAssistantConfig(config)) {
      return {
        data: createEmptyCreativeAssistanceResult(),
        error: t('aiModules.creative.invalidConfig'),
      };
    }
    if (keywords.length === 0) {
      return {
        data: createEmptyCreativeAssistanceResult(),
        error: t('aiModules.creative.noKeywords'),
      };
    }
    const data = executeCreativeAssistance(keywords, config);
    return { data, error: null };
  } catch {
    return {
      data: createEmptyCreativeAssistanceResult(),
      error: t('aiModules.error.parseFailed'),
    };
  }
}

/** 创建空的创意辅助结果 */
function createEmptyCreativeAssistanceResult(): CreativeAssistanceResult {
  return {
    concepts: [],
    script: null,
    emotionCurve: [],
    optimizations: [],
    musicRecommendations: [],
    generationTimeMs: 0,
  };
}
