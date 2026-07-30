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

// Re-export all types, constants, factories, validation, and conversion
export * from './gpu-color-processing-types';

// Re-export shader generation
export { generateColorProcessingFragmentShader, generateVertexShader, generateWebGPUComputeShader } from './gpu-color-processing-shaders';

// Re-export CPU fallback functions
export {
  cpuApplyLiftGammaGain,
  cpuApplyTemperatureTint,
  cpuApplyContrast,
  cpuApplySaturation,
  cpuToneMapAcesHill,
  cpuToneMapReinhard,
  cpuToneMapFilmic,
  cpuApplyToneMapping,
  cpuApply3DLUT,
  cpuProcessPixel,
  cpuProcessFrame,
} from './gpu-color-processing-cpu';

// Re-export GPUColorProcessor and utility functions
export {
  computeParamsHash,
  buildPipelineCacheKey,
  GPUColorProcessor,
} from './gpu-color-processing-classes';

import { CACHE_TTL_MS, MAX_PERFORMANCE_SAMPLES } from './gpu-color-processing-types';

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

// ==================== Preview Cache Manager ====================

/**
 * Preview frame cache
 *
 * Manages multi-resolution preview frame cache with incremental updates on parameter change.
 */
export class PreviewFrameCache {
  private entries: Map<string, { data: Uint8ClampedArray; width: number; height: number; ts: number }> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 32, ttlMs: number = CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /** Get cached frame */
  get(key: string): { data: Uint8ClampedArray; width: number; height: number } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return { data: entry.data, width: entry.width, height: entry.height };
  }

  /** Set cached frame */
  set(key: string, data: Uint8ClampedArray, width: number, height: number): void {
    if (this.entries.size >= this.maxEntries) {
      // Evict oldest
      let oldestKey = '';
      let oldestTs = Infinity;
      for (const [k, v] of this.entries) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { data: new Uint8ClampedArray(data), width, height, ts: Date.now() });
  }

  /** Evict expired entries */
  evict(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [k, v] of this.entries) {
      if (now - v.ts > this.ttlMs) {
        this.entries.delete(k);
        evicted++;
      }
    }
    return evicted;
  }

  /** Clear all cache */
  clear(): void {
    this.entries.clear();
  }

  /** Get cache size */
  size(): number {
    return this.entries.size;
  }
}

// ==================== Performance Monitor ====================

/**
 * GPU performance monitor
 *
 * Tracks frame time, GPU utilization and memory usage.
 */
export class GPUPerformanceMonitor {
  private frameTimes: number[] = [];
  private gpuTimes: number[] = [];
  private maxSamples: number;

  constructor(maxSamples: number = MAX_PERFORMANCE_SAMPLES) {
    this.maxSamples = maxSamples;
  }

  /** Record a frame */
  recordFrame(frameTimeMs: number, gpuTimeMs: number): void {
    this.frameTimes.push(frameTimeMs);
    this.gpuTimes.push(gpuTimeMs);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
      this.gpuTimes.shift();
    }
  }

  /** Get average frame time */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return roundTo(sum / this.frameTimes.length, 2);
  }

  /** Get P95 frame time */
  getP95FrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return roundTo(sorted[idx], 2);
  }

  /** Get estimated FPS */
  getEstimatedFPS(): number {
    const avg = this.getAverageFrameTime();
    return avg > 0 ? roundTo(1000 / avg, 1) : 0;
  }

  /** Get average GPU time */
  getAverageGPUTime(): number {
    if (this.gpuTimes.length === 0) return 0;
    const sum = this.gpuTimes.reduce((a, b) => a + b, 0);
    return roundTo(sum / this.gpuTimes.length, 2);
  }

  /** Get GPU utilization estimate (0-1) */
  getGPUUtilization(): number {
    const avgFrame = this.getAverageFrameTime();
    const avgGpu = this.getAverageGPUTime();
    return avgFrame > 0 ? roundTo(Math.min(avgGpu / avgFrame, 1), 3) : 0;
  }

  /** Reset stats */
  reset(): void {
    this.frameTimes = [];
    this.gpuTimes = [];
  }

  /** Get full report */
  getReport(): {
    avgFrameTimeMs: number;
    p95FrameTimeMs: number;
    avgGpuTimeMs: number;
    estimatedFPS: number;
    gpuUtilization: number;
    sampleCount: number;
  } {
    return {
      avgFrameTimeMs: this.getAverageFrameTime(),
      p95FrameTimeMs: this.getP95FrameTime(),
      avgGpuTimeMs: this.getAverageGPUTime(),
      estimatedFPS: this.getEstimatedFPS(),
      gpuUtilization: this.getGPUUtilization(),
      sampleCount: this.frameTimes.length,
    };
  }
}
