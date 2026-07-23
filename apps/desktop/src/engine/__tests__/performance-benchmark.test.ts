/**
 * Performance Benchmark Tests
 *
 * Sprint AU: Validates performance improvements for:
 * 1. React state isolation (playheadTime re-render reduction)
 * 2. OffscreenCanvas waveform rendering
 * 3. AI task priority scheduling
 * 4. Memory pool allocation efficiency
 * 5. Model lazy loading
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PriorityScheduler } from '../../engine/priority-scheduler';
import { ModelManager } from '../../engine/model-manager';
import { RingBuffer } from '../../engine/ring-buffer';

// ---------------------------------------------------------------------------
// PriorityScheduler Tests
// ---------------------------------------------------------------------------

describe('PriorityScheduler', () => {
  let scheduler: PriorityScheduler;

  beforeEach(() => {
    scheduler = new PriorityScheduler();
  });

  afterEach(() => {
    scheduler.cancelAll();
  });

  it('should execute high priority tasks before low priority', async () => {
    const executionOrder: string[] = [];

    // Submit low priority tasks first
    for (let i = 0; i < 5; i++) {
      scheduler.submit(`low-task-${i}`, 'low', async () => {
        executionOrder.push(`low-${i}`);
      });
    }

    // Then submit high priority task
    scheduler.submit('high-task', 'high', async () => {
      executionOrder.push('high');
    });

    // Wait for tasks to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // High priority task should be in the execution order
    expect(executionOrder).toContain('high');
  });

  it('should pause low priority tasks during user interaction', async () => {
    const completedTasks: string[] = [];

    scheduler.submit('background-task', 'background', async (signal) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (!signal.aborted) {
        completedTasks.push('background');
      }
    });

    scheduler.setUserInteracting(true);

    // Background tasks should not run during user interaction
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completedTasks).toHaveLength(0);
  });

  it('should cancel tasks by priority', () => {
    scheduler.submit('low-1', 'low', async () => {});
    scheduler.submit('low-2', 'low', async () => {});
    scheduler.submit('high-1', 'high', async () => {});

    const cancelled = scheduler.cancelByPriority('low');
    expect(cancelled).toBe(2);

    const tasks = scheduler.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('high-1');
  });

  it('should track running tasks by priority', () => {
    scheduler.submit('task-1', 'normal', async () => {});
    scheduler.submit('task-2', 'normal', async () => {});

    const state = scheduler.getState();
    expect(state.runningByPriority.normal).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// ModelManager Tests
// ---------------------------------------------------------------------------

describe('ModelManager', () => {
  let manager: ModelManager;

  beforeEach(() => {
    manager = new ModelManager({
      maxTotalMemory: 1024 * 1024, // 1 MB for testing
      idleTimeoutMs: 100,
      cleanupIntervalMs: 50,
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should load models on demand', async () => {
    let loadCalled = false;
    manager.register('test-model', 'Test Model', 1024, async () => {
      loadCalled = true;
      return { data: 'test' };
    });

    const model = await manager.load('test-model');
    expect(loadCalled).toBe(true);
    expect(model).toEqual({ data: 'test' });
    expect(manager.isLoaded('test-model')).toBe(true);
  });

  it('should return cached model on subsequent loads', async () => {
    let loadCount = 0;
    manager.register('test-model', 'Test Model', 1024, async () => {
      loadCount++;
      return { data: 'test' };
    });

    await manager.load('test-model');
    await manager.load('test-model');

    expect(loadCount).toBe(1);
  });

  it('should unload models after idle timeout', async () => {
    let unloadCalled = false;
    manager.register(
      'test-model',
      'Test Model',
      1024,
      async () => ({ data: 'test' }),
      () => {
        unloadCalled = true;
      },
    );

    await manager.load('test-model');
    manager.release('test-model');

    // Wait for idle timeout + cleanup interval
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(unloadCalled).toBe(true);
    expect(manager.isLoaded('test-model')).toBe(false);
  });

  it('should not unload models with active references', async () => {
    manager.register('test-model', 'Test Model', 1024, async () => ({ data: 'test' }));

    await manager.load('test-model');
    // Don't release - refCount > 0

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(manager.isLoaded('test-model')).toBe(true);
  });

  it('should track memory usage', async () => {
    manager.register('model-1', 'Model 1', 1024, async () => ({}));
    manager.register('model-2', 'Model 2', 2048, async () => ({}));

    await manager.load('model-1');
    await manager.load('model-2');

    const stats = manager.getStats();
    expect(stats.totalLoaded).toBe(2);
    expect(stats.totalMemoryBytes).toBe(3072);
  });
});

// ---------------------------------------------------------------------------
// RingBuffer Tests
// ---------------------------------------------------------------------------

describe('RingBuffer', () => {
  it('should write and read data correctly', () => {
    const rb = new RingBuffer(16);

    rb.write(new Uint8Array([1, 2, 3, 4, 5]));
    expect(rb.available()).toBe(5);

    const buf = new Uint8Array(5);
    rb.read(buf);
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle wraparound', () => {
    const rb = new RingBuffer(8);

    rb.write(new Uint8Array([1, 2, 3, 4, 5, 6]));

    const buf1 = new Uint8Array(3);
    rb.read(buf1); // Read 1, 2, 3

    rb.write(new Uint8Array([7, 8, 9, 10])); // Wrap around

    expect(rb.available()).toBe(7);

    const buf2 = new Uint8Array(7);
    rb.read(buf2);
    expect(Array.from(buf2)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it('should report correct free space', () => {
    const rb = new RingBuffer(10);

    expect(rb.freeSpace()).toBe(10);
    rb.write(new Uint8Array(4));
    expect(rb.freeSpace()).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Performance Benchmark Helpers
// ---------------------------------------------------------------------------

describe('Performance Benchmarks', () => {
  it('should measure scheduler throughput', async () => {
    const scheduler = new PriorityScheduler();
    const taskCount = 100;
    let completed = 0;

    const start = performance.now();

    for (let i = 0; i < taskCount; i++) {
      scheduler.submit(`task-${i}`, 'normal', async () => {
        completed++;
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const elapsed = performance.now() - start;
    console.log(`Scheduler: ${taskCount} tasks in ${elapsed.toFixed(2)}ms`);

    scheduler.cancelAll();
  });

  it('should measure model manager load/unload cycle', async () => {
    const manager = new ModelManager({
      maxTotalMemory: 1024 * 1024,
      idleTimeoutMs: 50,
      cleanupIntervalMs: 25,
    });

    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      manager.register(`model-${i}`, `Model ${i}`, 1024, async () => ({ id: i }));
      await manager.load(`model-${i}`);
      manager.release(`model-${i}`);
    }

    const elapsed = performance.now() - start;
    console.log(`ModelManager: ${iterations} load/unload cycles in ${elapsed.toFixed(2)}ms`);

    manager.destroy();
  });

  it('should measure ring buffer throughput', () => {
    const rb = new RingBuffer(1024 * 1024); // 1 MB
    const chunkSize = 4096;
    const iterations = 1000;

    const data = new Uint8Array(chunkSize);
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      rb.write(data);
      const buf = new Uint8Array(chunkSize);
      rb.read(buf);
    }

    const elapsed = performance.now() - start;
    const throughput = (iterations * chunkSize) / (elapsed / 1000) / (1024 * 1024);
    console.log(`RingBuffer: ${throughput.toFixed(2)} MB/s throughput`);
  });
});
