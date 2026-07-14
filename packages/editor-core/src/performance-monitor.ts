export type PerformanceAlertType = 'memory' | 'undo-history' | 'render-fps';
export type PerformanceAlertSeverity = 'warning' | 'critical';
export type PerformanceOptimizationAction =
  'clear-undo-history' | 'reduce-preview-quality' | 'close-unused-panels' | 'clear-render-cache';

export interface PerformanceMonitorMetrics {
  memoryBytes: number;
  undoHistorySize: number;
  renderFps: number;
  sampledAt: string;
}

export interface PerformanceAlert {
  id: string;
  type: PerformanceAlertType;
  severity: PerformanceAlertSeverity;
  message: string;
  suggestion: string;
  action: PerformanceOptimizationAction;
  triggeredAt: string;
  currentValue: number;
  thresholdValue: number;
}

export interface PerformanceMonitorThresholds {
  memoryBytes: number;
  undoHistorySize: number;
  renderFps: number;
}

export interface PerformanceMonitorConfig {
  enabled: boolean;
  samplingIntervalMs: number;
  thresholds: PerformanceMonitorThresholds;
}

export const DEFAULT_PERFORMANCE_MONITOR_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  samplingIntervalMs: 3000,
  thresholds: {
    memoryBytes: 2 * 1024 * 1024 * 1024,
    undoHistorySize: 500,
    renderFps: 15,
  },
};

export function samplePerformanceMetrics(overrides?: Partial<PerformanceMonitorMetrics>): PerformanceMonitorMetrics {
  const now = new Date().toISOString();
  let memoryBytes = 0;
  try {
    // @ts-expect-error performance.memory is Chrome-specific
    memoryBytes = typeof performance !== 'undefined' && performance.memory ? performance.memory.usedJSHeapSize : 0;
  } catch {
    memoryBytes = 0;
  }
  return {
    memoryBytes: overrides?.memoryBytes ?? memoryBytes,
    undoHistorySize: overrides?.undoHistorySize ?? 0,
    renderFps: overrides?.renderFps ?? 60,
    sampledAt: overrides?.sampledAt ?? now,
  };
}

export function evaluatePerformanceAlerts(
  metrics: PerformanceMonitorMetrics,
  thresholds: PerformanceMonitorThresholds,
): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const now = metrics.sampledAt;

  if (metrics.memoryBytes > thresholds.memoryBytes) {
    const mb = Math.round(metrics.memoryBytes / (1024 * 1024));
    alerts.push({
      id: 'alert-memory',
      type: 'memory',
      severity: metrics.memoryBytes > thresholds.memoryBytes * 1.5 ? 'critical' : 'warning',
      message: `内存占用 ${mb}MB，超过阈值`,
      suggestion: '内存占用较高，建议清理undo历史或降低预览质量',
      action: 'clear-undo-history',
      triggeredAt: now,
      currentValue: metrics.memoryBytes,
      thresholdValue: thresholds.memoryBytes,
    });
  }

  if (metrics.undoHistorySize > thresholds.undoHistorySize) {
    alerts.push({
      id: 'alert-undo-history',
      type: 'undo-history',
      severity: metrics.undoHistorySize > thresholds.undoHistorySize * 2 ? 'critical' : 'warning',
      message: `Undo历史 ${metrics.undoHistorySize} 步，超过阈值`,
      suggestion: 'Undo历史过多，建议清理历史或关闭低质量预览模式',
      action: 'clear-undo-history',
      triggeredAt: now,
      currentValue: metrics.undoHistorySize,
      thresholdValue: thresholds.undoHistorySize,
    });
  }

  if (metrics.renderFps < thresholds.renderFps) {
    alerts.push({
      id: 'alert-render-fps',
      type: 'render-fps',
      severity: metrics.renderFps < thresholds.renderFps / 2 ? 'critical' : 'warning',
      message: `渲染帧率 ${metrics.renderFps}fps，低于阈值`,
      suggestion: '渲染帧率持续较低，建议降低预览质量或关闭未使用的面板',
      action: 'reduce-preview-quality',
      triggeredAt: now,
      currentValue: metrics.renderFps,
      thresholdValue: thresholds.renderFps,
    });
  }

  return alerts;
}

export function confirmAlerts(
  recentSamples: PerformanceMonitorMetrics[],
  thresholds: PerformanceMonitorThresholds,
  minConsecutive = 3,
): PerformanceAlert[] {
  if (recentSamples.length < minConsecutive) {
    return [];
  }
  const lastN = recentSamples.slice(-minConsecutive);
  const allTriggered = lastN.every((sample) => evaluatePerformanceAlerts(sample, thresholds).length > 0);
  if (!allTriggered) {
    return [];
  }
  return evaluatePerformanceAlerts(lastN[lastN.length - 1], thresholds);
}

export interface PerformanceOptimizationResult {
  action: PerformanceOptimizationAction;
  executed: boolean;
  description: string;
}

export function describeOptimizationAction(action: PerformanceOptimizationAction): string {
  switch (action) {
    case 'clear-undo-history':
      return '清理undo历史，释放内存';
    case 'reduce-preview-quality':
      return '降低预览质量，减少GPU和内存占用';
    case 'close-unused-panels':
      return '关闭未使用的面板，减少渲染开销';
    case 'clear-render-cache':
      return '清理渲染缓存，释放磁盘和内存空间';
  }
}

export function buildOptimizationPlan(alerts: PerformanceAlert[]): PerformanceOptimizationResult[] {
  const seen = new Set<PerformanceOptimizationAction>();
  const plan: PerformanceOptimizationResult[] = [];
  for (const alert of alerts) {
    if (seen.has(alert.action)) {
      continue;
    }
    seen.add(alert.action);
    plan.push({
      action: alert.action,
      executed: false,
      description: describeOptimizationAction(alert.action),
    });
  }
  return plan;
}

export function normalizePerformanceMonitorConfig(
  input: Partial<PerformanceMonitorConfig> | undefined,
): PerformanceMonitorConfig {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PERFORMANCE_MONITOR_CONFIG };
  }
  const thresholds = normalizeThresholds(input.thresholds);
  const samplingIntervalMs =
    typeof input.samplingIntervalMs === 'number' && Number.isFinite(input.samplingIntervalMs)
      ? Math.max(500, Math.min(30000, Math.round(input.samplingIntervalMs)))
      : DEFAULT_PERFORMANCE_MONITOR_CONFIG.samplingIntervalMs;
  return {
    enabled: input.enabled !== false,
    samplingIntervalMs,
    thresholds,
  };
}

function normalizeThresholds(input: Partial<PerformanceMonitorThresholds> | undefined): PerformanceMonitorThresholds {
  const d = DEFAULT_PERFORMANCE_MONITOR_CONFIG.thresholds;
  if (!input || typeof input !== 'object') {
    return { ...d };
  }
  return {
    memoryBytes:
      typeof input.memoryBytes === 'number' && Number.isFinite(input.memoryBytes)
        ? Math.max(256 * 1024 * 1024, Math.round(input.memoryBytes))
        : d.memoryBytes,
    undoHistorySize:
      typeof input.undoHistorySize === 'number' && Number.isFinite(input.undoHistorySize)
        ? Math.max(10, Math.round(input.undoHistorySize))
        : d.undoHistorySize,
    renderFps:
      typeof input.renderFps === 'number' && Number.isFinite(input.renderFps)
        ? Math.max(1, Math.min(60, Math.round(input.renderFps)))
        : d.renderFps,
  };
}
