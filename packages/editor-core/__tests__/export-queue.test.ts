import { describe, expect, it } from 'vitest';
import {
  cancelExportTask,
  clampExportConcurrency,
  createExportTask,
  createExportTaskHistoryEntry,
  failExportTask,
  finishExportTask,
  normalizeExportTaskPriority,
  setExportTaskLogPath,
  sortExportQueueByPriority,
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

    tasks = finishExportTask(tasks, 'task-1', { loudness: { integratedLoudness: -14.1 } }, 't2');
    expect(tasks[0].status).toBe('success');
    expect(tasks[0].finishedAt).toBe('t2');
    expect(tasks[0].report?.loudness?.integratedLoudness).toBe(-14.1);
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

    const afterFinish = startExportTaskSlots(finishExportTask(running, 'a', undefined, 'done'), 2, 'next');
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

  it('starts and displays pending tasks by priority while preserving FIFO within a priority', () => {
    const tasks = [
      createExportTask({ id: 'low', name: 'Low', outputPath: 'low.mp4', plan, priority: 'low', now: '2026-01-01T00:00:00.000Z' }),
      createExportTask({ id: 'normal', name: 'Normal', outputPath: 'normal.mp4', plan, priority: 'normal', now: '2026-01-01T00:00:01.000Z' }),
      createExportTask({ id: 'high-a', name: 'High A', outputPath: 'high-a.mp4', plan, priority: 'high', now: '2026-01-01T00:00:02.000Z' }),
      createExportTask({ id: 'high-b', name: 'High B', outputPath: 'high-b.mp4', plan, priority: 'high', now: '2026-01-01T00:00:03.000Z' })
    ];

    expect(sortExportQueueByPriority(tasks).map((task) => task.id)).toEqual(['high-a', 'high-b', 'normal', 'low']);

    const next = startExportTaskSlots(tasks, 2, 'start');

    expect(next.find((task) => task.id === 'high-a')?.status).toBe('running');
    expect(next.find((task) => task.id === 'high-b')?.status).toBe('running');
    expect(next.find((task) => task.id === 'normal')?.status).toBe('pending');
    expect(next.find((task) => task.id === 'low')?.status).toBe('pending');
  });

  it('keeps running tasks in place when sorting visible pending priorities', () => {
    const tasks = startExportTaskSlots(
      [
        createExportTask({ id: 'running', name: 'Running', outputPath: 'running.mp4', plan, priority: 'low', now: '2026-01-01T00:00:00.000Z' }),
        createExportTask({ id: 'pending-high', name: 'High', outputPath: 'high.mp4', plan, priority: 'high', now: '2026-01-01T00:00:01.000Z' }),
        createExportTask({ id: 'pending-low', name: 'Low', outputPath: 'low.mp4', plan, priority: 'low', now: '2026-01-01T00:00:02.000Z' })
      ],
      1,
      'start'
    );

    expect(sortExportQueueByPriority(tasks).map((task) => task.id)).toEqual(['running', 'pending-high', 'pending-low']);
  });

  it('normalizes missing priorities and clamps low progress', () => {
    const task = createExportTask({ id: 'task-normal', name: 'Normal', outputPath: 'normal.mp4', plan, priority: 'unexpected' as never });

    expect(task.priority).toBe('normal');
    expect(normalizeExportTaskPriority(undefined)).toBe('normal');
    expect(normalizeExportTaskPriority('high')).toBe('high');
    expect(normalizeExportTaskPriority('low')).toBe('low');
    expect(updateExportTaskProgress([task], 'task-normal', -0.5)[0].progress).toBe(0);
  });

  it('attaches log paths and creates history entries only for completed tasks', () => {
    const [task] = setExportTaskLogPath(
      [
        createExportTask({
          id: 'task-log',
          name: 'Logged Export',
          outputPath: 'out.mp4',
          plan,
          priority: 'high',
          now: 'created'
        })
      ],
      'task-log',
      'C:/Users/AppData/open-factory/export-logs/task-log.log'
    );

    expect(task.logPath).toContain('task-log.log');
    expect(createExportTaskHistoryEntry(task)).toBeUndefined();

    const [finished] = finishExportTask([{ ...task, startedAt: 'started' }], 'task-log', undefined, 'finished');
    expect(createExportTaskHistoryEntry(finished)).toEqual({
      id: 'task-log',
      name: 'Logged Export',
      outputPath: 'out.mp4',
      status: 'success',
      priority: 'high',
      createdAt: 'created',
      startedAt: 'started',
      finishedAt: 'finished',
      logPath: 'C:/Users/AppData/open-factory/export-logs/task-log.log',
      error: undefined
    });
  });

  it('includes error details in failed task history entries', () => {
    const [failed] = failExportTask(
      [
        {
          ...createExportTask({ id: 'task-failed', name: 'Failed Export', outputPath: 'bad.mp4', plan, priority: 'low', now: 'created' }),
          startedAt: 'started',
          logPath: 'C:/logs/task-failed.log'
        }
      ],
      'task-failed',
      'ffmpeg failed',
      'failed'
    );

    expect(createExportTaskHistoryEntry(failed)).toMatchObject({
      id: 'task-failed',
      status: 'error',
      priority: 'low',
      finishedAt: 'failed',
      logPath: 'C:/logs/task-failed.log',
      error: 'ffmpeg failed'
    });
  });
});
