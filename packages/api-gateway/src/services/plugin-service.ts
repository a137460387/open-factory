/**
 * Plugin service - business logic for plugin management
 */

import type {
  Plugin,
  PluginManifest,
  PluginSearchQuery,
  PluginSearchResponse,
  PluginSearchResult,
  PluginReview,
  PluginVersion,
  PluginInstallResult,
} from '../types.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';

// ============================================================
// Mock Data (replace with database in production)
// ============================================================

const mockPlugins: Plugin[] = [
  {
    manifest: {
      id: 'color-correction',
      name: 'Color Correction Pro',
      description: 'Professional color correction tools for video editing',
      version: '1.2.0',
      author: 'Open Factory Team',
      license: 'MIT',
      category: 'effect',
      keywords: ['color', 'correction', 'grading', 'professional'],
      homepage: 'https://github.com/open-factory/color-correction',
      minHostVersion: '4.0.0',
      main: 'index.js',
      permissions: {
        required: [],
        optional: [],
      },
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
  {
    manifest: {
      id: 'motion-graphics',
      name: 'Motion Graphics Pack',
      description: 'Animated titles, transitions, and lower thirds',
      version: '2.0.1',
      author: 'Creative Studio',
      license: 'MIT',
      category: 'generator',
      keywords: ['motion', 'graphics', 'animation', 'titles'],
      minHostVersion: '4.0.0',
      main: 'index.js',
      permissions: {
        required: [],
        optional: [],
      },
    },
    stats: {
      pluginId: 'motion-graphics',
      downloads: 28950,
      weeklyDownloads: 1560,
      monthlyDownloads: 6240,
      activeInstalls: 5600,
      lastDownloadAt: '2024-07-15T12:00:00Z',
    },
    rating: {
      pluginId: 'motion-graphics',
      averageRating: 4.9,
      totalReviews: 512,
      distribution: { 5: 450, 4: 48, 3: 10, 2: 3, 1: 1 },
    },
    publishedAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-07-01T00:00:00Z',
    verified: true,
    deprecated: false,
  },
  {
    manifest: {
      id: 'audio-mixer',
      name: 'Advanced Audio Mixer',
      description: 'Multi-track audio mixing with effects and EQ',
      version: '1.5.0',
      author: 'Audio Pro',
      license: 'MIT',
      category: 'tool',
      keywords: ['audio', 'mixer', 'effects', 'eq'],
      minHostVersion: '4.0.0',
      main: 'index.js',
      permissions: {
        required: [],
        optional: [],
      },
    },
    stats: {
      pluginId: 'audio-mixer',
      downloads: 9870,
      weeklyDownloads: 450,
      monthlyDownloads: 1800,
      activeInstalls: 1800,
      lastDownloadAt: '2024-07-14T15:00:00Z',
    },
    rating: {
      pluginId: 'audio-mixer',
      averageRating: 4.5,
      totalReviews: 128,
      distribution: { 5: 85, 4: 30, 3: 8, 2: 3, 1: 2 },
    },
    publishedAt: '2024-03-10T00:00:00Z',
    updatedAt: '2024-06-28T00:00:00Z',
    verified: true,
    deprecated: false,
  },
];

const mockReviews: PluginReview[] = [
  {
    id: 'review-001',
    pluginId: 'color-correction',
    userId: 'user-100',
    userName: 'VideoEditor42',
    rating: 5,
    title: 'Best color correction tool!',
    content: 'This plugin has transformed my workflow. The color wheels are intuitive and the results are professional.',
    version: '1.2.0',
    createdAt: '2024-05-15T00:00:00Z',
    updatedAt: '2024-05-15T00:00:00Z',
    helpful: 42,
    reported: false,
  },
  {
    id: 'review-002',
    pluginId: 'color-correction',
    userId: 'user-101',
    userName: 'Filmmaker_Pro',
    rating: 4,
    title: 'Great but could use more presets',
    content: 'Excellent tool overall. Would love to see more built-in presets for common looks.',
    version: '1.2.0',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    helpful: 15,
    reported: false,
  },
];

const mockVersions: PluginVersion[] = [
  {
    pluginId: 'color-correction',
    version: '1.2.0',
    changelog: 'Added new color wheel UI, performance improvements',
    publishedAt: '2024-06-20T00:00:00Z',
    checksum: 'sha256:abc123...',
    dependencies: {},
    minHostVersion: '4.0.0',
  },
  {
    pluginId: 'color-correction',
    version: '1.1.0',
    changelog: 'Added LUT support, bug fixes',
    publishedAt: '2024-04-15T00:00:00Z',
    checksum: 'sha256:def456...',
    dependencies: {},
    minHostVersion: '4.0.0',
  },
];

// ============================================================
// Plugin Service
// ============================================================

export class PluginService {
  /**
   * Search plugins with filtering, sorting, and pagination
   */
  async searchPlugins(query: PluginSearchQuery): Promise<PluginSearchResponse> {
    const {
      keyword,
      category,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 12,
    } = query;

    let filtered = [...mockPlugins];

    // Filter by keyword
    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.manifest.name.toLowerCase().includes(lower) ||
          p.manifest.description.toLowerCase().includes(lower) ||
          p.manifest.keywords.some((k) => k.toLowerCase().includes(lower))
      );
    }

    // Filter by category
    if (category) {
      filtered = filtered.filter((p) => p.manifest.category === category);
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'downloads':
          cmp = a.stats.downloads - b.stats.downloads;
          break;
        case 'rating':
          cmp = a.rating.averageRating - b.rating.averageRating;
          break;
        case 'updated':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'created':
          cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
          break;
        case 'name':
          cmp = a.manifest.name.localeCompare(b.manifest.name);
          break;
        default:
          cmp = a.stats.downloads - b.stats.downloads;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    const results: PluginSearchResult[] = paged.map((plugin) => ({
      plugin,
      score: 1,
      matchedFields: keyword ? ['name', 'description'] : [],
    }));

    return {
      results,
      total,
      page,
      limit,
      hasMore: start + limit < total,
    };
  }

  /**
   * Get plugin by ID
   */
  async getPluginById(id: string): Promise<{
    plugin: Plugin;
    reviews: PluginReview[];
    versions: PluginVersion[];
  }> {
    const plugin = mockPlugins.find((p) => p.manifest.id === id);

    if (!plugin) {
      throw new NotFoundError('Plugin', id);
    }

    const reviews = mockReviews.filter((r) => r.pluginId === id);
    const versions = mockVersions.filter((v) => v.pluginId === id);

    return { plugin, reviews, versions };
  }

  /**
   * Install a plugin
   */
  async installPlugin(
    pluginId: string,
    userId: string,
    version?: string
  ): Promise<PluginInstallResult> {
    const plugin = mockPlugins.find((p) => p.manifest.id === pluginId);

    if (!plugin) {
      throw new NotFoundError('Plugin', pluginId);
    }

    const targetVersion = version || plugin.manifest.version;

    return {
      success: true,
      pluginId,
      version: targetVersion,
      installPath: `~/.open-factory/plugins/${pluginId}`,
    };
  }

  /**
   * Submit a review for a plugin
   */
  async submitReview(
    pluginId: string,
    userId: string,
    rating: number,
    title?: string,
    content?: string
  ): Promise<PluginReview> {
    const plugin = mockPlugins.find((p) => p.manifest.id === pluginId);

    if (!plugin) {
      throw new NotFoundError('Plugin', pluginId);
    }

    if (rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    const review: PluginReview = {
      id: `review-${Date.now()}`,
      pluginId,
      userId,
      userName: 'Anonymous',
      rating: rating as 1 | 2 | 3 | 4 | 5,
      title: title || '',
      content: content || '',
      version: plugin.manifest.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      helpful: 0,
      reported: false,
    };

    mockReviews.push(review);

    return review;
  }

  /**
   * Create a new plugin (creator only)
   */
  async createPlugin(
    manifest: Omit<PluginManifest, 'minHostVersion' | 'main' | 'permissions'>,
    authorId: string
  ): Promise<Plugin> {
    const existing = mockPlugins.find((p) => p.manifest.id === manifest.id);

    if (existing) {
      throw new ConflictError(`Plugin with id ${manifest.id} already exists`);
    }

    const fullManifest: PluginManifest = {
      ...manifest,
      minHostVersion: '4.0.0',
      main: 'index.js',
      permissions: {
        required: [],
        optional: [],
      },
    };

    const plugin: Plugin = {
      manifest: fullManifest,
      stats: {
        pluginId: manifest.id,
        downloads: 0,
        weeklyDownloads: 0,
        monthlyDownloads: 0,
        activeInstalls: 0,
        lastDownloadAt: new Date().toISOString(),
      },
      rating: {
        pluginId: manifest.id,
        averageRating: 0,
        totalReviews: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verified: false,
      deprecated: false,
    };

    mockPlugins.push(plugin);

    return plugin;
  }
}

// Singleton instance
export const pluginService = new PluginService();
