import type { Clip } from './model-types';
import type { ContentSceneType } from './content-analysis';
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
/**
 * 智能推荐算法：基于内容相似度、情感连贯性和多样性平衡，
 * 从候选片段中筛选出最符合当前上下文的推荐片段。
 *
 * @param candidates - 候选片段列表（需包含 contentAnalysis）
 * @param context - 当前推荐上下文
 * @param options - 推荐权重与阈值选项
 * @returns 按综合分数降序排列的推荐结果
 */
export declare function recommendClips(candidates: Clip[], context: RecommendationContext, options?: RecommendationOptions): RecommendationResult;
//# sourceMappingURL=ai-smart-recommender.d.ts.map