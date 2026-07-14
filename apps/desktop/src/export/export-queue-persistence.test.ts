import { describe, expect, it } from 'vitest';
import type { ExportTask, FfmpegExportPlan } from '@open-factory/editor-core';
import {
  parseExportQueueState,
  serializeExportQueueState,
  shouldPersistExportQueueState,
  shouldShowExportQueueRecoveryDialog,
} from './export-queue-persistence';

const plan: FfmpegExportPlan = {
  inputs: [{ index: 0, path: 'C:/Media/input.mp4', args: ['-i', 'C:/Media/input.mp4'] }],
  filterComplex: '',
  maps: [],
  outputArgs: ['C:/Exports/output.mp4'],
  fullArgs: ['-i', 'C:/Media/input.mp4', 'C:/Exports/output.mp4'],
  warnings: [],
  textArtifacts: [],
  nestedPlans: [],
  duration: 6,
};

function task(overrides: Partial<ExportTask> = {}): ExportTask {
  return {
    id: overrides.id ?? 'task-1',
    name: overrides.name ?? 'output.mp4',
    projectName: 'Project',
    outputPath: overrides.outputPath ?? 'C:/Exports/output.mp4',
    plan,
    priority: overrides.priority ?? 'normal',
    status: overrides.status ?? 'pending',
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-06-15T00:00:00.000Z',
    startedAt: overrides.startedAt,
    finishedAt: overrides.finishedAt,
    error: overrides.error,
    report: overrides.report,
    progressive: overrides.progressive,
  };
}

describe('export queue persistence', () => {
  it('serializes only restorable queue tasks', () => {
    const serialized = serializeExportQueueState(
      [
        task({ id: 'pending', status: 'pending' }),
        task({ id: 'running', status: 'running', progress: 0.4 }),
        task({ id: 'done', status: 'success', progress: 1 }),
      ],
      '2026-06-15T01:00:00.000Z',
    );

    const parsed = JSON.parse(serialized) as { tasks: ExportTask[] };
    expect(parsed.tasks.map((item) => item.id)).toEqual(['pending', 'running']);
  });

  it('deserializes pending tasks and marks running tasks as interrupted', () => {
    const serialized = serializeExportQueueState([
      task({ id: 'pending', status: 'pending', progress: 0.8 }),
      task({ id: 'running', status: 'running', progress: 0.35, startedAt: '2026-06-15T00:30:00.000Z' }),
    ]);

    const recovery = parseExportQueueState(serialized, '导出被中断。');
    expect(recovery?.pendingCount).toBe(1);
    expect(recovery?.interruptedCount).toBe(1);
    expect(recovery?.tasks.map((item) => [item.id, item.status, item.progress, item.error])).toEqual([
      ['pending', 'pending', 0, undefined],
      ['running', 'interrupted', 0.35, '导出被中断。'],
    ]);
  });

  it('preserves progressive export resume state during recovery', () => {
    const serialized = serializeExportQueueState([
      task({
        id: 'running-progressive',
        status: 'running',
        progress: 0.5,
        progressive: {
          enabled: true,
          supported: true,
          partialPath: 'C:/Exports/output.partial.mp4',
          completedDuration: 3,
        },
      }),
    ]);

    const recovery = parseExportQueueState(serialized, '导出被中断。');

    expect(recovery?.tasks[0]).toMatchObject({
      id: 'running-progressive',
      status: 'interrupted',
      progressive: {
        partialPath: 'C:/Exports/output.partial.mp4',
        completedDuration: 3,
      },
    });
  });

  it('triggers recovery dialog only for pending or interrupted tasks', () => {
    expect(shouldShowExportQueueRecoveryDialog([task({ status: 'pending' })])).toBe(true);
    expect(shouldShowExportQueueRecoveryDialog([task({ status: 'interrupted' })])).toBe(true);
    expect(shouldShowExportQueueRecoveryDialog([task({ status: 'success' })])).toBe(false);
  });

  it('skips persistence when only progress changes but writes status changes', () => {
    const previous = [task({ status: 'running', progress: 0.1 })];
    const progressOnly = [task({ status: 'running', progress: 0.9 })];
    const statusChanged = [task({ status: 'success', progress: 1 })];

    expect(shouldPersistExportQueueState(previous, progressOnly)).toBe(false);
    expect(shouldPersistExportQueueState(previous, statusChanged)).toBe(true);
  });
});
