import { describe, expect, it } from 'vitest';
import {
  cancelExportTask,
  clampExportConcurrency,
  createExportTask,
  failExportTask,
  finishExportTask,
  startExportTaskSlots,
  startNextExportTask,
  updateExportTaskProgress,
  type FfmpegExportPlan
} from '../src';

const plan: FfmpegExportPlan = {
  inputs: [],
  filterComplex: 'color=c=black[vout];anullsrc[aout]',
  maps: ['-map', '[vout]', '-map', '[aout]'],
  outputArgs: ['out.mp4'],
  fullArgs: ['-y', 'out.mp4'],
  warnings: [],
  textArtifacts: [],
  duration: 1
};

describe('export queue helpers', () => {
  it('creates, starts, updates, and finishes tasks', () => {
    const task = createExportTask({ id: 'task-1', name: 'Export', outputPath: 'out.mp4', plan, now: 't0' });
    expect(task.status).toBe('pending');

    let tasks = startNextExportTask([task], 't1');
    expect(tasks[0].status).toBe('running');
    expect(tasks[0].startedAt).toBe('t1');

    tasks = updateExportTaskProgress(tasks, 'task-1', 1.5);
    expect(tasks[0].progress).toBe(1);

    tasks = finishExportTask(tasks, 'task-1', 't2');
    expect(tasks[0].status).toBe('success');
    expect(tasks[0].finishedAt).toBe('t2');
  });

  it('keeps only one running task and supports cancel/error states', () => {
    const tasks = [
      createExportTask({ id: 'a', name: 'A', outputPath: 'a.mp4', plan }),
      createExportTask({ id: 'b', name: 'B', outputPath: 'b.mp4', plan })
    ];
    let next = startNextExportTask(tasks);
    next = startNextExportTask(next);
    expect(next.filter((task) => task.status === 'running')).toHaveLength(1);

    next = cancelExportTask(next, 'b', 'cancel');
    expect(next[1].status).toBe('canceled');

    next = failExportTask(next, 'a', 'ffmpeg failed', 'error');
    expect(next[0].status).toBe('error');
    expect(next[0].error).toBe('ffmpeg failed');
  });

  it('starts pending tasks until concurrent slots are full', () => {
    const tasks = [
      createExportTask({ id: 'a', name: 'A', outputPath: 'a.mp4', plan }),
      createExportTask({ id: 'b', name: 'B', outputPath: 'b.mp4', plan }),
      createExportTask({ id: 'c', name: 'C', outputPath: 'c.mp4', plan })
    ];

    const next = startExportTaskSlots(tasks, 2, 'start');

    expect(next.map((task) => task.status)).toEqual(['running', 'running', 'pending']);
    expect(next[0].startedAt).toBe('start');
    expect(next[1].startedAt).toBe('start');
    expect(next[2].startedAt).toBeUndefined();
  });

  it('releases a concurrent slot after finish or cancel', () => {
    const running = startExportTaskSlots(
      [
        createExportTask({ id: 'a', name: 'A', outputPath: 'a.mp4', plan }),
        createExportTask({ id: 'b', name: 'B', outputPath: 'b.mp4', plan }),
        createExportTask({ id: 'c', name: 'C', outputPath: 'c.mp4', plan })
      ],
      2,
      'start'
    );

    const afterFinish = startExportTaskSlots(finishExportTask(running, 'a', 'done'), 2, 'next');
    expect(afterFinish.map((task) => task.status)).toEqual(['success', 'running', 'running']);
    expect(afterFinish[2].startedAt).toBe('next');

    const afterCancel = startExportTaskSlots(cancelExportTask(running, 'b', 'cancel'), 2, 'after-cancel');
    expect(afterCancel.map((task) => task.status)).toEqual(['running', 'canceled', 'running']);
    expect(afterCancel[2].startedAt).toBe('after-cancel');
  });

  it('clamps export concurrency to the supported range', () => {
    expect(clampExportConcurrency(Number.NaN)).toBe(2);
    expect(clampExportConcurrency(0)).toBe(1);
    expect(clampExportConcurrency(3.6)).toBe(4);
    expect(clampExportConcurrency(8)).toBe(4);
  });
});
