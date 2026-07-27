/**
 * WebGPU 帧缓存管理器
 * LRU 缓存，支持 GPU 纹理和 ImageBitmap 的生命周期管理
 */
export class WebGPUFrameCacheManager {
    cache = new Map();
    accessOrder = [];
    totalBytes = 0;
    maxFrames;
    maxBytes;
    hits = 0;
    misses = 0;
    constructor(maxFrames = 120, maxBytes = 1024 * 1024 * 1024) {
        this.maxFrames = maxFrames;
        this.maxBytes = maxBytes;
    }
    get(frame) {
        const result = this.cache.get(frame);
        if (result) {
            this.touchFrame(frame);
            this.hits++;
            return result;
        }
        this.misses++;
        return undefined;
    }
    put(result, estimatedBytes) {
        if (this.cache.has(result.frame)) {
            this.remove(result.frame);
        }
        while (this.cache.size >= this.maxFrames || this.totalBytes + estimatedBytes > this.maxBytes) {
            if (this.accessOrder.length === 0)
                break;
            this.remove(this.accessOrder[0]);
        }
        this.cache.set(result.frame, result);
        this.accessOrder.push(result.frame);
        this.totalBytes += estimatedBytes;
    }
    has(frame) {
        return this.cache.has(frame);
    }
    remove(frame) {
        const result = this.cache.get(frame);
        if (!result)
            return;
        this.cache.delete(frame);
        this.accessOrder = this.accessOrder.filter(f => f !== frame);
        if (result.texture) {
            result.texture.destroy();
        }
        if (result.bitmap) {
            try {
                result.bitmap.close();
            }
            catch {
                // Bitmap may already be closed
            }
        }
    }
    retainAround(centerFrame, range) {
        const minFrame = centerFrame - range;
        const maxFrame = centerFrame + range;
        for (const frame of [...this.cache.keys()]) {
            if (frame < minFrame || frame > maxFrame) {
                this.remove(frame);
            }
        }
    }
    clear() {
        for (const result of this.cache.values()) {
            if (result.texture) {
                result.texture.destroy();
            }
            if (result.bitmap) {
                try {
                    result.bitmap.close();
                }
                catch {
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
    touchFrame(frame) {
        const index = this.accessOrder.indexOf(frame);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
            this.accessOrder.push(frame);
        }
    }
}
//# sourceMappingURL=webgpu-frame-cache.js.map