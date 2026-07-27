/**
 * Performance Dashboard Panel
 * Data layer for the "Performance Dashboard" UI panel.
 * Manages real-time metrics, task analysis, and optimization recommendations.
 */
import type { MonitorConfig, SystemMetrics, TaskMetrics, Bottleneck, OptimizationRecommendation } from '../performance/types';
export type PerformancePanelPhase = 'idle' | 'monitoring' | 'paused' | 'error';
export interface PerformancePanelState {
    /** Current phase */
    phase: PerformancePanelPhase;
    /** Monitor configuration */
    config: MonitorConfig;
    /** Current system metrics */
    currentMetrics?: SystemMetrics;
    /** Metrics history */
    metricsHistory: SystemMetrics[];
    /** Task metrics */
    tasks: TaskMetrics[];
    /** Detected bottlenecks */
    bottlenecks: Bottleneck[];
    /** Optimization recommendations */
    recommendations: OptimizationRecommendation[];
    /** Performance score (0-100) */
    performanceScore: number;
    /** Active tab */
    activeTab: 'overview' | 'cpu' | 'memory' | 'gpu' | 'tasks' | 'optimization';
    /** Selected bottleneck */
    selectedBottleneckId?: string;
    /** Error message if phase is error */
    error?: string;
    /** Auto-refresh enabled */
    autoRefresh: boolean;
    /** Refresh interval in ms */
    refreshInterval: number;
}
export declare function createInitialPerformancePanelState(): PerformancePanelState;
export type PerformancePanelAction = {
    type: 'START_MONITORING';
} | {
    type: 'PAUSE_MONITORING';
} | {
    type: 'RESUME_MONITORING';
} | {
    type: 'STOP_MONITORING';
} | {
    type: 'UPDATE_METRICS';
    metrics: SystemMetrics;
} | {
    type: 'ADD_TASK';
    task: TaskMetrics;
} | {
    type: 'UPDATE_TASK';
    taskId: string;
    updates: Partial<TaskMetrics>;
} | {
    type: 'SET_TAB';
    tab: PerformancePanelState['activeTab'];
} | {
    type: 'SELECT_BOTTLENECK';
    id: string | undefined;
} | {
    type: 'UPDATE_CONFIG';
    config: Partial<MonitorConfig>;
} | {
    type: 'TOGGLE_AUTO_REFRESH';
} | {
    type: 'SET_REFRESH_INTERVAL';
    interval: number;
} | {
    type: 'CLEAR_HISTORY';
} | {
    type: 'MONITORING_ERROR';
    error: string;
} | {
    type: 'RESET';
};
/**
 * Pure state reducer for the performance dashboard panel.
 * Follows immutable update patterns.
 */
export declare function performancePanelReducer(state: PerformancePanelState, action: PerformancePanelAction): PerformancePanelState;
/**
 * Get metric status color based on thresholds
 */
export declare function getMetricStatusColor(value: number, warning: number, critical: number): string;
/**
 * Get bottleneck severity color
 */
export declare function getBottleneckSeverityColor(severity: string): string;
/**
 * Get bottleneck severity label
 */
export declare function getBottleneckSeverityLabel(severity: string): string;
/**
 * Get bottleneck type label
 */
export declare function getBottleneckTypeLabel(type: string): string;
/**
 * Get task type label
 */
export declare function getTaskTypeLabel(type: string): string;
/**
 * Get task status label
 */
export declare function getTaskStatusLabel(status: string): string;
/**
 * Get task status color
 */
export declare function getTaskStatusColor(status: string): string;
/**
 * Get optimization priority color
 */
export declare function getOptimizationPriorityColor(priority: string): string;
/**
 * Get optimization category label
 */
export declare function getOptimizationCategoryLabel(category: string): string;
/**
 * Get current metrics summary for display
 */
export declare function getMetricsSummary(state: PerformancePanelState): Array<{
    label: string;
    value: string;
    color: string;
    icon: string;
}>;
/**
 * Get tab options for navigation
 */
export declare function getPerformanceTabs(): Array<{
    id: PerformancePanelState['activeTab'];
    label: string;
    icon: string;
}>;
/**
 * Get performance score description
 */
export declare function getScoreDescription(score: number): string;
/**
 * Get performance score color
 */
export declare function getScoreColor(score: number): string;
//# sourceMappingURL=panel.d.ts.map