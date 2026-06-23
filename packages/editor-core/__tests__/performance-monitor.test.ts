import { describe, it, expect } from 'vitest';
import {
  samplePerformanceMetrics,
  evaluatePerformanceAlerts,
  confirmAlerts,
  buildOptimizationPlan,
  describeOptimizationAction,
  normalizePerformanceMonitorConfig,
  DEFAULT_PERFORMANCE_MONITOR_CONFIG,
} from '../src/performance-monitor';

describe('samplePerformanceMetrics', () => {
  it('returns overrides when provided', () => {
    const m = samplePerformanceMetrics({
      memoryBytes: 1024,
      undoHistorySize: 42,
      renderFps: 24,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    expect(m.memoryBytes).toBe(1024);
    expect(m.undoHistorySize).toBe(42);
    expect(m.renderFps).toBe(24);
    expect(m.sampledAt).toBe('2024-01-01T00:00:00Z');
  });

  it('provides defaults when no overrides', () => {
    const m = samplePerformanceMetrics();
    expect(typeof m.sampledAt).toBe('string');
    expect(m.renderFps).toBe(60);
    expect(m.undoHistorySize).toBe(0);
  });
});

describe('evaluatePerformanceAlerts', () => {
  const thresholds = DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds;

  it('triggers memory alert when above threshold', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 3 * 1024 * 1024 * 1024,
      undoHistorySize: 0,
      renderFps: 60,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, thresholds);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('memory');
  });

  it('triggers undo-history alert when above threshold', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 0,
      undoHistorySize: 600,
      renderFps: 60,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, thresholds);
    expect(alerts.some((a) => a.type === 'undo-history')).toBe(true);
  });

  it('triggers render-fps alert when below threshold', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 0,
      undoHistorySize: 0,
      renderFps: 10,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, thresholds);
    expect(alerts.some((a) => a.type === 'render-fps')).toBe(true);
  });

  it('no alerts when all metrics within threshold', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 512 * 1024 * 1024,
      undoHistorySize: 100,
      renderFps: 30,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, thresholds);
    expect(alerts).toHaveLength(0);
  });

  it('critical severity for extreme values', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 4 * 1024 * 1024 * 1024,
      undoHistorySize: 1200,
      renderFps: 5,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, thresholds);
    expect(alerts.every((a) => a.severity === 'critical')).toBe(true);
  });
});

describe('confirmAlerts', () => {
  const thresholds = DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds;

  it('returns empty if fewer than minConsecutive samples', () => {
    const samples = [
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't1' }),
    ];
    expect(confirmAlerts(samples, thresholds, 3)).toHaveLength(0);
  });

  it('returns alerts when all recent samples trigger', () => {
    const samples = [
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't1' }),
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't2' }),
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't3' }),
    ];
    expect(confirmAlerts(samples, thresholds, 3).length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when any sample is clean', () => {
    const samples = [
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't1' }),
      samplePerformanceMetrics({ memoryBytes: 100, sampledAt: 't2' }),
      samplePerformanceMetrics({ memoryBytes: 3 * 1024 * 1024 * 1024, sampledAt: 't3' }),
    ];
    expect(confirmAlerts(samples, thresholds, 3)).toHaveLength(0);
  });
});

describe('buildOptimizationPlan', () => {
  it('produces unique actions from alerts', () => {
    const metrics = samplePerformanceMetrics({
      memoryBytes: 4 * 1024 * 1024 * 1024,
      undoHistorySize: 1200,
      renderFps: 5,
      sampledAt: '2024-01-01T00:00:00Z',
    });
    const alerts = evaluatePerformanceAlerts(metrics, DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds);
    const plan = buildOptimizationPlan(alerts);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    const actions = plan.map((p) => p.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('returns empty for empty alerts', () => {
    expect(buildOptimizationPlan([])).toHaveLength(0);
  });
});

describe('describeOptimizationAction', () => {
  it('returns non-empty string for each action', () => {
    const actions = ['clear-undo-history', 'reduce-preview-quality', 'close-unused-panels', 'clear-render-cache'] as const;
    for (const action of actions) {
      expect(describeOptimizationAction(action).length).toBeGreaterThan(0);
    }
  });
});

describe('normalizePerformanceMonitorConfig', () => {
  it('returns defaults for undefined input', () => {
    const config = normalizePerformanceMonitorConfig(undefined);
    expect(config.enabled).toBe(true);
    expect(config.samplingIntervalMs).toBe(3000);
    expect(config.thresholds.memoryBytes).toBe(DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds.memoryBytes);
  });

  it('preserves valid custom values', () => {
    const config = normalizePerformanceMonitorConfig({
      enabled: false,
      samplingIntervalMs: 5000,
      thresholds: { memoryBytes: 1024 * 1024 * 1024, undoHistorySize: 200, renderFps: 20 },
    });
    expect(config.enabled).toBe(false);
    expect(config.samplingIntervalMs).toBe(5000);
    expect(config.thresholds.memoryBytes).toBe(1024 * 1024 * 1024);
    expect(config.thresholds.undoHistorySize).toBe(200);
    expect(config.thresholds.renderFps).toBe(20);
  });

  it('clamps extreme values', () => {
    const config = normalizePerformanceMonitorConfig({
      samplingIntervalMs: 100,
      thresholds: { memoryBytes: 0, undoHistorySize: 0, renderFps: 100 },
    });
    expect(config.samplingIntervalMs).toBe(500);
    expect(config.thresholds.memoryBytes).toBe(256 * 1024 * 1024);
    expect(config.thresholds.undoHistorySize).toBe(10);
    expect(config.thresholds.renderFps).toBe(60);
  });
});
