/**
 * Type definitions for Creator Dashboard
 */

/** Creator status enum */
export type CreatorStatus = 'pending' | 'active' | 'suspended' | 'banned';

/** Creator tier based on cumulative revenue */
export type CreatorTier = 'starter' | 'advanced' | 'professional' | 'flagship';

/** Plugin status enum */
export type PluginStatus = 'draft' | 'review' | 'published' | 'rejected' | 'archived';

/** Plugin category enum */
export type PluginCategory =
  | 'productivity'
  | 'development'
  | 'design'
  | 'data'
  | 'ai'
  | 'integration'
  | 'utility'
  | 'other';

/** Workflow status enum */
export type WorkflowStatus = 'draft' | 'published' | 'archived';

/** Revenue type enum */
export type RevenueType = 'sales' | 'bonus' | 'refund' | 'penalty';

/** Withdrawal status enum */
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Creator profile */
export interface Creator {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: CreatorStatus;
  tier: CreatorTier;
  totalRevenue: number;
  monthlyRevenue: number;
  commissionRate: number;
  tags: string[];
  socialLinks: SocialLinks;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
}

/** Social media links */
export interface SocialLinks {
  github?: string;
  twitter?: string;
  blog?: string;
  weibo?: string;
  zhihu?: string;
  bilibili?: string;
}

/** Plugin metadata */
export interface Plugin {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  status: PluginStatus;
  category: PluginCategory;
  price: number;
  downloads: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

/** Workflow metadata */
export interface Workflow {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  price: number;
  downloads: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

/** Analytics overview */
export interface Analytics {
  downloads: DownloadMetrics;
  users: UserMetrics;
  ratings: RatingMetrics;
  revenue: RevenueMetrics;
}

/** Download metrics */
export interface DownloadMetrics {
  daily: number;
  total: number;
  dailyAverage: number;
  growthRate: number;
  trend: DailyDataPoint[];
}

/** Daily data point for trends */
export interface DailyDataPoint {
  date: string;
  value: number;
  uniqueUsers?: number;
}

/** User activity metrics */
export interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  retention: RetentionData;
  sources: SourceData[];
}

/** Retention data */
export interface RetentionData {
  day1: number;
  day7: number;
  day30: number;
  curve: number[];
}

/** User source data */
export interface SourceData {
  source: string;
  users: number;
  percentage: number;
  conversionRate: number;
}

/** Rating metrics */
export interface RatingMetrics {
  overall: number;
  totalCount: number;
  distribution: RatingDistribution;
  trend: RatingTrend[];
  rank: number;
}

/** Rating distribution (1-5 stars) */
export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/** Rating trend data point */
export interface RatingTrend {
  date: string;
  average: number;
  count: number;
}

/** Revenue metrics */
export interface RevenueMetrics {
  today: number;
  thisMonth: number;
  total: number;
  pending: number;
  withdrawn: number;
  trend: RevenueTrend[];
}

/** Revenue trend data point */
export interface RevenueTrend {
  date: string;
  sales: number;
  bonus: number;
  refund: number;
  net: number;
}

/** Revenue record */
export interface Revenue {
  id: string;
  creatorId: string;
  type: RevenueType;
  amount: number;
  commissionRate: number;
  netAmount: number;
  productName: string;
  orderId: string;
  createdAt: Date;
}

/** Bill item for monthly statement */
export interface BillItem {
  id: string;
  date: string;
  type: RevenueType;
  amount: number;
  description: string;
  productName?: string;
  orderId?: string;
}

/** Withdrawal request */
export interface WithdrawalRequest {
  id: string;
  creatorId: string;
  amount: number;
  method: 'alipay' | 'wechat' | 'bank' | 'paypal';
  accountInfo: string;
  status: WithdrawalStatus;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
}

/** Time range for queries */
export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Commission tier configuration */
export interface CommissionTier {
  tier: CreatorTier;
  minRevenue: number;
  maxRevenue: number | null;
  commissionRate: number;
  description: string;
}

/** Creator program configuration */
export interface CreatorProgramConfig {
  tiers: CommissionTier[];
  minimumWithdrawal: number;
  paymentMethods: string[];
  bonusRules: BonusRule[];
}

/** Bonus rule configuration */
export interface BonusRule {
  id: string;
  name: string;
  description: string;
  type: 'first_month' | 'quarterly' | 'annual' | 'quality';
  condition: BonusCondition;
  reward: BonusReward;
}

/** Bonus condition */
export interface BonusCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
}

/** Bonus reward */
export interface BonusReward {
  type: 'fixed' | 'percentage';
  value: number;
  maxValue?: number;
}
