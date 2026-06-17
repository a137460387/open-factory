import { describe, expect, it } from 'vitest';
import {
  applyLowPowerThreads,
  buildSharedDecodeCacheKey,
  calculateLowPowerThreadCount,
  canRunExportTasksInParallel,
  createExportTask,
  detectSharedDecodeCacheHits,
  estimateExportResourceNeeds,
  isExportPlanParallelEligible,
  startResourceAwareExportTaskSlots,
  startExportTaskSlots,
  type FfmpegExportPlan
} from '../src';

function plan(patch: Partial<FfmpegExportPlan> = {}): FfmpegExportPlan {
  return {
    settings: { width: 1920, height: 1080, fps: 30, outputPath: 'C:/Exports/out.mp4' } as never,
    inputs: [{ index: 0, path: 'C:/Media/source.mp4', args: ['-i', 'C:/Media/source.mp4'] }],
    filterComplex: '',
    maps: [],
    outputArgs: ['-c:v', 'libx264', 'C:/Exports/out.mp4'],
    fullArgs: ['-y', '-i', 'C:/Media/source.mp4', '-c:v', 'libx264', 'C:/Exports/out.mp4'],
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    duration: 10,
    ...patch
  };
}

describe('export scheduling helpers', () => {
  it('estimates higher memory needs as effect count grows', () => {
    const simple = estimateExportResourceNeeds(plan());
    const effects = estimateExportResourceNeeds(
      plan({
        filterComplex: '[0:v]scale=1920:1080,unsharp=3:3:0.5,deblock=filter=strong:block=4,colorlevels=rimin=0.02:rimax=0.98,overlay=0:0,drawtext=text=Demo[v]'
      })
    );

    expect(effects.effectCount).toBeGreaterThan(simple.effectCount);
    expect(effects.memoryMb).toBeGreaterThan(simple.memoryMb + 500);
    expect(effects.cpuCost).toBeGreaterThan(simple.cpuCost);
  });

  it('includes nested plans, high resolution, and multi-input reasons in resource estimates', () => {
    const simple = estimateExportResourceNeeds(plan());
    const nested = estimateExportResourceNeeds(
      plan({
        settings: { width: 3840, height: 2160, fps: 60, outputPath: 'C:/Exports/out.mp4' } as never,
        inputs: [
          { index: 0, path: 'C:/Media/a.mp4', args: ['-i', 'C:/Media/a.mp4'] },
          { index: 1, path: 'C:/Media/b.mp4', args: ['-i', 'C:/Media/b.mp4'] },
          { index: 2, path: 'C:/Media/c.mp4', args: ['-i', 'C:/Media/c.mp4'] }
        ],
        filterComplex: '[0:v]scale=3840:2160[v]',
        nestedPlans: [
          {
            sequenceId: 'nested',
            placeholder: '{nested}',
            plan: plan({ filterComplex: '[0:v]deblock=filter=strong:block=4,overlay=0:0[v]' })
          }
        ]
      })
    );

    expect(nested.memoryMb).toBeGreaterThan(simple.memoryMb);
    expect(nested.cpuCost).toBeGreaterThan(simple.cpuCost);
    expect(nested.reasons).toEqual(expect.arrayContaining(['effects:1', 'resolution:3840x2160', 'inputs:3']));
  });

  it('marks heavy temporal filters as not parallel eligible', () => {
    const heavy = plan({ filterComplex: '[0:v]minterpolate=fps=60:mi_mode=mci[v]' });

    expect(isExportPlanParallelEligible(plan())).toBe(true);
    expect(isExportPlanParallelEligible(heavy)).toBe(false);
    expect(canRunExportTasksInParallel(plan(), heavy)).toBe(false);
  });

  it('starts light tasks in parallel but keeps a heavy task exclusive', () => {
    const lightA = createExportTask({ id: 'light-a', name: 'A', outputPath: 'a.mp4', plan: plan(), now: '2026-01-01T00:00:00.000Z' });
    const lightB = createExportTask({ id: 'light-b', name: 'B', outputPath: 'b.mp4', plan: plan({ outputArgs: ['b.mp4'], fullArgs: ['b.mp4'] }), now: '2026-01-01T00:00:01.000Z' });
    const heavyNormal = createExportTask({
      id: 'heavy',
      name: 'Heavy',
      outputPath: 'heavy.mp4',
      plan: plan({ filterComplex: '[0:v]minterpolate=fps=60:mi_mode=mci[v]', outputArgs: ['heavy.mp4'], fullArgs: ['heavy.mp4'] }),
      now: '2026-01-01T00:00:02.000Z'
    });
    const heavyHigh = { ...heavyNormal, id: 'heavy-high', priority: 'high' as const };

    expect(startExportTaskSlots([lightA, lightB, heavyNormal], 2, 'start').map((task) => task.status)).toEqual(['running', 'running', 'pending']);

    expect(startExportTaskSlots([heavyHigh, lightA, lightB], 2, 'start').map((task) => task.status)).toEqual(['running', 'pending', 'pending']);
  });

  it('detects shared decode cache hits for matching source ranges', () => {
    const first = plan({ outputArgs: ['-ss', '5', '-t', '8', 'C:/Exports/a.mp4'], fullArgs: ['-ss', '5', '-t', '8', 'C:/Exports/a.mp4'], duration: 8 });
    const second = plan({ outputArgs: ['-ss', '5', '-t', '8', 'C:/Exports/b.mp4'], fullArgs: ['-ss', '5', '-t', '8', 'C:/Exports/b.mp4'], duration: 8 });
    const miss = plan({ outputArgs: ['-ss', '12', '-t', '8', 'C:/Exports/c.mp4'], fullArgs: ['-ss', '12', '-t', '8', 'C:/Exports/c.mp4'], duration: 8 });

    expect(buildSharedDecodeCacheKey(first)).toBe(buildSharedDecodeCacheKey(second));
    expect(detectSharedDecodeCacheHits([{ id: 'a', plan: first }, { id: 'b', plan: second }, { id: 'c', plan: miss }])).toEqual([
      expect.objectContaining({
        taskIds: ['a', 'b'],
        startSeconds: 5,
        durationSeconds: 8
      })
    ]);
  });

  it('adds low-power thread limits without duplicating existing thread args', () => {
    const lowPower = applyLowPowerThreads(
      plan({
        outputArgs: ['-threads', '8', '-c:v', 'libx264', 'C:/Exports/out.mp4'],
        fullArgs: ['-y', '-threads', '8', '-i', 'C:/Media/source.mp4', '-c:v', 'libx264', 'C:/Exports/out.mp4']
      }),
      true,
      8
    );

    expect(calculateLowPowerThreadCount(8)).toBe(4);
    expect(lowPower.outputArgs).toEqual(['-c:v', 'libx264', '-threads', '4', 'C:/Exports/out.mp4']);
    expect(lowPower.fullArgs.filter((arg) => arg === '-threads')).toHaveLength(1);
    expect(applyLowPowerThreads(plan(), false, 8)).toBeTruthy();
  });

  it('applies low-power threads to passes and nested plans', () => {
    const lowPower = applyLowPowerThreads(
      plan({
        passes: [{ name: 'render', fullArgs: ['-threads', '12', '-i', 'in.mp4', 'out.mp4'], duration: 5, kind: 'render' }],
        nestedPlans: [
          {
            sequenceId: 'seq-b',
            placeholder: '{nested}',
            plan: plan({ fullArgs: ['-i', 'nested.mp4', 'nested-out.mp4'], outputArgs: ['nested-out.mp4'] })
          }
        ]
      }),
      true,
      undefined
    );

    expect(calculateLowPowerThreadCount(undefined)).toBe(1);
    expect(calculateLowPowerThreadCount(-4)).toBe(1);
    expect(lowPower.passes?.[0].fullArgs).toEqual(['-i', 'in.mp4', '-threads', '1', 'out.mp4']);
    expect(lowPower.nestedPlans[0].plan.fullArgs).toEqual(['-i', 'nested.mp4', '-threads', '1', 'nested-out.mp4']);
  });

  it('keeps pending tasks blocked when a running task is too heavy to share', () => {
    const runningHeavy = {
      ...createExportTask({
        id: 'running-heavy',
        name: 'Heavy',
        outputPath: 'heavy.mp4',
        plan: plan({ filterComplex: '[0:v]minterpolate=fps=60:mi_mode=mci[v]' })
      }),
      status: 'running' as const,
      startedAt: '2026-01-01T00:00:00.000Z'
    };
    const pendingLight = createExportTask({
      id: 'pending-light',
      name: 'Light',
      outputPath: 'light.mp4',
      plan: plan({ outputArgs: ['light.mp4'], fullArgs: ['light.mp4'] })
    });

    expect(startResourceAwareExportTaskSlots([runningHeavy, pendingLight], 1, 'start')).toEqual([runningHeavy, pendingLight]);
    expect(startResourceAwareExportTaskSlots([runningHeavy, pendingLight], Number.NaN, 'start')).toEqual([runningHeavy, pendingLight]);
  });

  it('normalizes shared decode cache ranges and ignores plans without inputs', () => {
    const ranged = plan({
      inputs: [{ index: 0, path: 'C:\\Media\\Source.MP4', args: ['-i', 'C:\\Media\\Source.MP4'] }],
      outputArgs: ['-ss', '-2', '-t', 'not-a-number', 'out.mp4'],
      fullArgs: ['-ss', '3.1236', '-t', '4.4564', 'out.mp4'],
      duration: 9
    });

    expect(buildSharedDecodeCacheKey(plan({ inputs: [] }))).toBeUndefined();
    expect(detectSharedDecodeCacheHits([{ id: 'empty', plan: plan({ inputs: [] }) }])).toEqual([]);
    expect(buildSharedDecodeCacheKey(plan({ outputArgs: ['out.mp4'], fullArgs: ['out.mp4'], duration: 7 }))).toBe('c:/media/source.mp4::0.000::7.000');
    expect(buildSharedDecodeCacheKey(ranged)).toBe('c:/media/source.mp4::0.000::4.456');
  });
});
