/**
 * Plugin Marketplace
 *
 * Manages plugin discovery, installation, updates, and ratings.
 * Provides a registry-based marketplace with search and filtering.
 */

// ─── Marketplace Types ────────────────────────────────────────────

export type PluginCategory =
  | 'ai-model'
  | 'effect'
  | 'template'
  | 'transition'
  | 'export'
  | 'utility'
  | 'integration'
  | 'theme';

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  tags: string[];
  icon?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  publishedAt: string;
  updatedAt: string;
  minAppVersion?: string;
  screenshots?: string[];
  changelog?: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  helpful: number;
}

export interface InstallRecord {
  pluginId: string;
  version: string;
  installedAt: string;
  updatedAt: string;
  enabled: boolean;
  autoUpdate: boolean;
}

export interface MarketplaceSearchQuery {
  query?: string;
  category?: PluginCategory;
  tags?: string[];
  sortBy?: 'downloads' | 'rating' | 'newest' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface MarketplaceSearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Marketplace Implementation ────────────────────────────────────────────

export class PluginMarketplace {
  private plugins = new Map<string, MarketplacePlugin>();
  private reviews = new Map<string, PluginReview[]>();
  private installed = new Map<string, InstallRecord>();

  /** Register a plugin in the marketplace */
  registerPlugin(plugin: MarketplacePlugin): void {
    this.plugins.set(plugin.id, { ...plugin });
  }

  /** Search plugins with filtering and sorting */
  search(query: MarketplaceSearchQuery): MarketplaceSearchResult {
    let results = Array.from(this.plugins.values());

    // Text search
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (query.category) {
      results = results.filter((p) => p.category === query.category);
    }

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      results = results.filter((p) => query.tags!.some((t) => p.tags.includes(t)));
    }

    // Sort
    const sortBy = query.sortBy ?? 'downloads';
    results.sort((a, b) => {
      switch (sortBy) {
        case 'downloads':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    // Pagination
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = results.slice(start, start + pageSize);

    return {
      plugins: paged,
      total: results.length,
      page,
      pageSize,
    };
  }

  /** Get a plugin by ID */
  getPlugin(pluginId: string): MarketplacePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /** Install a plugin */
  install(pluginId: string, version?: string): InstallRecord {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    const record: InstallRecord = {
      pluginId,
      version: version ?? plugin.version,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
      autoUpdate: true,
    };
    this.installed.set(pluginId, record);

    // Increment download count
    plugin.downloads += 1;

    return { ...record };
  }

  /** Uninstall a plugin */
  uninstall(pluginId: string): void {
    if (!this.installed.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }
    this.installed.delete(pluginId);
  }

  /** Check for updates */
  checkUpdates(): { pluginId: string; currentVersion: string; latestVersion: string }[] {
    const updates: { pluginId: string; currentVersion: string; latestVersion: string }[] = [];
    for (const [pluginId, record] of this.installed) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.version !== record.version) {
        updates.push({
          pluginId,
          currentVersion: record.version,
          latestVersion: plugin.version,
        });
      }
    }
    return updates;
  }

  /** Update a plugin to latest version */
  update(pluginId: string): InstallRecord {
    const record = this.installed.get(pluginId);
    if (!record) throw new Error(`Plugin ${pluginId} is not installed`);

    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    record.version = plugin.version;
    record.updatedAt = new Date().toISOString();
    return { ...record };
  }

  /** Toggle plugin enabled state */
  toggleEnabled(pluginId: string): boolean {
    const record = this.installed.get(pluginId);
    if (!record) throw new Error(`Plugin ${pluginId} is not installed`);
    record.enabled = !record.enabled;
    return record.enabled;
  }

  /** Add a review */
  addReview(review: Omit<PluginReview, 'id' | 'createdAt' | 'helpful'>): PluginReview {
    const plugin = this.plugins.get(review.pluginId);
    if (!plugin) throw new Error(`Plugin ${review.pluginId} not found`);

    const newReview: PluginReview = {
      ...review,
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    const reviews = this.reviews.get(review.pluginId) ?? [];
    reviews.push(newReview);
    this.reviews.set(review.pluginId, reviews);

    // Recalculate rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    plugin.rating = totalRating / reviews.length;
    plugin.ratingCount = reviews.length;

    return newReview;
  }

  /** Get reviews for a plugin */
  getReviews(pluginId: string): PluginReview[] {
    return this.reviews.get(pluginId) ?? [];
  }

  /** Get installed plugins */
  getInstalled(): InstallRecord[] {
    return Array.from(this.installed.values());
  }

  /** Check if a plugin is installed */
  isInstalled(pluginId: string): boolean {
    return this.installed.has(pluginId);
  }

  /** Get popular plugins by category */
  getPopular(category?: PluginCategory, limit = 10): MarketplacePlugin[] {
    let plugins = Array.from(this.plugins.values());
    if (category) {
      plugins = plugins.filter((p) => p.category === category);
    }
    return plugins.sort((a, b) => b.downloads - a.downloads).slice(0, limit);
  }

  /** Get featured plugins */
  getFeatured(limit = 6): MarketplacePlugin[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => b.rating * b.downloads - a.rating * a.downloads)
      .slice(0, limit);
  }
}
