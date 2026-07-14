import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compareSemver,
  getCatalogEntryInstallState,
  installCatalogPlugin,
  loadPluginCatalog,
  parsePluginCatalogJson,
  type PluginCatalogEntry,
} from './plugin-market';
import type { PluginRegistry } from './plugin-manager';

const tauriMocks = vi.hoisted(() => ({
  bridgeConfirm: vi.fn(async () => true),
  copyFile: vi.fn(),
  getAppDataDir: vi.fn(async () => 'C:/AppData/open-factory'),
  readFile: vi.fn(),
  writeFile: vi.fn(async () => undefined),
}));

const pluginManagerMocks = vi.hoisted(() => ({
  refreshPluginRegistry: vi.fn(async () => undefined),
}));

vi.mock('../lib/tauri-bridge', () => tauriMocks);
vi.mock('./plugin-manager', () => pluginManagerMocks);

describe('plugin market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.bridgeConfirm.mockResolvedValue(true);
    tauriMocks.getAppDataDir.mockResolvedValue('C:/AppData/open-factory');
  });

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
            downloadUrl: '/plugins/clean-cuts.js',
            sha256: 'A'.repeat(64),
          },
          {
            id: 'invalid-hash',
            name: 'Invalid Hash',
            author: 'Open Factory',
            version: '1.0.0',
            permissions: [],
            downloadUrl: '/plugins/invalid.js',
            sha256: 'not-a-sha',
          },
          { id: 'missing-required-fields' },
        ],
      }),
    );

    expect(entries).toEqual([
      {
        id: 'open-factory.clean-cuts',
        name: 'Clean Cuts',
        author: 'Open Factory',
        version: '1.2.3',
        description: 'Adds export checks.',
        permissions: ['export-hook'],
        downloadUrl: '/plugins/clean-cuts.js',
        sha256: 'a'.repeat(64),
      },
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
      writeCache: async () => undefined,
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
          rootPath: 'C:/Plugins',
          dev: false,
          plugin: {
            id: 'market.plugin',
            name: 'Market Plugin',
            version: '1.0.0',
            description: '',
            permissions: ['export-hook'],
            hooks: {},
          },
          runtime: {
            plugin: {
              id: 'market.plugin',
              name: 'Market Plugin',
              version: '1.0.0',
              description: '',
              permissions: ['export-hook'],
              hooks: {},
            },
            invokeHook: async () => undefined,
            dispose: () => undefined,
          },
          errors: [],
          builtin: false,
          enabled: true,
        },
      ],
    };

    expect(getCatalogEntryInstallState(catalogEntry({ id: 'market.plugin', version: '1.0.0' }), registry)).toEqual({
      status: 'installed',
      installedVersion: '1.0.0',
    });
    expect(getCatalogEntryInstallState(catalogEntry({ id: 'market.plugin', version: '1.1.0' }), registry)).toEqual({
      status: 'update-available',
      installedVersion: '1.0.0',
    });
    expect(getCatalogEntryInstallState(catalogEntry({ id: 'new.plugin' }), registry)).toEqual({
      status: 'not-installed',
    });
  });

  it('installs catalog plugins only after hash, manifest permission, and user confirmation checks pass', async () => {
    const source = pluginSource(['export-hook']);
    const path = await installCatalogPlugin(catalogEntry(), {
      fetcher: fetcherFor(source),
      hashProvider: async () => 'a'.repeat(64),
    });

    expect(path).toBe('C:/AppData/open-factory/plugins/market.plugin.js');
    expect(tauriMocks.bridgeConfirm).toHaveBeenCalledWith(
      expect.stringContaining('此插件来自第三方，请确认来源可信'),
      expect.objectContaining({ kind: 'warning' }),
    );
    const [confirmMessage] = tauriMocks.bridgeConfirm.mock.calls[0] as unknown as [string, unknown];
    expect(confirmMessage).toContain('Market Plugin');
    expect(confirmMessage).toContain('/plugins/market-plugin.js');
    expect(tauriMocks.writeFile).toHaveBeenCalledWith('C:/AppData/open-factory/plugins/market.plugin.js', source);
    expect(pluginManagerMocks.refreshPluginRegistry).toHaveBeenCalledTimes(1);
  });

  it('rejects catalog plugins when the downloaded hash does not match', async () => {
    await expect(
      installCatalogPlugin(catalogEntry(), {
        fetcher: fetcherFor(pluginSource(['export-hook'])),
        hashProvider: async () => 'b'.repeat(64),
      }),
    ).rejects.toThrow('SHA-256 mismatch');

    expect(tauriMocks.bridgeConfirm).not.toHaveBeenCalled();
    expect(tauriMocks.writeFile).not.toHaveBeenCalled();
    expect(pluginManagerMocks.refreshPluginRegistry).not.toHaveBeenCalled();
  });

  it('rejects catalog plugins when manifest permissions cannot be extracted', async () => {
    await expect(
      installCatalogPlugin(catalogEntry(), {
        fetcher: fetcherFor('module.exports = { hooks: {} };'),
        hashProvider: async () => 'a'.repeat(64),
      }),
    ).rejects.toThrow('manifest permissions');

    expect(tauriMocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects catalog plugins when catalog and manifest permissions differ', async () => {
    await expect(
      installCatalogPlugin(catalogEntry({ permissions: ['export-hook'] }), {
        fetcher: fetcherFor(pluginSource(['read-project'])),
        hashProvider: async () => 'a'.repeat(64),
      }),
    ).rejects.toThrow('permissions do not match');

    expect(tauriMocks.writeFile).not.toHaveBeenCalled();
  });

  it('does not write plugins when the install confirmation is canceled', async () => {
    tauriMocks.bridgeConfirm.mockResolvedValueOnce(false);

    await expect(
      installCatalogPlugin(catalogEntry(), {
        fetcher: fetcherFor(pluginSource(['export-hook'])),
        hashProvider: async () => 'a'.repeat(64),
      }),
    ).rejects.toThrow('canceled');

    expect(tauriMocks.writeFile).not.toHaveBeenCalled();
    expect(pluginManagerMocks.refreshPluginRegistry).not.toHaveBeenCalled();
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
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

function pluginSource(permissions: string[]): string {
  return [
    'module.exports = {',
    '  manifest: {',
    '    id: "market.plugin",',
    '    name: "Market Plugin",',
    '    version: "1.0.0",',
    `    permissions: [${permissions.map((permission) => `"${permission}"`).join(', ')}]`,
    '  },',
    '  hooks: {}',
    '};',
  ].join('\n');
}

function fetcherFor(source: string) {
  return vi.fn(async () => ({
    ok: true,
    text: async () => source,
  }));
}
