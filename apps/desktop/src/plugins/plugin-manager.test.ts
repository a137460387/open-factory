import { describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import { runPluginHookForRegistry, type PluginRegistry } from './plugin-manager';
import type { LoadedPlugin, PluginRuntime } from './plugin-loader';

describe('plugin manager', () => {
  it('isolates plugin hook errors and keeps invoking other plugins', async () => {
    const throwing = makeLoadedPlugin('throwing', ['export-hook'], () => {
      throw new Error('plugin crashed');
    });
    const okHook = vi.fn(async () => ({ ok: true }));
    const ok = makeLoadedPlugin('ok', ['export-hook'], okHook);
    const registry: PluginRegistry = { plugins: [throwing, ok], errors: [] };

    const entries = await runPluginHookForRegistry(registry, 'onExportBefore', {
      project: createProject('Plugin Isolation'),
      outputPath: 'C:/Exports/out.mp4'
    });

    expect(entries).toEqual([
      { pluginId: 'throwing', hookName: 'onExportBefore', ok: false, error: 'plugin crashed' },
      { pluginId: 'ok', hookName: 'onExportBefore', ok: true, result: { ok: true } }
    ]);
    expect(throwing.errors).toEqual(['plugin crashed']);
    expect(okHook).toHaveBeenCalledOnce();
  });

  it('skips disabled plugins without invoking their hooks', async () => {
    const disabledHook = vi.fn(async () => undefined);
    const disabled = { ...makeLoadedPlugin('disabled', ['export-hook'], disabledHook), enabled: false };
    const registry: PluginRegistry = { plugins: [disabled], errors: [] };

    expect(
      await runPluginHookForRegistry(registry, 'onExportBefore', {
        project: createProject('Disabled Plugin'),
        outputPath: 'C:/Exports/out.mp4'
      })
    ).toEqual([]);
    expect(disabledHook).not.toHaveBeenCalled();
  });
});

function makeLoadedPlugin(id: string, permissions: LoadedPlugin['plugin']['permissions'], hook: PluginRuntime['invokeHook']): LoadedPlugin {
  const plugin: LoadedPlugin['plugin'] = {
    id,
    name: id,
    version: '1.0.0',
    description: '',
    permissions,
    hooks: { onExportBefore: () => undefined }
  };
  return {
    sourcePath: `C:/Plugins/${id}.js`,
    plugin,
    runtime: {
      plugin,
      invokeHook: hook,
      dispose: () => undefined
    },
    errors: [],
    builtin: false,
    enabled: true
  };
}
