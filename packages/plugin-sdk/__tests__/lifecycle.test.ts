import { describe, expect, it, beforeEach } from 'vitest';
import { PluginLifecycleManager, type PluginRegistryEntry } from '../src/lifecycle';

function makeEntry(id: string, version = '1.0.0'): PluginRegistryEntry {
  return {
    manifest: { id, name: id, version },
    module: { manifest: { id, name: id, version }, hooks: {} },
    metadata: {},
  };
}

describe('PluginLifecycleManager', () => {
  let manager: PluginLifecycleManager;

  beforeEach(() => {
    manager = new PluginLifecycleManager();
  });

  it('registers a plugin', () => {
    manager.register(makeEntry('test-plugin'));
    expect(manager.isRegistered('test-plugin')).toBe(true);
  });

  it('throws on duplicate registration', () => {
    manager.register(makeEntry('test-plugin'));
    expect(() => manager.register(makeEntry('test-plugin'))).toThrow('already registered');
  });

  it('loads a registered plugin', async () => {
    manager.register(makeEntry('test-plugin'));
    await manager.load('test-plugin');
    expect(manager.isLoaded('test-plugin')).toBe(true);
    expect(manager.getPlugin('test-plugin').state).toBe('loaded');
  });

  it('throws when loading unregistered plugin', async () => {
    await expect(manager.load('unknown')).rejects.toThrow('not registered');
  });

  it('enables a loaded plugin', async () => {
    manager.register(makeEntry('test-plugin'));
    await manager.load('test-plugin');
    await manager.enable('test-plugin');
    expect(manager.getPlugin('test-plugin').state).toBe('enabled');
    expect(manager.getEnabledPlugins()).toHaveLength(1);
  });

  it('disables an enabled plugin', async () => {
    manager.register(makeEntry('test-plugin'));
    await manager.load('test-plugin');
    await manager.enable('test-plugin');
    await manager.disable('test-plugin');
    expect(manager.getPlugin('test-plugin').state).toBe('disabled');
  });

  it('unloads a plugin', async () => {
    manager.register(makeEntry('test-plugin'));
    await manager.load('test-plugin');
    await manager.unload('test-plugin');
    expect(manager.isLoaded('test-plugin')).toBe(false);
  });

  it('emits lifecycle events', async () => {
    const events: string[] = [];
    manager.on((data) => events.push(data.event));

    manager.register(makeEntry('test-plugin'));
    await manager.load('test-plugin');
    await manager.enable('test-plugin');
    await manager.disable('test-plugin');

    expect(events).toEqual(['registered', 'loading', 'loaded', 'enabled', 'disabled']);
  });

  it('updates a plugin', async () => {
    manager.register(makeEntry('test-plugin', '1.0.0'));
    await manager.load('test-plugin');
    await manager.enable('test-plugin');

    await manager.update('test-plugin', makeEntry('test-plugin', '2.0.0'));
    expect(manager.getPlugin('test-plugin').manifest.version).toBe('2.0.0');
  });

  it('tracks load order', async () => {
    manager.register(makeEntry('plugin-a'));
    manager.register(makeEntry('plugin-b'));
    await manager.load('plugin-a');
    await manager.load('plugin-b');
    expect(manager.getLoadOrder()).toEqual(['plugin-a', 'plugin-b']);
  });
});
