import { describe, it, expect } from 'vitest';
import { mockPlugins, mockCategories, mockFeatured, mockReviews } from '@/lib/mock-data';

describe('mock data', () => {
  it('has at least 10 plugins', () => {
    expect(mockPlugins.length).toBeGreaterThanOrEqual(10);
  });

  it('all plugins have required manifest fields', () => {
    for (const plugin of mockPlugins) {
      expect(plugin.manifest.id).toBeTruthy();
      expect(plugin.manifest.name).toBeTruthy();
      expect(plugin.manifest.description).toBeTruthy();
      expect(plugin.manifest.author).toBeTruthy();
      expect(plugin.manifest.version).toBeTruthy();
      expect(plugin.manifest.category).toBeTruthy();
    }
  });

  it('all plugins have valid stats', () => {
    for (const plugin of mockPlugins) {
      expect(plugin.stats.downloads).toBeGreaterThanOrEqual(0);
      expect(plugin.stats.weeklyDownloads).toBeGreaterThanOrEqual(0);
      expect(plugin.stats.activeInstalls).toBeGreaterThanOrEqual(0);
    }
  });

  it('all plugins have valid ratings', () => {
    for (const plugin of mockPlugins) {
      expect(plugin.rating.averageRating).toBeGreaterThanOrEqual(0);
      expect(plugin.rating.averageRating).toBeLessThanOrEqual(5);
      expect(plugin.rating.totalReviews).toBeGreaterThanOrEqual(0);
    }
  });

  it('categories include all plugin categories', () => {
    const categoryIds = mockCategories.map((c) => c.id);
    expect(categoryIds).toContain('all');
    expect(categoryIds).toContain('effect');
    expect(categoryIds).toContain('transition');
    expect(categoryIds).toContain('generator');
  });

  it('featured plugins are a subset of all plugins', () => {
    for (const featured of mockFeatured) {
      expect(mockPlugins).toContainEqual(featured);
    }
  });

  it('reviews have valid structure', () => {
    for (const review of mockReviews) {
      expect(review.id).toBeTruthy();
      expect(review.pluginId).toBeTruthy();
      expect(review.userName).toBeTruthy();
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it('plugins have unique IDs', () => {
    const ids = mockPlugins.map((p) => p.manifest.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
