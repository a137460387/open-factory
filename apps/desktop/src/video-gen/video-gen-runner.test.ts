/**
 * Video Generation Runner — Crash Recovery Tests
 *
 * Verifies that startVideoGenRunner() correctly handles crash recovery:
 * - Tasks with status='running' + outputPath → marked completed
 * - Tasks with status='running' + no outputPath → reset to queued
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Tauri event
const mockListen = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// Mock bridge
const mockUpdateStatus = vi.fn();
vi.mock('../lib/tauri-bridge/video-gen', () => ({
  updateVideoGenTaskStatus: (...args: unknown[]) => mockUpdateStatus(...args),
}));

// Mock IndexedDB persistence
vi.mock('../lib/generation-history-db', () => ({
  saveTaskProgress: vi.fn().mockResolvedValue(undefined),
  deleteTaskProgress: vi.fn().mockResolvedValue(undefined),
}));

import { useVideoGenQueueStore } from './video-gen-store';
import { startVideoGenRunner, stopVideoGenRunner } from './video-gen-runner';

function resetStore() {
  useVideoGenQueueStore.setState({
    tasks: [],
    activeTaskId: null,
    maxConcurrent: 1,
    taskSeqMap: new Map(),
  });
}

function seedRunningTask(id: string, overrides: Partial<{ videoPath: string | null; status: string }> = {}) {
  const task = {
    id,
    params: {
      prompt: 'test prompt',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    },
    status: (overrides.status ?? 'running') as 'running' | 'queued',
    progress: 0.5,
    stage: 'generating',
    videoPath: overrides.videoPath ?? null,
    error: null,
    errorType: null,
    createdAt: Date.now() - 60000,
    startedAt: Date.now() - 30000,
    finishedAt: null,
  };
  useVideoGenQueueStore.setState((s) => ({
    tasks: [...s.tasks, task],
    activeTaskId: id,
    taskSeqMap: new Map([...s.taskSeqMap, [id, 3]]),
  }));
  return task;
}

beforeEach(() => {
  stopVideoGenRunner(); // reset runnerActive flag
  resetStore();
  vi.clearAllMocks();
  mockUpdateStatus.mockResolvedValue(undefined);
  mockListen.mockResolvedValue(() => {}); // returns unlisten fn
});

describe('video-gen-runner crash recovery', () => {
  it('marks running task with outputPath as completed on recovery', async () => {
    seedRunningTask('task-1', { videoPath: '/output/video.mp4' });
    await startVideoGenRunner();

    const store = useVideoGenQueueStore.getState();
    const task = store.getTask('task-1');

    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect(task!.progress).toBe(1);
    expect(task!.stage).toBe('completed');
    expect(task!.videoPath).toBe('/output/video.mp4');
    expect(task!.finishedAt).toBeTypeOf('number');

    // Should have called updateVideoGenTaskStatus with 'completed' and seq > 3
    expect(mockUpdateStatus).toHaveBeenCalled();
    const call = mockUpdateStatus.mock.calls.find((c: unknown[]) => c[0] === 'task-1' && c[1] === 'completed');
    expect(call).toBeDefined();
    expect(call![9]).toBeGreaterThan(3); // seq must be > DB value
  });

  it('resets running task without outputPath to queued on recovery', async () => {
    seedRunningTask('task-2', { videoPath: null });
    await startVideoGenRunner();

    const store = useVideoGenQueueStore.getState();
    const task = store.getTask('task-2');

    expect(task).toBeDefined();
    expect(task!.status).toBe('queued');
    expect(task!.startedAt).toBeNull();
    expect(task!.stage).toBe('queued');

    // Should have called updateVideoGenTaskStatus with 'queued'
    expect(mockUpdateStatus).toHaveBeenCalled();
    const call = mockUpdateStatus.mock.calls.find((c: unknown[]) => c[0] === 'task-2' && c[1] === 'queued');
    expect(call).toBeDefined();
    expect(call![9]).toBe(4); // seq = 3 (from seed) + 1
  });

  it('clears activeTaskId after recovering running task with outputPath', async () => {
    seedRunningTask('task-3', { videoPath: '/output.mp4' });
    await startVideoGenRunner();

    const store = useVideoGenQueueStore.getState();
    expect(store.activeTaskId).toBeNull();
  });

  it('clears activeTaskId after resetting running task without outputPath', async () => {
    seedRunningTask('task-4', { videoPath: null });
    await startVideoGenRunner();

    const store = useVideoGenQueueStore.getState();
    expect(store.activeTaskId).toBeNull();
  });

  it('handles mixed recovery: one completed, one re-queued', async () => {
    seedRunningTask('task-done', { videoPath: '/output.mp4' });
    seedRunningTask('task-interrupted', { videoPath: null });

    await startVideoGenRunner();

    const store = useVideoGenQueueStore.getState();
    expect(store.getTask('task-done')!.status).toBe('completed');
    expect(store.getTask('task-interrupted')!.status).toBe('queued');
    expect(store.activeTaskId).toBeNull();
  });

  it('does not touch queued or completed tasks during recovery', async () => {
    useVideoGenQueueStore.setState((s) => ({
      tasks: [
        ...s.tasks,
        {
          id: 'queued-task',
          params: { prompt: 'test', numFrames: 16, resolution: 512, fps: 24, steps: 20, cfgScale: 7.5 },
          status: 'queued' as const,
          progress: 0,
          stage: 'queued',
          videoPath: null,
          error: null,
          errorType: null,
          createdAt: Date.now(),
          startedAt: null,
          finishedAt: null,
        },
        {
          id: 'completed-task',
          params: { prompt: 'test', numFrames: 16, resolution: 512, fps: 24, steps: 20, cfgScale: 7.5 },
          status: 'completed' as const,
          progress: 1,
          stage: 'completed',
          videoPath: '/video.mp4',
          error: null,
          errorType: null,
          createdAt: Date.now() - 60000,
          startedAt: Date.now() - 30000,
          finishedAt: Date.now() - 5000,
        },
      ],
    }));

    await startVideoGenRunner();

    // updateVideoGenTaskStatus should NOT be called for these tasks
    const callsForQueued = mockUpdateStatus.mock.calls.filter((c: unknown[]) => c[0] === 'queued-task');
    const callsForCompleted = mockUpdateStatus.mock.calls.filter((c: unknown[]) => c[0] === 'completed-task');
    expect(callsForQueued).toHaveLength(0);
    expect(callsForCompleted).toHaveLength(0);
  });

  it('is idempotent — calling startVideoGenRunner twice does not duplicate recovery', async () => {
    seedRunningTask('task-idem', { videoPath: '/output.mp4' });

    await startVideoGenRunner();
    await startVideoGenRunner(); // second call should be no-op

    // updateVideoGenTaskStatus should only be called once for this task
    const calls = mockUpdateStatus.mock.calls.filter((c: unknown[]) => c[0] === 'task-idem');
    expect(calls).toHaveLength(1);
  });
});
