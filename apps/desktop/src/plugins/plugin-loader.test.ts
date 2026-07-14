import { describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import { PLUGIN_API_HOST_FUNCTIONS, type PluginAPI } from '@open-factory/plugin-sdk';
import {
  createBuiltinExamplePlugin,
  extractManifestPermissions,
  formatPluginError,
  loadPluginFiles,
  normalizePluginMetadata,
  type PluginRuntime,
  type PluginSourceFile,
} from './plugin-loader';

type MissingPluginApiHostFunctions = Exclude<keyof PluginAPI, (typeof PLUGIN_API_HOST_FUNCTIONS)[number]>;
const assertAllPluginApiHostFunctionsAreListed: MissingPluginApiHostFunctions extends never ? true : never = true;
void assertAllPluginApiHostFunctionsAreListed;

describe('plugin loader', () => {
  it('loads valid plugins and isolates load errors', async () => {
    const files: PluginSourceFile[] = [
      { path: 'C:/Plugins/good.js', code: 'good' },
      { path: 'C:/Plugins/bad.js', code: 'bad' },
    ];
    const registry = await loadPluginFiles(files, async (source) => {
      if (source.code === 'bad') {
        throw new Error('load failed');
      }
      return makeRuntime({ id: 'good', name: 'Good Plugin', version: '1.0.0', hooks: {} });
    });

    expect(registry.plugins.map((entry) => entry.plugin.id)).toEqual(['good']);
    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]).toMatchObject({ sourcePath: 'C:/Plugins/bad.js' });
    expect(registry.errors[0].message).toContain('load failed');
  });

  it('invokes plugin hooks through the runtime', async () => {
    const hook = vi.fn(() => ({ ok: true }));
    const registry = await loadPluginFiles([{ path: 'C:/Plugins/hook.js', code: 'hook' }], () =>
      makeRuntime({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        version: '1.0.0',
        permissions: ['export-hook'],
        hooks: { onExportBefore: hook },
      }),
    );

    const result = await registry.plugins[0].runtime.invokeHook('onExportBefore', {
      project: createProject('Plugin Test'),
      outputPath: 'C:/Exports/out.mp4',
    });

    expect(result).toEqual({ ok: true });
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ outputPath: 'C:/Exports/out.mp4' }));
  });

  it('normalizes metadata and provides a builtin export-count example plugin', async () => {
    expect(normalizePluginMetadata({ hooks: { onClipSelected: () => undefined } })).toMatchObject({
      name: expect.any(String),
      version: '0.0.0',
      description: '',
      permissions: [],
    });

    const builtin = createBuiltinExamplePlugin();
    const project = createProject('Builtin Test');
    const result = await builtin.runtime.invokeHook('onExportBefore', { project, outputPath: 'C:/Exports/out.mp4' });

    expect(builtin.builtin).toBe(true);
    expect(builtin.plugin.hooks.onExportBefore).toBeTypeOf('function');
    expect(builtin.plugin.permissions).toEqual(['export-hook']);
    expect(result).toEqual({ message: '导出前片段数: 0' });
  });

  it('enforces manifest permissions for hooks', async () => {
    const registry = await loadPluginFiles([{ path: 'C:/Plugins/no-permission.js', code: 'hook' }], () =>
      makeRuntime({
        id: 'no-permission',
        name: 'No Permission',
        version: '1.0.0',
        permissions: [],
        hooks: { onExportBefore: () => ({ ok: true }) },
      }),
    );

    await expect(
      registry.plugins[0].runtime.invokeHook('onExportBefore', {
        project: createProject('Permission Test'),
        outputPath: 'C:/Exports/out.mp4',
      }),
    ).rejects.toThrow('export-hook permission');
  });

  it('extracts manifest permissions from plugin source without executing it', () => {
    const source = [
      'module.exports = {',
      '  manifest: {',
      '    id: "static-plugin",',
      '    permissions: ["export-hook", "menu-register", "network"]',
      '  },',
      '  hooks: {',
      '    onExportBefore() { throw new Error("should not run"); }',
      '  }',
      '};',
    ].join('\n');

    expect(extractManifestPermissions(source)).toEqual(['export-hook', 'menu-register']);
  });

  it('returns undefined when source has no static manifest permissions', () => {
    expect(extractManifestPermissions('module.exports = { hooks: {} };')).toBeUndefined();
    expect(
      extractManifestPermissions('module.exports = { manifest: { permissions: makePermissions() } };'),
    ).toBeUndefined();
  });

  it('exports a complete PluginAPI host function list for SDK consumers', () => {
    expect(PLUGIN_API_HOST_FUNCTIONS).toEqual([
      'getProject',
      'updateProject',
      'registerMenu',
      'showToast',
      'readTextFile',
      'writeTextFile',
      'sendMessage',
      'onMessage',
    ]);
  });

  it('preserves runtime stack details with line and column numbers', () => {
    const error = new Error('plugin crashed');
    error.stack = 'Error: plugin crashed\n    at onExportBefore (C:/Plugins/dev/index.js:12:7)';

    expect(formatPluginError(error)).toContain('C:/Plugins/dev/index.js:12:7');
  });
});

function makeRuntime(
  plugin: Omit<PluginRuntime['plugin'], 'description' | 'permissions'> &
    Partial<Pick<PluginRuntime['plugin'], 'description' | 'permissions'>>,
): PluginRuntime {
  const normalized = {
    description: '',
    permissions: [],
    ...plugin,
  };
  return {
    plugin: normalized,
    invokeHook(hookName, payload) {
      const hook = normalized.hooks[hookName] as ((input: unknown) => unknown) | undefined;
      return Promise.resolve(hook?.(payload));
    },
    dispose() {
      return undefined;
    },
  };
}
