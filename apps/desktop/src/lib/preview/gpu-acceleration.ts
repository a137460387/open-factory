import {
  buildTimelineRenderFrameKey,
  type MediaAsset,
  type ProjectColorPipeline,
  type Sequence,
  type Timeline,
  type TimelineRenderFrameRequest
} from '@open-factory/editor-core';

export const GPU_TEXTURE_POOL_MAX_BYTES = 512 * 1024 * 1024;
const GPU_PREFETCH_LOOKAHEAD_SECONDS = 3;

export interface GpuTexturePoolOptions<TTexture> {
  maxBytes?: number;
  disposeTexture?(texture: TTexture): void;
}

export interface GpuTexturePoolPutInput<TTexture> {
  key: string;
  texture: TTexture;
  bytes: number;
}

export interface GpuTexturePoolSnapshot {
  bytes: number;
  count: number;
  maxBytes: number;
  keys: string[];
}

interface GpuTexturePoolEntry<TTexture> {
  key: string;
  texture: TTexture;
  bytes: number;
  lastUsed: number;
}

export class GpuTexturePool<TTexture> {
  private readonly entries = new Map<string, GpuTexturePoolEntry<TTexture>>();
  private readonly maxBytes: number;
  private readonly disposeTexture?: (texture: TTexture) => void;
  private clock = 0;
  private usedBytes = 0;

  constructor(options: GpuTexturePoolOptions<TTexture> = {}) {
    this.maxBytes = Math.max(1, options.maxBytes ?? GPU_TEXTURE_POOL_MAX_BYTES);
    this.disposeTexture = options.disposeTexture;
  }

  get size(): number {
    return this.entries.size;
  }

  get sizeBytes(): number {
    return this.usedBytes;
  }

  get(key: string): TTexture | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    entry.lastUsed = ++this.clock;
    return entry.texture;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  put(input: GpuTexturePoolPutInput<TTexture>): boolean {
    const key = input.key.trim();
    if (!key) {
      return false;
    }
    const bytes = normalizeTextureBytes(input.bytes);
    if (bytes > this.maxBytes) {
      return false;
    }
    const existing = this.entries.get(key);
    if (existing) {
      this.usedBytes -= existing.bytes;
      if (existing.texture !== input.texture) {
        this.disposeTexture?.(existing.texture);
      }
    }
    this.entries.set(key, {
      key,
      texture: input.texture,
      bytes,
      lastUsed: ++this.clock
    });
    this.usedBytes += bytes;
    this.pruneToBudget();
    return this.entries.has(key);
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }
    this.entries.delete(key);
    this.usedBytes -= entry.bytes;
    this.disposeTexture?.(entry.texture);
    return true;
  }

  clear(): GpuTexturePoolSnapshot {
    for (const entry of this.entries.values()) {
      this.disposeTexture?.(entry.texture);
    }
    this.entries.clear();
    this.usedBytes = 0;
    return this.snapshot();
  }

  snapshot(): GpuTexturePoolSnapshot {
    return {
      bytes: this.usedBytes,
      count: this.entries.size,
      maxBytes: this.maxBytes,
      keys: Array.from(this.entries.keys())
    };
  }

  private pruneToBudget(): void {
    while (this.usedBytes > this.maxBytes && this.entries.size > 0) {
      let oldest: GpuTexturePoolEntry<TTexture> | undefined;
      for (const entry of this.entries.values()) {
        if (!oldest || entry.lastUsed < oldest.lastUsed) {
          oldest = entry;
        }
      }
      if (!oldest) {
        break;
      }
      this.delete(oldest.key);
    }
  }
}

export interface GpuPrefetchFrameInput {
  timeline: Timeline;
  media: MediaAsset[];
  playheadTime: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
  sequences?: Sequence[];
  activeSequenceId?: string;
  colorPipeline?: ProjectColorPipeline;
  lookaheadSeconds?: number;
}

export function buildGpuPrefetchFrameRequests(input: GpuPrefetchFrameInput): TimelineRenderFrameRequest[] {
  const fps = normalizePositiveInteger(input.fps, 30);
  const duration = Math.max(0, input.duration);
  const lookahead = Math.max(0, input.lookaheadSeconds ?? GPU_PREFETCH_LOOKAHEAD_SECONDS);
  const maxFrame = Math.ceil(duration * fps);
  const startFrame = Math.min(Math.max(0, Math.floor(input.playheadTime * fps)), maxFrame);
  const endFrame = Math.min(Math.max(startFrame, Math.ceil((input.playheadTime + lookahead) * fps)), maxFrame);
  const requests: TimelineRenderFrameRequest[] = [];
  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    requests.push({
      frame,
      time: round(frame / fps),
      key: buildTimelineRenderFrameKey({ ...input, fps, frame })
    });
  }
  return requests;
}

export interface GpuPreviewCapabilities {
  offscreenCanvasWorkerSupported: boolean;
  texturePreloadSupported: boolean;
  timerQuerySupported: boolean;
  fallbackReason?: string;
}

export interface GpuPreviewFeatureProbe {
  hasOffscreenCanvas: boolean;
  hasCanvasTransfer: boolean;
  hasWorker: boolean;
  hasCreateImageBitmap: boolean;
  hasWebGl: boolean;
  hasTimerQuery?: boolean;
}

export function resolveGpuPreviewCapabilities(features: GpuPreviewFeatureProbe): GpuPreviewCapabilities {
  const offscreenCanvasWorkerSupported =
    features.hasOffscreenCanvas && features.hasCanvasTransfer && features.hasWorker && features.hasCreateImageBitmap && features.hasWebGl;
  return {
    offscreenCanvasWorkerSupported,
    texturePreloadSupported: features.hasCreateImageBitmap && features.hasWebGl,
    timerQuerySupported: features.hasTimerQuery === true,
    fallbackReason: offscreenCanvasWorkerSupported ? undefined : 'offscreen-canvas-worker-unavailable'
  };
}

export function detectGpuPreviewCapabilities(canvas?: HTMLCanvasElement): GpuPreviewCapabilities {
  const canvasPrototype = typeof HTMLCanvasElement === 'undefined' ? undefined : HTMLCanvasElement.prototype;
  const hasCanvasTransfer = typeof canvas?.transferControlToOffscreen === 'function' || typeof canvasPrototype?.transferControlToOffscreen === 'function';
  const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const hasWorker = typeof Worker !== 'undefined';
  const hasCreateImageBitmap = typeof createImageBitmap === 'function';
  let hasWebGl = true;
  let hasTimerQuery = false;
  const probeCanvas = typeof document === 'undefined' ? canvas : document.createElement('canvas');
  if (probeCanvas) {
    try {
      const gl = probeCanvas.getContext('webgl');
      hasWebGl = Boolean(gl);
      hasTimerQuery = Boolean(gl?.getExtension('EXT_disjoint_timer_query'));
    } catch {
      hasWebGl = false;
    }
  }
  return resolveGpuPreviewCapabilities({
    hasOffscreenCanvas,
    hasCanvasTransfer,
    hasWorker,
    hasCreateImageBitmap,
    hasWebGl,
    hasTimerQuery
  });
}

export interface GpuPreviewMetrics {
  gpuFrameMs: number;
  textureBytes: number;
  textureCount: number;
  drawCalls: number;
  instancedDrawCalls: number;
  offscreenWorkerSupported: boolean;
  offscreenWorkerActive: boolean;
  timerQuerySupported: boolean;
  fallbackReason?: string;
}

export const DEFAULT_GPU_PREVIEW_METRICS: GpuPreviewMetrics = {
  gpuFrameMs: 0,
  textureBytes: 0,
  textureCount: 0,
  drawCalls: 0,
  instancedDrawCalls: 0,
  offscreenWorkerSupported: false,
  offscreenWorkerActive: false,
  timerQuerySupported: false
};

export function estimateTextureBytes(width: number, height: number, bytesPerPixel = 4): number {
  return normalizeTextureBytes(Math.max(1, Math.round(width)) * Math.max(1, Math.round(height)) * Math.max(1, Math.round(bytesPerPixel)));
}

export function calculateInstancedDrawCallCount(clipCount: number, instancingSupported: boolean): number {
  const count = Math.max(0, Math.floor(Number.isFinite(clipCount) ? clipCount : 0));
  if (count === 0) {
    return 0;
  }
  return instancingSupported ? 1 : count;
}

export function formatTextureMemoryMiB(bytes: number): number {
  return Math.round((Math.max(0, bytes) / (1024 * 1024)) * 10) / 10;
}

function normalizeTextureBytes(bytes: number): number {
  return Math.max(1, Math.round(Number.isFinite(bytes) ? bytes : 1));
}

function normalizePositiveInteger(value: number, fallback: number): number {
  const numeric = Math.round(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function round(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
