import type { SubtitleClip, SubtitleStyle } from '../model';
import { DEFAULT_SUBTITLE_STYLE } from '../model/defaults';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERFORMANCE_TARGET_MS = 16.67; // 60fps = 16.67ms per frame
const DEFAULT_MAX_CUES = 10;

// ---------------------------------------------------------------------------
// Style Resolution
// ---------------------------------------------------------------------------

/**
 * 解析字幕样式，填充默认值
 */
export function resolveSubtitleStyle(style: Partial<SubtitleStyle> | undefined): SubtitleStyle {
  return {
    ...DEFAULT_SUBTITLE_STYLE,
    ...style,
    fontSize: Math.max(8, Math.min(200, style?.fontSize ?? DEFAULT_SUBTITLE_STYLE.fontSize)),
    backgroundOpacity: Math.max(0, Math.min(1, style?.backgroundOpacity ?? DEFAULT_SUBTITLE_STYLE.backgroundOpacity)),
    yOffset: Math.max(0, Math.min(1000, style?.yOffset ?? DEFAULT_SUBTITLE_STYLE.yOffset)),
    outlineWidth: Math.max(0, Math.min(12, style?.outlineWidth ?? DEFAULT_SUBTITLE_STYLE.outlineWidth)),
    shadowOffset: Math.max(0, Math.min(24, style?.shadowOffset ?? DEFAULT_SUBTITLE_STYLE.shadowOffset)),
  };
}

/**
 * 构建 CSS font 字符串
 */
export function buildFontString(style: SubtitleStyle, scale: number = 1): string {
  const size = Math.max(1, Math.round(style.fontSize * scale));
  const weight = style.bold ? '700' : '400';
  const styleStr = style.italic ? 'italic ' : '';
  return `${styleStr}${weight} ${size}px ${style.fontFamily}`;
}

/**
 * 计算字幕在 Canvas 上的 Y 位置
 */
export function calculateSubtitleY(
  canvasHeight: number,
  style: SubtitleStyle,
  scale: number = 1,
): number {
  const scaledFontSize = style.fontSize * scale;
  const scaledYOffset = style.yOffset * scale;
  return canvasHeight - scaledYOffset - scaledFontSize / 2;
}

// ---------------------------------------------------------------------------
// Core Rendering
// ---------------------------------------------------------------------------

/**
 * 渲染单条字幕到 Canvas 2D Context
 * 性能关键路径，避免不必要的对象分配
 */
export function renderSubtitleCue(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<SubtitleRenderConfig>,
): void {
  if (!text.trim()) {
    return;
  }

  const enableOutline = config?.enableOutline ?? true;
  const enableShadow = config?.enableShadow ?? true;
  const enableBackground = config?.enableBackground ?? true;

  const font = buildFontString(style);
  const x = canvasWidth / 2;
  const y = calculateSubtitleY(canvasHeight, style);

  ctx.save();

  // 设置字体（仅在变化时）
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. 绘制阴影（最底层）
  if (enableShadow && style.shadowOffset > 0) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowOffset * 2;
    ctx.shadowOffsetX = style.shadowOffset;
    ctx.shadowOffsetY = style.shadowOffset;
    ctx.fillStyle = style.color;
    ctx.fillText(text, x, y);
    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // 2. 绘制背景
  if (enableBackground && style.backgroundOpacity > 0) {
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize * 1.4;
    const padding = style.fontSize * 0.2;

    ctx.fillStyle = style.backgroundColor;
    ctx.globalAlpha = style.backgroundOpacity;
    ctx.fillRect(
      x - textWidth / 2 - padding,
      y - textHeight / 2,
      textWidth + padding * 2,
      textHeight,
    );
    ctx.globalAlpha = 1;
  }

  // 3. 绘制描边
  if (enableOutline && style.outlineWidth > 0) {
    ctx.strokeStyle = style.outlineColor;
    ctx.lineWidth = style.outlineWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }

  // 4. 绘制填充文本（最顶层）
  ctx.fillStyle = style.color;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * 渲染单个 SubtitleClip 到 Canvas
 */
export function renderSubtitleClip(
  ctx: CanvasRenderingContext2D,
  clip: SubtitleClip,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<SubtitleRenderConfig>,
): boolean {
  // 检查字幕是否在当前时间范围内
  const clipEnd = clip.start + clip.duration;
  if (currentTime < clip.start || currentTime > clipEnd) {
    return false;
  }

  const text = clip.text?.trim();
  if (!text) {
    return false;
  }

  const style = resolveSubtitleStyle(clip.style);
  renderSubtitleCue(ctx, text, style, canvasWidth, canvasHeight, config);
  return true;
}

// ---------------------------------------------------------------------------
// Batch Rendering
// ---------------------------------------------------------------------------

/**
 * 批量渲染多条字幕（用于时间线预览）
 * 性能优化：排序后二分查找活跃字幕
 */
export function renderSubtitleBatch(
  ctx: CanvasRenderingContext2D,
  clips: SubtitleClip[],
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<SubtitleRenderConfig>,
): SubtitleRenderStats {
  const startTime = performance.now();
  const maxCues = config?.maxCues ?? DEFAULT_MAX_CUES;

  // 过滤出当前活跃的字幕
  const activeClips = findActiveClips(clips, currentTime, maxCues);

  // 渲染每条活跃字幕
  let renderedCues = 0;
  for (const clip of activeClips) {
    if (renderSubtitleClip(ctx, clip, currentTime, canvasWidth, canvasHeight, config)) {
      renderedCues++;
    }
  }

  const renderTimeMs = performance.now() - startTime;

  return {
    renderedCues,
    renderTimeMs,
    isPerformant: renderTimeMs <= PERFORMANCE_TARGET_MS,
  };
}

/**
 * 查找当前时间点活跃的字幕片段
 * 使用排序 + 线性扫描（对于典型字幕数量足够高效）
 */
export function findActiveClips(
  clips: SubtitleClip[],
  currentTime: number,
  maxResults: number = DEFAULT_MAX_CUES,
): SubtitleClip[] {
  const active: SubtitleClip[] = [];

  for (let i = 0; i < clips.length && active.length < maxResults; i++) {
    const clip = clips[i];
    const clipEnd = clip.start + clip.duration;
    if (currentTime >= clip.start && currentTime <= clipEnd && clip.text?.trim()) {
      active.push(clip);
    }
  }

  return active;
}

// ---------------------------------------------------------------------------
// Batch Context (Performance Optimization)
// ---------------------------------------------------------------------------

/**
 * 创建批量渲染上下文（用于连续帧渲染）
 */
export function createBatchContext(): SubtitleBatchContext {
  // 尝试使用 OffscreenCanvas（更好的性能）
  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
  let offscreenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(1, 1);
    offscreenCtx = offscreenCanvas.getContext('2d')!;
  } else {
    // Fallback：使用离屏 canvas 元素
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    offscreenCtx = (offscreenCanvas as HTMLCanvasElement).getContext('2d')!;
  }

  return {
    offscreenCanvas,
    offscreenCtx,
    fontCache: new Map(),
    lastCueIds: new Set(),
  };
}

/**
 * 使用批量上下文渲染字幕（用于连续帧渲染场景）
 */
export function renderSubtitleWithBatchContext(
  ctx: CanvasRenderingContext2D,
  batchCtx: SubtitleBatchContext,
  clips: SubtitleClip[],
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<SubtitleRenderConfig>,
): SubtitleRenderStats {
  const startTime = performance.now();
  const maxCues = config?.maxCues ?? DEFAULT_MAX_CUES;

  const activeClips = findActiveClips(clips, currentTime, maxCues);

  // 脏检查：只有当活跃字幕集合变化时才重新渲染
  const currentIds = new Set(activeClips.map((c) => c.id));
  const isDirty = !setsEqual(currentIds, batchCtx.lastCueIds);

  if (!isDirty) {
    // 字幕没有变化，跳过渲染（性能优化）
    return {
      renderedCues: activeClips.length,
      renderTimeMs: performance.now() - startTime,
      isPerformant: true,
    };
  }

  batchCtx.lastCueIds = currentIds;

  let renderedCues = 0;
  for (const clip of activeClips) {
    if (renderSubtitleClip(ctx, clip, currentTime, canvasWidth, canvasHeight, config)) {
      renderedCues++;
    }
  }

  const renderTimeMs = performance.now() - startTime;

  return {
    renderedCues,
    renderTimeMs,
    isPerformant: renderTimeMs <= PERFORMANCE_TARGET_MS,
  };
}

// ---------------------------------------------------------------------------
// Clear / Utility
// ---------------------------------------------------------------------------

/**
 * 清除 Canvas 上的字幕区域（底部区域优化）
 */
export function clearSubtitleArea(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  maxFontSize: number = 120,
  maxYOffset: number = 200,
): void {
  const clearHeight = maxFontSize * 3 + maxYOffset;
  const clearTop = Math.max(0, canvasHeight - clearHeight);
  ctx.clearRect(0, clearTop, canvasWidth, canvasHeight - clearTop);
}

/**
 * 预渲染字幕到离屏 Canvas（用于预览缩略图）
 */
export function prerenderSubtitleToCanvas(
  clip: SubtitleClip,
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : (() => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        return c;
      })();

  const ctx = (canvas as HTMLCanvasElement).getContext('2d') || (canvas as OffscreenCanvas).getContext('2d');
  if (!ctx) {
    return canvas;
  }

  // 填充透明背景
  ctx.clearRect(0, 0, width, height);

  const style = resolveSubtitleStyle(clip.style);
  const text = clip.text?.trim();
  if (text) {
    renderSubtitleCue(ctx as unknown as CanvasRenderingContext2D, text, style, width, height);
  }

  return canvas;
}

/**
 * 测量文本尺寸
 */
export function measureSubtitleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
): { width: number; height: number } {
  ctx.save();
  ctx.font = buildFontString(style);
  const metrics = ctx.measureText(text);
  ctx.restore();

  return {
    width: metrics.width,
    height: style.fontSize * 1.4,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}
