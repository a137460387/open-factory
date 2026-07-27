/**
 * WebGPU 帧缓存管理器
 * LRU 缓存，支持 GPU 纹理和 ImageBitmap 的生命周期管理
 */
import type { FrameDecodeResult } from './webgpu-types.js';
export declare class WebGPUFrameCacheManager {
    private cache;
    private accessOrder;
    private totalBytes;
    private readonly maxFrames;
    private readonly maxBytes;
    private hits;
    private misses;
    constructor(maxFrames?: number, maxBytes?: number);
    get(frame: number): FrameDecodeResult | undefined;
    put(result: FrameDecodeResult, estimatedBytes: number): void;
    has(frame: number): boolean;
    remove(frame: number): void;
    retainAround(centerFrame: number, range: number): void;
    clear(): void;
    getStats(): {
        frames: number;
        bytes: number;
        hitRate: number;
        hits: number;
        misses: number;
    };
    private touchFrame;
}
//# sourceMappingURL=webgpu-frame-cache.d.ts.map