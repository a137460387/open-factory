import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../../src/plugins/plugin-registry';
import { PluginManager } from '../../src/plugins/plugin-manager';
import type {
  AnyPlugin,
  EffectPlugin,
  ExportPlugin,
  WorkflowPlugin,
  AIModelPlugin,
  PluginManifest,
  PluginContext,
  PluginLifecycle,
} from '../../src/plugins/plugin-types';

// --- Test helpers ---

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'com.test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    category: 'effect',
    ...overrides,
  };
}

function makeEffectPlugin(): EffectPlugin {
  return {
    effectId: 'test-effect',
    effectName: 'Test Effect',
    effectCategory: 'color',
    parameters: [
      { name: 'brightness', label: 'Brightness', type: 'number', defaultValue: 1.0, min: 0, max: 2, step: 0.1 },
    ],
    applyEffect(params, frameData) {
      return frameData;
    },
  };
}

function makeExportPlugin(): ExportPlugin {
  return {
    presetId: 'test-export',
    presets: [
      {
        id: 'preset-1',
        name: 'Test Preset',
        extension: 'mp4',
        mimeType: 'video/mp4',
        ffmpegArgs: ['-c:v', 'libx264'],
      },
    ],
    prepareExport() {
      return ['-preset', 'medium'];
    },
  };
}

function makeWorkflowPlugin(): WorkflowPlugin {
  return {
    workflowId: 'test-workflow',
    workflowName: 'Test Workflow',
    steps: [
      { id: 'step-1', name: 'Step 1' },
      { id: 'step-2', name: 'Step 2', requiresInput: true },
    ],
    executeStep(step, input) {
      return { stepId: step.id, result: 'done' };
    },
  };
}

function makeAIModelPlugin(): AIModelPlugin {
  let loaded = false;
  return {
    modelInfo: {
      modelId: 'test-model',
      name: 'Test Model',
      version: '1.0.0',
      capabilities: ['scene-detection'],
      local: true,
    },
    async loadModel() {
      loaded = true;
      return true;
    },
    async infer(request) {
      return { output: { scenes: [] }, inferenceTimeMs: 100 };
    },
    isModelLoaded() {
      return loaded;
    },
    async unloadModel() {
      loaded = false;
    },
  };
}

function makeLifecyclePlugin(): PluginLifecycle {
  const calls: string[] = [];
  return {
    calls,
    onLoad() { calls.push('load'); },
    onActivate() { calls.push('activate'); },
    onDeactivate() { calls.push('deactivate'); },
    onUnload() { calls.push('unload'); },
  } as PluginLifecycle & { calls: string[] };
}

// --- PluginRegistry tests ---

describe('PluginRegistry', () => {
  it('registers a plugin', () => {
    const registry = new PluginRegistry();
    const manifest = makeManifest();
    const plugin = makeEffectPlugin();

    const entry = registry.register(manifest, plugin);
    expect(entry.manifest.id).toBe('com.test.plugin');
    expect(entry.status).toBe('registered');
    expect(registry.size).toBe(1);
  });

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    expect(() => registry.register(makeManifest(), makeEffectPlugin())).toThrow('already registered');
  });

  it('throws on invalid manifest', () => {
    const registry = new PluginRegistry();

    expect(() => registry.register({ ...makeManifest(), id: '' }, makeEffectPlugin())).toThrow('valid id');
    expect(() => registry.register({ ...makeManifest(), name: '' }, makeEffectPlugin())).toThrow('valid name');
    expect(() => registry.register({ ...makeManifest(), version: '' }, makeEffectPlugin())).toThrow('valid version');
    expect(() => registry.register({ ...makeManifest(), category: 'invalid' as any }, makeEffectPlugin())).toThrow('Invalid');
    expect(() => registry.register({ ...makeManifest(), version: 'not-semver' }, makeEffectPlugin())).toThrow('semver');
  });

  it('unregisters a plugin', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    expect(registry.unregister('com.test.plugin')).toBe(true);
    expect(registry.size).toBe(0);
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('gets a plugin by ID', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    const entry = registry.get('com.test.plugin');
    expect(entry).toBeDefined();
    expect(entry!.manifest.name).toBe('Test Plugin');

    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('checks if plugin is registered', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    expect(registry.has('com.test.plugin')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('updates plugin status', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    expect(registry.updateStatus('com.test.plugin', 'loaded')).toBe(true);
    const entry = registry.get('com.test.plugin');
    expect(entry!.status).toBe('loaded');

    expect(registry.updateStatus('nonexistent', 'loaded')).toBe(false);
  });

  it('sets error on status update', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    const error = new Error('test error');
    registry.updateStatus('com.test.plugin', 'error', error);

    const entry = registry.get('com.test.plugin');
    expect(entry!.status).toBe('error');
    expect(entry!.error).toBe(error);
  });

  it('clears error when status changes from error', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest(), makeEffectPlugin());

    registry.updateStatus('com.test.plugin', 'error', new Error('test'));
    registry.updateStatus('com.test.plugin', 'loaded');

    const entry = registry.get('com.test.plugin');
    expect(entry!.error).toBeUndefined();
  });

  it('queries by category', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a', category: 'effect' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b', category: 'export' }), makeExportPlugin());
    registry.register(makeManifest({ id: 'c', category: 'effect' }), makeEffectPlugin());

    const effects = registry.query({ category: 'effect' });
    expect(effects).toHaveLength(2);

    const exports = registry.query({ category: 'export' });
    expect(exports).toHaveLength(1);
  });

  it('queries by status', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b' }), makeEffectPlugin());
    registry.updateStatus('a', 'loaded');

    const loaded = registry.query({ status: 'loaded' });
    expect(loaded).toHaveLength(1);
    expect(loaded[0].manifest.id).toBe('a');
  });

  it('queries with search', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a', name: 'Blur Effect' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b', name: 'Color Grading' }), makeEffectPlugin());

    const results = registry.query({ search: 'blur' });
    expect(results).toHaveLength(1);
    expect(results[0].manifest.name).toBe('Blur Effect');
  });

  it('queries with sorting', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'c', name: 'Charlie' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'a', name: 'Alpha' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b', name: 'Beta' }), makeEffectPlugin());

    const sorted = registry.query({ sortBy: 'name', sortDirection: 'asc' });
    expect(sorted[0].manifest.name).toBe('Alpha');
    expect(sorted[2].manifest.name).toBe('Charlie');
  });

  it('returns correct stats', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a', category: 'effect' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b', category: 'export' }), makeExportPlugin());
    registry.updateStatus('a', 'loaded');

    const stats = registry.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byCategory.effect).toBe(1);
    expect(stats.byCategory.export).toBe(1);
    expect(stats.byStatus.loaded).toBe(1);
    expect(stats.byStatus.registered).toBe(1);
  });

  it('returns all IDs', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b' }), makeEffectPlugin());

    expect(registry.getIds()).toEqual(['a', 'b']);
  });

  it('clears all registrations', () => {
    const registry = new PluginRegistry();
    registry.register(makeManifest({ id: 'a' }), makeEffectPlugin());
    registry.register(makeManifest({ id: 'b' }), makeEffectPlugin());

    registry.clear();
    expect(registry.size).toBe(0);
  });
});

// --- PluginManager tests ---

describe('PluginManager', () => {
  it('registers and unregisters plugins', async () => {
    const manager = new PluginManager();
    const manifest = makeManifest();
    const plugin = makeEffectPlugin();

    manager.register(manifest, plugin);
    expect(manager.getPlugin('com.test.plugin')).toBeDefined();

    await manager.unregister('com.test.plugin');
    expect(manager.getPlugin('com.test.plugin')).toBeUndefined();
  });

  it('loads a plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const lifecycle = makeLifecyclePlugin();
    const plugin = { ...makeEffectPlugin(), ...lifecycle };

    manager.register(makeManifest(), plugin);
    const result = await manager.load('com.test.plugin');

    expect(result).toBe(true);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('loaded');
    expect((lifecycle as any).calls).toContain('load');
  });

  it('activates a plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const lifecycle = makeLifecyclePlugin();
    const plugin = { ...makeEffectPlugin(), ...lifecycle };

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');
    const result = await manager.activate('com.test.plugin');

    expect(result).toBe(true);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('active');
    expect((lifecycle as any).calls).toContain('activate');
  });

  it('auto-activates when configured', async () => {
    const manager = new PluginManager(undefined, { autoActivate: true });
    const plugin = makeEffectPlugin();

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');

    expect(manager.getPlugin('com.test.plugin')!.status).toBe('active');
  });

  it('deactivates a plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const lifecycle = makeLifecyclePlugin();
    const plugin = { ...makeEffectPlugin(), ...lifecycle };

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');
    await manager.activate('com.test.plugin');
    const result = await manager.deactivate('com.test.plugin');

    expect(result).toBe(true);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('loaded');
    expect((lifecycle as any).calls).toContain('deactivate');
  });

  it('unloads a plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const lifecycle = makeLifecyclePlugin();
    const plugin = { ...makeEffectPlugin(), ...lifecycle };

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');
    const result = await manager.unload('com.test.plugin');

    expect(result).toBe(true);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('unloaded');
    expect((lifecycle as any).calls).toContain('unload');
  });

  it('handles load errors', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const plugin: EffectPlugin = {
      ...makeEffectPlugin(),
      onLoad() {
        throw new Error('Load failed');
      },
    };

    manager.register(makeManifest(), plugin);
    const result = await manager.load('com.test.plugin');

    expect(result).toBe(false);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('error');
    expect(manager.getPlugin('com.test.plugin')!.error!.message).toBe('Load failed');
  });

  it('handles activate errors', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const plugin: EffectPlugin = {
      ...makeEffectPlugin(),
      onActivate() {
        throw new Error('Activate failed');
      },
    };

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');
    const result = await manager.activate('com.test.plugin');

    expect(result).toBe(false);
    expect(manager.getPlugin('com.test.plugin')!.status).toBe('error');
  });

  it('returns false for nonexistent plugin operations', async () => {
    const manager = new PluginManager();

    expect(await manager.load('nonexistent')).toBe(false);
    expect(await manager.activate('nonexistent')).toBe(false);
    expect(await manager.deactivate('nonexistent')).toBe(false);
    expect(await manager.unload('nonexistent')).toBe(false);
  });

  it('returns true when loading already loaded plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    manager.register(makeManifest(), makeEffectPlugin());

    await manager.load('com.test.plugin');
    expect(await manager.load('com.test.plugin')).toBe(true);
  });

  it('returns true when deactivating non-active plugin', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    manager.register(makeManifest(), makeEffectPlugin());

    expect(await manager.deactivate('com.test.plugin')).toBe(true);
  });

  it('gets active plugins', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    manager.register(makeManifest({ id: 'a' }), makeEffectPlugin());
    manager.register(makeManifest({ id: 'b' }), makeEffectPlugin());

    await manager.load('a');
    await manager.activate('a');

    const active = manager.getActivePlugins();
    expect(active).toHaveLength(1);
    expect(active[0].manifest.id).toBe('a');
  });

  it('gets plugins by category', () => {
    const manager = new PluginManager();
    manager.register(makeManifest({ id: 'a', category: 'effect' }), makeEffectPlugin());
    manager.register(makeManifest({ id: 'b', category: 'export' }), makeExportPlugin());

    const effects = manager.getPluginsByCategory('effect');
    expect(effects).toHaveLength(1);
  });

  it('emits events on lifecycle changes', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const events: string[] = [];

    manager.on('*', (payload) => {
      events.push(payload.event);
    });

    manager.register(makeManifest(), makeEffectPlugin());
    await manager.load('com.test.plugin');
    await manager.activate('com.test.plugin');
    await manager.deactivate('com.test.plugin');
    await manager.unload('com.test.plugin');

    expect(events).toEqual([
      'plugin-registered',
      'plugin-loaded',
      'plugin-activated',
      'plugin-deactivated',
      'plugin-unloaded',
    ]);
  });

  it('removes event listener', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    let callCount = 0;

    const unsubscribe = manager.on('*', () => {
      callCount++;
    });

    manager.register(makeManifest(), makeEffectPlugin());
    expect(callCount).toBe(1);

    unsubscribe();
    await manager.load('com.test.plugin');
    expect(callCount).toBe(1); // Should not increase.
  });

  it('unregisters deactivates and unloads first', async () => {
    const manager = new PluginManager(undefined, { autoActivate: false });
    const lifecycle = makeLifecyclePlugin();
    const plugin = { ...makeEffectPlugin(), ...lifecycle };

    manager.register(makeManifest(), plugin);
    await manager.load('com.test.plugin');
    await manager.activate('com.test.plugin');

    await manager.unregister('com.test.plugin');

    expect((lifecycle as any).calls).toContain('deactivate');
    expect((lifecycle as any).calls).toContain('unload');
  });
});
