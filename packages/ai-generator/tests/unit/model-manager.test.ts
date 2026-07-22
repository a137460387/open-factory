/**
 * Model manager tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelManager } from '../../src/models/model-manager.js';

describe('ModelManager', () => {
  let manager: ModelManager;

  beforeEach(() => {
    manager = new ModelManager();
  });

  describe('loadManifest', () => {
    it('should load model manifest', async () => {
      const manifest = await manager.loadManifest();

      expect(manifest).toBeDefined();
      expect(manifest.models).toBeDefined();
      expect(manifest.models.length).toBeGreaterThan(0);
      expect(manifest.defaultModel).toBeDefined();
      expect(manifest.supportedPrecisions).toBeDefined();
    });

    it('should return cached manifest on second call', async () => {
      const manifest1 = await manager.loadManifest();
      const manifest2 = await manager.loadManifest();

      expect(manifest1).toBe(manifest2);
    });
  });

  describe('getModelConfig', () => {
    it('should return model config for valid ID', async () => {
      const config = await manager.getModelConfig('wan2.1-t2v-14b');

      expect(config).toBeDefined();
      expect(config.id).toBe('wan2.1-t2v-14b');
      expect(config.name).toBeDefined();
      expect(config.version).toBeDefined();
    });

    it('should throw error for invalid model ID', async () => {
      await expect(manager.getModelConfig('non-existent')).rejects.toThrow(
        'Model non-existent not found'
      );
    });
  });

  describe('loadModel', () => {
    it('should load model data', async () => {
      const data = await manager.loadModel('wan2.1-t2v-14b');

      expect(data).toBeDefined();
      expect(data.byteLength).toBeGreaterThan(0);
    });

    it('should cache model when caching is enabled', async () => {
      await manager.loadModel('wan2.1-t2v-14b');

      expect(manager.isModelCached('wan2.1-t2v-14b')).toBe(true);
    });

    it('should load different precisions', async () => {
      const dataInt8 = await manager.loadModel('wan2.1-t2v-14b', 'int8');
      const dataInt4 = await manager.loadModel('wan2.1-t2v-14b', 'int4');

      expect(dataInt8.byteLength).toBeGreaterThan(dataInt4.byteLength);
    });
  });

  describe('cache management', () => {
    it('should report cache stats', async () => {
      await manager.loadModel('wan2.1-t2v-14b');

      const stats = manager.getCacheStats();

      expect(stats.entries).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should clear cache', async () => {
      await manager.loadModel('wan2.1-t2v-14b');
      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.entries).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
});
