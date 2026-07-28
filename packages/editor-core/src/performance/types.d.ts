/**
 * Performance Monitor Types
 * Real-time performance monitoring and optimization center
 */
/** System resource metrics */
export interface SystemMetrics {
    timestamp: number;
    cpu: {
        usage: number;
        cores: number;
        temperature?: number;
    };
    memory: {
        used: number;
        total: number;
        usage: number;
    };
    gpu?: {
        usage: number;
        memoryUsed: number;
        memoryTotal: number;
        temperature?: number;
    };
    disk: {
        readSpeed: number;
        writeSpeed: number;
        usage: number;
    };
}
/** Task performance metrics */
export interface TaskMetrics {
    taskId: string;
    taskType: 'render' | 'export' | 'ai-process' | 'import' | 'proxy-generate' | 'other';
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    resourceUsage: {
        cpuAvg: number;
        memoryPeak: number;
        gpuAvg?: number;
        diskRead: number;
        diskWrite: number;
    };
    metadata?: Record<string, unknown>;
}
/** Performance bottleneck */
export interface Bottleneck {
    id: string;
    type: 'cpu' | 'memory' | 'gpu' | 'disk' | 'io' | 'algorithm';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    suggestion: string;
    metric?: number;
    threshold?: number;
}
/** Optimization recommendation */
export interface OptimizationRecommendation {
    id: string;
    category: 'hardware' | 'software' | 'workflow' | 'settings';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    estimatedImprovement: string;
    implementation: string;
}
/** Performance trend data point */
export interface TrendPoint {
    timestamp: number;
    value: number;
}
/** Performance trend */
export interface PerformanceTrend {
    metric: string;
    unit: string;
    points: TrendPoint[];
    avg: number;
    min: number;
    max: number;
    trend: 'improving' | 'stable' | 'degrading';
}
/** Performance dashboard data */
export interface PerformanceDashboard {
    timestamp: number;
    currentMetrics: SystemMetrics;
    recentTasks: TaskMetrics[];
    bottlenecks: Bottleneck[];
    recommendations: OptimizationRecommendation[];
    trends: {
        cpu: PerformanceTrend;
        memory: PerformanceTrend;
        gpu?: PerformanceTrend;
        taskDuration: PerformanceTrend;
    };
}
/** Performance monitor configuration */
export interface MonitorConfig {
    /** Sampling interval in milliseconds */
    sampleInterval: number;
    /** History retention in minutes */
    historyRetention: number;
    /** Enable GPU monitoring */
    enableGpu: boolean;
    /** Alert thresholds */
    thresholds: {
        cpuWarning: number;
        cpuCritical: number;
        memoryWarning: number;
        memoryCritical: number;
        gpuWarning?: number;
        gpuCritical?: number;
        diskWarning: number;
        diskCritical: number;
    };
    /** Performance optimization settings */
    optimization: {
        enableAutoOptimize: boolean;
        preferQuality: boolean;
        maxConcurrentTasks: number;
        throttleBackground: boolean;
    };
}
/** Default monitor configuration */
export declare const DEFAULT_MONITOR_CONFIG: MonitorConfig;
//# sourceMappingURL=types.d.ts.map