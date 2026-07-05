import { AlertTriangle } from 'lucide-react';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import { featureStrings } from '../i18n/featureStrings';

/** Toolbar alert icon - shown when there are active alerts. */
export function PerformanceAlertIcon() {
  const { alerts, setPanelOpen } = usePerformanceMonitorStore();
  if (alerts.length === 0) return null;
  return (
    <button
      data-testid="perf-alert-icon"
      onClick={() => setPanelOpen(true)}
      className="relative p-1 text-amber-400 hover:text-amber-300 transition-colors"
      title={featureStrings.performanceMonitor.alertIcon}
    >
      <AlertTriangle size={16} />
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
    </button>
  );
}
