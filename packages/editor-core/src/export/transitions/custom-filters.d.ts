/**
 * 自定义转场滤镜链生成 — 处理无法直接映射到 FFmpeg xfade 的高级转场。
 * @module transitions/custom-filters
 */
import type { TransitionType } from '../../model-types';
/** 自定义滤镜生成选项 */
export interface CustomFilterOptions {
    type: TransitionType;
    duration: number;
    offset: number;
    label: string;
    /** 输出宽度 */
    width: number;
    /** 输出高度 */
    height: number;
    /** 帧率 */
    fps: number;
}
/** 滤镜生成结果 */
export interface CustomFilterResult {
    filters: string[];
    outputLabel: string;
}
/**
 * 为自定义转场生成 FFmpeg 滤镜链。
 * 对于非自定义转场返回 null。
 */
export declare function buildCustomTransitionFilters(options: CustomFilterOptions): CustomFilterResult | null;
/**
 * 为预览生成形状 geq alpha 表达式（exported for preview-args.ts）。
 */
export declare function buildShapeGeqExpressionForPreview(type: TransitionType): string;
//# sourceMappingURL=custom-filters.d.ts.map