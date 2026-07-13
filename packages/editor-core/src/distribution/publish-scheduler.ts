/**
 * 发布计划调度系统
 *
 * 管理多平台定时发布调度，复用现有 publish-pipeline 基础设施。
 * 支持为每个平台设置独立的发布时间，统一管理发布历史。
 */

import type { ExportPublishPlatform } from '../export/publish-pipeline';

// ─── 发布计划 ────────────────────────────────────────────

export interface DistributionSchedule {
  /** 计划 ID */
  id: string;
  /** 关联的批次 ID */
  batchId: string;
  /** 关联的任务 ID */
  taskId: string;
  /** 目标平台 ID */
  platformId: string;
  /** 目标平台名称 */
  platformName: string;
  /** 计划发布时间 (ISO 8601) */
  scheduledAt: string;
  /** 状态 */
  status: DistributionScheduleStatus;
  /** 发布配置 */
  publishConfig?: PublishConfig;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 错误信息 */
  error?: string;
}

export type DistributionScheduleStatus =
  | 'pending'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled';

// ─── 发布配置 ────────────────────────────────────────────

export interface PublishConfig {
  /** 目标平台 */
  platform: ExportPublishPlatform;
  /** 视频标题 */
  title?: string;
  /** 视频描述 */
  description?: string;
  /** 标签 */
  tags?: string[];
  /** 是否公开 */
  isPublic?: boolean;
  /** 定时发布时间窗口 */
  publishWindow?: {
    daysOfWeek: number[];
    startHour: number;
    endHour: number;
    timezoneOffsetMinutes: number;
  };
}

// ─── 发布历史 ────────────────────────────────────────────

export interface DistributionHistoryEntry {
  /** 历史 ID */
  id: string;
  /** 计划 ID */
  scheduleId: string;
  /** 平台名称 */
  platformName: string;
  /** 发布状态 */
  status: 'success' | 'failed';
  /** 发布时间 */
  publishedAt: string;
  /** 输出文件路径 */
  outputPath?: string;
  /** 文件大小 (字节) */
  fileSizeBytes?: number;
  /** 错误信息 */
  error?: string;
  /** 耗时 (毫秒) */
  durationMs?: number;
}

// ─── 调度管理 ────────────────────────────────────────────

/**
 * 创建发布计划
 */
export function createDistributionSchedule(input: {
  batchId: string;
  taskId: string;
  platformId: string;
  platformName: string;
  scheduledAt: string;
  publishConfig?: PublishConfig;
}): DistributionSchedule {
  const now = new Date().toISOString();
  return {
    id: generateScheduleId(),
    batchId: input.batchId,
    taskId: input.taskId,
    platformId: input.platformId,
    platformName: input.platformName,
    scheduledAt: input.scheduledAt,
    status: 'pending',
    publishConfig: input.publishConfig,
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 批量创建发布计划
 */
export function createBatchDistributionSchedules(input: {
  batchId: string;
  tasks: Array<{ id: string; platformId: string; platformName: string }>;
  scheduledAt: string;
  publishConfig?: PublishConfig;
}): DistributionSchedule[] {
  return input.tasks.map((task) =>
    createDistributionSchedule({
      batchId: input.batchId,
      taskId: task.id,
      platformId: task.platformId,
      platformName: task.platformName,
      scheduledAt: input.scheduledAt,
      publishConfig: input.publishConfig,
    }),
  );
}

// ─── 状态更新 ────────────────────────────────────────────

/** 更新计划状态 */
export function updateScheduleStatus(
  schedule: DistributionSchedule,
  status: DistributionScheduleStatus,
  error?: string,
): DistributionSchedule {
  return {
    ...schedule,
    status,
    error,
    updatedAt: new Date().toISOString(),
    retryCount: status === 'failed' ? schedule.retryCount + 1 : schedule.retryCount,
  };
}

/** 检查计划是否可以重试 */
export function canRetrySchedule(schedule: DistributionSchedule): boolean {
  return schedule.status === 'failed' && schedule.retryCount < schedule.maxRetries;
}

/** 取消计划 */
export function cancelSchedule(schedule: DistributionSchedule): DistributionSchedule {
  if (schedule.status === 'published') {
    return schedule; // 已发布的不能取消
  }
  return updateScheduleStatus(schedule, 'canceled');
}

// ─── 时间调度 ────────────────────────────────────────────

/**
 * 检查计划是否到达发布时间
 */
export function isScheduleReady(schedule: DistributionSchedule): boolean {
  if (schedule.status !== 'pending') return false;
  const scheduledTime = new Date(schedule.scheduledAt).getTime();
  return Date.now() >= scheduledTime;
}

/**
 * 获取所有待发布的计划，按发布时间排序
 */
export function getPendingSchedules(
  schedules: DistributionSchedule[],
): DistributionSchedule[] {
  return schedules
    .filter((s) => s.status === 'pending')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

/**
 * 获取所有已到期的计划
 */
export function getDueSchedules(
  schedules: DistributionSchedule[],
): DistributionSchedule[] {
  return schedules.filter(isScheduleReady);
}

// ─── 统计 ────────────────────────────────────────────

export interface DistributionScheduleStats {
  total: number;
  pending: number;
  ready: number;
  publishing: number;
  published: number;
  failed: number;
  canceled: number;
}

/** 获取调度统计 */
export function getScheduleStats(
  schedules: DistributionSchedule[],
): DistributionScheduleStats {
  return {
    total: schedules.length,
    pending: schedules.filter((s) => s.status === 'pending').length,
    ready: schedules.filter((s) => s.status === 'ready').length,
    publishing: schedules.filter((s) => s.status === 'publishing').length,
    published: schedules.filter((s) => s.status === 'published').length,
    failed: schedules.filter((s) => s.status === 'failed').length,
    canceled: schedules.filter((s) => s.status === 'canceled').length,
  };
}

// ─── 发布历史管理 ────────────────────────────────────────────

const MAX_HISTORY_ENTRIES = 200;

/** 添加历史记录 */
export function addHistoryEntry(
  history: DistributionHistoryEntry[],
  entry: DistributionHistoryEntry,
): DistributionHistoryEntry[] {
  const next = [entry, ...history];
  return next.slice(0, MAX_HISTORY_ENTRIES);
}

/** 按平台过滤历史 */
export function filterHistoryByPlatform(
  history: DistributionHistoryEntry[],
  platformName: string,
): DistributionHistoryEntry[] {
  return history.filter((h) => h.platformName === platformName);
}

/** 获取最近的历史记录 */
export function getRecentHistory(
  history: DistributionHistoryEntry[],
  count: number = 10,
): DistributionHistoryEntry[] {
  return history.slice(0, count);
}

// ─── 最佳发布时间建议 ────────────────────────────────────────────

export interface OptimalTimeSuggestion {
  platform: string;
  suggestedHour: number;
  suggestedDayOfWeek: number;
  reason: string;
}

/**
 * 基于平台特征建议最佳发布时间
 *
 * 简化版本，基于常见社交媒体发布时间最佳实践：
 * - YouTube: 周末下午 2-4 点
 * - TikTok: 晚上 7-9 点
 * - Instagram: 中午 11-1 点或晚上 7-9 点
 * - Bilibili: 晚上 6-10 点
 */
export function suggestOptimalPublishTime(
  platformId: string,
): OptimalTimeSuggestion {
  const suggestions: Record<string, OptimalTimeSuggestion> = {
    'youtube-1080p': {
      platform: 'YouTube',
      suggestedHour: 15,
      suggestedDayOfWeek: 6,  // 周六
      reason: '周末下午是 YouTube 观看高峰',
    },
    'youtube-shorts': {
      platform: 'YouTube Shorts',
      suggestedHour: 19,
      suggestedDayOfWeek: 5,  // 周五
      reason: '工作日晚上短视频观看量高',
    },
    'tiktok': {
      platform: 'TikTok',
      suggestedHour: 20,
      suggestedDayOfWeek: 3,  // 周三
      reason: '晚上 7-9 点是 TikTok 活跃高峰',
    },
    'instagram-reels': {
      platform: 'Instagram Reels',
      suggestedHour: 12,
      suggestedDayOfWeek: 2,  // 周二
      reason: '午休时间 Instagram 浏览量高',
    },
    'instagram-feed': {
      platform: 'Instagram Feed',
      suggestedHour: 11,
      suggestedDayOfWeek: 1,  // 周一
      reason: '上午是 Instagram Feed 互动高峰',
    },
    'twitter-x': {
      platform: 'Twitter/X',
      suggestedHour: 9,
      suggestedDayOfWeek: 2,  // 周二
      reason: '工作日上午推文阅读量高',
    },
    'bilibili': {
      platform: 'Bilibili',
      suggestedHour: 19,
      suggestedDayOfWeek: 5,  // 周五
      reason: '晚上 7-10 点是 B 站观看高峰',
    },
    'weixin-channels': {
      platform: '微信视频号',
      suggestedHour: 20,
      suggestedDayOfWeek: 0,  // 周日
      reason: '周末晚上微信活跃度最高',
    },
    'kuaishou': {
      platform: '快手',
      suggestedHour: 19,
      suggestedDayOfWeek: 5,  // 周五
      reason: '晚上是快手用户活跃高峰',
    },
    'pinterest': {
      platform: 'Pinterest',
      suggestedHour: 14,
      suggestedDayOfWeek: 6,  // 周六
      reason: '周末下午 Pinterest 浏览量高',
    },
  };

  return suggestions[platformId] ?? {
    platform: platformId,
    suggestedHour: 12,
    suggestedDayOfWeek: 1,
    reason: '默认推荐中午发布',
  };
}

// ─── 工具函数 ────────────────────────────────────────────

function generateScheduleId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sched-${timestamp}-${random}`;
}

/** 格式化发布时间 */
export function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 获取星期名称 */
export function getDayOfWeekName(dayOfWeek: number): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[dayOfWeek] ?? '';
}
