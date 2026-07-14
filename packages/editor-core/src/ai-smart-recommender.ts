import type { Clip } from './model-types';
import type {
  ContentSceneType,
  ContentAnalysisSegment,
  ContentEmotionPoint,
  ClipContentAnalysis,
} from './content-analysis';

// ─── 推荐接口类型 ──────────────────────────────────────────

/** 推荐片段 */
export interface RecommendedClip {
  clipId: string;
  score: number;
  similarityScore: number;
  emotionScore: number;
  diversityScore: number;
  reason: string;
}

/** 推荐结果 */
export interface RecommendationResult {
  clips: RecommendedClip[];
  totalCount: number;
  generatedAt: string;
}

/** 推荐上下文 */
export interface RecommendationContext {
  /** 当前已选片段列表 */
  selectedClips: Clip[];
  /** 当前时间线位置（秒） */
  currentTime: number;
  /** 当前情感曲线趋势 */
  currentEmotionTrend?: number;
  /** 目标场景类型偏好 */
  preferredSceneTypes?: ContentSceneType[];
  /** 已使用的关键帧关键词 */
  usedKeywords?: string[];
}

/** 推荐选项 */
export interface RecommendationOptions {
  /** 返回推荐数量上限 */
  maxResults?: number;
  /** 内容相似度权重 */
  similarityWeight?: number;
  /** 情感连贯性权重 */
  emotionWeight?: number;
  /** 多样性权重 */
  diversityWeight?: number;
  /** 最低推荐分数阈值 */
  minScoreThreshold?: number;
  /** 情感曲线趋同容差 */
  emotionTolerance?: number;
}

// ─── 智能推荐算法 ──────────────────────────────────────────

const DEFAULT_OPTIONS: Required<RecommendationOptions> = {
  maxResults: 10,
  similarityWeight: 0.4,
  emotionWeight: 0.35,
  diversityWeight: 0.25,
  minScoreThreshold: 0.15,
  emotionTolerance: 0.3,
};

/**
 * 智能推荐算法：基于内容相似度、情感连贯性和多样性平衡，
 * 从候选片段中筛选出最符合当前上下文的推荐片段。
 *
 * @param candidates - 候选片段列表（需包含 contentAnalysis）
 * @param context - 当前推荐上下文
 * @param options - 推荐权重与阈值选项
 * @returns 按综合分数降序排列的推荐结果
 */
export function recommendClips(
  candidates: Clip[],
  context: RecommendationContext,
  options: RecommendationOptions = {},
): RecommendationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const selectedAnalysis = buildSelectedAnalysis(context.selectedClips);
  const diversitySet = buildDiversitySet(context.selectedClips);

  const scored: RecommendedClip[] = [];

  for (const clip of candidates) {
    const analysis = clip.contentAnalysis;
    if (!analysis) {
      continue;
    }

    const similarityScore = computeContentSimilarity(analysis, context, selectedAnalysis);
    const emotionScore = computeEmotionCoherence(analysis, context, opts.emotionTolerance);
    const diversityScore = computeDiversityBonus(analysis, diversitySet);

    const weighted =
      similarityScore * opts.similarityWeight +
      emotionScore * opts.emotionWeight +
      diversityScore * opts.diversityWeight;

    const finalScore = clamp01(weighted);

    if (finalScore < opts.minScoreThreshold) {
      continue;
    }

    scored.push({
      clipId: clip.id,
      score: round(finalScore),
      similarityScore: round(similarityScore),
      emotionScore: round(emotionScore),
      diversityScore: round(diversityScore),
      reason: buildRecommendationReason(similarityScore, emotionScore, diversityScore),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    clips: scored.slice(0, opts.maxResults),
    totalCount: scored.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 内容相似度计算 ─────────────────────────────────────────

interface SelectedAnalysisSnapshot {
  sceneTypes: ContentSceneType[];
  avgBrightness: number;
  avgMotion: number;
  keywords: Set<string>;
}

/**
 * 基于场景类型、视觉特征和关键词计算内容相似度。
 * 三个子维度加权汇总：场景类型匹配 40%、视觉特征接近 35%、关键词重叠 25%。
 */
function computeContentSimilarity(
  analysis: ClipContentAnalysis,
  context: RecommendationContext,
  snapshot: SelectedAnalysisSnapshot,
): number {
  const sceneScore = computeSceneTypeSimilarity(
    analysis.sceneTypes,
    context.preferredSceneTypes ?? snapshot.sceneTypes,
  );
  const visualScore = computeVisualSimilarity(analysis.segments, snapshot);
  const keywordScore = computeKeywordOverlap(analysis, context.usedKeywords ?? []);

  return sceneScore * 0.4 + visualScore * 0.35 + keywordScore * 0.25;
}

/** 场景类型 Jaccard 相似度 */
function computeSceneTypeSimilarity(candidateTypes: ContentSceneType[], targetTypes: ContentSceneType[]): number {
  if (targetTypes.length === 0 || candidateTypes.length === 0) {
    return 0.5;
  }
  const targetSet = new Set(targetTypes);
  const candidateSet = new Set(candidateTypes);
  let intersection = 0;
  for (const type of candidateSet) {
    if (targetSet.has(type)) {
      intersection += 1;
    }
  }
  const union = new Set([...targetTypes, ...candidateTypes]).size;
  return union > 0 ? intersection / union : 0;
}

/** 视觉特征（亮度、运动）接近度 */
function computeVisualSimilarity(segments: ContentAnalysisSegment[], snapshot: SelectedAnalysisSnapshot): number {
  if (segments.length === 0) {
    return 0.5;
  }
  const avgBrightness = segments.reduce((sum, s) => sum + s.brightness, 0) / segments.length;
  const avgMotion = segments.reduce((sum, s) => sum + s.motion, 0) / segments.length;

  const brightnessDiff = Math.abs(avgBrightness - snapshot.avgBrightness);
  const motionDiff = Math.abs(avgMotion - snapshot.avgMotion);

  const brightnessSim = 1 - clamp01(brightnessDiff);
  const motionSim = 1 - clamp01(motionDiff);

  return brightnessSim * 0.55 + motionSim * 0.45;
}

/**
 * 关键词重叠度：从场景类型和摘要中提取关键词，
 * 与已使用关键词集合比较 Jaccard 系数。
 */
function computeKeywordOverlap(analysis: ClipContentAnalysis, usedKeywords: string[]): number {
  const candidateKeywords = extractKeywords(analysis);
  if (candidateKeywords.size === 0 || usedKeywords.length === 0) {
    return 0.5;
  }
  const usedSet = new Set(usedKeywords);
  let overlap = 0;
  for (const kw of candidateKeywords) {
    if (usedSet.has(kw)) {
      overlap += 1;
    }
  }
  const union = new Set([...candidateKeywords, ...usedSet]).size;
  return union > 0 ? overlap / union : 0;
}

// ─── 情感连贯性计算 ─────────────────────────────────────────

/**
 * 确保推荐片段的情感与当前上下文连贯。
 * 取情感曲线均值与目标趋势的接近程度，曲线波动的平滑度作为加分项。
 */
function computeEmotionCoherence(
  analysis: ClipContentAnalysis,
  context: RecommendationContext,
  tolerance: number,
): number {
  const curve = analysis.emotionCurve;
  if (curve.length === 0) {
    return 0.5;
  }

  const avgEmotion = curve.reduce((sum, p) => sum + p.value, 0) / curve.length;
  const targetTrend = context.currentEmotionTrend ?? avgEmotion;

  // 趋势接近度：差异越小分越高
  const trendDiff = Math.abs(avgEmotion - targetTrend);
  const trendScore = clamp01(1 - trendDiff / Math.max(tolerance, 0.01));

  // 平滑度：曲线方差越小越好
  const smoothness = computeCurveSmoothness(curve);

  return trendScore * 0.65 + smoothness * 0.35;
}

/** 情感曲线平滑度：基于一阶差分方差 */
function computeCurveSmoothness(curve: ContentEmotionPoint[]): number {
  if (curve.length < 2) {
    return 1;
  }
  const deltas: number[] = [];
  for (let i = 1; i < curve.length; i += 1) {
    deltas.push(Math.abs(curve[i].value - curve[i - 1].value));
  }
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const variance = deltas.reduce((sum, d) => sum + (d - avgDelta) ** 2, 0) / deltas.length;
  // 方差越小越平滑，映射到 0~1
  return clamp01(1 - variance * 4);
}

// ─── 多样性平衡 ────────────────────────────────────────────

/**
 * 避免推荐过于相似的片段。
 * 将候选片段的场景类型与已选片段的类型集合比较，
 * 差异性越大得分越高。
 */
function computeDiversityBonus(analysis: ClipContentAnalysis, diversitySet: Set<ContentSceneType>): number {
  const candidateTypes = analysis.sceneTypes;
  if (candidateTypes.length === 0) {
    return 0.5;
  }
  if (diversitySet.size === 0) {
    return 0.8;
  }

  let novelCount = 0;
  for (const type of candidateTypes) {
    if (!diversitySet.has(type)) {
      novelCount += 1;
    }
  }

  const noveltyRatio = novelCount / candidateTypes.length;

  // 鼓励引入新场景类型，但完全重复也有基础分
  return clamp01(0.3 + noveltyRatio * 0.7);
}

// ─── 辅助函数 ──────────────────────────────────────────────

function buildSelectedAnalysis(clips: Clip[]): SelectedAnalysisSnapshot {
  const allSceneTypes: ContentSceneType[] = [];
  let totalBrightness = 0;
  let totalMotion = 0;
  let segmentCount = 0;
  const keywords: string[] = [];

  for (const clip of clips) {
    const analysis = clip.contentAnalysis;
    if (!analysis) {
      continue;
    }
    allSceneTypes.push(...analysis.sceneTypes);
    for (const seg of analysis.segments) {
      totalBrightness += seg.brightness;
      totalMotion += seg.motion;
      segmentCount += 1;
    }
    keywords.push(...extractKeywordStrings(analysis));
  }

  return {
    sceneTypes: dedupeSceneTypes(allSceneTypes),
    avgBrightness: segmentCount > 0 ? totalBrightness / segmentCount : 0.5,
    avgMotion: segmentCount > 0 ? totalMotion / segmentCount : 0.3,
    keywords: new Set(keywords),
  };
}

function buildDiversitySet(clips: Clip[]): Set<ContentSceneType> {
  const types: ContentSceneType[] = [];
  for (const clip of clips) {
    if (clip.contentAnalysis) {
      types.push(...clip.contentAnalysis.sceneTypes);
    }
  }
  return new Set(types);
}

function extractKeywords(analysis: ClipContentAnalysis): Set<string> {
  return new Set(extractKeywordStrings(analysis));
}

function extractKeywordStrings(analysis: ClipContentAnalysis): string[] {
  const keywords: string[] = [];
  keywords.push(...analysis.sceneTypes);
  if (analysis.summary) {
    keywords.push(analysis.summary);
  }
  return keywords;
}

const SCENE_TYPE_ORDER = ['indoor', 'outdoor', 'night', 'action', 'dialogue', 'close-up'] as const;

function dedupeSceneTypes(types: ContentSceneType[]): ContentSceneType[] {
  const seen = new Set(types);
  return SCENE_TYPE_ORDER.filter((type) => seen.has(type));
}

function buildRecommendationReason(similarity: number, emotion: number, diversity: number): string {
  const parts: string[] = [];
  if (similarity >= 0.7) {
    parts.push('高内容匹配');
  }
  if (emotion >= 0.7) {
    parts.push('情感连贯');
  }
  if (diversity >= 0.7) {
    parts.push('场景多样');
  }
  if (parts.length === 0) {
    if (similarity >= emotion && similarity >= diversity) {
      parts.push('内容相关');
    } else if (emotion >= diversity) {
      parts.push('情感适配');
    } else {
      parts.push('增加多样性');
    }
  }
  return parts.join(' · ');
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
