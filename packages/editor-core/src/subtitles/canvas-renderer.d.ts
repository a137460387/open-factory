import type { SubtitleClip, SubtitleStyle } from '../model';
/** 字幕渲染配置 */
export interface SubtitleRenderConfig {
    /** Canvas 宽度 */
    width: number;
    /** Canvas 高度 */
    height: number;
    /** 当前时间（秒） */
    currentTime: number;
    /** 是否启用描边 */
    enableOutline?: boolean;
    /** 是否启用阴影 */
    enableShadow?: boolean;
    /** 是否启用背景 */
    enableBackground?: boolean;
    /** 最大同时渲染字幕数 */
    maxCues?: number;
}
/** 字幕渲染统计 */
export interface SubtitleRenderStats {
    /** 渲染的字幕数量 */
    renderedCues: number;
    /** 渲染耗时（毫秒） */
    renderTimeMs: number;
    /** 是否达到 60fps 目标 */
    isPerformant: boolean;
}
/** 批量渲染上下文（用于性能优化） */
export interface SubtitleBatchContext {
    /** 离屏 Canvas */
    offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
    /** 离屏 Context */
    offscreenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    /** 字体缓存 */
    fontCache: Map<string, string>;
    /** 上一帧的字幕ID集合（用于脏检查） */
    lastCueIds: Set<string>;
}
/**
 * 解析字幕样式，填充默认值
 */
export declare function resolveSubtitleStyle(style: Partial<SubtitleStyle> | undefined): SubtitleStyle;
/**
 * 构建 CSS font 字符串
 */
export declare function buildFontString(style: SubtitleStyle, scale?: number): string;
/**
 * 计算字幕在 Canvas 上的 Y 位置
 */
export declare function calculateSubtitleY(canvasHeight: number, style: SubtitleStyle, scale?: number): number;
/**
 * 渲染单条字幕到 Canvas 2D Context
 * 性能关键路径，避免不必要的对象分配
 */
export declare function renderSubtitleCue(ctx: CanvasRenderingContext2D, text: string, style: SubtitleStyle, canvasWidth: number, canvasHeight: number, config?: Partial<SubtitleRenderConfig>): void;
/**
 * 渲染单个 SubtitleClip 到 Canvas
 */
export declare function renderSubtitleClip(ctx: CanvasRenderingContext2D, clip: SubtitleClip, currentTime: number, canvasWidth: number, canvasHeight: number, config?: Partial<SubtitleRenderConfig>): boolean;
/**
 * 批量渲染多条字幕（用于时间线预览）
 * 性能优化：排序后二分查找活跃字幕
 */
export declare function renderSubtitleBatch(ctx: CanvasRenderingContext2D, clips: SubtitleClip[], currentTime: number, canvasWidth: number, canvasHeight: number, config?: Partial<SubtitleRenderConfig>): SubtitleRenderStats;
/**
 * 查找当前时间点活跃的字幕片段
 * 使用排序 + 线性扫描（对于典型字幕数量足够高效）
 */
export declare function findActiveClips(clips: SubtitleClip[], currentTime: number, maxResults?: number): SubtitleClip[];
/**
 * 创建批量渲染上下文（用于连续帧渲染）
 */
export declare function createBatchContext(): SubtitleBatchContext;
/**
 * 使用批量上下文渲染字幕（用于连续帧渲染场景）
 */
export declare function renderSubtitleWithBatchContext(ctx: CanvasRenderingContext2D, batchCtx: SubtitleBatchContext, clips: SubtitleClip[], currentTime: number, canvasWidth: number, canvasHeight: number, config?: Partial<SubtitleRenderConfig>): SubtitleRenderStats;
/**
 * 清除 Canvas 上的字幕区域（底部区域优化）
 */
export declare function clearSubtitleArea(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, maxFontSize?: number, maxYOffset?: number): void;
/**
 * 预渲染字幕到离屏 Canvas（用于预览缩略图）
 */
export declare function prerenderSubtitleToCanvas(clip: SubtitleClip, width: number, height: number): HTMLCanvasElement | OffscreenCanvas;
/**
 * 测量文本尺寸
 */
export declare function measureSubtitleText(ctx: CanvasRenderingContext2D, text: string, style: SubtitleStyle): {
    width: number;
    height: number;
};
//# sourceMappingURL=canvas-renderer.d.ts.map