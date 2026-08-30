/**
 * Video Generation Store — Race Condition / Seq Guard Tests
 *
 * Verifies that the monotonic seq counter prevents stale DB overwrites
 * when rapid status updates fire concurrently.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock the bridge module so we can spy on updateVideoGenTaskStatus calls
const mockUpdateStatus = vi.fn();
const mockSaveTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockCleanupTasks = vi.fn();
const mockListTasks = vi.fn();

vi.mock('../lib/tauri-bridge/video-gen', () => ({
  saveVideoGenTask: (...args: unknown[]) => mockSaveTask(...args),
  updateVideoGenTaskStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  deleteVideoGenTask: (...args: unknown[]) => mockDeleteTask(...args),
  cleanupVideoGenTasks: (...args: unknown[]) => mockCleanupTasks(...args),
  listVideoGenTasks: (...args: unknown[]) => mockListTasks(...args),
}));

import { useVideoGenQueueStore } from './video-gen-store';

function resetStore() {
  useVideoGenQueueStore.setState({
    tasks: [],
    activeTaskId: null,
    maxConcurrent: 1,
    taskSeqMap: new Map(),
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockUpdateStatus.mockResolvedValue(undefined);
  mockSaveTask.mockResolvedValue(undefined);
  mockDeleteTask.mockResolvedValue(undefined);
  mockCleanupTasks.mockResolvedValue(undefined);
  mockListTasks.mockResolvedValue([]);
});

describe('video-gen-store seq guard', () => {
  it('passes seq=0 on initial addTask', () => {
    const store = useVideoGenQueueStore.getState();
    store.addTask({
      prompt: 'test prompt',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });

    // saveVideoGenTask is called with seq=0
    expect(mockSaveTask).toHaveBeenCalledTimes(1);
    const dbArg = mockSaveTask.mock.calls[0][0];
    expect(dbArg.seq).toBe(0);
  });

  it('increments seq on each startNextTask call', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });

    store.startNextTask();

    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
    const seqArg = mockUpdateStatus.mock.calls[0][9]; // 10th positional arg
    expect(seqArg).toBe(1);

    // Reset to queued and start again
    useVideoGenQueueStore.setState((s) => ({
      tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'queued' as const } : t)),
      activeTaskId: null,
    }));
    store.startNextTask();

    expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
    const seqArg2 = mockUpdateStatus.mock.calls[1][9];
    expect(seqArg2).toBe(2);
  });

  it('increments seq on updateTaskProgress', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });

    // Start task first (seq becomes 1)
    store.startNextTask();

    // Progress update (seq becomes 2)
    store.updateTaskProgress(task.id, 0.5, 'generating');

    expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
    const seqArg = mockUpdateStatus.mock.calls[1][9];
    expect(seqArg).toBe(2);
  });

  it('rapid sequential progress updates produce strictly increasing seq values', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });
    store.startNextTask(); // seq=1

    // Simulate rapid progress updates
    store.updateTaskProgress(task.id, 0.1, 'step1'); // seq=2
    store.updateTaskProgress(task.id, 0.3, 'step2'); // seq=3
    store.updateTaskProgress(task.id, 0.5, 'step3'); // seq=4
    store.updateTaskProgress(task.id, 0.7, 'step4'); // seq=5
    store.updateTaskProgress(task.id, 0.9, 'step5'); // seq=6
    store.completeTask(task.id, '/path/to/video.mp4'); // seq=7

    // All calls should have strictly increasing seq
    const seqValues = mockUpdateStatus.mock.calls.map((call: unknown[]) => call[9] as number);
    for (let i = 1; i < seqValues.length; i++) {
      expect(seqValues[i]).toBeGreaterThan(seqValues[i - 1]);
    }
    expect(seqValues).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('completeTask produces seq higher than any progress update', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });
    store.startNextTask();

    store.updateTaskProgress(task.id, 0.5, 'generating');
    store.completeTask(task.id, '/output.mp4');

    const lastCall = mockUpdateStatus.mock.calls[mockUpdateStatus.mock.calls.length - 1];
    expect(lastCall[0]).toBe(task.id); // id
    expect(lastCall[1]).toBe('completed'); // status
    expect(lastCall[2]).toBe(1); // progress
    expect(lastCall[9]).toBe(3); // seq (start=1, progress=2, complete=3)
  });

  it('failTask also produces correct seq', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });
    store.startNextTask(); // seq=1
    store.updateTaskProgress(task.id, 0.3, 'step'); // seq=2
    store.failTask(task.id, 'GPU OOM', 'gpu_unavailable'); // seq=3

    expect(mockUpdateStatus).toHaveBeenCalledTimes(3);
    const failCall = mockUpdateStatus.mock.calls[2];
    expect(failCall[0]).toBe(task.id);
    expect(failCall[1]).toBe('failed');
    expect(failCall[5]).toBe('GPU OOM'); // errorMessage
    expect(failCall[6]).toBe('gpu_unavailable'); // errorType
    expect(failCall[9]).toBe(3); // seq
  });

  it('cancelTask produces correct seq', () => {
    const store = useVideoGenQueueStore.getState();
    const task = store.addTask({
      prompt: 'test',
      numFrames: 16,
      resolution: 512,
      fps: 24,
      steps: 20,
      cfgScale: 7.5,
    });
    store.startNextTask(); // seq=1
    store.cancelTask(task.id); // seq=2

    expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
    const cancelCall = mockUpdateStatus.mock.calls[1];
    expect(cancelCall[0]).toBe(task.id);
    expect(cancelCall[1]).toBe('canceled');
    expect(cancelCall[9]).toBe(2);
  });

  it('taskSeqMap is seeded from DB on init', async () => {
    mockListTasks.mockResolvedValue([
      {
        id: 'db-task-1',
        status: 'running',
        progress: 0.5,
        stage: 'generating',
        input_path: null,
        prompt: 'test',
        negative_prompt: null,
        steps: 20,
        guidance_scale: 7.5,
        fps: 24,
        num_frames: 16,
        resolution: 512,
        output_dir: null,
        output_path: null,
        error_message: null,
        error_type: null,
        created_at: '2026-07-29T00:00:00Z',
        started_at: '2026-07-29T00:00:01Z',
        completed_at: null,
        seq: 5,
      },
    ]);

    const store = useVideoGenQueueStore.getState();
    await store.init();

    // taskSeqMap should be seeded with seq=5 from DB
    const seqMap = useVideoGenQueueStore.getState().taskSeqMap;
    expect(seqMap.get('db-task-1')).toBe(5);

    // Next update should use seq=6
    useVideoGenQueueStore.getState().updateTaskProgress('db-task-1', 0.8, 'almost_done');
    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
    const seqArg = mockUpdateStatus.mock.calls[0][9];
    expect(seqArg).toBe(6);
  });
});
