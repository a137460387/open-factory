import { round } from './time';

export interface TimelineVirtualRenderWindowInput {
  scrollLeft: number;
  viewportWidth: number;
  zoom: number;
  labelWidth?: number;
  overscanScreens?: number;
}

export interface TimelineVirtualRenderWindow {
  start: number;
  end: number;
}

export interface TimelineVirtualTrackWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  trackCount: number;
  overscanRows?: number;
}

export interface TimelineVirtualTrackWindow {
  startIndex: number;
  endIndex: number;
  beforeHeight: number;
  afterHeight: number;
  totalHeight: number;
  renderedCount: number;
}

export interface TimelineLazyAssetInput {
  clipStart: number;
  clipDuration: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  labelWidth?: number;
  preloadPx?: number;
}

export interface TimelineLargeProjectModeInput {
  clipCount: number;
  threshold?: number;
  extremeThreshold?: number;
}

export interface TimelineLargeProjectMode {
  enabled: boolean;
  disableAnimations: boolean;
  virtualOverscanScreens: number;
  waveformResolutionScale: number;
  previewFrameStep: number;
  minimapClipLimit: number | undefined;
  /** 是否为极端大项目（1000+ 片段） */
  extremeMode: boolean;
  /** 缩略图加载延迟（ms） */
  thumbnailLoadDelayMs: number;
  /** 波形采样密度（0-1，越小越稀疏） */
  waveformSampleDensity: number;
}

export interface TimelineIncrementalRenderPlan {
  changedClipIds: string[];
}

export function getTimelineVirtualRenderWindow(input: TimelineVirtualRenderWindowInput): TimelineVirtualRenderWindow {
  const zoom = Math.max(0.001, input.zoom);
  const viewportWidth = Math.max(1, input.viewportWidth);
  const labelWidth = Math.max(0, input.labelWidth ?? 0);
  const overscanScreens = Math.max(0, input.overscanScreens ?? 2);
  const viewportStartPx = Math.max(0, input.scrollLeft - labelWidth);
  const startPx = Math.max(0, viewportStartPx - viewportWidth * overscanScreens);
  const endPx = viewportStartPx + viewportWidth * (1 + overscanScreens);
  return {
    start: round(startPx / zoom),
    end: round(Math.max(endPx, startPx + viewportWidth) / zoom)
  };
}

export function filterTimelineVirtualClips<TClip extends { start: number; duration: number }>(
  clips: TClip[],
  window: TimelineVirtualRenderWindow
): TClip[] {
  if (clips.length === 0) return [];
  // 对于小数组（<=32 元素），线性扫描更快
  if (clips.length <= 32) {
    return clips.filter((clip) => clip.start < window.end && clip.start + clip.duration > window.start);
  }
  // 大数组使用二分查找定位起始点，减少扫描范围
  const startIdx = binarySearchClipStart(clips, window.start);
  const result: TClip[] = [];
  for (let i = startIdx; i < clips.length; i++) {
    const clip = clips[i];
    if (clip.start >= window.end) break;
    if (clip.start + clip.duration > window.start) {
      result.push(clip);
    }
  }
  return result;
}

/**
 * 二分查找：找到第一个 clip.start + clip.duration > windowStart 的索引
 * 前提：clips 按 start 升序排列
 */
function binarySearchClipStart<TClip extends { start: number; duration: number }>(
  clips: TClip[],
  windowStart: number
): number {
  let low = 0;
  let high = clips.length - 1;
  let result = 0;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (clips[mid].start + clips[mid].duration <= windowStart) {
      low = mid + 1;
    } else {
      result = mid;
      high = mid - 1;
    }
  }
  return result;
}

/**
 * 高性能滚动视口更新节流器
 * 使用 requestAnimationFrame 批处理滚动事件，避免每帧多次计算
 */
export class ScrollViewportThrottler {
  private pending = false;
  private latestScrollLeft = 0;
  private latestScrollTop = 0;
  private callback?: (scrollLeft: number, scrollTop: number) => void;

  constructor(callback: (scrollLeft: number, scrollTop: number) => void) {
    this.callback = callback;
  }

  update(scrollLeft: number, scrollTop: number): void {
    this.latestScrollLeft = scrollLeft;
    this.latestScrollTop = scrollTop;
    if (!this.pending) {
      this.pending = true;
      requestAnimationFrame(this.flush);
    }
  }

  private flush = (): void => {
    this.pending = false;
    this.callback?.(this.latestScrollLeft, this.latestScrollTop);
  };

  dispose(): void {
    this.callback = undefined;
  }
}

export function getTimelineVirtualTrackWindow(input: TimelineVirtualTrackWindowInput): TimelineVirtualTrackWindow {
  const rowHeight = Math.max(1, input.rowHeight);
  const trackCount = Math.max(0, Math.floor(input.trackCount));
  const viewportHeight = Math.max(1, input.viewportHeight);
  const scrollTop = Math.max(0, input.scrollTop);
  const overscanRows = Math.max(0, Math.floor(input.overscanRows ?? 2));
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + viewportHeight) / rowHeight);
  const startIndex = Math.max(0, visibleStart - overscanRows);
  const endIndex = Math.min(trackCount, visibleEnd + overscanRows);
  const renderedCount = Math.max(0, endIndex - startIndex);
  const totalHeight = trackCount * rowHeight;
  return {
    startIndex,
    endIndex,
    beforeHeight: startIndex * rowHeight,
    afterHeight: Math.max(0, totalHeight - endIndex * rowHeight),
    totalHeight,
    renderedCount
  };
}

export function filterTimelineVirtualTracks<TTrack>(tracks: TTrack[], window: TimelineVirtualTrackWindow): TTrack[] {
  return tracks.slice(window.startIndex, window.endIndex);
}

export function shouldLoadTimelineClipAssets(input: TimelineLazyAssetInput): boolean {
  const zoom = Math.max(0.001, input.zoom);
  const labelWidth = Math.max(0, input.labelWidth ?? 0);
  const preloadPx = Math.max(0, input.preloadPx ?? 100);
  const viewportStartPx = Math.max(0, input.scrollLeft - labelWidth);
  const viewportEndPx = viewportStartPx + Math.max(1, input.viewportWidth);
  const clipStartPx = Math.max(0, input.clipStart * zoom);
  const clipEndPx = Math.max(clipStartPx, (input.clipStart + Math.max(0, input.clipDuration)) * zoom);
  return clipStartPx <= viewportEndPx + preloadPx && clipEndPx >= viewportStartPx - preloadPx;
}

export function getTimelineLargeProjectMode(input: TimelineLargeProjectModeInput): TimelineLargeProjectMode {
  const threshold = Math.max(1, Math.floor(input.threshold ?? 200));
  const extremeThreshold = Math.max(threshold, Math.floor(input.extremeThreshold ?? 1000));
  const clipCount = Math.max(0, input.clipCount);
  const enabled = clipCount > threshold;
  const extremeMode = clipCount > extremeThreshold;
  return {
    enabled,
    disableAnimations: enabled,
    virtualOverscanScreens: extremeMode ? 0.25 : enabled ? 0.5 : 2,
    waveformResolutionScale: extremeMode ? 0.25 : enabled ? 0.5 : 1,
    previewFrameStep: extremeMode ? 4 : enabled ? 2 : 1,
    minimapClipLimit: extremeMode ? 80 : enabled ? 160 : undefined,
    extremeMode,
    thumbnailLoadDelayMs: extremeMode ? 2400 : enabled ? 1200 : 0,
    waveformSampleDensity: extremeMode ? 0.3 : enabled ? 0.6 : 1.0
  };
}

export function getTimelineIncrementalRenderPlan<TClip extends { id: string }>(previousClips: TClip[], nextClips: TClip[]): TimelineIncrementalRenderPlan {
  const previousById = new Map(previousClips.map((clip) => [clip.id, clip]));
  const changedClipIds: string[] = [];
  for (const clip of nextClips) {
    if (previousById.get(clip.id) !== clip) {
      changedClipIds.push(clip.id);
    }
  }
  return { changedClipIds };
}
