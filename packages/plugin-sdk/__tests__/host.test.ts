import { describe, expect, it, beforeEach } from 'vitest';
import { PluginHost } from '../src/host';

describe('PluginHost', () => {
  let host: PluginHost;

  beforeEach(() => {
    host = new PluginHost({ maxPlugins: 10 });
  });

  it('loads a plugin with sandbox', async () => {
    await host.loadPlugin('test-plugin', {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      permissions: ['read-project'],
    });

    expect(host.lifecycle.isLoaded('test-plugin')).toBe(true);
    expect(host.sandbox.getPolicy('test-plugin')).toBeDefined();
  });

  it('provides plugin API', async () => {
    await host.loadPlugin('test-plugin', {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      permissions: ['read-project'],
    });

    const api = host.getPluginApi('test-plugin');
    expect(api.editor).toBeDefined();
    expect(api.ai).toBeDefined();
    expect(api.ui).toBeDefined();
    expect(api.storage).toBeDefined();
    expect(api.network).toBeDefined();
  });

  it('unloads a plugin', async () => {
    await host.loadPlugin('test-plugin', {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
    });
    await host.unloadPlugin('test-plugin');
    expect(host.lifecycle.isLoaded('test-plugin')).toBe(false);
  });

  it('enforces max plugin limit', async () => {
    const smallHost = new PluginHost({ maxPlugins: 2 });
    await smallHost.loadPlugin('p1', { id: 'p1', name: 'P1', version: '1.0.0' });
    await smallHost.loadPlugin('p2', { id: 'p2', name: 'P2', version: '1.0.0' });
    await expect(
      smallHost.loadPlugin('p3', { id: 'p3', name: 'P3', version: '1.0.0' }),
    ).rejects.toThrow('Maximum plugin limit reached');
  });

  it('returns system status', async () => {
    await host.loadPlugin('test-plugin', {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
    });

    const status = host.getStatus();
    expect(status.loadedPlugins).toBe(1);
    expect(status.enabledPlugins).toBe(1);
  });

  it('installs from marketplace', async () => {
    host.marketplace.registerPlugin({
      id: 'market-plugin',
      name: 'Market Plugin',
      version: '1.0.0',
      description: 'From marketplace',
      author: 'Author',
      category: 'effect',
      tags: ['test'],
      downloads: 100,
      rating: 4.5,
      ratingCount: 10,
      publishedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    await host.installPlugin('market-plugin');
    expect(host.marketplace.isInstalled('market-plugin')).toBe(true);
    expect(host.lifecycle.isLoaded('market-plugin')).toBe(true);
  });

  it('unloads and uninstalls a plugin', async () => {
    host.marketplace.registerPlugin({
      id: 'market-plugin',
      name: 'Market Plugin',
      version: '1.0.0',
      description: 'From marketplace',
      author: 'Author',
      category: 'effect',
      tags: ['test'],
      downloads: 100,
      rating: 4.5,
      ratingCount: 10,
      publishedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    await host.installPlugin('market-plugin');
    await host.unloadPlugin('market-plugin', true);
    expect(host.marketplace.isInstalled('market-plugin')).toBe(false);
  });
});
