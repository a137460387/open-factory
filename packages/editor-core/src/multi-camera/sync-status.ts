/**
 * 多机位同步状态可视化指示器模块
 *
 * 提供同步质量评估、状态指示和可视化数据生成。
 * 纯函数化设计，不依赖 UI 框架。
 */

import { round } from '../time';

// ── 类型定义 ──────────────────────────────────────────────────

/** 同步质量等级 */
export type SyncQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unsynced';

/** 单个机位的同步状态 */
export interface AngleSyncStatus {
  angleId: string;
  angleName: string;
  offsetMs: number;
  offsetSeconds: number;
  confidence: number;
  quality: SyncQualityLevel;
  driftRateMsPerMin: number;
  hasDrift: boolean;
}

/** 整体同步状态摘要 */
export interface MulticamSyncStatusSummary {
  overallQuality: SyncQualityLevel;
  averageConfidence: number;
  maxOffsetMs: number;
  anyDriftDetected: boolean;
  angleStatuses: AngleSyncStatus[];
  syncedAt: number;
  /** 同步进度 (0-1)，用于进度条显示 */
  syncProgress: number;
}

/** 同步可视化时间轴数据点 */
export interface SyncTimelinePoint {
  time: number;
  offsets: Record<string, number>;
  scores: Record<string, number>;
}

/** 同步波形对齐预览数据 */
export interface SyncAlignmentPreview {
  referencePeaks: number[];
  candidatePeaks: Record<string, number[]>;
  offsets: Record<string, number>;
}

// ── 常量 ──────────────────────────────────────────────────────

/** 同步质量阈值 (毫秒) */
const QUALITY_THRESHOLDS = {
  excellent: 10,   // <10ms 优秀
  good: 30,        // <30ms 良好
  fair: 100,       // <100ms 一般
  poor: 500,       // <500ms 较差
} as const;

/** 置信度阈值 */
const CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.4,
} as const;

// ── 核心函数 ──────────────────────────────────────────────────

/**
 * 根据偏移量和置信度评估单个机位的同步质量等级
 */
export function evaluateSyncQuality(offsetMs: number, confidence: number): SyncQualityLevel {
  const absOffset = Math.abs(offsetMs);

  // 低置信度直接降级
  if (confidence < CONFIDENCE_THRESHOLDS.medium) {
    return absOffset > QUALITY_THRESHOLDS.poor ? 'unsynced' : 'poor';
  }

  if (absOffset < QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (absOffset < QUALITY_THRESHOLDS.good) return 'good';
  if (absOffset < QUALITY_THRESHOLDS.fair) return 'fair';
  if (absOffset < QUALITY_THRESHOLDS.poor) return 'poor';
  return 'unsynced';
}

/**
 * 计算整体同步质量（取所有机位中最差的等级）
 */
export function calculateOverallSyncQuality(angleQualities: SyncQualityLevel[]): SyncQualityLevel {
  if (angleQualities.length === 0) return 'unsynced';

  const priority: Record<SyncQualityLevel, number> = {
    excellent: 0,
    good: 1,
    fair: 2,
    poor: 3,
    unsynced: 4,
  };

  let worst: SyncQualityLevel = 'excellent';
  for (const quality of angleQualities) {
    if (priority[quality] > priority[worst]) {
      worst = quality;
    }
  }
  return worst;
}

/**
 * 为每个机位生成同步状态
 */
export function buildAngleSyncStatuses(
  angleIds: string[],
  angleNames: Record<string, string>,
  offsets: Record<string, number>,
  confidences: Record<string, number>,
  driftRates: Record<string, number> = {},
): AngleSyncStatus[] {
  return angleIds.map((angleId) => {
    const offsetSeconds = offsets[angleId] ?? 0;
    const offsetMs = round(offsetSeconds * 1000);
    const confidence = confidences[angleId] ?? 0;
    const driftRateMsPerMin = driftRates[angleId] ?? 0;
    const hasDrift = Math.abs(driftRateMsPerMin) > 50; // 50ms/min 阈值
    const quality = evaluateSyncQuality(offsetMs, confidence);

    return {
      angleId,
      angleName: angleNames[angleId] ?? angleId,
      offsetMs,
      offsetSeconds,
      confidence,
      quality,
      driftRateMsPerMin,
      hasDrift,
    };
  });
}

/**
 * 构建完整的同步状态摘要
 */
export function buildSyncStatusSummary(
  angleIds: string[],
  angleNames: Record<string, string>,
  offsets: Record<string, number>,
  confidences: Record<string, number>,
  driftRates: Record<string, number> = {},
  syncProgress = 1,
): MulticamSyncStatusSummary {
  const angleStatuses = buildAngleSyncStatuses(angleIds, angleNames, offsets, confidences, driftRates);

  const qualities = angleStatuses.map((s) => s.quality);
  const overallQuality = calculateOverallSyncQuality(qualities);

  const avgConfidence =
    angleStatuses.length > 0
      ? round(angleStatuses.reduce((sum, s) => sum + s.confidence, 0) / angleStatuses.length)
      : 0;

  const maxOffsetMs = angleStatuses.reduce((max, s) => Math.max(max, Math.abs(s.offsetMs)), 0);
  const anyDriftDetected = angleStatuses.some((s) => s.hasDrift);

  return {
    overallQuality,
    averageConfidence: avgConfidence,
    maxOffsetMs,
    anyDriftDetected,
    angleStatuses,
    syncedAt: Date.now(),
    syncProgress: Math.min(1, Math.max(0, syncProgress)),
  };
}

/**
 * 生成同步质量的颜色指示（用于 UI 渲染）
 * 返回 CSS 兼容的颜色值
 */
export function getSyncQualityColor(quality: SyncQualityLevel): string {
  const colors: Record<SyncQualityLevel, string> = {
    excellent: '#22c55e', // green-500
    good: '#84cc16',      // lime-500
    fair: '#eab308',      // yellow-500
    poor: '#f97316',      // orange-500
    unsynced: '#ef4444',  // red-500
  };
  return colors[quality];
}

/**
 * 生成同步质量的中文标签
 */
export function getSyncQualityLabel(quality: SyncQualityLevel): string {
  const labels: Record<SyncQualityLevel, string> = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',
    unsynced: '未同步',
  };
  return labels[quality];
}

/**
 * 生成偏移量的可读格式
 */
export function formatOffsetDisplay(offsetMs: number): string {
  const absMs = Math.abs(offsetMs);
  if (absMs < 1) return '0ms';
  if (absMs < 1000) return `${Math.round(offsetMs)}ms`;
  return `${(offsetMs / 1000).toFixed(2)}s`;
}

/**
 * 构建同步时间轴数据（用于波形对齐可视化）
 * 将窗口同步结果转换为可绘制的时间轴数据
 */
export function buildSyncTimelineData(
  windowResults: Array<{ startTime: number; endTime: number; offsetSeconds: number; score: number }>,
  angleId: string,
): SyncTimelinePoint[] {
  return windowResults.map((w) => ({
    time: round((w.startTime + w.endTime) / 2),
    offsets: { [angleId]: w.offsetSeconds },
    scores: { [angleId]: w.score },
  }));
}
