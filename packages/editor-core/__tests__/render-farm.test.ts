import { describe, expect, it } from 'vitest';
import {
  buildRenderFarmConcatList,
  buildRenderFarmConcatPlan,
  buildRenderFarmSegmentPath,
  buildRenderFarmSegmentPlan,
  calculateRenderFarmProgress,
  calculateRenderFarmSegments,
  clampRenderFarmInstances,
  runRenderFarmWithFallback,
  suggestRenderFarmInstances,
  type FfmpegExportPlan,
  type RenderFarmSegmentStatus
} from '../src';

const basePlan: FfmpegExportPlan = {
  inputs: [],
  filterComplex: 'color=c=black[vout]',
  maps: ['-map', '[vout]'],
  outputArgs: ['-c:v', 'libx264', 'C:/Exports/final.mp4'],
  fullArgs: ['-y', '-filter_complex', 'color=c=black[vout]', '-map', '[vout]', '-c:v', 'libx264', 'C:/Exports/final.mp4'],
  warnings: [],
  textArtifacts: [],
  nestedPlans: [],
  duration: 95
};

describe('render farm export helpers', () => {
  it('suggests bounded render instances from CPU cores', () => {
    expect(suggestRenderFarmInstances(undefined)).toBe(1);
    expect(suggestRenderFarmInstances(Number.NaN)).toBe(1);
    expect(suggestRenderFarmInstances(2)).toBe(1);
    expect(suggestRenderFarmInstances(8)).toBe(2);
    expect(suggestRenderFarmInstances(32)).toBe(4);
    expect(clampRenderFarmInstances(Number.NaN)).toBe(1);
    expect(clampRenderFarmInstances(2.4)).toBe(2);
  });

  it('calculates 30 second render segments only for tasks over 60 seconds', () => {
    expect(calculateRenderFarmSegments(Number.NaN)).toEqual([]);
    expect(calculateRenderFarmSegments(60)).toEqual([]);
    expect(calculateRenderFarmSegments(95).map((segment) => ({ start: segment.start, duration: segment.duration }))).toEqual([
      { start: 0, duration: 31.667 },
      { start: 31.667, duration: 31.667 },
      { start: 63.334, duration: 31.666 }
    ]);
  });

  it('builds segment and concat FFmpeg args without shell strings', () => {
    const segment: RenderFarmSegmentStatus = {
      id: 'segment-1',
      index: 0,
      start: 30,
      duration: 30,
      outputPath: 'C:/Temp/open-factory/segments/task-segment-01.mp4',
      status: 'pending',
      progress: 0
    };
    const segmentPlan = buildRenderFarmSegmentPlan(basePlan, segment);
    expect(segmentPlan.fullArgs.slice(-5)).toEqual(['-ss', '30', '-t', '30', 'C:/Temp/open-factory/segments/task-segment-01.mp4']);

    const concatList = buildRenderFarmConcatList([segment]);
    expect(concatList).toBe("file 'C:/Temp/open-factory/segments/task-segment-01.mp4'\n");

    const concatPlan = buildRenderFarmConcatPlan([segment], 'C:/Exports/final.mp4', 'C:/Temp/open-factory/segments/task-concat.txt');
    expect(concatPlan.fullArgs).toEqual(['-y', '-f', 'concat', '-safe', '0', '-i', 'C:/Temp/open-factory/segments/task-concat.txt', '-c', 'copy', 'C:/Exports/final.mp4']);
  });

  it('sanitizes segment paths and handles plans without existing output args', () => {
    expect(buildRenderFarmSegmentPath('C:/Temp/open-factory/segments///', 'task:id*bad', 0, 'C:/Exports/final')).toBe(
      'C:/Temp/open-factory/segments/task_id_bad-segment-01.mp4'
    );
    const segment: RenderFarmSegmentStatus = {
      id: 'segment-1',
      index: 0,
      start: 0.3333333,
      duration: 0.6666666,
      outputPath: 'C:/Temp/open-factory/segments/task-segment-01.mov',
      status: 'pending',
      progress: 0
    };
    const segmentPlan = buildRenderFarmSegmentPlan({ ...basePlan, fullArgs: [], outputArgs: [] }, segment);
    expect(segmentPlan.fullArgs).toEqual(['-ss', '0.333', '-t', '0.667', 'C:/Temp/open-factory/segments/task-segment-01.mov']);
    expect(segmentPlan.outputArgs).toEqual(['C:/Temp/open-factory/segments/task-segment-01.mov']);
  });

  it('calculates weighted segment progress with clamping', () => {
    expect(calculateRenderFarmProgress([])).toBe(0);
    expect(
      calculateRenderFarmProgress([
        { duration: 10, progress: 1.5 },
        { duration: 30, progress: 0.25 },
        { duration: -10, progress: 1 }
      ])
    ).toBe(0.4375);
  });

  it('runs the original plan when render farm is disabled or ineligible', async () => {
    const calls: string[] = [];
    const disabled = await runRenderFarmWithFallback({
      taskId: 'disabled-task',
      outputPath: 'C:/Exports/final.mp4',
      plan: basePlan,
      config: { enabled: false, maxInstances: 2 },
      tempSegmentsDir: 'C:/Temp/open-factory/segments',
      runPlan: async (_plan, taskId) => {
        calls.push(taskId);
        return { report: {} };
      },
      writeFile: async () => undefined,
      removeFile: async () => undefined
    });
    const ineligible = await runRenderFarmWithFallback({
      taskId: 'short-task',
      outputPath: 'C:/Exports/short.mp4',
      plan: { ...basePlan, duration: 60 },
      config: { enabled: true, maxInstances: 2 },
      tempSegmentsDir: 'C:/Temp/open-factory/segments',
      runPlan: async (_plan, taskId) => {
        calls.push(taskId);
        return {};
      },
      writeFile: async () => undefined,
      removeFile: async () => undefined
    });

    expect(disabled.usedFallback).toBe(false);
    expect(disabled.report).toEqual({});
    expect(ineligible.usedFallback).toBe(false);
    expect(calls).toEqual(['disabled-task', 'short-task']);
  });

  it('renders all segments, writes concat input, and cleans temporary files', async () => {
    const calls: string[] = [];
    const writes: Array<{ path: string; contents: string }> = [];
    const removed: string[] = [];
    const segmentSnapshots: RenderFarmSegmentStatus[][] = [];
    const updates: RenderFarmSegmentStatus[] = [];
    const progress: number[] = [];
    const outcome = await runRenderFarmWithFallback({
      taskId: 'task-render-farm',
      outputPath: 'C:/Exports/final.mp4',
      plan: basePlan,
      config: { enabled: true, maxInstances: 1 },
      tempSegmentsDir: 'C:/Temp/open-factory/segments',
      runPlan: async (plan, taskId) => {
        calls.push(taskId);
        if (taskId.endsWith(':concat')) {
          expect(plan.fullArgs).toContain('C:/Temp/open-factory/segments/task-render-farm-concat.txt');
          return { report: {} };
        }
        expect(plan.fullArgs).toContain('-ss');
        expect(plan.fullArgs.at(-1)).toContain('/segments/task-render-farm-segment-');
        return {};
      },
      writeFile: async (path, contents) => {
        writes.push({ path, contents });
      },
      removeFile: async (path) => {
        removed.push(path);
      },
      onSegments: (segments) => {
        segmentSnapshots.push(segments.map((segment) => ({ ...segment })));
      },
      onSegmentUpdate: (segment) => {
        updates.push({ ...segment });
      },
      onProgress: (value) => {
        progress.push(value);
      }
    });

    expect(outcome.usedFallback).toBe(false);
    expect(outcome.report).toEqual({});
    expect(calls).toEqual(['task-render-farm:segment-1', 'task-render-farm:segment-2', 'task-render-farm:segment-3', 'task-render-farm:concat']);
    expect(segmentSnapshots[0]).toHaveLength(3);
    expect(updates.filter((segment) => segment.status === 'success')).toHaveLength(3);
    expect(progress.at(-1)).toBeCloseTo(0.95);
    expect(writes).toEqual([
      {
        path: 'C:/Temp/open-factory/segments/task-render-farm-concat.txt',
        contents:
          "file 'C:/Temp/open-factory/segments/task-render-farm-segment-01.mp4'\nfile 'C:/Temp/open-factory/segments/task-render-farm-segment-02.mp4'\nfile 'C:/Temp/open-factory/segments/task-render-farm-segment-03.mp4'\n"
      }
    ]);
    expect(removed).toEqual([
      'C:/Temp/open-factory/segments/task-render-farm-segment-01.mp4',
      'C:/Temp/open-factory/segments/task-render-farm-segment-02.mp4',
      'C:/Temp/open-factory/segments/task-render-farm-segment-03.mp4',
      'C:/Temp/open-factory/segments/task-render-farm-concat.txt'
    ]);
  });

  it('falls back to the whole render when a segment fails', async () => {
    const calls: string[] = [];
    const removed: string[] = [];
    const outcome = await runRenderFarmWithFallback({
      taskId: 'task-render-farm',
      outputPath: 'C:/Exports/final.mp4',
      plan: basePlan,
      config: { enabled: true, maxInstances: 2 },
      tempSegmentsDir: 'C:/Temp/open-factory/segments',
      runPlan: async (_plan, taskId) => {
        calls.push(taskId);
        if (taskId === 'task-render-farm:segment-2') {
          throw new Error('segment failed');
        }
        return {};
      },
      writeFile: async () => undefined,
      removeFile: async (path) => {
        removed.push(path);
      }
    });

    expect(outcome.usedFallback).toBe(true);
    expect(calls).toContain('task-render-farm:segment-1');
    expect(calls).toContain('task-render-farm:segment-2');
    expect(calls.at(-1)).toBe('task-render-farm');
    expect(removed.some((path) => path.endsWith('task-render-farm-concat.txt'))).toBe(true);
    expect(removed.filter((path) => path.includes('-segment-'))).toHaveLength(3);
  });
});
