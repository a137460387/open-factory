/**
 * AI-Enhanced Distribution Analytics
 *
 * Provides AI-powered content optimization, publish time prediction,
 * performance analytics, and A/B testing capabilities.
 */
import type { DistributionPlatformId } from './platform-presets';
export interface DistributionContentAnalysis {
    /** 内容质量评分 (0-100) */
    qualityScore: number;
    /** 标题优化建议 */
    titleSuggestions: string[];
    /** 标签推荐 */
    recommendedTags: string[];
    /** 封面建议 */
    coverSuggestions: CoverSuggestion[];
    /** 平台适配建议 */
    platformAdvice: PlatformAdvice[];
    /** 内容分类 */
    category: string;
    /** 情感分析 */
    sentiment: 'positive' | 'neutral' | 'negative';
    /** 关键词提取 */
    keywords: string[];
}
export interface CoverSuggestion {
    /** 建议的封面时间点 (秒) */
    timestamp: number;
    /** 推荐理由 */
    reason: string;
    /** 预期点击率提升 */
    expectedCtrLift: number;
}
export interface PlatformAdvice {
    platformId: DistributionPlatformId;
    platformName: string;
    /** 是否推荐该平台 */
    recommended: boolean;
    /** 推荐分数 (0-100) */
    score: number;
    /** 具体建议 */
    suggestions: string[];
    /** 预估表现 */
    expectedPerformance: ExpectedPerformance;
}
export interface ExpectedPerformance {
    /** 预估观看量范围 */
    viewsRange: {
        min: number;
        max: number;
    };
    /** 预估互动率 */
    engagementRate: number;
    /** 预估增长潜力 */
    growthPotential: 'low' | 'medium' | 'high';
}
export interface TimeSlot {
    /** 星期几 (0=周日, 6=周六) */
    dayOfWeek: number;
    /** 小时 (0-23) */
    hour: number;
    /** 预测分数 (0-100) */
    score: number;
    /** 预测理由 */
    reason: string;
    /** 预估观众活跃度 */
    audienceActivity: number;
}
export interface PublishTimePrediction {
    platformId: DistributionPlatformId;
    /** 推荐时间槽 (按分数排序) */
    recommendedSlots: TimeSlot[];
    /** 最佳发布时间 */
    bestTime: TimeSlot;
    /** 基于的历史数据点数 */
    dataPoints: number;
    /** 预测置信度 (0-1) */
    confidence: number;
}
export interface PlatformPerformance {
    platformId: DistributionPlatformId;
    platformName: string;
    /** 总观看量 */
    totalViews: number;
    /** 总互动数 */
    totalEngagements: number;
    /** 互动率 */
    engagementRate: number;
    /** 平均观看时长 (秒) */
    avgWatchTime: number;
    /** 观众留存率 */
    retentionRate: number;
    /** 粉丝增长 */
    followerGrowth: number;
    /** 收入 (如有) */
    revenue?: number;
    /** 趋势 */
    trend: 'rising' | 'stable' | 'declining';
}
export interface DistributionInsight {
    type: 'opportunity' | 'warning' | 'success' | 'tip';
    title: string;
    description: string;
    platformId?: DistributionPlatformId;
    actionable: boolean;
    priority: 'high' | 'medium' | 'low';
}
export interface DistributionAnalyticsSummary {
    /** 各平台表现 */
    platformPerformance: PlatformPerformance[];
    /** 总体数据 */
    totals: {
        views: number;
        engagements: number;
        revenue: number;
        bestPlatform: DistributionPlatformId;
    };
    /** 洞察和建议 */
    insights: DistributionInsight[];
    /** 分析时间范围 */
    period: {
        from: string;
        to: string;
    };
}
export type ABTestStatus = 'draft' | 'running' | 'completed' | 'paused';
export interface ABTestVariant {
    /** 变体 ID */
    id: string;
    /** 变体名称 */
    name: string;
    /** 变体描述 */
    description: string;
    /** 标题 */
    title?: string;
    /** 封面 */
    coverTimestamp?: number;
    /** 标签 */
    tags?: string[];
    /** 描述 */
    contentDescription?: string;
    /** 流量分配比例 (0-1) */
    trafficShare: number;
}
export interface ABTestResult {
    variantId: string;
    variantName: string;
    /** 观看量 */
    views: number;
    /** 点击率 */
    ctr: number;
    /** 互动率 */
    engagementRate: number;
    /** 平均观看时长 */
    avgWatchTime: number;
    /** 转化率 */
    conversionRate: number;
    /** 统计显著性 */
    statisticalSignificance: number;
}
export interface ABTest {
    id: string;
    name: string;
    description: string;
    platformId: DistributionPlatformId;
    status: ABTestStatus;
    variants: ABTestVariant[];
    results?: ABTestResult[];
    /** 胜出变体 ID */
    winnerId?: string;
    /** 测试开始时间 */
    startedAt?: string;
    /** 测试结束时间 */
    endedAt?: string;
    /** 测试时长 (天) */
    durationDays: number;
    /** 最小样本量 */
    minSampleSize: number;
    createdAt: string;
}
export declare class AIDistributionEngine {
    private historicalData;
    private abTests;
    /** 分析内容并提供优化建议 */
    analyzeContent(input: {
        title: string;
        description: string;
        duration: number;
        width: number;
        height: number;
        hasSubtitles: boolean;
        tags?: string[];
    }): DistributionContentAnalysis;
    /** 预测最佳发布时间 */
    predictPublishTime(platformId: DistributionPlatformId, contentCategory?: string): PublishTimePrediction;
    /** 获取分发效果分析 */
    getAnalyticsSummary(period: {
        from: string;
        to: string;
    }): DistributionAnalyticsSummary;
    /** 创建 A/B 测试 */
    createABTest(input: {
        name: string;
        description: string;
        platformId: DistributionPlatformId;
        variants: Omit<ABTestVariant, 'id'>[];
        durationDays: number;
        minSampleSize?: number;
    }): ABTest;
    /** 启动 A/B 测试 */
    startABTest(testId: string): ABTest;
    /** 获取 A/B 测试结果 */
    getABTestResults(testId: string): ABTestResult[];
    /** 获取 A/B 测试 */
    getABTest(testId: string): ABTest;
    /** 列出所有 A/B 测试 */
    listABTests(platformId?: DistributionPlatformId): ABTest[];
    /** 记录历史数据 */
    recordPerformance(platformId: string, record: PerformanceRecord): void;
    private calculateQualityScore;
    private generateTitleSuggestions;
    private generateTagRecommendations;
    private generateCoverSuggestions;
    private generatePlatformAdvice;
    private generateTimeSlots;
    private extractKeywords;
    private detectCategory;
    private analyzeSentiment;
    private calculateTrend;
    private generateInsights;
}
export interface PerformanceRecord {
    date: string;
    views: number;
    engagements: number;
    avgWatchTime: number;
    retentionRate: number;
    followerGrowth: number;
    revenue?: number;
}
//# sourceMappingURL=ai-distribution-engine.d.ts.map