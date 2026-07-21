/**
 * Creator Profile - Creator profile management module
 *
 * Provides functionality for managing creator profiles, verification,
 * and program participation.
 */

import type {
  Creator,
  CreatorStatus,
  CreatorTier,
  SocialLinks,
  ApiResponse
} from './types';

/**
 * Creator profile management service
 */
export class CreatorDashboard {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Get creator profile by ID
   */
  async getProfile(creatorId: string): Promise<ApiResponse<Creator>> {
    try {
      const response = await this.fetch<Creator>(
        `/api/v1/creator/${creatorId}`
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch creator profile'
      };
    }
  }

  /**
   * Update creator profile
   */
  async updateProfile(
    creatorId: string,
    updates: Partial<Pick<Creator, 'displayName' | 'bio' | 'avatar' | 'tags' | 'socialLinks'>>
  ): Promise<ApiResponse<Creator>> {
    try {
      const response = await this.fetch<Creator>(
        `/api/v1/creator/${creatorId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates)
        }
      );
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update creator profile'
      };
    }
  }

  /**
   * Update social links
   */
  async updateSocialLinks(
    creatorId: string,
    socialLinks: Partial<SocialLinks>
  ): Promise<ApiResponse<Creator>> {
    return this.updateProfile(creatorId, { socialLinks });
  }

  /**
   * Update creator tags
   */
  async updateTags(
    creatorId: string,
    tags: string[]
  ): Promise<ApiResponse<Creator>> {
    if (tags.length > 5) {
      return {
        success: false,
        error: '最多只能设置 5 个标签'
      };
    }
    return this.updateProfile(creatorId, { tags });
  }

  /**
   * Validate display name
   */
  validateDisplayName(name: string): { valid: boolean; error?: string } {
    if (name.length < 2) {
      return { valid: false, error: '昵称至少 2 个字符' };
    }
    if (name.length > 30) {
      return { valid: false, error: '昵称最多 30 个字符' };
    }
    if (!/^[\w\u4e00-\u9fa5\s-]+$/.test(name)) {
      return { valid: false, error: '昵称只能包含字母、数字、中文、空格和连字符' };
    }
    return { valid: true };
  }

  /**
   * Validate bio
   */
  validateBio(bio: string): { valid: boolean; error?: string } {
    if (bio.length > 500) {
      return { valid: false, error: '个人简介最多 500 个字符' };
    }
    return { valid: true };
  }

  /**
   * Validate tags
   */
  validateTags(tags: string[]): { valid: boolean; error?: string } {
    if (tags.length > 5) {
      return { valid: false, error: '最多只能设置 5 个标签' };
    }
    for (const tag of tags) {
      if (tag.length > 20) {
        return { valid: false, error: '每个标签最多 20 个字符' };
      }
    }
    return { valid: true };
  }

  /**
   * Validate social links
   */
  validateSocialLinks(links: SocialLinks): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const urlPattern = /^https?:\/\/.+/;

    if (links.github && !urlPattern.test(links.github)) {
      errors.push('GitHub 链接格式不正确');
    }
    if (links.twitter && !urlPattern.test(links.twitter)) {
      errors.push('Twitter 链接格式不正确');
    }
    if (links.blog && !urlPattern.test(links.blog)) {
      errors.push('博客链接格式不正确');
    }
    if (links.weibo && !urlPattern.test(links.weibo)) {
      errors.push('微博链接格式不正确');
    }
    if (links.zhihu && !urlPattern.test(links.zhihu)) {
      errors.push('知乎链接格式不正确');
    }
    if (links.bilibili && !urlPattern.test(links.bilibili)) {
      errors.push('B站链接格式不正确');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get creator tier display info
   */
  getTierDisplayInfo(tier: CreatorTier): {
    name: string;
    icon: string;
    color: string;
    commissionRate: number;
  } {
    const tierInfo: Record<CreatorTier, { name: string; icon: string; color: string; commissionRate: number }> = {
      starter: {
        name: '入门创作者',
        icon: 'seedling',
        color: '#6b7280',
        commissionRate: 0.70
      },
      advanced: {
        name: '进阶创作者',
        icon: 'star',
        color: '#3b82f6',
        commissionRate: 0.75
      },
      professional: {
        name: '专业创作者',
        icon: 'crown',
        color: '#8b5cf6',
        commissionRate: 0.80
      },
      flagship: {
        name: '旗舰创作者',
        icon: 'diamond',
        color: '#f59e0b',
        commissionRate: 0.85
      }
    };

    return tierInfo[tier];
  }

  /**
   * Calculate creator level progress
   */
  calculateLevelProgress(
    currentTier: CreatorTier,
    totalRevenue: number
  ): {
    currentTier: CreatorTier;
    nextTier: CreatorTier | null;
    progress: number;
    revenueNeeded: number;
  } {
    const tiers: CreatorTier[] = ['starter', 'advanced', 'professional', 'flagship'];
    const thresholds = [0, 1001, 10001, 50001];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === tiers.length - 1) {
      return {
        currentTier,
        nextTier: null,
        progress: 100,
        revenueNeeded: 0
      };
    }

    const nextTier = tiers[currentIndex + 1];
    const currentThreshold = thresholds[currentIndex];
    const nextThreshold = thresholds[currentIndex + 1];
    const range = nextThreshold - currentThreshold;
    const progress = Math.min(100, ((totalRevenue - currentThreshold) / range) * 100);
    const revenueNeeded = Math.max(0, nextThreshold - totalRevenue);

    return {
      currentTier,
      nextTier,
      progress: Math.round(progress * 100) / 100,
      revenueNeeded
    };
  }

  /**
   * Get creator status display info
   */
  getStatusDisplayInfo(status: CreatorStatus): {
    label: string;
    color: string;
    description: string;
  } {
    const statusInfo: Record<CreatorStatus, { label: string; color: string; description: string }> = {
      pending: {
        label: '待审核',
        color: '#f59e0b',
        description: '您的创作者申请正在审核中'
      },
      active: {
        label: '正常',
        color: '#10b981',
        description: '您的创作者账号状态正常'
      },
      suspended: {
        label: '已暂停',
        color: '#ef4444',
        description: '您的创作者账号已被暂停'
      },
      banned: {
        label: '已封禁',
        color: '#6b7280',
        description: '您的创作者账号已被封禁'
      }
    };

    return statusInfo[status];
  }

  /**
   * Check if creator can perform actions
   */
  canPerformAction(status: CreatorStatus, action: 'publish' | 'withdraw' | 'edit'): boolean {
    if (status === 'banned') return false;
    if (status === 'suspended' && action !== 'edit') return false;
    if (status === 'pending' && action === 'publish') return false;
    return true;
  }

  /**
   * Get creator program benefits
   */
  getProgramBenefits(tier: CreatorTier): string[] {
    const baseBenefits = [
      '专属创作者后台',
      '收益统计功能',
      '基础创作工具',
      '创作者社区访问'
    ];

    const tierBenefits: Record<CreatorTier, string[]> = {
      starter: [],
      advanced: ['流量扶持', '优先审核'],
      professional: ['流量扶持', '优先审核', '专属客服', '新功能内测'],
      flagship: ['流量扶持', '优先审核', '专属客服', '新功能内测', '定制合作', '首页推荐']
    };

    return [...baseBenefits, ...tierBenefits[tier]];
  }

  /**
   * Format creator join date
   */
  formatJoinDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天加入';
    if (days === 1) return '昨天加入';
    if (days < 30) return `${days} 天前加入`;
    if (days < 365) return `${Math.floor(days / 30)} 个月前加入`;
    return `${Math.floor(days / 365)} 年前加入`;
  }

  /**
   * Generate creator profile summary
   */
  generateProfileSummary(creator: Creator): string {
    const tierInfo = this.getTierDisplayInfo(creator.tier);
    const joinDate = this.formatJoinDate(creator.createdAt);

    return `${creator.displayName} | ${tierInfo.name} | ${joinDate} | 累计收入 ¥${creator.totalRevenue.toLocaleString()}`;
  }

  /**
   * Fetch data from API
   */
  private async fetch<T>(
    endpoint: string,
    options?: { method?: string; body?: string }
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: options?.body
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
}
