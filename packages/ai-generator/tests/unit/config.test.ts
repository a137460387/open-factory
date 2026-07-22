/**
 * Config tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, getConfig, resetConfig } from '../../src/config.js';

describe('Config', () => {
  beforeEach(() => {
    resetConfig();
  });

  describe('loadConfig', () => {
    it('should load default config', () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.compute).toBeDefined();
      expect(config.generation).toBeDefined();
      expect(config.safety).toBeDefined();
      expect(config.usage).toBeDefined();
    });

    it('should apply overrides', () => {
      const config = loadConfig({
        model: {
          defaultPrecision: 'int4',
          path: './custom-models',
          cacheModels: false,
          maxCacheSize: 1024 * 1024 * 1024,
        },
      });

      expect(config.model.defaultPrecision).toBe('int4');
      expect(config.model.path).toBe('./custom-models');
      expect(config.model.cacheModels).toBe(false);
    });

    it('should validate config', () => {
      expect(() => {
        loadConfig({
          model: {
            defaultPrecision: 'invalid' as any,
            path: './models',
            cacheModels: true,
            maxCacheSize: 1024,
          },
        });
      }).toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return singleton config', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });

  describe('resetConfig', () => {
    it('should reset singleton config', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
    });
  });
});
