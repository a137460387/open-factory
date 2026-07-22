/**
 * AIGenerator tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AIGenerator, createAIGenerator } from '../../src/index.js';

describe('AIGenerator', () => {
  let generator: AIGenerator;

  beforeEach(() => {
    generator = new AIGenerator();
  });

  afterEach(() => {
    generator.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await generator.initialize();

      const capabilities = await generator.getComputeCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.backend).toBeDefined();
    });

    it('should not re-initialize if already initialized', async () => {
      await generator.initialize();
      await generator.initialize(); // Should not throw

      const capabilities = await generator.getComputeCapabilities();
      expect(capabilities).toBeDefined();
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models', async () => {
      const manifest = await generator.getAvailableModels();

      expect(manifest).toBeDefined();
      expect(manifest.models).toBeDefined();
      expect(manifest.models.length).toBeGreaterThan(0);
    });
  });

  describe('getComputeCapabilities', () => {
    it('should return compute capabilities', async () => {
      const capabilities = await generator.getComputeCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.backend).toBeDefined();
      expect(capabilities.maxTextureSize).toBeGreaterThan(0);
      expect(capabilities.maxBufferSize).toBeGreaterThan(0);
      expect(capabilities.memoryMB).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should report cache stats', async () => {
      const stats = generator.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.entries).toBeGreaterThanOrEqual(0);
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should clear cache', async () => {
      generator.clearCache();

      const stats = generator.getCacheStats();
      expect(stats.entries).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should dispose resources', () => {
      generator.dispose();

      // After dispose, should be able to re-initialize
      expect(async () => {
        await generator.initialize();
      }).not.toThrow();
    });
  });
});

describe('createAIGenerator', () => {
  it('should create initialized generator', async () => {
    const generator = await createAIGenerator();

    expect(generator).toBeDefined();

    const capabilities = await generator.getComputeCapabilities();
    expect(capabilities).toBeDefined();

    generator.dispose();
  });

  it('should create generator with custom config', async () => {
    const generator = await createAIGenerator({
      model: {
        defaultPrecision: 'int4',
        path: './models',
        cacheModels: true,
        maxCacheSize: 2 * 1024 * 1024 * 1024,
      },
    });

    expect(generator).toBeDefined();

    generator.dispose();
  });
});
