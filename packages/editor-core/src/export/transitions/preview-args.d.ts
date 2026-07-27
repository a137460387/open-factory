/**
 * 转场预览缩略图参数生成。
 * @module transitions/preview-args
 */
import type { TransitionType } from '../../model-types';
/** 预览参数选项 */
export interface TransitionThumbnailOptions {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
}
/**
 * 为指定转场类型生成 FFmpeg 预览缩略图参数。
 * 输出为单帧 image2pipe 格式。
 * 注意：此函数不与 ffmpeg-builder 中的 buildTransitionPreviewArgs 冲突。
 */
export declare function buildTransitionThumbnailArgs(type: TransitionType, options?: TransitionThumbnailOptions): string[];
/**
 * 为 canvas 2D 预览生成模拟参数（用于浏览器端缩略图渲染）。
 * 返回一个描述转场视觉特征的对象，供 canvas 绘制使用。
 */
export interface CanvasPreviewParams {
    type: TransitionType;
    /** 擦除方向 */
    direction?: 'left' | 'right' | 'up' | 'down';
    /** 是否使用淡入淡出 */
    fade: boolean;
    /** 是否使用缩放 */
    zoom: boolean;
    /** 是否使用旋转 */
    rotate: boolean;
    /** 是否使用像素化 */
    pixelate: boolean;
    /** 是否使用形状遮罩 */
    shapeMask?: 'heart' | 'star';
    /** 是否使用闪光 */
    flash?: 'white' | 'black';
    /** 是否使用故障效果 */
    glitch: boolean;
}
export declare function getCanvasPreviewParams(type: TransitionType): CanvasPreviewParams;
//# sourceMappingURL=preview-args.d.ts.map