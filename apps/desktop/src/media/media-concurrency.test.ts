import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  MediaSemaphore,
  defaultBackgroundPoolLimit,
  backgroundMediaPool,
  uiFeedbackPool,
  UI_FEEDBACK_POOL_LIMIT,
} from './media-concurrency';

describe('MediaSemaphore', () => {
  it('runs tasks up to the limit concurrently and queues the rest', async () => {
    const pool = new MediaSemaphore(2);
    const started: number[] = [];
    const release: Array<() => void> = [];
    const tasks = Array.from({ length: 4 }, (_, index) =>
      pool.run(
        () =>
          new Promise<number>((resolve) => {
            started.push(index);
            release[index] = () => resolve(index);
          }),
      ),
    );

    await flushMicrotasks();
    expect(pool.activeCount).toBe(2);
    expect(pool.pendingCount).toBe(2);
    expect(started).toEqual([0, 1]);

    release[0]();
    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2]);

    release[1]();
    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2, 3]);

    release[2]();
    release[3]();
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3]);
    expect(pool.activeCount).toBe(0);
  });

  it('release is idempotent', async () => {
    const pool = new MediaSemaphore(1);
    const release = await pool.acquire();
    expect(pool.activeCount).toBe(1);
    release();
    release();
    expect(pool.activeCount).toBe(0);
  });

  it('setLimit increases the limit and wakes queued tasks', async () => {
    const pool = new MediaSemaphore(1);
    const started: number[] = [];
    const release: Array<() => void> = [];
    const tasks = Array.from({ length: 3 }, (_, index) =>
      pool.run(
        () =>
          new Promise<number>((resolve) => {
            started.push(index);
            release[index] = () => resolve(index);
          }),
      ),
    );

    await flushMicrotasks();
    expect(pool.activeCount).toBe(1);
    expect(pool.pendingCount).toBe(2);
    expect(started).toEqual([0]);

    pool.setLimit(3);
    await flushMicrotasks();
    expect(pool.activeCount).toBe(3);
    expect(pool.pendingCount).toBe(0);
    expect(started).toEqual([0, 1, 2]);

    release.forEach((r) => r());
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2]);
  });

  it('setLimit decreases the limit without shrinking active tasks', async () => {
    const pool = new MediaSemaphore(3);
    const held: Array<() => void> = [];
    for (let i = 0; i < 3; i += 1) {
      held.push(await pool.acquire());
    }
    expect(pool.activeCount).toBe(3);

    pool.setLimit(1);
    expect(pool.limit).toBe(1);
    expect(pool.activeCount).toBe(3);

    let queued = false;
    const pending = pool.run(() => {
      queued = true;
    });
    await flushMicrotasks();
    expect(pool.pendingCount).toBe(1);
    expect(queued).toBe(false);

    held.forEach((release) => release());
    await pending;
    expect(queued).toBe(true);
    expect(pool.activeCount).toBe(0);
  });
});

describe('defaultBackgroundPoolLimit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caps at 4 for many cores', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 32 });
    expect(defaultBackgroundPoolLimit()).toBe(4);
  });

  it('uses half the cores when below the cap', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    expect(defaultBackgroundPoolLimit()).toBe(4);
  });

  it('is at least 1', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });
    expect(defaultBackgroundPoolLimit()).toBe(1);
  });

  it('falls back when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined);
    expect(defaultBackgroundPoolLimit()).toBeGreaterThanOrEqual(1);
  });

  it('UI feedback pool uses a small fixed limit', () => {
    expect(UI_FEEDBACK_POOL_LIMIT).toBeGreaterThanOrEqual(2);
    expect(UI_FEEDBACK_POOL_LIMIT).toBeLessThanOrEqual(3);
  });
});

describe('two-pool isolation (H2 core requirement)', () => {
  const held: Array<() => void> = [];

  beforeEach(() => {
    held.length = 0;
    // Force deterministic small limits so the background pool can be saturated.
    backgroundMediaPool.setLimit(2);
    uiFeedbackPool.setLimit(2);
  });

  afterEach(async () => {
    // Release any slots still held so the singleton pools stay clean
    // for the other tests in this file.
    for (const release of held.splice(0)) {
      release();
    }
    await flushMicrotasks();
    backgroundMediaPool.setLimit(defaultBackgroundPoolLimit());
    uiFeedbackPool.setLimit(UI_FEEDBACK_POOL_LIMIT);
  });

  it('keeps UI feedback tasks responsive while the background pool is saturated', async () => {
    // Occupy every background pool slot with a held acquire.
    for (let i = 0; i < backgroundMediaPool.limit; i += 1) {
      const release = await backgroundMediaPool.acquire();
      held.push(release);
    }
    expect(backgroundMediaPool.activeCount).toBe(backgroundMediaPool.limit);
    expect(backgroundMediaPool.pendingCount).toBe(0);

    // A UI feedback task must still be served immediately.
    let uiRan = false;
    const uiTask = uiFeedbackPool.run(() => {
      uiRan = true;
    });
    await Promise.race([
      uiTask,
      new Promise((_, reject) => setTimeout(() => reject(new Error('UI task blocked')), 200)),
    ]);
    expect(uiRan).toBe(true);
    expect(uiFeedbackPool.activeCount).toBe(0);
  });

  it('does not let background tasks occupy UI pool slots', async () => {
    // Hold all background slots; UI pool must remain unaffected.
    for (let i = 0; i < backgroundMediaPool.limit; i += 1) {
      const release = await backgroundMediaPool.acquire();
      held.push(release);
    }

    let uiRan = false;
    const uiTask = uiFeedbackPool.run(() => {
      uiRan = true;
    });
    await Promise.race([
      uiTask,
      new Promise((_, reject) => setTimeout(() => reject(new Error('UI task blocked')), 200)),
    ]);
    expect(uiRan).toBe(true);
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
