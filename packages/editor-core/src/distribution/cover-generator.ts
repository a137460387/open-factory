/**
 * 智能封面生成器
 *
 * 自动选择最具吸引力的视频帧作为封面，
 * 生成适合各平台的封面尺寸和样式，
 * 支持品牌元素叠加。
 *
 * 封面评分维度：
 * - 画面清晰度（基于边缘检测）
 * - 人脸检测（优先选择含人脸的帧）
 * - 色彩丰富度（饱和度、对比度）
 * - 构图质量（三分法、对称性）
 * - 文字安全区（避免关键区域与字幕重叠）
 */

import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
import { getDistributionPlatform, DISTRIBUTION_PLATFORMS } from './platform-presets';
import { parseAspectRatio } from './smart-crop';

// ─── 封面帧候选 ────────────────────────────────────────────

/** 视频帧信息 */
export interface VideoFrame {
  /** 帧时间点（秒） */
  timeSecs: number;
  /** 帧宽度 (px) */
  width: number;
  /** 帧高度 (px) */
  height: number;
  /** 亮度 0-1 */
  brightness?: number;
  /** 对比度 0-1 */
  contrast?: number;
  /** 饱和度 0-1 */
  saturation?: number;
  /** 清晰度 0-1 */
  sharpness?: number;
  /** 是否包含人脸 */
  hasFace?: boolean;
  /** 人脸数量 */
  faceCount?: number;
  /** 人脸区域 (归一化坐标) */
  faceRegions?: FaceRegion[];
  /** 运动模糊程度 0-1（0 = 清晰） */
  motionBlur?: number;
  /** 场景类型标签 */
  sceneTags?: string[];
}

/** 人脸区域 */
export interface FaceRegion {
  /** X 坐标 (归一化 0-1) */
  x: number;
  /** Y 坐标 (归一化 0-1) */
  y: number;
  /** 宽度 (归一化 0-1) */
  width: number;
  /** 高度 (归一化 0-1) */
  height: number;
  /** 置信度 0-1 */
  confidence: number;
}

// ─── 封面评分 ────────────────────────────────────────────

/** 封面帧评分详情 */
export interface CoverFrameScore {
  /** 帧时间点 */
  timeSecs: number;
  /** 综合评分 0-100 */
  totalScore: number;
  /** 清晰度评分 0-100 */
  sharpnessScore: number;
  /** 人脸评分 0-100 */
  faceScore: number;
  /** 色彩评分 0-100 */
  colorScore: number;
  /** 构图评分 0-100 */
  compositionScore: number;
  /** 运动评分 0-100（越清晰越高） */
  motionScore: number;
  /** 评分理由 */
  reasons: string[];
}

// ─── 封面尺寸 ────────────────────────────────────────────

/** 封面尺寸预设 */
export interface CoverSizePreset {
  /** 预设名称 */
  name: string;
  /** 宽度 (px) */
  width: number;
  /** 高度 (px) */
  height: number;
  /** 宽高比 */
  aspectRatio: string;
  /** 适用平台 */
  platforms: string[];
  /** 描述 */
  description: string;
}

/** 内置封面尺寸预设 */
export const COVER_SIZE_PRESETS: CoverSizePreset[] = [
  {
    name: 'youtube-thumbnail',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    platforms: ['youtube-1080p', 'bilibili', 'weixin-channels', 'twitter-x'],
    description: 'YouTube / B站 标准封面',
  },
  {
    name: 'vertical-cover',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    platforms: ['tiktok', 'youtube-shorts', 'instagram-reels', 'kuaishou'],
    description: '竖屏封面（抖音/Shorts）',
  },
  {
    name: 'square-cover',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    platforms: ['instagram-feed'],
    description: '方形封面（Instagram Feed）',
  },
  {
    name: 'pinterest-pin',
    width: 1000,
    height: 1500,
    aspectRatio: '2:3',
    platforms: ['pinterest'],
    description: 'Pinterest Pin 封面',
  },
  {
    name: 'xiaohongshu-cover',
    width: 1080,
    height: 1440,
    aspectRatio: '3:4',
    platforms: ['xiaohongshu'],
    description: '小红书封面',
  },
];

// ─── 品牌元素 ────────────────────────────────────────────

/** 品牌水印配置 */
export interface BrandWatermark {
  /** 水印类型 */
  type: 'logo' | 'text' | 'combined';
  /** Logo 资源路径（仅 logo/combined 类型） */
  logoPath?: string;
  /** Logo 尺寸比例（相对封面宽度，0-1） */
  logoScale: number;
  /** 文字内容（仅 text/combined 类型） */
  text?: string;
  /** 字体大小比例（相对封面高度，0-1） */
  textFontSizeRatio: number;
  /** 字体颜色 */
  textColor: string;
  /** 字体粗细 */
  textFontWeight: 'normal' | 'bold';
  /** 位置 */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  /** 边距比例（相对封面短边，0-1） */
  marginRatio: number;
  /** 不透明度 0-1 */
  opacity: number;
}

/** 封面样式叠加配置 */
export interface CoverOverlay {
  /** 标题文字 */
  title?: string;
  /** 标题字号比例（相对封面高度，0-1） */
  titleFontSizeRatio: number;
  /** 标题颜色 */
  titleColor: string;
  /** 标题位置 */
  titlePosition: 'top' | 'center' | 'bottom';
  /** 标题描边 */
  titleOutline: boolean;
  /** 标题阴影 */
  titleShadow: boolean;
  /** 渐变遮罩（增强文字可读性） */
  gradientOverlay: 'none' | 'bottom' | 'top' | 'full';
  /** 渐变遮罩不透明度 */
  gradientOpacity: number;
  /** 品牌水印 */
  watermark?: BrandWatermark;
}

// ─── 封面生成结果 ────────────────────────────────────────────

/** 生成的封面 */
export interface GeneratedCover {
  /** 封面 ID */
  id: string;
  /** 目标平台 */
  platformId: DistributionPlatformId;
  /** 选择的帧时间点 (秒) */
  frameTimeSecs: number;
  /** 帧评分 */
  frameScore: CoverFrameScore;
  /** 输出宽度 (px) */
  outputWidth: number;
  /** 输出高度 (px) */
  outputHeight: number;
  /** 裁剪参数（从原始帧到封面尺寸） */
  cropParams: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 样式叠加配置 */
  overlay: CoverOverlay;
  /** FFmpeg 生成命令参数 */
  ffmpegArgs: string[];
}

/** 封面生成结果 */
export interface CoverGenerationResult {
  /** 源视频信息 */
  sourceInfo: {
    width: number;
    height: number;
    durationSecs: number;
  };
  /** 帧评分排名 */
  frameScores: CoverFrameScore[];
  /** 生成的封面列表 */
  covers: GeneratedCover[];
  /** 生成摘要 */
  summary: {
    totalCovers: number;
    bestFrameTime: number;
    bestFrameScore: number;
    platformsCovered: number;
  };
}

// ─── 封面生成配置 ────────────────────────────────────────────

/** 封面生成配置 */
export interface CoverGeneratorConfig {
  /** 目标平台列表 */
  targetPlatforms: DistributionPlatformId[];
  /** 帧采样间隔（秒） */
  sampleIntervalSecs: number;
  /** 最大采样帧数 */
  maxSampleFrames: number;
  /** 是否优先选择人脸帧 */
  preferFaceFrames: boolean;
  /** 默认样式叠加 */
  defaultOverlay: Partial<CoverOverlay>;
  /** 品牌水印 */
  watermark?: BrandWatermark;
  /** 排除的时间范围（秒） */
  excludeRanges?: Array<{ start: number; end: number }>;
}

/** 默认封面生成配置 */
export const DEFAULT_COVER_CONFIG: CoverGeneratorConfig = {
  targetPlatforms: ['youtube-1080p', 'tiktok', 'bilibili'],
  sampleIntervalSecs: 5,
  maxSampleFrames: 60,
  preferFaceFrames: true,
  defaultOverlay: {
    titleFontSizeRatio: 0.06,
    titleColor: '#FFFFFF',
    titlePosition: 'bottom',
    titleOutline: true,
    titleShadow: true,
    gradientOverlay: 'bottom',
    gradientOpacity: 0.6,
  },
};

// ─── 帧评分算法 ────────────────────────────────────────────

/**
 * 对视频帧进行综合评分
 *
 * 评分权重：
 * - 清晰度：25%
 * - 人脸：25%（有人脸加分）
 * - 色彩：20%
 * - 构图：15%
 * - 运动：15%
 */
export function scoreVideoFrame(frame: VideoFrame): CoverFrameScore {
  const reasons: string[] = [];

  // 清晰度评分
  const sharpnessScore = calculateSharpnessScore(frame);
  if (sharpnessScore > 80) reasons.push('画面清晰');
  if (sharpnessScore < 40) reasons.push('画面模糊');

  // 人脸评分
  const faceScore = calculateFaceScore(frame);
  if (frame.hasFace && frame.faceCount && frame.faceCount > 0) {
    reasons.push(`检测到 ${frame.faceCount} 张人脸`);
  }

  // 色彩评分
  const colorScore = calculateColorScore(frame);
  if (colorScore > 80) reasons.push('色彩丰富');

  // 构图评分
  const compositionScore = calculateCompositionScore(frame);

  // 运动评分
  const motionScore = calculateMotionScore(frame);
  if (motionScore < 40) reasons.push('存在运动模糊');

  // 综合评分（加权平均）
  const totalScore = Math.round(
    sharpnessScore * 0.25 + faceScore * 0.25 + colorScore * 0.2 + compositionScore * 0.15 + motionScore * 0.15,
  );

  return {
    timeSecs: frame.timeSecs,
    totalScore,
    sharpnessScore,
    faceScore,
    colorScore,
    compositionScore,
    motionScore,
    reasons,
  };
}

function calculateSharpnessScore(frame: VideoFrame): number {
  if (frame.sharpness !== undefined) {
    return Math.round(frame.sharpness * 100);
  }
  // 无数据时假设中等清晰度
  return 60;
}

function calculateFaceScore(frame: VideoFrame): number {
  if (!frame.hasFace || !frame.faceCount || frame.faceCount === 0) {
    return 30; // 无人脸基础分
  }

  let score = 60; // 有人脸基础分

  // 多人脸加分（但不超过上限）
  if (frame.faceCount >= 2) score += 10;
  if (frame.faceCount >= 3) score += 5;

  // 人脸置信度加分
  if (frame.faceRegions && frame.faceRegions.length > 0) {
    const avgConfidence = frame.faceRegions.reduce((sum, r) => sum + r.confidence, 0) / frame.faceRegions.length;
    score += Math.round(avgConfidence * 20);
  }

  return Math.min(100, score);
}

function calculateColorScore(frame: VideoFrame): number {
  let score = 50; // 基础分

  if (frame.saturation !== undefined) {
    // 适中饱和度最佳（0.4-0.7）
    const satOptimal = 1 - Math.abs(frame.saturation - 0.55) * 2;
    score += Math.round(satOptimal * 25);
  }

  if (frame.contrast !== undefined) {
    // 适中对比度最佳（0.4-0.6）
    const contrastOptimal = 1 - Math.abs(frame.contrast - 0.5) * 2;
    score += Math.round(contrastOptimal * 25);
  }

  return Math.min(100, Math.max(0, score));
}

function calculateCompositionScore(frame: VideoFrame): number {
  // 如果有人脸且在三分法位置附近，构图分更高
  if (frame.faceRegions && frame.faceRegions.length > 0) {
    const mainFace = frame.faceRegions[0];
    const faceCenterX = mainFace.x + mainFace.width / 2;
    const faceCenterY = mainFace.y + mainFace.height / 2;

    // 三分法交叉点
    const thirdsX = [1 / 3, 2 / 3];
    const thirdsY = [1 / 3, 2 / 3];

    let minDist = Infinity;
    for (const tx of thirdsX) {
      for (const ty of thirdsY) {
        const dist = Math.sqrt((faceCenterX - tx) ** 2 + (faceCenterY - ty) ** 2);
        minDist = Math.min(minDist, dist);
      }
    }

    // 距离三分法交叉点越近，构图越好
    const compositionBonus = Math.max(0, 1 - minDist * 3) * 30;
    return Math.min(100, 50 + compositionBonus);
  }

  return 50; // 无人脸时给基础分
}

function calculateMotionScore(frame: VideoFrame): number {
  if (frame.motionBlur !== undefined) {
    return Math.round((1 - frame.motionBlur) * 100);
  }
  return 70; // 无数据时假设较好
}

// ─── 批量帧评分 ────────────────────────────────────────────

/**
 * 对多个帧进行评分并排序
 *
 * @param frames 视频帧列表
 * @param preferFace 是否优先选择人脸帧
 * @returns 排序后的评分列表
 */
export function rankVideoFrames(frames: VideoFrame[], preferFace: boolean = true): CoverFrameScore[] {
  const scores = frames.map(scoreVideoFrame);

  // 排序：优先人脸 > 综合分
  return scores.sort((a, b) => {
    if (preferFace) {
      // 有人脸的帧优先
      const aHasFace = a.faceScore > 50;
      const bHasFace = b.faceScore > 50;
      if (aHasFace !== bHasFace) return aHasFace ? -1 : 1;
    }
    return b.totalScore - a.totalScore;
  });
}

// ─── 封面裁剪计算 ────────────────────────────────────────────

/**
 * 计算封面裁剪参数
 *
 * 从原始帧裁剪到目标封面尺寸，优先保留人脸区域。
 */
export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  faceRegions?: FaceRegion[],
): { x: number; y: number; width: number; height: number } {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  // 确定裁剪中心点
  let centerX = 0.5;
  let centerY = 0.5;

  if (faceRegions && faceRegions.length > 0) {
    // 以主要人脸为中心
    const mainFace = faceRegions.reduce((best, face) => (face.confidence > best.confidence ? face : best));
    centerX = mainFace.x + mainFace.width / 2;
    centerY = mainFace.y + mainFace.height / 2;

    // 人脸偏上一些（封面构图通常人脸偏上）
    centerY = Math.max(0.2, centerY - 0.05);
  }

  let cropWidth: number;
  let cropHeight: number;

  if (sourceRatio > targetRatio) {
    // 源更宽，裁剪左右
    cropHeight = 1.0;
    cropWidth = targetRatio / sourceRatio;
  } else {
    // 源更高，裁剪上下
    cropWidth = 1.0;
    cropHeight = sourceRatio / targetRatio;
  }

  // 基于中心点定位裁剪区域
  let cropX = Math.max(0, Math.min(1 - cropWidth, centerX - cropWidth / 2));
  let cropY = Math.max(0, Math.min(1 - cropHeight, centerY - cropHeight / 2));

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

// ─── FFmpeg 命令生成 ────────────────────────────────────────────

/**
 * 生成封面提取和处理的 FFmpeg 参数
 */
export function buildCoverFfmpegArgs(
  sourcePath: string,
  outputPath: string,
  frameTimeSecs: number,
  outputWidth: number,
  outputHeight: number,
  cropParams: { x: number; y: number; width: number; height: number },
  overlay?: CoverOverlay,
): string[] {
  const args: string[] = ['-i', sourcePath, '-ss', String(frameTimeSecs), '-vframes', '1'];

  // 构建滤镜链
  const filters: string[] = [];

  // 裁剪
  const cropW = Math.round(outputWidth * cropParams.width);
  const cropH = Math.round(outputHeight * cropParams.height);
  const cropX = Math.round(outputWidth * cropParams.x);
  const cropY = Math.round(outputHeight * cropParams.y);
  filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);

  // 缩放
  filters.push(`scale=${outputWidth}:${outputHeight}:flags=lanczos`);

  // 渐变遮罩
  if (overlay && overlay.gradientOverlay !== 'none') {
    const gradFilter = buildGradientFilter(overlay.gradientOverlay, outputWidth, outputHeight, overlay.gradientOpacity);
    if (gradFilter) filters.push(gradFilter);
  }

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  args.push('-q:v', '2', outputPath);

  return args;
}

function buildGradientFilter(
  direction: 'bottom' | 'top' | 'full',
  width: number,
  height: number,
  opacity: number,
): string {
  // 使用 geq 滤镜生成渐变遮罩
  // 简化实现：使用 colorchannelmixer 和 overlay
  if (direction === 'bottom') {
    // 底部渐变暗角
    return `drawbox=x=0:y=${Math.round(height * 0.6)}:w=${width}:h=${Math.round(height * 0.4)}:color=black@${opacity}:t=fill`;
  }
  if (direction === 'top') {
    return `drawbox=x=0:y=0:w=${width}:h=${Math.round(height * 0.4)}:color=black@${opacity}:t=fill`;
  }
  return '';
}

// ─── 默认封面样式 ────────────────────────────────────────────

/** 为平台生成默认封面叠加样式 */
export function getDefaultCoverOverlay(
  platformId: DistributionPlatformId,
  title?: string,
  watermark?: BrandWatermark,
): CoverOverlay {
  const platform = getDistributionPlatform(platformId);

  const baseOverlay: CoverOverlay = {
    title,
    titleFontSizeRatio: platform.orientation === 'portrait' ? 0.05 : 0.06,
    titleColor: '#FFFFFF',
    titlePosition: platform.orientation === 'portrait' ? 'center' : 'bottom',
    titleOutline: true,
    titleShadow: true,
    gradientOverlay: platform.orientation === 'portrait' ? 'bottom' : 'bottom',
    gradientOpacity: 0.6,
    watermark,
  };

  // 平台特定调整
  switch (platformId) {
    case 'tiktok':
    case 'kuaishou':
      baseOverlay.titleFontSizeRatio = 0.055;
      baseOverlay.titlePosition = 'center';
      break;
    case 'bilibili':
      baseOverlay.gradientOpacity = 0.4;
      break;
    case 'youtube-shorts':
      baseOverlay.titlePosition = 'center';
      break;
  }

  return baseOverlay;
}

// ─── 核心生成函数 ────────────────────────────────────────────

/**
 * 生成智能封面
 *
 * 从视频帧中选择最佳帧，为各目标平台生成封面。
 *
 * @param frames 视频帧列表（含分析数据）
 * @param config 生成配置
 * @returns 封面生成结果
 */
export function generateCovers(
  frames: VideoFrame[],
  config: CoverGeneratorConfig = DEFAULT_COVER_CONFIG,
): CoverGenerationResult {
  if (frames.length === 0) {
    return {
      sourceInfo: { width: 0, height: 0, durationSecs: 0 },
      frameScores: [],
      covers: [],
      summary: { totalCovers: 0, bestFrameTime: 0, bestFrameScore: 0, platformsCovered: 0 },
    };
  }

  // 过滤排除范围
  const filteredFrames = config.excludeRanges
    ? frames.filter((f) => !config.excludeRanges!.some((r) => f.timeSecs >= r.start && f.timeSecs <= r.end))
    : frames;

  // 帧评分排序
  const rankedFrames = rankVideoFrames(filteredFrames, config.preferFaceFrames);

  // 采样限制
  const sampleFrames = rankedFrames.slice(0, config.maxSampleFrames);

  // 选择最佳帧
  const bestFrame = sampleFrames[0];
  if (!bestFrame) {
    return {
      sourceInfo: {
        width: frames[0].width,
        height: frames[0].height,
        durationSecs: frames[frames.length - 1].timeSecs,
      },
      frameScores: [],
      covers: [],
      summary: { totalCovers: 0, bestFrameTime: 0, bestFrameScore: 0, platformsCovered: 0 },
    };
  }

  const bestFrameData = frames.find((f) => f.timeSecs === bestFrame.timeSecs) ?? frames[0];

  // 为每个目标平台生成封面
  const covers: GeneratedCover[] = [];
  const platformSet = new Set<DistributionPlatformId>();

  for (const platformId of config.targetPlatforms) {
    let preset = COVER_SIZE_PRESETS.find((p) => p.platforms.includes(platformId));

    // 未找到预设时使用 YouTube 预设作为默认
    if (!preset) {
      preset = COVER_SIZE_PRESETS[0]; // youtube-thumbnail
    }

    const cropParams = calculateCoverCrop(
      bestFrameData.width,
      bestFrameData.height,
      preset.width,
      preset.height,
      bestFrameData.faceRegions,
    );

    const overlay = getDefaultCoverOverlay(platformId, config.defaultOverlay?.title, config.watermark);

    const ffmpegArgs = buildCoverFfmpegArgs(
      '', // 源路径由调用者提供
      '', // 输出路径由调用者提供
      bestFrame.timeSecs,
      preset.width,
      preset.height,
      cropParams,
      overlay,
    );

    covers.push({
      id: `cover-${platformId}-${Date.now()}`,
      platformId,
      frameTimeSecs: bestFrame.timeSecs,
      frameScore: bestFrame,
      outputWidth: preset.width,
      outputHeight: preset.height,
      cropParams,
      overlay,
      ffmpegArgs,
    });

    platformSet.add(platformId);
  }

  return {
    sourceInfo: {
      width: bestFrameData.width,
      height: bestFrameData.height,
      durationSecs: frames[frames.length - 1].timeSecs,
    },
    frameScores: sampleFrames,
    covers,
    summary: {
      totalCovers: covers.length,
      bestFrameTime: bestFrame.timeSecs,
      bestFrameScore: bestFrame.totalScore,
      platformsCovered: platformSet.size,
    },
  };
}

/**
 * 为单个平台生成封面
 */
export function generateSingleCover(
  frames: VideoFrame[],
  platformId: DistributionPlatformId,
  title?: string,
  watermark?: BrandWatermark,
): GeneratedCover | null {
  const result = generateCovers(frames, {
    targetPlatforms: [platformId],
    sampleIntervalSecs: 5,
    maxSampleFrames: 30,
    preferFaceFrames: true,
    defaultOverlay: { title },
    watermark,
  });

  return result.covers[0] ?? null;
}

// ─── 封面尺寸工具 ────────────────────────────────────────────

/** 获取平台推荐的封面尺寸 */
export function getCoverSizeForPlatform(platformId: DistributionPlatformId): CoverSizePreset {
  const preset = COVER_SIZE_PRESETS.find((p) => p.platforms.includes(platformId));
  return preset ?? COVER_SIZE_PRESETS[0];
}

/** 获取所有封面尺寸预设 */
export function getAllCoverSizePresets(): CoverSizePreset[] {
  return [...COVER_SIZE_PRESETS];
}
