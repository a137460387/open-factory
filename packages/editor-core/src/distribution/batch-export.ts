/**
 * 批量导出引擎
 *
 * 编排多平台并行导出，复用现有 export-queue 和 scheduling 基础设施。
 * 为每个目标平台生成独立的导出任务，统一管理进度和错误处理。
 */

import type { Project } from '../model-types';
import type { ExportSettings } from '../export/export-types';
import type { ExportTaskPriority } from '../export/export-queue';
import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
import type { SmartCropResult } from './smart-crop';
import { getDistributionPlatform } from './platform-presets';
import { cropResultToReframeOffset } from './smart-crop';
import { getTimelinePlaybackDuration } from '../timeline';
import { formatDuration } from '../utils/time';

// ─── 批量请求 ────────────────────────────────────────────

export interface DistributionBatchRequest {
  /** 源项目 */
  project: Project;
  /** 目标平台列表 */
  platforms: DistributionPlatformId[];
  /** 各平台的裁剪结果（可选） */
  cropResults?: Map<string, SmartCropResult>;
  /** 输出目录 */
  outputDir: string;
  /** 文件名模板，支持 {platform}, {date}, {project} 占位符 */
  template?: string;
  /** 任务优先级 */
  priority?: ExportTaskPriority;
  /** 自定义设置覆盖 */
  settingsOverride?: Partial<ExportSettings>;
}

// ─── 单个平台任务 ────────────────────────────────────────────

export interface DistributionTask {
  /** 任务 ID */
  id: string;
  /** 目标平台 */
  platform: DistributionPlatformSpec;
  /** 导出设置 */
  settings: ExportSettings;
  /** 预估导出时长（秒） */
  estimatedDurationSecs: number;
  /** 预估文件大小（字节） */
  estimatedFileSizeBytes: number;
  /** 状态 */
  status: DistributionTaskStatus;
  /** 进度 (0-1) */
  progress: number;
  /** 错误信息 */
  error?: string;
}

export type DistributionTaskStatus = 'pending' | 'running' | 'success' | 'error' | 'canceled';

// ─── 批量结果 ────────────────────────────────────────────

export interface DistributionBatchResult {
  /** 批次 ID */
  batchId: string;
  /** 任务列表 */
  tasks: DistributionTask[];
  /** 总预估时长（秒） */
  totalEstimatedDurationSecs: number;
  /** 总预估文件大小（字节） */
  totalEstimatedFileSizeBytes: number;
}

// ─── 成本估算 ────────────────────────────────────────────

interface ExportCostEstimate {
  durationSecs: number;
  fileSizeBytes: number;
}

/**
 * 估算单个平台导出的成本
 * 基于码率和时长的简单估算
 */
function estimateExportCost(project: Project, platform: DistributionPlatformSpec): ExportCostEstimate {
  const durationSecs = getTimelinePlaybackDuration(project.timeline);

  // 视频文件大小 = 视频码率 × 时长 + 音频码率 × 时长
  const videoBitrateBps = parseBitrate(platform.videoBitrate);
  const audioBitrateBps = parseBitrate(platform.audioBitrate);
  const fileSizeBytes = Math.round(((videoBitrateBps + audioBitrateBps) * durationSecs) / 8);

  // 导出时间估算：假设 2x 实时速度
  const estimatedDurationSecs = durationSecs / 2;

  return {
    durationSecs: estimatedDurationSecs,
    fileSizeBytes,
  };
}

/** 解析码率字符串为 bps */
function parseBitrate(bitrate: string): number {
  const match = bitrate.match(/^(\d+(?:\.\d+)?)\s*([kKmMgG])?/);
  if (!match) return 5_000_000; // 默认 5Mbps

  const value = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();

  switch (unit) {
    case 'k':
      return value * 1_000;
    case 'm':
      return value * 1_000_000;
    case 'g':
      return value * 1_000_000_000;
    default:
      return value;
  }
}

// ─── 文件名模板 ────────────────────────────────────────────

/**
 * 应用文件名模板
 *
 * 支持的占位符：
 * - {platform}: 平台名称
 * - {platform_id}: 平台 ID
 * - {date}: 当前日期 (YYYY-MM-DD)
 * - {project}: 项目名称
 * - {resolution}: 分辨率 (如 1920x1080)
 * - {aspect}: 宽高比 (如 16-9)
 */
export function applyDistributionTemplate(
  template: string,
  platform: DistributionPlatformSpec,
  projectName: string,
): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return template
    .replace(/\{platform\}/g, platform.name)
    .replace(/\{platform_id\}/g, platform.id)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{project\}/g, projectName)
    .replace(/\{resolution\}/g, `${platform.width}x${platform.height}`)
    .replace(/\{aspect\}/g, platform.aspectRatio.replace(':', '-'));
}

// ─── 导出设置构建 ────────────────────────────────────────────

const DEFAULT_DISTRIBUTION_TEMPLATE = '{project}-{platform}-{resolution}';

/**
 * 为指定平台构建导出设置
 */
export function buildPlatformExportSettings(
  platform: DistributionPlatformSpec,
  outputDir: string,
  projectName: string,
  template: string = DEFAULT_DISTRIBUTION_TEMPLATE,
  cropResult?: SmartCropResult,
  override?: Partial<ExportSettings>,
): ExportSettings {
  const fileName = applyDistributionTemplate(template, platform, projectName);
  const outputPath = `${outputDir}/${fileName}.${platform.format}`;

  const reframeOffset = cropResult ? cropResultToReframeOffset(cropResult) : { reframeOffsetX: 0, reframeOffsetY: 0 };

  const settings: ExportSettings = {
    width: platform.width,
    height: platform.height,
    fps: platform.fps,
    sampleRate: 44100,
    videoCodec: platform.videoCodec,
    audioCodec: platform.audioCodec,
    format: platform.format,
    outputPath,
    videoBitrate: platform.videoBitrate,
    audioBitrate: platform.audioBitrate,
    videoProfile: platform.videoProfile,
    scaleMode: 'fit',
    targetAspectRatio: 'source',
    reframeOffsetX: reframeOffset.reframeOffsetX,
    reframeOffsetY: reframeOffset.reframeOffsetY,
    hardwareEncoding: false,
    loudnessNormalization: platform.loudnessTarget ?? 'off',
    platformPreset: mapPlatformIdToExportPreset(platform.id),
    ...override,
  };

  return settings;
}

/** 将 DistributionPlatformId 映射到 ExportPlatformPreset */
function mapPlatformIdToExportPreset(id: DistributionPlatformId): ExportSettings['platformPreset'] {
  const mapping: Record<string, ExportSettings['platformPreset']> = {
    'youtube-1080p': 'youtube-1080p',
    'youtube-shorts': 'youtube-shorts',
    tiktok: 'tiktok',
    'instagram-reels': 'instagram-reels',
    'instagram-feed': 'instagram-reels',
    'twitter-x': 'twitter-x',
    bilibili: 'bilibili',
    'weixin-channels': 'bilibili',
    kuaishou: 'tiktok',
    pinterest: 'instagram-reels',
  };
  return mapping[id];
}

// ─── 批量任务生成 ────────────────────────────────────────────

/**
 * 生成分发批次任务列表
 *
 * @param request 批量分发请求
 * @returns 批次结果，包含所有平台的导出任务
 */
export function createDistributionBatch(request: DistributionBatchRequest): DistributionBatchResult {
  const batchId = generateBatchId();
  const projectName = request.project.name ?? 'Untitled';
  const template = request.template ?? DEFAULT_DISTRIBUTION_TEMPLATE;

  const tasks: DistributionTask[] = request.platforms.map((platformId, index) => {
    const platform = getDistributionPlatform(platformId);
    const cropResult = request.cropResults?.get(platformId);

    const settings = buildPlatformExportSettings(
      platform,
      request.outputDir,
      projectName,
      template,
      cropResult,
      request.settingsOverride,
    );

    const cost = estimateExportCost(request.project, platform);

    return {
      id: `${batchId}-${index}`,
      platform,
      settings,
      estimatedDurationSecs: cost.durationSecs,
      estimatedFileSizeBytes: cost.fileSizeBytes,
      status: 'pending' as const,
      progress: 0,
    };
  });

  const totalEstimatedDurationSecs = tasks.reduce((sum, t) => sum + t.estimatedDurationSecs, 0);
  const totalEstimatedFileSizeBytes = tasks.reduce((sum, t) => sum + t.estimatedFileSizeBytes, 0);

  return {
    batchId,
    tasks,
    totalEstimatedDurationSecs,
    totalEstimatedFileSizeBytes,
  };
}

// ─── 进度更新 ────────────────────────────────────────────

/** 更新任务进度 */
export function updateDistributionTaskProgress(
  tasks: DistributionTask[],
  taskId: string,
  progress: number,
): DistributionTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.max(0, Math.min(1, progress)) } : task));
}

/** 完成任务 */
export function finishDistributionTask(tasks: DistributionTask[], taskId: string): DistributionTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'success' as const, progress: 1 } : task));
}

/** 任务失败 */
export function failDistributionTask(tasks: DistributionTask[], taskId: string, error: string): DistributionTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'error' as const, error } : task));
}

/** 取消任务 */
export function cancelDistributionTask(tasks: DistributionTask[], taskId: string): DistributionTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: 'canceled' as const } : task));
}

/** 检查批次是否全部完成 */
export function isDistributionBatchComplete(tasks: DistributionTask[]): boolean {
  return tasks.every((t) => t.status === 'success' || t.status === 'error' || t.status === 'canceled');
}

/** 获取批次统计 */
export function getDistributionBatchStats(tasks: DistributionTask[]): {
  total: number;
  pending: number;
  running: number;
  success: number;
  error: number;
  canceled: number;
} {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    running: tasks.filter((t) => t.status === 'running').length,
    success: tasks.filter((t) => t.status === 'success').length,
    error: tasks.filter((t) => t.status === 'error').length,
    canceled: tasks.filter((t) => t.status === 'canceled').length,
  };
}

// ─── 工具函数 ────────────────────────────────────────────

function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `dist-${timestamp}-${random}`;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 格式化时长 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`;
}
