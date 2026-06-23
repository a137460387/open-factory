import {
  samplePerformanceMetrics,
  evaluatePerformanceAlerts,
  confirmAlerts,
  buildOptimizationPlan,
  normalizePerformanceMonitorConfig,
  DEFAULT_PERFORMANCE_MONITOR_CONFIG,
  type PerformanceMonitorMetrics,
  type PerformanceAlert,
  type PerformanceMonitorConfig,
  type PerformanceOptimizationResult,
} from '@open-factory/editor-core';
import { create } from 'zustand';

export interface PerformanceMonitorState {
  config: PerformanceMonitorConfig;
  metrics: PerformanceMonitorMetrics[];
  alerts: PerformanceAlert[];
  optimizationPlan: PerformanceOptimizationResult[];
  panelOpen: boolean;
  /** Injected metrics for testing / E2E */
  injectMetrics: (metrics: Partial<PerformanceMonitorMetrics>) => void;
  /** Sample current environment and evaluate */
  sample: (overrides?: Partial<PerformanceMonitorMetrics>) => void;
  /** Execute one-click optimization and update metrics */
  executeOptimization: () => void;
  dismissAlert: (alertId: string) => void;
  setConfig: (config: Partial<PerformanceMonitorConfig>) => void;
  setPanelOpen: (open: boolean) => void;
  clearHistory: () => void;
  /** Reset store to initial state (used by E2E) */
  reset: () => void;
}

const MAX_SAMPLES = 120;
const CONFIRM_CONSECUTIVE = 3;

export const usePerformanceMonitorStore = create<PerformanceMonitorState>((set, get) => ({
  config: { ...DEFAULT_PERFORMANCE_MONITOR_CONFIG },
  metrics: [],
  alerts: [],
  optimizationPlan: [],
  panelOpen: false,

  injectMetrics: (partial) => {
    const m = samplePerformanceMetrics(partial);
    const state = get();
    const next = [...state.metrics, m].slice(-MAX_SAMPLES);
    const confirmed = confirmAlerts(next, state.config.thresholds, CONFIRM_CONSECUTIVE);
    set({
      metrics: next,
      alerts: confirmed,
      optimizationPlan: buildOptimizationPlan(confirmed),
    });
  },

  sample: (overrides) => {
    const state = get();
    if (!state.config.enabled) return;
    const m = samplePerformanceMetrics(overrides);
    const next = [...state.metrics, m].slice(-MAX_SAMPLES);
    const confirmed = confirmAlerts(next, state.config.thresholds, CONFIRM_CONSECUTIVE);
    set({
      metrics: next,
      alerts: confirmed,
      optimizationPlan: buildOptimizationPlan(confirmed),
    });
  },

  executeOptimization: () => {
    const state = get();
    const plan = state.optimizationPlan.map((p) => ({ ...p, executed: true }));
    // Simulate metric improvement after optimization
    const lastMetric = state.metrics[state.metrics.length - 1];
    if (lastMetric) {
      const improved: PerformanceMonitorMetrics = {
        ...lastMetric,
        memoryBytes: Math.round(lastMetric.memoryBytes * 0.4),
        undoHistorySize: Math.min(lastMetric.undoHistorySize, 50),
        renderFps: Math.max(lastMetric.renderFps, 30),
        sampledAt: new Date().toISOString(),
      };
      const next = [...state.metrics, improved].slice(-MAX_SAMPLES);
      set({
        optimizationPlan: plan,
        metrics: next,
        alerts: [],
      });
    } else {
      set({ optimizationPlan: plan, alerts: [] });
    }
  },

  dismissAlert: (alertId) => {
    set((s) => ({
      alerts: s.alerts.filter((a) => a.id !== alertId),
      optimizationPlan: buildOptimizationPlan(s.alerts.filter((a) => a.id !== alertId)),
    }));
  },

  setConfig: (partial) => {
    set((s) => ({
      config: normalizePerformanceMonitorConfig({ ...s.config, ...partial }),
    }));
  },

  setPanelOpen: (open) => set({ panelOpen: open }),

  clearHistory: () => set({ metrics: [], alerts: [], optimizationPlan: [] }),

  reset: () =>
    set({
      config: { ...DEFAULT_PERFORMANCE_MONITOR_CONFIG },
      metrics: [],
      alerts: [],
      optimizationPlan: [],
      panelOpen: false,
    }),
}));
