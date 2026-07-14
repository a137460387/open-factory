import { describe, expect, it } from 'vitest';
import { BackgroundMediaTaskQueue } from './background-media-task-queue';

describe('background media task queue', () => {
  it('queues tasks above the concurrency limit', async () => {
    const queue = new BackgroundMediaTaskQueue(3);
    const started: number[] = [];
    const release: Array<() => void> = [];
    const tasks = Array.from({ length: 4 }, (_, index) =>
      queue.run(
        () =>
          new Promise<number>((resolve) => {
            started.push(index);
            release[index] = () => resolve(index);
          }),
      ),
    );

    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2]);
    expect(queue.activeCount).toBe(3);
    expect(queue.pendingCount).toBe(1);

    release[0]();
    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2, 3]);
    expect(queue.activeCount).toBe(3);
    expect(queue.pendingCount).toBe(0);

    release[1]();
    release[2]();
    release[3]();
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3]);
    expect(queue.activeCount).toBe(0);
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
