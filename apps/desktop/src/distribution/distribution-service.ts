/**
 * 分发服务层
 *
 * 编排智能多平台分发的完整流程：平台选择 → 裁剪分析 → 批量导出 → 发布调度。
 * 连接 UI 层 (distributionStore) 和核心层 (editor-core distribution 模块)。
 */

import type { Project } from '@open-factory/editor-core';
import {
  getDistributionPlatform,
  getTimelinePlaybackDuration,
  createDistributionBatch,
  calculateBatchSmartCrops,
  buildDistributionRecommendations,
  type DistributionPlatformId,
  type DistributionPlatformSpec,
  type SmartCropResult,
  type DistributionBatchResult,
  type DistributionTask,
  type CropAnalysisInput,
} from '@open-factory/editor-core';
import {
  createBatchDistributionSchedules,
  suggestOptimalPublishTime,
  type DistributionSchedule,
  type PublishConfig,
} from '@open-factory/editor-core';
import { useDistributionStore } from '../store/distributionStore';

// ─── 分发服务接口 ────────────────────────────────────────────

export interface StartDistributionOptions {
  /** 目标平台列表 */
  platforms: DistributionPlatformId[];
  /** 输出目录 */
  outputDir: string;
  /** 文件名模板 */
  template?: string;
  /** 是否启用智能裁剪 */
  enableSmartCrop?: boolean;
  /** 发布配置（可选） */
  publishConfig?: PublishConfig;
  /** 定时发布时间（可选，ISO 8601） */
  scheduledAt?: string;
}

export interface DistributionServiceResult {
  batch: DistributionBatchResult;
  schedules?: DistributionSchedule[];
}

// ─── 分发服务 ────────────────────────────────────────────

/**
 * 启动智能多平台分发
 *
 * 完整流程：
 * 1. 验证平台选择
 * 2. 构建裁剪分析输入
 * 3. 计算智能裁剪（如果启用）
 * 4. 生成批量导出任务
 * 5. 创建发布计划（如果指定）
 */
export async function startDistribution(
  project: Project,
  options: StartDistributionOptions,
): Promise<DistributionServiceResult> {
  const store = useDistributionStore.getState();

  // 验证平台
  if (options.platforms.length === 0) {
    throw new Error('请至少选择一个目标平台');
  }

  // 验证输出目录
  if (!options.outputDir) {
    throw new Error('请指定输出目录');
  }

  // 构建裁剪分析输入
  const cropInput = buildCropAnalysisInput(project);

  // 智能裁剪
  let cropResults: Map<string, SmartCropResult> | undefined;
  if (options.enableSmartCrop !== false) {
    const platformSpecs = options.platforms.map(getDistributionPlatform);
    const crops = calculateBatchSmartCrops(cropInput, platformSpecs);
    cropResults = new Map(
      crops.map((crop) => [crop.platformId, crop]),
    );
    store.setCropResults(cropResults);
  }

  // 生成批量导出任务
  const batch = createDistributionBatch({
    project,
    platforms: options.platforms,
    cropResults,
    outputDir: options.outputDir,
    template: options.template,
  });

  store.setCurrentBatch(batch);
  store.setTasks(batch.tasks);

  // 创建发布计划（如果指定）
  let schedules: DistributionSchedule[] | undefined;
  if (options.scheduledAt) {
    schedules = createBatchDistributionSchedules({
      batchId: batch.batchId,
      tasks: batch.tasks.map((t) => ({
        id: t.id,
        platformId: t.platform.id,
        platformName: t.platform.name,
      })),
      scheduledAt: options.scheduledAt,
      publishConfig: options.publishConfig,
    });
    schedules.forEach((s) => store.addSchedule(s));
  }

  return { batch, schedules };
}

// ─── 裁剪分析输入构建 ────────────────────────────────────────────

/**
 * 从项目数据构建裁剪分析输入
 */
export function buildCropAnalysisInput(project: Project): CropAnalysisInput {
  const settings = project.settings;
  const hasSubtitles = project.timeline?.tracks?.some(
    (t) => t.type === 'subtitle',
  ) ?? false;

  return {
    sourceWidth: settings.width,
    sourceHeight: settings.height,
    duration: getTimelinePlaybackDuration(project.timeline),
    subtitleY: hasSubtitles ? 0.85 : undefined,
    subtitleHeight: hasSubtitles ? 0.1 : undefined,
  };
}

// ─── 智能推荐服务 ────────────────────────────────────────────

/**
 * 获取平台推荐
 */
export function getPlatformRecommendations(project: Project) {
  const settings = project.settings;
  const hasSubtitles = project.timeline?.tracks?.some(
    (t) => t.type === 'subtitle',
  ) ?? false;

  return buildDistributionRecommendations({
    width: settings.width,
    height: settings.height,
    durationSecs: getTimelinePlaybackDuration(project.timeline),
    hasSubtitles,
  });
}

// ─── 发布时间建议 ────────────────────────────────────────────

/**
 * 获取各平台的最佳发布时间建议
 */
export function getPublishTimeSuggestions(
  platformIds: DistributionPlatformId[],
): Array<{ platformId: string; platformName: string; suggestion: ReturnType<typeof suggestOptimalPublishTime> }> {
  return platformIds.map((id) => {
    const platform = getDistributionPlatform(id);
    return {
      platformId: id,
      platformName: platform.name,
      suggestion: suggestOptimalPublishTime(id),
    };
  });
}

// ─── 导出设置预览 ────────────────────────────────────────────

export interface ExportSettingsPreview {
  platformId: string;
  platformName: string;
  resolution: string;
  fps: number;
  bitrate: string;
  format: string;
  maxDuration: string;
  estimatedSize: string;
}

/**
 * 生成导出设置预览（不实际导出）
 */
export function previewExportSettings(
  project: Project,
  platformIds: DistributionPlatformId[],
): ExportSettingsPreview[] {
  const duration = getTimelinePlaybackDuration(project.timeline);

  return platformIds.map((id) => {
    const platform = getDistributionPlatform(id);
    const videoBitrateBps = parseBitrate(platform.videoBitrate);
    const audioBitrateBps = parseBitrate(platform.audioBitrate);
    const estimatedBytes = Math.round(((videoBitrateBps + audioBitrateBps) * duration) / 8);

    return {
      platformId: id,
      platformName: platform.name,
      resolution: `${platform.width}×${platform.height}`,
      fps: platform.fps,
      bitrate: `${platform.videoBitrate} / ${platform.audioBitrate}`,
      format: platform.format,
      maxDuration: platform.maxDurationSecs
        ? `${platform.maxDurationSecs}s`
        : '无限制',
      estimatedSize: formatFileSize(estimatedBytes),
    };
  });
}

// ─── 工具函数 ────────────────────────────────────────────

function parseBitrate(bitrate: string): number {
  const match = bitrate.match(/^(\d+(?:\.\d+)?)\s*([kKmMgG])?/);
  if (!match) return 5_000_000;
  const value = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  switch (unit) {
    case 'k': return value * 1_000;
    case 'm': return value * 1_000_000;
    case 'g': return value * 1_000_000_000;
    default: return value;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
