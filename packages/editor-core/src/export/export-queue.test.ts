import { describe, it, expect } from 'vitest';
import {
  clampExportConcurrency,
  normalizeExportTaskPriority,
  normalizeRenderFarmTaskConfig,
  normalizeProgressiveExportState,
  finishExportTask,
  failExportTask,
  cancelExportTask,
  interruptExportTask,
  setExportTaskLogPath,
  sortExportQueueByPriority,
  createExportTaskHistoryEntry,
} from './export-queue';
import type { ExportTask } from './export-queue';

function makeTask(overrides: Partial<ExportTask> = {}): ExportTask {
  return {
    id: 'task-1',
    name: 'test',
    outputPath: '/out.mp4',
    plan: { inputs: [{ path: '/src.mp4' }], output: '/out.mp4', args: [] } as any,
    priority: 'normal',
    status: 'pending',
    progress: 0,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('clampExportConcurrency', () => {
  it('clamps to 1 minimum', () => {
    expect(clampExportConcurrency(0)).toBe(1);
    expect(clampExportConcurrency(-5)).toBe(1);
  });

  it('clamps to 4 maximum', () => {
    expect(clampExportConcurrency(10)).toBe(4);
  });

  it('rounds fractional values', () => {
    expect(clampExportConcurrency(2.7)).toBe(3);
  });

  it('returns 2 for NaN', () => {
    expect(clampExportConcurrency(NaN)).toBe(2);
  });

  it('returns 2 for Infinity', () => {
    expect(clampExportConcurrency(Infinity)).toBe(2);
  });
});

describe('normalizeExportTaskPriority', () => {
  it('returns high for high', () => {
    expect(normalizeExportTaskPriority('high')).toBe('high');
  });

  it('returns low for low', () => {
    expect(normalizeExportTaskPriority('low')).toBe('low');
  });

  it('returns normal for undefined', () => {
    expect(normalizeExportTaskPriority(undefined)).toBe('normal');
  });

  it('returns normal for invalid', () => {
    expect(normalizeExportTaskPriority('urgent' as any)).toBe('normal');
  });
});

describe('normalizeRenderFarmTaskConfig', () => {
  it('returns undefined for undefined', () => {
    expect(normalizeRenderFarmTaskConfig(undefined)).toBeUndefined();
  });

  it('returns undefined for disabled', () => {
    expect(normalizeRenderFarmTaskConfig({ enabled: false, maxInstances: 2 })).toBeUndefined();
  });

  it('clamps maxInstances', () => {
    const result = normalizeRenderFarmTaskConfig({ enabled: true, maxInstances: 10 });
    expect(result?.maxInstances).toBe(4);
  });

  it('handles NaN maxInstances', () => {
    const result = normalizeRenderFarmTaskConfig({ enabled: true, maxInstances: NaN });
    expect(result?.maxInstances).toBe(1);
  });
});

describe('normalizeProgressiveExportState', () => {
  it('returns undefined for undefined', () => {
    expect(normalizeProgressiveExportState(undefined)).toBeUndefined();
  });

  it('returns undefined for disabled', () => {
    expect(
      normalizeProgressiveExportState({ enabled: false, supported: true, partialPath: '/p', completedDuration: 0 }),
    ).toBeUndefined();
  });

  it('returns undefined for unsupported', () => {
    expect(
      normalizeProgressiveExportState({ enabled: true, supported: false, partialPath: '/p', completedDuration: 0 }),
    ).toBeUndefined();
  });

  it('returns undefined for empty partialPath', () => {
    expect(
      normalizeProgressiveExportState({ enabled: true, supported: true, partialPath: '  ', completedDuration: 0 }),
    ).toBeUndefined();
  });

  it('normalizes valid state', () => {
    const result = normalizeProgressiveExportState({
      enabled: true,
      supported: true,
      partialPath: '/p',
      completedDuration: 1.5,
    });
    expect(result?.enabled).toBe(true);
    expect(result?.partialPath).toBe('/p');
  });
});

describe('finishExportTask', () => {
  it('marks task as success', () => {
    const tasks = [makeTask()];
    const result = finishExportTask(tasks, 'task-1', undefined, '2024-01-01T01:00:00Z');
    expect(result[0].status).toBe('success');
    expect(result[0].progress).toBe(1);
    expect(result[0].finishedAt).toBe('2024-01-01T01:00:00Z');
  });

  it('does not change other tasks', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const result = finishExportTask(tasks, 'a');
    expect(result[1].status).toBe('pending');
  });
});

describe('failExportTask', () => {
  it('marks task as error', () => {
    const tasks = [makeTask()];
    const result = failExportTask(tasks, 'task-1', 'something went wrong');
    expect(result[0].status).toBe('error');
    expect(result[0].error).toBe('something went wrong');
  });
});

describe('cancelExportTask', () => {
  it('cancels pending task', () => {
    const tasks = [makeTask({ status: 'pending' })];
    const result = cancelExportTask(tasks, 'task-1');
    expect(result[0].status).toBe('canceled');
  });

  it('cancels running task', () => {
    const tasks = [makeTask({ status: 'running' })];
    const result = cancelExportTask(tasks, 'task-1');
    expect(result[0].status).toBe('canceled');
  });

  it('does not cancel completed task', () => {
    const tasks = [makeTask({ status: 'success' })];
    const result = cancelExportTask(tasks, 'task-1');
    expect(result[0].status).toBe('success');
  });
});

describe('interruptExportTask', () => {
  it('interrupts running task', () => {
    const tasks = [makeTask({ status: 'running' })];
    const result = interruptExportTask(tasks, 'task-1', 'interrupted');
    expect(result[0].status).toBe('interrupted');
    expect(result[0].error).toBe('interrupted');
  });

  it('does not interrupt non-running task', () => {
    const tasks = [makeTask({ status: 'pending' })];
    const result = interruptExportTask(tasks, 'task-1');
    expect(result[0].status).toBe('pending');
  });
});

describe('setExportTaskLogPath', () => {
  it('sets log path', () => {
    const tasks = [makeTask()];
    const result = setExportTaskLogPath(tasks, 'task-1', '/log.txt');
    expect((result[0] as any).logPath).toBe('/log.txt');
  });
});

describe('sortExportQueueByPriority', () => {
  it('sorts pending tasks by priority', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 'low', status: 'pending' }),
      makeTask({ id: 'b', priority: 'high', status: 'pending' }),
      makeTask({ id: 'c', priority: 'normal', status: 'pending' }),
    ];
    const result = sortExportQueueByPriority(tasks);
    expect(result[0].priority).toBe('high');
  });

  it('preserves order for non-pending tasks', () => {
    const tasks = [makeTask({ id: 'a', status: 'running' }), makeTask({ id: 'b', status: 'pending' })];
    const result = sortExportQueueByPriority(tasks);
    expect(result[0].id).toBe('a');
  });
});

describe('createExportTaskHistoryEntry', () => {
  it('returns undefined for pending task', () => {
    expect(createExportTaskHistoryEntry(makeTask({ status: 'pending' }))).toBeUndefined();
  });

  it('creates entry for success task', () => {
    const entry = createExportTaskHistoryEntry(makeTask({ status: 'success' }));
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('success');
  });

  it('creates entry for error task', () => {
    const entry = createExportTaskHistoryEntry(makeTask({ status: 'error', error: 'fail' }));
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBe('fail');
  });
});
