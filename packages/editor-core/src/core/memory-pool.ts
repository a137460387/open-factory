/**
 * 内存池管理器
 *
 * 核心优化策略：
 * 1. 大对象池化 - 视频帧缓冲、模型权重等复用
 * 2. 空闲期主动 GC - 避免编辑时卡顿
 * 3. 内存压力感知 - 动态调整缓存策略
 * 4. Transferable Objects 支持 - 减少 Worker 间数据拷贝
 */

// ==================== 类型定义 ====================

export type PoolObjectType = 'frame-buffer' | 'model-weight' | 'tensor' | 'audio-buffer' | 'generic';

export interface PoolObject<T = unknown> {
  id: string;
  type: PoolObjectType;
  data: T;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  transferable: boolean;
}

export interface PoolConfig {
  maxTotalBytes: number;
  maxObjectBytes: number;
  maxObjects: number;
  gcThresholdBytes: number;
  gcIdleDelayMs: number;
  enableAutoGC: boolean;
  enableTransferables: boolean;
}

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxTotalBytes: 1024 * 1024 * 1024, // 1GB
  maxObjectBytes: 256 * 1024 * 1024, // 256MB per object
  maxObjects: 1000,
  gcThresholdBytes: 768 * 1024 * 1024, // 768MB triggers GC
  gcIdleDelayMs: 100,
  enableAutoGC: true,
  enableTransferables: true,
};

export interface PoolStats {
  totalBytes: number;
  objectCount: number;
  hitRate: number;
  missCount: number;
  hitCount: number;
  gcCount: number;
  lastGCTime: number;
}

// ==================== 内存池实现 ====================

export class MemoryPool {
  private objects = new Map<string, PoolObject>();
  private totalBytes = 0;
  private config: PoolConfig;
  private hitCount = 0;
  private missCount = 0;
  private gcCount = 0;
  private lastGCTime = 0;
  private gcTimer: ReturnType<typeof setTimeout> | null = null;
  private idleCallbackId: number | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  // Public API

  acquire<T>(id: string, type: PoolObjectType, factory: () => T, sizeBytes: number): T {
    // Check if already in pool
    const existing = this.objects.get(id);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      existing.accessCount++;
      this.hitCount++;
      return existing.data as T;
    }

    this.missCount++;

    // Check size limits
    if (sizeBytes > this.config.maxObjectBytes) {
      throw new Error(`Object size ${sizeBytes} exceeds max ${this.config.maxObjectBytes}`);
    }

    // Ensure space
    while (this.totalBytes + sizeBytes > this.config.maxTotalBytes ||
           this.objects.size >= this.config.maxObjects) {
      if (!this.evictLRU()) break;
    }

    // Create new object
    const data = factory();
    const obj: PoolObject<T> = {
      id,
      type,
      data,
      sizeBytes,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      transferable: this.isTransferable(data),
    };

    this.objects.set(id, obj as PoolObject);
    this.totalBytes += sizeBytes;

    // Schedule GC if needed
    if (this.config.enableAutoGC && this.totalBytes > this.config.gcThresholdBytes) {
      this.scheduleGC();
    }

    return data;
  }

  release(id: string): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    this.objects.delete(id);
    this.totalBytes -= obj.sizeBytes;

    if (this.config.enableTransferables && obj.transferable) {
      this.disposeTransferable(obj.data);
    }
  }

  get<T>(id: string): T | undefined {
    const obj = this.objects.get(id);
    if (!obj) return undefined;

    obj.lastAccessedAt = Date.now();
    obj.accessCount++;
    this.hitCount++;

    return obj.data as T;
  }

  has(id: string): boolean {
    return this.objects.has(id);
  }

  clear(): void {
    for (const obj of this.objects.values()) {
      if (this.config.enableTransferables && obj.transferable) {
        this.disposeTransferable(obj.data);
      }
    }
    this.objects.clear();
    this.totalBytes = 0;
  }

  getStats(): PoolStats {
    return {
      totalBytes: this.totalBytes,
      objectCount: this.objects.size,
      hitRate: this.hitCount + this.missCount > 0
        ? this.hitCount / (this.hitCount + this.missCount)
        : 0,
      missCount: this.missCount,
      hitCount: this.hitCount,
      gcCount: this.gcCount,
      lastGCTime: this.lastGCTime,
    };
  }

  // Transferable Objects support

  transferOut<T>(id: string): { data: T; transferables: Transferable[] } | null {
    const obj = this.objects.get(id);
    if (!obj || !obj.transferable) return null;

    const transferables = this.extractTransferables(obj.data);
    this.objects.delete(id);
    this.totalBytes -= obj.sizeBytes;

    return { data: obj.data as T, transferables };
  }

  transferIn<T>(id: string, type: PoolObjectType, data: T, sizeBytes: number): void {
    const obj: PoolObject<T> = {
      id,
      type,
      data,
      sizeBytes,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      transferable: this.isTransferable(data),
    };

    this.objects.set(id, obj as PoolObject);
    this.totalBytes += sizeBytes;
  }

  // GC scheduling

  scheduleGC(): void {
    if (this.gcTimer) return;

    this.gcTimer = setTimeout(() => {
      this.gcTimer = null;
      this.runGC();
    }, this.config.gcIdleDelayMs);
  }

  runGC(): void {
    const startTime = performance.now();
    const targetBytes = this.config.maxTotalBytes * 0.7; // Target 70% usage

    // Sort by access pattern (LRU + frequency)
    const entries = [...this.objects.values()];
    entries.sort((a, b) => {
      const scoreA = a.accessCount / (Date.now() - a.lastAccessedAt + 1);
      const scoreB = b.accessCount / (Date.now() - b.lastAccessedAt + 1);
      return scoreA - scoreB; // Lower score = evict first
    });

    let evicted = 0;
    for (const obj of entries) {
      if (this.totalBytes <= targetBytes) break;

      this.objects.delete(obj.id);
      this.totalBytes -= obj.sizeBytes;
      evicted++;

      if (this.config.enableTransferables && obj.transferable) {
        this.disposeTransferable(obj.data);
      }
    }

    this.gcCount++;
    this.lastGCTime = performance.now() - startTime;

    // Use requestIdleCallback for remaining GC work
    if (this.totalBytes > targetBytes && typeof requestIdleCallback !== 'undefined') {
      this.idleCallbackId = requestIdleCallback(() => {
        this.idleCallbackId = null;
        this.runGC();
      });
    }
  }

  cancelPendingGC(): void {
    if (this.gcTimer) {
      clearTimeout(this.gcTimer);
      this.gcTimer = null;
    }
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }

  destroy(): void {
    this.cancelPendingGC();
    this.clear();
  }

  // Private helpers

  private evictLRU(): boolean {
    if (this.objects.size === 0) return false;

    let oldest: PoolObject | null = null;
    for (const obj of this.objects.values()) {
      if (!oldest || obj.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = obj;
      }
    }

    if (oldest) {
      this.objects.delete(oldest.id);
      this.totalBytes -= oldest.sizeBytes;

      if (this.config.enableTransferables && oldest.transferable) {
        this.disposeTransferable(oldest.data);
      }

      return true;
    }

    return false;
  }

  private isTransferable(data: unknown): boolean {
    return data instanceof ArrayBuffer ||
           data instanceof ImageBitmap ||
           data instanceof OffscreenCanvas;
  }

  private extractTransferables(data: unknown): Transferable[] {
    const transferables: Transferable[] = [];

    if (data instanceof ArrayBuffer) {
      transferables.push(data);
    } else if (data instanceof ImageBitmap) {
      transferables.push(data);
    } else if (data instanceof OffscreenCanvas) {
      transferables.push(data);
    } else if (typeof data === 'object' && data !== null) {
      // Search for nested transferables
      for (const value of Object.values(data)) {
        if (value instanceof ArrayBuffer || value instanceof ImageBitmap) {
          transferables.push(value);
        }
      }
    }

    return transferables;
  }

  private disposeTransferable(data: unknown): void {
    if (data instanceof ImageBitmap) {
      try {
        data.close();
      } catch {
        // Already closed
      }
    }
  }
}

// ==================== 帧缓冲池 ====================

export class FrameBufferPool {
  private pool: MemoryPool;
  private readonly bufferSize: number;
  private readonly maxBuffers: number;

  constructor(bufferSize: number, maxBuffers: number, pool?: MemoryPool) {
    this.bufferSize = bufferSize;
    this.maxBuffers = maxBuffers;
    this.pool = pool || new MemoryPool({
      maxTotalBytes: bufferSize * maxBuffers * 2,
      maxObjectBytes: bufferSize,
    });
  }

  acquire(frameIndex: number): ArrayBuffer {
    const id = `frame-${frameIndex}`;
    return this.pool.acquire<ArrayBuffer>(
      id,
      'frame-buffer',
      () => new ArrayBuffer(this.bufferSize),
      this.bufferSize,
    );
  }

  release(frameIndex: number): void {
    this.pool.release(`frame-${frameIndex}`);
  }

  getStats() {
    return this.pool.getStats();
  }

  destroy(): void {
    this.pool.destroy();
  }
}

// ==================== 模型权重池 ====================

export class ModelWeightPool {
  private pool: MemoryPool;
  private readonly maxModelSize: number;

  constructor(maxModelSize: number, pool?: MemoryPool) {
    this.maxModelSize = maxModelSize;
    this.pool = pool || new MemoryPool({
      maxTotalBytes: maxModelSize * 4,
      maxObjectBytes: maxModelSize,
    });
  }

  acquire(modelId: string, loader: () => ArrayBuffer): ArrayBuffer {
    return this.pool.acquire<ArrayBuffer>(
      `model-${modelId}`,
      'model-weight',
      loader,
      this.maxModelSize,
    );
  }

  release(modelId: string): void {
    this.pool.release(`model-${modelId}`);
  }

  getStats() {
    return this.pool.getStats();
  }

  destroy(): void {
    this.pool.destroy();
  }
}

// ==================== 工厂函数 ====================

export function createMemoryPool(config?: Partial<PoolConfig>): MemoryPool {
  return new MemoryPool(config);
}

export function createFrameBufferPool(bufferSize: number, maxBuffers: number): FrameBufferPool {
  return new FrameBufferPool(bufferSize, maxBuffers);
}

export function createModelWeightPool(maxModelSize: number): ModelWeightPool {
  return new ModelWeightPool(maxModelSize);
}
