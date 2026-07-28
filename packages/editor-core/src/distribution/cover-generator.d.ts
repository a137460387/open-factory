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
import type { DistributionPlatformId } from './platform-presets';
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
export declare const COVER_SIZE_PRESETS: CoverSizePreset[];
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
    excludeRanges?: Array<{
        start: number;
        end: number;
    }>;
}
/** 默认封面生成配置 */
export declare const DEFAULT_COVER_CONFIG: CoverGeneratorConfig;
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
export declare function scoreVideoFrame(frame: VideoFrame): CoverFrameScore;
/**
 * 对多个帧进行评分并排序
 *
 * @param frames 视频帧列表
 * @param preferFace 是否优先选择人脸帧
 * @returns 排序后的评分列表
 */
export declare function rankVideoFrames(frames: VideoFrame[], preferFace?: boolean): CoverFrameScore[];
/**
 * 计算封面裁剪参数
 *
 * 从原始帧裁剪到目标封面尺寸，优先保留人脸区域。
 */
export declare function calculateCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, faceRegions?: FaceRegion[]): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * 生成封面提取和处理的 FFmpeg 参数
 */
export declare function buildCoverFfmpegArgs(sourcePath: string, outputPath: string, frameTimeSecs: number, outputWidth: number, outputHeight: number, cropParams: {
    x: number;
    y: number;
    width: number;
    height: number;
}, overlay?: CoverOverlay): string[];
/** 为平台生成默认封面叠加样式 */
export declare function getDefaultCoverOverlay(platformId: DistributionPlatformId, title?: string, watermark?: BrandWatermark): CoverOverlay;
/**
 * 生成智能封面
 *
 * 从视频帧中选择最佳帧，为各目标平台生成封面。
 *
 * @param frames 视频帧列表（含分析数据）
 * @param config 生成配置
 * @returns 封面生成结果
 */
export declare function generateCovers(frames: VideoFrame[], config?: CoverGeneratorConfig): CoverGenerationResult;
/**
 * 为单个平台生成封面
 */
export declare function generateSingleCover(frames: VideoFrame[], platformId: DistributionPlatformId, title?: string, watermark?: BrandWatermark): GeneratedCover | null;
/** 获取平台推荐的封面尺寸 */
export declare function getCoverSizeForPlatform(platformId: DistributionPlatformId): CoverSizePreset;
/** 获取所有封面尺寸预设 */
export declare function getAllCoverSizePresets(): CoverSizePreset[];
//# sourceMappingURL=cover-generator.d.ts.map