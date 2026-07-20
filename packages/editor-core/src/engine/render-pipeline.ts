/**
 * 渲染管线深度优化模块
 *
 * 核心优化策略：
 * 1. 帧缓存与预测预加载 - 基于播放进度预解码即将出现的帧
 * 2. 非可见区域跳过渲染 - 只渲染视口内可见内容
 * 3. 代理文件动态切换 - 根据回放压力实时切换原始/代理文件
 * 4. 减少无效重绘 - 脏区域检测与批量更新
 */

import type { Timeline, MediaAsset, Clip } from '../model';

// ==================== 类型定义 ====================

export type RenderQuality = 'full' | 'half' | 'quarter' | 'eighth';
export type ProxyStrategy = 'auto' | 'original' | 'proxy' | 'adaptive';

export interface RenderViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
  zoom: number;
}

export interface FrameDecodeRequest {
  frame: number;
  time: number;
  priority: number; // 0-1, 1 = highest
  quality: RenderQuality;
  useProxy: boolean;
}

export interface FrameDecodeResult {
  frame: number;
  bitmap: ImageBitmap | null;
  decodeTime: number;
  fromCache: boolean;
  quality: RenderQuality;
}

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: 'clip-change' | 'effect-update' | 'transform' | 'scroll' | 'resize';
}

export interface RenderPipelineConfig {
  maxCacheFrames: number;
  maxCacheBytes: number;
  prefetchFrames: number;
  maxConcurrentDecodes: number;
  fpsTarget: number;
  enableViewportCulling: boolean;
  enablePredictivePrefetch: boolean;
  proxySwitchThresholdMs: number;
  dirtyRegionBatchMs: number;
}

export const DEFAULT_RENDER_PIPELINE_CONFIG: RenderPipelineConfig = {
  maxCacheFrames: 120,
  maxCacheBytes: 512 * 1024 * 1024, // 512MB
  prefetchFrames: 30,
  maxConcurrentDecodes: 4,
  fpsTarget: 60,
  enableViewportCulling: true,
  enablePredictivePrefetch: true,
  proxySwitchThresholdMs: 16, // 1 frame at 60fps
  dirtyRegionBatchMs: 8,
};

// ==================== 帧缓存管理器 ====================

export class FrameCacheManager {
  private cache = new Map<number, FrameDecodeResult>();
  private accessOrder: number[] = [];
  private totalBytes = 0;
  private readonly maxFrames: number;
  private readonly maxBytes: number;

  constructor(maxFrames = 120, maxBytes = 512 * 1024 * 1024) {
    this.maxFrames = maxFrames;
    this.maxBytes = maxBytes;
  }

  get(frame: number): FrameDecodeResult | undefined {
    const result = this.cache.get(frame);
    if (result) {
      this.touchFrame(frame);
    }
    return result;
  }

  put(result: FrameDecodeResult, estimatedBytes: number): void {
    if (this.cache.has(result.frame)) {
      this.remove(result.frame);
    }

    while (this.cache.size >= this.maxFrames || this.totalBytes + estimatedBytes > this.maxBytes) {
      if (this.accessOrder.length === 0) break;
      this.remove(this.accessOrder[0]);
    }

    this.cache.set(result.frame, result);
    this.accessOrder.push(result.frame);
    this.totalBytes += estimatedBytes;
  }

  has(frame: number): boolean {
    return this.cache.has(frame);
  }

  remove(frame: number): void {
    const result = this.cache.get(frame);
    if (!result) return;

    this.cache.delete(frame);
    this.accessOrder = this.accessOrder.filter(f => f !== frame);

    if (result.bitmap) {
      try {
        result.bitmap.close();
      } catch {
        // Bitmap may already be closed
      }
    }
  }

  retainAround(centerFrame: number, range: number): void {
    const minFrame = centerFrame - range;
    const maxFrame = centerFrame + range;

    for (const frame of [...this.cache.keys()]) {
      if (frame < minFrame || frame > maxFrame) {
        this.remove(frame);
      }
    }
  }

  clear(): void {
    for (const result of this.cache.values()) {
      if (result.bitmap) {
        try {
          result.bitmap.close();
        } catch {
          // Ignore
        }
      }
    }
    this.cache.clear();
    this.accessOrder = [];
    this.totalBytes = 0;
  }

  getStats() {
    return {
      frames: this.cache.size,
      bytes: this.totalBytes,
      hitRate: 0, // TODO: track hits/misses
    };
  }

  private touchFrame(frame: number): void {
    const index = this.accessOrder.indexOf(frame);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(frame);
    }
  }
}

// ==================== 预测预加载器 ====================

export class PredictivePrefetcher {
  private playbackHistory: { time: number; timestamp: number }[] = [];
  private predictedDirection: 'forward' | 'backward' | 'static' = 'forward';
  private predictedSpeed = 1.0;
  private readonly historyWindow = 60;

  recordPlaybackPosition(time: number): void {
    const now = performance.now();
    this.playbackHistory.push({ time, timestamp: now });

    if (this.playbackHistory.length > this.historyWindow) {
      this.playbackHistory.shift();
    }

    this.updatePrediction();
  }

  getPredictedFrames(currentFrame: number, fps: number, prefetchCount: number): number[] {
    if (this.predictedDirection === 'static') {
      return [];
    }

    const frames: number[] = [];
    const direction = this.predictedDirection === 'forward' ? 1 : -1;
    const speedFactor = Math.min(4, Math.max(0.5, this.predictedSpeed));

    for (let i = 1; i <= prefetchCount; i++) {
      const frame = currentFrame + direction * Math.round(i * speedFactor);
      if (frame >= 0) {
        frames.push(frame);
      }
    }

    return frames;
  }

  getPredictionConfidence(): number {
    if (this.playbackHistory.length < 3) return 0;
    return Math.min(1, this.playbackHistory.length / this.historyWindow);
  }

  private updatePrediction(): void {
    if (this.playbackHistory.length < 2) return;

    const recent = this.playbackHistory.slice(-10);
    const dt = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const dTime = recent[recent.length - 1].time - recent[0].time;

    if (dt < 1) return;

    this.predictedSpeed = Math.abs(dTime / (dt / 1000));

    if (Math.abs(dTime) < 0.01) {
      this.predictedDirection = 'static';
    } else if (dTime > 0) {
      this.predictedDirection = 'forward';
    } else {
      this.predictedDirection = 'backward';
    }
  }
}

// ==================== 视口裁剪器 ====================

export class ViewportCuller {
  private lastViewport: RenderViewport | null = null;
  private visibleClipsCache: Set<string> = new Set();

  getVisibleClips(
    timeline: Timeline,
    viewport: RenderViewport,
    pixelsPerSecond: number,
  ): Clip[] {
    const viewStartTime = viewport.scrollLeft / pixelsPerSecond;
    const viewEndTime = (viewport.scrollLeft + viewport.width) / pixelsPerSecond;

    const visibleClips: Clip[] = [];

    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.start + clip.duration;

        if (clipEnd > viewStartTime && clip.start < viewEndTime) {
          visibleClips.push(clip);
        }
      }
    }

    return visibleClips;
  }

  isClipVisible(clip: Clip, viewport: RenderViewport, pixelsPerSecond: number): boolean {
    const viewStartTime = viewport.scrollLeft / pixelsPerSecond;
    const viewEndTime = (viewport.scrollLeft + viewport.width) / pixelsPerSecond;
    const clipEnd = clip.start + clip.duration;

    return clipEnd > viewStartTime && clip.start < viewEndTime;
  }

  getDirtyRegions(
    previousViewport: RenderViewport | null,
    currentViewport: RenderViewport,
  ): DirtyRegion[] {
    if (!previousViewport) {
      return [{
        x: 0,
        y: 0,
        width: currentViewport.width,
        height: currentViewport.height,
        reason: 'resize',
      }];
    }

    const regions: DirtyRegion[] = [];

    if (previousViewport.scrollLeft !== currentViewport.scrollLeft ||
        previousViewport.scrollTop !== currentViewport.scrollTop) {
      regions.push({
        x: 0,
        y: 0,
        width: currentViewport.width,
        height: currentViewport.height,
        reason: 'scroll',
      });
    }

    if (previousViewport.width !== currentViewport.width ||
        previousViewport.height !== currentViewport.height) {
      regions.push({
        x: 0,
        y: 0,
        width: currentViewport.width,
        height: currentViewport.height,
        reason: 'resize',
      });
    }

    return regions;
  }

  updateViewport(viewport: RenderViewport): void {
    this.lastViewport = { ...viewport };
  }
}

// ==================== 代理切换器 ====================

export class ProxySwitcher {
  private currentStrategy: ProxyStrategy = 'auto';
  private decodeTimes: number[] = [];
  private readonly windowSize = 30;
  private proxyActive = false;

  setStrategy(strategy: ProxyStrategy): void {
    this.currentStrategy = strategy;
  }

  shouldUseProxy(decodeTimeMs: number, thresholdMs: number): boolean {
    this.decodeTimes.push(decodeTimeMs);
    if (this.decodeTimes.length > this.windowSize) {
      this.decodeTimes.shift();
    }

    switch (this.currentStrategy) {
      case 'original':
        return false;
      case 'proxy':
        return true;
      case 'adaptive':
        return this.adaptiveDecision(thresholdMs);
      case 'auto':
      default:
        return this.autoDecision(thresholdMs);
    }
  }

  isProxyActive(): boolean {
    return this.proxyActive;
  }

  getAverageDecodeTime(): number {
    if (this.decodeTimes.length === 0) return 0;
    return this.decodeTimes.reduce((a, b) => a + b, 0) / this.decodeTimes.length;
  }

  private autoDecision(thresholdMs: number): boolean {
    const avgTime = this.getAverageDecodeTime();
    if (avgTime > thresholdMs * 2) {
      this.proxyActive = true;
    } else if (avgTime < thresholdMs * 0.5) {
      this.proxyActive = false;
    }
    return this.proxyActive;
  }

  private adaptiveDecision(thresholdMs: number): boolean {
    const avgTime = this.getAverageDecodeTime();
    const p95 = this.getPercentile(95);

    if (p95 > thresholdMs * 3) {
      this.proxyActive = true;
    } else if (avgTime < thresholdMs) {
      this.proxyActive = false;
    }

    return this.proxyActive;
  }

  private getPercentile(p: number): number {
    if (this.decodeTimes.length === 0) return 0;
    const sorted = [...this.decodeTimes].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ==================== 脏区域批处理器 ====================

export class DirtyRegionBatcher {
  private pendingRegions: DirtyRegion[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly batchMs: number;
  private onFlush: ((regions: DirtyRegion[]) => void) | null = null;

  constructor(batchMs = 8) {
    this.batchMs = batchMs;
  }

  setFlushCallback(callback: (regions: DirtyRegion[]) => void): void {
    this.onFlush = callback;
  }

  addRegion(region: DirtyRegion): void {
    this.pendingRegions.push(region);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchMs);
    }
  }

  flush(): DirtyRegion[] {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const merged = this.mergeRegions(this.pendingRegions);
    this.pendingRegions = [];

    if (this.onFlush && merged.length > 0) {
      this.onFlush(merged);
    }

    return merged;
  }

  private mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    if (regions.length <= 1) return regions;

    // Simple merge: combine all regions into one bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const r of regions) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }

    return [{
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      reason: regions[0].reason,
    }];
  }
}

// ==================== 渲染管线主类 ====================

export class RenderPipeline {
  private config: RenderPipelineConfig;
  private frameCache: FrameCacheManager;
  private prefetcher: PredictivePrefetcher;
  private culler: ViewportCuller;
  private proxySwitcher: ProxySwitcher;
  private dirtyBatcher: DirtyRegionBatcher;
  private currentViewport: RenderViewport | null = null;
  private isPlaying = false;
  private lastRenderTime = 0;
  private frameTimes: number[] = [];
  private decodeQueue: FrameDecodeRequest[] = [];
  private activeDecodes = 0;

  constructor(config: Partial<RenderPipelineConfig> = {}) {
    this.config = { ...DEFAULT_RENDER_PIPELINE_CONFIG, ...config };
    this.frameCache = new FrameCacheManager(this.config.maxCacheFrames, this.config.maxCacheBytes);
    this.prefetcher = new PredictivePrefetcher();
    this.culler = new ViewportCuller();
    this.proxySwitcher = new ProxySwitcher();
    this.dirtyBatcher = new DirtyRegionBatcher(this.config.dirtyRegionBatchMs);
  }

  // Public API

  setViewport(viewport: RenderViewport): void {
    this.currentViewport = viewport;
    this.culler.updateViewport(viewport);
  }

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  setProxyStrategy(strategy: ProxyStrategy): void {
    this.proxySwitcher.setStrategy(strategy);
  }

  async renderFrame(
    frame: number,
    time: number,
    fps: number,
    media: MediaAsset[],
    timeline: Timeline,
  ): Promise<FrameDecodeResult> {
    const renderStart = performance.now();

    // Check cache first
    const cached = this.frameCache.get(frame);
    if (cached) {
      this.recordFrameTime(performance.now() - renderStart);
      return { ...cached, fromCache: true };
    }

    // Determine quality based on performance
    const quality = this.determineQuality();
    const useProxy = this.proxySwitcher.shouldUseProxy(
      this.getAverageFrameTime(),
      this.config.proxySwitchThresholdMs,
    );

    // Queue decode request
    const request: FrameDecodeRequest = {
      frame,
      time,
      priority: 1.0,
      quality,
      useProxy,
    };

    const result = await this.decodeFrame(request);

    // Cache result
    const estimatedBytes = this.estimateFrameBytes(quality, 1920, 1080);
    this.frameCache.put(result, estimatedBytes);

    // Record playback position for prediction
    this.prefetcher.recordPlaybackPosition(time);

    // Trigger predictive prefetch
    if (this.config.enablePredictivePrefetch && this.isPlaying) {
      this.prefetchNextFrames(frame, fps, media, timeline);
    }

    this.recordFrameTime(performance.now() - renderStart);
    return result;
  }

  getVisibleClips(timeline: Timeline, pixelsPerSecond: number): Clip[] {
    if (!this.currentViewport || !this.config.enableViewportCulling) {
      return timeline.tracks.flatMap(t => t.clips);
    }
    return this.culler.getVisibleClips(timeline, this.currentViewport, pixelsPerSecond);
  }

  invalidateRange(startFrame: number, endFrame: number): void {
    for (let f = startFrame; f <= endFrame; f++) {
      this.frameCache.remove(f);
    }
  }

  retainAround(centerFrame: number): void {
    this.frameCache.retainAround(centerFrame, this.config.maxCacheFrames / 2);
  }

  getStats() {
    return {
      cache: this.frameCache.getStats(),
      averageFrameTime: this.getAverageFrameTime(),
      proxyActive: this.proxySwitcher.isProxyActive(),
      activeDecodes: this.activeDecodes,
      predictionConfidence: this.prefetcher.getPredictionConfidence(),
    };
  }

  destroy(): void {
    this.frameCache.clear();
    this.dirtyBatcher.flush();
    this.decodeQueue = [];
  }

  // Private methods

  private determineQuality(): RenderQuality {
    const avgFrameTime = this.getAverageFrameTime();
    const targetFrameTime = 1000 / this.config.fpsTarget;

    if (avgFrameTime < targetFrameTime * 0.5) return 'full';
    if (avgFrameTime < targetFrameTime * 0.8) return 'half';
    if (avgFrameTime < targetFrameTime * 1.2) return 'quarter';
    return 'eighth';
  }

  private async decodeFrame(request: FrameDecodeRequest): Promise<FrameDecodeResult> {
    const decodeStart = performance.now();

    // Wait for available decode slot
    while (this.activeDecodes >= this.config.maxConcurrentDecodes) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.activeDecodes++;

    try {
      // Simulate frame decode (in real implementation, use VideoDecoder or Canvas)
      const bitmap = await this.simulateDecode(request);

      return {
        frame: request.frame,
        bitmap,
        decodeTime: performance.now() - decodeStart,
        fromCache: false,
        quality: request.quality,
      };
    } finally {
      this.activeDecodes--;
    }
  }

  private async simulateDecode(request: FrameDecodeRequest): Promise<ImageBitmap | null> {
    // Simulate decode delay based on quality
    const delays: Record<RenderQuality, number> = {
      full: 8,
      half: 4,
      quarter: 2,
      eighth: 1,
    };

    await new Promise(resolve => setTimeout(resolve, delays[request.quality]));

    // In real implementation, return actual ImageBitmap
    return null;
  }

  private prefetchNextFrames(
    currentFrame: number,
    fps: number,
    media: MediaAsset[],
    timeline: Timeline,
  ): void {
    const frames = this.prefetcher.getPredictedFrames(
      currentFrame,
      fps,
      this.config.prefetchFrames,
    );

    for (const frame of frames) {
      if (!this.frameCache.has(frame)) {
        const request: FrameDecodeRequest = {
          frame,
          time: frame / fps,
          priority: 0.3,
          quality: this.determineQuality(),
          useProxy: this.proxySwitcher.isProxyActive(),
        };

        this.decodeQueue.push(request);
        this.processDecodeQueue();
      }
    }
  }

  private async processDecodeQueue(): Promise<void> {
    if (this.decodeQueue.length === 0) return;

    // Sort by priority (highest first)
    this.decodeQueue.sort((a, b) => b.priority - a.priority);

    const request = this.decodeQueue.shift();
    if (!request) return;

    const result = await this.decodeFrame(request);
    const estimatedBytes = this.estimateFrameBytes(request.quality, 1920, 1080);
    this.frameCache.put(result, estimatedBytes);
  }

  private recordFrameTime(time: number): void {
    this.frameTimes.push(time);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
  }

  private getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  private estimateFrameBytes(quality: RenderQuality, width: number, height: number): number {
    const pixels = width * height;
    const bytesPerPixel = 4; // RGBA
    const qualityMultiplier: Record<RenderQuality, number> = {
      full: 1,
      half: 0.25,
      quarter: 0.0625,
      eighth: 0.015625,
    };
    return Math.round(pixels * bytesPerPixel * qualityMultiplier[quality]);
  }
}

// ==================== 工厂函数 ====================

export function createRenderPipeline(config?: Partial<RenderPipelineConfig>): RenderPipeline {
  return new RenderPipeline(config);
}

export function createDefaultRenderPipeline(): RenderPipeline {
  return new RenderPipeline(DEFAULT_RENDER_PIPELINE_CONFIG);
}
