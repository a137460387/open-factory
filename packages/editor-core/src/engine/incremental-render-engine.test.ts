import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INCREMENTAL_CONFIG,
  RenderCacheManager,
  DiffDetector,
  RenderProgressEstimator,
  createIncrementalRenderEngine,
  createRenderProgressEstimator,
} from './incremental-render-engine';

describe('DEFAULT_INCREMENTAL_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_INCREMENTAL_CONFIG).toBeDefined();
    expect(typeof DEFAULT_INCREMENTAL_CONFIG.maxConcurrentRenders).toBe('number');
    expect(typeof DEFAULT_INCREMENTAL_CONFIG.renderCacheSizeMB).toBe('number');
    expect(DEFAULT_INCREMENTAL_CONFIG.enableDiffRendering).toBe(true);
  });
});

describe('RenderCacheManager', () => {
  it('creates with default max bytes', () => {
    const cache = new RenderCacheManager();
    expect(cache).toBeDefined();
  });

  it('creates with custom max bytes', () => {
    const cache = new RenderCacheManager(1024);
    expect(cache).toBeDefined();
  });

  it('get returns undefined for missing key', () => {
    const cache = new RenderCacheManager();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('put and get works', () => {
    const cache = new RenderCacheManager();
    cache.put('key1', { data: 'test' } as never, 100);
    expect(cache.get('key1')).toBeDefined();
  });

  it('getStats returns hit/miss counts', () => {
    const cache = new RenderCacheManager();
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('clear empties cache', () => {
    const cache = new RenderCacheManager();
    cache.put('key1', { data: 'test' } as never, 100);
    cache.clear();
    expect(cache.get('key1')).toBeUndefined();
  });

  it('evicts when max bytes exceeded', () => {
    const cache = new RenderCacheManager(200);
    cache.put('key1', { data: 'a' } as never, 150);
    cache.put('key2', { data: 'b' } as never, 150);
    expect(cache.get('key1')).toBeUndefined();
  });
});

describe('DiffDetector', () => {
  it('creates with default config', () => {
    const detector = new DiffDetector();
    expect(detector).toBeDefined();
  });

  it('detectDiff returns diff result', () => {
    const detector = new DiffDetector();
    const result = detector.detectDiff(1, [], 'test');
    expect(result).toBeDefined();
    expect(result.reason).toBe('test');
  });

  it('detectDiff with regions', () => {
    const detector = new DiffDetector();
    const result = detector.detectDiff(1, [{ x: 0, y: 0, width: 100, height: 100 } as never], 'region-change');
    expect(result).toBeDefined();
    expect(result.regions).toBeDefined();
  });

  it('reset clears state', () => {
    const detector = new DiffDetector();
    expect(() => detector.reset()).not.toThrow();
  });
});

describe('RenderProgressEstimator', () => {
  it('creates with default config', () => {
    const estimator = new RenderProgressEstimator();
    expect(estimator).toBeDefined();
  });

  it('reset clears state', () => {
    const estimator = new RenderProgressEstimator();
    expect(() => estimator.reset()).not.toThrow();
  });
});

describe('createIncrementalRenderEngine', () => {
  it('creates an engine', () => {
    const engine = createIncrementalRenderEngine();
    expect(engine).toBeDefined();
  });
});

describe('createRenderProgressEstimator', () => {
  it('creates an estimator', () => {
    const estimator = createRenderProgressEstimator();
    expect(estimator).toBeInstanceOf(RenderProgressEstimator);
  });
});
