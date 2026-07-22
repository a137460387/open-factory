/**
 * performance-monitor.ts 单元测试
 * 覆盖指标采样、告警评估、优化方案、配置规范化等核心逻辑
 */

import { describe, it, expect } from 'vitest';
import {
  samplePerformanceMetrics,
  evaluatePerformanceAlerts,
  confirmAlerts,
  describeOptimizationAction,
  buildOptimizationPlan,
  normalizePerformanceMonitorConfig,
  DEFAULT_PERFORMANCE_MONITOR_CONFIG,
  type PerformanceMonitorMetrics,
  type PerformanceMonitorThresholds,
} from './performance-monitor';

describe('performance-monitor', () => {
  const thresholds: PerformanceMonitorThresholds = DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds;

  // ─── samplePerformanceMetrics ────────────────────────────────────────
  describe('samplePerformanceMetrics', () => {
    it('返回有效的采样指标', () => {
      const metrics = samplePerformanceMetrics();
      expect(metrics.sampledAt).toBeDefined();
      expect(typeof metrics.memoryBytes).toBe('number');
      expect(typeof metrics.undoHistorySize).toBe('number');
      expect(typeof metrics.renderFps).toBe('number');
    });

    it('使用 override 值', () => {
      const metrics = samplePerformanceMetrics({
        memoryBytes: 500,
        undoHistorySize: 100,
        renderFps: 30,
      });
      expect(metrics.memoryBytes).toBe(500);
      expect(metrics.undoHistorySize).toBe(100);
      expect(metrics.renderFps).toBe(30);
    });

    it('默认 renderFps 为 60', () => {
      const metrics = samplePerformanceMetrics({});
      expect(metrics.renderFps).toBe(60);
    });
  });

  // ─── evaluatePerformanceAlerts ───────────────────────────────────────
  describe('evaluatePerformanceAlerts', () => {
    it('正常指标不产生告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: 100 * 1024 * 1024,
        undoHistorySize: 100,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      expect(evaluatePerformanceAlerts(metrics, thresholds)).toHaveLength(0);
    });

    it('内存超阈值产生 warning 告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: thresholds.memoryBytes + 1,
        undoHistorySize: 100,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('memory');
      expect(alerts[0].severity).toBe('warning');
    });

    it('内存严重超标产生 critical 告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: thresholds.memoryBytes * 2,
        undoHistorySize: 100,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      expect(alerts[0].severity).toBe('critical');
    });

    it('undo 历史超阈值产生告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: 0,
        undoHistorySize: thresholds.undoHistorySize + 1,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      expect(alerts.some((a) => a.type === 'undo-history')).toBe(true);
    });

    it('undo 历史严重超标产生 critical 告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: 0,
        undoHistorySize: thresholds.undoHistorySize * 3,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      const undoAlert = alerts.find((a) => a.type === 'undo-history');
      expect(undoAlert?.severity).toBe('critical');
    });

    it('帧率低于阈值产生告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: 0,
        undoHistorySize: 0,
        renderFps: thresholds.renderFps - 1,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      expect(alerts.some((a) => a.type === 'render-fps')).toBe(true);
    });

    it('帧率严重偏低产生 critical 告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: 0,
        undoHistorySize: 0,
        renderFps: 1,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      const fpsAlert = alerts.find((a) => a.type === 'render-fps');
      expect(fpsAlert?.severity).toBe('critical');
    });

    it('多项指标同时超标产生多个告警', () => {
      const metrics: PerformanceMonitorMetrics = {
        memoryBytes: thresholds.memoryBytes * 2,
        undoHistorySize: thresholds.undoHistorySize * 3,
        renderFps: 1,
        sampledAt: new Date().toISOString(),
      };
      const alerts = evaluatePerformanceAlerts(metrics, thresholds);
      expect(alerts.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── confirmAlerts ──────────────────────────────────────────────────
  describe('confirmAlerts', () => {
    const badMetrics: PerformanceMonitorMetrics = {
      memoryBytes: thresholds.memoryBytes * 2,
      undoHistorySize: 0,
      renderFps: 60,
      sampledAt: new Date().toISOString(),
    };

    it('连续 N 次超标时确认告警', () => {
      const samples = [badMetrics, badMetrics, badMetrics];
      const alerts = confirmAlerts(samples, thresholds, 3);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('采样次数不足时返回空', () => {
      const alerts = confirmAlerts([badMetrics, badMetrics], thresholds, 3);
      expect(alerts).toHaveLength(0);
    });

    it('非连续超标时返回空', () => {
      const goodMetrics: PerformanceMonitorMetrics = {
        memoryBytes: 0,
        undoHistorySize: 0,
        renderFps: 60,
        sampledAt: new Date().toISOString(),
      };
      const alerts = confirmAlerts([badMetrics, goodMetrics, badMetrics], thresholds, 3);
      expect(alerts).toHaveLength(0);
    });
  });

  // ─── describeOptimizationAction ──────────────────────────────────────
  describe('describeOptimizationAction', () => {
    it('返回所有优化动作的描述', () => {
      expect(describeOptimizationAction('clear-undo-history')).toContain('undo');
      expect(describeOptimizationAction('reduce-preview-quality')).toContain('预览');
      expect(describeOptimizationAction('close-unused-panels')).toContain('面板');
      expect(describeOptimizationAction('clear-render-cache')).toContain('缓存');
    });
  });

  // ─── buildOptimizationPlan ───────────────────────────────────────────
  describe('buildOptimizationPlan', () => {
    it('从告警生成优化方案', () => {
      const alerts = evaluatePerformanceAlerts(
        {
          memoryBytes: thresholds.memoryBytes * 2,
          undoHistorySize: thresholds.undoHistorySize * 3,
          renderFps: 1,
          sampledAt: new Date().toISOString(),
        },
        thresholds,
      );
      const plan = buildOptimizationPlan(alerts);
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.every((p) => p.executed === false)).toBe(true);
    });

    it('去重相同 action', () => {
      const alerts = [
        {
          id: '1',
          type: 'memory' as const,
          severity: 'warning' as const,
          message: 'm1',
          suggestion: 's1',
          action: 'clear-undo-history' as const,
          triggeredAt: '',
          currentValue: 0,
          thresholdValue: 0,
        },
        {
          id: '2',
          type: 'undo-history' as const,
          severity: 'warning' as const,
          message: 'm2',
          suggestion: 's2',
          action: 'clear-undo-history' as const,
          triggeredAt: '',
          currentValue: 0,
          thresholdValue: 0,
        },
      ];
      const plan = buildOptimizationPlan(alerts);
      expect(plan).toHaveLength(1);
    });

    it('空告警返回空方案', () => {
      expect(buildOptimizationPlan([])).toEqual([]);
    });
  });

  // ─── normalizePerformanceMonitorConfig ───────────────────────────────
  describe('normalizePerformanceMonitorConfig', () => {
    it('undefined 返回默认配置', () => {
      const config = normalizePerformanceMonitorConfig(undefined);
      expect(config).toEqual(DEFAULT_PERFORMANCE_MONITOR_CONFIG);
    });

    it('合并自定义阈值', () => {
      const config = normalizePerformanceMonitorConfig({
        thresholds: { memoryBytes: 512 * 1024 * 1024, undoHistorySize: 500, renderFps: 30 },
      });
      expect(config.thresholds.memoryBytes).toBe(512 * 1024 * 1024);
      expect(config.thresholds.undoHistorySize).toBe(thresholds.undoHistorySize);
    });

    it('钳制 samplingIntervalMs 到有效范围', () => {
      const tooLow = normalizePerformanceMonitorConfig({ samplingIntervalMs: 100 });
      expect(tooLow.samplingIntervalMs).toBe(500);

      const tooHigh = normalizePerformanceMonitorConfig({ samplingIntervalMs: 100000 });
      expect(tooHigh.samplingIntervalMs).toBe(30000);
    });

    it('enabled 默认为 true', () => {
      const config = normalizePerformanceMonitorConfig({});
      expect(config.enabled).toBe(true);
    });

    it('显式设置 enabled 为 false', () => {
      const config = normalizePerformanceMonitorConfig({ enabled: false });
      expect(config.enabled).toBe(false);
    });

    it('钳制 undoHistorySize 最小值', () => {
      const config = normalizePerformanceMonitorConfig({ thresholds: { undoHistorySize: 1, memoryBytes: 100 * 1024 * 1024, renderFps: 30 } });
      expect(config.thresholds.undoHistorySize).toBe(10);
    });

    it('钳制 renderFps 到 [1, 60] 范围', () => {
      const low = normalizePerformanceMonitorConfig({ thresholds: { renderFps: 0, memoryBytes: 100 * 1024 * 1024, undoHistorySize: 500 } });
      expect(low.thresholds.renderFps).toBe(1);

      const high = normalizePerformanceMonitorConfig({ thresholds: { renderFps: 120, memoryBytes: 100 * 1024 * 1024, undoHistorySize: 500 } });
      expect(high.thresholds.renderFps).toBe(60);
    });
  });
});
