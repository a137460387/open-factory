/**
 * WebGPU 渲染引擎 — barrel re-export
 *
 * 所有实现已拆分为独立模块：
 * - webgpu-types.ts: 类型定义
 * - webgpu-shaders.ts: WGSL 着色器
 * - webgpu-frame-cache.ts: 帧缓存管理器
 * - webgpu-prefetcher.ts: 预测预加载器
 * - webgpu-dirty-region.ts: 脏区域管理器
 * - webgpu-render-engine-core.ts: 渲染引擎核心
 */
export type { WebGPUDeviceStatus, RenderQuality, ProxyStrategy, RenderViewport, FrameDecodeRequest, FrameDecodeResult, DirtyRegion, WebGPURenderPipelineConfig, WebGPUDeviceInfo, WebGPURenderStats, ColorCorrectionParams, ToneMappingParams, LUT3DData, WebGPUStatusCallback, } from './webgpu-types.js';
export { DEFAULT_WEBGPU_CONFIG } from './webgpu-types.js';
export { WebGPUFrameCacheManager } from './webgpu-frame-cache.js';
export { WebGPUPredictivePrefetcher } from './webgpu-prefetcher.js';
export { WebGPUDirtyRegionManager } from './webgpu-dirty-region.js';
export { WebGPURenderEngine, createWebGPURenderEngine, detectWebGPUSupport } from './webgpu-render-engine-core.js';
//# sourceMappingURL=webgpu-render-engine.d.ts.map