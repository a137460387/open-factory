/**
 * Analytics Service - Data analysis module for creator dashboard
 *
 * Provides download metrics, active user analytics, rating trends,
 * and revenue breakdown functionality.
 */

import type {
  Analytics,
  DownloadMetrics,
  UserMetrics,
  RatingMetrics,
  RevenueMetrics,
  DailyDataPoint,
  RetentionData,
  SourceData,
  RatingDistribution,
  RatingTrend,
  RevenueTrend,
  TimeRange,
  ApiResponse
} from './types';

/**
 * Analytics service for processing and calculating creator metrics
 */
export class AnalyticsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Get complete analytics overview for a creator
   */
  async getAnalytics(creatorId: string, timeRange?: TimeRange): Promise<ApiResponse<Analytics>> {
    try {
      const [downloads, users, ratings, revenue] = await Promise.all([
        this.getDownloadMetrics(creatorId, timeRange),
        this.getUserMetrics(creatorId, timeRange),
        this.getRatingMetrics(creatorId, timeRange),
        this.getRevenueMetrics(creatorId, timeRange)
      ]);

      if (!downloads.success || !users.success || !ratings.success || !revenue.success) {
        return {
          success: false,
          error: 'Failed to fetch analytics data'
        };
      }

      return {
        success: true,
        data: {
          downloads: downloads.data!,
          users: users.data!,
          ratings: ratings.data!,
          revenue: revenue.data!
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get download metrics for a creator
   */
  async getDownloadMetrics(creatorId: string, timeRange?: TimeRange): Promise<ApiResponse<DownloadMetrics>> {
    try {
      const params = this.buildTimeRangeParams(timeRange);
      const response = await this.fetch<DownloadMetrics>(
        `/api/v1/creator/${creatorId}/analytics/downloads${params}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch download metrics'
      };
    }
  }

  /**
   * Get user activity metrics
   */
  async getUserMetrics(creatorId: string, timeRange?: TimeRange): Promise<ApiResponse<UserMetrics>> {
    try {
      const params = this.buildTimeRangeParams(timeRange);
      const response = await this.fetch<UserMetrics>(
        `/api/v1/creator/${creatorId}/analytics/users${params}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user metrics'
      };
    }
  }

  /**
   * Get rating metrics and trends
   */
  async getRatingMetrics(creatorId: string, timeRange?: TimeRange): Promise<ApiResponse<RatingMetrics>> {
    try {
      const params = this.buildTimeRangeParams(timeRange);
      const response = await this.fetch<RatingMetrics>(
        `/api/v1/creator/${creatorId}/analytics/ratings${params}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rating metrics'
      };
    }
  }

  /**
   * Get revenue metrics and trends
   */
  async getRevenueMetrics(creatorId: string, timeRange?: TimeRange): Promise<ApiResponse<RevenueMetrics>> {
    try {
      const params = this.buildTimeRangeParams(timeRange);
      const response = await this.fetch<RevenueMetrics>(
        `/api/v1/creator/${creatorId}/analytics/revenue${params}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch revenue metrics'
      };
    }
  }

  /**
   * Calculate download growth rate
   */
  calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }

  /**
   * Calculate average daily downloads from trend data
   */
  calculateDailyAverage(trend: DailyDataPoint[]): number {
    if (trend.length === 0) return 0;
    const total = trend.reduce((sum, point) => sum + point.value, 0);
    return Math.round((total / trend.length) * 100) / 100;
  }

  /**
   * Calculate retention rate
   */
  calculateRetentionRate(
    initialUsers: number,
    retainedUsers: number
  ): number {
    if (initialUsers === 0) return 0;
    return Math.round((retainedUsers / initialUsers) * 100 * 100) / 100;
  }

  /**
   * Calculate weighted rating average
   */
  calculateWeightedRating(distribution: RatingDistribution): number {
    const total = distribution[1] + distribution[2] + distribution[3] + distribution[4] + distribution[5];
    if (total === 0) return 0;

    const weightedSum =
      distribution[1] * 1 +
      distribution[2] * 2 +
      distribution[3] * 3 +
      distribution[4] * 4 +
      distribution[5] * 5;

    return Math.round((weightedSum / total) * 100) / 100;
  }

  /**
   * Calculate rating distribution percentages
   */
  calculateRatingPercentages(distribution: RatingDistribution): Record<number, number> {
    const total = distribution[1] + distribution[2] + distribution[3] + distribution[4] + distribution[5];
    if (total === 0) {
      return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }

    return {
      1: Math.round((distribution[1] / total) * 100 * 100) / 100,
      2: Math.round((distribution[2] / total) * 100 * 100) / 100,
      3: Math.round((distribution[3] / total) * 100 * 100) / 100,
      4: Math.round((distribution[4] / total) * 100 * 100) / 100,
      5: Math.round((distribution[5] / total) * 100 * 100) / 100
    };
  }

  /**
   * Aggregate revenue trends by period
   */
  aggregateRevenueByPeriod(
    trends: RevenueTrend[],
    period: 'day' | 'week' | 'month'
  ): RevenueTrend[] {
    if (period === 'day') return trends;

    const grouped = new Map<string, RevenueTrend[]>();

    for (const trend of trends) {
      const date = new Date(trend.date);
      let key: string;

      if (period === 'week') {
        const weekStart = this.getWeekStart(date);
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const group = grouped.get(key) || [];
      group.push(trend);
      grouped.set(key, group);
    }

    return Array.from(grouped.entries()).map(([date, items]) => ({
      date,
      sales: items.reduce((sum, item) => sum + item.sales, 0),
      bonus: items.reduce((sum, item) => sum + item.bonus, 0),
      refund: items.reduce((sum, item) => sum + item.refund, 0),
      net: items.reduce((sum, item) => sum + item.net, 0)
    }));
  }

  /**
   * Calculate DAU/WAU/MAU ratio
   */
  calculateEngagementRatio(dau: number, wau: number, mau: number): {
    dauWauRatio: number;
    dauMauRatio: number;
    wauMauRatio: number;
  } {
    return {
      dauWauRatio: wau > 0 ? Math.round((dau / wau) * 100 * 100) / 100 : 0,
      dauMauRatio: mau > 0 ? Math.round((dau / mau) * 100 * 100) / 100 : 0,
      wauMauRatio: mau > 0 ? Math.round((wau / mau) * 100 * 100) / 100 : 0
    };
  }

  /**
   * Identify top performing products
   */
  identifyTopProducts<T extends { downloads: number; rating: number; revenue?: number }>(
    products: T[],
    sortBy: 'downloads' | 'rating' | 'revenue',
    limit: number = 10
  ): T[] {
    return [...products]
      .sort((a, b) => {
        if (sortBy === 'revenue') {
          return (b.revenue || 0) - (a.revenue || 0);
        }
        return b[sortBy] - a[sortBy];
      })
      .slice(0, limit);
  }

  /**
   * Calculate trend direction
   */
  calculateTrendDirection(trend: DailyDataPoint[]): 'up' | 'down' | 'stable' {
    if (trend.length < 2) return 'stable';

    const recent = trend.slice(-7);
    const previous = trend.slice(-14, -7);

    if (recent.length === 0 || previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + p.value, 0) / previous.length;

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  /**
   * Generate mock data for testing
   */
  generateMockAnalytics(): Analytics {
    const now = new Date();
    const trend: DailyDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      value: Math.floor(Math.random() * 1000) + 100,
      uniqueUsers: Math.floor(Math.random() * 500) + 50
    }));

    const revenueTrend: RevenueTrend[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      sales: Math.floor(Math.random() * 10000) + 1000,
      bonus: Math.floor(Math.random() * 1000),
      refund: Math.floor(Math.random() * 500),
      net: Math.floor(Math.random() * 10000) + 500
    }));

    return {
      downloads: {
        daily: 156,
        total: 45678,
        dailyAverage: 142,
        growthRate: 12.5,
        trend
      },
      users: {
        dau: 890,
        wau: 3456,
        mau: 12345,
        retention: {
          day1: 65.5,
          day7: 42.3,
          day30: 28.7,
          curve: [100, 65.5, 55.2, 48.7, 44.1, 40.8, 38.2, 36.1, 34.5, 33.2, 32.1, 31.2, 30.5, 29.9, 29.4, 28.9, 28.5, 28.2, 27.9, 27.6, 27.4, 27.2, 27.0, 26.8, 26.6, 26.4, 26.2, 26.0, 25.8, 25.6, 25.4]
        },
        sources: [
          { source: 'Direct', users: 4500, percentage: 36.5, conversionRate: 8.2 },
          { source: 'Search', users: 3200, percentage: 25.9, conversionRate: 6.5 },
          { source: 'Social', users: 2800, percentage: 22.7, conversionRate: 4.8 },
          { source: 'Referral', users: 1845, percentage: 14.9, conversionRate: 12.3 }
        ]
      },
      ratings: {
        overall: 4.5,
        totalCount: 2345,
        distribution: {
          1: 45,
          2: 89,
          3: 234,
          4: 678,
          5: 1299
        },
        trend: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          average: 4.3 + Math.random() * 0.4,
          count: Math.floor(Math.random() * 50) + 10
        })),
        rank: 15
      },
      revenue: {
        today: 1234.56,
        thisMonth: 34567.89,
        total: 567890.12,
        pending: 5678.90,
        withdrawn: 456789.00,
        trend: revenueTrend
      }
    };
  }

  /**
   * Fetch data from API
   */
  private async fetch<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data as T
    };
  }

  /**
   * Build time range query parameters
   */
  private buildTimeRangeParams(timeRange?: TimeRange): string {
    if (!timeRange) return '';
    const params = new URLSearchParams({
      startDate: timeRange.startDate.toISOString(),
      endDate: timeRange.endDate.toISOString()
    });
    return `?${params.toString()}`;
  }

  /**
   * Get start of week for a date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
