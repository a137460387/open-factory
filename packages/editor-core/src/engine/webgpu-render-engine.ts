/**
 * WebGPU 渲染引擎
 *
 * 核心功能：
 * 1. WebGPU 设备管理与初始化
 * 2. 视频帧 GPU 解码与上传
 * 3. 效果渲染管线（色彩校正、色调映射、LUT）
 * 4. 增量渲染与脏区域检测
 * 5. 智能代理切换
 */

import type { Timeline, MediaAsset, Clip } from '../model';

// ==================== 类型定义 ====================

/** WebGPU 设备状态 */
export type WebGPUDeviceStatus = 'uninitialized' | 'initializing' | 'ready' | 'lost' | 'error';

/** 渲染质量级别 */
export type RenderQuality = 'full' | 'half' | 'quarter' | 'eighth';

/** 代理策略 */
export type ProxyStrategy = 'auto' | 'original' | 'proxy' | 'adaptive';

/** 渲染视口 */
export interface RenderViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollTop: number;
  scrollLeft: number;
  zoom: number;
}

/** 帧解码请求 */
export interface FrameDecodeRequest {
  frame: number;
  time: number;
  priority: number; // 0-1, 1 = highest
  quality: RenderQuality;
  useProxy: boolean;
}

/** 帧解码结果 */
export interface FrameDecodeResult {
  frame: number;
  texture: GPUTexture | null;
  bitmap: ImageBitmap | null;
  decodeTime: number;
  fromCache: boolean;
  quality: RenderQuality;
}

/** 脏区域 */
export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: 'clip-change' | 'effect-update' | 'transform' | 'scroll' | 'resize';
}

/** WebGPU 渲染管线配置 */
export interface WebGPURenderPipelineConfig {
  maxCacheFrames: number;
  maxCacheBytes: number;
  prefetchFrames: number;
  maxConcurrentDecodes: number;
  fpsTarget: number;
  enableViewportCulling: boolean;
  enablePredictivePrefetch: boolean;
  proxySwitchThresholdMs: number;
  dirtyRegionBatchMs: number;
  preferredBackend: 'webgpu' | 'webgl2' | 'auto';
  enableHDR: boolean;
  maxTextureSize: number;
}

/** 默认配置 */
export const DEFAULT_WEBGPU_CONFIG: WebGPURenderPipelineConfig = {
  maxCacheFrames: 120,
  maxCacheBytes: 1024 * 1024 * 1024, // 1GB for WebGPU
  prefetchFrames: 30,
  maxConcurrentDecodes: 8, // WebGPU can handle more concurrent ops
  fpsTarget: 60,
  enableViewportCulling: true,
  enablePredictivePrefetch: true,
  proxySwitchThresholdMs: 16,
  dirtyRegionBatchMs: 8,
  preferredBackend: 'auto',
  enableHDR: true,
  maxTextureSize: 8192,
};

/** GPU 设备信息 */
export interface WebGPUDeviceInfo {
  backend: 'webgpu' | 'webgl2' | 'cpu-fallback';
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  maxComputeWorkgroupSize: [number, number, number];
  supportsWebGPU: boolean;
  supportsWebGL2: boolean;
  vramEstimateMB: number;
  features: string[];
  limits: Record<string, number>;
}

/** 渲染统计 */
export interface WebGPURenderStats {
  frameTimeMs: number;
  gpuTimeMs: number;
  uploadTimeMs: number;
  textureMemoryMB: number;
  bufferMemoryMB: number;
  framesRendered: number;
  cacheHits: number;
  cacheMisses: number;
  drawCalls: number;
  triangles: number;
}

/** 色彩校正参数 */
export interface ColorCorrectionParams {
  lift: { r: number; g: number; b: number };
  liftMaster: number;
  gamma: { r: number; g: number; b: number };
  gammaMaster: number;
  gain: { r: number; g: number; b: number };
  gainMaster: number;
  offset: { r: number; g: number; b: number };
  offsetMaster: number;
  temperature: number;
  tint: number;
  contrast: number;
  pivot: number;
  saturation: number;
  hueRotation: number;
}

/** 色调映射参数 */
export interface ToneMappingParams {
  method: 'none' | 'reinhard' | 'filmic' | 'aces-hill' | 'aces-narkowicz' | 'agx';
  exposure: number;
  whitePoint: number;
}

/** 3D LUT 数据 */
export interface LUT3DData {
  size: number;
  data: Float32Array;
  textureId: string;
  format: 'rgb' | 'rgba';
}

/** 渲染管线回调 */
export type WebGPUStatusCallback = (status: WebGPUDeviceStatus, message: string) => void;

// ==================== WGSL 着色器 ====================

/** 全屏四边形顶点着色器 */
const FULLSCREEN_VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );

  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}
`;

/** 色彩处理片段着色器 */
const COLOR_PROCESSING_FRAGMENT_SHADER = `
struct ColorCorrectionParams {
  lift: vec4<f32>,
  gamma: vec4<f32>,
  gain: vec4<f32>,
  offset: vec4<f32>,
  temperature: f32,
  tint: f32,
  contrast: f32,
  pivot: f32,
  saturation: f32,
  hueRotation: f32,
  exposure: f32,
  toneMappingMethod: i32,
  lutIntensity: f32,
  enableFlags: i32,  // bit0=LUT, bit1=CC, bit2=TM
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var lutTexture: texture_3d<f32>;
@group(0) @binding(3) var<uniform> params: ColorCorrectionParams;

struct FragmentOutput {
  @location(0) color: vec4<f32>,
}

fn applyLiftGammaGain(color: vec3<f32>, lift: vec4<f32>, gamma: vec4<f32>, gain: vec4<f32>, offset: vec4<f32>) -> vec3<f32> {
  let lifted = color + lift.rgb * (1.0 - color) + lift.a;
  let gained = lifted * (1.0 + gain.rgb) + gain.a;
  let gammaCorrected = pow(max(gained, vec3<f32>(0.0001)), vec3<f32>(1.0) / (vec3<f32>(1.0) + gamma.rgb + gamma.a));
  return clamp(gammaCorrected + offset.rgb + offset.a, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyTemperatureTint(color: vec3<f32>, temperature: f32, tint: f32) -> vec3<f32> {
  var c = color;
  let tempFactor = temperature / 100.0;
  let tintFactor = tint / 100.0;
  c.r += tempFactor * 0.1;
  c.b -= tempFactor * 0.1;
  c.g += tintFactor * 0.05;
  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyContrast(color: vec3<f32>, contrast: f32, pivot: f32) -> vec3<f32> {
  let factor = 1.0 + contrast / 100.0;
  return clamp((color - vec3<f32>(pivot)) * factor + vec3<f32>(pivot), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applySaturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
  let lum = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let sat = saturation / 100.0;
  return clamp(mix(vec3<f32>(lum), color, sat), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyHueRotation(color: vec3<f32>, degrees: f32) -> vec3<f32> {
  let rad = radians(degrees);
  let cosA = cos(rad);
  let sinA = sin(rad);
  let hueMatrix = mat3x3<f32>(
    0.213 + cosA * 0.787 - sinA * 0.213,
    0.715 - cosA * 0.715 - sinA * 0.715,
    0.072 - cosA * 0.072 + sinA * 0.928,
    0.213 - cosA * 0.213 + sinA * 0.143,
    0.715 + cosA * 0.285 + sinA * 0.140,
    0.072 - cosA * 0.072 - sinA * 0.283,
    0.213 - cosA * 0.213 - sinA * 0.787,
    0.715 - cosA * 0.715 + sinA * 0.715,
    0.072 + cosA * 0.928 + sinA * 0.072
  );
  return clamp(hueMatrix * color, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapReinhard(color: vec3<f32>) -> vec3<f32> {
  return color / (vec3<f32>(1.0) + color);
}

fn toneMapFilmic(color: vec3<f32>) -> vec3<f32> {
  let x = max(vec3<f32>(0.0), color - vec3<f32>(0.004));
  return (x * (6.2 * x + vec3<f32>(0.5))) / (x * (6.2 * x + vec3<f32>(1.7)) + vec3<f32>(0.06));
}

fn toneMapAcesHill(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + vec3<f32>(b))) / (color * (c * color + vec3<f32>(d)) + vec3<f32>(e)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapAgx(color: vec3<f32>) -> vec3<f32> {
  let agxOffset = vec3<f32>(0.008);
  let agxMinEv = -12.47;
  let agxMaxEv = 6.5;
  let logColor = log2(max(color, vec3<f32>(0.0001)));
  let normalized = (logColor - vec3<f32>(agxMinEv)) / (vec3<f32>(agxMaxEv - agxMinEv));
  return clamp(normalized + agxOffset, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyToneMapping(color: vec3<f32>, method: i32, exposure: f32) -> vec3<f32> {
  var c = color * pow(2.0, exposure);
  if (method == 0) { return c; } // none
  if (method == 1) { return toneMapReinhard(c); }
  if (method == 2) { return toneMapFilmic(c); }
  if (method == 3) { return toneMapAcesHill(c); }
  if (method == 4) { return toneMapAcesHill(c); } // fallback
  if (method == 5) { return toneMapAgx(c); }
  return toneMapAcesHill(c); // default
}

@fragment
fn main(@location(0) uv: vec2<f32>) -> FragmentOutput {
  var color = textureSample(inputTexture, textureSampler, uv);

  // 色彩校正
  if ((params.enableFlags & 2) != 0) {
    color.rgb = applyLiftGammaGain(color.rgb, params.lift, params.gamma, params.gain, params.offset);
    color.rgb = applyTemperatureTint(color.rgb, params.temperature, params.tint);
    color.rgb = applyContrast(color.rgb, params.contrast, params.pivot);
    color.rgb = applySaturation(color.rgb, params.saturation);
    if (abs(params.hueRotation) > 0.01) {
      color.rgb = applyHueRotation(color.rgb, params.hueRotation);
    }
  }

  // 色调映射
  if ((params.enableFlags & 4) != 0) {
    color.rgb = applyToneMapping(color.rgb, params.toneMappingMethod, params.exposure);
  }

  // 3D LUT
  if ((params.enableFlags & 1) != 0) {
    let lutColor = textureSample(lutTexture, textureSampler, color.rgb).rgb;
    color.rgb = mix(color.rgb, lutColor, params.lutIntensity);
  }

  var output: FragmentOutput;
  output.color = vec4<f32>(clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
  return output;
}
`;

// ==================== 帧缓存管理器 ====================

export class WebGPUFrameCacheManager {
  private cache = new Map<number, FrameDecodeResult>();
  private accessOrder: number[] = [];
  private totalBytes = 0;
  private readonly maxFrames: number;
  private readonly maxBytes: number;
  private hits = 0;
  private misses = 0;

  constructor(maxFrames = 120, maxBytes = 1024 * 1024 * 1024) {
    this.maxFrames = maxFrames;
    this.maxBytes = maxBytes;
  }

  get(frame: number): FrameDecodeResult | undefined {
    const result = this.cache.get(frame);
    if (result) {
      this.touchFrame(frame);
      this.hits++;
      return result;
    }
    this.misses++;
    return undefined;
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

    if (result.texture) {
      result.texture.destroy();
    }
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
      if (result.texture) {
        result.texture.destroy();
      }
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
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      hits: this.hits,
      misses: this.misses,
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

export class WebGPUPredictivePrefetcher {
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

    for (let i = 1; i <= prefetchCount; i++) {
      const predictedFrame = currentFrame + (i * direction * this.predictedSpeed);
      frames.push(Math.round(predictedFrame));
    }

    return frames;
  }

  getPrediction(): { direction: 'forward' | 'backward' | 'static'; speed: number } {
    return {
      direction: this.predictedDirection,
      speed: this.predictedSpeed,
    };
  }

  private updatePrediction(): void {
    if (this.playbackHistory.length < 2) {
      return;
    }

    const recent = this.playbackHistory.slice(-10);
    const timeDiffs: number[] = [];
    const positionDiffs: number[] = [];

    for (let i = 1; i < recent.length; i++) {
      timeDiffs.push(recent[i].timestamp - recent[i - 1].timestamp);
      positionDiffs.push(recent[i].time - recent[i - 1].time);
    }

    const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const avgPositionDiff = positionDiffs.reduce((a, b) => a + b, 0) / positionDiffs.length;

    if (Math.abs(avgPositionDiff) < 0.01) {
      this.predictedDirection = 'static';
    } else if (avgPositionDiff > 0) {
      this.predictedDirection = 'forward';
    } else {
      this.predictedDirection = 'backward';
    }

    this.predictedSpeed = Math.abs(avgPositionDiff / avgTimeDiff) * 1000;
  }
}

// ==================== 脏区域管理器 ====================

export class WebGPUDirtyRegionManager {
  private dirtyRegions: DirtyRegion[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchMs: number;

  constructor(batchMs = 8) {
    this.batchMs = batchMs;
  }

  addRegion(region: DirtyRegion): void {
    this.dirtyRegions.push(region);

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flush();
      }, this.batchMs);
    }
  }

  addClipChange(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'clip-change' });
  }

  addEffectUpdate(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'effect-update' });
  }

  addTransform(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'transform' });
  }

  addScroll(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'scroll' });
  }

  addResize(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'resize' });
  }

  flush(): DirtyRegion[] {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const regions = this.mergeRegions(this.dirtyRegions);
    this.dirtyRegions = [];
    return regions;
  }

  hasDirtyRegions(): boolean {
    return this.dirtyRegions.length > 0;
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.dirtyRegions = [];
  }

  private mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    if (regions.length <= 1) {
      return regions;
    }

    // Simple merge: combine all regions into a single bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const region of regions) {
      minX = Math.min(minX, region.x);
      minY = Math.min(minY, region.y);
      maxX = Math.max(maxX, region.x + region.width);
      maxY = Math.max(maxY, region.y + region.height);
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

// ==================== WebGPU 渲染引擎 ====================

/**
 * WebGPU 渲染引擎
 *
 * 提供完整的 WebGPU 渲染管线，支持：
 * - 视频帧 GPU 解码与上传
 * - 色彩校正、色调映射、LUT 应用
 * - 增量渲染与脏区域检测
 * - 智能代理切换
 * - 性能监控与统计
 */
export class WebGPURenderEngine {
  private config: WebGPURenderPipelineConfig;
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;

  private frameCache: WebGPUFrameCacheManager;
  private prefetcher: WebGPUPredictivePrefetcher;
  private dirtyRegionManager: WebGPUDirtyRegionManager;

  private deviceInfo: WebGPUDeviceInfo | null = null;
  private status: WebGPUDeviceStatus = 'uninitialized';
  private statusListeners: Set<WebGPUStatusCallback> = new Set();
  private stats: WebGPURenderStats;

  private colorPipeline: GPURenderPipeline | null = null;
  private colorBindGroupLayout: GPUBindGroupLayout | null = null;
  private colorParamsBuffer: GPUBuffer | null = null;

  private currentQuality: RenderQuality = 'full';
  private currentProxyStrategy: ProxyStrategy = 'adaptive';

  constructor(config?: Partial<WebGPURenderPipelineConfig>) {
    this.config = { ...DEFAULT_WEBGPU_CONFIG, ...config };
    this.frameCache = new WebGPUFrameCacheManager(this.config.maxCacheFrames, this.config.maxCacheBytes);
    this.prefetcher = new WebGPUPredictivePrefetcher();
    this.dirtyRegionManager = new WebGPUDirtyRegionManager(this.config.dirtyRegionBatchMs);
    this.stats = this.createEmptyStats();
  }

  // ==================== 初始化 ====================

  /**
   * 初始化 WebGPU 设备
   */
  async initialize(canvas?: HTMLCanvasElement): Promise<WebGPUDeviceInfo> {
    if (this.status === 'ready' && this.deviceInfo) {
      return this.deviceInfo;
    }

    this.status = 'initializing';
    this.notifyStatus('initializing', '正在初始化 WebGPU...');

    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
      }

      // Request adapter
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        throw new Error('Failed to get WebGPU adapter');
      }

      // Request device
      const requiredFeatures: GPUFeatureName[] = [];
      const requiredLimits: Record<string, number> = {};

      // Check for optional features
      if (this.adapter.features.has('texture-compression-bc')) {
        requiredFeatures.push('texture-compression-bc');
      }
      if (this.adapter.features.has('texture-compression-etc2')) {
        requiredFeatures.push('texture-compression-etc2');
      }

      this.device = await this.adapter.requestDevice({
        requiredFeatures,
        requiredLimits,
      });

      // Handle device lost
      this.device.lost.then((info) => {
        console.error('WebGPU device lost:', info.message);
        this.status = 'lost';
        this.notifyStatus('lost', `设备丢失: ${info.message}`);
      });

      // Setup canvas if provided
      if (canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('webgpu') as unknown as GPUCanvasContext | null;
        if (!this.context) {
          throw new Error('Failed to get WebGPU context');
        }

        this.context.configure({
          device: this.device,
          format: navigator.gpu!.getPreferredCanvasFormat(),
          alphaMode: 'premultiplied',
        });
      }

      // Create render pipelines
      await this.createRenderPipelines();

      // Gather device info
      this.deviceInfo = {
        backend: 'webgpu',
        vendor: this.adapter.info?.vendor || 'unknown',
        renderer: this.adapter.info?.device || 'unknown',
        maxTextureSize: this.device.limits.maxTextureDimension2D,
        maxComputeWorkgroupSize: [
          this.device.limits.maxComputeWorkgroupSizeX,
          this.device.limits.maxComputeWorkgroupSizeY,
          this.device.limits.maxComputeWorkgroupSizeZ,
        ],
        supportsWebGPU: true,
        supportsWebGL2: true,
        vramEstimateMB: 0,
        features: Array.from(this.adapter.features),
        limits: {
          maxTextureDimension2D: this.device.limits.maxTextureDimension2D,
          maxBufferSize: this.device.limits.maxBufferSize,
          maxStorageBufferBindingSize: this.device.limits.maxStorageBufferBindingSize,
        },
      };

      this.status = 'ready';
      this.notifyStatus('ready', 'WebGPU 就绪');
      return this.deviceInfo;

    } catch (error) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatus('error', `初始化失败: ${message}`);

      // Fallback to WebGL2 or CPU
      this.deviceInfo = {
        backend: 'cpu-fallback',
        vendor: 'cpu',
        renderer: 'cpu',
        maxTextureSize: 0,
        maxComputeWorkgroupSize: [0, 0, 0],
        supportsWebGPU: false,
        supportsWebGL2: false,
        vramEstimateMB: 0,
        features: [],
        limits: {},
      };

      return this.deviceInfo;
    }
  }

  // ==================== 渲染管线创建 ====================

  private async createRenderPipelines(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    // Create shader modules
    const vertexShaderModule = this.device.createShaderModule({
      code: FULLSCREEN_VERTEX_SHADER,
    });

    const fragmentShaderModule = this.device.createShaderModule({
      code: COLOR_PROCESSING_FRAGMENT_SHADER,
    });

    // Create bind group layout
    this.colorBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '3d' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.colorBindGroupLayout],
    });

    // Create render pipeline
    this.colorPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: navigator.gpu!.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // Create uniform buffer for color correction params
    this.colorParamsBuffer = this.device.createBuffer({
      size: 256, // Size of ColorCorrectionParams struct
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // ==================== 帧处理 ====================

  /**
   * 上传视频帧到 GPU
   */
  async uploadFrame(
    frame: number,
    bitmap: ImageBitmap,
    quality: RenderQuality = 'full'
  ): Promise<FrameDecodeResult> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const start = performance.now();

    // Check cache first
    const cached = this.frameCache.get(frame);
    if (cached) {
      return cached;
    }

    // Create texture from bitmap
    const texture = this.device.createTexture({
      size: { width: bitmap.width, height: bitmap.height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Copy bitmap to texture
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height }
    );

    const result: FrameDecodeResult = {
      frame,
      texture,
      bitmap,
      decodeTime: performance.now() - start,
      fromCache: false,
      quality,
    };

    // Estimate memory usage (4 bytes per pixel)
    const estimatedBytes = bitmap.width * bitmap.height * 4;
    this.frameCache.put(result, estimatedBytes);

    this.stats.framesRendered++;
    this.stats.uploadTimeMs += result.decodeTime;

    return result;
  }

  /**
   * 渲染帧到画布
   */
  async renderFrame(
    frameResult: FrameDecodeResult,
    colorCorrection?: ColorCorrectionParams,
    toneMapping?: ToneMappingParams,
    lutData?: LUT3DData,
    lutIntensity: number = 1.0
  ): Promise<void> {
    if (!this.device || !this.context || !this.colorPipeline) {
      throw new Error('Device not initialized');
    }

    const start = performance.now();

    // Get current texture from canvas
    const outputTexture = this.context.getCurrentTexture();

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Update color correction params
    if (this.colorParamsBuffer) {
      const params = this.buildColorParams(colorCorrection, toneMapping, lutIntensity);
      this.device.queue.writeBuffer(this.colorParamsBuffer, 0, params as unknown as BufferSource);
    }

    // Create bind group
    const bindGroup = this.createBindGroup(frameResult.texture, lutData);

    // Begin render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });

    renderPass.setPipeline(this.colorPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Wait for completion
    await this.device.queue.onSubmittedWorkDone();

    const elapsed = performance.now() - start;
    this.stats.frameTimeMs = elapsed;
    this.stats.gpuTimeMs += elapsed;
  }

  // ==================== 辅助方法 ====================

  private buildColorParams(
    colorCorrection?: ColorCorrectionParams,
    toneMapping?: ToneMappingParams,
    lutIntensity: number = 1.0
  ): Float32Array {
    const params = new Float32Array(64); // 256 bytes / 4

    if (colorCorrection) {
      // Lift
      params[0] = colorCorrection.lift.r;
      params[1] = colorCorrection.lift.g;
      params[2] = colorCorrection.lift.b;
      params[3] = colorCorrection.liftMaster;

      // Gamma
      params[4] = colorCorrection.gamma.r;
      params[5] = colorCorrection.gamma.g;
      params[6] = colorCorrection.gamma.b;
      params[7] = colorCorrection.gammaMaster;

      // Gain
      params[8] = colorCorrection.gain.r;
      params[9] = colorCorrection.gain.g;
      params[10] = colorCorrection.gain.b;
      params[11] = colorCorrection.gainMaster;

      // Offset
      params[12] = colorCorrection.offset.r;
      params[13] = colorCorrection.offset.g;
      params[14] = colorCorrection.offset.b;
      params[15] = colorCorrection.offsetMaster;

      // Other params
      params[16] = colorCorrection.temperature;
      params[17] = colorCorrection.tint;
      params[18] = colorCorrection.contrast;
      params[19] = colorCorrection.pivot;
      params[20] = colorCorrection.saturation;
      params[21] = colorCorrection.hueRotation;
    }

    if (toneMapping) {
      params[22] = toneMapping.exposure;
      params[23] = this.getToneMappingMethodIndex(toneMapping.method);
    }

    params[24] = lutIntensity;

    // Enable flags (bit0=LUT, bit1=CC, bit2=TM)
    let flags = 0;
    if (lutIntensity > 0) flags |= 1;
    if (colorCorrection) flags |= 2;
    if (toneMapping) flags |= 4;
    params[25] = flags;

    return params;
  }

  private getToneMappingMethodIndex(method: string): number {
    switch (method) {
      case 'none': return 0;
      case 'reinhard': return 1;
      case 'filmic': return 2;
      case 'aces-hill': return 3;
      case 'aces-narkowicz': return 4;
      case 'agx': return 5;
      default: return 3;
    }
  }

  private createBindGroup(
    inputTexture: GPUTexture | null,
    lutData?: LUT3DData
  ): GPUBindGroup {
    if (!this.device || !this.colorBindGroupLayout) {
      throw new Error('Device not initialized');
    }

    const entries: GPUBindGroupEntry[] = [];

    // Input texture
    if (inputTexture) {
      entries.push({
        binding: 0,
        resource: inputTexture.createView(),
      });
    }

    // Sampler
    entries.push({
      binding: 1,
      resource: this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      }),
    });

    // LUT texture (create dummy if not provided)
    if (lutData) {
      const lutTexture = this.createLUTTexture(lutData);
      entries.push({
        binding: 2,
        resource: lutTexture.createView(),
      });
    }

    // Uniform buffer
    if (this.colorParamsBuffer) {
      entries.push({
        binding: 3,
        resource: { buffer: this.colorParamsBuffer },
      });
    }

    return this.device.createBindGroup({
      layout: this.colorBindGroupLayout,
      entries,
    });
  }

  private createLUTTexture(lutData: LUT3DData): GPUTexture {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const texture = this.device.createTexture({
      size: { width: lutData.size, height: lutData.size, depthOrArrayLayers: lutData.size },
      format: 'rgba32float',
      dimension: '3d',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture },
      lutData.data as unknown as BufferSource,
      { bytesPerRow: lutData.size * 16, rowsPerImage: lutData.size },
      { width: lutData.size, height: lutData.size, depthOrArrayLayers: lutData.size }
    );

    return texture;
  }

  // ==================== 统计与状态 ====================

  private createEmptyStats(): WebGPURenderStats {
    return {
      frameTimeMs: 0,
      gpuTimeMs: 0,
      uploadTimeMs: 0,
      textureMemoryMB: 0,
      bufferMemoryMB: 0,
      framesRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      drawCalls: 0,
      triangles: 0,
    };
  }

  getStats(): WebGPURenderStats {
    const cacheStats = this.frameCache.getStats();
    return {
      ...this.stats,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      textureMemoryMB: cacheStats.bytes / (1024 * 1024),
    };
  }

  getStatus(): WebGPUDeviceStatus {
    return this.status;
  }

  getDeviceInfo(): WebGPUDeviceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }

  onStatusChange(callback: WebGPUStatusCallback): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(status: WebGPUDeviceStatus, message: string): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status, message);
      } catch (error) {
        console.error('Status listener error:', error);
      }
    }
  }

  // ==================== 配置更新 ====================

  getConfig(): WebGPURenderPipelineConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<WebGPURenderPipelineConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  setQuality(quality: RenderQuality): void {
    this.currentQuality = quality;
  }

  setProxyStrategy(strategy: ProxyStrategy): void {
    this.currentProxyStrategy = strategy;
  }

  // ==================== 清理 ====================

  destroy(): void {
    this.frameCache.clear();
    this.dirtyRegionManager.clear();

    if (this.colorParamsBuffer) {
      this.colorParamsBuffer.destroy();
      this.colorParamsBuffer = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.adapter = null;
    this.context = null;
    this.canvas = null;
    this.colorPipeline = null;
    this.colorBindGroupLayout = null;
    this.deviceInfo = null;
    this.status = 'uninitialized';
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 WebGPU 渲染引擎实例
 */
export function createWebGPURenderEngine(
  config?: Partial<WebGPURenderPipelineConfig>
): WebGPURenderEngine {
  return new WebGPURenderEngine(config);
}

/**
 * 检测 WebGPU 支持情况
 */
export async function detectWebGPUSupport(): Promise<{
  supported: boolean;
  adapterInfo?: GPUAdapterInfo;
  features?: string[];
  limits?: Record<string, number>;
}> {
  if (!navigator.gpu) {
    return { supported: false };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false };
    }

    return {
      supported: true,
      adapterInfo: adapter.info,
      features: Array.from(adapter.features),
      limits: {
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    };
  } catch {
    return { supported: false };
  }
}
