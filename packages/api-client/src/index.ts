/**
 * API Client for Open Factory platform
 */

// ============================================================
// Types
// ============================================================

export interface ApiClientConfig {
  baseUrl: string;
  token?: string;
  refreshToken?: string;
  onTokenRefresh?: (token: string) => void;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// Plugin types - matching @open-factory/plugin-market types
export interface PermissionGrant {
  readonly category: 'filesystem' | 'network' | 'process' | 'ui';
  readonly target: string;
  readonly operations: readonly string[];
}

export interface PermissionDeclaration {
  readonly required: readonly PermissionGrant[];
  readonly optional: readonly PermissionGrant[];
}

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly license: string;
  readonly homepage?: string;
  readonly repository?: string;
  readonly keywords: readonly string[];
  readonly category: string;
  readonly minHostVersion: string;
  readonly maxHostVersion?: string;
  readonly main: string;
  readonly permissions: PermissionDeclaration;
  readonly icon?: string;
  readonly screenshots?: readonly string[];
  readonly dependencies?: Readonly<Record<string, string>>;
}

export interface PluginStats {
  readonly pluginId: string;
  readonly downloads: number;
  readonly weeklyDownloads: number;
  readonly monthlyDownloads: number;
  readonly activeInstalls: number;
  readonly lastDownloadAt: string;
}

export interface PluginRatingSummary {
  readonly pluginId: string;
  readonly averageRating: number;
  readonly totalReviews: number;
  readonly distribution: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

export interface Plugin {
  readonly manifest: PluginManifest;
  readonly stats: PluginStats;
  readonly rating: PluginRatingSummary;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly verified: boolean;
  readonly deprecated: boolean;
  readonly deprecationMessage?: string;
}

export interface PluginSearchResult {
  readonly plugin: Plugin;
  readonly score: number;
  readonly matchedFields: readonly string[];
}

export interface PluginSearchResponse {
  readonly results: readonly PluginSearchResult[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface PluginDetail {
  readonly plugin: Plugin;
  readonly reviews: readonly PluginReview[];
  readonly versions: readonly PluginVersion[];
}

export interface PluginReview {
  readonly id: string;
  readonly pluginId: string;
  readonly userId: string;
  readonly userName: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly content: string;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly helpful: number;
  readonly reported: boolean;
}

export interface PluginVersion {
  readonly pluginId: string;
  readonly version: string;
  readonly changelog: string;
  readonly publishedAt: string;
  readonly checksum: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly minHostVersion: string;
  readonly maxHostVersion?: string;
}

// Creator types
export interface CreatorProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
  readonly avatar?: string;
  readonly bio?: string;
  readonly status: 'pending' | 'active' | 'suspended' | 'banned';
  readonly tier: 'starter' | 'advanced' | 'professional' | 'flagship';
  readonly totalRevenue: number;
  readonly monthlyRevenue: number;
  readonly commissionRate: number;
  readonly tags: readonly string[];
  readonly socialLinks: {
    readonly github?: string;
    readonly twitter?: string;
    readonly blog?: string;
    readonly weibo?: string;
    readonly zhihu?: string;
    readonly bilibili?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly verifiedAt?: string;
}

export interface CreatorStats {
  readonly totalRevenue: number;
  readonly monthlyRevenue: number;
  readonly totalDownloads: number;
  readonly monthlyDownloads: number;
  readonly totalPlugins: number;
  readonly activePlugins: number;
  readonly averageRating: number;
  readonly totalReviews: number;
}

export interface CreatorRevenue {
  readonly total: number;
  readonly monthly: number;
  readonly breakdown: readonly {
    readonly pluginId: string;
    readonly pluginName: string;
    readonly revenue: number;
    readonly downloads: number;
  }[];
}

export interface CreatorDashboardData {
  readonly profile: CreatorProfile;
  readonly stats: CreatorStats;
  readonly revenue: CreatorRevenue;
  readonly recentPlugins: readonly Plugin[];
  readonly notifications: readonly Notification[];
}

export interface Notification {
  readonly id: string;
  readonly type: 'info' | 'success' | 'warning' | 'error';
  readonly title: string;
  readonly message: string;
  readonly read: boolean;
  readonly createdAt: string;
}

// ============================================================
// API Client Class
// ============================================================

export class OpenFactoryApiClient {
  private config: ApiClientConfig;
  private token: string | null;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.token = config.token || null;
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.token = null;
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Copy headers from options
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  }

  // ============================================================
  // Plugin API
  // ============================================================

  /**
   * Search plugins
   */
  async searchPlugins(params: {
    keyword?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<PluginSearchResponse> {
    const searchParams = new URLSearchParams();

    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.category) searchParams.set('category', params.category);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const response = await this.request<PluginSearchResponse>(
      `/api/v1/plugins?${searchParams.toString()}`
    );

    return response.data!;
  }

  /**
   * Get plugin details
   */
  async getPlugin(id: string): Promise<PluginDetail> {
    const response = await this.request<PluginDetail>(`/api/v1/plugins/${id}`);
    return response.data!;
  }

  /**
   * Install plugin
   */
  async installPlugin(pluginId: string, version?: string): Promise<{
    success: boolean;
    pluginId: string;
    version: string;
    installPath: string;
  }> {
    const response = await this.request<{
      success: boolean;
      pluginId: string;
      version: string;
      installPath: string;
    }>(`/api/v1/plugins/${pluginId}/install`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    });

    return response.data!;
  }

  /**
   * Submit plugin review
   */
  async submitReview(
    pluginId: string,
    rating: number,
    title?: string,
    content?: string
  ): Promise<PluginReview> {
    const response = await this.request<PluginReview>(
      `/api/v1/plugins/${pluginId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ rating, title, content }),
      }
    );

    return response.data!;
  }

  // ============================================================
  // Creator API
  // ============================================================

  /**
   * Get current creator profile
   */
  async getMyProfile(): Promise<CreatorProfile> {
    const response = await this.request<CreatorProfile>('/api/v1/creators/me');
    return response.data!;
  }

  /**
   * Get current creator stats
   */
  async getMyStats(): Promise<CreatorStats> {
    const response = await this.request<CreatorStats>('/api/v1/creators/me/stats');
    return response.data!;
  }

  /**
   * Get current creator revenue
   */
  async getMyRevenue(): Promise<CreatorRevenue> {
    const response = await this.request<CreatorRevenue>('/api/v1/creators/me/revenue');
    return response.data!;
  }

  /**
   * Get full dashboard data
   */
  async getDashboard(): Promise<CreatorDashboardData> {
    const response = await this.request<CreatorDashboardData>(
      '/api/v1/creators/me/dashboard'
    );
    return response.data!;
  }

  /**
   * Update creator profile
   */
  async updateProfile(updates: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<CreatorProfile> {
    const response = await this.request<CreatorProfile>('/api/v1/creators/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return response.data!;
  }

  /**
   * Get creator by ID
   */
  async getCreator(id: string): Promise<CreatorProfile> {
    const response = await this.request<CreatorProfile>(`/api/v1/creators/${id}`);
    return response.data!;
  }

  /**
   * Get creator stats by ID
   */
  async getCreatorStats(id: string): Promise<CreatorStats> {
    const response = await this.request<CreatorStats>(`/api/v1/creators/${id}/stats`);
    return response.data!;
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createApiClient(config: ApiClientConfig): OpenFactoryApiClient {
  return new OpenFactoryApiClient(config);
}
