/**
 * WebGPU Memory Pool
 *
 * Sprint AU: Pools GPU buffer and texture allocations for AI inference
 * tensors and video decode textures. Avoids frequent alloc/free cycles,
 * reduces GC pressure, and reuses memory across operations.
 */

// WebGPU type declarations (available in modern browsers with WebGPU support)
declare global {
  interface GPUDevice {
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  }

  interface GPUBuffer {
    destroy(): void;
  }

  interface GPUTexture {
    destroy(): void;
  }

  interface GPUBufferDescriptor {
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }

  interface GPUTextureDescriptor {
    size: { width: number; height: number };
    format: string;
    usage: number;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BufferPoolEntry {
  buffer: GPUBuffer;
  size: number;
  lastUsed: number;
  inUse: boolean;
}

export interface TexturePoolEntry {
  texture: GPUTexture;
  width: number;
  height: number;
  format: string;
  lastUsed: number;
  inUse: boolean;
}

export interface MemoryPoolConfig {
  /** Maximum total GPU memory to pool (bytes) */
  maxPoolMemory: number;
  /** How long unused entries stay in the pool (ms) */
  idleTimeoutMs: number;
  /** How often to run cleanup (ms) */
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: MemoryPoolConfig = {
  maxPoolMemory: 256 * 1024 * 1024, // 256 MB
  idleTimeoutMs: 30_000, // 30 seconds
  cleanupIntervalMs: 10_000, // 10 seconds
};

// ---------------------------------------------------------------------------
// BufferPool
// ---------------------------------------------------------------------------

export class BufferPool {
  private pools = new Map<string, BufferPoolEntry[]>();
  private totalAllocated = 0;
  private device: GPUDevice;
  private config: MemoryPoolConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(device: GPUDevice, config?: Partial<MemoryPoolConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Acquire a buffer of at least the given size.
   * Returns an existing unused buffer if one fits, or creates a new one.
   */
  acquire(size: number, usage: number): GPUBuffer {
    const key = this.poolKey(size, usage);
    const pool = this.pools.get(key) ?? [];

    // Find an unused buffer in this pool
    const entry = pool.find((e) => !e.inUse && e.size >= size);
    if (entry) {
      entry.inUse = true;
      entry.lastUsed = Date.now();
      return entry.buffer;
    }

    // Check if we need to evict before allocating
    if (this.totalAllocated + size > this.config.maxPoolMemory) {
      this.evict(size);
    }

    // Allocate a new buffer
    const buffer = this.device.createBuffer({
      size: this.alignSize(size),
      usage,
      mappedAtCreation: false,
    });

    const newEntry: BufferPoolEntry = {
      buffer,
      size: this.alignSize(size),
      lastUsed: Date.now(),
      inUse: true,
    };

    pool.push(newEntry);
    this.pools.set(key, pool);
    this.totalAllocated += newEntry.size;

    return buffer;
  }

  /**
   * Release a buffer back to the pool for reuse.
   */
  release(buffer: GPUBuffer): void {
    for (const [, pool] of this.pools) {
      const entry = pool.find((e) => e.buffer === buffer);
      if (entry) {
        entry.inUse = false;
        entry.lastUsed = Date.now();
        return;
      }
    }
  }

  /**
   * Destroy the pool and all GPU resources.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [, pool] of this.pools) {
      for (const entry of pool) {
        entry.buffer.destroy();
      }
    }
    this.pools.clear();
    this.totalAllocated = 0;
  }

  /**
   * Get pool statistics.
   */
  getStats(): { totalAllocated: number; bufferCount: number; pools: number } {
    let bufferCount = 0;
    for (const [, pool] of this.pools) {
      bufferCount += pool.length;
    }
    return {
      totalAllocated: this.totalAllocated,
      bufferCount,
      pools: this.pools.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private poolKey(size: number, usage: number): string {
    // Round size up to nearest power of 2 for better pooling
    const roundedSize = this.alignSize(size);
    return `${roundedSize}-${usage}`;
  }

  private alignSize(size: number): number {
    // Align to 256 bytes (WebGPU requirement)
    return Math.ceil(size / 256) * 256;
  }

  private evict(neededSize: number): void {
    // LRU eviction: remove oldest unused entries until we have enough space
    const allEntries: BufferPoolEntry[] = [];
    for (const [, pool] of this.pools) {
      for (const entry of pool) {
        if (!entry.inUse) {
          allEntries.push(entry);
        }
      }
    }

    // Sort by last used (oldest first)
    allEntries.sort((a, b) => a.lastUsed - b.lastUsed);

    for (const entry of allEntries) {
      if (this.totalAllocated + neededSize <= this.config.maxPoolMemory) {
        break;
      }

      entry.buffer.destroy();
      this.totalAllocated -= entry.size;

      // Remove from pool
      for (const [key, pool] of this.pools) {
        const idx = pool.indexOf(entry);
        if (idx !== -1) {
          pool.splice(idx, 1);
          if (pool.length === 0) {
            this.pools.delete(key);
          }
          break;
        }
      }
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, pool] of this.pools) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const entry = pool[i];
        if (!entry.inUse && now - entry.lastUsed > this.config.idleTimeoutMs) {
          entry.buffer.destroy();
          this.totalAllocated -= entry.size;
          pool.splice(i, 1);
        }
      }
      if (pool.length === 0) {
        this.pools.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TexturePool
// ---------------------------------------------------------------------------

export class TexturePool {
  private pools = new Map<string, TexturePoolEntry[]>();
  private totalAllocated = 0;
  private device: GPUDevice;
  private config: MemoryPoolConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(device: GPUDevice, config?: Partial<MemoryPoolConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Acquire a texture with the given dimensions and format.
   * Returns an existing unused texture if one fits, or creates a new one.
   */
  acquire(
    width: number,
    height: number,
    format: string,
    usage: number = 0x05, // TEXTURE_BINDING | COPY_DST
  ): GPUTexture {
    const key = this.poolKey(width, height, format);
    const pool = this.pools.get(key) ?? [];

    // Find an unused texture in this pool
    const entry = pool.find((e) => !e.inUse && e.width >= width && e.height >= height);
    if (entry) {
      entry.inUse = true;
      entry.lastUsed = Date.now();
      return entry.texture;
    }

    // Estimate memory usage
    const estimatedSize = this.estimateTextureSize(width, height, format);

    // Check if we need to evict
    if (this.totalAllocated + estimatedSize > this.config.maxPoolMemory) {
      this.evict(estimatedSize);
    }

    // Allocate a new texture
    const texture = this.device.createTexture({
      size: { width, height },
      format,
      usage,
    });

    const newEntry: TexturePoolEntry = {
      texture,
      width,
      height,
      format,
      lastUsed: Date.now(),
      inUse: true,
    };

    pool.push(newEntry);
    this.pools.set(key, pool);
    this.totalAllocated += estimatedSize;

    return texture;
  }

  /**
   * Release a texture back to the pool for reuse.
   */
  release(texture: GPUTexture): void {
    for (const [, pool] of this.pools) {
      const entry = pool.find((e) => e.texture === texture);
      if (entry) {
        entry.inUse = false;
        entry.lastUsed = Date.now();
        return;
      }
    }
  }

  /**
   * Destroy the pool and all GPU resources.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [, pool] of this.pools) {
      for (const entry of pool) {
        entry.texture.destroy();
      }
    }
    this.pools.clear();
    this.totalAllocated = 0;
  }

  /**
   * Get pool statistics.
   */
  getStats(): { totalAllocated: number; textureCount: number; pools: number } {
    let textureCount = 0;
    for (const [, pool] of this.pools) {
      textureCount += pool.length;
    }
    return {
      totalAllocated: this.totalAllocated,
      textureCount,
      pools: this.pools.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private poolKey(width: number, height: number, format: string): string {
    return `${width}x${height}-${format}`;
  }

  private estimateTextureSize(width: number, height: number, format: string): number {
    // Rough estimate based on format
    const bytesPerPixel: Record<string, number> = {
      'rgba8unorm': 4,
      'rgba8snorm': 4,
      'rgba8uint': 4,
      'rgba8sint': 4,
      'bgra8unorm': 4,
      'r16float': 2,
      'rg16float': 4,
      'rgba16float': 8,
      'r32float': 4,
      'rg32float': 8,
      'rgba32float': 16,
    };
    const bpp = bytesPerPixel[format] ?? 4;
    return width * height * bpp;
  }

  private evict(neededSize: number): void {
    const allEntries: TexturePoolEntry[] = [];
    for (const [, pool] of this.pools) {
      for (const entry of pool) {
        if (!entry.inUse) {
          allEntries.push(entry);
        }
      }
    }

    allEntries.sort((a, b) => a.lastUsed - b.lastUsed);

    for (const entry of allEntries) {
      if (this.totalAllocated + neededSize <= this.config.maxPoolMemory) {
        break;
      }

      const size = this.estimateTextureSize(entry.width, entry.height, entry.format);
      entry.texture.destroy();
      this.totalAllocated -= size;

      for (const [key, pool] of this.pools) {
        const idx = pool.indexOf(entry);
        if (idx !== -1) {
          pool.splice(idx, 1);
          if (pool.length === 0) {
            this.pools.delete(key);
          }
          break;
        }
      }
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, pool] of this.pools) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const entry = pool[i];
        if (!entry.inUse && now - entry.lastUsed > this.config.idleTimeoutMs) {
          const size = this.estimateTextureSize(entry.width, entry.height, entry.format);
          entry.texture.destroy();
          this.totalAllocated -= size;
          pool.splice(i, 1);
        }
      }
      if (pool.length === 0) {
        this.pools.delete(key);
      }
    }
  }
}
