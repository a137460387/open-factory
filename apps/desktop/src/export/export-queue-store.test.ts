import { beforeEach, describe, expect, it } from 'vitest';
import type { ExportTask, FfmpegExportPlan } from '@open-factory/editor-core';
import { useExportQueueStore } from './export-queue-store';

const plan: FfmpegExportPlan = {
  inputs: [{ index: 0, path: 'C:/Media/input.mp4', args: ['-i', 'C:/Media/input.mp4'] }],
  filterComplex: '',
  maps: [],
  outputArgs: ['C:/Exports/output.mp4'],
  fullArgs: ['-i', 'C:/Media/input.mp4', 'C:/Exports/output.mp4'],
  warnings: [],
  textArtifacts: [],
  nestedPlans: [],
  duration: 8,
};

function interruptedProgressiveTask(): ExportTask {
  return {
    id: 'progressive-task',
    name: 'output.mp4',
    outputPath: 'C:/Exports/output.mp4',
    plan,
    priority: 'normal',
    status: 'interrupted',
    progress: 0.5,
    createdAt: '2026-06-16T00:00:00.000Z',
    error: 'paused',
    progressive: {
      enabled: true,
      supported: true,
      partialPath: 'C:/Exports/output.partial.mp4',
      completedDuration: 4,
    },
  };
}

describe('export queue store progressive resume', () => {
  beforeEach(() => {
    useExportQueueStore.setState({
      tasks: [],
      history: [],
      runnerActive: false,
      resourcePaused: false,
      queuePaused: false,
      maxConcurrent: 2,
      lastCompletedPath: undefined,
    });
  });

  it('keeps completed duration when retrying an interrupted progressive task', () => {
    useExportQueueStore.getState().restoreTasks([interruptedProgressiveTask()]);
    useExportQueueStore.getState().retryTask('progressive-task');

    const task = useExportQueueStore.getState().tasks[0];
    expect(task.status).toBe('pending');
    expect(task.progressive?.completedDuration).toBe(4);
    expect(task.progress).toBe(0.5);
    expect(task.error).toBeUndefined();
  });
});
