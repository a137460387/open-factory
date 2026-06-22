import { describe, expect, it } from 'vitest';
import {
  appendResourceSample,
  appendExportSample,
  calculateOverloadStatus,
  clampCoefficient,
  createEmptyDashboardState,
  DEFAULT_OVERLOAD_COEFFICIENT,
  estimateSingleTaskCpuPercent,
  estimateTaskResourceUsage,
  extractExportCurve,
  finishExportRecording,
  isOverloaded,
  MAX_EXPORT_HISTORY_COUNT,
  normalizeExportHistory,
  normalizeOverloadCoefficient,
  ROLLING_WINDOW_DURATION_MS,
  startExportRecording,
  trimExportHistory,
  type ExportResourceSnapshot,
  type ResourceSample
} from '../src';
import type { ExportTask, FfmpegExportPlan } from '../src';

const basePlan: FfmpegExportPlan = {
  inputs: [{ path: 'input.mp4' }],
  filterComplex: '',
  maps: ['-map', '0'],
  outputArgs: ['out.mp4'],
  fullArgs: ['-y', '-i', 'input.mp4', '-map', '0', 'out.mp4'],
  warnings: [],
  textArtifacts: [],
  duration: 10
};

const heavyPlan: FfmpegExportPlan = {
  inputs: [{ path: 'input.mp4' }, { path: 'overlay.png' }, { path: 'bg.mp4' }],
  filterComplex: '[0:v]scale=1920:1080,drawtext=text=Hello:fontfile=font.ttf,overlay,minterpolate=mci=dup:fps=60[vout]',
  maps: ['-map', '[vout]', '-map', '0:a'],
  outputArgs: ['out.mp4'],
  fullArgs: ['-y', '-i', 'input.mp4', '-i', 'overlay.png', '-i', 'bg.mp4', '-filter_complex', '...', '-map', '[vout]', '-map', '0:a', 'out.mp4'],
  warnings: [],
  textArtifacts: [{ path: 'font.ttf' }],
  duration: 60
};

function makeTask(overrides: Partial<ExportTask>): ExportTask {
  return {
    id: 'task-1',
    name: 'Export',
    outputPath: 'out.mp4',
    plan: basePlan,
    priority: 'normal',
    status: 'pending',
    progress: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('resource dashboard', () => {
  describe('rolling window', () => {
    it('creates empty dashboard state', () => {
      const state = createEmptyDashboardState();
      expect(state.rollingWindow).toEqual([]);
      expect(state.exportHistory).toEqual([]);
      expect(state.enabled).toBe(false);
    });

    it('appends samples within 60-second window', () => {
      const now = Date.now();
      const sample1: ResourceSample = { timestamp: now - 1000, cpuPercent: 50, memoryUsedMb: 4000, memoryTotalMb: 16000, diskReadMbPerSec: 10, diskWriteMbPerSec: 5 };
      const sample2: ResourceSample = { timestamp: now, cpuPercent: 75, memoryUsedMb: 5000, memoryTotalMb: 16000, diskReadMbPerSec: 20, diskWriteMbPerSec: 8 };
      const samples = appendResourceSample([sample1], sample2, now);
      expect(samples).toHaveLength(2);
    });

    it('evicts samples older than rolling window', () => {
      const now = Date.now();
      const old: ResourceSample = { timestamp: now - ROLLING_WINDOW_DURATION_MS - 1, cpuPercent: 30, memoryUsedMb: 3000, memoryTotalMb: 16000, diskReadMbPerSec: 5, diskWriteMbPerSec: 2 };
      const recent: ResourceSample = { timestamp: now - 1000, cpuPercent: 60, memoryUsedMb: 4000, memoryTotalMb: 16000, diskReadMbPerSec: 10, diskWriteMbPerSec: 5 };
      const fresh: ResourceSample = { timestamp: now, cpuPercent: 80, memoryUsedMb: 5000, memoryTotalMb: 16000, diskReadMbPerSec: 15, diskWriteMbPerSec: 7 };
      const samples = appendResourceSample([old, recent], fresh, now);
      expect(samples).toHaveLength(2);
      expect(samples[0].timestamp).toBe(recent.timestamp);
    });

    it('respects custom window duration', () => {
      const now = Date.now();
      const old: ResourceSample = { timestamp: now - 5000, cpuPercent: 30, memoryUsedMb: 3000, memoryTotalMb: 16000, diskReadMbPerSec: 5, diskWriteMbPerSec: 2 };
      const fresh: ResourceSample = { timestamp: now, cpuPercent: 80, memoryUsedMb: 5000, memoryTotalMb: 16000, diskReadMbPerSec: 15, diskWriteMbPerSec: 7 };
      const samples = appendResourceSample([old], fresh, now, 3000);
      expect(samples).toHaveLength(1);
    });
  });

  describe('overload detection', () => {
    it('detects overload when running tasks exceed recommended max', () => {
      const status = calculateOverloadStatus(4, 2, 1.2);
      expect(status.overloaded).toBe(true);
      expect(status.runningCount).toBe(4);
      expect(status.recommendedMax).toBe(2);
      expect(status.cpuCores).toBe(2);
    });

    it('reports no overload when within limits', () => {
      const status = calculateOverloadStatus(2, 4, 1.2);
      expect(status.overloaded).toBe(false);
      expect(status.recommendedMax).toBe(5);
    });

    it('uses default coefficient when not specified', () => {
      const status = calculateOverloadStatus(3, 2);
      expect(status.recommendedMax).toBe(2);
      expect(status.overloaded).toBe(true);
    });

    it('isOverloaded helper returns boolean', () => {
      expect(isOverloaded(3, 2, 1.2)).toBe(true);
      expect(isOverloaded(1, 4, 1.2)).toBe(false);
    });

    it('clamps coefficient to valid range', () => {
      expect(clampCoefficient(0.1)).toBe(0.5);
      expect(clampCoefficient(10)).toBe(3);
      expect(clampCoefficient(NaN)).toBe(DEFAULT_OVERLOAD_COEFFICIENT);
      expect(clampCoefficient(1.5)).toBe(1.5);
    });

    it('overload status includes correct metadata', () => {
      const status = calculateOverloadStatus(5, 8, 1.5);
      expect(status.cpuCores).toBe(8);
      expect(status.overloadCoefficient).toBe(1.5);
      expect(status.recommendedMax).toBe(12);
      expect(status.overloaded).toBe(false);
    });
  });

  describe('per-task resource estimation', () => {
    it('estimates CPU for queued tasks', () => {
      const tasks = [
        makeTask({ id: 'a', status: 'running' }),
        makeTask({ id: 'b', status: 'pending' }),
        makeTask({ id: 'c', status: 'canceled' })
      ];
      const estimates = estimateTaskResourceUsage(tasks);
      expect(estimates).toHaveLength(2);
      expect(estimates[0].taskId).toBe('a');
      expect(estimates[1].taskId).toBe('b');
    });

    it('estimates heavy plan higher than base plan', () => {
      const baseTask = makeTask({ id: 'base', plan: basePlan });
      const heavyTask = makeTask({ id: 'heavy', plan: heavyPlan });
      const baseEstimate = estimateTaskResourceUsage([baseTask])[0];
      const heavyEstimate = estimateTaskResourceUsage([heavyTask])[0];
      expect(heavyEstimate.cpuCost).toBeGreaterThan(baseEstimate.cpuCost);
      expect(heavyEstimate.memoryMb).toBeGreaterThan(baseEstimate.memoryMb);
      expect(heavyEstimate.memoryClass).toBe('heavy');
    });

    it('estimateSingleTaskCpuPercent returns clamped percentage', () => {
      const task = makeTask({ plan: heavyPlan });
      const percent = estimateSingleTaskCpuPercent(task, 4);
      expect(percent).toBeGreaterThanOrEqual(1);
      expect(percent).toBeLessThanOrEqual(100);
    });

    it('estimateSingleTaskCpuPercent uses at least 1 core', () => {
      const task = makeTask({ plan: basePlan });
      const percent = estimateSingleTaskCpuPercent(task, 0);
      expect(percent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('export history recording', () => {
    it('records and finishes export with samples', () => {
      const now = Date.now();
      let history = startExportRecording([], 'export-1', ['Task A', 'Task B'], now);
      expect(history).toHaveLength(1);
      expect(history[0].exportId).toBe('export-1');
      expect(history[0].taskNames).toEqual(['Task A', 'Task B']);

      const sample: ResourceSample = { timestamp: now + 1000, cpuPercent: 70, memoryUsedMb: 5000, memoryTotalMb: 16000, diskReadMbPerSec: 10, diskWriteMbPerSec: 5 };
      history = appendExportSample(history, 'export-1', sample);
      expect(history[0].samples).toHaveLength(1);

      history = finishExportRecording(history, 'export-1', now + 5000);
      expect(history[0].finishedAt).toBe(now + 5000);
    });

    it('trims history to max 5 exports', () => {
      let history: ExportResourceSnapshot[] = [];
      for (let i = 0; i < 7; i++) {
        history = startExportRecording(history, `export-${i}`, [`Task ${i}`], Date.now() + i * 1000);
      }
      history = trimExportHistory(history);
      expect(history).toHaveLength(MAX_EXPORT_HISTORY_COUNT);
      expect(history[0].exportId).toBe('export-2');
      expect(history[4].exportId).toBe('export-6');
    });

    it('trimExportHistory returns as-is when under limit', () => {
      const snapshots: ExportResourceSnapshot[] = [
        { exportId: 'e1', startedAt: 0, finishedAt: 0, samples: [], taskNames: [] }
      ];
      expect(trimExportHistory(snapshots)).toHaveLength(1);
    });

    it('appendExportSample preserves snapshot when exportId does not match', () => {
      const snapshots: ExportResourceSnapshot[] = [
        { exportId: 'e1', startedAt: 0, finishedAt: 0, samples: [], taskNames: [] }
      ];
      const sample: ResourceSample = { timestamp: 1000, cpuPercent: 50, memoryUsedMb: 1000, memoryTotalMb: 4000, diskReadMbPerSec: 0, diskWriteMbPerSec: 0 };
      const result = appendExportSample(snapshots, 'e2', sample);
      expect(result[0].samples).toHaveLength(0);
    });

    it('startExportRecording trims oldest when at limit', () => {
      let history: ExportResourceSnapshot[] = [];
      for (let i = 0; i < MAX_EXPORT_HISTORY_COUNT; i++) {
        history = startExportRecording(history, `export-${i}`, [], Date.now());
      }
      expect(history).toHaveLength(MAX_EXPORT_HISTORY_COUNT);
      history = startExportRecording(history, 'export-new', [], Date.now());
      expect(history).toHaveLength(MAX_EXPORT_HISTORY_COUNT);
      expect(history[history.length - 1].exportId).toBe('export-new');
    });
  });

  describe('export curve extraction', () => {
    it('extracts curve points with elapsed time', () => {
      const now = Date.now();
      const snapshot: ExportResourceSnapshot = {
        exportId: 'e1',
        startedAt: now,
        finishedAt: now + 5000,
        samples: [
          { timestamp: now, cpuPercent: 40, memoryUsedMb: 3000, memoryTotalMb: 16000, diskReadMbPerSec: 5, diskWriteMbPerSec: 2 },
          { timestamp: now + 2000, cpuPercent: 60, memoryUsedMb: 4000, memoryTotalMb: 16000, diskReadMbPerSec: 8, diskWriteMbPerSec: 3 },
          { timestamp: now + 5000, cpuPercent: 80, memoryUsedMb: 5000, memoryTotalMb: 16000, diskReadMbPerSec: 12, diskWriteMbPerSec: 5 }
        ],
        taskNames: ['Task A']
      };
      const curve = extractExportCurve(snapshot);
      expect(curve).toHaveLength(3);
      expect(curve[0].elapsedSeconds).toBe(0);
      expect(curve[1].elapsedSeconds).toBe(2);
      expect(curve[2].elapsedSeconds).toBe(5);
      expect(curve[2].cpuPercent).toBe(80);
    });

    it('returns empty array for snapshot with no samples', () => {
      const snapshot: ExportResourceSnapshot = {
        exportId: 'e1',
        startedAt: 0,
        finishedAt: 0,
        samples: [],
        taskNames: []
      };
      expect(extractExportCurve(snapshot)).toEqual([]);
    });
  });

  describe('normalize wrappers', () => {
    it('normalizeExportHistory delegates to trimExportHistory', () => {
      const snapshots: ExportResourceSnapshot[] = [];
      expect(normalizeExportHistory(snapshots)).toEqual([]);
    });

    it('normalizeOverloadCoefficient uses default when undefined', () => {
      expect(normalizeOverloadCoefficient(undefined)).toBe(DEFAULT_OVERLOAD_COEFFICIENT);
    });

    it('normalizeOverloadCoefficient clamps custom value', () => {
      expect(normalizeOverloadCoefficient(5)).toBe(3);
      expect(normalizeOverloadCoefficient(0.1)).toBe(0.5);
    });
  });
});
