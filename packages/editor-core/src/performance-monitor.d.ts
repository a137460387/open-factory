export type PerformanceAlertType = 'memory' | 'undo-history' | 'render-fps';
export type PerformanceAlertSeverity = 'warning' | 'critical';
export type PerformanceOptimizationAction = 'clear-undo-history' | 'reduce-preview-quality' | 'close-unused-panels' | 'clear-render-cache';
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
export declare const DEFAULT_PERFORMANCE_MONITOR_CONFIG: PerformanceMonitorConfig;
export declare function samplePerformanceMetrics(overrides?: Partial<PerformanceMonitorMetrics>): PerformanceMonitorMetrics;
export declare function evaluatePerformanceAlerts(metrics: PerformanceMonitorMetrics, thresholds: PerformanceMonitorThresholds): PerformanceAlert[];
export declare function confirmAlerts(recentSamples: PerformanceMonitorMetrics[], thresholds: PerformanceMonitorThresholds, minConsecutive?: number): PerformanceAlert[];
export interface PerformanceOptimizationResult {
    action: PerformanceOptimizationAction;
    executed: boolean;
    description: string;
}
export declare function describeOptimizationAction(action: PerformanceOptimizationAction): string;
export declare function buildOptimizationPlan(alerts: PerformanceAlert[]): PerformanceOptimizationResult[];
export declare function normalizePerformanceMonitorConfig(input: Partial<PerformanceMonitorConfig> | undefined): PerformanceMonitorConfig;
//# sourceMappingURL=performance-monitor.d.ts.map