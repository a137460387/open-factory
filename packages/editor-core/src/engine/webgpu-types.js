/**
 * WebGPU 渲染引擎类型定义
 */
/** 默认配置 */
export const DEFAULT_WEBGPU_CONFIG = {
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
//# sourceMappingURL=webgpu-types.js.map