import { describe, expect, it, vi } from 'vitest';
import { compareSemver, getCatalogEntryInstallState, loadPluginCatalog, parsePluginCatalogJson, type PluginCatalogEntry } from './plugin-market';
import type { PluginRegistry } from './plugin-manager';

describe('plugin market', () => {
  it('parses catalog JSON and drops invalid permissions', () => {
    const entries = parsePluginCatalogJson(
      JSON.stringify({
        plugins: [
          {
            id: 'open-factory.clean-cuts',
            name: 'Clean Cuts',
            author: 'Open Factory',
            version: '1.2.3',
            description: 'Adds export checks.',
            permissions: ['export-hook', 'network' as never],
            downloadUrl: '/plugins/clean-cuts.js'
          },
          { id: 'missing-required-fields' }
        ]
      })
    );

    expect(entries).toEqual([
      {
        id: 'open-factory.clean-cuts',
        name: 'Clean Cuts',
        author: 'Open Factory',
        version: '1.2.3',
        description: 'Adds export checks.',
        permissions: ['export-hook'],
        downloadUrl: '/plugins/clean-cuts.js'
      }
    ]);
  });

  it('compares semver versions numerically', () => {
    expect(compareSemver('1.10.0', '1.2.0')).toBe(1);
    expect(compareSemver('2.0.0', '2.0.1')).toBe(-1);
    expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(0);
  });

  it('falls back to cached catalog when fetching fails', async () => {
    const cached = JSON.stringify({ plugins: [catalogEntry({ id: 'cached.plugin' })] });
    const result = await loadPluginCatalog({
      fetcher: vi.fn(async () => {
        throw new Error('offline');
      }),
      readCache: async () => cached,
      writeCache: async () => undefined
    });

    expect(result.source).toBe('cache');
    expect(result.entries[0].id).toBe('cached.plugin');
  });

  it('detects installed plugins and available updates', () => {
    const registry: PluginRegistry = {
      errors: [],
      plugins: [
        {
          sourcePath: 'C:/Plugins/e2e.js',
          plugin: { id: 'market.plugin', name: 'Market Plugin', version: '1.0.0', description: '', permissions: ['export-hook'], hooks: {} },
          runtime: { plugin: { id: 'market.plugin', name: 'Market Plugin', version: '1.0.0', description: '', permissions: ['export-hook'], hooks: {} }, invokeHook: async () => undefined, dispose: () => undefined },
          errors: [],
          builtin: false,
          enabled: true
        }
      ]
    };

    expect(getCatalogEntryInstallState(catalogEntry({ id: 'market.plugin', version: '1.0.0' }), registry)).toEqual({
      status: 'installed',
      installedVersion: '1.0.0'
    });
    expect(getCatalogEntryInstallState(catalogEntry({ id: 'market.plugin', version: '1.1.0' }), registry)).toEqual({
      status: 'update-available',
      installedVersion: '1.0.0'
    });
    expect(getCatalogEntryInstallState(catalogEntry({ id: 'new.plugin' }), registry)).toEqual({ status: 'not-installed' });
  });
});

function catalogEntry(overrides: Partial<PluginCatalogEntry> = {}): PluginCatalogEntry {
  return {
    id: 'market.plugin',
    name: 'Market Plugin',
    author: 'Open Factory',
    version: '1.0.0',
    description: 'A test plugin.',
    permissions: ['export-hook'],
    downloadUrl: '/plugins/market-plugin.js',
    ...overrides
  };
}
