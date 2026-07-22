/**
 * Model manager - handles model loading, caching, and switching
 */

import type { ModelConfig, ModelManifest, ModelPrecision, ComputeBackend } from '../types.js';
import { getConfig } from '../config.js';

// ============================================================
// Model Cache
// ============================================================

interface CachedModel {
  config: ModelConfig;
  data: ArrayBuffer;
  loadedAt: Date;
  lastUsed: Date;
  size: number;
}

// ============================================================
// Model Manager
// ============================================================

export class ModelManager {
  private cache: Map<string, CachedModel> = new Map();
  private manifest: ModelManifest | null = null;
  private config = getConfig();

  /**
   * Load model manifest
   */
  async loadManifest(): Promise<ModelManifest> {
    if (this.manifest) {
      return this.manifest;
    }

    // In production, load from file or API
    // For now, return a mock manifest
    this.manifest = {
      models: [
        {
          id: 'wan2.1-i2v-14b',
          name: 'Wan2.1 I2V 14B',
          version: '1.0.0',
          type: 'image-to-video',
          precision: 'int8',
          inputShape: [1, 3, 720, 1280],
          outputShape: [1, 3, 720, 1280],
          quantized: true,
          fileSize: 2.5 * 1024 * 1024 * 1024, // 2.5GB
          checksum: 'sha256:abc123...',
        },
        {
          id: 'wan2.1-t2v-14b',
          name: 'Wan2.1 T2V 14B',
          version: '1.0.0',
          type: 'text-to-video',
          precision: 'int8',
          inputShape: [1, 77, 768], // CLIP text encoder output
          outputShape: [1, 3, 720, 1280],
          quantized: true,
          fileSize: 2.8 * 1024 * 1024 * 1024, // 2.8GB
          checksum: 'sha256:def456...',
        },
      ],
      defaultModel: 'wan2.1-t2v-14b',
      supportedPrecisions: ['fp32', 'fp16', 'int8', 'int4'],
      minMemoryMB: 4096,
      recommendedMemoryMB: 8192,
    };

    return this.manifest;
  }

  /**
   * Get model configuration
   */
  async getModelConfig(modelId: string): Promise<ModelConfig> {
    const manifest = await this.loadManifest();
    const model = manifest.models.find((m) => m.id === modelId);

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    return model;
  }

  /**
   * Load model data
   */
  async loadModel(modelId: string, precision?: ModelPrecision): Promise<ArrayBuffer> {
    const config = await this.getModelConfig(modelId);
    const targetPrecision = precision || config.precision;
    const cacheKey = `${modelId}-${targetPrecision}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.lastUsed = new Date();
      return cached.data;
    }

    // Load model from storage
    const data = await this.loadModelFromStorage(modelId, targetPrecision);

    // Cache if enabled
    if (this.config.model.cacheModels) {
      this.addToCache(cacheKey, config, data);
    }

    return data;
  }

  /**
   * Load model from storage (mock implementation)
   */
  private async loadModelFromStorage(
    modelId: string,
    precision: ModelPrecision
  ): Promise<ArrayBuffer> {
    // In production, this would:
    // 1. Check if model file exists
    // 2. Download if not available locally
    // 3. Verify checksum
    // 4. Return the model data

    // Mock: return empty buffer
    const config = await this.getModelConfig(modelId);
    const sizeMultiplier = this.getPrecisionMultiplier(precision);
    const size = Math.floor(config.fileSize * sizeMultiplier);

    return new ArrayBuffer(size);
  }

  /**
   * Get precision size multiplier
   */
  private getPrecisionMultiplier(precision: ModelPrecision): number {
    switch (precision) {
      case 'fp32':
        return 1.0;
      case 'fp16':
        return 0.5;
      case 'int8':
        return 0.25;
      case 'int4':
        return 0.125;
      default:
        return 1.0;
    }
  }

  /**
   * Add model to cache
   */
  private addToCache(key: string, config: ModelConfig, data: ArrayBuffer): void {
    // Check cache size limit
    const currentSize = this.getCacheSize();
    const modelSize = data.byteLength;

    if (currentSize + modelSize > this.config.model.maxCacheSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      config,
      data,
      loadedAt: new Date(),
      lastUsed: new Date(),
      size: modelSize,
    });
  }

  /**
   * Get total cache size
   */
  private getCacheSize(): number {
    let total = 0;
    for (const cached of this.cache.values()) {
      total += cached.size;
    }
    return total;
  }

  /**
   * Evict least recently used model
   */
  private evictLeastUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    entries: number;
    totalSize: number;
    maxSize: number;
  } {
    return {
      entries: this.cache.size,
      totalSize: this.getCacheSize(),
      maxSize: this.config.model.maxCacheSize,
    };
  }

  /**
   * Check if model is cached
   */
  isModelCached(modelId: string, precision?: ModelPrecision): boolean {
    const config = this.cache.get(`${modelId}-${precision || 'default'}`);
    if (config) {
      return true;
    }

    // Check with default precision
    const defaultPrecision = this.config.model.defaultPrecision;
    return this.cache.has(`${modelId}-${defaultPrecision}`);
  }
}

// Singleton instance
export const modelManager = new ModelManager();
