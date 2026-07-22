/**
 * Creator service - business logic for creator management
 */

import type {
  CreatorProfile,
  CreatorStats,
  CreatorRevenue,
  CreatorDashboardData,
  Plugin,
  Notification,
} from '../types.js';
import { NotFoundError } from '../utils/errors.js';

// ============================================================
// Mock Data
// ============================================================

const mockCreators: CreatorProfile[] = [
  {
    id: 'creator-001',
    userId: 'user-001',
    displayName: 'Open Factory Team',
    email: 'team@openfactory.dev',
    avatar: 'https://avatars.openfactory.dev/team.png',
    bio: 'Official Open Factory plugin developer',
    status: 'active',
    tier: 'flagship',
    totalRevenue: 7800,
    monthlyRevenue: 780,
    commissionRate: 0.3,
    tags: ['official', 'color', 'effects'],
    socialLinks: {
      github: 'https://github.com/open-factory',
      twitter: 'https://twitter.com/openfactory',
    },
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2024-07-15T00:00:00Z',
    verifiedAt: '2023-06-15T00:00:00Z',
  },
  {
    id: 'creator-002',
    userId: 'user-002',
    displayName: 'Creative Studio',
    email: 'hello@creativestudio.com',
    avatar: 'https://avatars.openfactory.dev/creative.png',
    bio: 'Professional motion graphics and effects',
    status: 'active',
    tier: 'professional',
    totalRevenue: 4450,
    monthlyRevenue: 445,
    commissionRate: 0.3,
    tags: ['motion', 'graphics', 'animation'],
    socialLinks: {
      github: 'https://github.com/creativestudio',
    },
    createdAt: '2023-09-15T00:00:00Z',
    updatedAt: '2024-07-10T00:00:00Z',
    verifiedAt: '2023-10-01T00:00:00Z',
  },
  {
    id: 'creator-003',
    userId: 'user-003',
    displayName: 'Audio Pro',
    email: 'contact@audiopro.dev',
    avatar: 'https://avatars.openfactory.dev/audio.png',
    bio: 'Audio processing and mixing specialist',
    status: 'active',
    tier: 'advanced',
    totalRevenue: 2250,
    monthlyRevenue: 225,
    commissionRate: 0.3,
    tags: ['audio', 'mixing', 'effects'],
    socialLinks: {},
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-07-05T00:00:00Z',
    verifiedAt: '2024-02-01T00:00:00Z',
  },
];

const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    type: 'success',
    title: 'Plugin Approved',
    message: 'Your plugin "Color Correction Pro" has been approved!',
    read: false,
    createdAt: '2024-07-15T00:00:00Z',
  },
  {
    id: 'notif-002',
    type: 'info',
    title: 'New Review',
    message: 'You received a 5-star review on "Motion Graphics Pack"',
    read: false,
    createdAt: '2024-07-14T00:00:00Z',
  },
  {
    id: 'notif-003',
    type: 'warning',
    title: 'Revenue Payout',
    message: 'Your monthly revenue payout of $1,234.56 has been processed',
    read: true,
    createdAt: '2024-07-01T00:00:00Z',
  },
];

// ============================================================
// Creator Service
// ============================================================

export class CreatorService {
  /**
   * Get creator profile by user ID
   */
  async getCreatorByUserId(userId: string): Promise<CreatorProfile> {
    const creator = mockCreators.find((c) => c.userId === userId);

    if (!creator) {
      throw new NotFoundError('Creator', userId);
    }

    return creator;
  }

  /**
   * Get creator profile by creator ID
   */
  async getCreatorById(creatorId: string): Promise<CreatorProfile> {
    const creator = mockCreators.find((c) => c.id === creatorId);

    if (!creator) {
      throw new NotFoundError('Creator', creatorId);
    }

    return creator;
  }

  /**
   * Get creator statistics
   */
  async getCreatorStats(creatorId: string): Promise<CreatorStats> {
    const creator = await this.getCreatorById(creatorId);

    return {
      totalRevenue: creator.totalRevenue,
      monthlyRevenue: creator.monthlyRevenue,
      totalDownloads: 156000,
      monthlyDownloads: 15600,
      totalPlugins: 12,
      activePlugins: 11,
      averageRating: 4.8,
      totalReviews: 885,
    };
  }

  /**
   * Get creator revenue breakdown
   */
  async getCreatorRevenue(creatorId: string): Promise<CreatorRevenue> {
    const stats = await this.getCreatorStats(creatorId);

    return {
      total: stats.totalRevenue,
      monthly: stats.monthlyRevenue,
      breakdown: [
        {
          pluginId: 'color-correction',
          pluginName: 'Color Correction Pro',
          revenue: stats.monthlyRevenue * 0.4,
          downloads: 3560,
        },
        {
          pluginId: 'motion-graphics',
          pluginName: 'Motion Graphics Pack',
          revenue: stats.monthlyRevenue * 0.35,
          downloads: 6240,
        },
        {
          pluginId: 'audio-mixer',
          pluginName: 'Advanced Audio Mixer',
          revenue: stats.monthlyRevenue * 0.25,
          downloads: 1800,
        },
      ],
    };
  }

  /**
   * Get full dashboard data
   */
  async getDashboardData(userId: string): Promise<CreatorDashboardData> {
    const creator = await this.getCreatorByUserId(userId);
    const stats = await this.getCreatorStats(creator.id);
    const revenue = await this.getCreatorRevenue(creator.id);

    const recentPlugins: Plugin[] = [
      {
        manifest: {
          id: 'color-correction',
          name: 'Color Correction Pro',
          description: 'Professional color correction tools',
          version: '1.2.0',
          author: creator.displayName,
          license: 'MIT',
          category: 'effect',
          keywords: ['color', 'correction'],
          minHostVersion: '4.0.0',
          main: 'index.js',
          permissions: { required: [], optional: [] },
        },
        stats: {
          pluginId: 'color-correction',
          downloads: 15420,
          weeklyDownloads: 890,
          monthlyDownloads: 3560,
          activeInstalls: 3200,
          lastDownloadAt: '2024-07-15T10:30:00Z',
        },
        rating: {
          pluginId: 'color-correction',
          averageRating: 4.7,
          totalReviews: 245,
          distribution: { 5: 180, 4: 45, 3: 15, 2: 3, 1: 2 },
        },
        publishedAt: '2024-01-20T00:00:00Z',
        updatedAt: '2024-06-20T00:00:00Z',
        verified: true,
        deprecated: false,
      },
    ];

    return {
      profile: creator,
      stats,
      revenue,
      recentPlugins,
      notifications: mockNotifications,
    };
  }

  /**
   * Update creator profile
   */
  async updateCreatorProfile(
    userId: string,
    updates: Partial<Pick<CreatorProfile, 'displayName' | 'bio' | 'avatar'>>
  ): Promise<CreatorProfile> {
    const creator = await this.getCreatorByUserId(userId);

    const updatedCreator: CreatorProfile = {
      ...creator,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const index = mockCreators.findIndex((c) => c.userId === userId);
    if (index !== -1) {
      mockCreators[index] = updatedCreator;
    }

    return updatedCreator;
  }
}

// Singleton instance
export const creatorService = new CreatorService();
