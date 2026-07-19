/**
 * 多格式生成引擎
 *
 * 基于源时间线自动适配多种输出格式（横版、竖版、方形等）。
 * 复用现有 smart-crop 裁剪能力和 platform-presets 平台定义，
 * 通过智能裁剪确保主体居中且突出。
 *
 * 核心能力：
 * - 从单一源时间线生成多格式变体
 * - 智能裁剪区域计算（结合运动检测、字幕安全区）
 * - 格式预览数据生成
 * - 与批量导出引擎集成
 */

import type { Project, Timeline, Track, VideoClip, ImageClip } from '../model-types';
import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
import type { SmartCropResult, CropAnalysisInput } from './smart-crop';
import { getDistributionPlatform, DISTRIBUTION_PLATFORMS } from './platform-presets';
import { calculateSmartCrop, calculateBatchSmartCrops, parseAspectRatio } from './smart-crop';

// ─── 格式变体类型 ────────────────────────────────────────────

/** 画面方向 */
export type VideoOrientation = 'landscape' | 'portrait' | 'square';

/** 格式变体定义 */
export interface FormatVariant {
  /** 变体唯一 ID */
  id: string;
  /** 目标方向 */
  orientation: VideoOrientation;
  /** 目标宽高比字符串 */
  aspectRatio: string;
  /** 输出宽度 (px) */
  width: number;
  /** 输出高度 (px) */
  height: number;
  /** 智能裁剪结果 */
  cropResult: SmartCropResult;
  /** 目标平台列表（使用此格式的平台） */
  targetPlatforms: DistributionPlatformId[];
  /** 预计质量损失 0-1（0 = 无损失） */
  qualityLoss: number;
  /** 警告信息 */
  warnings: string[];
}

// ─── 生成配置 ────────────────────────────────────────────

/** 多格式生成配置 */
export interface MultiFormatConfig {
  /** 目标平台列表（为空则自动选择） */
  targetPlatforms?: DistributionPlatformId[];
  /** 是否自动去重相同格式 */
  deduplicateFormats: boolean;
  /** 最大变体数量 */
  maxVariants: number;
  /** 是否包含方形格式 */
  includeSquareFormat: boolean;
  /** 最小可接受质量分 (0-1) */
  minQualityThreshold: number;
  /** 自定义裁剪输入覆盖 */
  cropInputOverrides?: Partial<CropAnalysisInput>;
}

/** 默认配置 */
export const DEFAULT_MULTI_FORMAT_CONFIG: MultiFormatConfig = {
  deduplicateFormats: true,
  maxVariants: 6,
  includeSquareFormat: true,
  minQualityThreshold: 0.3,
};

// ─── 格式预览数据 ────────────────────────────────────────────

/** 格式预览信息 */
export interface FormatPreview {
  /** 变体 ID */
  variantId: string;
  /** 预览宽度 (px) */
  previewWidth: number;
  /** 预览高度 (px) */
  previewHeight: number;
  /** 裁剪区域在预览中的 X 偏移 (px) */
  cropOffsetX: number;
  /** 裁剪区域在预览中的 Y 偏移 (px) */
  cropOffsetY: number;
  /** 裁剪区域在预览中的宽度 (px) */
  cropRegionWidth: number;
  /** 裁剪区域在预览中的高度 (px) */
  cropRegionHeight: number;
  /** FFmpeg 滤镜链 */
  filterChain: string;
}

// ─── 多格式生成结果 ────────────────────────────────────────────

export interface MultiFormatResult {
  /** 源项目信息 */
  sourceInfo: {
    width: number;
    height: number;
    aspectRatio: string;
    durationSecs: number;
  };
  /** 生成的格式变体列表 */
  variants: FormatVariant[];
  /** 各变体的预览数据 */
  previews: FormatPreview[];
  /** 生成摘要 */
  summary: {
    totalVariants: number;
    uniqueFormats: number;
    platformsCovered: number;
    averageQuality: number;
    warnings: string[];
  };
}

// ─── 画面分析 ────────────────────────────────────────────

/**
 * 从项目中提取裁剪分析输入
 *
 * 遍历时间线中的视频/图片片段，计算整体画面特征。
 */
export function extractCropAnalysisFromProject(
  project: Project,
  overrides?: Partial<CropAnalysisInput>,
): CropAnalysisInput {
  const timeline = project.timeline;
  const firstTrack = timeline?.tracks?.[0];
  const firstVideoClip = findFirstVideoClip(timeline);

  const sourceWidth = firstVideoClip?.mediaWidth ?? project.settings?.width ?? 1920;
  const sourceHeight = firstVideoClip?.mediaHeight ?? project.settings?.height ?? 1080;
  const duration = timeline ? getTimelineDuration(timeline) : 0;

  // 查找字幕轨位置
  const subtitleTrack = timeline?.tracks?.find((t) => t.type === 'subtitle');
  let subtitleY: number | undefined;
  let subtitleHeight: number | undefined;
  if (subtitleTrack) {
    subtitleY = 0.85; // 字幕通常在底部
    subtitleHeight = 0.1;
  }

  return {
    sourceWidth,
    sourceHeight,
    duration,
    subtitleY,
    subtitleHeight,
    ...overrides,
  };
}

/** 在时间线中查找第一个视频片段 */
function findFirstVideoClip(
  timeline: Timeline | undefined,
): (VideoClip & { mediaWidth?: number; mediaHeight?: number }) | undefined {
  if (!timeline?.tracks) return undefined;
  for (const track of timeline.tracks) {
    if (track.type === 'video') {
      const clip = track.clips?.[0] as VideoClip | ImageClip | undefined;
      if (clip) return clip as VideoClip & { mediaWidth?: number; mediaHeight?: number };
    }
  }
  return undefined;
}

/** 计算时间线总时长 */
function getTimelineDuration(timeline: Timeline): number {
  let maxEnd = 0;
  for (const track of timeline.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      const end = (clip.start ?? 0) + (clip.duration ?? 0);
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

// ─── 格式去重 ────────────────────────────────────────────

interface FormatKey {
  orientation: VideoOrientation;
  aspectRatio: string;
}

function formatKeyToString(key: FormatKey): string {
  return `${key.orientation}:${key.aspectRatio}`;
}

/**
 * 按方向和宽高比分组平台
 * 相同方向+宽高比的平台共享同一格式变体
 */
function groupPlatformsByFormat(
  platforms: DistributionPlatformSpec[],
): Map<string, DistributionPlatformSpec[]> {
  const groups = new Map<string, DistributionPlatformSpec[]>();

  for (const platform of platforms) {
    const key = formatKeyToString({
      orientation: platform.orientation,
      aspectRatio: platform.aspectRatio,
    });
    const existing = groups.get(key);
    if (existing) {
      existing.push(platform);
    } else {
      groups.set(key, [platform]);
    }
  }

  return groups;
}

// ─── 质量评估 ────────────────────────────────────────────

/**
 * 评估裁剪后的质量损失
 *
 * 基于裁剪比例和方向变化计算质量分数。
 * - 同方向无裁剪 = 1.0
 * - 同方向少量裁剪 = 0.8-0.95
 * - 方向变化大 = 0.3-0.6
 */
function assessCropQuality(
  sourceWidth: number,
  sourceHeight: number,
  cropResult: SmartCropResult,
): number {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = parseAspectRatio(cropResult.targetAspectRatio);

  // 宽高比差异越大，质量损失越大
  const ratioDiff = Math.abs(sourceRatio - targetRatio) / Math.max(sourceRatio, targetRatio);

  // 基础质量分：基于裁剪比例
  const cropArea = cropResult.cropWidth * cropResult.cropHeight;
  let quality = 0.5 + cropArea * 0.5; // 保留面积比例的线性映射

  // 方向变化惩罚
  const sourceIsLandscape = sourceWidth > sourceHeight;
  const targetIsLandscape = parseAspectRatio(cropResult.targetAspectRatio) > 1;
  if (sourceIsLandscape !== targetIsLandscape) {
    quality *= 0.85; // 方向变化轻微惩罚
  }

  // 大量裁剪惩罚
  if (cropArea < 0.4) {
    quality *= 0.9;
  }

  return Math.max(0, Math.min(1, quality));
}

// ─── 核心生成算法 ────────────────────────────────────────────

/**
 * 生成多格式变体
 *
 * 从源项目出发，为目标平台列表生成最优格式变体。
 * 相同方向+宽高比的平台共享裁剪参数。
 *
 * @param project 源项目
 * @param config 生成配置
 * @returns 多格式生成结果
 */
export function generateMultiFormats(
  project: Project,
  config: MultiFormatConfig = DEFAULT_MULTI_FORMAT_CONFIG,
): MultiFormatResult {
  const cropInput = extractCropAnalysisFromProject(project, config.cropInputOverrides);

  const sourceRatioStr = `${cropInput.sourceWidth}:${cropInput.sourceHeight}`;
  const warnings: string[] = [];

  // 确定目标平台
  let targetPlatforms: DistributionPlatformSpec[];
  if (config.targetPlatforms && config.targetPlatforms.length > 0) {
    targetPlatforms = config.targetPlatforms.map(getDistributionPlatform);
  } else {
    targetPlatforms = [...DISTRIBUTION_PLATFORMS];
  }

  // 过滤平台
  targetPlatforms = targetPlatforms.filter((p) => {
    if (!config.includeSquareFormat && p.orientation === 'square') return false;
    return true;
  });

  // 按格式分组
  const formatGroups = groupPlatformsByFormat(targetPlatforms);

  // 为每个格式组生成变体
  const allVariants: FormatVariant[] = [];

  for (const [formatKey, platforms] of formatGroups) {
    // 选择代表平台（分辨率最高的）
    const representativePlatform = platforms.reduce((best, p) =>
      p.width * p.height > best.width * best.height ? p : best,
    );

    const cropResult = calculateSmartCrop(cropInput, representativePlatform);
    const quality = assessCropQuality(cropInput.sourceWidth, cropInput.sourceHeight, cropResult);

    // 质量阈值检查
    if (quality < config.minQualityThreshold) {
      warnings.push(
        `格式 ${formatKey} 裁剪质量过低 (${(quality * 100).toFixed(0)}%)，低于阈值 ${(config.minQualityThreshold * 100).toFixed(0)}%`,
      );
      continue;
    }

    const variant: FormatVariant = {
      id: `variant-${representativePlatform.id}`,
      orientation: representativePlatform.orientation,
      aspectRatio: representativePlatform.aspectRatio,
      width: representativePlatform.width,
      height: representativePlatform.height,
      cropResult,
      targetPlatforms: platforms.map((p) => p.id),
      qualityLoss: 1 - quality,
      warnings: cropResult.warnings,
    };

    allVariants.push(variant);
  }

  // 去重
  let variants = config.deduplicateFormats ? deduplicateVariants(allVariants) : allVariants;

  // 限制数量
  if (variants.length > config.maxVariants) {
    // 按质量排序，保留最佳的
    variants = variants.sort((a, b) => a.qualityLoss - b.qualityLoss).slice(0, config.maxVariants);
  }

  // 生成预览
  const previews = variants.map((v) => generateFormatPreview(v, 320, 240));

  // 计算摘要
  const coveredPlatforms = new Set(variants.flatMap((v) => v.targetPlatforms));
  const avgQuality =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + (1 - v.qualityLoss), 0) / variants.length
      : 0;

  return {
    sourceInfo: {
      width: cropInput.sourceWidth,
      height: cropInput.sourceHeight,
      aspectRatio: sourceRatioStr,
      durationSecs: cropInput.duration,
    },
    variants,
    previews,
    summary: {
      totalVariants: variants.length,
      uniqueFormats: new Set(variants.map((v) => `${v.orientation}:${v.aspectRatio}`)).size,
      platformsCovered: coveredPlatforms.size,
      averageQuality: Math.round(avgQuality * 100) / 100,
      warnings,
    },
  };
}

/**
 * 为单个目标平台生成格式变体
 */
export function generateFormatVariant(
  project: Project,
  platformId: DistributionPlatformId,
  cropOverrides?: Partial<CropAnalysisInput>,
): FormatVariant {
  const platform = getDistributionPlatform(platformId);
  const cropInput = extractCropAnalysisFromProject(project, cropOverrides);
  const cropResult = calculateSmartCrop(cropInput, platform);
  const quality = assessCropQuality(cropInput.sourceWidth, cropInput.sourceHeight, cropResult);

  return {
    id: `variant-${platform.id}`,
    orientation: platform.orientation,
    aspectRatio: platform.aspectRatio,
    width: platform.width,
    height: platform.height,
    cropResult,
    targetPlatforms: [platform.id],
    qualityLoss: 1 - quality,
    warnings: cropResult.warnings,
  };
}

// ─── 变体去重 ────────────────────────────────────────────

/**
 * 去重相同格式的变体
 * 合并使用相同方向+宽高比的变体，保留质量最好的
 */
function deduplicateVariants(variants: FormatVariant[]): FormatVariant[] {
  const best = new Map<string, FormatVariant>();

  for (const variant of variants) {
    const key = `${variant.orientation}:${variant.aspectRatio}`;
    const existing = best.get(key);

    if (!existing || variant.qualityLoss < existing.qualityLoss) {
      // 合并目标平台列表
      const mergedPlatforms = existing
        ? [...new Set([...existing.targetPlatforms, ...variant.targetPlatforms])]
        : variant.targetPlatforms;

      best.set(key, {
        ...variant,
        targetPlatforms: mergedPlatforms,
      });
    }
  }

  return Array.from(best.values());
}

// ─── 预览生成 ────────────────────────────────────────────

/**
 * 生成格式预览数据
 *
 * 计算裁剪区域在预览容器中的显示位置和尺寸。
 */
export function generateFormatPreview(
  variant: FormatVariant,
  containerWidth: number,
  containerHeight: number,
): FormatPreview {
  const sourceRatio = parseAspectRatio(variant.cropResult.sourceAspectRatio);
  const containerRatio = containerWidth / containerHeight;

  let previewWidth: number;
  let previewHeight: number;

  if (sourceRatio > containerRatio) {
    previewWidth = containerWidth;
    previewHeight = containerWidth / sourceRatio;
  } else {
    previewHeight = containerHeight;
    previewWidth = containerHeight * sourceRatio;
  }

  const cropFilter = variant.cropResult.cropFilter;
  const scaleFilter = variant.cropResult.scaleFilter;

  return {
    variantId: variant.id,
    previewWidth: Math.round(previewWidth),
    previewHeight: Math.round(previewHeight),
    cropOffsetX: Math.round(variant.cropResult.cropX * previewWidth),
    cropOffsetY: Math.round(variant.cropResult.cropY * previewHeight),
    cropRegionWidth: Math.round(variant.cropResult.cropWidth * previewWidth),
    cropRegionHeight: Math.round(variant.cropResult.cropHeight * previewHeight),
    filterChain: [cropFilter, scaleFilter].filter(Boolean).join(','),
  };
}

// ─── 快捷工具函数 ────────────────────────────────────────────

/** 获取所有支持的方向 */
export function getSupportedOrientations(): VideoOrientation[] {
  return ['landscape', 'portrait', 'square'];
}

/** 按方向获取推荐格式 */
export function getRecommendedFormatsForOrientation(
  orientation: VideoOrientation,
): DistributionPlatformSpec[] {
  return DISTRIBUTION_PLATFORMS.filter((p) => p.orientation === orientation);
}

/**
 * 快速生成横屏+竖屏双格式
 * 最常见的多格式需求
 */
export function generateDualFormat(
  project: Project,
  landscapePlatformId: DistributionPlatformId = 'youtube-1080p',
  portraitPlatformId: DistributionPlatformId = 'tiktok',
): MultiFormatResult {
  return generateMultiFormats(project, {
    targetPlatforms: [landscapePlatformId, portraitPlatformId],
    deduplicateFormats: true,
    maxVariants: 2,
    includeSquareFormat: false,
    minQualityThreshold: 0.1,
  });
}
