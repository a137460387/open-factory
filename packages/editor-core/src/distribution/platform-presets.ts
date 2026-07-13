/**
 * 平台预设定义和管理
 *
 * 定义各社交媒体/视频平台的格式要求，包括分辨率、帧率、码率、编码器等参数。
 * 支持 10+ 个主流平台，每个平台包含完整的格式规范。
 */

import type { ExportPlatformPreset } from '../export/export-types';

// ─── 平台方向 ────────────────────────────────────────────

export type PlatformOrientation = 'landscape' | 'portrait' | 'square';

// ─── 平台规格 ────────────────────────────────────────────

export interface DistributionPlatformSpec {
  /** 平台预设标识符，与 ExportPlatformPreset 对齐 */
  id: DistributionPlatformId;
  /** 平台显示名称 */
  name: string;
  /** 平台图标标识 (emoji) */
  icon: string;
  /** 画面方向 */
  orientation: PlatformOrientation;
  /** 宽高比字符串，如 '16:9' */
  aspectRatio: string;
  /** 输出宽度 (px) */
  width: number;
  /** 输出高度 (px) */
  height: number;
  /** 帧率 */
  fps: number;
  /** 视频码率 */
  videoBitrate: string;
  /** 音频码率 */
  audioBitrate: string;
  /** 视频编码器 */
  videoCodec: string;
  /** 音频编码器 */
  audioCodec: string;
  /** 容器格式 */
  format: string;
  /** H.264 Profile */
  videoProfile?: 'baseline' | 'main' | 'high';
  /** 最大时长（秒），undefined 表示无限制 */
  maxDurationSecs?: number;
  /** 响度标准化目标 */
  loudnessTarget?: 'youtube' | 'ebu-r128' | 'off';
  /** 平台描述 */
  description: string;
  /** 推荐分数（用于自动推荐排序） */
  recommendationWeight: number;
  /** 是否为短视频平台 */
  isShortForm: boolean;
}

// ─── 平台 ID 扩展 ────────────────────────────────────────────

/** 扩展的平台分发 ID，包含所有支持的平台 */
export type DistributionPlatformId =
  | 'youtube-1080p'
  | 'youtube-shorts'
  | 'tiktok'
  | 'instagram-reels'
  | 'instagram-feed'
  | 'twitter-x'
  | 'bilibili'
  | 'weixin-channels'
  | 'kuaishou'
  | 'pinterest';

// ─── 平台预设定义 ────────────────────────────────────────────

export const DISTRIBUTION_PLATFORMS: DistributionPlatformSpec[] = [
  {
    id: 'youtube-1080p',
    name: 'YouTube',
    icon: '▶️',
    orientation: 'landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '8M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    loudnessTarget: 'youtube',
    description: 'YouTube 标准 1080p 横屏视频',
    recommendationWeight: 0.3,
    isShortForm: false,
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    icon: '📱',
    orientation: 'portrait',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 60,
    videoBitrate: '8M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 60,
    loudnessTarget: 'youtube',
    description: 'YouTube Shorts 竖屏短视频（最长 60 秒）',
    recommendationWeight: 0.8,
    isShortForm: true,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    orientation: 'portrait',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 60,
    videoBitrate: '6M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 600,
    description: 'TikTok 竖屏短视频',
    recommendationWeight: 0.9,
    isShortForm: true,
  },
  {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    icon: '📸',
    orientation: 'portrait',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '3500k',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 90,
    description: 'Instagram Reels 竖屏短视频（最长 90 秒）',
    recommendationWeight: 0.85,
    isShortForm: true,
  },
  {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    icon: '📷',
    orientation: 'square',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    fps: 30,
    videoBitrate: '3500k',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 60,
    description: 'Instagram Feed 方形视频（最长 60 秒）',
    recommendationWeight: 0.6,
    isShortForm: true,
  },
  {
    id: 'twitter-x',
    name: 'Twitter/X',
    icon: '🐦',
    orientation: 'landscape',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    fps: 30,
    videoBitrate: '5M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'main',
    maxDurationSecs: 140,
    description: 'Twitter/X 横屏视频（最长 140 秒）',
    recommendationWeight: 0.5,
    isShortForm: false,
  },
  {
    id: 'bilibili',
    name: 'Bilibili',
    icon: '📺',
    orientation: 'landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrate: '10M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    loudnessTarget: 'off',
    description: 'Bilibili 高清横屏视频',
    recommendationWeight: 0.4,
    isShortForm: false,
  },
  {
    id: 'weixin-channels',
    name: '微信视频号',
    icon: '💬',
    orientation: 'landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '6M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 1800,
    description: '微信视频号横屏视频（最长 30 分钟）',
    recommendationWeight: 0.35,
    isShortForm: false,
  },
  {
    id: 'kuaishou',
    name: '快手',
    icon: '🎬',
    orientation: 'portrait',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '6M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'high',
    maxDurationSecs: 600,
    description: '快手竖屏短视频',
    recommendationWeight: 0.75,
    isShortForm: true,
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    orientation: 'portrait',
    aspectRatio: '2:3',
    width: 1000,
    height: 1500,
    fps: 30,
    videoBitrate: '4M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    format: 'mp4',
    videoProfile: 'main',
    maxDurationSecs: 60,
    description: 'Pinterest 竖屏视频 Pin',
    recommendationWeight: 0.4,
    isShortForm: true,
  },
];

// ─── 查找与过滤 ────────────────────────────────────────────

/** 按 ID 获取平台规格 */
export function getDistributionPlatform(id: DistributionPlatformId): DistributionPlatformSpec {
  const platform = DISTRIBUTION_PLATFORMS.find((p) => p.id === id);
  if (!platform) {
    throw new Error(`Unknown distribution platform: ${id}`);
  }
  return platform;
}

/** 获取所有横屏平台 */
export function getLandscapePlatforms(): DistributionPlatformSpec[] {
  return DISTRIBUTION_PLATFORMS.filter((p) => p.orientation === 'landscape');
}

/** 获取所有竖屏平台 */
export function getPortraitPlatforms(): DistributionPlatformSpec[] {
  return DISTRIBUTION_PLATFORMS.filter((p) => p.orientation === 'portrait');
}

/** 获取所有方形平台 */
export function getSquarePlatforms(): DistributionPlatformSpec[] {
  return DISTRIBUTION_PLATFORMS.filter((p) => p.orientation === 'square');
}

/** 获取所有短视频平台 */
export function getShortFormPlatforms(): DistributionPlatformSpec[] {
  return DISTRIBUTION_PLATFORMS.filter((p) => p.isShortForm);
}

// ─── 智能推荐 ────────────────────────────────────────────

export interface DistributionRecommendationContext {
  /** 项目宽度 */
  width: number;
  /** 项目高度 */
  height: number;
  /** 项目时长（秒） */
  durationSecs: number;
  /** 是否有字幕 */
  hasSubtitles: boolean;
}

export interface DistributionRecommendation {
  platform: DistributionPlatformSpec;
  score: number;
  reasons: string[];
}

/**
 * 基于项目特征智能推荐目标平台
 *
 * 评分规则：
 * - 画面方向匹配：+0.4
 * - 时长符合平台限制：+0.3
 * - 有字幕的平台：+0.1
 * - 平台自身推荐权重
 */
export function buildDistributionRecommendations(
  context: DistributionRecommendationContext,
): DistributionRecommendation[] {
  const { width, height, durationSecs } = context;
  const isPortrait = height > width;
  const isLandscape = width > height;
  const isSquare = width === height;

  const recommendations: DistributionRecommendation[] = DISTRIBUTION_PLATFORMS.map((platform) => {
    let score = 0;
    const reasons: string[] = [];

    // 方向匹配
    if (isPortrait && platform.orientation === 'portrait') {
      score += 0.4;
      reasons.push('竖屏素材匹配竖屏平台');
    } else if (isLandscape && platform.orientation === 'landscape') {
      score += 0.4;
      reasons.push('横屏素材匹配横屏平台');
    } else if (isSquare && platform.orientation === 'square') {
      score += 0.4;
      reasons.push('方形素材匹配方形平台');
    }

    // 时长检查
    if (platform.maxDurationSecs === undefined || durationSecs <= platform.maxDurationSecs) {
      score += 0.3;
    } else {
      reasons.push(`时长超出平台限制 (${platform.maxDurationSecs}s)`);
    }

    // 字幕加分
    if (context.hasSubtitles) {
      score += 0.1;
      reasons.push('项目包含字幕');
    }

    // 平台自身权重
    score += platform.recommendationWeight * 0.2;

    return { platform, score, reasons };
  });

  return recommendations.sort((a, b) => b.score - a.score);
}

// ─── ExportPlatformPreset 映射 ────────────────────────────────────────────

/**
 * 将 DistributionPlatformId 映射到现有的 ExportPlatformPreset
 * 对于新增的平台，返回最接近的已有预设或 undefined
 */
export function mapToExportPlatformPreset(
  id: DistributionPlatformId,
): ExportPlatformPreset | undefined {
  const mapping: Record<DistributionPlatformId, ExportPlatformPreset | undefined> = {
    'youtube-1080p': 'youtube-1080p',
    'youtube-shorts': 'youtube-shorts',
    'tiktok': 'tiktok',
    'instagram-reels': 'instagram-reels',
    'instagram-feed': 'instagram-reels',  // 最接近的已有预设
    'twitter-x': 'twitter-x',
    'bilibili': 'bilibili',
    'weixin-channels': 'bilibili',         // 最接近的横屏预设
    'kuaishou': 'tiktok',                  // 最接近的竖屏预设
    'pinterest': 'instagram-reels',        // 最接近的竖屏预设
  };
  return mapping[id];
}

// ─── 格式化工具 ────────────────────────────────────────────

/** 格式化平台信息为简短描述 */
export function formatPlatformSummary(platform: DistributionPlatformSpec): string {
  return `${platform.name} ${platform.width}×${platform.height} ${platform.fps}fps ${platform.aspectRatio}`;
}

/** 格式化最大时长 */
export function formatMaxDuration(platform: DistributionPlatformSpec): string {
  if (platform.maxDurationSecs === undefined) return '无限制';
  if (platform.maxDurationSecs < 60) return `${platform.maxDurationSecs}秒`;
  if (platform.maxDurationSecs < 3600) return `${Math.floor(platform.maxDurationSecs / 60)}分钟`;
  return `${Math.floor(platform.maxDurationSecs / 3600)}小时`;
}
