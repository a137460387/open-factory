import { describe, it, expect } from 'vitest';
import {
  generateDashboard,
  checkThreshold,
  formatMetric,
  calculatePerformanceScore,
} from '../src/performance/monitor';
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

describe('checkThreshold', () => {
  it('returns normal for low values', () => { expect(checkThreshold(50, 70, 90)).toBe('normal'); });
  it('returns warning for mid values', () => { expect(checkThreshold(75, 70, 90)).toBe('warning'); });
  it('returns critical for high values', () => { expect(checkThreshold(95, 70, 90)).toBe('critical'); });
  it('returns critical at exact threshold', () => { expect(checkThreshold(90, 70, 90)).toBe('critical'); });
  it('returns warning at exact threshold', () => { expect(checkThreshold(70, 70, 90)).toBe('warning'); });
});

describe('formatMetric', () => {
  it('formats percentage', () => { expect(formatMetric(75.5, '%')).toBe('75.5%'); });
  it('formats MB', () => { expect(formatMetric(1024 * 1024, 'MB')).toBe('1 MB'); });
  it('formats GB', () => { expect(formatMetric(1024 * 1024 * 1024, 'GB')).toBe('1.0 GB'); });
  it('formats ms', () => { expect(formatMetric(1500, 'ms')).toBe('1500 ms'); });
  it('formats seconds', () => { expect(formatMetric(3000, 's')).toBe('3.0 s'); });
  it('formats unknown unit', () => { expect(formatMetric(42, 'rpm')).toBe('42 rpm'); });
});

describe('calculatePerformanceScore', () => {
  it('returns 100 for no bottlenecks', () => {
    expect(calculatePerformanceScore([])).toBe(100);
  });

  it('deducts for critical bottlenecks', () => {
    const bottlenecks: Bottleneck[] = [
      { id: 'b1', type: 'cpu', severity: 'critical', description: '', impact: '', suggestion: '' },
    ];
    expect(calculatePerformanceScore(bottlenecks)).toBe(75);
  });

  it('deducts for multiple bottlenecks', () => {
    const bottlenecks: Bottleneck[] = [
      { id: 'b1', type: 'cpu', severity: 'critical', description: '', impact: '', suggestion: '' },
      { id: 'b2', type: 'memory', severity: 'high', description: '', impact: '', suggestion: '' },
      { id: 'b3', type: 'disk', severity: 'medium', description: '', impact: '', suggestion: '' },
      { id: 'b4', type: 'io', severity: 'low', description: '', impact: '', suggestion: '' },
    ];
    expect(calculatePerformanceScore(bottlenecks)).toBe(45);
  });

  it('clamps to 0', () => {
    const bottlenecks: Bottleneck[] = Array.from({ length: 10 }, (_, i) => ({
      id: `b${i}`, type: 'cpu' as const, severity: 'critical' as const, description: '', impact: '', suggestion: '',
    }));
    expect(calculatePerformanceScore(bottlenecks)).toBe(0);
  });
});

describe('generateDashboard', () => {
  it('generates dashboard from metrics history', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      ...makeMetrics({ timestamp: Date.now() + i * 1000, cpu: { usage: 40 + i, cores: 8 } }),
    }));
    const tasks = [makeTask()];
    const dashboard = generateDashboard(history, tasks);
    expect(dashboard.currentMetrics).toBeDefined();
    expect(dashboard.bottlenecks).toBeDefined();
    expect(dashboard.recommendations).toBeDefined();
    expect(dashboard.trends.cpu).toBeDefined();
    expect(dashboard.trends.memory).toBeDefined();
    expect(dashboard.trends.taskDuration).toBeDefined();
  });

  it('handles empty metrics history', () => {
    const dashboard = generateDashboard([], []);
    expect(dashboard.currentMetrics).toBeDefined();
    expect(dashboard.trends.cpu.points).toEqual([]);
  });

  it('includes GPU trend when GPU metrics present', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      ...makeMetrics({
        timestamp: Date.now() + i * 1000,
        gpu: { usage: 50 + i, memoryUsed: 4e9, memoryTotal: 8e9 },
      }),
    }));
    const dashboard = generateDashboard(history, []);
    expect(dashboard.trends.gpu).toBeDefined();
  });
});
