import { describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import { createPluginDevWatcher, routePluginMessageForRegistry, runPluginHookForRegistry, wirePluginMessageRouting, type PluginRegistry } from './plugin-manager';
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

    expect(entries[0]).toMatchObject({ pluginId: 'throwing', hookName: 'onExportBefore', ok: false });
    expect(entries[0].error).toContain('plugin crashed');
    expect(entries[1]).toEqual({ pluginId: 'ok', hookName: 'onExportBefore', ok: true, result: { ok: true } });
    expect(throwing.errors[0]).toContain('plugin crashed');
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

  it('routes plugin messages from one plugin to the target plugin', async () => {
    let router: ((pluginId: string, event: string, data: unknown) => void | Promise<void>) | undefined;
    const receiveMessage = vi.fn(async () => undefined);
    const sender = makeLoadedPlugin('sender', ['read-project'], async () => undefined, {
      setMessageRouter(nextRouter) {
        router = nextRouter;
      }
    });
    const receiver = makeLoadedPlugin('receiver', ['read-project'], async () => undefined, { receiveMessage });
    const registry: PluginRegistry = { plugins: [sender, receiver], errors: [] };

    wirePluginMessageRouting(registry);
    await router?.('receiver', 'color-grade:changed', { nodeId: 'serial-1' });

    expect(receiveMessage).toHaveBeenCalledWith({
      fromPluginId: 'sender',
      event: 'color-grade:changed',
      data: { nodeId: 'serial-1' }
    });
  });

  it('returns false when plugin messages have no enabled receiver', async () => {
    const receiver = { ...makeLoadedPlugin('receiver', ['read-project'], async () => undefined), enabled: false };
    const registry: PluginRegistry = { plugins: [receiver], errors: [] };

    await expect(routePluginMessageForRegistry(registry, 'sender', 'receiver', 'event', {})).resolves.toBe(false);
  });

  it('triggers dev plugin reload when the watched signature changes', async () => {
    let signature = 'a';
    let reloadCount = 0;
    const watcher = createPluginDevWatcher({
      roots: ['C:/Plugins/dev'],
      readSignature: async () => signature,
      onReload: () => {
        reloadCount += 1;
      },
      setTimer: (() => 1) as typeof setInterval,
      clearTimer: () => undefined
    });

    await watcher.tick();
    expect(reloadCount).toBe(0);
    signature = 'b';
    await watcher.tick();

    expect(reloadCount).toBe(1);
  });
});

function makeLoadedPlugin(
  id: string,
  permissions: LoadedPlugin['plugin']['permissions'],
  hook: PluginRuntime['invokeHook'],
  runtimeOverrides: Partial<Pick<PluginRuntime, 'receiveMessage' | 'setMessageRouter'>> = {}
): LoadedPlugin {
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
    rootPath: `C:/Plugins/${id}`,
    dev: false,
    plugin,
    runtime: {
      plugin,
      invokeHook: hook,
      ...runtimeOverrides,
      dispose: () => undefined
    },
    errors: [],
    builtin: false,
    enabled: true
  };
}
