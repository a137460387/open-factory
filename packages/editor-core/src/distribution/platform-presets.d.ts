/**
 * 平台预设定义和管理
 *
 * 定义各社交媒体/视频平台的格式要求，包括分辨率、帧率、码率、编码器等参数。
 * 支持 10+ 个主流平台，每个平台包含完整的格式规范。
 */
import type { ExportPlatformPreset } from '../export/export-types';
export type PlatformOrientation = 'landscape' | 'portrait' | 'square';
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
/** 扩展的平台分发 ID，包含所有支持的平台 */
export type DistributionPlatformId = 'youtube-1080p' | 'youtube-shorts' | 'tiktok' | 'instagram-reels' | 'instagram-feed' | 'twitter-x' | 'bilibili' | 'weixin-channels' | 'kuaishou' | 'pinterest';
export declare const DISTRIBUTION_PLATFORMS: DistributionPlatformSpec[];
/** 按 ID 获取平台规格 */
export declare function getDistributionPlatform(id: DistributionPlatformId): DistributionPlatformSpec;
/** 获取所有横屏平台 */
export declare function getLandscapePlatforms(): DistributionPlatformSpec[];
/** 获取所有竖屏平台 */
export declare function getPortraitPlatforms(): DistributionPlatformSpec[];
/** 获取所有方形平台 */
export declare function getSquarePlatforms(): DistributionPlatformSpec[];
/** 获取所有短视频平台 */
export declare function getShortFormPlatforms(): DistributionPlatformSpec[];
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
export declare function buildDistributionRecommendations(context: DistributionRecommendationContext): DistributionRecommendation[];
/**
 * 将 DistributionPlatformId 映射到现有的 ExportPlatformPreset
 * 对于新增的平台，返回最接近的已有预设或 undefined
 */
export declare function mapToExportPlatformPreset(id: DistributionPlatformId): ExportPlatformPreset | undefined;
/** 格式化平台信息为简短描述 */
export declare function formatPlatformSummary(platform: DistributionPlatformSpec): string;
/** 格式化最大时长 */
export declare function formatMaxDuration(platform: DistributionPlatformSpec): string;
//# sourceMappingURL=platform-presets.d.ts.map