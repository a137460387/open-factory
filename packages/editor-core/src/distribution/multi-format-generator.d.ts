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
import type { Project } from '../model-types';
import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
import type { SmartCropResult, CropAnalysisInput } from './smart-crop';
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
export declare const DEFAULT_MULTI_FORMAT_CONFIG: MultiFormatConfig;
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
/**
 * 从项目中提取裁剪分析输入
 *
 * 遍历时间线中的视频/图片片段，计算整体画面特征。
 */
export declare function extractCropAnalysisFromProject(project: Project, overrides?: Partial<CropAnalysisInput>): CropAnalysisInput;
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
export declare function generateMultiFormats(project: Project, config?: MultiFormatConfig): MultiFormatResult;
/**
 * 为单个目标平台生成格式变体
 */
export declare function generateFormatVariant(project: Project, platformId: DistributionPlatformId, cropOverrides?: Partial<CropAnalysisInput>): FormatVariant;
/**
 * 生成格式预览数据
 *
 * 计算裁剪区域在预览容器中的显示位置和尺寸。
 */
export declare function generateFormatPreview(variant: FormatVariant, containerWidth: number, containerHeight: number): FormatPreview;
/** 获取所有支持的方向 */
export declare function getSupportedOrientations(): VideoOrientation[];
/** 按方向获取推荐格式 */
export declare function getRecommendedFormatsForOrientation(orientation: VideoOrientation): DistributionPlatformSpec[];
/**
 * 快速生成横屏+竖屏双格式
 * 最常见的多格式需求
 */
export declare function generateDualFormat(project: Project, landscapePlatformId?: DistributionPlatformId, portraitPlatformId?: DistributionPlatformId): MultiFormatResult;
//# sourceMappingURL=multi-format-generator.d.ts.map