/**
 * Render cache manager with LRU eviction
 */

import type { RenderResult } from './types';

export class RenderCacheManager {
  private cache: Map<string, RenderResult> = new Map();
  private accessOrder: string[] = [];
  private totalBytes: number = 0;
  private readonly maxBytes: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxBytes: number = 512 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  /**
   * Get cached render result
   */
  get(key: string): RenderResult | undefined {
    const result = this.cache.get(key);
    if (result) {
      this.touchKey(key);
      this.hits++;
      return result;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Store render result
   */
  put(key: string, result: RenderResult, estimatedBytes: number): void {
    if (this.cache.has(key)) {
      this.remove(key);
    }

    while (this.totalBytes + estimatedBytes > this.maxBytes) {
      if (this.accessOrder.length === 0) break;
      this.remove(this.accessOrder[0]);
    }

    this.cache.set(key, result);
    this.accessOrder.push(key);
    this.totalBytes += estimatedBytes;
  }

  /**
   * Remove cache entry
   */
  remove(key: string): void {
    const result = this.cache.get(key);
    if (!result) return;

    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);

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

  /**
   * Clear all cache
   */
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

  /**
   * Get cache stats
   */
  getStats(): { hits: number; misses: number; hitRate: number; sizeMB: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      sizeMB: this.totalBytes / (1024 * 1024),
    };
  }

  private touchKey(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
}
