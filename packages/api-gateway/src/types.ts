/**
 * API Gateway type definitions
 */

// ============================================================
// User & Auth Types
// ============================================================

export type UserRole = 'admin' | 'creator' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

// ============================================================
// Plugin Types
// ============================================================

export type PluginCategory =
  | 'effect'
  | 'transition'
  | 'generator'
  | 'analyzer'
  | 'exporter'
  | 'importer'
  | 'tool'
  | 'workflow'
  | 'theme'
  | 'other';

export type PluginStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export type PluginSortField =
  | 'relevance'
  | 'downloads'
  | 'rating'
  | 'updated'
  | 'created'
  | 'name';

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
  readonly category: PluginCategory;
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

// ============================================================
// Creator Types
// ============================================================

export type CreatorLevel = 1 | 2 | 3 | 4 | 5;

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
// API Request/Response Types
// ============================================================

export interface PaginationParams {
  page: number;
  limit: number;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================
// Plugin Search Types
// ============================================================

export interface PluginSearchQuery {
  keyword?: string;
  category?: PluginCategory;
  sortBy?: PluginSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
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

// ============================================================
// Plugin Install Types
// ============================================================

export interface PluginInstallRequest {
  pluginId: string;
  version?: string;
}

export interface PluginInstallResult {
  success: boolean;
  pluginId: string;
  version: string;
  installPath: string;
  error?: string;
}

// ============================================================
// Permission Types
// ============================================================

export interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete' | '*';
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: '*', action: '*' },
  ],
  creator: [
    { resource: 'plugins', action: 'read' },
    { resource: 'plugins', action: 'write' },
    { resource: 'creators', action: 'read' },
    { resource: 'creators', action: 'write' },
    { resource: 'projects', action: 'read' },
    { resource: 'projects', action: 'write' },
  ],
  user: [
    { resource: 'plugins', action: 'read' },
    { resource: 'creators', action: 'read' },
    { resource: 'projects', action: 'read' },
  ],
};
