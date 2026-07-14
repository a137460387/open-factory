import { useEffect, useRef } from 'react';
import { AlertTriangle, Zap, Activity } from 'lucide-react';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import { featureStrings } from '../i18n/featureStrings';

export { PerformanceAlertIcon } from './PerformanceAlertIcon';

interface PerformanceMonitorPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PerformanceMonitorPanel({ open, onClose }: PerformanceMonitorPanelProps) {
  const {
    alerts,
    metrics,
    optimizationPlan,
    config,
    executeOptimization,
    dismissAlert,
    setConfig,
    setPanelOpen,
    sample,
  } = usePerformanceMonitorStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (config.enabled && open) {
      intervalRef.current = setInterval(() => sample(), config.samplingIntervalMs);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config.enabled, config.samplingIntervalMs, open, sample]);

  if (!open) return null;

  const lastMetric = metrics[metrics.length - 1];
  const t = featureStrings.performanceMonitor;

  return (
    <div
      data-testid="performance-monitor-panel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 w-[420px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <Activity size={16} /> {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-xs"
            data-testid="perf-panel-close"
          >
            ✕
          </button>
        </div>

        {/* Current metrics */}
        {lastMetric && (
          <div data-testid="perf-metrics" className="grid grid-cols-3 gap-2 mb-3 text-xs text-neutral-300">
            <div className="bg-neutral-800 rounded p-2 text-center">
              <div className="text-neutral-500">内存</div>
              <div className="font-mono">{Math.round(lastMetric.memoryBytes / (1024 * 1024))}MB</div>
            </div>
            <div className="bg-neutral-800 rounded p-2 text-center">
              <div className="text-neutral-500">历史</div>
              <div className="font-mono">{lastMetric.undoHistorySize}步</div>
            </div>
            <div className="bg-neutral-800 rounded p-2 text-center">
              <div className="text-neutral-500">帧率</div>
              <div className="font-mono">{lastMetric.renderFps}fps</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div data-testid="perf-alerts" className="mb-3 space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 bg-amber-900/30 border border-amber-700/50 rounded p-2 text-xs"
              >
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-amber-200">{alert.message}</div>
                  <div className="text-amber-400/70 mt-1">{alert.suggestion}</div>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Optimization plan */}
        {optimizationPlan.length > 0 && (
          <div data-testid="perf-optimization" className="mb-3">
            <button
              data-testid="perf-one-click-optimize"
              onClick={executeOptimization}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded px-3 py-2 text-xs font-medium transition-colors"
            >
              <Zap size={14} /> {t.oneClickOptimize}
            </button>
            <div className="mt-2 space-y-1">
              {optimizationPlan.map((p, i) => (
                <div key={i} className="text-xs text-neutral-400 flex items-center gap-1">
                  <span className={p.executed ? 'text-emerald-400' : 'text-neutral-500'}>{p.executed ? '✓' : '•'}</span>
                  {p.description}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config */}
        <div data-testid="perf-config" className="border-t border-neutral-700 pt-3">
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ enabled: e.target.checked })}
              data-testid="perf-config-enabled"
            />
            {t.config.enabled}
          </label>
        </div>
      </div>
    </div>
  );
}
