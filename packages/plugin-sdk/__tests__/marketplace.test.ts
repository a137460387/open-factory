import { describe, expect, it, beforeEach } from 'vitest';
import { PluginMarketplace, type MarketplacePlugin } from '../src/marketplace';

function makePlugin(overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    category: 'effect',
    tags: ['test', 'effect'],
    downloads: 100,
    rating: 4.5,
    ratingCount: 10,
    publishedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PluginMarketplace', () => {
  let marketplace: PluginMarketplace;

  beforeEach(() => {
    marketplace = new PluginMarketplace();
  });

  it('registers a plugin', () => {
    marketplace.registerPlugin(makePlugin());
    expect(marketplace.getPlugin('test-plugin')).toBeDefined();
  });

  it('searches plugins by query', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', name: 'Blur Effect', tags: ['blur'] }));
    marketplace.registerPlugin(makePlugin({ id: 'b', name: 'Color Grading', tags: ['color'] }));

    const result = marketplace.search({ query: 'blur' });
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0].name).toBe('Blur Effect');
  });

  it('filters by category', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', category: 'effect' }));
    marketplace.registerPlugin(makePlugin({ id: 'b', category: 'template' }));

    const result = marketplace.search({ category: 'effect' });
    expect(result.plugins).toHaveLength(1);
  });

  it('sorts by downloads', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', downloads: 50 }));
    marketplace.registerPlugin(makePlugin({ id: 'b', downloads: 200 }));

    const result = marketplace.search({ sortBy: 'downloads' });
    expect(result.plugins[0].id).toBe('b');
  });

  it('sorts by rating', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', rating: 3.0 }));
    marketplace.registerPlugin(makePlugin({ id: 'b', rating: 5.0 }));

    const result = marketplace.search({ sortBy: 'rating' });
    expect(result.plugins[0].id).toBe('b');
  });

  it('paginates results', () => {
    for (let i = 0; i < 25; i++) {
      marketplace.registerPlugin(makePlugin({ id: `plugin-${i}`, name: `Plugin ${i}` }));
    }

    const page1 = marketplace.search({ page: 1, pageSize: 10 });
    expect(page1.plugins).toHaveLength(10);
    expect(page1.total).toBe(25);

    const page3 = marketplace.search({ page: 3, pageSize: 10 });
    expect(page3.plugins).toHaveLength(5);
  });

  it('installs a plugin', () => {
    marketplace.registerPlugin(makePlugin());
    const record = marketplace.install('test-plugin');
    expect(record.pluginId).toBe('test-plugin');
    expect(record.enabled).toBe(true);
    expect(marketplace.isInstalled('test-plugin')).toBe(true);
    expect(marketplace.getPlugin('test-plugin')!.downloads).toBe(101);
  });

  it('uninstalls a plugin', () => {
    marketplace.registerPlugin(makePlugin());
    marketplace.install('test-plugin');
    marketplace.uninstall('test-plugin');
    expect(marketplace.isInstalled('test-plugin')).toBe(false);
  });

  it('checks for updates', () => {
    marketplace.registerPlugin(makePlugin({ version: '1.0.0' }));
    marketplace.install('test-plugin');
    // Update the registered plugin to a newer version
    marketplace.registerPlugin(makePlugin({ version: '2.0.0' }));
    const updates = marketplace.checkUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].latestVersion).toBe('2.0.0');
  });

  it('updates a plugin', () => {
    marketplace.registerPlugin(makePlugin({ version: '2.0.0' }));
    marketplace.install('test-plugin');
    const record = marketplace.update('test-plugin');
    expect(record.version).toBe('2.0.0');
  });

  it('toggles enabled state', () => {
    marketplace.registerPlugin(makePlugin());
    marketplace.install('test-plugin');
    expect(marketplace.toggleEnabled('test-plugin')).toBe(false);
    expect(marketplace.toggleEnabled('test-plugin')).toBe(true);
  });

  it('adds and retrieves reviews', () => {
    marketplace.registerPlugin(makePlugin());
    const review = marketplace.addReview({
      pluginId: 'test-plugin',
      userId: 'user-1',
      userName: 'Test User',
      rating: 5,
      title: 'Great!',
      comment: 'Works perfectly',
    });
    expect(review.id).toBeDefined();

    const reviews = marketplace.getReviews('test-plugin');
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(5);
  });

  it('recalculates rating after reviews', () => {
    marketplace.registerPlugin(makePlugin({ rating: 0, ratingCount: 0 }));
    marketplace.addReview({
      pluginId: 'test-plugin',
      userId: 'u1',
      userName: 'User 1',
      rating: 4,
      title: 'Good',
      comment: 'Nice',
    });
    marketplace.addReview({
      pluginId: 'test-plugin',
      userId: 'u2',
      userName: 'User 2',
      rating: 5,
      title: 'Excellent',
      comment: 'Perfect',
    });

    const plugin = marketplace.getPlugin('test-plugin')!;
    expect(plugin.rating).toBe(4.5);
    expect(plugin.ratingCount).toBe(2);
  });

  it('gets popular plugins', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', downloads: 50, category: 'effect' }));
    marketplace.registerPlugin(makePlugin({ id: 'b', downloads: 200, category: 'effect' }));
    marketplace.registerPlugin(makePlugin({ id: 'c', downloads: 100, category: 'template' }));

    const popular = marketplace.getPopular('effect');
    expect(popular).toHaveLength(2);
    expect(popular[0].id).toBe('b');
  });

  it('gets featured plugins', () => {
    marketplace.registerPlugin(makePlugin({ id: 'a', rating: 5.0, downloads: 1000 }));
    marketplace.registerPlugin(makePlugin({ id: 'b', rating: 3.0, downloads: 50 }));

    const featured = marketplace.getFeatured();
    expect(featured[0].id).toBe('a');
  });
});
