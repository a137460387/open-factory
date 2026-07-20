/**
 * Performance Monitor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  collectSystemMetrics,
  calculateTrend,
  detectBottlenecks,
  analyzeTaskPerformance,
  generateOptimizations,
  generateDashboard,
  checkThreshold,
  formatMetric,
  calculatePerformanceScore,
} from './monitor';

import type {
  SystemMetrics,
  TaskMetrics,
  MonitorConfig,
} from './types';

import { DEFAULT_MONITOR_CONFIG } from './types';

describe('Performance Monitor', () => {
  describe('collectSystemMetrics', () => {
    it('should collect valid metrics', () => {
      const metrics = collectSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.disk).toBeDefined();
    });
  });

  describe('calculateTrend', () => {
    it('should calculate trend from points', () => {
      const points = [
        { timestamp: 1, value: 10 },
        { timestamp: 2, value: 20 },
        { timestamp: 3, value: 30 },
        { timestamp: 4, value: 40 },
        { timestamp: 5, value: 50 },
      ];

      const trend = calculateTrend(points);
      expect(trend.avg).toBe(30);
      expect(trend.min).toBe(10);
      expect(trend.max).toBe(50);
    });

    it('should handle empty points', () => {
      const trend = calculateTrend([]);
      expect(trend.avg).toBe(0);
      expect(trend.min).toBe(0);
      expect(trend.max).toBe(0);
      expect(trend.trend).toBe('stable');
    });

    it('should detect improving trend', () => {
      const points = [
        { timestamp: 1, value: 80 },
        { timestamp: 2, value: 70 },
        { timestamp: 3, value: 60 },
        { timestamp: 4, value: 50 },
        { timestamp: 5, value: 40 },
        { timestamp: 6, value: 30 },
        { timestamp: 7, value: 20 },
        { timestamp: 8, value: 10 },
        { timestamp: 9, value: 5 },
        { timestamp: 10, value: 2 },
      ];

      const trend = calculateTrend(points, 5);
      expect(trend.trend).toBe('improving');
    });
  });

  describe('detectBottlenecks', () => {
    it('should detect CPU bottleneck', () => {
      const metrics: SystemMetrics[] = [
        {
          timestamp: Date.now(),
          cpu: { usage: 95, cores: 8 },
          memory: { used: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, usage: 50 },
          disk: { readSpeed: 100, writeSpeed: 50, usage: 60 },
        },
      ];

      const bottlenecks = detectBottlenecks(metrics, DEFAULT_MONITOR_CONFIG);
      const cpuBottleneck = bottlenecks.find((b) => b.type === 'cpu');
      expect(cpuBottleneck).toBeDefined();
      expect(cpuBottleneck?.severity).toBe('critical');
    });

    it('should detect memory bottleneck', () => {
      const metrics: SystemMetrics[] = [
        {
          timestamp: Date.now(),
          cpu: { usage: 50, cores: 8 },
          memory: { used: 15 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, usage: 95 },
          disk: { readSpeed: 100, writeSpeed: 50, usage: 60 },
        },
      ];

      const bottlenecks = detectBottlenecks(metrics, DEFAULT_MONITOR_CONFIG);
      const memoryBottleneck = bottlenecks.find((b) => b.type === 'memory');
      expect(memoryBottleneck).toBeDefined();
      expect(memoryBottleneck?.severity).toBe('critical');
    });

    it('should not detect bottlenecks for normal usage', () => {
      const metrics: SystemMetrics[] = [
        {
          timestamp: Date.now(),
          cpu: { usage: 30, cores: 8 },
          memory: { used: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, usage: 50 },
          disk: { readSpeed: 200, writeSpeed: 100, usage: 60 },
        },
      ];

      const bottlenecks = detectBottlenecks(metrics, DEFAULT_MONITOR_CONFIG);
      expect(bottlenecks).toHaveLength(0);
    });
  });

  describe('analyzeTaskPerformance', () => {
    it('should analyze completed tasks', () => {
      const tasks: TaskMetrics[] = [
        {
          taskId: '1',
          taskType: 'render',
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          duration: 5000,
          status: 'completed',
          progress: 100,
          resourceUsage: { cpuAvg: 50, memoryPeak: 1024 * 1024 * 1024, diskRead: 100, diskWrite: 50 },
        },
        {
          taskId: '2',
          taskType: 'export',
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          duration: 10000,
          status: 'completed',
          progress: 100,
          resourceUsage: { cpuAvg: 70, memoryPeak: 2 * 1024 * 1024 * 1024, diskRead: 200, diskWrite: 100 },
        },
      ];

      const analysis = analyzeTaskPerformance(tasks);
      expect(analysis.avgDuration).toBe(7500);
      expect(analysis.byType['render']).toBeDefined();
      expect(analysis.byType['export']).toBeDefined();
    });

    it('should handle empty tasks', () => {
      const analysis = analyzeTaskPerformance([]);
      expect(analysis.avgDuration).toBe(0);
      expect(Object.keys(analysis.byType)).toHaveLength(0);
    });

    it('should identify slowest tasks', () => {
      const tasks: TaskMetrics[] = [
        {
          taskId: '1',
          taskType: 'render',
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          duration: 5000,
          status: 'completed',
          progress: 100,
          resourceUsage: { cpuAvg: 50, memoryPeak: 1024, diskRead: 100, diskWrite: 50 },
        },
        {
          taskId: '2',
          taskType: 'render',
          startTime: Date.now() - 20000,
          endTime: Date.now(),
          duration: 20000,
          status: 'completed',
          progress: 100,
          resourceUsage: { cpuAvg: 80, memoryPeak: 2048, diskRead: 200, diskWrite: 100 },
        },
      ];

      const analysis = analyzeTaskPerformance(tasks);
      expect(analysis.slowestTasks).toHaveLength(2);
      expect(analysis.slowestTasks[0].taskId).toBe('2');
    });
  });

  describe('checkThreshold', () => {
    it('should return normal for low values', () => {
      expect(checkThreshold(50, 70, 90)).toBe('normal');
    });

    it('should return warning for medium values', () => {
      expect(checkThreshold(75, 70, 90)).toBe('warning');
    });

    it('should return critical for high values', () => {
      expect(checkThreshold(95, 70, 90)).toBe('critical');
    });
  });

  describe('formatMetric', () => {
    it('should format percentage', () => {
      expect(formatMetric(75.5, '%')).toBe('75.5%');
    });

    it('should format memory', () => {
      expect(formatMetric(1024 * 1024 * 1024, 'GB')).toBe('1.0 GB');
    });

    it('should format time', () => {
      expect(formatMetric(1500, 'ms')).toBe('1500 ms');
    });
  });

  describe('calculatePerformanceScore', () => {
    it('should return 100 for no bottlenecks', () => {
      expect(calculatePerformanceScore([])).toBe(100);
    });

    it('should reduce score for bottlenecks', () => {
      const bottlenecks = [
        {
          id: '1',
          type: 'cpu' as const,
          severity: 'critical' as const,
          description: 'High CPU',
          impact: 'Slow',
          suggestion: 'Reduce load',
        },
      ];
      expect(calculatePerformanceScore(bottlenecks)).toBe(75);
    });

    it('should not go below 0', () => {
      const bottlenecks = Array(10).fill({
        id: '1',
        type: 'cpu',
        severity: 'critical',
        description: 'High CPU',
        impact: 'Slow',
        suggestion: 'Reduce load',
      });
      expect(calculatePerformanceScore(bottlenecks)).toBe(0);
    });
  });

  describe('generateDashboard', () => {
    it('should generate dashboard', () => {
      const metricsHistory: SystemMetrics[] = [
        {
          timestamp: Date.now(),
          cpu: { usage: 50, cores: 8 },
          memory: { used: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, usage: 50 },
          disk: { readSpeed: 200, writeSpeed: 100, usage: 60 },
        },
      ];

      const tasks: TaskMetrics[] = [];

      const dashboard = generateDashboard(metricsHistory, tasks, DEFAULT_MONITOR_CONFIG);
      expect(dashboard).toBeDefined();
      expect(dashboard.currentMetrics).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      // Performance score is calculated from bottlenecks, not directly in dashboard
      expect(dashboard.bottlenecks).toBeDefined();
      expect(dashboard.recommendations).toBeDefined();
    });
  });
});
