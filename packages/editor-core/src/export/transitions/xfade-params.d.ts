/**
 * 标准 FFmpeg xfade 转场参数生成。
 * @module transitions/xfade-params
 */
import type { TransitionType } from '../../model-types';
/** xfade 参数生成选项 */
export interface XfadeParamsOptions {
    /** 转场类型 */
    type: TransitionType;
    /** 转场持续时间（秒） */
    duration: number;
    /** 转场在时间线上的偏移量（秒） */
    offset: number;
    /** 输入流标签前缀 */
    label: string;
}
/** xfade 滤镜输出 */
export interface XfadeFilterResult {
    /** FFmpeg filter_complex 中的滤镜字符串数组 */
    filters: string[];
    /** 输出流标签 */
    outputLabel: string;
}
/**
 * 为标准 xfade 转场生成 FFmpeg 滤镜参数。
 * 仅处理直接映射到 FFmpeg xfade 的转场类型。
 * 自定义转场请使用 custom-filters.ts。
 */
export declare function buildXfadeParams(options: XfadeParamsOptions): XfadeFilterResult | null;
/**
 * 获取转场类型的 FFmpeg xfade 名称。
 * 对于自定义转场返回 null。
 */
export declare function getXfadeName(type: TransitionType): string | null;
//# sourceMappingURL=xfade-params.d.ts.map