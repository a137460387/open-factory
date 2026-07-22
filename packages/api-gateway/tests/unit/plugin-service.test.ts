/**
 * Plugin service tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginService } from '../../src/services/plugin-service.js';
import { NotFoundError, ValidationError, ConflictError } from '../../src/utils/errors.js';

describe('PluginService', () => {
  let service: PluginService;

  beforeEach(() => {
    service = new PluginService();
  });

  describe('searchPlugins', () => {
    it('should return all plugins when no filters applied', async () => {
      const result = await service.searchPlugins({});

      expect(result.results).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
    });

    it('should filter plugins by keyword', async () => {
      const result = await service.searchPlugins({ keyword: 'color' });

      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach((r) => {
        const plugin = r.plugin;
        const matches =
          plugin.manifest.name.toLowerCase().includes('color') ||
          plugin.manifest.description.toLowerCase().includes('color') ||
          plugin.manifest.keywords.some((k) => k.toLowerCase().includes('color'));
        expect(matches).toBe(true);
      });
    });

    it('should filter plugins by category', async () => {
      const result = await service.searchPlugins({ category: 'effect' });

      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach((r) => {
        expect(r.plugin.manifest.category).toBe('effect');
      });
    });

    it('should sort plugins by downloads', async () => {
      const result = await service.searchPlugins({
        sortBy: 'downloads',
        sortOrder: 'desc',
      });

      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].plugin.stats.downloads).toBeGreaterThanOrEqual(
          result.results[i].plugin.stats.downloads
        );
      }
    });

    it('should paginate results', async () => {
      const page1 = await service.searchPlugins({ page: 1, limit: 2 });
      const page2 = await service.searchPlugins({ page: 2, limit: 2 });

      expect(page1.results.length).toBeLessThanOrEqual(2);
      expect(page2.results.length).toBeLessThanOrEqual(2);

      // Ensure different plugins on different pages
      const page1Ids = page1.results.map((r) => r.plugin.manifest.id);
      const page2Ids = page2.results.map((r) => r.plugin.manifest.id);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection.length).toBe(0);
    });
  });

  describe('getPluginById', () => {
    it('should return plugin with reviews and versions', async () => {
      const result = await service.getPluginById('color-correction');

      expect(result.plugin).toBeDefined();
      expect(result.plugin.manifest.id).toBe('color-correction');
      expect(result.reviews).toBeDefined();
      expect(result.versions).toBeDefined();
    });

    it('should throw NotFoundError for non-existent plugin', async () => {
      await expect(service.getPluginById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const result = await service.installPlugin('color-correction', 'user-100');

      expect(result.success).toBe(true);
      expect(result.pluginId).toBe('color-correction');
      expect(result.version).toBeDefined();
      expect(result.installPath).toBeDefined();
    });

    it('should install specific version', async () => {
      const result = await service.installPlugin('color-correction', 'user-100', '1.1.0');

      expect(result.success).toBe(true);
      expect(result.version).toBe('1.1.0');
    });

    it('should throw NotFoundError for non-existent plugin', async () => {
      await expect(service.installPlugin('non-existent', 'user-100')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('submitReview', () => {
    it('should submit review successfully', async () => {
      const review = await service.submitReview(
        'motion-graphics',
        'user-200',
        5,
        'Great plugin!',
        'Really useful for my projects.'
      );

      expect(review.id).toBeDefined();
      expect(review.pluginId).toBe('motion-graphics');
      expect(review.userId).toBe('user-200');
      expect(review.rating).toBe(5);
      expect(review.title).toBe('Great plugin!');
    });

    it('should throw ValidationError for invalid rating', async () => {
      await expect(
        service.submitReview('motion-graphics', 'user-200', 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        service.submitReview('motion-graphics', 'user-200', 6)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent plugin', async () => {
      await expect(
        service.submitReview('non-existent', 'user-200', 5)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createPlugin', () => {
    it('should create plugin successfully', async () => {
      const manifest = {
        id: 'new-plugin',
        name: 'New Plugin',
        description: 'A brand new plugin',
        version: '1.0.0',
        author: 'Test User',
        category: 'tool' as const,
        keywords: ['test', 'new'],
        engines: { openFactory: '>=4.0.0' },
      };

      const plugin = await service.createPlugin(manifest, 'user-300');

      expect(plugin.manifest.id).toBe('new-plugin');
      expect(plugin.manifest.name).toBe('New Plugin');
      expect(plugin.verified).toBe(false);
      expect(plugin.deprecated).toBe(false);
    });

    it('should throw ConflictError for duplicate plugin ID', async () => {
      const manifest = {
        id: 'color-correction', // Already exists
        name: 'Duplicate Plugin',
        description: 'This will fail',
        version: '1.0.0',
        author: 'Test User',
        category: 'tool' as const,
        keywords: [],
        engines: { openFactory: '>=4.0.0' },
      };

      await expect(service.createPlugin(manifest, 'user-300')).rejects.toThrow(ConflictError);
    });
  });
});
