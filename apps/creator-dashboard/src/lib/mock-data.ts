import type {
  Creator,
  Analytics,
  Revenue,
  WithdrawalRequest,
  Plugin,
  DailyDataPoint,
  RevenueTrend,
  SourceData,
  RatingDistribution,
} from '@open-factory/creator-dashboard';

/** Generate mock daily trend data for the past N days */
function generateTrend(days: number, baseValue: number, variance: number): DailyDataPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() - (days - 1 - i) * 86400000);
    return {
      date: date.toISOString().split('T')[0],
      value: Math.round(baseValue + (Math.random() - 0.3) * variance),
    };
  });
}

/** Generate mock revenue trend data */
function generateRevenueTrend(days: number): RevenueTrend[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() - (days - 1 - i) * 86400000);
    const sales = Math.round(8000 + Math.random() * 6000);
    const bonus = Math.round(Math.random() * 1500);
    const refund = Math.round(Math.random() * 800);
    return {
      date: date.toISOString().split('T')[0],
      sales,
      bonus,
      refund,
      net: sales + bonus - refund,
    };
  });
}

export const mockCreator: Creator = {
  id: 'creator-001',
  userId: 'user-001',
  displayName: 'PixelForge',
  email: 'pixelforge@example.com',
  avatar: undefined,
  bio: 'Full-stack developer building tools for creators. Passionate about open source and video editing innovation.',
  status: 'active',
  tier: 'professional',
  totalRevenue: 128500,
  monthlyRevenue: 18650,
  commissionRate: 0.80,
  tags: ['video-editing', 'ai-tools', 'open-source'],
  socialLinks: {
    github: 'https://github.com/pixelforge',
    twitter: 'https://twitter.com/pixelforge',
    blog: 'https://pixelforge.dev',
  },
  createdAt: new Date('2024-06-15'),
  updatedAt: new Date('2026-07-20'),
  verifiedAt: new Date('2024-07-01'),
};

export const mockAnalytics: Analytics = {
  downloads: {
    daily: 342,
    total: 87654,
    dailyAverage: 298,
    growthRate: 14.2,
    trend: generateTrend(30, 300, 150),
  },
  users: {
    dau: 2340,
    wau: 8920,
    mau: 24500,
    retention: {
      day1: 68.5,
      day7: 45.2,
      day30: 31.8,
      curve: [100, 68.5, 55.2, 48.7, 44.1, 40.8, 38.2, 36.1, 34.5, 33.2, 32.1, 31.2, 30.5, 29.9, 29.4, 28.9, 28.5, 28.2, 27.9, 27.6, 27.4, 27.2, 27.0, 26.8, 26.6, 26.4, 26.2, 26.0, 25.8, 25.6, 25.4],
    },
    sources: [
      { source: 'Direct', users: 8200, percentage: 33.5, conversionRate: 9.1 },
      { source: 'Search', users: 6800, percentage: 27.8, conversionRate: 7.2 },
      { source: 'Social', users: 5400, percentage: 22.0, conversionRate: 5.5 },
      { source: 'Referral', users: 4100, percentage: 16.7, conversionRate: 13.8 },
    ],
  },
  ratings: {
    overall: 4.6,
    totalCount: 3420,
    distribution: { 1: 52, 2: 98, 3: 310, 4: 890, 5: 2070 },
    trend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      average: 4.4 + Math.random() * 0.3,
      count: Math.round(30 + Math.random() * 40),
    })),
    rank: 8,
  },
  revenue: {
    today: 2156.8,
    thisMonth: 18650.45,
    total: 128500,
    pending: 3420.6,
    withdrawn: 112000,
    trend: generateRevenueTrend(30),
  },
};

const mockSourceData: SourceData[] = [
  { source: 'Direct', users: 8200, percentage: 33.5, conversionRate: 9.1 },
  { source: 'Search', users: 6800, percentage: 27.8, conversionRate: 7.2 },
  { source: 'Social', users: 5400, percentage: 22.0, conversionRate: 5.5 },
  { source: 'Referral', users: 4100, percentage: 16.7, conversionRate: 13.8 },
];

export const mockSources = mockSourceData;

export const mockRatingDistribution: RatingDistribution = { 1: 52, 2: 98, 3: 310, 4: 890, 5: 2070 };

export const mockPlugins: Plugin[] = [
  {
    id: 'plugin-001',
    creatorId: 'creator-001',
    name: 'SmartCut Pro',
    slug: 'smartcut-pro',
    description: 'AI-powered smart video cutting tool with scene detection',
    version: '2.3.1',
    status: 'published',
    category: 'ai',
    price: 29.9,
    downloads: 34200,
    rating: 4.7,
    ratingCount: 1280,
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2026-07-15'),
    publishedAt: new Date('2024-09-01'),
  },
  {
    id: 'plugin-002',
    creatorId: 'creator-001',
    name: 'ColorMood',
    slug: 'colormood',
    description: 'Intelligent color grading based on video mood analysis',
    version: '1.8.0',
    status: 'published',
    category: 'design',
    price: 19.9,
    downloads: 28500,
    rating: 4.5,
    ratingCount: 890,
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2026-06-20'),
    publishedAt: new Date('2025-02-15'),
  },
  {
    id: 'plugin-003',
    creatorId: 'creator-001',
    name: 'SubtitleSync',
    slug: 'subtitlesync',
    description: 'Auto-generate and sync subtitles with whisper integration',
    version: '3.1.0',
    status: 'published',
    category: 'productivity',
    price: 0,
    downloads: 45100,
    rating: 4.8,
    ratingCount: 2150,
    createdAt: new Date('2024-11-20'),
    updatedAt: new Date('2026-07-10'),
    publishedAt: new Date('2025-01-05'),
  },
  {
    id: 'plugin-004',
    creatorId: 'creator-001',
    name: 'AudioDenoise',
    slug: 'audiodenoise',
    description: 'Real-time audio noise reduction powered by AI',
    version: '1.2.0',
    status: 'review',
    category: 'ai',
    price: 14.9,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-18'),
  },
];

export const mockTransactions: Revenue[] = Array.from({ length: 20 }, (_, i) => ({
  id: `rev-${String(i + 1).padStart(3, '0')}`,
  creatorId: 'creator-001',
  type: (['sales', 'sales', 'sales', 'bonus', 'refund'] as const)[i % 5],
  amount: [29.9, 19.9, 0, 50, 19.9][i % 5],
  commissionRate: 0.8,
  netAmount: [23.92, 15.92, 0, 50, -15.92][i % 5],
  productName: ['SmartCut Pro', 'ColorMood', 'SubtitleSync', 'Bonus', 'Refund'][i % 5],
  orderId: `ORD-${20260720 - i}-${String(1000 + i).slice(1)}`,
  createdAt: new Date(Date.now() - i * 86400000 * (1 + Math.random())),
}));

export const mockWithdrawals: WithdrawalRequest[] = [
  {
    id: 'wd-001',
    creatorId: 'creator-001',
    amount: 5000,
    method: 'alipay',
    accountInfo: 'pixelforge@example.com',
    status: 'completed',
    createdAt: new Date('2026-07-01'),
    processedAt: new Date('2026-07-02'),
    completedAt: new Date('2026-07-03'),
  },
  {
    id: 'wd-002',
    creatorId: 'creator-001',
    amount: 8000,
    method: 'bank',
    accountInfo: '**** **** **** 5678',
    status: 'completed',
    createdAt: new Date('2026-06-15'),
    processedAt: new Date('2026-06-16'),
    completedAt: new Date('2026-06-17'),
  },
  {
    id: 'wd-003',
    creatorId: 'creator-001',
    amount: 3000,
    method: 'wechat',
    accountInfo: 'pixelforge_wx',
    status: 'processing',
    createdAt: new Date('2026-07-18'),
    processedAt: new Date('2026-07-19'),
  },
  {
    id: 'wd-004',
    creatorId: 'creator-001',
    amount: 2000,
    method: 'alipay',
    accountInfo: 'pixelforge@example.com',
    status: 'pending',
    createdAt: new Date('2026-07-20'),
  },
];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

export const mockAchievements: Achievement[] = [
  { id: 'a1', title: 'First Upload', description: 'Publish your first plugin', icon: 'rocket', unlocked: true },
  { id: 'a2', title: '1K Downloads', description: 'Reach 1,000 total downloads', icon: 'download', unlocked: true },
  { id: 'a3', title: 'Rising Star', description: 'Get 100 five-star ratings', icon: 'star', unlocked: true },
  { id: 'a4', title: 'Revenue Milestone', description: 'Earn $10,000 in revenue', icon: 'trophy', unlocked: true, progress: 100, maxProgress: 100 },
  { id: 'a5', title: 'Community Leader', description: 'Reach 50,000 downloads', icon: 'crown', unlocked: true },
  { id: 'a6', title: 'Open Source Hero', description: 'Publish 5 free plugins', icon: 'heart', unlocked: false, progress: 3, maxProgress: 5 },
  { id: 'a7', title: 'Global Reach', description: 'Get users from 50+ countries', icon: 'globe', unlocked: false, progress: 38, maxProgress: 50 },
  { id: 'a8', title: 'Diamond Creator', description: 'Reach flagship tier', icon: 'diamond', unlocked: false, progress: 68, maxProgress: 100 },
];

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'success',
    title: 'Withdrawal Completed',
    message: 'Your withdrawal of 5,000 CNY has been processed to Alipay.',
    time: new Date(Date.now() - 3600000),
    read: false,
  },
  {
    id: 'n2',
    type: 'info',
    title: 'Plugin Review Update',
    message: 'AudioDenoise has entered the review queue. Expected review time: 2-3 days.',
    time: new Date(Date.now() - 7200000),
    read: false,
  },
  {
    id: 'n3',
    type: 'warning',
    title: 'Rating Alert',
    message: 'SmartCut Pro received a 1-star review. Consider responding to user feedback.',
    time: new Date(Date.now() - 86400000),
    read: true,
  },
  {
    id: 'n4',
    type: 'info',
    title: 'New Milestone',
    message: 'SubtitleSync reached 45,000 downloads! Keep up the great work.',
    time: new Date(Date.now() - 172800000),
    read: true,
  },
  {
    id: 'n5',
    type: 'success',
    title: 'Tier Upgrade',
    message: 'Congratulations! You have been promoted to Professional tier.',
    time: new Date(Date.now() - 604800000),
    read: true,
  },
];
