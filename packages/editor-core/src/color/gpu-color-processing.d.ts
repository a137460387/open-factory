/**
 * GPU accelerated color processing module
 *
 * Features:
 * 1. GPU backend abstraction - WebGPU / WebGL2 dual backend
 * 2. 3D LUT GPU acceleration - texture sampling for high-performance LUT
 * 3. Color correction GPU pipeline - Lift/Gamma/Gain/Offset shaders
 * 4. Tone mapping GPU acceleration - multiple algorithms
 * 5. Multi-resolution preview - 1080p / 4K adaptive
 * 6. Preview cache - parameter hash cache mechanism
 * 7. Performance monitoring - frame time, GPU memory stats
 */
export * from './gpu-color-processing-types';
export { generateColorProcessingFragmentShader, generateVertexShader, generateWebGPUComputeShader } from './gpu-color-processing-shaders';
export { cpuApplyLiftGammaGain, cpuApplyTemperatureTint, cpuApplyContrast, cpuApplySaturation, cpuToneMapAcesHill, cpuToneMapReinhard, cpuToneMapFilmic, cpuApplyToneMapping, cpuApply3DLUT, cpuProcessPixel, cpuProcessFrame } from './gpu-color-processing-cpu';
export { computeParamsHash, buildPipelineCacheKey, GPUColorProcessor } from './gpu-color-processing-classes';
import { CACHE_TTL_MS, MAX_PERFORMANCE_SAMPLES } from './gpu-color-processing-types';
export declare class PreviewFrameCache {
    private entries;
    private maxEntries;
    private ttlMs;
    constructor(maxEntries?: number, ttlMs?: number);
    get(key: string): {
        data: Uint8ClampedArray;
        width: number;
        height: number;
    } | null;
    set(key: string, data: Uint8ClampedArray, width: number, height: number): void;
    evict(): number;
    clear(): void;
    size(): number;
}
export declare class GPUPerformanceMonitor {
    private frameTimes;
    private gpuTimes;
    private maxSamples;
    constructor(maxSamples?: number);
    recordFrame(frameTimeMs: number, gpuTimeMs: number): void;
    getAverageFrameTime(): number;
    getP95FrameTime(): number;
    getEstimatedFPS(): number;
    getAverageGPUTime(): number;
    getGPUUtilization(): number;
    reset(): void;
    getReport(): {
        avgFrameTimeMs: number;
        p95FrameTimeMs: number;
        avgGpuTimeMs: number;
        estimatedFPS: number;
        gpuUtilization: number;
        sampleCount: number;
    };
}
//# sourceMappingURL=gpu-color-processing.d.ts.map
