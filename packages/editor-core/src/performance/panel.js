/**
 * Performance Dashboard Panel
 * Data layer for the "Performance Dashboard" UI panel.
 * Manages real-time metrics, task analysis, and optimization recommendations.
 */
import { DEFAULT_MONITOR_CONFIG } from '../performance/types';
import { collectSystemMetrics, detectBottlenecks, generateOptimizations, calculatePerformanceScore, checkThreshold } from '../performance/monitor';
export function createInitialPerformancePanelState() {
    return {
        phase: 'idle',
        config: { ...DEFAULT_MONITOR_CONFIG },
        metricsHistory: [],
        tasks: [],
        bottlenecks: [],
        recommendations: [],
        performanceScore: 100,
        activeTab: 'overview',
        autoRefresh: true,
        refreshInterval: 1000,
    };
}
/**
 * Pure state reducer for the performance dashboard panel.
 * Follows immutable update patterns.
 */
export function performancePanelReducer(state, action) {
    switch (action.type) {
        case 'START_MONITORING':
            return {
                ...state,
                phase: 'monitoring',
                error: undefined,
                currentMetrics: collectSystemMetrics(),
            };
        case 'PAUSE_MONITORING':
            return { ...state, phase: 'paused' };
        case 'RESUME_MONITORING':
            return { ...state, phase: 'monitoring' };
        case 'STOP_MONITORING':
            return { ...state, phase: 'idle' };
        case 'UPDATE_METRICS': {
            const maxHistory = state.config.historyRetention * 60; // Convert minutes to samples
            const metricsHistory = [...state.metricsHistory, action.metrics].slice(-maxHistory);
            const bottlenecks = detectBottlenecks(metricsHistory, state.config);
            const recommendations = generateOptimizations(metricsHistory, state.tasks, bottlenecks, state.config);
            const performanceScore = calculatePerformanceScore(bottlenecks);
            return {
                ...state,
                currentMetrics: action.metrics,
                metricsHistory,
                bottlenecks,
                recommendations,
                performanceScore,
            };
        }
        case 'ADD_TASK':
            return { ...state, tasks: [...state.tasks, action.task] };
        case 'UPDATE_TASK': {
            const tasks = state.tasks.map((t) => t.taskId === action.taskId ? { ...t, ...action.updates } : t);
            return { ...state, tasks };
        }
        case 'SET_TAB':
            return { ...state, activeTab: action.tab };
        case 'SELECT_BOTTLENECK':
            return { ...state, selectedBottleneckId: action.id };
        case 'UPDATE_CONFIG':
            return { ...state, config: { ...state.config, ...action.config } };
        case 'TOGGLE_AUTO_REFRESH':
            return { ...state, autoRefresh: !state.autoRefresh };
        case 'SET_REFRESH_INTERVAL':
            return { ...state, refreshInterval: action.interval };
        case 'CLEAR_HISTORY':
            return { ...state, metricsHistory: [], tasks: [], bottlenecks: [], recommendations: [] };
        case 'MONITORING_ERROR':
            return { ...state, phase: 'error', error: action.error };
        case 'RESET':
            return createInitialPerformancePanelState();
        default:
            return state;
    }
}
// ─── Panel Selectors ────────────────────────────────────────────
/**
 * Get metric status color based on thresholds
 */
export function getMetricStatusColor(value, warning, critical) {
    const status = checkThreshold(value, warning, critical);
    switch (status) {
        case 'critical':
            return '#dc2626';
        case 'warning':
            return '#ca8a04';
        case 'normal':
            return '#16a34a';
        default:
            return '#6b7280';
    }
}
/**
 * Get bottleneck severity color
 */
export function getBottleneckSeverityColor(severity) {
    const colors = {
        low: '#6b7280',
        medium: '#ca8a04',
        high: '#ea580c',
        critical: '#dc2626',
    };
    return colors[severity] || '#6b7280';
}
/**
 * Get bottleneck severity label
 */
export function getBottleneckSeverityLabel(severity) {
    const labels = {
        low: '低',
        medium: '中',
        high: '高',
        critical: '严重',
    };
    return labels[severity] || severity;
}
/**
 * Get bottleneck type label
 */
export function getBottleneckTypeLabel(type) {
    const labels = {
        cpu: 'CPU',
        memory: '内存',
        gpu: 'GPU',
        disk: '磁盘',
        io: 'I/O',
        algorithm: '算法',
    };
    return labels[type] || type;
}
/**
 * Get task type label
 */
export function getTaskTypeLabel(type) {
    const labels = {
        render: '渲染',
        export: '导出',
        'ai-process': 'AI 处理',
        import: '导入',
        'proxy-generate': '代理生成',
        other: '其他',
    };
    return labels[type] || type;
}
/**
 * Get task status label
 */
export function getTaskStatusLabel(status) {
    const labels = {
        running: '运行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消',
    };
    return labels[status] || status;
}
/**
 * Get task status color
 */
export function getTaskStatusColor(status) {
    const colors = {
        running: '#2563eb',
        completed: '#16a34a',
        failed: '#dc2626',
        cancelled: '#6b7280',
    };
    return colors[status] || '#6b7280';
}
/**
 * Get optimization priority color
 */
export function getOptimizationPriorityColor(priority) {
    const colors = {
        low: '#6b7280',
        medium: '#ca8a04',
        high: '#dc2626',
    };
    return colors[priority] || '#6b7280';
}
/**
 * Get optimization category label
 */
export function getOptimizationCategoryLabel(category) {
    const labels = {
        hardware: '硬件',
        software: '软件',
        workflow: '工作流',
        settings: '设置',
    };
    return labels[category] || category;
}
/**
 * Get current metrics summary for display
 */
export function getMetricsSummary(state) {
    if (!state.currentMetrics)
        return [];
    const { thresholds } = state.config;
    const m = state.currentMetrics;
    return [
        {
            label: 'CPU',
            value: `${m.cpu.usage.toFixed(1)}%`,
            color: getMetricStatusColor(m.cpu.usage, thresholds.cpuWarning, thresholds.cpuCritical),
            icon: 'cpu',
        },
        {
            label: '内存',
            value: `${m.memory.usage.toFixed(1)}%`,
            color: getMetricStatusColor(m.memory.usage, thresholds.memoryWarning, thresholds.memoryCritical),
            icon: 'memory',
        },
        {
            label: 'GPU',
            value: m.gpu ? `${m.gpu.usage.toFixed(1)}%` : 'N/A',
            color: m.gpu
                ? getMetricStatusColor(m.gpu.usage, thresholds.gpuWarning || 80, thresholds.gpuCritical || 95)
                : '#6b7280',
            icon: 'gpu',
        },
        {
            label: '磁盘',
            value: `${m.disk.usage.toFixed(1)}%`,
            color: getMetricStatusColor(m.disk.usage, thresholds.diskWarning, thresholds.diskCritical),
            icon: 'disk',
        },
        {
            label: '性能评分',
            value: `${state.performanceScore}`,
            color: state.performanceScore >= 80 ? '#16a34a' : state.performanceScore >= 60 ? '#ca8a04' : '#dc2626',
            icon: 'score',
        },
    ];
}
/**
 * Get tab options for navigation
 */
export function getPerformanceTabs() {
    return [
        { id: 'overview', label: '概览', icon: 'dashboard' },
        { id: 'cpu', label: 'CPU', icon: 'cpu' },
        { id: 'memory', label: '内存', icon: 'memory' },
        { id: 'gpu', label: 'GPU', icon: 'gpu' },
        { id: 'tasks', label: '任务', icon: 'tasks' },
        { id: 'optimization', label: '优化建议', icon: 'optimize' },
    ];
}
/**
 * Get performance score description
 */
export function getScoreDescription(score) {
    if (score >= 90)
        return '性能优秀';
    if (score >= 80)
        return '性能良好';
    if (score >= 70)
        return '性能一般';
    if (score >= 60)
        return '性能较差';
    return '性能严重下降';
}
/**
 * Get performance score color
 */
export function getScoreColor(score) {
    if (score >= 80)
        return '#16a34a';
    if (score >= 60)
        return '#ca8a04';
    return '#dc2626';
}
//# sourceMappingURL=panel.js.map