/**
 * Performance Monitor - Real-time performance monitoring and optimization
 * Tracks system resources, analyzes task performance, and provides optimization suggestions
 */
import type { MonitorConfig, SystemMetrics, TaskMetrics, Bottleneck, OptimizationRecommendation, PerformanceTrend, TrendPoint, PerformanceDashboard } from './types';
/**
 * Simulate system metrics collection
 * In production, this would use actual system APIs
 */
export declare function collectSystemMetrics(): SystemMetrics;
/**
 * Calculate trend from data points
 */
export declare function calculateTrend(points: TrendPoint[], windowSize?: number): PerformanceTrend;
/**
 * Detect performance bottlenecks
 */
export declare function detectBottlenecks(metrics: SystemMetrics[], config?: MonitorConfig): Bottleneck[];
/**
 * Analyze task performance
 */
export declare function analyzeTaskPerformance(tasks: TaskMetrics[]): {
    avgDuration: number;
    byType: Record<string, {
        count: number;
        avgDuration: number;
        successRate: number;
    }>;
    slowestTasks: TaskMetrics[];
    failedTasks: TaskMetrics[];
};
/**
 * Generate optimization recommendations
 */
export declare function generateOptimizations(metrics: SystemMetrics[], tasks: TaskMetrics[], bottlenecks: Bottleneck[], config?: MonitorConfig): OptimizationRecommendation[];
/**
 * Generate performance dashboard
 */
export declare function generateDashboard(metricsHistory: SystemMetrics[], tasks: TaskMetrics[], config?: MonitorConfig): PerformanceDashboard;
/**
 * Check if a metric exceeds threshold
 */
export declare function checkThreshold(value: number, warning: number, critical: number): 'normal' | 'warning' | 'critical';
/**
 * Format metric value with unit
 */
export declare function formatMetric(value: number, unit: string): string;
/**
 * Calculate performance score (0-100)
 */
export declare function calculatePerformanceScore(bottlenecks: Bottleneck[]): number;
//# sourceMappingURL=monitor.d.ts.map