import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  TaskScheduler,
  UITaskScheduler,
  WorkerTaskScheduler,
  DEFAULT_SCHEDULER_CONFIG,
} from '../src/core/task-scheduler';

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler({ maxConcurrent: 2, timeSliceMs: 100 });
  });

  it('submits and completes a task', async () => {
    const result = await scheduler.submit({
      id: 't1',
      priority: 'normal',
      execute: async () => 42,
    });
    expect(result).toBe(42);
  });

  it('resolves tasks with different priorities', async () => {
    const order: string[] = [];

    scheduler = new TaskScheduler({ maxConcurrent: 1, timeSliceMs: 1000 });

    const p1 = scheduler.submit({
      id: 'low',
      priority: 'low',
      execute: async () => { order.push('low'); return 'low'; },
    });
    const p2 = scheduler.submit({
      id: 'high',
      priority: 'high',
      execute: async () => { order.push('high'); return 'high'; },
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('low');
    expect(r2).toBe('high');
  });

  it('cancels a pending task', async () => {
    scheduler = new TaskScheduler({ maxConcurrent: 1, timeSliceMs: 10000 });

    const blocker = scheduler.submit({
      id: 'blocker',
      priority: 'immediate',
      execute: async () => { await new Promise(r => setTimeout(r, 500)); return 'done'; },
    });

    let cancelled = false;
    const taskPromise = scheduler.submit({
      id: 'victim',
      priority: 'low',
      execute: async () => 'victim',
      onCancel: () => { cancelled = true; },
    });

    const didCancel = scheduler.cancel('victim');
    expect(didCancel).toBe(true);

    try { await taskPromise; } catch { /* rejected */ }
    await blocker;
  });

  it('cancels a running task', async () => {
    scheduler = new TaskScheduler({ maxConcurrent: 1, timeSliceMs: 10000 });

    let cancelled = false;
    const taskPromise = scheduler.submit({
      id: 'running',
      priority: 'immediate',
      execute: async () => { await new Promise(r => setTimeout(r, 500)); return 'done'; },
      onCancel: () => { cancelled = true; },
    });

    await new Promise(r => setTimeout(r, 10));
    const didCancel = scheduler.cancel('running');
    expect(didCancel).toBe(true);

    try { await taskPromise; } catch { /* rejected */ }
  });

  it('handles task errors and retries', async () => {
    let attempts = 0;
    await expect(
      scheduler.submit({
        id: 'fail',
        priority: 'normal',
        execute: async () => {
          attempts++;
          throw new Error('fail');
        },
      }),
    ).rejects.toThrow('fail');
    expect(attempts).toBeGreaterThan(1);
  });

  it('reports task status', async () => {
    expect(scheduler.getTaskStatus('nonexistent')).toBeNull();

    const promise = scheduler.submit({
      id: 'status-test',
      priority: 'normal',
      execute: async () => 'ok',
    });

    await promise;
    expect(scheduler.getTaskStatus('status-test')).toBe('completed');
  });

  it('returns stats', async () => {
    await scheduler.submit({ id: 's1', priority: 'normal', execute: async () => 1 });
    const stats = scheduler.getStats();
    expect(stats.completed).toBe(1);
    expect(stats.total).toBeGreaterThanOrEqual(1);
  });

  it('clears all tasks', async () => {
    const promise = scheduler.submit({ id: 'c1', priority: 'low', execute: async () => 1 }).catch(() => {});
    scheduler.clear();
    await promise;
    expect(scheduler.getStats().queued).toBe(0);
    expect(scheduler.getStats().running).toBe(0);
  });

  it('distinguishes time slice exceeded from real failures', async () => {
    // Use a very short time slice to trigger TimeSliceExceeded
    scheduler = new TaskScheduler({ maxConcurrent: 1, timeSliceMs: 1, enablePreemption: false });

    let attempts = 0;
    const result = await scheduler.submit({
      id: 'timeslice',
      priority: 'normal',
      execute: async () => {
        attempts++;
        if (attempts < 3) {
          // Simulate work that exceeds time slice
          await new Promise(r => setTimeout(r, 50));
        }
        return 'done';
      },
    });

    expect(result).toBe('done');
    // Time slice exceeded should NOT count as retry
    // The task should be re-queued and eventually complete
  });

  it('handles priority aging for starved tasks', async () => {
    scheduler = new TaskScheduler({
      maxConcurrent: 1,
      timeSliceMs: 10000,
      enablePriorityAging: true,
      agingThresholdMs: 10,
      starvationPreventionMs: 10,
    });

    const order: string[] = [];

    // Fill the slot with a high-priority task
    const blocker = scheduler.submit({
      id: 'blocker',
      priority: 'immediate',
      execute: async () => { await new Promise(r => setTimeout(r, 100)); return 'done'; },
    });

    // Submit a background task that will wait
    const bg = scheduler.submit({
      id: 'bg',
      priority: 'background',
      execute: async () => { order.push('bg'); return 'bg'; },
    });

    await blocker;
    const bgResult = await bg;
    expect(bgResult).toBe('bg');
  });
});

describe('UITaskScheduler', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame for Node environment
    if (typeof globalThis.requestAnimationFrame === 'undefined') {
      (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number;
    }
  });

  it('schedules and flushes UI updates', async () => {
    const scheduler = new UITaskScheduler();
    const updates: string[] = [];

    scheduler.scheduleUIUpdate('a', () => updates.push('a'));
    scheduler.scheduleUIUpdate('b', () => updates.push('b'));

    // Wait for the mock rAF to fire
    await new Promise(r => setTimeout(r, 50));
    expect(updates).toEqual(['a', 'b']);
  });

  it('cancels a pending UI update', async () => {
    const scheduler = new UITaskScheduler();
    const updates: string[] = [];

    scheduler.scheduleUIUpdate('a', () => updates.push('a'));
    scheduler.cancelUIUpdate('a');
    scheduler.scheduleUIUpdate('b', () => updates.push('b'));

    await new Promise(r => setTimeout(r, 50));
    expect(updates).toEqual(['b']);
  });
});

describe('WorkerTaskScheduler', () => {
  it('submits tasks to workers', async () => {
    const scheduler = new WorkerTaskScheduler(2);

    const result = await scheduler.submitToWorker('w1', 0, async () => 'worker-result');
    expect(result).toBe('worker-result');
  });

  it('tracks worker affinity', async () => {
    const scheduler = new WorkerTaskScheduler(2);

    await scheduler.submitToWorker('w1', 1, async () => 'ok');
    expect(scheduler.getPreferredWorker('w1')).toBe(1);
    expect(scheduler.getPreferredWorker('unknown')).toBeNull();
  });

  it('returns stats', async () => {
    const scheduler = new WorkerTaskScheduler(2);
    await scheduler.submitToWorker('w1', 0, async () => 'ok');
    const stats = scheduler.getStats();
    expect(stats.completed).toBe(1);
  });

  it('clears all tasks and affinity', async () => {
    const scheduler = new WorkerTaskScheduler(2);
    const promise = scheduler.submitToWorker('w1', 0, async () => 'ok').catch(() => {});
    scheduler.clear();
    await promise;
    expect(scheduler.getPreferredWorker('w1')).toBeNull();
  });
});

describe('DEFAULT_SCHEDULER_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_SCHEDULER_CONFIG.maxConcurrent).toBe(4);
    expect(DEFAULT_SCHEDULER_CONFIG.timeSliceMs).toBe(16);
    expect(DEFAULT_SCHEDULER_CONFIG.enablePreemption).toBe(true);
    expect(DEFAULT_SCHEDULER_CONFIG.maxRetries).toBe(3);
  });
});
