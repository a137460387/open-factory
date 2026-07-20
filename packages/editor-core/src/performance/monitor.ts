/**
 * Performance Monitor - Real-time performance monitoring and optimization
 * Tracks system resources, analyzes task performance, and provides optimization suggestions
 */

import type {
  MonitorConfig,
  SystemMetrics,
  TaskMetrics,
  Bottleneck,
  OptimizationRecommendation,
  PerformanceTrend,
  TrendPoint,
  PerformanceDashboard,
} from './types';

import { DEFAULT_MONITOR_CONFIG } from './types';

let monitorIdCounter = 0;

function generateMonitorId(): string {
  monitorIdCounter += 1;
  return `perf-${Date.now()}-${monitorIdCounter}`;
}

/**
 * Simulate system metrics collection
 * In production, this would use actual system APIs
 */
export function collectSystemMetrics(): SystemMetrics {
  // Simulated metrics for demo purposes
  const cpuUsage = 30 + Math.random() * 40;
  const memoryUsed = 8 * 1024 * 1024 * 1024 * (0.4 + Math.random() * 0.3);
  const memoryTotal = 16 * 1024 * 1024 * 1024;

  return {
    timestamp: Date.now(),
    cpu: {
      usage: cpuUsage,
      cores: 8,
      temperature: 45 + Math.random() * 20,
    },
    memory: {
      used: memoryUsed,
      total: memoryTotal,
      usage: (memoryUsed / memoryTotal) * 100,
    },
    gpu: {
      usage: 20 + Math.random() * 30,
      memoryUsed: 4 * 1024 * 1024 * 1024 * (0.3 + Math.random() * 0.2),
      memoryTotal: 8 * 1024 * 1024 * 1024,
      temperature: 50 + Math.random() * 25,
    },
    disk: {
      readSpeed: 100 + Math.random() * 200,
      writeSpeed: 50 + Math.random() * 150,
      usage: 60 + Math.random() * 20,
    },
  };
}

/**
 * Calculate trend from data points
 */
export function calculateTrend(
  points: TrendPoint[],
  windowSize: number = 10,
): PerformanceTrend {
  if (points.length === 0) {
    return {
      metric: '',
      unit: '',
      points: [],
      avg: 0,
      min: 0,
      max: 0,
      trend: 'stable',
    };
  }

  const values = points.map((p) => p.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Determine trend by comparing first and second half averages
  let trend: PerformanceTrend['trend'] = 'stable';
  if (points.length >= windowSize) {
    const half = Math.floor(points.length / 2);
    const firstHalfAvg = points.slice(0, half).reduce((s, p) => s + p.value, 0) / half;
    const secondHalfAvg = points.slice(half).reduce((s, p) => s + p.value, 0) / (points.length - half);
    const change = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (change > 0.1) trend = 'degrading';
    else if (change < -0.1) trend = 'improving';
  }

  return {
    metric: '',
    unit: '',
    points,
    avg,
    min,
    max,
    trend,
  };
}

/**
 * Detect performance bottlenecks
 */
export function detectBottlenecks(
  metrics: SystemMetrics[],
  config: MonitorConfig = DEFAULT_MONITOR_CONFIG,
): Bottleneck[] {
  if (metrics.length === 0) return [];

  const bottlenecks: Bottleneck[] = [];
  const latest = metrics[metrics.length - 1];
  const { thresholds } = config;

  // CPU bottleneck
  if (latest.cpu.usage >= thresholds.cpuCritical) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'cpu',
      severity: 'critical',
      description: `CPU 使用率极高: ${latest.cpu.usage.toFixed(1)}%`,
      impact: '可能导致渲染卡顿和响应延迟',
      suggestion: '关闭后台任务或降低渲染质量',
      metric: latest.cpu.usage,
      threshold: thresholds.cpuCritical,
    });
  } else if (latest.cpu.usage >= thresholds.cpuWarning) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'cpu',
      severity: 'medium',
      description: `CPU 使用率较高: ${latest.cpu.usage.toFixed(1)}%`,
      impact: '可能影响实时预览性能',
      suggestion: '考虑降低预览分辨率',
      metric: latest.cpu.usage,
      threshold: thresholds.cpuWarning,
    });
  }

  // Memory bottleneck
  if (latest.memory.usage >= thresholds.memoryCritical) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'memory',
      severity: 'critical',
      description: `内存使用率极高: ${latest.memory.usage.toFixed(1)}%`,
      impact: '可能导致应用程序崩溃或严重卡顿',
      suggestion: '释放缓存或关闭不必要的项目',
      metric: latest.memory.usage,
      threshold: thresholds.memoryCritical,
    });
  } else if (latest.memory.usage >= thresholds.memoryWarning) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'memory',
      severity: 'medium',
      description: `内存使用率较高: ${latest.memory.usage.toFixed(1)}%`,
      impact: '可能影响大文件处理性能',
      suggestion: '考虑清理缓存或使用代理文件',
      metric: latest.memory.usage,
      threshold: thresholds.memoryWarning,
    });
  }

  // GPU bottleneck
  if (latest.gpu) {
    const gpuWarning = thresholds.gpuWarning || 80;
    const gpuCritical = thresholds.gpuCritical || 95;

    if (latest.gpu.usage >= gpuCritical) {
      bottlenecks.push({
        id: generateMonitorId(),
        type: 'gpu',
        severity: 'critical',
        description: `GPU 使用率极高: ${latest.gpu.usage.toFixed(1)}%`,
        impact: '硬件加速效果降低，渲染变慢',
        suggestion: '降低特效复杂度或使用 CPU 渲染',
        metric: latest.gpu.usage,
        threshold: gpuCritical,
      });
    } else if (latest.gpu.usage >= gpuWarning) {
      bottlenecks.push({
        id: generateMonitorId(),
        type: 'gpu',
        severity: 'medium',
        description: `GPU 使用率较高: ${latest.gpu.usage.toFixed(1)}%`,
        impact: 'GPU 加速效果可能受限',
        suggestion: '监控 GPU 温度，避免过热降频',
        metric: latest.gpu.usage,
        threshold: gpuWarning,
      });
    }
  }

  // Disk bottleneck
  if (latest.disk.usage >= thresholds.diskCritical) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'disk',
      severity: 'high',
      description: `磁盘空间不足: ${latest.disk.usage.toFixed(1)}% 已用`,
      impact: '无法继续渲染或导出',
      suggestion: '清理缓存文件或移动项目到其他磁盘',
      metric: latest.disk.usage,
      threshold: thresholds.diskCritical,
    });
  }

  // I/O bottleneck
  if (latest.disk.readSpeed < 50 || latest.disk.writeSpeed < 30) {
    bottlenecks.push({
      id: generateMonitorId(),
      type: 'io',
      severity: 'medium',
      description: '磁盘 I/O 速度较慢',
      impact: '素材加载和导出速度受限',
      suggestion: '检查磁盘健康状态或使用 SSD',
    });
  }

  return bottlenecks;
}

/**
 * Analyze task performance
 */
export function analyzeTaskPerformance(tasks: TaskMetrics[]): {
  avgDuration: number;
  byType: Record<string, { count: number; avgDuration: number; successRate: number }>;
  slowestTasks: TaskMetrics[];
  failedTasks: TaskMetrics[];
} {
  if (tasks.length === 0) {
    return {
      avgDuration: 0,
      byType: {},
      slowestTasks: [],
      failedTasks: [],
    };
  }

  const completed = tasks.filter((t) => t.status === 'completed' && t.duration);
  const avgDuration =
    completed.length > 0
      ? completed.reduce((s, t) => s + (t.duration || 0), 0) / completed.length
      : 0;

  // Group by type
  const byType: Record<string, { count: number; totalDuration: number; success: number }> = {};
  for (const task of tasks) {
    if (!byType[task.taskType]) {
      byType[task.taskType] = { count: 0, totalDuration: 0, success: 0 };
    }
    byType[task.taskType].count++;
    if (task.duration) byType[task.taskType].totalDuration += task.duration;
    if (task.status === 'completed') byType[task.taskType].success++;
  }

  const byTypeStats: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
  for (const [type, stats] of Object.entries(byType)) {
    byTypeStats[type] = {
      count: stats.count,
      avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      successRate: stats.count > 0 ? (stats.success / stats.count) * 100 : 0,
    };
  }

  // Find slowest and failed tasks
  const slowestTasks = [...completed].sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 5);
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  return {
    avgDuration,
    byType: byTypeStats,
    slowestTasks,
    failedTasks,
  };
}

/**
 * Generate optimization recommendations
 */
export function generateOptimizations(
  metrics: SystemMetrics[],
  tasks: TaskMetrics[],
  bottlenecks: Bottleneck[],
  config: MonitorConfig = DEFAULT_MONITOR_CONFIG,
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const taskAnalysis = analyzeTaskPerformance(tasks);

  // CPU optimization
  const cpuBottlenecks = bottlenecks.filter((b) => b.type === 'cpu');
  if (cpuBottlenecks.length > 0) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'settings',
      priority: 'high',
      title: '降低 CPU 负载',
      description: '当前 CPU 使用率过高，建议调整设置',
      estimatedImprovement: '降低 20-30% CPU 使用',
      implementation: '降低预览分辨率、关闭实时特效、减少并发任务数',
    });
  }

  // Memory optimization
  const memoryBottlenecks = bottlenecks.filter((b) => b.type === 'memory');
  if (memoryBottlenecks.length > 0) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'workflow',
      priority: 'high',
      title: '优化内存使用',
      description: '内存使用率过高，可能导致性能下降',
      estimatedImprovement: '释放 20-40% 内存',
      implementation: '清理缓存、使用代理文件、分段处理长视频',
    });
  }

  // GPU optimization
  const gpuBottlenecks = bottlenecks.filter((b) => b.type === 'gpu');
  if (gpuBottlenecks.length > 0) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'hardware',
      priority: 'medium',
      title: '优化 GPU 使用',
      description: 'GPU 负载较高，可能影响实时预览',
      estimatedImprovement: '提升 15-25% 渲染性能',
      implementation: '降低特效复杂度、使用硬件编解码器、避免 GPU 过热',
    });
  }

  // Task-specific optimizations
  if (taskAnalysis.byType['render']?.avgDuration > 30000) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'workflow',
      priority: 'medium',
      title: '优化渲染流程',
      description: '平均渲染时间较长',
      estimatedImprovement: '减少 30-50% 渲染时间',
      implementation: '使用代理文件预览、启用硬件加速、优化特效链',
    });
  }

  if (taskAnalysis.byType['ai-process']?.avgDuration > 60000) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'settings',
      priority: 'medium',
      title: '优化 AI 处理',
      description: 'AI 分析任务耗时较长',
      estimatedImprovement: '减少 40-60% AI 处理时间',
      implementation: '降低 AI 分辨率、使用批量处理、启用 GPU 加速',
    });
  }

  // Disk optimization
  const diskBottlenecks = bottlenecks.filter((b) => b.type === 'disk' || b.type === 'io');
  if (diskBottlenecks.length > 0) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'hardware',
      priority: 'high',
      title: '优化磁盘性能',
      description: '磁盘空间不足或 I/O 速度慢',
      estimatedImprovement: '提升 2-5x 磁盘性能',
      implementation: '清理缓存、使用 SSD、将项目移至更快的磁盘',
    });
  }

  // General recommendations
  if (!config.optimization.preferQuality) {
    recommendations.push({
      id: generateMonitorId(),
      category: 'settings',
      priority: 'low',
      title: '速度优先模式',
      description: '当前使用速度优先设置',
      estimatedImprovement: '提升 2x 预览流畅度',
      implementation: '降低预览质量、使用代理文件、关闭非必要特效',
    });
  }

  return recommendations;
}

/**
 * Generate performance dashboard
 */
export function generateDashboard(
  metricsHistory: SystemMetrics[],
  tasks: TaskMetrics[],
  config: MonitorConfig = DEFAULT_MONITOR_CONFIG,
): PerformanceDashboard {
  const latest = metricsHistory.length > 0 ? metricsHistory[metricsHistory.length - 1] : collectSystemMetrics();
  const bottlenecks = detectBottlenecks(metricsHistory, config);
  const recommendations = generateOptimizations(metricsHistory, tasks, bottlenecks, config);

  // Calculate trends
  const cpuTrend = calculateTrend(
    metricsHistory.map((m) => ({ timestamp: m.timestamp, value: m.cpu.usage })),
  );
  cpuTrend.metric = 'CPU 使用率';
  cpuTrend.unit = '%';

  const memoryTrend = calculateTrend(
    metricsHistory.map((m) => ({ timestamp: m.timestamp, value: m.memory.usage })),
  );
  memoryTrend.metric = '内存使用率';
  memoryTrend.unit = '%';

  const gpuTrend = metricsHistory[0]?.gpu
    ? calculateTrend(
        metricsHistory.filter((m) => m.gpu).map((m) => ({ timestamp: m.timestamp, value: m.gpu!.usage })),
      )
    : undefined;
  if (gpuTrend) {
    gpuTrend.metric = 'GPU 使用率';
    gpuTrend.unit = '%';
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed' && t.duration);
  const taskDurationTrend = calculateTrend(
    completedTasks.map((t) => ({ timestamp: t.startTime, value: t.duration || 0 })),
  );
  taskDurationTrend.metric = '任务耗时';
  taskDurationTrend.unit = 'ms';

  return {
    timestamp: Date.now(),
    currentMetrics: latest,
    recentTasks: tasks.slice(-10),
    bottlenecks,
    recommendations,
    trends: {
      cpu: cpuTrend,
      memory: memoryTrend,
      gpu: gpuTrend,
      taskDuration: taskDurationTrend,
    },
  };
}

/**
 * Check if a metric exceeds threshold
 */
export function checkThreshold(
  value: number,
  warning: number,
  critical: number,
): 'normal' | 'warning' | 'critical' {
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'normal';
}

/**
 * Format metric value with unit
 */
export function formatMetric(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'MB') return `${(value / 1024 / 1024).toFixed(0)} MB`;
  if (unit === 'GB') return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (unit === 'ms') return `${value.toFixed(0)} ms`;
  if (unit === 's') return `${(value / 1000).toFixed(1)} s`;
  return `${value} ${unit}`;
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(bottlenecks: Bottleneck[]): number {
  let score = 100;

  for (const bottleneck of bottlenecks) {
    switch (bottleneck.severity) {
      case 'critical':
        score -= 25;
        break;
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 5;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}
