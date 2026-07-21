/**
 * Creator Dashboard - Main Entry Point
 *
 * Provides analytics, revenue management, and creator profile functionality
 * for the Open Factory Creator Program.
 */

export { CreatorDashboard } from './creator-profile';
export { AnalyticsService } from './analytics';
export { RevenueService } from './revenue';

export type {
  Creator,
  CreatorStatus,
  CreatorTier,
  Plugin,
  PluginStatus,
  PluginCategory,
  Workflow,
  WorkflowStatus,
  Analytics,
  DownloadMetrics,
  UserMetrics,
  RatingMetrics,
  RevenueMetrics,
  Revenue,
  RevenueType,
  BillItem,
  WithdrawalRequest,
  WithdrawalStatus,
  DailyDataPoint,
  RetentionData,
  SourceData,
  RatingDistribution,
  RatingTrend,
  RevenueTrend,
  ApiResponse,
  PaginatedResponse,
  TimeRange
} from './types';
