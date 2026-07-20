/**
 * AI-Enhanced Distribution Analytics
 *
 * Provides AI-powered content optimization, publish time prediction,
 * performance analytics, and A/B testing capabilities.
 */

import type { DistributionPlatformId, DistributionPlatformSpec } from './platform-presets';

// ─── Content Analysis ────────────────────────────────────────────

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
  viewsRange: { min: number; max: number };
  /** 预估互动率 */
  engagementRate: number;
  /** 预估增长潜力 */
  growthPotential: 'low' | 'medium' | 'high';
}

// ─── Publish Time Prediction ────────────────────────────────────────────

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

// ─── Performance Analytics ────────────────────────────────────────────

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
  period: { from: string; to: string };
}

// ─── A/B Testing ────────────────────────────────────────────

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

// ─── AI Distribution Engine ────────────────────────────────────────────

export class AIDistributionEngine {
  private historicalData: Map<string, PerformanceRecord[]> = new Map();
  private abTests = new Map<string, ABTest>();

  /** 分析内容并提供优化建议 */
  analyzeContent(input: {
    title: string;
    description: string;
    duration: number;
    width: number;
    height: number;
    hasSubtitles: boolean;
    tags?: string[];
  }): DistributionContentAnalysis {
    const qualityScore = this.calculateQualityScore(input);
    const titleSuggestions = this.generateTitleSuggestions(input.title);
    const recommendedTags = this.generateTagRecommendations(input);
    const coverSuggestions = this.generateCoverSuggestions(input.duration);
    const platformAdvice = this.generatePlatformAdvice(input);
    const keywords = this.extractKeywords(input.title + ' ' + input.description);

    return {
      qualityScore,
      titleSuggestions,
      recommendedTags,
      coverSuggestions,
      platformAdvice,
      category: this.detectCategory(keywords),
      sentiment: this.analyzeSentiment(input.description),
      keywords,
    };
  }

  /** 预测最佳发布时间 */
  predictPublishTime(
    platformId: DistributionPlatformId,
    contentCategory?: string,
  ): PublishTimePrediction {
    const historical = this.historicalData.get(platformId) ?? [];
    const dataPoints = historical.length;

    // Generate recommended time slots based on platform best practices
    const recommendedSlots = this.generateTimeSlots(platformId, contentCategory);
    const bestTime = recommendedSlots[0];

    return {
      platformId,
      recommendedSlots,
      bestTime,
      dataPoints,
      confidence: Math.min(0.95, 0.5 + dataPoints * 0.01),
    };
  }

  /** 获取分发效果分析 */
  getAnalyticsSummary(
    period: { from: string; to: string },
  ): DistributionAnalyticsSummary {
    const platformPerformance: PlatformPerformance[] = [];
    let totalViews = 0;
    let totalEngagements = 0;
    let totalRevenue = 0;
    let bestPlatform: DistributionPlatformId = 'youtube-1080p';
    let bestViews = 0;

    for (const [platformId, records] of this.historicalData) {
      const filtered = records.filter(
        (r) => r.date >= period.from && r.date <= period.to,
      );
      if (filtered.length === 0) continue;

      const views = filtered.reduce((sum, r) => sum + r.views, 0);
      const engagements = filtered.reduce((sum, r) => sum + r.engagements, 0);
      const revenue = filtered.reduce((sum, r) => sum + (r.revenue ?? 0), 0);

      totalViews += views;
      totalEngagements += engagements;
      totalRevenue += revenue;

      if (views > bestViews) {
        bestViews = views;
        bestPlatform = platformId as DistributionPlatformId;
      }

      platformPerformance.push({
        platformId: platformId as DistributionPlatformId,
        platformName: platformId,
        totalViews: views,
        totalEngagements: engagements,
        engagementRate: views > 0 ? engagements / views : 0,
        avgWatchTime: filtered.reduce((sum, r) => sum + r.avgWatchTime, 0) / filtered.length,
        retentionRate: filtered.reduce((sum, r) => sum + r.retentionRate, 0) / filtered.length,
        followerGrowth: filtered.reduce((sum, r) => sum + r.followerGrowth, 0),
        revenue,
        trend: this.calculateTrend(filtered),
      });
    }

    const insights = this.generateInsights(platformPerformance);

    return {
      platformPerformance,
      totals: { views: totalViews, engagements: totalEngagements, revenue: totalRevenue, bestPlatform },
      insights,
      period,
    };
  }

  // ─── A/B Testing ──────────────────────────────────────

  /** 创建 A/B 测试 */
  createABTest(input: {
    name: string;
    description: string;
    platformId: DistributionPlatformId;
    variants: Omit<ABTestVariant, 'id'>[];
    durationDays: number;
    minSampleSize?: number;
  }): ABTest {
    const test: ABTest = {
      id: `abtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      platformId: input.platformId,
      status: 'draft',
      variants: input.variants.map((v, i) => ({
        ...v,
        id: `variant-${i}`,
      })),
      durationDays: input.durationDays,
      minSampleSize: input.minSampleSize ?? 1000,
      createdAt: new Date().toISOString(),
    };
    this.abTests.set(test.id, test);
    return test;
  }

  /** 启动 A/B 测试 */
  startABTest(testId: string): ABTest {
    const test = this.getABTest(testId);
    if (test.status !== 'draft') {
      throw new Error(`Test ${testId} is not in draft status`);
    }
    test.status = 'running';
    test.startedAt = new Date().toISOString();
    return test;
  }

  /** 获取 A/B 测试结果 */
  getABTestResults(testId: string): ABTestResult[] {
    const test = this.getABTest(testId);
    if (!test.results) return [];

    // Find winner
    const sorted = [...test.results].sort((a, b) => b.engagementRate - a.engagementRate);
    if (sorted.length > 0 && sorted[0].statisticalSignificance >= 0.95) {
      test.winnerId = sorted[0].variantId;
      test.status = 'completed';
      test.endedAt = new Date().toISOString();
    }

    return test.results;
  }

  /** 获取 A/B 测试 */
  getABTest(testId: string): ABTest {
    const test = this.abTests.get(testId);
    if (!test) throw new Error(`A/B test ${testId} not found`);
    return test;
  }

  /** 列出所有 A/B 测试 */
  listABTests(platformId?: DistributionPlatformId): ABTest[] {
    const tests = Array.from(this.abTests.values());
    if (platformId) {
      return tests.filter((t) => t.platformId === platformId);
    }
    return tests;
  }

  /** 记录历史数据 */
  recordPerformance(platformId: string, record: PerformanceRecord): void {
    const records = this.historicalData.get(platformId) ?? [];
    records.push(record);
    this.historicalData.set(platformId, records);
  }

  // ─── Private Methods ──────────────────────────────────────

  private calculateQualityScore(input: { title: string; description: string; duration: number }): number {
    let score = 50;
    if (input.title.length >= 10 && input.title.length <= 60) score += 15;
    if (input.description.length >= 50) score += 10;
    if (input.duration >= 30 && input.duration <= 600) score += 15;
    if (input.title.includes('|') || input.title.includes('-')) score += 5;
    return Math.min(100, score);
  }

  private generateTitleSuggestions(title: string): string[] {
    const suggestions: string[] = [];
    if (title.length < 10) suggestions.push('标题太短，建议增加到 10-60 个字符');
    if (title.length > 60) suggestions.push('标题过长，建议精简到 60 个字符以内');
    if (!/[!?！？]/.test(title)) suggestions.push('添加问号或感叹号可提升点击率');
    if (!/\d/.test(title)) suggestions.push('包含数字的标题通常更吸引人');
    return suggestions;
  }

  private generateTagRecommendations(input: { tags?: string[]; title: string }): string[] {
    const keywords = this.extractKeywords(input.title);
    const existing = new Set(input.tags ?? []);
    return keywords.filter((k) => !existing.has(k)).slice(0, 5);
  }

  private generateCoverSuggestions(duration: number): CoverSuggestion[] {
    const suggestions: CoverSuggestion[] = [];
    const points = [0.1, 0.25, 0.5].map((p) => Math.floor(duration * p));
    points.forEach((timestamp, i) => {
      suggestions.push({
        timestamp,
        reason: ['视频开头精彩瞬间', '内容高潮部分', '关键画面节点'][i],
        expectedCtrLift: [0.05, 0.12, 0.08][i],
      });
    });
    return suggestions;
  }

  private generatePlatformAdvice(input: { width: number; height: number; duration: number }): PlatformAdvice[] {
    const isPortrait = input.height > input.width;
    const isShort = input.duration <= 60;

    const platforms: { id: DistributionPlatformId; name: string; match: boolean }[] = [
      { id: 'youtube-1080p', name: 'YouTube', match: !isPortrait && !isShort },
      { id: 'youtube-shorts', name: 'YouTube Shorts', match: isPortrait && isShort },
      { id: 'tiktok', name: 'TikTok', match: isPortrait },
      { id: 'instagram-reels', name: 'Instagram Reels', match: isPortrait && isShort },
      { id: 'bilibili', name: 'Bilibili', match: !isPortrait },
    ];

    return platforms.map((p) => ({
      platformId: p.id,
      platformName: p.name,
      recommended: p.match,
      score: p.match ? 80 : 30,
      suggestions: p.match ? ['内容格式匹配该平台'] : ['建议调整画面方向或时长'],
      expectedPerformance: {
        viewsRange: p.match ? { min: 100, max: 10000 } : { min: 10, max: 1000 },
        engagementRate: p.match ? 0.05 : 0.02,
        growthPotential: p.match ? 'high' : 'low',
      },
    }));
  }

  private generateTimeSlots(
    platformId: DistributionPlatformId,
    _category?: string,
  ): TimeSlot[] {
    const baseSlots: Record<string, TimeSlot[]> = {
      'youtube-1080p': [
        { dayOfWeek: 6, hour: 15, score: 95, reason: '周六下午观看高峰', audienceActivity: 0.9 },
        { dayOfWeek: 0, hour: 14, score: 90, reason: '周日下午活跃', audienceActivity: 0.85 },
        { dayOfWeek: 5, hour: 18, score: 85, reason: '周五傍晚', audienceActivity: 0.8 },
      ],
      tiktok: [
        { dayOfWeek: 3, hour: 20, score: 95, reason: '周三晚间活跃高峰', audienceActivity: 0.95 },
        { dayOfWeek: 5, hour: 21, score: 90, reason: '周五晚间', audienceActivity: 0.9 },
        { dayOfWeek: 0, hour: 19, score: 85, reason: '周日晚间', audienceActivity: 0.85 },
      ],
      bilibili: [
        { dayOfWeek: 5, hour: 19, score: 95, reason: '周五晚间 B 站高峰', audienceActivity: 0.9 },
        { dayOfWeek: 6, hour: 20, score: 90, reason: '周六晚间', audienceActivity: 0.85 },
        { dayOfWeek: 0, hour: 18, score: 85, reason: '周日傍晚', audienceActivity: 0.8 },
      ],
    };

    return baseSlots[platformId] ?? [
      { dayOfWeek: 1, hour: 12, score: 70, reason: '默认推荐', audienceActivity: 0.6 },
    ];
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,，。.！!？?、]+/)
      .filter((w) => w.length >= 2)
      .slice(0, 10);
  }

  private detectCategory(keywords: string[]): string {
    const categories: Record<string, string[]> = {
      教程: ['教程', '教学', '入门', '学习', 'tutorial'],
      娱乐: ['搞笑', '有趣', '哈哈', 'funny', 'comedy'],
      科技: ['科技', '技术', '编程', 'code', 'tech'],
      美食: ['美食', '烹饪', '做饭', 'cook', 'food'],
      旅行: ['旅行', '旅游', '风景', 'travel'],
    };
    for (const [cat, words] of Object.entries(categories)) {
      if (keywords.some((k) => words.some((w) => k.includes(w)))) return cat;
    }
    return '其他';
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positive = ['好', '棒', '优秀', '推荐', '喜欢', 'amazing', 'great', 'love'];
    const negative = ['差', '烂', '难看', '糟糕', 'bad', 'terrible', 'hate'];
    const posCount = positive.filter((w) => text.includes(w)).length;
    const negCount = negative.filter((w) => text.includes(w)).length;
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

  private calculateTrend(records: PerformanceRecord[]): 'rising' | 'stable' | 'declining' {
    if (records.length < 2) return 'stable';
    const recent = records.slice(-7);
    const older = records.slice(-14, -7);
    if (older.length === 0) return 'stable';
    const recentAvg = recent.reduce((sum, r) => sum + r.views, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.views, 0) / older.length;
    const change = (recentAvg - olderAvg) / olderAvg;
    if (change > 0.1) return 'rising';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  private generateInsights(performance: PlatformPerformance[]): DistributionInsight[] {
    const insights: DistributionInsight[] = [];

    for (const p of performance) {
      if (p.trend === 'rising') {
        insights.push({
          type: 'success',
          title: `${p.platformName} 表现上升`,
          description: `${p.platformName} 的观看量持续增长，建议增加该平台的内容投入`,
          platformId: p.platformId,
          actionable: true,
          priority: 'high',
        });
      }
      if (p.engagementRate < 0.02) {
        insights.push({
          type: 'warning',
          title: `${p.platformName} 互动率偏低`,
          description: '互动率低于 2%，建议优化标题、封面或内容结构',
          platformId: p.platformId,
          actionable: true,
          priority: 'medium',
        });
      }
      if (p.retentionRate > 0.5) {
        insights.push({
          type: 'tip',
          title: `${p.platformName} 留存率优秀`,
          description: '观众留存率超过 50%，内容质量受到认可',
          platformId: p.platformId,
          actionable: false,
          priority: 'low',
        });
      }
    }

    return insights;
  }
}

// ─── Supporting Types ────────────────────────────────────────────

export interface PerformanceRecord {
  date: string;
  views: number;
  engagements: number;
  avgWatchTime: number;
  retentionRate: number;
  followerGrowth: number;
  revenue?: number;
}
