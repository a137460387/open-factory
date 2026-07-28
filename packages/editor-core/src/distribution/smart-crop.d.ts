/**
 * 智能裁剪算法
 *
 * 基于 FFmpeg 滤镜的无依赖裁剪策略，支持：
 * - 画面有效区域检测 (cropdetect)
 * - 场景变化检测 (scene detection)
 * - 重心计算算法（结合画面中心、字幕安全区）
 * - 多画幅自动适配
 */
import type { DistributionPlatformSpec } from './platform-presets';
export interface SmartCropResult {
    /** 目标平台 ID */
    platformId: string;
    /** 源宽高比 */
    sourceAspectRatio: string;
    /** 目标宽高比 */
    targetAspectRatio: string;
    /** 裁剪区域 X (归一化 0-1) */
    cropX: number;
    /** 裁剪区域 Y (归一化 0-1) */
    cropY: number;
    /** 裁剪区域宽度 (归一化 0-1) */
    cropWidth: number;
    /** 裁剪区域高度 (归一化 0-1) */
    cropHeight: number;
    /** FFmpeg scale 滤镜片段 */
    scaleFilter: string;
    /** FFmpeg crop 滤镜片段 */
    cropFilter: string;
    /** 裁剪置信度 (0-1) */
    confidence: number;
    /** 警告信息 */
    warnings: string[];
}
export interface CropAnalysisInput {
    /** 源视频宽度 */
    sourceWidth: number;
    /** 源视频高度 */
    sourceHeight: number;
    /** 源视频时长（秒） */
    duration: number;
    /** 字幕轨 Y 位置 (归一化 0-1)，如果有 */
    subtitleY?: number;
    /** 字幕轨高度 (归一化 0-1)，如果有 */
    subtitleHeight?: number;
    /** 运动区域中心 X (归一化 0-1)，如果已分析 */
    motionCenterX?: number;
    /** 运动区域中心 Y (归一化 0-1)，如果已分析 */
    motionCenterY?: number;
}
/** 解析宽高比字符串为数值 */
export declare function parseAspectRatio(ratio: string): number;
/** 计算宽高比字符串 */
export declare function calcAspectRatioString(width: number, height: number): string;
/**
 * 计算智能裁剪参数
 *
 * 将源画面裁剪为目标宽高比，基于重心选择最佳裁剪区域。
 *
 * @param input 源画面分析数据
 * @param targetPlatform 目标平台规格
 * @returns 裁剪结果
 */
export declare function calculateSmartCrop(input: CropAnalysisInput, targetPlatform: DistributionPlatformSpec): SmartCropResult;
/**
 * 为多个平台计算裁剪参数
 *
 * @param input 源画面分析数据
 * @param platforms 目标平台列表
 * @returns 每个平台的裁剪结果
 */
export declare function calculateBatchSmartCrops(input: CropAnalysisInput, platforms: DistributionPlatformSpec[]): SmartCropResult[];
export interface CropPreviewDimensions {
    /** 预览框宽度 (px) */
    previewWidth: number;
    /** 预览框高度 (px) */
    previewHeight: number;
    /** 裁剪区域在预览中的 X 偏移 (px) */
    offsetX: number;
    /** 裁剪区域在预览中的 Y 偏移 (px) */
    offsetY: number;
    /** 裁剪区域在预览中的宽度 (px) */
    regionWidth: number;
    /** 裁剪区域在预览中的高度 (px) */
    regionHeight: number;
}
/**
 * 计算裁剪预览的显示尺寸
 *
 * @param cropResult 裁剪结果
 * @param containerWidth 预览容器宽度 (px)
 * @param containerHeight 预览容器高度 (px)
 */
export declare function calculateCropPreviewDimensions(cropResult: SmartCropResult, containerWidth: number, containerHeight: number): CropPreviewDimensions;
/**
 * 将裁剪结果转换为 reframe offset 参数
 * 用于集成到现有的 ExportSettings.reframeOffsetX/Y
 */
export declare function cropResultToReframeOffset(cropResult: SmartCropResult): {
    reframeOffsetX: number;
    reframeOffsetY: number;
};
/**
 * 构建完整的裁剪 + 缩放滤镜链
 * 可直接注入 FFmpeg filter_complex
 */
export declare function buildCropScaleFilterChain(cropResult: SmartCropResult): string;
//# sourceMappingURL=smart-crop.d.ts.map