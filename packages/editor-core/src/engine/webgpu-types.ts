/**
 * WebGPU 渲染引擎类型定义
 */

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
