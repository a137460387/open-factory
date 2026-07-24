import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalInferenceProvider,
  RemoteInferenceProvider,
  HeuristicProvider,
  InferenceProviderManager,
  registerProvider,
  createProvider,
  listRegisteredProviders,
} from './inference-provider';
import type { InferenceCapability } from './inference-provider';

describe('InferenceProviderManager', () => {
  it('initializes with heuristic provider when local fails', async () => {
    const manager = new InferenceProviderManager();
    const heuristic = new HeuristicProvider();
    manager.addProvider(heuristic);
    manager.setFallbackChain(['nonexistent', 'heuristic']);

    const provider = await manager.initialize();
    expect(provider.id).toBe('heuristic');
    expect(provider.isReady).toBe(true);
  });

  it('selects first available provider from fallback chain', async () => {
    const manager = new InferenceProviderManager();
    const heuristic = new HeuristicProvider();
    manager.addProvider(heuristic);
    manager.setFallbackChain(['heuristic']);

    const provider = await manager.initialize();
    expect(provider.id).toBe('heuristic');
  });

  it('throws when no provider can be initialized', async () => {
    const manager = new InferenceProviderManager();
    manager.setFallbackChain(['nonexistent']);

    await expect(manager.initialize()).rejects.toThrow('No inference provider could be initialized');
  });

  it('listProviders returns all registered providers', () => {
    const manager = new InferenceProviderManager();
    manager.addProvider(new HeuristicProvider());
    const list = manager.listProviders();
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe('heuristic');
  });

  it('getActiveProvider returns null before initialization', () => {
    const manager = new InferenceProviderManager();
    expect(manager.getActiveProvider()).toBeNull();
  });

  it('destroy clears all providers', async () => {
    const manager = new InferenceProviderManager();
    manager.addProvider(new HeuristicProvider());
    await manager.initialize();
    manager.destroy();
    expect(manager.getActiveProvider()).toBeNull();
    expect(manager.listProviders()).toHaveLength(0);
  });
});

describe('HeuristicProvider', () => {
  it('is always ready', () => {
    const provider = new HeuristicProvider();
    expect(provider.isReady).toBe(true);
    expect(provider.health).toBe('degraded');
  });

  it('has scene-detection capability', () => {
    const provider = new HeuristicProvider();
    expect(provider.hasCapability('scene-detection')).toBe(true);
    expect(provider.hasCapability('asr')).toBe(false);
  });

  it('initialize returns true', async () => {
    const provider = new HeuristicProvider();
    expect(await provider.initialize()).toBe(true);
  });

  it('infer returns a valid result', async () => {
    const provider = new HeuristicProvider();
    const result = await provider.infer('scene-detection', {
      shape: [10],
      dtype: 'float32',
      data: new Float32Array(10).buffer,
    });
    expect(result.output).toBeDefined();
    expect(result.inferenceTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.backend).toBe('cpu');
  });

  it('destroy does not throw', () => {
    const provider = new HeuristicProvider();
    expect(() => provider.destroy()).not.toThrow();
  });
});

describe('LocalInferenceProvider', () => {
  it('initializes with cpu backend in test environment', async () => {
    const provider = new LocalInferenceProvider({ backend: 'cpu' });
    const ok = await provider.initialize();
    expect(ok).toBe(true);
    expect(provider.isReady).toBe(true);
    expect(provider.backend).toBe('cpu');
  });

  it('has all capabilities declared', () => {
    const provider = new LocalInferenceProvider();
    expect(provider.hasCapability('asr')).toBe(true);
    expect(provider.hasCapability('semantic')).toBe(true);
    expect(provider.hasCapability('vision')).toBe(true);
    expect(provider.hasCapability('scene-detection')).toBe(true);
  });

  it('health is degraded when not GPU accelerated', async () => {
    const provider = new LocalInferenceProvider({ backend: 'cpu' });
    await provider.initialize();
    expect(provider.health).toBe('degraded');
  });

  it('infer throws when not initialized', async () => {
    const provider = new LocalInferenceProvider();
    await expect(provider.infer('asr', {
      shape: [10],
      dtype: 'float32',
      data: new Float32Array(10).buffer,
    })).rejects.toThrow('not ready');
  });

  it('destroy resets state', async () => {
    const provider = new LocalInferenceProvider({ backend: 'cpu' });
    await provider.initialize();
    provider.destroy();
    expect(provider.isReady).toBe(false);
    expect(provider.health).toBe('not-ready');
  });
});

describe('RemoteInferenceProvider', () => {
  it('is not ready before initialization', () => {
    const provider = new RemoteInferenceProvider({
      endpoint: 'http://localhost:9999',
    });
    expect(provider.isReady).toBe(false);
    expect(provider.health).toBe('not-ready');
  });

  it('initialize returns false when endpoint is unreachable', async () => {
    const provider = new RemoteInferenceProvider({
      endpoint: 'http://localhost:1',
    });
    const ok = await provider.initialize();
    expect(ok).toBe(false);
    expect(provider.isReady).toBe(false);
  });

  it('has configured capabilities', () => {
    const provider = new RemoteInferenceProvider({
      endpoint: 'http://localhost:9999',
      capabilities: ['asr', 'semantic'],
    });
    expect(provider.hasCapability('asr')).toBe(true);
    expect(provider.hasCapability('semantic')).toBe(true);
    expect(provider.hasCapability('vision')).toBe(false);
  });
});

describe('Provider Registry', () => {
  it('createProvider returns registered provider', () => {
    const provider = createProvider('heuristic');
    expect(provider).toBeDefined();
    expect(provider!.id).toBe('heuristic');
  });

  it('createProvider returns undefined for unknown id', () => {
    const provider = createProvider('unknown-provider');
    expect(provider).toBeUndefined();
  });

  it('listRegisteredProviders includes auto-registered providers', () => {
    const list = listRegisteredProviders();
    expect(list).toContain('local');
    expect(list).toContain('heuristic');
  });
});
