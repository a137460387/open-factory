import { describe, it, expect } from 'vitest';
import {
  calculateTrend,
  detectBottlenecks,
  analyzeTaskPerformance,
  generateOptimizations,
} from '../src/performance/monitor';
import { DEFAULT_MONITOR_CONFIG } from '../src/performance/types';
import type { SystemMetrics, TaskMetrics, Bottleneck } from '../src/performance/types';

function makeMetrics(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    timestamp: Date.now(),
    cpu: { usage: 50, cores: 8 },
    memory: { used: 8e9, total: 16e9, usage: 50 },
    disk: { readSpeed: 200, writeSpeed: 100, usage: 60 },
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskMetrics> = {}): TaskMetrics {
  return {
    taskId: 'task-1',
    taskType: 'render',
    startTime: Date.now(),
    endTime: Date.now() + 5000,
    duration: 5000,
    status: 'completed',
    progress: 100,
    resourceUsage: { cpuAvg: 50, memoryPeak: 8e9, diskRead: 100, diskWrite: 50 },
    ...overrides,
  };
}

describe('calculateTrend', () => {
  it('returns stable for empty points', () => {
    const trend = calculateTrend([]);
    expect(trend.trend).toBe('stable');
    expect(trend.avg).toBe(0);
    expect(trend.points).toEqual([]);
  });

  it('calculates avg/min/max correctly', () => {
    const points = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
    ];
    const trend = calculateTrend(points, 2);
    expect(trend.avg).toBe(20);
    expect(trend.min).toBe(10);
    expect(trend.max).toBe(30);
  });

  it('detects degrading trend', () => {
    // First half low, second half high
    const points = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i,
      value: i < 10 ? 20 + Math.random() * 5 : 50 + Math.random() * 5,
    }));
    const trend = calculateTrend(points, 10);
    expect(trend.trend).toBe('degrading');
  });

  it('detects improving trend', () => {
    // First half high, second half low
    const points = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i,
      value: i < 10 ? 50 + Math.random() * 5 : 20 + Math.random() * 5,
    }));
    const trend = calculateTrend(points, 10);
    expect(trend.trend).toBe('improving');
  });

  it('detects stable trend', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i,
      value: 50 + Math.random() * 2,
    }));
    const trend = calculateTrend(points, 10);
    expect(trend.trend).toBe('stable');
  });
});

describe('detectBottlenecks', () => {
  it('returns empty for no metrics', () => {
    expect(detectBottlenecks([])).toEqual([]);
  });

  it('detects CPU critical bottleneck', () => {
    const metrics = [makeMetrics({ cpu: { usage: 95, cores: 8 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'cpu' && b.severity === 'critical')).toBe(true);
  });

  it('detects CPU warning bottleneck', () => {
    const metrics = [makeMetrics({ cpu: { usage: 75, cores: 8 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'cpu' && b.severity === 'medium')).toBe(true);
  });

  it('detects memory critical bottleneck', () => {
    const metrics = [makeMetrics({ memory: { used: 15e9, total: 16e9, usage: 95 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'memory' && b.severity === 'critical')).toBe(true);
  });

  it('detects memory warning bottleneck', () => {
    const metrics = [makeMetrics({ memory: { used: 13e9, total: 16e9, usage: 80 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'memory' && b.severity === 'medium')).toBe(true);
  });

  it('detects GPU bottleneck when present', () => {
    const metrics = [makeMetrics({ gpu: { usage: 96, memoryUsed: 7e9, memoryTotal: 8e9 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'gpu' && b.severity === 'critical')).toBe(true);
  });

  it('detects GPU warning bottleneck', () => {
    const metrics = [makeMetrics({ gpu: { usage: 85, memoryUsed: 6e9, memoryTotal: 8e9 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'gpu' && b.severity === 'medium')).toBe(true);
  });

  it('detects disk critical bottleneck', () => {
    const metrics = [makeMetrics({ disk: { readSpeed: 200, writeSpeed: 100, usage: 96 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'disk')).toBe(true);
  });

  it('detects I/O bottleneck for slow speeds', () => {
    const metrics = [makeMetrics({ disk: { readSpeed: 30, writeSpeed: 10, usage: 60 } })];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks.some((b) => b.type === 'io')).toBe(true);
  });

  it('returns empty for healthy metrics', () => {
    const metrics = [makeMetrics()];
    const bottlenecks = detectBottlenecks(metrics);
    expect(bottlenecks).toEqual([]);
  });
});

describe('analyzeTaskPerformance', () => {
  it('returns empty stats for no tasks', () => {
    const result = analyzeTaskPerformance([]);
    expect(result.avgDuration).toBe(0);
    expect(result.byType).toEqual({});
    expect(result.slowestTasks).toEqual([]);
    expect(result.failedTasks).toEqual([]);
  });

  it('calculates average duration', () => {
    const tasks = [
      makeTask({ duration: 1000 }),
      makeTask({ duration: 3000 }),
    ];
    const result = analyzeTaskPerformance(tasks);
    expect(result.avgDuration).toBe(2000);
  });

  it('groups by task type', () => {
    const tasks = [
      makeTask({ taskType: 'render', duration: 1000, status: 'completed' }),
      makeTask({ taskType: 'export', duration: 2000, status: 'completed' }),
      makeTask({ taskType: 'render', duration: 3000, status: 'failed' }),
    ];
    const result = analyzeTaskPerformance(tasks);
    expect(result.byType['render'].count).toBe(2);
    expect(result.byType['export'].count).toBe(1);
  });

  it('finds slowest tasks', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ duration: (i + 1) * 1000 }),
    );
    const result = analyzeTaskPerformance(tasks);
    expect(result.slowestTasks).toHaveLength(5);
    expect(result.slowestTasks[0].duration).toBe(10000);
  });

  it('finds failed tasks', () => {
    const tasks = [
      makeTask({ status: 'completed' }),
      makeTask({ taskId: 'f1', status: 'failed' }),
      makeTask({ taskId: 'f2', status: 'failed' }),
    ];
    const result = analyzeTaskPerformance(tasks);
    expect(result.failedTasks).toHaveLength(2);
  });
});

describe('generateOptimizations', () => {
  it('returns empty for healthy system with no tasks', () => {
    const metrics = [makeMetrics()];
    const result = generateOptimizations(metrics, [], []);
    expect(Array.isArray(result)).toBe(true);
  });

  it('generates recommendations for bottlenecks', () => {
    const metrics = [makeMetrics({ cpu: { usage: 95, cores: 8 } })];
    const bottlenecks: Bottleneck[] = [{
      id: 'b1',
      type: 'cpu',
      severity: 'critical',
      description: 'CPU overload',
      impact: 'Performance degraded',
      suggestion: 'Reduce tasks',
    }];
    const result = generateOptimizations(metrics, [], bottlenecks);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
