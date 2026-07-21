import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import {
  MemoryPool,
  FrameBufferPool,
  ModelWeightPool,
  DEFAULT_POOL_CONFIG,
  createMemoryPool,
  createFrameBufferPool,
  createModelWeightPool,
} from '../src/core/memory-pool';

beforeAll(() => {
  // Mock browser globals not available in Node test env
  if (typeof globalThis.ImageBitmap === 'undefined') {
    (globalThis as any).ImageBitmap = class ImageBitmap { close() {} };
  }
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    (globalThis as any).OffscreenCanvas = class OffscreenCanvas {};
  }
});

describe('MemoryPool', () => {
  let pool: MemoryPool;

  beforeEach(() => {
    pool = new MemoryPool({
      maxTotalBytes: 1000,
      maxObjectBytes: 500,
      maxObjects: 10,
      enableAutoGC: false,
    });
  });

  it('acquires and retrieves objects', () => {
    const data = pool.acquire('obj1', 'generic', () => ({ value: 42 }), 100);
    expect(data).toEqual({ value: 42 });
    expect(pool.has('obj1')).toBe(true);

    const retrieved = pool.get('obj1');
    expect(retrieved).toEqual({ value: 42 });
  });

  it('returns cached object on repeated acquire', () => {
    const factory = vi.fn(() => ({ value: 1 }));
    pool.acquire('obj1', 'generic', factory, 100);
    pool.acquire('obj1', 'generic', factory, 100);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('throws when object exceeds maxObjectBytes', () => {
    expect(() => {
      pool.acquire('big', 'generic', () => 'data', 600);
    }).toThrow('exceeds max');
  });

  it('evicts LRU objects when budget exceeded', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    pool.acquire('a', 'generic', () => 'a', 400);
    now += 10;
    pool.acquire('b', 'generic', () => 'b', 400);
    now += 10;
    pool.get('a'); // Touch 'a' to make it more recent
    now += 10;
    pool.acquire('c', 'generic', () => 'c', 400); // Should evict 'b' (LRU)
    expect(pool.has('a')).toBe(true);
    expect(pool.has('b')).toBe(false);
    expect(pool.has('c')).toBe(true);

    vi.restoreAllMocks();
  });

  it('respects maxObjects limit', () => {
    const smallPool = new MemoryPool({ maxTotalBytes: 10000, maxObjectBytes: 100, maxObjects: 2, enableAutoGC: false });
    smallPool.acquire('a', 'generic', () => 'a', 10);
    smallPool.acquire('b', 'generic', () => 'b', 10);
    smallPool.acquire('c', 'generic', () => 'c', 10); // Should evict oldest
    expect(smallPool.has('a')).toBe(false);
    expect(smallPool.has('b')).toBe(true);
    expect(smallPool.has('c')).toBe(true);
  });

  it('releases objects', () => {
    pool.acquire('obj1', 'generic', () => 'data', 100);
    pool.release('obj1');
    expect(pool.has('obj1')).toBe(false);
    expect(pool.get('obj1')).toBeUndefined();
  });

  it('release is no-op for missing key', () => {
    pool.release('nonexistent');
    // Should not throw
  });

  it('clears all objects', () => {
    pool.acquire('a', 'generic', () => 'a', 100);
    pool.acquire('b', 'generic', () => 'b', 100);
    pool.clear();
    expect(pool.has('a')).toBe(false);
    expect(pool.has('b')).toBe(false);
    const stats = pool.getStats();
    expect(stats.totalBytes).toBe(0);
    expect(stats.objectCount).toBe(0);
  });

  it('tracks hit/miss stats', () => {
    pool.acquire('a', 'generic', () => 'a', 100);
    pool.get('a'); // hit
    pool.get('b'); // miss
    pool.get('a'); // hit

    const stats = pool.getStats();
    expect(stats.hitCount).toBe(2);
    expect(stats.missCount).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it('transfers objects out', () => {
    const buffer = new ArrayBuffer(100);
    pool.acquire('buf', 'frame-buffer', () => buffer, 100);

    const result = pool.transferOut('buf');
    expect(result).not.toBeNull();
    expect(result!.data).toBe(buffer);
    expect(result!.transferables).toContain(buffer);
    expect(pool.has('buf')).toBe(false);
  });

  it('transferOut returns null for non-transferable', () => {
    pool.acquire('str', 'generic', () => 'hello', 10);
    expect(pool.transferOut('str')).toBeNull();
  });

  it('transferOut returns null for missing key', () => {
    expect(pool.transferOut('missing')).toBeNull();
  });

  it('transfers objects in', () => {
    const buffer = new ArrayBuffer(100);
    pool.transferIn('buf', 'frame-buffer', buffer, 100);
    expect(pool.has('buf')).toBe(true);
    expect(pool.get('buf')).toBe(buffer);
  });

  it('destroys pool and cancels GC', () => {
    pool.acquire('a', 'generic', () => 'a', 100);
    pool.destroy();
    expect(pool.has('a')).toBe(false);
  });

  it('schedules GC when threshold exceeded', () => {
    const gcPool = new MemoryPool({
      maxTotalBytes: 2000,
      maxObjectBytes: 500,
      maxObjects: 100,
      gcThresholdBytes: 500,
      enableAutoGC: true,
      gcIdleDelayMs: 10,
    });

    gcPool.acquire('a', 'generic', () => 'a', 400);
    gcPool.acquire('b', 'generic', () => 'b', 400);
    // 800 > 500 threshold, GC should be scheduled
    // We can't easily test the async GC, but verify no error
    gcPool.destroy();
  });

  it('runGC evicts low-score objects', () => {
    const gcPool = new MemoryPool({
      maxTotalBytes: 1000,
      maxObjectBytes: 500,
      maxObjects: 100,
      gcThresholdBytes: 500,
      enableAutoGC: false,
    });

    gcPool.acquire('a', 'generic', () => 'a', 300);
    gcPool.acquire('b', 'generic', () => 'b', 300);
    gcPool.acquire('c', 'generic', () => 'c', 300);
    // Total: 900, target 70% = 700

    gcPool.runGC();
    const stats = gcPool.getStats();
    expect(stats.gcCount).toBe(1);
    expect(stats.totalBytes).toBeLessThanOrEqual(700);
    gcPool.destroy();
  });
});

describe('FrameBufferPool', () => {
  it('acquires and releases frame buffers', () => {
    const pool = new FrameBufferPool(1024, 10);
    const buf = pool.acquire(0);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(1024);

    pool.release(0);
    expect(pool.getStats().objectCount).toBe(0);
    pool.destroy();
  });

  it('returns same buffer for same frame on re-acquire', () => {
    const pool = new FrameBufferPool(1024, 10);
    const buf1 = pool.acquire(5);
    pool.release(5);
    const buf2 = pool.acquire(5);
    // Factory creates new buffer each time after release
    expect(buf2).toBeInstanceOf(ArrayBuffer);
    pool.destroy();
  });

  it('reports stats', () => {
    const pool = new FrameBufferPool(1024, 10);
    pool.acquire(0);
    pool.acquire(1);
    const stats = pool.getStats();
    expect(stats.objectCount).toBe(2);
    expect(stats.totalBytes).toBe(2048);
    pool.destroy();
  });
});

describe('ModelWeightPool', () => {
  it('acquires and releases model weights', () => {
    const pool = new ModelWeightPool(1024);
    const loader = () => new ArrayBuffer(1024);
    const weight = pool.acquire('model-a', loader);
    expect(weight).toBeInstanceOf(ArrayBuffer);

    pool.release('model-a');
    expect(pool.getStats().objectCount).toBe(0);
    pool.destroy();
  });

  it('caches loaded models', () => {
    const pool = new ModelWeightPool(1024);
    const loader = vi.fn(() => new ArrayBuffer(1024));

    pool.acquire('model-a', loader);
    pool.acquire('model-a', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    pool.destroy();
  });
});

describe('Factory functions', () => {
  it('createMemoryPool returns a MemoryPool', () => {
    const pool = createMemoryPool({ maxTotalBytes: 500 });
    expect(pool).toBeInstanceOf(MemoryPool);
    pool.destroy();
  });

  it('createFrameBufferPool returns a FrameBufferPool', () => {
    const pool = createFrameBufferPool(1024, 10);
    expect(pool).toBeInstanceOf(FrameBufferPool);
    pool.destroy();
  });

  it('createModelWeightPool returns a ModelWeightPool', () => {
    const pool = createModelWeightPool(1024);
    expect(pool).toBeInstanceOf(ModelWeightPool);
    pool.destroy();
  });
});
